-- Sprint 15.C — Feature flags.
--
-- Homegrown flag system. Flags are global (affect all users) or targeted
-- (affect a specific set of user_ids). Admin toggles them via SQL or a
-- future /admin/flags page.

create table if not exists public.feature_flags (
  name text primary key check (length(name) between 1 and 80),
  enabled boolean not null default false,
  -- NULL = global. Non-null = only these user_ids see the flag as true.
  target_user_ids uuid[] default null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists feature_flags_set_updated_at on public.feature_flags;
create trigger feature_flags_set_updated_at
  before update on public.feature_flags
  for each row execute function public.set_updated_at();

-- Service-role only — no public RLS.
alter table public.feature_flags enable row level security;
