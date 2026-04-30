import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { ventramatchAdapter } from "@/lib/auth/adapter";
import { verifyPassword } from "@/lib/auth/password";
import { signInSchema } from "@/lib/validation/auth";
import { withUserRls } from "@/lib/db";
import type { UserRole } from "@/types/database";

type CredentialsRow = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole | null;
  onboarding_completed: boolean;
  password_hash: string | null;
  email_verified_at: Date | string | null;
};

export const { handlers, signIn, signOut, auth, unstable_update } = NextAuth({
  ...authConfig,
  adapter: ventramatchAdapter(),
  trustHost: true,
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = signInSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await withUserRls<CredentialsRow | null>(null, async (sql) => {
          const rows = await sql<CredentialsRow[]>`
            select id, email, name, role, onboarding_completed, password_hash, email_verified_at
            from public.users
            where email = ${email}
            limit 1
          `;
          return rows[0] ?? null;
        });

        if (!user || !user.password_hash) return null;

        const ok = await verifyPassword(password, user.password_hash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          onboardingCompleted: user.onboarding_completed,
          emailVerified: user.email_verified_at ? new Date(user.email_verified_at) : null,
        };
      },
    }),
  ],
  events: {
    async signIn({ user, account, isNewUser }) {
      console.log(`[auth:event:signIn] userId=${user.id} provider=${account?.provider} isNewUser=${isNewUser}`);
      if (!isNewUser || !user.id || !account || account.provider === "credentials") {
        return;
      }
      await withUserRls(null, async (sql) => {
        await sql`
          update public.users
          set onboarding_completed = coalesce(onboarding_completed, false)
          where id = ${user.id!}
        `;
      });
      console.log(`[auth:event:signIn] initialized onboarding_completed for new OAuth user ${user.id}`);
    },
    async createUser({ user }) {
      console.log(`[auth:event:createUser] userId=${user.id} email=${user.email}`);
    },
    async linkAccount({ user, account }) {
      console.log(`[auth:event:linkAccount] userId=${user.id} provider=${account.provider}`);
    },
  },
});
