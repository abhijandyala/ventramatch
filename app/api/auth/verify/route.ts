import { NextResponse, type NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { withUserRls } from "@/lib/db";
import type { UserRole } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, matches NextAuth default

function siteUrl(req: NextRequest): URL {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return new URL(`${forwardedProto ?? "https"}://${forwardedHost}`);
  }
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.AUTH_URL;
  if (envUrl) {
    try {
      return new URL(envUrl);
    } catch {
      // fall through
    }
  }
  return new URL(req.nextUrl.origin);
}

function isHttps(req: NextRequest): boolean {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.toLowerCase() === "https";
  return req.nextUrl.protocol === "https:";
}

function redirectTo(req: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, siteUrl(req)));
}

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole | null;
  onboarding_completed: boolean;
};

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

  // Mark verified AND fetch the row we'll need to mint the session JWT.
  let user: UserRow | null = null;
  try {
    user = await withUserRls<UserRow | null>(null, async (sql) => {
      const rows = await sql<UserRow[]>`
        update public.users
        set email_verified_at = now()
        where email = ${identifier}
        returning id, email, name, image, role, onboarding_completed
      `;
      return rows[0] ?? null;
    });
  } catch (error) {
    console.error("[verify] could not mark email verified", error);
    return redirectTo(req, "/verify-email?error=invalid");
  }

  if (!user) {
    console.error(`[verify] no user row for ${identifier}`);
    return redirectTo(req, "/verify-email?error=invalid");
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // Misconfig — fall back to the safe (sign-in) flow rather than 500
    console.error("[verify] AUTH_SECRET not set, cannot mint session");
    return redirectTo(req, `/sign-in?verified=1&email=${encodeURIComponent(identifier)}`);
  }

  // Match what NextAuth would produce in the jwt callback for a fresh sign-in
  const now = Math.floor(Date.now() / 1000);
  const sessionPayload = {
    sub: user.id,
    id: user.id,
    email: user.email,
    name: user.name ?? undefined,
    picture: user.image ?? undefined,
    role: user.role ?? null,
    onboardingCompleted: user.onboarding_completed,
    isEmailVerified: true,
    iat: now,
    exp: now + SESSION_MAX_AGE,
    jti: crypto.randomUUID(),
  };

  // Cookie name must match what NextAuth's middleware reads.
  const useSecureCookie = isHttps(req);
  const cookieName = useSecureCookie
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  let jwt: string;
  try {
    jwt = await encode({
      token: sessionPayload,
      secret,
      salt: cookieName,
      maxAge: SESSION_MAX_AGE,
    });
  } catch (error) {
    console.error("[verify] JWT encode failed", error);
    return redirectTo(req, `/sign-in?verified=1&email=${encodeURIComponent(identifier)}`);
  }

  const response = redirectTo(req, "/post-auth");
  response.cookies.set(cookieName, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookie,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  console.log(`[verify] success for ${identifier} userId=${user.id} → /post-auth (auto signed in)`);
  return response;
}
