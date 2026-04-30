import type { DefaultSession } from "next-auth";
import type { UserRole, AccountLabel, ProfileState } from "@/types/database";

// We expose emailVerified as a Date | null on User (matching NextAuth's shape)
// and a boolean on Session/JWT under a distinct field name to avoid clobbering
// the upstream Date type and to keep middleware checks cheap.
//
// accountLabel mirrors `public.users.account_label` (kept in sync by the
// trigger on `applications.status`). profileState mirrors
// `public.users.profile_state` and drives the "send the user to /build vs
// /homepage" decision. Both live in the JWT so middleware can route without
// a DB hit per request.

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole | null;
      onboardingCompleted: boolean;
      isEmailVerified: boolean;
      accountLabel: AccountLabel;
      profileState: ProfileState;
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole | null;
    onboardingCompleted?: boolean;
    emailVerified?: Date | null;
    accountLabel?: AccountLabel;
    profileState?: ProfileState;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole | null;
    onboardingCompleted?: boolean;
    isEmailVerified?: boolean;
    accountLabel?: AccountLabel;
    profileState?: ProfileState;
  }
}
