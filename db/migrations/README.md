# Database migrations (PostgreSQL)

**Canonical path for new work:** `db/migrations/*.sql` — apply in filename order to your Railway (or local) Postgres instance.

RLS is enforced with `ventramatch.user_id`, set per transaction from the app (`lib/db.ts` → `withUserRls`). The SQL helper is `public.app_user_id()`.

**Legacy:** `../supabase/migrations/0001_initial_schema.sql` targeted Supabase `auth.users`. New deployments should use `0001_initial_schema.sql` in this folder only.

```bash
# Example: apply to DATABASE_URL
psql "$DATABASE_URL" -f db/migrations/0001_initial_schema.sql
```
