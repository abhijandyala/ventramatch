-- Auth.js (NextAuth v5) schema on Railway / PostgreSQL.
-- Append-only: never edit this file once committed. Add a new migration to fix.
--
-- Conventions:
--   * snake_case columns (translated to Auth.js camelCase fields by lib/auth/adapter.ts).
--   * users.id stays the single identity key the rest of the app uses.
--   * Auth.js tables (accounts, sessions, verification_token) carry RLS with permissive
--     server-side policies; the application is the boundary, not the database client role.

-- ---------- Extend public.users for Auth.js + onboarding ----------
alter table public.users
  alter column role drop not null;

alter table public.users
  alter column id set default gen_random_uuid();

alter table public.users
  add column if not exists name text,
  add column if not exists image text,
  add column if not exists password_hash text,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists email_verified_at timestamptz;

-- Backfill the new timestamp column from the legacy boolean for existing rows.
update public.users
  set email_verified_at = coalesce(email_verified_at, created_at)
  where email_verified is true and email_verified_at is null;

-- Allow signup writes that come in before app_user_id() is set (the auth flow
-- creates the row, then the session is established). The "users insert own"
-- policy from 0001 still gates user-scoped inserts; this layers in a service path.
drop policy if exists "users insert during signup" on public.users;
create policy "users insert during signup"
  on public.users for insert
  with check (public.app_user_id() is null);

drop policy if exists "users update during signup" on public.users;
create policy "users update during signup"
  on public.users for update
  using (public.app_user_id() is null)
  with check (public.app_user_id() is null);

-- Adapter needs to look users up by email / id without an active session
-- (e.g. Credentials.authorize, OAuth account linking).
drop policy if exists "users select by service" on public.users;
create policy "users select by service"
  on public.users for select
  using (public.app_user_id() is null);

-- ---------- accounts (OAuth provider links) ----------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  provider text not null,
  provider_account_id text not null,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  created_at timestamptz not null default now(),
  unique (provider, provider_account_id)
);

create index if not exists accounts_user_idx on public.accounts (user_id);

alter table public.accounts enable row level security;

create policy "accounts service all"
  on public.accounts for all
  using (true)
  with check (true);

-- ---------- sessions (kept for adapter completeness; unused with JWT strategy) ----------
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  expires timestamptz not null,
  session_token text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_idx on public.sessions (user_id);

alter table public.sessions enable row level security;

create policy "sessions service all"
  on public.sessions for all
  using (true)
  with check (true);

-- ---------- verification_token (magic links / email verification, future use) ----------
create table if not exists public.verification_token (
  identifier text not null,
  token text not null,
  expires timestamptz not null,
  primary key (identifier, token)
);

alter table public.verification_token enable row level security;

create policy "verification_token service all"
  on public.verification_token for all
  using (true)
  with check (true);
