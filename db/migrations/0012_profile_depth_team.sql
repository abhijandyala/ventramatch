-- Profile depth — Sprint A: team members.
-- Append-only: never edit this file once committed. Add a new migration to fix.
--
-- Two new child tables fan out from the existing `startups` and `investors`
-- rows so we can store real depth on who's behind a profile rather than
-- the single founder/partner the original schema implied.
--
-- Decisions baked in here:
--   1. `linked_user_id` is nullable. Most team members are not (yet) registered
--      VentraMatch users — co-founders, prior employers, GPs at firms with
--      only one user on the platform. We store the claim (name + linkedin_url)
--      and fill `linked_user_id` opportunistically when the person signs up
--      and confirms the link. Verification of the claim itself is layered on
--      separately in `0016_verifications.sql` (Sprint A).
--   2. Equity is stored as a band, not an exact percent. Same logic as the
--      valuation_band column landing in `0013`: avoid stale numbers and avoid
--      anything that could be read as investment advice. CHECK enforces the
--      enum-like set without forcing a CREATE TYPE migration we'd have to
--      grow every time we revise the buckets. Same shape as `profile_state`
--      in `0006_account_state_and_consent.sql`.
--   3. Visibility tier matches the parent table. `startups` and `investors`
--      use `select all` and let the app layer enforce `account_label='verified'`
--      plus the paused / deletion / block checks (see lib/feed/query.ts and
--      lib/profile/visibility.ts). Team-member rows follow the same pattern,
--      gated for write through a subquery against the parent's user_id.
--   4. Self-reported by default; the verifications layer (0016) is what
--      promotes a row to "trusted." We never set a `verified_at` here — that
--      lives on the `verifications` table to avoid denormalizing trust state.
--
-- No backfill: tables start empty. Founders and investors populate them via
-- the section-based builder rewrite in a later PR.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. startup_team_members
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.startup_team_members (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,

  -- Display identity. Required so the row is renderable even before any
  -- linked_user_id arrives.
  name text not null check (length(name) between 2 and 120),
  role text not null check (length(role) between 2 and 80),

  -- Distinguishes co-founders (equity, full-time signal expected) from
  -- early employees / advisors. The startup's owner is implicitly a founder
  -- via `startups.user_id`; this lets us list co-founders alongside.
  is_founder boolean not null default false,
  is_full_time boolean not null default true,

  -- Optional bio + prior-employer signals. Investors weight prior-Stripe /
  -- prior-Google heavily at pre-seed; structured fields beat freeform text.
  bio text check (bio is null or length(bio) <= 600),
  prior_company text check (prior_company is null or length(prior_company) <= 120),
  prior_role text check (prior_role is null or length(prior_role) <= 80),

  -- Public-profile links. URL shape validated at the app layer (Zod);
  -- DB only enforces a soft length cap so a bad paste can't blow the row.
  linkedin_url text check (linkedin_url is null or length(linkedin_url) <= 500),
  github_url text check (github_url is null or length(github_url) <= 500),

  -- Equity stored as a band; exact % is Tier 3 / data room territory.
  -- Buckets chosen so each band reads as a distinct ownership story
  -- (sub-5 = early hire, 5-15 = senior hire, 15-30 = co-founder w/ partial
  -- vest, 30-50 = co-founder, 50+ = sole founder).
  equity_pct_band text
    check (equity_pct_band is null or equity_pct_band in (
      'under_5', '5_15', '15_30', '30_50', 'over_50'
    )),

  -- Set when this team member is also a VentraMatch user. ON DELETE SET NULL
  -- so removing a user account doesn't blow away the historical claim — the
  -- name + linkedin survive on the parent's profile.
  linked_user_id uuid references public.users(id) on delete set null,

  -- Stable display order; ties broken by created_at in the read query.
  display_order int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists startup_team_members_set_updated_at on public.startup_team_members;
create trigger startup_team_members_set_updated_at
  before update on public.startup_team_members
  for each row execute function public.set_updated_at();

create index if not exists startup_team_members_startup_idx
  on public.startup_team_members (startup_id, display_order, created_at);

-- Partial index — only filled rows. Drives "is this user listed on any team"
-- lookups for the verifications surface.
create index if not exists startup_team_members_linked_user_idx
  on public.startup_team_members (linked_user_id)
  where linked_user_id is not null;

-- A given registered user can appear on a startup's team at most once. Two
-- unlinked rows with the same name are allowed — that's the founder's call
-- to dedupe.
create unique index if not exists startup_team_members_one_link_per_startup
  on public.startup_team_members (startup_id, linked_user_id)
  where linked_user_id is not null;

alter table public.startup_team_members enable row level security;

-- Read: same shape as the parent `startups` table (`select all`). The app
-- layer enforces verified-only / paused / blocked filters.
drop policy if exists "startup_team_members select all" on public.startup_team_members;
create policy "startup_team_members select all"
  on public.startup_team_members for select
  using (true);

drop policy if exists "startup_team_members insert as owner" on public.startup_team_members;
create policy "startup_team_members insert as owner"
  on public.startup_team_members for insert
  with check (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.user_id = public.app_user_id()
    )
  );

drop policy if exists "startup_team_members update as owner" on public.startup_team_members;
create policy "startup_team_members update as owner"
  on public.startup_team_members for update
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

drop policy if exists "startup_team_members delete as owner" on public.startup_team_members;
create policy "startup_team_members delete as owner"
  on public.startup_team_members for delete
  using (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.user_id = public.app_user_id()
    )
  );

-- ──────────────────────────────────────────────────────────────────────────
-- 2. investor_team_members
-- ──────────────────────────────────────────────────────────────────────────
--
-- Symmetric to startup_team_members, with two key differences:
--   • No equity_pct_band, no is_full_time, no prior_company/prior_role —
--     those are founder-team signals. For investor teams we care about
--     decision authority and named bio.
--   • `is_decision_maker` flag — founders care about who they'd actually
--     pitch. The role text holds the title (GP, Partner, Principal,
--     Associate, Scout); the boolean answers the practical question.

create table if not exists public.investor_team_members (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.investors(id) on delete cascade,

  name text not null check (length(name) between 2 and 120),
  role text not null check (length(role) between 2 and 80),

  is_decision_maker boolean not null default false,

  bio text check (bio is null or length(bio) <= 600),

  linkedin_url text check (linkedin_url is null or length(linkedin_url) <= 500),

  linked_user_id uuid references public.users(id) on delete set null,

  display_order int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists investor_team_members_set_updated_at on public.investor_team_members;
create trigger investor_team_members_set_updated_at
  before update on public.investor_team_members
  for each row execute function public.set_updated_at();

create index if not exists investor_team_members_investor_idx
  on public.investor_team_members (investor_id, display_order, created_at);

create index if not exists investor_team_members_linked_user_idx
  on public.investor_team_members (linked_user_id)
  where linked_user_id is not null;

create unique index if not exists investor_team_members_one_link_per_investor
  on public.investor_team_members (investor_id, linked_user_id)
  where linked_user_id is not null;

alter table public.investor_team_members enable row level security;

drop policy if exists "investor_team_members select all" on public.investor_team_members;
create policy "investor_team_members select all"
  on public.investor_team_members for select
  using (true);

drop policy if exists "investor_team_members insert as owner" on public.investor_team_members;
create policy "investor_team_members insert as owner"
  on public.investor_team_members for insert
  with check (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  );

drop policy if exists "investor_team_members update as owner" on public.investor_team_members;
create policy "investor_team_members update as owner"
  on public.investor_team_members for update
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

drop policy if exists "investor_team_members delete as owner" on public.investor_team_members;
create policy "investor_team_members delete as owner"
  on public.investor_team_members for delete
  using (
    exists (
      select 1 from public.investors i
      where i.id = investor_id and i.user_id = public.app_user_id()
    )
  );
