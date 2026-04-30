"use server";

/**
 * Server actions for the public referee confirm/decline page.
 *
 * These run WITHOUT a user session — the referee authenticates only via
 * the one-time token in the URL. We use `withUserRls(null)` (no session
 * context) and rely on the DB service role to update the row.
 *
 * Token handling mirrors app/api/auth/change-email/route.ts:
 *   • sha256(rawToken) == token_hash stored in DB
 *   • constant-time compare via timingSafeEqual (re-exported from send-email-change)
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { withUserRls } from "@/lib/db";

type ConfirmResult =
  | { ok: true; refereeName: string; requesterName: string | null }
  | { kind: "not_found" }
  | { kind: "already_actioned" }
  | { kind: "expired" }
  | { kind: "error"; message: string };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

type ReferenceRow = {
  id: string;
  user_id: string;
  referee_name: string;
  relationship: string;
  status: string;
  expires_at: string;
  token_hash: string;
};

type UserRow = { name: string | null; company_name: string | null };

async function lookupRow(
  tokenHash: string,
  rawToken: string,
): Promise<
  | { kind: "ok"; row: ReferenceRow; requesterName: string | null }
  | { kind: "not_found" }
  | { kind: "already_actioned" }
  | { kind: "expired" }
  | { kind: "error"; message: string }
> {
  try {
    return await withUserRls(null, async (sql) => {
      const rows = await sql<ReferenceRow[]>`
        select id, user_id, referee_name, relationship, status, expires_at, token_hash
        from public.references_received
        where token_hash = ${tokenHash}
        limit 1
      `;
      if (rows.length === 0) return { kind: "not_found" as const };

      const row = rows[0];
      if (row.status !== "sent") return { kind: "already_actioned" as const };
      if (new Date(row.expires_at).getTime() < Date.now()) return { kind: "expired" as const };
      if (!tokensMatch(row.token_hash, tokenHash)) return { kind: "not_found" as const };

      const userRows = await sql<UserRow[]>`
        select name, company_name from public.users where id = ${row.user_id} limit 1
      `;
      const requesterName =
        userRows[0]?.name?.trim() || userRows[0]?.company_name?.trim() || null;

      return { kind: "ok" as const, row, requesterName };
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    return { kind: "error" as const, message };
  }
}

export async function confirmReferenceAction(
  rawToken: string,
  endorsement: string,
): Promise<ConfirmResult> {
  if (!rawToken || rawToken.length !== 64) {
    return { kind: "not_found" };
  }

  const tokenHash = hashToken(rawToken);
  const lookup = await lookupRow(tokenHash, rawToken);
  if (lookup.kind !== "ok") return lookup;

  const trimmedEndorsement = endorsement.trim().slice(0, 500);

  try {
    await withUserRls(null, async (sql) => {
      await sql`
        update public.references_received
           set status        = 'confirmed',
               confirmed_at  = now(),
               endorsement   = ${trimmedEndorsement || null}
         where id = ${lookup.row.id}
           and status = 'sent'
      `;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    return { kind: "error", message };
  }

  return {
    ok: true,
    refereeName: lookup.row.referee_name,
    requesterName: lookup.requesterName,
  };
}

export async function declineReferenceAction(rawToken: string): Promise<ConfirmResult> {
  if (!rawToken || rawToken.length !== 64) {
    return { kind: "not_found" };
  }

  const tokenHash = hashToken(rawToken);
  const lookup = await lookupRow(tokenHash, rawToken);
  if (lookup.kind !== "ok") return lookup;

  try {
    await withUserRls(null, async (sql) => {
      await sql`
        update public.references_received
           set status      = 'declined',
               declined_at = now()
         where id = ${lookup.row.id}
           and status = 'sent'
      `;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    return { kind: "error", message };
  }

  return {
    ok: true,
    refereeName: lookup.row.referee_name,
    requesterName: lookup.requesterName,
  };
}
