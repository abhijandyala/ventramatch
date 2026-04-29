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

      if (onAuthPage && isLoggedIn) {
        return Response.redirect(new URL("/post-auth", request.nextUrl));
      }

      if ((onProtected || onOnboarding) && !isLoggedIn) {
        const target = new URL("/sign-in", request.nextUrl);
        target.searchParams.set("from", pathname);
        return Response.redirect(target);
      }

      if (isLoggedIn && onOnboarding && completed) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }

      if (isLoggedIn && onProtected && !completed) {
        return Response.redirect(new URL("/onboarding", request.nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? null;
        token.onboardingCompleted = user.onboardingCompleted ?? false;
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
