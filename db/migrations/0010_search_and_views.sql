-- Sprint 8: Discovery search, filters, saved searches, profile views.
--
-- Three concepts:
--   1. Postgres FTS columns on startups + investors (GIN-indexed) so the
--      feed can do `?q=fintech climate` text search server-side. Unweighted
--      A/B/C ranking — name and industry/sectors > thesis/traction > rest.
--   2. saved_searches  — user-owned filter sets, optionally with email-digest.
--   3. profile_views    — every visit to /p/[userId] is recorded once per
--      24h per (viewer, target) pair. Powers "Who viewed me" on dashboard.
--
-- Why a separate profile_views table rather than reusing interactions:
--   * Interaction rows have semantic weight (like/pass/save drives matching).
--     A view is a pure analytics signal; conflating them muddies both.
--   * Volume: views are 1-2 orders of magnitude higher than interactions.
--     Separate table = separate retention policy later.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Startup full-text search
-- ──────────────────────────────────────────────────────────────────────────

alter table public.startups
  add column if not exists search_vector tsvector;

create or replace function public.startups_refresh_search_vector()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.industry, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.one_liner, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.traction, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(new.location, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(new.website, '')), 'D');
  return new;
end;
$$;

drop trigger if exists startups_search_vector on public.startups;
create trigger startups_search_vector
  before insert or update on public.startups
  for each row execute function public.startups_refresh_search_vector();

-- Backfill existing rows.
update public.startups set search_vector = null where search_vector is not null;
update public.startups set name = name;  -- triggers the recompute via UPDATE

create index if not exists startups_search_vector_idx
  on public.startups using gin (search_vector);

create index if not exists startups_location_lower_idx
  on public.startups (lower(location));

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Investor full-text search
-- ──────────────────────────────────────────────────────────────────────────

alter table public.investors
  add column if not exists search_vector tsvector;

create or replace function public.investors_refresh_search_vector()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.firm, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(new.sectors, ' '), '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.thesis, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(new.geographies, ' '), '')), 'C');
  return new;
end;
$$;

drop trigger if exists investors_search_vector on public.investors;
create trigger investors_search_vector
  before insert or update on public.investors
  for each row execute function public.investors_refresh_search_vector();

update public.investors set search_vector = null where search_vector is not null;
update public.investors set name = name;

create index if not exists investors_search_vector_idx
  on public.investors using gin (search_vector);

create index if not exists investors_sectors_gin_idx
  on public.investors using gin (sectors);

create index if not exists investors_stages_gin_idx
  on public.investors using gin (stages);

create index if not exists investors_geographies_gin_idx
  on public.investors using gin (geographies);

-- ──────────────────────────────────────────────────────────────────────────
-- 3. saved_searches
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- Short user-facing label, e.g. "Fintech seed NYC".
  name text not null check (length(name) between 1 and 80),
  -- Filter snapshot. Schema is defined in lib/feed/filters.ts. JSONB lets
  -- us evolve the schema without a migration each time we add a filter.
  filters jsonb not null default '{}'::jsonb,
  -- Optional email digest opt-in. Cron job (out of scope here) reads this.
  notify_email boolean not null default false,
  -- Last time we sent a digest for this saved search. Used by the cron to
  -- decide whether to re-send.
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_searches_user_idx
  on public.saved_searches (user_id, created_at desc);

drop trigger if exists saved_searches_set_updated_at on public.saved_searches;
create trigger saved_searches_set_updated_at
  before update on public.saved_searches
  for each row execute function public.set_updated_at();

alter table public.saved_searches enable row level security;

drop policy if exists "saved_searches select own" on public.saved_searches;
create policy "saved_searches select own"
  on public.saved_searches for select
  using (user_id = public.app_user_id());

drop policy if exists "saved_searches insert own" on public.saved_searches;
create policy "saved_searches insert own"
  on public.saved_searches for insert
  with check (user_id = public.app_user_id());

drop policy if exists "saved_searches update own" on public.saved_searches;
create policy "saved_searches update own"
  on public.saved_searches for update
  using (user_id = public.app_user_id())
  with check (user_id = public.app_user_id());

drop policy if exists "saved_searches delete own" on public.saved_searches;
create policy "saved_searches delete own"
  on public.saved_searches for delete
  using (user_id = public.app_user_id());

-- ──────────────────────────────────────────────────────────────────────────
-- 4. profile_views (Who viewed me)
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.profile_views (
  id uuid primary key default gen_random_uuid(),
  viewer_user_id uuid not null references public.users(id) on delete cascade,
  target_user_id uuid not null references public.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  -- Self-views don't count; the action must enforce this but a constraint
  -- backstops it.
  constraint profile_views_distinct check (viewer_user_id <> target_user_id)
);

create index if not exists profile_views_target_idx
  on public.profile_views (target_user_id, viewed_at desc);
create index if not exists profile_views_viewer_target_recent_idx
  on public.profile_views (viewer_user_id, target_user_id, viewed_at desc);

alter table public.profile_views enable row level security;

-- Both parties can see views they're part of:
--   • A viewer might want to see "profiles I've recently looked at" for
--     personal recall.
--   • A target wants "who viewed me".
drop policy if exists "profile_views select participant" on public.profile_views;
create policy "profile_views select participant"
  on public.profile_views for select
  using (
    public.app_user_id() = viewer_user_id
    or public.app_user_id() = target_user_id
  );

-- Inserts are authored by the viewer.
drop policy if exists "profile_views insert as viewer" on public.profile_views;
create policy "profile_views insert as viewer"
  on public.profile_views for insert
  with check (public.app_user_id() = viewer_user_id);
