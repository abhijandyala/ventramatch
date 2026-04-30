import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/types/database";

// We expose emailVerified as a Date | null on User (matching NextAuth's shape)
// and a boolean on Session/JWT under a distinct field name to avoid clobbering
// the upstream Date type and to keep middleware checks cheap.

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole | null;
      onboardingCompleted: boolean;
      isEmailVerified: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole | null;
    onboardingCompleted?: boolean;
    emailVerified?: Date | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole | null;
    onboardingCompleted?: boolean;
    isEmailVerified?: boolean;
  }
}
