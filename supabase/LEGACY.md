# Supabase folder (legacy)

`supabase/migrations/0001_initial_schema.sql` is **historical**: it depends on `auth.users` and `auth.uid()` from Supabase Auth.

**New environments (Railway Postgres, etc.):** use `db/migrations/0001_initial_schema.sql` instead, and wire auth separately (the app sets `ventramatch.user_id` for RLS — see `lib/db.ts`).

Migrations in this directory are **append-only**; do not edit committed files. Add a new file under `db/migrations/` for schema changes.
