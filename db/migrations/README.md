# Database migrations (PostgreSQL)

**Canonical path for new work:** `db/migrations/*.sql` — apply in filename order to your **Railway** (or local) Postgres instance.

RLS is enforced with `ventramatch.user_id`, set per transaction from the app (`lib/db.ts` → `withUserRls`). The SQL helper is `public.app_user_id()`.

**Historical (do not use for new deploys):** `../legacy/0001_initial_schema_supabase_auth.sql` — old Supabase `auth.users` / `auth.uid()` version, kept in git for audit only.

```bash
# Example: apply to DATABASE_URL
psql "$DATABASE_URL" -f db/migrations/0001_initial_schema.sql
```
