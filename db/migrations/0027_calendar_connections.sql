-- Sprint 13.A — Google Calendar connections.
--
-- Stores OAuth tokens for the Calendar API so we can create events when
-- an intro is accepted. One connection per user (for v1, only Google).
--
-- Tokens are stored in plain text. For production-grade security, wrap
-- with pgcrypto or app-layer AES. Documented as a follow-up.

do $$ begin
  create type public.calendar_provider as enum ('google');
exception when duplicate_object then null; end $$;

create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider public.calendar_provider not null default 'google',
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  calendar_id text not null default 'primary',
  scopes text not null default 'https://www.googleapis.com/auth/calendar.events',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

drop trigger if exists calendar_connections_set_updated_at on public.calendar_connections;
create trigger calendar_connections_set_updated_at
  before update on public.calendar_connections
  for each row execute function public.set_updated_at();

alter table public.calendar_connections enable row level security;

drop policy if exists "calendar_connections select own" on public.calendar_connections;
create policy "calendar_connections select own"
  on public.calendar_connections for select
  using (public.app_user_id() = user_id);

drop policy if exists "calendar_connections delete own" on public.calendar_connections;
create policy "calendar_connections delete own"
  on public.calendar_connections for delete
  using (public.app_user_id() = user_id);
