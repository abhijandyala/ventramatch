-- Profile depth — Sprint A: traction signals, market analysis, competitive.
-- Append-only: never edit this file once committed. Add a new migration to fix.
--
-- Replaces the freeform `startups.traction text` field from 0001 with
-- structured rows so investors can filter on real metrics ("$25k+ MRR
-- growing 15%+ MoM") and the matching score (lib/matching/score.ts) can
-- weight an actual ARR overlap signal instead of just `length(text)`.
--
-- The existing `startups.traction` column from 0001 STAYS — it's a quick
-- narrative field for founders who want to summarize. The structured
-- rows here are additive: when both exist, the structured rows are the
-- source of truth for filtering and ranking; the narrative is for prose.
--
-- Decisions baked in here:
--   1. Traction kinds chosen for what investors actually filter on at
--      pre-seed → Series A. SaaS metrics (MRR, ARR, retention, NPS) sit
--      alongside non-SaaS (signed_lois, design_partners, waitlist_size,
--      gmv) so we don't bias the schema toward one motion.
--   2. `value_numeric` is the single number column; the kind enum implies
--      the unit. We do NOT keep a separate unit column to avoid drift
--      ("did they enter MRR in dollars or thousands of dollars?"). The
--      Zod schema in lib/validation enforces unit-by-kind at submit time.
--   3. `period_start` / `period_end` let us express "Q1 2026 ARR" vs.
--      "current ARR." Investors weight 90-day-old ARR heavily lower
--      than current; the period columns make that visible.
--   4. `evidence_url` + `source_kind` capture the "show me proof" layer.
--      `self_reported` defaults true; the verifications layer in 0016
--      flips it to false when an evidence URL is human-confirmed (paid
--      tier later). Until then, all rows are self-reported.
--   5. Market analysis: TAM/SAM/SOM as bands, not exact numbers — we
--      care that the founder thought about market sizing, not the
--      precision of their slide. Methodology summary is the actual
--      signal investors weight.
--   6. Competitive landscape stays simple — id, competitor name, what
--      we do differently, link. No "competitive moat strength" enum
--      because that gets gamed; investors form their own opinion.
--
-- No backfill: tables start empty.

-- ──────────────────────────────────────────────────────────────────────────
-- 0. Enums (idempotent)
-- ──────────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.traction_kind as enum (
    'mrr',                  -- monthly recurring revenue, USD
    'arr',                  -- annual recurring revenue, USD
    'gross_revenue',        -- total revenue (non-recurring), USD
    'paying_customers',     -- count
    'design_partners',      -- count of pilot/beta customers
    'signed_lois',          -- count of LOIs / pre-orders
    'waitlist_size',        -- count
    'dau',                  -- daily active users
    'mau',                  -- monthly active users
    'retention_day_30',     -- percent (0-100)
    'retention_day_90',     -- percent (0-100)
    'nps',                  -- net promoter score (-100 to 100)
    'gross_margin_pct',     -- percent (0-100)
    'cac_usd',              -- customer acquisition cost, USD
    'ltv_usd',              -- lifetime value, USD
    'contracted_revenue',   -- signed-but-not-yet-recognized, USD
    'gmv'                   -- gross merchandise value, USD
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.traction_source_kind as enum (
    'stripe_dashboard',
    'bank_statement',
    'crm_export',
    'csv_upload',
    'self_attested',
    'other'
  );
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 1. startup_traction_signals (1:N with startups)
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.startup_traction_signals (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,

  kind public.traction_kind not null,

  -- Single value column. Unit implied by kind (Zod enforces at submit).
  -- numeric(20,2) handles everything from $0.50 retention rates to
  -- billion-dollar GMV without precision loss.
  value_numeric numeric(20, 2) not null,

  -- "As of when?" Both nullable for "current" claims; both set for
  -- range claims like "Q1 2026 MRR averaged $25k". end >= start enforced
  -- when both are set.
  period_start timestamptz,
  period_end timestamptz check (period_end is null or period_start is null or period_end >= period_start),

  -- Evidence and provenance. Verification status lives in 0016.
  evidence_url text check (evidence_url is null or length(evidence_url) <= 500),
  source_kind public.traction_source_kind not null default 'self_attested',
  self_reported boolean not null default true,

  -- Optional short caption (e.g., "excludes one large enterprise pilot").
  notes text check (notes is null or length(notes) <= 300),

  display_order int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists startup_traction_signals_set_updated_at on public.startup_traction_signals;
create trigger startup_traction_signals_set_updated_at
  before update on public.startup_traction_signals
  for each row execute function public.set_updated_at();

create index if not exists startup_traction_signals_startup_idx
  on public.startup_traction_signals (startup_id, display_order, created_at);

-- Drives "show me startups with MRR signals" investor filters.
create index if not exists startup_traction_signals_kind_idx
  on public.startup_traction_signals (kind);

alter table public.startup_traction_signals enable row level security;

drop policy if exists "startup_traction_signals select all" on public.startup_traction_signals;
create policy "startup_traction_signals select all"
  on public.startup_traction_signals for select
  using (true);

drop policy if exists "startup_traction_signals insert as owner" on public.startup_traction_signals;
create policy "startup_traction_signals insert as owner"
  on public.startup_traction_signals for insert
  with check (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.user_id = public.app_user_id()
    )
  );

drop policy if exists "startup_traction_signals update as owner" on public.startup_traction_signals;
create policy "startup_traction_signals update as owner"
  on public.startup_traction_signals for update
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

drop policy if exists "startup_traction_signals delete as owner" on public.startup_traction_signals;
create policy "startup_traction_signals delete as owner"
  on public.startup_traction_signals for delete
  using (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.user_id = public.app_user_id()
    )
  );

-- ──────────────────────────────────────────────────────────────────────────
-- 2. startup_market_analysis (1:1 with startups)
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.startup_market_analysis (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null unique references public.startups(id) on delete cascade,

  -- Total / Serviceable / Obtainable market. Bands rather than exact figures
  -- because every TAM slide has a creative methodology — what we care
  -- about is the order of magnitude and the methodology that got there.
  tam_band text
    check (tam_band is null or tam_band in (
      'under_100m', '100m_500m', '500m_1b', '1b_10b', '10b_100b', 'over_100b'
    )),
  sam_band text
    check (sam_band is null or sam_band in (
      'under_100m', '100m_500m', '500m_1b', '1b_10b', '10b_100b', 'over_100b'
    )),
  som_band text
    check (som_band is null or som_band in (
      'under_100m', '100m_500m', '500m_1b', '1b_10b', '10b_100b', 'over_100b'
    )),

  -- The methodology IS the signal. Investors trust "bottoms-up: 12k US
  -- mid-market hospitals × $50k ACP × 30% reach" far more than a top-down
  -- "this is a $50B market" claim.
  methodology_summary text check (methodology_summary is null or length(methodology_summary) <= 1000),

  -- Citation links — Gartner, IBIS, etc. Stored as JSONB array of strings
  -- so we can grow the shape later (e.g., to include excerpt text).
  source_links jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists startup_market_analysis_set_updated_at on public.startup_market_analysis;
create trigger startup_market_analysis_set_updated_at
  before update on public.startup_market_analysis
  for each row execute function public.set_updated_at();

alter table public.startup_market_analysis enable row level security;

drop policy if exists "startup_market_analysis select all" on public.startup_market_analysis;
create policy "startup_market_analysis select all"
  on public.startup_market_analysis for select
  using (true);

drop policy if exists "startup_market_analysis insert as owner" on public.startup_market_analysis;
create policy "startup_market_analysis insert as owner"
  on public.startup_market_analysis for insert
  with check (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.user_id = public.app_user_id()
    )
  );

drop policy if exists "startup_market_analysis update as owner" on public.startup_market_analysis;
create policy "startup_market_analysis update as owner"
  on public.startup_market_analysis for update
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

drop policy if exists "startup_market_analysis delete as owner" on public.startup_market_analysis;
create policy "startup_market_analysis delete as owner"
  on public.startup_market_analysis for delete
  using (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.user_id = public.app_user_id()
    )
  );

-- ──────────────────────────────────────────────────────────────────────────
-- 3. startup_competitive_landscape (1:N with startups)
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.startup_competitive_landscape (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,

  competitor_name text not null check (length(competitor_name) between 1 and 120),

  -- Free text. Investors form their own opinion on whether the
  -- differentiation is real; we don't bucket "moat strength."
  differentiation text check (differentiation is null or length(differentiation) <= 500),

  link_url text check (link_url is null or length(link_url) <= 500),

  display_order int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists startup_competitive_landscape_set_updated_at on public.startup_competitive_landscape;
create trigger startup_competitive_landscape_set_updated_at
  before update on public.startup_competitive_landscape
  for each row execute function public.set_updated_at();

create index if not exists startup_competitive_landscape_startup_idx
  on public.startup_competitive_landscape (startup_id, display_order);

alter table public.startup_competitive_landscape enable row level security;

drop policy if exists "startup_competitive_landscape select all" on public.startup_competitive_landscape;
create policy "startup_competitive_landscape select all"
  on public.startup_competitive_landscape for select
  using (true);

drop policy if exists "startup_competitive_landscape insert as owner" on public.startup_competitive_landscape;
create policy "startup_competitive_landscape insert as owner"
  on public.startup_competitive_landscape for insert
  with check (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.user_id = public.app_user_id()
    )
  );

drop policy if exists "startup_competitive_landscape update as owner" on public.startup_competitive_landscape;
create policy "startup_competitive_landscape update as owner"
  on public.startup_competitive_landscape for update
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

drop policy if exists "startup_competitive_landscape delete as owner" on public.startup_competitive_landscape;
create policy "startup_competitive_landscape delete as owner"
  on public.startup_competitive_landscape for delete
  using (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.user_id = public.app_user_id()
    )
  );
