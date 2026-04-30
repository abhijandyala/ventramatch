import { NextResponse, type NextRequest } from "next/server";
import { withUserRls } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function siteUrl(req: NextRequest): URL {
  return new URL(req.nextUrl.origin);
}

function redirectTo(req: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, siteUrl(req)));
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const identifier = req.nextUrl.searchParams.get("identifier")?.toLowerCase();

  console.log(`[verify] hit identifier=${identifier ?? "none"} hasToken=${Boolean(token)}`);

  if (!token || !identifier) {
    return redirectTo(req, "/verify-email?error=invalid");
  }

  type TokenRow = { expires: Date | string };
  let consumed: TokenRow | null = null;
  try {
    consumed = await withUserRls<TokenRow | null>(null, async (sql) => {
      const rows = await sql<TokenRow[]>`
        delete from public.verification_token
        where identifier = ${identifier} and token = ${token}
        returning expires
      `;
      return rows[0] ?? null;
    });
  } catch (error) {
    console.error("[verify] DB delete failed", error);
    return redirectTo(req, "/verify-email?error=invalid");
  }

  if (!consumed) {
    console.log(`[verify] token not found for ${identifier}`);
    return redirectTo(req, `/verify-email?error=expired&email=${encodeURIComponent(identifier)}`);
  }

  const expiresAt = new Date(consumed.expires);
  if (expiresAt.getTime() < Date.now()) {
    console.log(`[verify] token expired for ${identifier}`);
    return redirectTo(req, `/verify-email?error=expired&email=${encodeURIComponent(identifier)}`);
  }

  try {
    await withUserRls(null, async (sql) => {
      await sql`
        update public.users
        set email_verified_at = now()
        where email = ${identifier}
      `;
    });
  } catch (error) {
    console.error("[verify] could not mark email verified", error);
    return redirectTo(req, "/verify-email?error=invalid");
  }

  console.log(`[verify] success for ${identifier} → /sign-in?verified=1`);
  return redirectTo(
    req,
    `/sign-in?verified=1&email=${encodeURIComponent(identifier)}`,
  );
}
