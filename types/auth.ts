import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/types/database";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole | null;
      onboardingCompleted: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole | null;
    onboardingCompleted?: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole | null;
    onboardingCompleted?: boolean;
  }
}
