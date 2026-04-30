import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import LinkedIn from "next-auth/providers/linkedin";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import GitHub from "next-auth/providers/github";
import { NEEDS_BUILD_STATES } from "@/types/database";

// Edge-safe: no DB, no Node-only APIs. Imported by proxy.ts (middleware) and by
// auth.ts (server). Credentials + adapter are added on top in auth.ts so they
// stay out of the edge runtime.

const PROTECTED_PATHS = [
  "/dashboard", "/settings", "/profile", "/post-auth", "/homepage",
  "/feed", "/matches", "/p", "/build", "/inbox", "/searches", "/notifications", "/activity",
];
const ONBOARDING_PATHS = ["/onboarding"];
const AUTH_PATHS = ["/sign-in", "/sign-up"];
const VERIFY_PATH = "/verify-email";

// Pages that only make sense once the user has at least started building their
// real profile. If profile_state is still 'none'/'basic' (initial 3-step
// onboarding done, but the /build wizard never opened), middleware bounces the
// user back to /build so they don't get dropped onto an empty product surface
// with no guidance.
const REQUIRES_BUILT_PROFILE_PATHS = ["/homepage"];

function pathStartsWith(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Build the providers array based on which env vars are configured.
// GitHub is optional — only register it if creds exist so we don't crash
// environments that haven't created the OAuth app yet.
type ProviderEntry = NextAuthConfig["providers"][number];
function buildProviders(): ProviderEntry[] {
  const providers: ProviderEntry[] = [
    Google({ allowDangerousEmailAccountLinking: true }),
    LinkedIn({ allowDangerousEmailAccountLinking: true }),
    MicrosoftEntraID({
      allowDangerousEmailAccountLinking: true,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    }),
  ];
  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(GitHub({ allowDangerousEmailAccountLinking: true }));
  }
  return providers;
}

export const authConfig = {
  pages: {
    signIn: "/sign-in",
    error: "/error",
  },
  session: { strategy: "jwt" },
  providers: buildProviders(),
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = Boolean(auth?.user);
      const onAuthPage = pathStartsWith(pathname, AUTH_PATHS);
      const onProtected = pathStartsWith(pathname, PROTECTED_PATHS);
      const onOnboarding = pathStartsWith(pathname, ONBOARDING_PATHS);
      const onVerify = pathname === VERIFY_PATH || pathname.startsWith(`${VERIFY_PATH}/`);
      const completed = auth?.user?.onboardingCompleted === true;
      const verified = auth?.user?.isEmailVerified === true;
      const accountLabel = auth?.user?.accountLabel;
      const isBanned = accountLabel === "banned";
      const profileState = auth?.user?.profileState ?? "none";
      const role = auth?.user?.role ?? null;
      const needsBuild = NEEDS_BUILD_STATES.includes(profileState);
      const buildPath = role === "investor" ? "/build/investor" : "/build";

      console.log(`[auth:middleware] path=${pathname} loggedIn=${isLoggedIn} verified=${verified} completed=${completed} label=${accountLabel ?? "?"} state=${profileState} userId=${auth?.user?.id ?? "none"}`);

      // Banned accounts: hard block. Only allow /banned page + /sign-in
      // (so they can sign out). Everything else redirects to a banned page.
      if (isLoggedIn && isBanned && !pathname.startsWith("/banned") && !onAuthPage) {
        console.log("[auth:middleware] → redirect /banned (account suspended)");
        return Response.redirect(new URL("/banned", request.nextUrl));
      }

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

      // Block unverified users from anything past auth. /verify-email and
      // /api/auth/verify are intentionally not in PROTECTED so they remain
      // reachable. OAuth users always have emailVerified=true via the adapter.
      if (isLoggedIn && !verified && (onProtected || onOnboarding)) {
        const email = auth?.user?.email ?? "";
        console.log(`[auth:middleware] → redirect /verify-email (unverified email on ${pathname})`);
        const target = new URL(VERIFY_PATH, request.nextUrl);
        if (email) target.searchParams.set("email", email);
        return Response.redirect(target);
      }

      if (isLoggedIn && onOnboarding && completed) {
        // Onboarding's "done" state is just step 3 of the wizard. If the
        // user hasn't yet started /build, send them there instead of dropping
        // them on /homepage with no signal that their profile isn't live.
        const target = needsBuild ? buildPath : "/homepage";
        console.log(`[auth:middleware] → redirect ${target} (onboarding already done, state=${profileState})`);
        return Response.redirect(new URL(target, request.nextUrl));
      }

      if (isLoggedIn && onProtected && !completed) {
        console.log("[auth:middleware] → redirect /onboarding (protected page, not onboarded)");
        return Response.redirect(new URL("/onboarding", request.nextUrl));
      }

      // Onboarding is finished but the /build wizard hasn't been started
      // yet. /homepage is the marketing-style product landing page that
      // assumes a built profile, so push these users back to /build.
      if (
        isLoggedIn &&
        completed &&
        needsBuild &&
        pathStartsWith(pathname, REQUIRES_BUILT_PROFILE_PATHS)
      ) {
        console.log(`[auth:middleware] → redirect ${buildPath} (profile not built yet, state=${profileState})`);
        return Response.redirect(new URL(buildPath, request.nextUrl));
      }

      // Verified users with no business on the verify page → push them forward
      if (isLoggedIn && verified && onVerify) {
        const target = !completed
          ? "/onboarding"
          : needsBuild
            ? buildPath
            : "/homepage";
        console.log(`[auth:middleware] → redirect ${target} (already verified)`);
        return Response.redirect(new URL(target, request.nextUrl));
      }

      console.log(`[auth:middleware] → pass through ${pathname}`);
      return true;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? null;
        token.onboardingCompleted = user.onboardingCompleted ?? false;
        token.isEmailVerified = Boolean(user.emailVerified);
        // accountLabel comes from Credentials authorize OR the adapter's
        // toAdapterUser. Defaults to 'unverified' if neither set it (e.g.
        // an OAuth user before the trigger seeds applications).
        token.accountLabel = user.accountLabel ?? "unverified";
        // profileState mirrors users.profile_state — read by middleware to
        // decide whether to push the user into /build before /homepage.
        token.profileState = user.profileState ?? "none";
        console.log(`[auth:jwt] trigger=${trigger} userId=${user.id} role=${user.role ?? "null"} onboarded=${user.onboardingCompleted ?? false} verified=${token.isEmailVerified} label=${token.accountLabel} state=${token.profileState}`);
      }
      // unstable_update() from server actions only hits this path; `user` is absent.
      if (trigger === "update" && session?.user) {
        const u = session.user;
        if (u.role !== undefined) token.role = u.role ?? null;
        if (typeof u.onboardingCompleted === "boolean") {
          token.onboardingCompleted = u.onboardingCompleted;
        }
        if (typeof u.isEmailVerified === "boolean") {
          token.isEmailVerified = u.isEmailVerified;
        }
        if (u.accountLabel) {
          token.accountLabel = u.accountLabel;
        }
        if (u.profileState) {
          token.profileState = u.profileState;
        }
        console.log(
          `[auth:jwt] trigger=update userId=${token.sub ?? "none"} role=${token.role ?? "null"} onboarded=${token.onboardingCompleted ?? false} verified=${token.isEmailVerified} label=${token.accountLabel} state=${token.profileState ?? "none"}`,
        );
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id ?? token.sub) as string;
        session.user.role = token.role ?? null;
        session.user.onboardingCompleted = token.onboardingCompleted ?? false;
        session.user.isEmailVerified = token.isEmailVerified ?? false;
        session.user.accountLabel = token.accountLabel ?? "unverified";
        session.user.profileState = token.profileState ?? "none";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
