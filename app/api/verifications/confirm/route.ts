import { NextResponse, type NextRequest } from "next/server";
import { withUserRls } from "@/lib/db";
import { hashToken, tokensMatch } from "@/lib/email/send-verification-claim";

/**
 * GET /api/verifications/confirm?token=...
 *
 * Confirms a pending employment verification. Same constant-time hash
 * compare pattern as Sprint 7's email-change route.
 *
 * On success: flips status to confirmed, redirects to /build?verified=1.
 * On failure: redirects to /build?verified=expired|invalid|consumed.
 */

export const dynamic = "force-dynamic";

function siteUrl(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  return host ? `${proto}://${host}`.replace(/\/$/, "") : new URL(req.url).origin;
}

function buildUrl(req: NextRequest, params: Record<string, string>): string {
  const base = siteUrl(req);
  const url = new URL("/build", base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(buildUrl(req, { verified: "invalid" }));
  }
  const tokenHash = hashToken(token);

  type Row = {
    id: string;
    user_id: string;
    status: string;
    token_hash: string;
    expires_at: Date;
    employer_domain: string | null;
  };

  let result:
    | { kind: "ok"; userId: string }
    | { kind: "expired" }
    | { kind: "consumed" }
    | { kind: "not_found" }
    | { kind: "error" };

  try {
    result = await withUserRls(null, async (sql) => {
      const rows = await sql<Row[]>`
        select id, user_id, status, token_hash, expires_at, employer_domain
        from public.verifications
        where token_hash = ${tokenHash}
        limit 1
      `;
      if (rows.length === 0) return { kind: "not_found" as const };
      const row = rows[0];

      if (!tokensMatch(row.token_hash, tokenHash)) {
        return { kind: "not_found" as const };
      }
      if (row.status !== "pending") {
        return { kind: "consumed" as const };
      }
      if (new Date(row.expires_at).getTime() < Date.now()) {
        return { kind: "expired" as const };
      }

      await sql`
        update public.verifications
        set status = 'confirmed'::public.verification_status,
            confirmed_via_email = ${row.employer_domain ? `verified@${row.employer_domain}` : null}
        where id = ${row.id}
      `;

      return { kind: "ok" as const, userId: row.user_id };
    });
  } catch (err) {
    console.error("[verify-claim:confirm] db error", err);
    result = { kind: "error" };
  }

  switch (result.kind) {
    case "ok":
      console.log(`[verify-claim:confirm] ok userId=${result.userId}`);
      return NextResponse.redirect(buildUrl(req, { verified: "1" }));
    case "expired":
      return NextResponse.redirect(buildUrl(req, { verified: "expired" }));
    case "consumed":
      return NextResponse.redirect(buildUrl(req, { verified: "consumed" }));
    case "not_found":
      return NextResponse.redirect(buildUrl(req, { verified: "invalid" }));
    default:
      return NextResponse.redirect(buildUrl(req, { verified: "error" }));
  }
}
