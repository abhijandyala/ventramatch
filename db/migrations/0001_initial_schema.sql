-- VentraMatch initial schema for PostgreSQL (Railway or any managed Postgres).
-- RLS uses session variable `ventramatch.user_id` (text UUID), set per transaction
-- from the app via `set_config('ventramatch.user_id', $userId, true)` (see lib/db.ts).
-- Append-only: never edit a committed migration. Add a new file to fix.

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------- Enums ----------
do $$ begin
  create type public.user_role as enum ('founder', 'investor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.startup_stage as enum ('idea', 'pre_seed', 'seed', 'series_a', 'series_b_plus');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.interaction_action as enum ('like', 'pass', 'save');
exception when duplicate_object then null; end $$;

-- ---------- Helper: updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Helper: current user from GUC (set by app in each transaction)
create or replace function public.app_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('ventramatch.user_id', true), '')::uuid;
$$;

-- ---------- users (id = same UUID as your auth provider / session) ----------
create table if not exists public.users (
  id uuid primary key,
  email citext not null unique,
  role public.user_role not null,
  email_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

alter table public.users enable row level security;

create policy "users select own"
  on public.users for select
  using (id = public.app_user_id());

create policy "users update own"
  on public.users for update
  using (id = public.app_user_id())
  with check (id = public.app_user_id());

create policy "users insert own"
  on public.users for insert
  with check (id = public.app_user_id());

-- ---------- startups ----------
create table if not exists public.startups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  name text not null check (length(name) between 2 and 80),
  one_liner text not null check (length(one_liner) between 10 and 240),
  industry text not null,
  stage public.startup_stage not null,
  raise_amount bigint check (raise_amount is null or raise_amount >= 0),
  traction text,
  location text,
  deck_url text,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger startups_set_updated_at
  before update on public.startups
  for each row execute function public.set_updated_at();

create index if not exists startups_industry_idx on public.startups (industry);
create index if not exists startups_stage_idx on public.startups (stage);

alter table public.startups enable row level security;

create policy "startups select all"
  on public.startups for select
  using (true);

create policy "startups insert own"
  on public.startups for insert
  with check (user_id = public.app_user_id());

create policy "startups update own"
  on public.startups for update
  using (user_id = public.app_user_id())
  with check (user_id = public.app_user_id());

create policy "startups delete own"
  on public.startups for delete
  using (user_id = public.app_user_id());

-- ---------- investors ----------
create table if not exists public.investors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  name text not null check (length(name) between 2 and 80),
  firm text,
  check_min bigint not null check (check_min >= 0),
  check_max bigint not null check (check_max >= check_min),
  stages public.startup_stage[] not null default '{}',
  sectors text[] not null default '{}',
  geographies text[] not null default '{}',
  is_active boolean not null default true,
  thesis text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger investors_set_updated_at
  before update on public.investors
  for each row execute function public.set_updated_at();

create index if not exists investors_active_idx on public.investors (is_active);

alter table public.investors enable row level security;

create policy "investors select all"
  on public.investors for select
  using (true);

create policy "investors insert own"
  on public.investors for insert
  with check (user_id = public.app_user_id());

create policy "investors update own"
  on public.investors for update
  using (user_id = public.app_user_id())
  with check (user_id = public.app_user_id());

create policy "investors delete own"
  on public.investors for delete
  using (user_id = public.app_user_id());

-- ---------- interactions ----------
create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.users(id) on delete cascade,
  target_user_id uuid not null references public.users(id) on delete cascade,
  action public.interaction_action not null,
  created_at timestamptz not null default now(),
  unique (actor_user_id, target_user_id, action)
);

create index if not exists interactions_target_idx on public.interactions (target_user_id);
create index if not exists interactions_actor_idx on public.interactions (actor_user_id);

alter table public.interactions enable row level security;

create policy "interactions select own actor"
  on public.interactions for select
  using (public.app_user_id() = actor_user_id or public.app_user_id() = target_user_id);

create policy "interactions insert as actor"
  on public.interactions for insert
  with check (public.app_user_id() = actor_user_id);

create policy "interactions delete own actor"
  on public.interactions for delete
  using (public.app_user_id() = actor_user_id);

-- ---------- matches ----------
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  founder_user_id uuid not null references public.users(id) on delete cascade,
  investor_user_id uuid not null references public.users(id) on delete cascade,
  matched_at timestamptz not null default now(),
  contact_unlocked boolean not null default true,
  unique (founder_user_id, investor_user_id)
);

create index if not exists matches_founder_idx on public.matches (founder_user_id);
create index if not exists matches_investor_idx on public.matches (investor_user_id);

alter table public.matches enable row level security;

create policy "matches select participant"
  on public.matches for select
  using (
    public.app_user_id() = founder_user_id
    or public.app_user_id() = investor_user_id
  );

-- Matches are created by trigger on mutual interactions, not by clients.
-- No insert/update/delete policy for application roles — use a migration or server-only role with BYPASSRLS for the trigger.

-- ---------- Mutual-interest trigger ----------
create or replace function public.create_match_on_mutual_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reciprocal_exists boolean;
  actor_role public.user_role;
  target_role public.user_role;
  founder uuid;
  investor uuid;
begin
  if new.action <> 'like' then
    return new;
  end if;

  select exists(
    select 1 from public.interactions
    where actor_user_id = new.target_user_id
      and target_user_id = new.actor_user_id
      and action = 'like'
  ) into reciprocal_exists;

  if not reciprocal_exists then
    return new;
  end if;

  select role into actor_role from public.users where id = new.actor_user_id;
  select role into target_role from public.users where id = new.target_user_id;

  if actor_role is null or target_role is null or actor_role = target_role then
    return new;
  end if;

  if actor_role = 'founder' then
    founder := new.actor_user_id;
    investor := new.target_user_id;
  else
    founder := new.target_user_id;
    investor := new.actor_user_id;
  end if;

  insert into public.matches (founder_user_id, investor_user_id)
  values (founder, investor)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists interactions_create_match on public.interactions;
create trigger interactions_create_match
  after insert on public.interactions
  for each row execute function public.create_match_on_mutual_like();
