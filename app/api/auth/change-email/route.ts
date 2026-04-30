import { NextResponse, type NextRequest } from "next/server";
import { withUserRls } from "@/lib/db";
import { hashToken, tokensMatch } from "@/lib/email/send-email-change";

/**
 * GET /api/auth/change-email?token=...
 *
 * Confirms a pending email change. The token is sha256-hashed and the
 * comparison is constant-time.
 *
 * On success: swaps users.email, marks the request consumed, and bounces
 * the user to /settings#account?changed=1. Existing sessions stay live —
 * NextAuth's JWT carries the userId, not the email, so the change is
 * picked up automatically.
 *
 * On failure: redirects to /settings#account?error=<reason>.
 */

export const dynamic = "force-dynamic";

function siteUrlFromRequest(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  return host ? `${proto}://${host}`.replace(/\/$/, "") : "";
}

function settingsUrl(req: NextRequest, params: Record<string, string>): URL {
  const base = siteUrlFromRequest(req) || new URL(req.url).origin;
  const url = new URL("/settings", base);
  url.hash = "account";
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url;
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(settingsUrl(req, { error: "missing_token" }));
  }
  const tokenHash = hashToken(token);

  type Row = {
    id: string;
    user_id: string;
    new_email: string;
    token_hash: string;
    expires_at: Date;
    consumed_at: Date | null;
  };

  let result:
    | { kind: "ok"; userId: string; email: string }
    | { kind: "expired" }
    | { kind: "consumed" }
    | { kind: "not_found" }
    | { kind: "taken" }
    | { kind: "error" };

  try {
    result = await withUserRls(null, async (sql) => {
      const rows = await sql<Row[]>`
        select id, user_id, new_email, token_hash, expires_at, consumed_at
        from public.email_change_requests
        where token_hash = ${tokenHash}
        limit 1
      `;
      if (rows.length === 0) return { kind: "not_found" as const };
      const row = rows[0];
      if (row.consumed_at) return { kind: "consumed" as const };
      if (new Date(row.expires_at).getTime() < Date.now()) {
        return { kind: "expired" as const };
      }
      // Defence-in-depth constant-time compare.
      if (!tokensMatch(row.token_hash, tokenHash)) {
        return { kind: "not_found" as const };
      }

      // Re-check uniqueness — someone could have grabbed the email between
      // request and confirmation.
      const taken = await sql<{ id: string }[]>`
        select id from public.users
        where lower(email) = ${row.new_email}
          and id <> ${row.user_id}
        limit 1
      `;
      if (taken.length > 0) return { kind: "taken" as const };

      // Swap email + invalidate other pending requests + mark consumed.
      await sql`
        update public.users
        set email = ${row.new_email},
            -- The new address is already verified by virtue of clicking
            -- the magic link sent to it.
            email_verified_at = now()
        where id = ${row.user_id}
      `;
      await sql`
        update public.email_change_requests
        set consumed_at = now()
        where id = ${row.id}
      `;
      await sql`
        delete from public.email_change_requests
        where user_id = ${row.user_id}
          and id <> ${row.id}
          and consumed_at is null
      `;

      return { kind: "ok" as const, userId: row.user_id, email: row.new_email };
    });
  } catch (err) {
    console.error("[change-email] db error", err);
    result = { kind: "error" };
  }

  switch (result.kind) {
    case "ok":
      console.log(`[change-email:ok] userId=${result.userId} email=${result.email}`);
      return NextResponse.redirect(settingsUrl(req, { changed: "1" }));
    case "expired":
      return NextResponse.redirect(settingsUrl(req, { error: "expired" }));
    case "consumed":
      return NextResponse.redirect(settingsUrl(req, { error: "consumed" }));
    case "taken":
      return NextResponse.redirect(settingsUrl(req, { error: "taken" }));
    case "not_found":
      return NextResponse.redirect(settingsUrl(req, { error: "invalid_token" }));
    default:
      return NextResponse.redirect(settingsUrl(req, { error: "server_error" }));
  }
}
