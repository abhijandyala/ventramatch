-- Profile depth — Sprint A: investor depth.
-- Append-only: never edit this file once committed. Add a new migration to fix.
--
-- Six new child tables fan out from `investors` so founders can answer the
-- questions they actually care about before engaging:
--
--   * Will this investor write the check I need? (check_bands per stage)
--   * What have they actually done? (portfolio)
--   * Do they have the firepower / cadence to follow through? (track_record)
--   * Will they decide quickly or string me along? (decision_process)
--   * What do they bring beyond money? (value_add)
--   * Is there a known reason they wouldn't back me? (anti_patterns)
--
-- Today's investor profile (the row in `investors` from 0001) only carries
-- a single check_min/check_max pair, an array of stages, and a freeform
-- thesis. That answers none of the above with structure, and a serious
-- founder bails.
--
-- Decisions baked in here:
--   1. Check bands are per-stage AND per-role (lead vs follow). A typical
--      multi-stage VC writes very different checks at pre-seed lead vs
--      seed follow; collapsing those into one (check_min, check_max)
--      pair is dishonest. UNIQUE on (investor_id, stage, role).
--   2. Portfolio rows have a public/private flag. Private rows weight the
--      matching score (sector overlap, etc.) but never surface to founders.
--      This lets investors disclose stealth deals to the matching engine
--      without exposing them on their public profile.
--   3. Track record is a 1:1 child rather than columns on the parent
--      `investors` row — keeps the parent narrow (read in every feed
--      query) and lets the optional fields stay null without polluting
--      the discovery card.
--   4. Decision process is a 1:1 child of explicit booleans + bands.
--      "ic_required, references_required, data_room_required,
--      partner_meeting_required" are the four binary questions every
--      founder asks; surfacing them in the schema makes the answer
--      filterable.
--   5. Value-add is a separate table (one row per tag) instead of a text[]
--      column on `investors`. Lets us add per-tag narrative later
--      ("recruiting — placed 3 VPEs in 2025") without a column change.
--   6. Anti-patterns are explicit. "We don't back first-time technical
--      founders without a co-founder" surfaced bluntly saves both sides
--      from wasted intros.
--
-- Bands chosen for what investors actually disclose voluntarily. Exact
-- AUM, dry powder, fund vintage are competitive intel; bands let an
-- investor signal "we're a $250-500M fund with $100-500M deployed" without
-- precision they'd rather not publish.
--
-- No backfill: tables start empty.

-- ──────────────────────────────────────────────────────────────────────────
-- 0. Enums (idempotent)
-- ──────────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.investor_role as enum (
    'lead',
    'co_lead',
    'follow',
    'participant'
  );
exception when duplicate_object then null; end $$;

-- check_bands has its own role enum subset — only lead/follow at the
-- check-band granularity (co_lead and participant are portfolio-row
-- concepts, not band-defining).
do $$ begin
  create type public.investor_check_role as enum ('lead', 'follow');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.investor_exit_kind as enum (
    'acquired',
    'ipo',
    'shutdown',
    'n_a'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.investor_value_add_kind as enum (
    'recruiting',
    'gtm_intros',
    'sales_intros',
    'customer_intros',
    'board_governance',
    'regulatory',
    'technical_dd',
    'fundraising_strategy',
    'international_expansion'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.investor_anti_pattern_kind as enum (
    'sector',
    'stage',
    'geography',
    'founder_profile',
    'check_size',
    'other'
  );
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 1. investor_check_bands (1:N — per stage and role)
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.investor_check_bands (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.investors(id) on delete cascade,

  stage public.startup_stage not null,
  role public.investor_check_role not null,

  -- Exact dollars; investors expect to see ranges, not bands, on check
  -- size. Same convention as the existing investors.check_min/check_max
  -- columns from 0001.
  check_min_usd bigint not null check (check_min_usd >= 0),
  check_max_usd bigint not null check (check_max_usd >= check_min_usd),

  -- Target ownership at this stage+role. Bands rather than exact percent.
  ownership_target_band text
    check (ownership_target_band is null or ownership_target_band in (
      'under_5pct', '5_10', '10_20', 'over_20'
    )),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One row per (investor, stage, role). An investor expressing "lead at
  -- pre-seed, follow at seed" gets two rows.
  unique (investor_id, stage, role)
);

drop trigger if exists investor_check_bands_set_updated_at on public.investor_check_bands;
create trigger investor_check_bands_set_updated_at
  before update on public.investor_check_bands
  for each row execute function public.set_updated_at();

create index if not exists investor_check_bands_investor_idx
  on public.investor_check_bands (investor_id, stage, role);

-- Drives "founders raising at seed looking for a lead" feed filter.
create index if not exists investor_check_bands_stage_role_idx
  on public.investor_check_bands (stage, role);

alter table public.investor_check_bands enable row level security;

drop policy if exists "investor_check_bands select all" on public.investor_check_bands;
create policy "investor_check_bands select all"
  on public.investor_check_bands for select
  using (true);

drop policy if exists "investor_check_bands insert as owner" on public.investor_check_bands;
create policy "investor_check_bands insert as owner"
  on public.investor_check_bands for insert
  with check (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  );

drop policy if exists "investor_check_bands update as owner" on public.investor_check_bands;
create policy "investor_check_bands update as owner"
  on public.investor_check_bands for update
  using (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  );

drop policy if exists "investor_check_bands delete as owner" on public.investor_check_bands;
create policy "investor_check_bands delete as owner"
  on public.investor_check_bands for delete
  using (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  );

-- ──────────────────────────────────────────────────────────────────────────
-- 2. investor_portfolio (1:N)
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.investor_portfolio (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.investors(id) on delete cascade,

  company_name text not null check (length(company_name) between 1 and 120),
  year int check (year is null or (year >= 2000 and year <= 2100)),
  role public.investor_role not null,

  -- When false, this entry is used for matching weight (sector / stage
  -- overlap) but never rendered to founders. Lets investors disclose
  -- stealth deals to the matching engine without exposing them publicly.
  -- App layer enforces the visibility filter; RLS just gates ownership.
  is_public_listing boolean not null default true,

  sector text check (sector is null or length(sector) <= 80),

  is_exited boolean not null default false,
  exit_kind public.investor_exit_kind,

  -- Optional one-line context (e.g., "led $5M seed; on board").
  notes text check (notes is null or length(notes) <= 200),

  display_order int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists investor_portfolio_set_updated_at on public.investor_portfolio;
create trigger investor_portfolio_set_updated_at
  before update on public.investor_portfolio
  for each row execute function public.set_updated_at();

create index if not exists investor_portfolio_investor_idx
  on public.investor_portfolio (investor_id, display_order);

-- Drives "investors with portfolio in fintech" matching weight; sector
-- column is text and lower-cased compared at query time.
create index if not exists investor_portfolio_sector_lower_idx
  on public.investor_portfolio (lower(sector));

alter table public.investor_portfolio enable row level security;

drop policy if exists "investor_portfolio select all" on public.investor_portfolio;
create policy "investor_portfolio select all"
  on public.investor_portfolio for select
  using (true);

drop policy if exists "investor_portfolio insert as owner" on public.investor_portfolio;
create policy "investor_portfolio insert as owner"
  on public.investor_portfolio for insert
  with check (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  );

drop policy if exists "investor_portfolio update as owner" on public.investor_portfolio;
create policy "investor_portfolio update as owner"
  on public.investor_portfolio for update
  using (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  );

drop policy if exists "investor_portfolio delete as owner" on public.investor_portfolio;
create policy "investor_portfolio delete as owner"
  on public.investor_portfolio for delete
  using (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  );

-- ──────────────────────────────────────────────────────────────────────────
-- 3. investor_track_record (1:1)
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.investor_track_record (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null unique references public.investors(id) on delete cascade,

  -- All bands. Investors disclose ranges, not exact AUM / deal counts.
  total_deals_band text
    check (total_deals_band is null or total_deals_band in (
      'under_10', '10_25', '25_50', '50_100', 'over_100'
    )),
  first_money_in_count_band text
    check (first_money_in_count_band is null or first_money_in_count_band in (
      'under_10', '10_25', '25_50', '50_100', 'over_100'
    )),
  follow_on_rate_band text
    check (follow_on_rate_band is null or follow_on_rate_band in (
      'under_25', '25_50', '50_75', 'over_75'
    )),
  avg_ownership_band text
    check (avg_ownership_band is null or avg_ownership_band in (
      'under_5pct', '5_10', '10_20', 'over_20'
    )),
  fund_size_band text
    check (fund_size_band is null or fund_size_band in (
      'under_25m', '25_100m', '100_500m', '500m_1b', 'over_1b'
    )),
  fund_vintage_year int
    check (fund_vintage_year is null or (fund_vintage_year >= 1990 and fund_vintage_year <= 2100)),
  dry_powder_band text
    check (dry_powder_band is null or dry_powder_band in (
      'depleted', 'under_25m', '25_100m', '100_500m', 'over_500m'
    )),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists investor_track_record_set_updated_at on public.investor_track_record;
create trigger investor_track_record_set_updated_at
  before update on public.investor_track_record
  for each row execute function public.set_updated_at();

alter table public.investor_track_record enable row level security;

drop policy if exists "investor_track_record select all" on public.investor_track_record;
create policy "investor_track_record select all"
  on public.investor_track_record for select
  using (true);

drop policy if exists "investor_track_record insert as owner" on public.investor_track_record;
create policy "investor_track_record insert as owner"
  on public.investor_track_record for insert
  with check (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  );

drop policy if exists "investor_track_record update as owner" on public.investor_track_record;
create policy "investor_track_record update as owner"
  on public.investor_track_record for update
  using (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  );

drop policy if exists "investor_track_record delete as owner" on public.investor_track_record;
create policy "investor_track_record delete as owner"
  on public.investor_track_record for delete
  using (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  );

-- ──────────────────────────────────────────────────────────────────────────
-- 4. investor_decision_process (1:1)
-- ──────────────────────────────────────────────────────────────────────────
--
-- The four boolean columns are intentional. Founders ask "what's your
-- process" and want a structured answer; freeform text invites obfuscation.

create table if not exists public.investor_decision_process (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null unique references public.investors(id) on delete cascade,

  time_to_term_sheet_band text
    check (time_to_term_sheet_band is null or time_to_term_sheet_band in (
      'one_week', 'two_weeks', 'one_month', 'two_months', 'quarter_plus'
    )),

  ic_required boolean not null default true,
  references_required boolean not null default false,
  data_room_required boolean not null default false,
  partner_meeting_required boolean not null default true,

  -- Optional narrative for nuance (e.g., "we move fast for thesis fits;
  -- IC for net-new sectors").
  process_narrative text check (process_narrative is null or length(process_narrative) <= 400),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists investor_decision_process_set_updated_at on public.investor_decision_process;
create trigger investor_decision_process_set_updated_at
  before update on public.investor_decision_process
  for each row execute function public.set_updated_at();

alter table public.investor_decision_process enable row level security;

drop policy if exists "investor_decision_process select all" on public.investor_decision_process;
create policy "investor_decision_process select all"
  on public.investor_decision_process for select
  using (true);

drop policy if exists "investor_decision_process insert as owner" on public.investor_decision_process;
create policy "investor_decision_process insert as owner"
  on public.investor_decision_process for insert
  with check (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  );

drop policy if exists "investor_decision_process update as owner" on public.investor_decision_process;
create policy "investor_decision_process update as owner"
  on public.investor_decision_process for update
  using (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  );

drop policy if exists "investor_decision_process delete as owner" on public.investor_decision_process;
create policy "investor_decision_process delete as owner"
  on public.investor_decision_process for delete
  using (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  );

-- ──────────────────────────────────────────────────────────────────────────
-- 5. investor_value_add (1:N — one row per tag)
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.investor_value_add (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.investors(id) on delete cascade,

  kind public.investor_value_add_kind not null,

  -- Per-tag narrative. Optional but encouraged — "recruiting" is generic,
  -- "recruiting — placed 3 VPEs in 2025" is the actual signal.
  narrative text check (narrative is null or length(narrative) <= 300),

  display_order int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One row per (investor, kind). No duplicates.
  unique (investor_id, kind)
);

drop trigger if exists investor_value_add_set_updated_at on public.investor_value_add;
create trigger investor_value_add_set_updated_at
  before update on public.investor_value_add
  for each row execute function public.set_updated_at();

create index if not exists investor_value_add_kind_idx
  on public.investor_value_add (kind);

alter table public.investor_value_add enable row level security;

drop policy if exists "investor_value_add select all" on public.investor_value_add;
create policy "investor_value_add select all"
  on public.investor_value_add for select
  using (true);

drop policy if exists "investor_value_add insert as owner" on public.investor_value_add;
create policy "investor_value_add insert as owner"
  on public.investor_value_add for insert
  with check (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  );

drop policy if exists "investor_value_add update as owner" on public.investor_value_add;
create policy "investor_value_add update as owner"
  on public.investor_value_add for update
  using (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  );

drop policy if exists "investor_value_add delete as owner" on public.investor_value_add;
create policy "investor_value_add delete as owner"
  on public.investor_value_add for delete
  using (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  );

-- ──────────────────────────────────────────────────────────────────────────
-- 6. investor_anti_patterns (1:N)
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.investor_anti_patterns (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.investors(id) on delete cascade,

  kind public.investor_anti_pattern_kind not null,

  -- Required narrative — the kind alone is too coarse. "founder_profile"
  -- needs a sentence ("we don't back first-time technical founders without
  -- a co-founder") to be actionable.
  narrative text not null check (length(narrative) between 5 and 300),

  display_order int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists investor_anti_patterns_set_updated_at on public.investor_anti_patterns;
create trigger investor_anti_patterns_set_updated_at
  before update on public.investor_anti_patterns
  for each row execute function public.set_updated_at();

create index if not exists investor_anti_patterns_investor_idx
  on public.investor_anti_patterns (investor_id, display_order);

alter table public.investor_anti_patterns enable row level security;

drop policy if exists "investor_anti_patterns select all" on public.investor_anti_patterns;
create policy "investor_anti_patterns select all"
  on public.investor_anti_patterns for select
  using (true);

drop policy if exists "investor_anti_patterns insert as owner" on public.investor_anti_patterns;
create policy "investor_anti_patterns insert as owner"
  on public.investor_anti_patterns for insert
  with check (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  );

drop policy if exists "investor_anti_patterns update as owner" on public.investor_anti_patterns;
create policy "investor_anti_patterns update as owner"
  on public.investor_anti_patterns for update
  using (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  );

drop policy if exists "investor_anti_patterns delete as owner" on public.investor_anti_patterns;
create policy "investor_anti_patterns delete as owner"
  on public.investor_anti_patterns for delete
  using (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  );
