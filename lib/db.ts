/**
 * Server-only Postgres access (Railway or any PostgreSQL). Never import from Client Components.
 * RLS policies use `ventramatch.user_id` (see db/migrations). Wrap writes in withUserRls.
 */
import postgres, { type Sql } from "postgres";
import { getServerEnv } from "@/lib/env";

let _sql: Sql | null = null;

export function getDb(): Sql {
  if (_sql) {
    return _sql;
  }
  const { DATABASE_URL } = getServerEnv();
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local for local development.");
  }
  _sql = postgres(DATABASE_URL, { max: 10, idle_timeout: 20, connect_timeout: 10 });
  return _sql;
}

/**
 * Run work inside a transaction with `ventramatch.user_id` set so RLS can evaluate `app_user_id()`.
 * Use `userId: null` only for queries that do not need row ownership (e.g. public `startups` reads with policy `using (true)`).
 */
export async function withUserRls<T>(userId: string | null, fn: (sql: Sql) => Promise<T>): Promise<T> {
  const db = getDb();
  return (await db.begin(async (tx) => {
    if (userId) {
      await tx`select set_config('ventramatch.user_id', ${userId}, true)`;
    }
    return fn(tx) as Promise<T>;
  })) as T;
}
