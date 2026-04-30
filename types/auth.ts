import type { DefaultSession } from "next-auth";
import type { UserRole, AccountLabel } from "@/types/database";

// We expose emailVerified as a Date | null on User (matching NextAuth's shape)
// and a boolean on Session/JWT under a distinct field name to avoid clobbering
// the upstream Date type and to keep middleware checks cheap.
//
// accountLabel mirrors `public.users.account_label` (kept in sync by the
// trigger on `applications.status`). Reading it from the JWT lets middleware
// gate features without a DB hit per request.

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole | null;
      onboardingCompleted: boolean;
      isEmailVerified: boolean;
      accountLabel: AccountLabel;
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole | null;
    onboardingCompleted?: boolean;
    emailVerified?: Date | null;
    accountLabel?: AccountLabel;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole | null;
    onboardingCompleted?: boolean;
    isEmailVerified?: boolean;
    accountLabel?: AccountLabel;
  }
}
