import type {
  Adapter,
  AdapterAccount,
  AdapterUser,
  VerificationToken,
} from "@auth/core/adapters";
import { withUserRls } from "@/lib/db";

// Custom Auth.js adapter on top of postgres-js (lib/db.ts) so we keep one
// PG driver across the codebase and snake_case schemas across migrations.
// Tables live in db/migrations/0002_auth_schema.sql.

type DbUserRow = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  email_verified_at: Date | string | null;
};

type DbAccountRow = {
  id: string;
  user_id: string;
  type: string;
  provider: string;
  provider_account_id: string;
  refresh_token: string | null;
  access_token: string | null;
  expires_at: number | string | null;
  token_type: string | null;
  scope: string | null;
  id_token: string | null;
  session_state: string | null;
};

function toAdapterUser(row: DbUserRow | undefined): AdapterUser | null {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image,
    emailVerified: row.email_verified_at ? new Date(row.email_verified_at) : null,
  };
}

function toAdapterAccount(row: DbAccountRow): AdapterAccount {
  return {
    userId: row.user_id,
    type: row.type as AdapterAccount["type"],
    provider: row.provider,
    providerAccountId: row.provider_account_id,
    refresh_token: row.refresh_token ?? undefined,
    access_token: row.access_token ?? undefined,
    expires_at:
      row.expires_at != null ? Number(row.expires_at) : undefined,
    token_type: (row.token_type as AdapterAccount["token_type"]) ?? undefined,
    scope: row.scope ?? undefined,
    id_token: row.id_token ?? undefined,
    session_state:
      (row.session_state as AdapterAccount["session_state"]) ?? undefined,
  };
}

export function ventramatchAdapter(): Adapter {
  return {
    async createUser(user) {
      console.log(`[auth:adapter:createUser] email=${user.email} name=${user.name}`);
      // Adapter is only invoked for OAuth/OIDC sign-ups (credentials sign-ups
      // insert directly in signUpAction without touching the adapter). Treat
      // every adapter-created user as email-verified — the OAuth provider has
      // already proven ownership of the email. Falls back to provider's
      // emailVerified date if it gave one, otherwise stamps `now()`.
      const verifiedAt = user.emailVerified ?? new Date();
      const rows = await withUserRls<DbUserRow[]>(null, async (sql) => {
        const result = await sql<DbUserRow[]>`
          insert into public.users (email, name, image, email_verified_at)
          values (
            ${user.email},
            ${user.name ?? null},
            ${user.image ?? null},
            ${verifiedAt}
          )
          returning id, email, name, image, email_verified_at
        `;
        return [...result];
      });
      const created = toAdapterUser(rows[0]);
      if (!created) throw new Error("Failed to create user");
      console.log(`[auth:adapter:createUser] created userId=${created.id} verifiedAt=${verifiedAt.toISOString()}`);
      return created;
    },

    async getUser(id) {
      const rows = await withUserRls<DbUserRow[]>(null, async (sql) => {
        const result = await sql<DbUserRow[]>`
          select id, email, name, image, email_verified_at
          from public.users
          where id = ${id}
          limit 1
        `;
        return [...result];
      });
      return toAdapterUser(rows[0]);
    },

    async getUserByEmail(email) {
      const rows = await withUserRls<DbUserRow[]>(null, async (sql) => {
        const result = await sql<DbUserRow[]>`
          select id, email, name, image, email_verified_at
          from public.users
          where email = ${email}
          limit 1
        `;
        return [...result];
      });
      return toAdapterUser(rows[0]);
    },

    async getUserByAccount({ provider, providerAccountId }) {
      console.log(`[auth:adapter:getUserByAccount] provider=${provider}`);
      const rows = await withUserRls<DbUserRow[]>(null, async (sql) => {
        const result = await sql<DbUserRow[]>`
          select u.id, u.email, u.name, u.image, u.email_verified_at
          from public.users u
          join public.accounts a on a.user_id = u.id
          where a.provider = ${provider}
            and a.provider_account_id = ${providerAccountId}
          limit 1
        `;
        return [...result];
      });
      const user = toAdapterUser(rows[0]);
      console.log(`[auth:adapter:getUserByAccount] found=${!!user} userId=${user?.id ?? "none"}`);
      return user;
    },

    async updateUser(user) {
      const rows = await withUserRls<DbUserRow[]>(null, async (sql) => {
        const result = await sql<DbUserRow[]>`
          update public.users
          set
            name = coalesce(${user.name ?? null}, name),
            email = coalesce(${user.email ?? null}, email),
            image = coalesce(${user.image ?? null}, image),
            email_verified_at = coalesce(${user.emailVerified ?? null}, email_verified_at)
          where id = ${user.id}
          returning id, email, name, image, email_verified_at
        `;
        return [...result];
      });
      const updated = toAdapterUser(rows[0]);
      if (!updated) throw new Error("Failed to update user");
      return updated;
    },

    async deleteUser(userId) {
      await withUserRls(null, async (sql) => {
        await sql`delete from public.users where id = ${userId}`;
      });
    },

    async linkAccount(account) {
      console.log(`[auth:adapter:linkAccount] userId=${account.userId} provider=${account.provider}`);
      const rows = await withUserRls<DbAccountRow[]>(null, async (sql) => {
        const result = await sql<DbAccountRow[]>`
          insert into public.accounts (
            user_id, type, provider, provider_account_id,
            refresh_token, access_token, expires_at,
            token_type, scope, id_token, session_state
          )
          values (
            ${account.userId},
            ${account.type},
            ${account.provider},
            ${account.providerAccountId},
            ${account.refresh_token ?? null},
            ${account.access_token ?? null},
            ${account.expires_at ?? null},
            ${account.token_type ?? null},
            ${account.scope ?? null},
            ${account.id_token ?? null},
            ${account.session_state ? String(account.session_state) : null}
          )
          returning id, user_id, type, provider, provider_account_id,
                    refresh_token, access_token, expires_at,
                    token_type, scope, id_token, session_state
        `;
        return [...result];
      });
      return toAdapterAccount(rows[0]);
    },

    async unlinkAccount({ provider, providerAccountId }) {
      await withUserRls(null, async (sql) => {
        await sql`
          delete from public.accounts
          where provider = ${provider}
            and provider_account_id = ${providerAccountId}
        `;
      });
    },

    async createVerificationToken({ identifier, expires, token }) {
      await withUserRls(null, async (sql) => {
        await sql`
          insert into public.verification_token (identifier, token, expires)
          values (${identifier}, ${token}, ${expires})
        `;
      });
      return { identifier, expires, token };
    },

    async useVerificationToken({ identifier, token }) {
      const rows = await withUserRls<VerificationToken[]>(null, async (sql) => {
        const result = await sql<{ identifier: string; token: string; expires: Date | string }[]>`
          delete from public.verification_token
          where identifier = ${identifier} and token = ${token}
          returning identifier, token, expires
        `;
        return result.map((r) => ({
          identifier: r.identifier,
          token: r.token,
          expires: new Date(r.expires),
        }));
      });
      return rows[0] ?? null;
    },
  };
}
