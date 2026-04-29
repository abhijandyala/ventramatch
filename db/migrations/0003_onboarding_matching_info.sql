-- Onboarding: minimal matching preferences for founders and investors.
-- Append-only: never edit this file once committed. Add a new migration to fix.
--
-- These tables intentionally hold the bare minimum for matching — full founder
-- and investor profiles still live in public.startups and public.investors and
-- are deferred until later. The unique (user_id) lets us upsert one row per user
-- on every onboarding submission, including re-runs if the user comes back.

-- ---------- Enum ----------
do $$ begin
  create type public.lead_follow_preference as enum ('lead', 'follow', 'either');
exception when duplicate_object then null; end $$;

-- ---------- founder_matching_preferences ----------
create table if not exists public.founder_matching_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  industry text not null check (length(industry) between 2 and 80),
  stage public.startup_stage not null,
  amount_raising text not null check (length(amount_raising) between 1 and 80),
  location text not null check (length(location) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger founder_matching_preferences_set_updated_at
  before update on public.founder_matching_preferences
  for each row execute function public.set_updated_at();

create index if not exists founder_matching_preferences_industry_idx
  on public.founder_matching_preferences (industry);
create index if not exists founder_matching_preferences_stage_idx
  on public.founder_matching_preferences (stage);

alter table public.founder_matching_preferences enable row level security;

create policy "founder_matching_preferences select own"
  on public.founder_matching_preferences for select
  using (user_id = public.app_user_id());

create policy "founder_matching_preferences insert own"
  on public.founder_matching_preferences for insert
  with check (user_id = public.app_user_id());

create policy "founder_matching_preferences update own"
  on public.founder_matching_preferences for update
  using (user_id = public.app_user_id())
  with check (user_id = public.app_user_id());

create policy "founder_matching_preferences delete own"
  on public.founder_matching_preferences for delete
  using (user_id = public.app_user_id());

-- ---------- investor_matching_preferences ----------
create table if not exists public.investor_matching_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  check_size text not null check (length(check_size) between 1 and 80),
  preferred_stage public.startup_stage not null,
  sectors text[] not null default '{}' check (
    array_length(sectors, 1) between 1 and 12
  ),
  geography text not null check (length(geography) between 2 and 120),
  lead_follow_preference public.lead_follow_preference not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger investor_matching_preferences_set_updated_at
  before update on public.investor_matching_preferences
  for each row execute function public.set_updated_at();

create index if not exists investor_matching_preferences_preferred_stage_idx
  on public.investor_matching_preferences (preferred_stage);
create index if not exists investor_matching_preferences_sectors_idx
  on public.investor_matching_preferences using gin (sectors);

alter table public.investor_matching_preferences enable row level security;

create policy "investor_matching_preferences select own"
  on public.investor_matching_preferences for select
  using (user_id = public.app_user_id());

create policy "investor_matching_preferences insert own"
  on public.investor_matching_preferences for insert
  with check (user_id = public.app_user_id());

create policy "investor_matching_preferences update own"
  on public.investor_matching_preferences for update
  using (user_id = public.app_user_id())
  with check (user_id = public.app_user_id());

create policy "investor_matching_preferences delete own"
  on public.investor_matching_preferences for delete
  using (user_id = public.app_user_id());
