# Archived SQL (Supabase Auth era)

`0001_initial_schema_supabase_auth.sql` is a **read-only snapshot** of the first schema when the project targeted **Supabase** (`auth.users` foreign key, `auth.uid()` in RLS).

**Current work:** apply **`../migrations/0001_initial_schema.sql`** to **PostgreSQL on Railway** (or any Postgres). The app uses **`lib/db.ts`** and the `ventramatch.user_id` session variable for RLS.

Do not delete this file from git without team agreement; it documents what changed when we moved off Supabase.
