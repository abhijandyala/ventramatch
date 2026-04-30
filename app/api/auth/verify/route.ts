import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { encode } from "next-auth/jwt";
import { withUserRls } from "@/lib/db";
import type { UserRole } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, matches NextAuth default

const verifyParams = z.object({
  token: z.string().trim().min(1).max(256),
  identifier: z.string().trim().toLowerCase().email(),
});

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

function redirectGet(req: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, siteUrl(req)));
}

// 303 forces the browser to follow with GET so the form POST isn't replayed.
function redirectAfterPost(req: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, siteUrl(req)), { status: 303 });
}

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole | null;
  onboarding_completed: boolean;
};

type TokenRow = { expires: Date | string };

/**
 * Read-only on purpose. Microsoft Defender, Mimecast, Proofpoint, Gmail link
 * checkers and friends prefetch every URL in incoming mail. The previous
 * destructive GET burned the one-time token before the human ever clicked,
 * so the real click then 302'd to "expired". We now only validate the link
 * here and hand the user off to a confirm page that POSTs back to consume
 * the token. Scanners don't submit forms.
 */
export async function GET(req: NextRequest) {
  const tokenRaw = req.nextUrl.searchParams.get("token") ?? "";
  const identifierRaw = req.nextUrl.searchParams.get("identifier") ?? "";
  const parsed = verifyParams.safeParse({ token: tokenRaw, identifier: identifierRaw });

  console.log(`[verify] GET hit identifier=${identifierRaw || "none"} hasToken=${Boolean(tokenRaw)}`);

  if (!parsed.success) {
    return redirectGet(req, "/verify-email?error=invalid");
  }

  const { token, identifier } = parsed.data;

  let row: TokenRow | null = null;
  try {
    row = await withUserRls<TokenRow | null>(null, async (sql) => {
      const rows = await sql<TokenRow[]>`
        select expires
        from public.verification_token
        where identifier = ${identifier} and token = ${token}
        limit 1
      `;
      return rows[0] ?? null;
    });
  } catch (error) {
    console.error("[verify] GET DB read failed", error);
    return redirectGet(req, "/verify-email?error=invalid");
  }

  if (!row) {
    console.log(`[verify] GET token not found for ${identifier}`);
    return redirectGet(req, `/verify-email?error=expired&email=${encodeURIComponent(identifier)}`);
  }

  if (new Date(row.expires).getTime() < Date.now()) {
    console.log(`[verify] GET token expired for ${identifier}`);
    return redirectGet(req, `/verify-email?error=expired&email=${encodeURIComponent(identifier)}`);
  }

  const target = new URL("/verify-email/confirm", siteUrl(req));
  target.searchParams.set("token", token);
  target.searchParams.set("identifier", identifier);
  return NextResponse.redirect(target);
}

/**
 * Consume the token, mark the user verified, and mint a session cookie so the
 * user lands on /post-auth already signed in. Reached only via the confirm
 * page form submit, so a scanner's automated GET can't trigger this path.
 */
export async function POST(req: NextRequest) {
  let token = "";
  let identifierRaw = "";
  try {
    const form = await req.formData();
    token = String(form.get("token") ?? "");
    identifierRaw = String(form.get("identifier") ?? "");
  } catch {
    return redirectAfterPost(req, "/verify-email?error=invalid");
  }

  const parsed = verifyParams.safeParse({ token, identifier: identifierRaw });
  console.log(`[verify] POST hit identifier=${identifierRaw || "none"} hasToken=${Boolean(token)}`);

  if (!parsed.success) {
    return redirectAfterPost(req, "/verify-email?error=invalid");
  }

  const { token: validatedToken, identifier } = parsed.data;

  let consumed: TokenRow | null = null;
  try {
    consumed = await withUserRls<TokenRow | null>(null, async (sql) => {
      const rows = await sql<TokenRow[]>`
        delete from public.verification_token
        where identifier = ${identifier} and token = ${validatedToken}
        returning expires
      `;
      return rows[0] ?? null;
    });
  } catch (error) {
    console.error("[verify] POST DB delete failed", error);
    return redirectAfterPost(req, "/verify-email?error=invalid");
  }

  if (!consumed) {
    console.log(`[verify] POST token not found for ${identifier}`);
    return redirectAfterPost(req, `/verify-email?error=expired&email=${encodeURIComponent(identifier)}`);
  }

  if (new Date(consumed.expires).getTime() < Date.now()) {
    console.log(`[verify] POST token expired for ${identifier}`);
    return redirectAfterPost(req, `/verify-email?error=expired&email=${encodeURIComponent(identifier)}`);
  }

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
    return redirectAfterPost(req, "/verify-email?error=invalid");
  }

  if (!user) {
    console.error(`[verify] no user row for ${identifier}`);
    return redirectAfterPost(req, "/verify-email?error=invalid");
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // Misconfig — fall back to the safe (sign-in) flow rather than 500.
    console.error("[verify] AUTH_SECRET not set, cannot mint session");
    return redirectAfterPost(req, `/sign-in?verified=1&email=${encodeURIComponent(identifier)}`);
  }

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
    return redirectAfterPost(req, `/sign-in?verified=1&email=${encodeURIComponent(identifier)}`);
  }

  const response = redirectAfterPost(req, "/post-auth");
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
