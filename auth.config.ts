import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import LinkedIn from "next-auth/providers/linkedin";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

// Edge-safe: no DB, no Node-only APIs. Imported by proxy.ts (middleware) and by
// auth.ts (server). Credentials + adapter are added on top in auth.ts so they
// stay out of the edge runtime.

const PROTECTED_PATHS = ["/dashboard", "/settings", "/profile", "/post-auth"];
const ONBOARDING_PATHS = ["/onboarding"];
const AUTH_PATHS = ["/sign-in", "/sign-up"];

function pathStartsWith(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const authConfig = {
  pages: {
    signIn: "/sign-in",
    error: "/error",
  },
  session: { strategy: "jwt" },
  providers: [
    Google({ allowDangerousEmailAccountLinking: true }),
    LinkedIn({ allowDangerousEmailAccountLinking: true }),
    MicrosoftEntraID({
      allowDangerousEmailAccountLinking: true,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    }),
  ],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = Boolean(auth?.user);
      const onAuthPage = pathStartsWith(pathname, AUTH_PATHS);
      const onProtected = pathStartsWith(pathname, PROTECTED_PATHS);
      const onOnboarding = pathStartsWith(pathname, ONBOARDING_PATHS);
      const completed = auth?.user?.onboardingCompleted === true;

      console.log(`[auth:middleware] path=${pathname} loggedIn=${isLoggedIn} completed=${completed} userId=${auth?.user?.id ?? "none"}`);

      if (onAuthPage && isLoggedIn) {
        console.log("[auth:middleware] → redirect /post-auth (logged-in user on auth page)");
        return Response.redirect(new URL("/post-auth", request.nextUrl));
      }

      if ((onProtected || onOnboarding) && !isLoggedIn) {
        console.log(`[auth:middleware] → redirect /sign-in (unauthenticated on ${pathname})`);
        const target = new URL("/sign-in", request.nextUrl);
        target.searchParams.set("from", pathname);
        return Response.redirect(target);
      }

      if (isLoggedIn && onOnboarding && completed) {
        console.log("[auth:middleware] → redirect /homepage (onboarding already done)");
        return Response.redirect(new URL("/homepage", request.nextUrl));
      }

      if (isLoggedIn && onProtected && !completed) {
        console.log("[auth:middleware] → redirect /onboarding (protected page, not onboarded)");
        return Response.redirect(new URL("/onboarding", request.nextUrl));
      }

      console.log(`[auth:middleware] → pass through ${pathname}`);
      return true;
    },
    jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? null;
        token.onboardingCompleted = user.onboardingCompleted ?? false;
        console.log(`[auth:jwt] trigger=${trigger} userId=${user.id} role=${user.role ?? "null"} onboarded=${user.onboardingCompleted ?? false}`);
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id ?? token.sub) as string;
        session.user.role = token.role ?? null;
        session.user.onboardingCompleted = token.onboardingCompleted ?? false;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
