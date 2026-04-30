-- Profile depth — Sprint A: round details, cap table summary, use of funds.
-- Append-only: never edit this file once committed. Add a new migration to fix.
--
-- Three new child tables fan out from `startups` so an investor can see the
-- shape of the round itself, not just the freeform `raise_amount` bigint that
-- 0001 stored. Investors filter on instrument, lead status, and valuation
-- band; founders state their ASK as a band rather than an exact valuation,
-- which keeps us out of stale-data and investment-advice territory
-- (see docs/legal.md).
--
-- Decisions baked in here:
--   1. Valuation is stored as a band, never an exact number. Buckets chosen
--      against actual market data: pre-seed often sits at $2-5M, seed at
--      $5-15M, Series A at $20-80M, so we split finer at the low end.
--      The founder's stated ASK is what's stored — we never compute or
--      suggest a valuation from financial fundamentals (those live in
--      0014_profile_depth_traction.sql).
--   2. `target_raise_usd` IS exact. It's the founder's stated ask, not a
--      market valuation, and it's what investors filter on. Same convention
--      as the existing `startups.raise_amount` column from 0001.
--   3. Use-of-funds rows: one per category, with a `pct_of_raise` integer.
--      We do NOT enforce sum<=100 across rows at the DB layer; that's a
--      cross-row constraint that requires a deferred trigger and complicates
--      builder UX (the user is editing one row at a time). The publish gate
--      in app/build/actions.ts will validate the sum before submit.
--   4. Cap table summary stays a 1:1 child of `startups` rather than columns
--      on the parent. Keeps the parent row narrow (it's read in every feed
--      query) and lets the cap table be filled later in the builder flow
--      without a parent UPDATE.
--   5. Visibility: Tier 1.5. App layer enforces verified-viewer gate the
--      same way it does for startups; RLS uses `select all`. See lib/feed
--      and lib/profile/visibility.ts for the read-side pattern.
--
-- No backfill: tables start empty.

-- ──────────────────────────────────────────────────────────────────────────
-- 0. Enums (idempotent)
-- ──────────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.round_instrument as enum (
    'safe_post_money',
    'safe_pre_money',
    'priced_round',
    'convertible_note'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.round_lead_status as enum (
    'open',              -- no commitments yet, soliciting interest
    'soliciting_lead',   -- explicitly looking for a lead investor
    'lead_committed',    -- have a lead, raising allocation
    'oversubscribed'     -- demand exceeds raise; only adding selectively
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.use_of_funds_category as enum (
    'engineering',
    'sales_and_marketing',
    'operations',
    'runway_extension',
    'hiring',
    'infrastructure',
    'research_and_dev',
    'other'
  );
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 1. startup_round_details (1:1 with startups)
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.startup_round_details (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null unique references public.startups(id) on delete cascade,

  instrument public.round_instrument,

  -- Stored as text + CHECK rather than enum so we can revise buckets without
  -- a forced enum-add migration. Same pattern as `users.profile_state` in
  -- 0006. Buckets chosen for actual market shape: heavy granularity below
  -- $20M (where pre-seed and seed live), coarser above (Series A+).
  valuation_band text
    check (valuation_band is null or valuation_band in (
      'under_3m', '3_5m', '5_10m', '10_20m', '20_50m', '50_100m', 'over_100m'
    )),

  -- Founder's ask. Exact, not a band — this is what investors filter on
  -- and is consistent with existing `startups.raise_amount`.
  target_raise_usd bigint check (target_raise_usd is null or target_raise_usd >= 0),

  -- Optional minimum check size to participate (e.g., $25k for an angel
  -- round, $250k for institutional). Helps founders signal "no $5k checks."
  min_check_usd bigint check (min_check_usd is null or min_check_usd >= 0),

  lead_status public.round_lead_status not null default 'open',

  -- Calendar target for closing the round. Drives feed urgency cues
  -- ("closing in 2 weeks") and helps investors prioritize.
  close_by_date date,

  -- How much is already committed (signed SAFEs, term sheets, verbal
  -- commitments the founder is willing to disclose). Investors weight
  -- "5% committed" vs "80% committed" very differently.
  committed_amount_usd bigint not null default 0
    check (committed_amount_usd >= 0),

  -- Short narrative on use of funds. Detailed lines live in
  -- startup_use_of_funds_lines below; this is the elevator-pitch version
  -- a founder can write before committing to category-level percentages.
  use_of_funds_summary text check (use_of_funds_summary is null or length(use_of_funds_summary) <= 500),

  -- Short narrative on key terms (board seat, pro-rata, MFN). Optional;
  -- founders fill in if they have committed terms worth disclosing.
  instrument_terms_summary text check (instrument_terms_summary is null or length(instrument_terms_summary) <= 500),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists startup_round_details_set_updated_at on public.startup_round_details;
create trigger startup_round_details_set_updated_at
  before update on public.startup_round_details
  for each row execute function public.set_updated_at();

create index if not exists startup_round_details_lead_status_idx
  on public.startup_round_details (lead_status);

-- Drives "closing soon" feed cue. Partial — only rows that have a date.
create index if not exists startup_round_details_close_date_idx
  on public.startup_round_details (close_by_date)
  where close_by_date is not null;

alter table public.startup_round_details enable row level security;

drop policy if exists "startup_round_details select all" on public.startup_round_details;
create policy "startup_round_details select all"
  on public.startup_round_details for select
  using (true);

drop policy if exists "startup_round_details insert as owner" on public.startup_round_details;
create policy "startup_round_details insert as owner"
  on public.startup_round_details for insert
  with check (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.user_id = public.app_user_id()
    )
  );

drop policy if exists "startup_round_details update as owner" on public.startup_round_details;
create policy "startup_round_details update as owner"
  on public.startup_round_details for update
  using (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.user_id = public.app_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.user_id = public.app_user_id()
    )
  );

drop policy if exists "startup_round_details delete as owner" on public.startup_round_details;
create policy "startup_round_details delete as owner"
  on public.startup_round_details for delete
  using (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.user_id = public.app_user_id()
    )
  );

-- ──────────────────────────────────────────────────────────────────────────
-- 2. startup_cap_table_summary (1:1 with startups)
-- ──────────────────────────────────────────────────────────────────────────
--
-- Aggregate-only — no per-shareholder rows here. The full cap table is
-- Tier 3 (data room) and lives outside this schema for now. The founder
-- summarizes ownership in three buckets so investors can sanity-check
-- "do the founders still own enough to stay motivated through dilution"
-- without exposing line-item detail.

create table if not exists public.startup_cap_table_summary (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null unique references public.startups(id) on delete cascade,

  -- Total founder ownership across all founders combined.
  founders_pct_band text
    check (founders_pct_band is null or founders_pct_band in (
      'under_50', '50_70', '70_85', '85_95', 'over_95'
    )),

  -- Reserved option pool size.
  employee_pool_pct_band text
    check (employee_pool_pct_band is null or employee_pool_pct_band in (
      'none', 'under_10', '10_15', '15_20', 'over_20'
    )),

  -- Outside investors' aggregate ownership (priced rounds + converted SAFEs).
  -- founders + employee_pool + outside_investors should approximate 100%;
  -- we don't enforce the sum at DB level (different rounding, advisor pool,
  -- etc.) — app layer can warn.
  outside_investors_pct_band text
    check (outside_investors_pct_band is null or outside_investors_pct_band in (
      'none_yet', 'under_15', '15_25', '25_35', 'over_35'
    )),

  -- Number of priced/SAFE rounds previously closed. 0 for first-time raisers.
  prior_raises_count int not null default 0
    check (prior_raises_count >= 0 and prior_raises_count <= 20),

  -- Last round size (band) and year. Helps investors gauge cadence and
  -- "how stretched is the cap table from prior rounds."
  last_round_amount_band text
    check (last_round_amount_band is null or last_round_amount_band in (
      'under_500k', '500k_1m', '1m_3m', '3m_10m', '10m_25m', 'over_25m'
    )),
  last_round_year int
    check (last_round_year is null or (last_round_year >= 2000 and last_round_year <= 2100)),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists startup_cap_table_summary_set_updated_at on public.startup_cap_table_summary;
create trigger startup_cap_table_summary_set_updated_at
  before update on public.startup_cap_table_summary
  for each row execute function public.set_updated_at();

alter table public.startup_cap_table_summary enable row level security;

drop policy if exists "startup_cap_table_summary select all" on public.startup_cap_table_summary;
create policy "startup_cap_table_summary select all"
  on public.startup_cap_table_summary for select
  using (true);

drop policy if exists "startup_cap_table_summary insert as owner" on public.startup_cap_table_summary;
create policy "startup_cap_table_summary insert as owner"
  on public.startup_cap_table_summary for insert
  with check (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.user_id = public.app_user_id()
    )
  );

drop policy if exists "startup_cap_table_summary update as owner" on public.startup_cap_table_summary;
create policy "startup_cap_table_summary update as owner"
  on public.startup_cap_table_summary for update
  using (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.user_id = public.app_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.user_id = public.app_user_id()
    )
  );

drop policy if exists "startup_cap_table_summary delete as owner" on public.startup_cap_table_summary;
create policy "startup_cap_table_summary delete as owner"
  on public.startup_cap_table_summary for delete
  using (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.user_id = public.app_user_id()
    )
  );

-- ──────────────────────────────────────────────────────────────────────────
-- 3. startup_use_of_funds_lines (1:N with startups)
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.startup_use_of_funds_lines (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,

  category public.use_of_funds_category not null,

  -- Percentage of the target raise that goes to this category. Single
  -- row's CHECK; cross-row sum<=100 is enforced at the app layer in
  -- the publish gate (see app/build/actions.ts).
  pct_of_raise int not null check (pct_of_raise between 0 and 100),

  narrative text check (narrative is null or length(narrative) <= 500),

  display_order int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One row per category per startup — keeps the data model clean.
  unique (startup_id, category)
);

drop trigger if exists startup_use_of_funds_lines_set_updated_at on public.startup_use_of_funds_lines;
create trigger startup_use_of_funds_lines_set_updated_at
  before update on public.startup_use_of_funds_lines
  for each row execute function public.set_updated_at();

create index if not exists startup_use_of_funds_lines_startup_idx
  on public.startup_use_of_funds_lines (startup_id, display_order, category);

alter table public.startup_use_of_funds_lines enable row level security;

drop policy if exists "startup_use_of_funds_lines select all" on public.startup_use_of_funds_lines;
create policy "startup_use_of_funds_lines select all"
  on public.startup_use_of_funds_lines for select
  using (true);

drop policy if exists "startup_use_of_funds_lines insert as owner" on public.startup_use_of_funds_lines;
create policy "startup_use_of_funds_lines insert as owner"
  on public.startup_use_of_funds_lines for insert
  with check (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.user_id = public.app_user_id()
    )
  );

drop policy if exists "startup_use_of_funds_lines update as owner" on public.startup_use_of_funds_lines;
create policy "startup_use_of_funds_lines update as owner"
  on public.startup_use_of_funds_lines for update
  using (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.user_id = public.app_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.user_id = public.app_user_id()
    )
  );

drop policy if exists "startup_use_of_funds_lines delete as owner" on public.startup_use_of_funds_lines;
create policy "startup_use_of_funds_lines delete as owner"
  on public.startup_use_of_funds_lines for delete
  using (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.user_id = public.app_user_id()
    )
  );
