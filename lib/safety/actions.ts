"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import type { ReportReason } from "@/types/database";

/**
 * Trust & safety actions: block, unblock, report.
 *
 * Auth: any signed-in user (we don't requireWrite — a user in any account
 * label state should always be able to defend themselves).
 *
 * Side-effects of blocking:
 *   • Symmetric invisibility — both sides disappear from each other's feed.
 *   • Any pending intro requests on the match are withdrawn server-side.
 *   • Future profile-view inserts from either side are no-ops (the read
 *     path checks blocks, but we also explicitly drop existing views to
 *     avoid analytics leakage about previous interest).
 *   • Existing matches stay (the user might want the contact info as a
 *     historical record); they just stop seeing each other in discovery.
 */

const blockInputSchema = z.object({
  targetUserId: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .max(200, "Keep your private note under 200 chars.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

const unblockInputSchema = z.object({
  targetUserId: z.string().uuid(),
});

const reportReasons: [ReportReason, ...ReportReason[]] = [
  "spam",
  "harassment",
  "misrepresentation",
  "fraud_or_scam",
  "inappropriate_content",
  "impersonation",
  "other",
];

const reportInputSchema = z.object({
  targetUserId: z.string().uuid(),
  reason: z.enum(reportReasons),
  details: z
    .string()
    .trim()
    .min(10, "Tell us a bit more — at least 10 characters.")
    .max(2000, "Keep it under 2000 characters."),
});

type ActionResult<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

// ──────────────────────────────────────────────────────────────────────────
//  blockUserAction
// ──────────────────────────────────────────────────────────────────────────

export async function blockUserAction(
  raw: { targetUserId: string; reason?: string },
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Sign in to block." };

  const parsed = blockInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { targetUserId, reason } = parsed.data;
  if (targetUserId === userId) return { ok: false, error: "You can't block yourself." };

  try {
    await withUserRls(userId, async (sql) => {
      // 1. Insert the block (no-op if it already exists).
      await sql`
        insert into public.blocks (blocker_user_id, blocked_user_id, reason)
        values (${userId}, ${targetUserId}, ${reason ?? null})
        on conflict (blocker_user_id, blocked_user_id) do nothing
      `;

      // 2. Withdraw any pending intros between the two parties so the
      //    blocked user can't keep nagging via the inbox.
      await sql`
        update public.intro_requests
        set status = 'withdrawn'::public.intro_request_status
        where status = 'pending'
          and (
            (sender_user_id = ${userId} and recipient_user_id = ${targetUserId})
            or (sender_user_id = ${targetUserId} and recipient_user_id = ${userId})
          )
      `;

      // 3. Drop profile-view rows in either direction. Block = full reset
      //    of analytics signal between the pair.
      await sql`
        delete from public.profile_views
        where (viewer_user_id = ${userId} and target_user_id = ${targetUserId})
           or (viewer_user_id = ${targetUserId} and target_user_id = ${userId})
      `;
    });

    console.log(`[safety:block] blocker=${userId} blocked=${targetUserId}`);
    revalidatePath("/feed");
    revalidatePath("/matches");
    revalidatePath("/inbox");
    revalidatePath("/settings");
    revalidatePath(`/p/${targetUserId}`);
    return { ok: true };
  } catch (err) {
    console.error("[safety:block] failed", err);
    return { ok: false, error: "Could not block this user." };
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  unblockUserAction
// ──────────────────────────────────────────────────────────────────────────

export async function unblockUserAction(
  raw: { targetUserId: string },
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Sign in." };

  const parsed = unblockInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  try {
    await withUserRls(userId, async (sql) => {
      await sql`
        delete from public.blocks
        where blocker_user_id = ${userId}
          and blocked_user_id = ${parsed.data.targetUserId}
      `;
    });
    console.log(`[safety:unblock] blocker=${userId} blocked=${parsed.data.targetUserId}`);
    revalidatePath("/settings");
    revalidatePath("/feed");
    return { ok: true };
  } catch (err) {
    console.error("[safety:unblock] failed", err);
    return { ok: false, error: "Could not unblock." };
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  reportUserAction
// ──────────────────────────────────────────────────────────────────────────

export async function reportUserAction(
  raw: { targetUserId: string; reason: ReportReason; details: string },
): Promise<ActionResult<{ reportId: string }>> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Sign in to report." };

  const parsed = reportInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { targetUserId, reason, details } = parsed.data;
  if (targetUserId === userId) return { ok: false, error: "You can't report yourself." };

  try {
    const reportId = await withUserRls<string>(userId, async (sql) => {
      const rows = await sql<{ id: string }[]>`
        insert into public.reports
          (reporter_user_id, reported_user_id, reason, details)
        values (${userId}, ${targetUserId}, ${reason}::public.report_reason, ${details})
        returning id
      `;
      return rows[0].id;
    });
    console.log(
      `[safety:report] reporter=${userId} reported=${targetUserId} reason=${reason} id=${reportId}`,
    );
    return { ok: true, reportId };
  } catch (err) {
    console.error("[safety:report] failed", err);
    return { ok: false, error: "Could not file report." };
  }
}
