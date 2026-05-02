-- Phase 14d — Feed impression logging.
-- Append-only: never edit this file once committed. Add a new migration to fix.
--
-- Adds public.feed_impressions to record every candidate that appears in a
-- server-rendered feed response.  Used post-launch to:
--   1. Compute precision@K and NDCG against scoreMatch and future rankers.
--   2. Attribute interactions (like/pass/save) to the ranked position at which
--      the candidate appeared — joins to public.interactions on
--      (actor_user_id, target_user_id) with a shown_at ≤ created_at window.
--   3. Enable A/B testing: compare interaction rates between cohorts that saw
--      different rankers.
--
-- Design decisions:
--   • Separate table from interactions / profile_views, following the pattern
--     established in migration 0010: "Volume: views are 1-2 orders of magnitude
--     higher than interactions. Separate table = separate retention policy."
--   • No foreign key from interactions → feed_impressions. The join is done
--     analytically post-hoc; tight coupling would complicate the schema.
--   • RLS: service-role / admin-only. Users do not read their own impressions.
--   • No enums for ranker or experiment_cohort — free-text so new ranker
--     variants don't require enum migrations.
--   • No partitioning in Phase 14d. Add if volume justifies it later.
--   • Retention: no automated deletion in Phase 14d. Plan a cron for rows
--     older than 90 days once the team decides on the policy.

create table if not exists public.feed_impressions (
  id                uuid        primary key default gen_random_uuid(),
  -- Who saw the feed (the viewer / actor)
  actor_user_id     uuid        not null references public.users(id) on delete cascade,
  -- Which counterparty appeared as a candidate
  target_user_id    uuid        not null references public.users(id) on delete cascade,
  -- 1-indexed rank position in the rendered list (1 = top of feed).
  -- Essential for precision@K and position-bias correction.
  feed_position     int         not null check (feed_position >= 1),
  -- Score emitted by the ranker (0–100 for scoreMatch; null if not available).
  -- Stored so we can validate score distribution and detect score drift.
  score             int,
  -- Which ranker produced this impression.  Documented vocabulary:
  --   'scorematch'          — current production heuristic (Phase 14d default)
  --   'scorematch+elig'     — scoreMatch with eligibility pre-filter (future)
  --   'learning_model_v1'   — Phase 15 LogReg expected_label ranker
  --   'personalized_v1'     — Phase 16+ personalization on top of global model
  ranker            text        not null,
  -- A/B cohort attribution.  Null when no experiment is running.
  -- Example values: 'control', 'treatment_a', 'treatment_b'.
  -- Populated in Phase 15 when the learning model A/B test starts.
  experiment_cohort text,
  -- Which UI surface rendered this feed.
  --   'feed_main'               — /feed full page
  --   'dashboard_recommended'   — dashboard "Recommended for you" rail (limit:3)
  surface           text        not null,
  -- Snapshot of active filters/search/sort at time of impression.
  -- Stored as JSONB so new filter fields don't require a column migration.
  -- Null when no filters were active or when the surface has no filters.
  filter_context    jsonb,
  -- UUID shared by all impressions from a single render call.
  -- Lets us reconstruct "what N candidates did this user see in this one request?"
  -- Null for legacy rows before this column was added.
  render_session_id uuid,
  shown_at          timestamptz not null default now()
);

-- Primary query patterns:
--   "What did actor X see in the last 7 days?"
create index if not exists feed_impressions_actor_recent_idx
  on public.feed_impressions (actor_user_id, shown_at desc);

--   "Who saw target Y in the last 7 days?"
create index if not exists feed_impressions_target_recent_idx
  on public.feed_impressions (target_user_id, shown_at desc);

--   "Compare like-rates across rankers in the last 30 days" (for A/B analysis)
create index if not exists feed_impressions_ranker_surface_idx
  on public.feed_impressions (ranker, surface, shown_at desc)
  where shown_at > now() - interval '90 days';

-- Deduplication guard: prevent the same candidate from appearing twice in
-- the same render session. Uses a partial unique index (only where
-- render_session_id IS NOT NULL) because NULL in unique indexes is distinct
-- in Postgres — rows with NULL render_session_id are not deduplicated,
-- which is the correct behaviour for any legacy rows inserted without one.
create unique index if not exists feed_impressions_render_dedup_idx
  on public.feed_impressions (actor_user_id, target_user_id, render_session_id)
  where render_session_id is not null;

alter table public.feed_impressions enable row level security;

-- Service-role / admin-only.  No user-facing read policy is added here.
-- Users cannot query their own feed_impressions rows.  If a "history of what
-- I was shown" feature is needed in the future, add a select policy then.
-- Write policy: service role (via withUserRls(null, ...)) can insert freely.
-- No explicit policy needed beyond the blanket service-role bypass that
-- other analytics tables (application_reviews, admin_actions) also rely on.
