-- Founder narrative depth — investor-grade pitch sections.
-- Append-only: never edit this file once committed. Add a new migration to fix.
--
-- Adds three sets of changes:
--   1. Basics columns on `startups`: founded_year, product_status, customer_type.
--   2. Round extension columns on `startup_round_details`: runway, milestones.
--   3. New 1:1 narrative table `startup_narrative` for structured pitch text.
--
-- Design rationale:
--   - Single narrative table rather than 6 separate tables (Problem, Solution,
--     Business Model, GTM, Competition narrative, Risks) because all fields are
--     text, filled together, saved/loaded together. One query, one upsert.
--   - Bands (not exact numbers) for ACV, gross margin, sales cycle — same
--     legal posture as existing valuation_band, equity_pct_band, etc.
--   - Visibility: narrative is non-sensitive investor-grade content, exposed at
--     the "verified" tier (verified investor pre-match) alongside existing
--     round/team/traction depth. See lib/profile/visibility.ts.
--
-- No backfill: columns start NULL, table starts empty.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Basics columns on public.startups
-- ──────────────────────────────────────────────────────────────────────────

alter table public.startups
  add column if not exists founded_year int
    check (founded_year is null or (founded_year between 1900 and 2100));

alter table public.startups
  add column if not exists product_status text
    check (product_status is null or product_status in (
      'idea', 'prototype', 'beta', 'launched', 'revenue_generating'
    ));

alter table public.startups
  add column if not exists customer_type text
    check (customer_type is null or customer_type in (
      'consumer', 'smb', 'enterprise', 'developer', 'government', 'marketplace', 'other'
    ));

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Round extension columns on public.startup_round_details
-- ──────────────────────────────────────────────────────────────────────────

alter table public.startup_round_details
  add column if not exists runway_months_after_raise int
    check (runway_months_after_raise is null or runway_months_after_raise between 0 and 120);

alter table public.startup_round_details
  add column if not exists milestones_summary text
    check (milestones_summary is null or length(milestones_summary) <= 1500);

-- ──────────────────────────────────────────────────────────────────────────
-- 3. startup_narrative (1:1 with startups)
-- ──────────────────────────────────────────────────────────────────────────
--
-- One wide table holding all pitch-narrative text fields. Organized by
-- investor question category:
--   A. Problem       — what pain exists, who has it, why current solutions fail
--   B. Solution      — what you built, moat, roadmap
--   C. Market        — narrative context beyond TAM/SAM bands
--   D. Customer proof— notable customers, retention story
--   E. Business model— revenue model, pricing, ACV, margin, sales cycle
--   F. Go-to-market  — channels, current/planned GTM
--   G. Competition   — overall why-we-win, defensibility, investor misperceptions
--   H. Team          — narrative beyond per-member rows
--   J. Risks         — technical, market, execution, biggest unknown

create table if not exists public.startup_narrative (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null unique references public.startups(id) on delete cascade,

  -- A. Problem
  problem_statement text check (problem_statement is null or length(problem_statement) <= 1500),
  target_customer text check (target_customer is null or length(target_customer) <= 800),
  current_alternatives text check (current_alternatives is null or length(current_alternatives) <= 1200),
  why_alternatives_fail text check (why_alternatives_fail is null or length(why_alternatives_fail) <= 1200),

  -- B. Solution
  product_summary text check (product_summary is null or length(product_summary) <= 1500),
  key_features text check (key_features is null or length(key_features) <= 2000),
  technical_moat text check (technical_moat is null or length(technical_moat) <= 1200),
  roadmap text check (roadmap is null or length(roadmap) <= 2000),

  -- C. Market narrative (TAM/SAM bands stay in startup_market_analysis)
  target_market text check (target_market is null or length(target_market) <= 1000),
  market_trend text check (market_trend is null or length(market_trend) <= 1200),
  beachhead_market text check (beachhead_market is null or length(beachhead_market) <= 1000),
  why_now text check (why_now is null or length(why_now) <= 1200),

  -- D. Customer proof (extends structured traction signals)
  notable_customers text check (notable_customers is null or length(notable_customers) <= 1200),
  customer_proof text check (customer_proof is null or length(customer_proof) <= 2000),
  retention_engagement text check (retention_engagement is null or length(retention_engagement) <= 1200),

  -- E. Business model
  revenue_model text check (revenue_model is null or length(revenue_model) <= 800),
  pricing text check (pricing is null or length(pricing) <= 1000),
  average_contract_value_band text
    check (average_contract_value_band is null or average_contract_value_band in (
      'under_1k', '1k_10k', '10k_50k', '50k_250k', '250k_1m', 'over_1m'
    )),
  gross_margin_band text
    check (gross_margin_band is null or gross_margin_band in (
      'under_30', '30_50', '50_70', '70_85', 'over_85'
    )),
  sales_cycle_band text
    check (sales_cycle_band is null or sales_cycle_band in (
      'under_1wk', '1_4wk', '1_3mo', '3_6mo', '6_12mo', 'over_12mo'
    )),

  -- F. Go-to-market
  acquisition_channels text check (acquisition_channels is null or length(acquisition_channels) <= 1200),
  current_gtm text check (current_gtm is null or length(current_gtm) <= 1200),
  planned_gtm text check (planned_gtm is null or length(planned_gtm) <= 1200),
  why_channels_work text check (why_channels_work is null or length(why_channels_work) <= 1200),

  -- G. Competition narrative (per-competitor rows stay in startup_competitive_landscape)
  why_we_win text check (why_we_win is null or length(why_we_win) <= 1200),
  defensibility text check (defensibility is null or length(defensibility) <= 1200),
  investor_misunderstanding text check (investor_misunderstanding is null or length(investor_misunderstanding) <= 1200),

  -- H. Team narrative (per-person rows stay in startup_team_members)
  founder_background text check (founder_background is null or length(founder_background) <= 2000),
  founder_market_fit text check (founder_market_fit is null or length(founder_market_fit) <= 1200),
  technical_strengths text check (technical_strengths is null or length(technical_strengths) <= 1000),
  business_strengths text check (business_strengths is null or length(business_strengths) <= 1000),
  advisors text check (advisors is null or length(advisors) <= 1200),
  key_hires_needed text check (key_hires_needed is null or length(key_hires_needed) <= 1000),

  -- J. Risks
  technical_risk text check (technical_risk is null or length(technical_risk) <= 1000),
  market_risk text check (market_risk is null or length(market_risk) <= 1000),
  execution_risk text check (execution_risk is null or length(execution_risk) <= 1000),
  biggest_unknown text check (biggest_unknown is null or length(biggest_unknown) <= 800),
  failure_scenario text check (failure_scenario is null or length(failure_scenario) <= 1000),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists startup_narrative_set_updated_at on public.startup_narrative;
create trigger startup_narrative_set_updated_at
  before update on public.startup_narrative
  for each row execute function public.set_updated_at();

alter table public.startup_narrative enable row level security;

-- Read: same shape as the parent `startups` table (`select all`). The app
-- layer enforces verified-only / paused / blocked filters.
drop policy if exists "startup_narrative select all" on public.startup_narrative;
create policy "startup_narrative select all"
  on public.startup_narrative for select
  using (true);

drop policy if exists "startup_narrative insert as owner" on public.startup_narrative;
create policy "startup_narrative insert as owner"
  on public.startup_narrative for insert
  with check (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.user_id = public.app_user_id()
    )
  );

drop policy if exists "startup_narrative update as owner" on public.startup_narrative;
create policy "startup_narrative update as owner"
  on public.startup_narrative for update
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

drop policy if exists "startup_narrative delete as owner" on public.startup_narrative;
create policy "startup_narrative delete as owner"
  on public.startup_narrative for delete
  using (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.user_id = public.app_user_id()
    )
  );
