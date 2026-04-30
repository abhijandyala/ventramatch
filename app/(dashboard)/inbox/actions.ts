"use server";

import { revalidatePath } from "next/cache";
import { withUserRls } from "@/lib/db";
import { requireWrite } from "@/lib/auth/access";
import {
  sendIntroSchema,
  respondIntroSchema,
  withdrawIntroSchema,
  type SendIntroInput,
  type RespondIntroInput,
  type WithdrawIntroInput,
} from "@/lib/validation/intros";

/**
 * Server actions backing the intro_requests table.
 *
 * Auth: every action gates through requireWrite() — caller must be
 * signed in, email-verified, onboarded, and not in_review/rejected/banned.
 *
 * Constraints enforced server-side that aren't in Zod:
 *   • match must exist and viewer must be a participant (DB trigger)
 *   • recipient is computed server-side, not trusted from the client
 *   • only the recipient can accept/decline; only the sender can withdraw
 *   • can't send a 2nd pending intro on the same match while one is open
 */

type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

// ──────────────────────────────────────────────────────────────────────────
//  sendIntro
// ──────────────────────────────────────────────────────────────────────────

export async function sendIntroAction(
  raw: SendIntroInput,
): Promise<ActionResult<{ introId: string }>> {
  const access = await requireWrite();
  if (!access.ok) return { ok: false, error: access.message };

  const parsed = sendIntroSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { matchId, message, proposedTimes, linkUrl } = parsed.data;

  try {
    const introId = await withUserRls<string>(access.userId, async (sql) => {
      // 1. Fetch the match so we can compute the recipient server-side.
      const matchRows = await sql<{
        id: string;
        founder_user_id: string;
        investor_user_id: string;
      }[]>`
        select id, founder_user_id, investor_user_id
        from public.matches
        where id = ${matchId}
        limit 1
      `;
      if (matchRows.length === 0) {
        throw new Error("Match not found or you're not a participant.");
      }
      const m = matchRows[0];
      const isParticipant =
        m.founder_user_id === access.userId || m.investor_user_id === access.userId;
      if (!isParticipant) {
        throw new Error("Match not found or you're not a participant.");
      }
      const recipientUserId =
        m.founder_user_id === access.userId ? m.investor_user_id : m.founder_user_id;

      // 2. Block second outstanding intro for the same match in either direction.
      const pendingRows = await sql<{ id: string }[]>`
        select id from public.intro_requests
        where match_id = ${matchId}
          and status = 'pending'
          and (sender_user_id = ${access.userId} or recipient_user_id = ${access.userId})
        limit 1
      `;
      if (pendingRows.length > 0) {
        throw new Error("There's already a pending intro request on this match.");
      }

      // 3. Insert. proposed_times is JSONB — we pass a JSON string and cast
      //    explicitly. Avoids any ambiguity about how postgres-js will serialise
      //    a TS array.
      const inserted = await sql<{ id: string }[]>`
        insert into public.intro_requests
          (match_id, sender_user_id, recipient_user_id, message, proposed_times, link_url)
        values (
          ${matchId},
          ${access.userId},
          ${recipientUserId},
          ${message},
          ${JSON.stringify(proposedTimes)}::jsonb,
          ${linkUrl ?? null}
        )
        returning id
      `;
      return inserted[0].id;
    });

    console.log(`[intros:send] ok intro=${introId} sender=${access.userId}`);
    revalidatePath("/inbox");
    revalidatePath("/matches");
    revalidatePath("/dashboard");
    return { ok: true, introId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not send intro.";
    console.error("[intros:send] failed", err);
    return { ok: false, error: msg };
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  respondIntro (recipient only: accept | decline)
// ──────────────────────────────────────────────────────────────────────────

export async function respondIntroAction(
  raw: RespondIntroInput,
): Promise<ActionResult> {
  const access = await requireWrite();
  if (!access.ok) return { ok: false, error: access.message };

  const parsed = respondIntroSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { introId, action, acceptedTime, responseMessage } = parsed.data;

  try {
    await withUserRls(access.userId, async (sql) => {
      // Recipient-only operation. The DB trigger also enforces this (status
      // can't change from non-pending), but we want a clear error message.
      const rows = await sql<{
        recipient_user_id: string;
        status: string;
        proposed_times: string[];
      }[]>`
        select recipient_user_id, status, proposed_times
        from public.intro_requests
        where id = ${introId}
        limit 1
      `;
      if (rows.length === 0) throw new Error("Intro not found.");
      const row = rows[0];
      if (row.recipient_user_id !== access.userId) {
        throw new Error("Only the recipient can accept or decline.");
      }
      if (row.status !== "pending") {
        throw new Error(`This intro is already ${row.status}.`);
      }
      // If they picked an acceptedTime, sanity-check it was one of the proposals.
      if (action === "accept" && acceptedTime) {
        if (!row.proposed_times.includes(acceptedTime)) {
          throw new Error("Picked time wasn't on the proposed list.");
        }
      }

      const newStatus = action === "accept" ? "accepted" : "declined";
      await sql`
        update public.intro_requests
        set status = ${newStatus}::public.intro_request_status,
            accepted_time = ${acceptedTime ?? null},
            response_message = ${responseMessage ?? null}
        where id = ${introId}
      `;
    });

    console.log(`[intros:respond] intro=${introId} action=${action} by=${access.userId}`);
    revalidatePath("/inbox");
    revalidatePath(`/inbox/${introId}`);
    revalidatePath("/matches");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not respond.";
    console.error("[intros:respond] failed", err);
    return { ok: false, error: msg };
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  withdrawIntro (sender only)
// ──────────────────────────────────────────────────────────────────────────

export async function withdrawIntroAction(
  raw: WithdrawIntroInput,
): Promise<ActionResult> {
  const access = await requireWrite();
  if (!access.ok) return { ok: false, error: access.message };

  const parsed = withdrawIntroSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { introId } = parsed.data;

  try {
    await withUserRls(access.userId, async (sql) => {
      const rows = await sql<{ sender_user_id: string; status: string }[]>`
        select sender_user_id, status from public.intro_requests
        where id = ${introId}
        limit 1
      `;
      if (rows.length === 0) throw new Error("Intro not found.");
      const row = rows[0];
      if (row.sender_user_id !== access.userId) {
        throw new Error("Only the sender can withdraw an intro.");
      }
      if (row.status !== "pending") {
        throw new Error(`This intro is already ${row.status}.`);
      }
      await sql`
        update public.intro_requests
        set status = 'withdrawn'::public.intro_request_status
        where id = ${introId}
      `;
    });

    console.log(`[intros:withdraw] intro=${introId} by=${access.userId}`);
    revalidatePath("/inbox");
    revalidatePath(`/inbox/${introId}`);
    revalidatePath("/matches");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not withdraw.";
    console.error("[intros:withdraw] failed", err);
    return { ok: false, error: msg };
  }
}
