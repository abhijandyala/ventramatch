-- Fix for 0037_phase14d_feed_impressions.sql partial migration.
-- Append-only: never edit this file once committed. Add a new migration to fix.
--
-- Migration 0037 created the feed_impressions table and first two indexes
-- successfully, but aborted on the ranker_surface partial index because
-- PostgreSQL requires index predicates to use only IMMUTABLE functions, and
-- now() is STABLE (not IMMUTABLE). This migration completes what 0037 started:
--
--   1. ranker_surface index — recreated WITHOUT the now() predicate.
--      The WHERE clause was a size optimisation for recent rows only; removing
--      it makes the index cover all rows, which is safe and correct.
--   2. render_dedup partial unique index — was not reached before the abort.
--   3. Row-level security — was not reached before the abort.
--
-- All three operations use IF NOT EXISTS / IF NOT ALREADY ENABLED guards so
-- re-running this migration is safe.

-- 1. Ranker/surface index without the problematic now() predicate.
create index if not exists feed_impressions_ranker_surface_idx
  on public.feed_impressions (ranker, surface, shown_at desc);

-- 2. Deduplication guard: prevent the same candidate appearing twice in one
-- render session. Partial unique index — only rows with a non-null
-- render_session_id are deduplicated (IS NOT NULL is immutable).
create unique index if not exists feed_impressions_render_dedup_idx
  on public.feed_impressions (actor_user_id, target_user_id, render_session_id)
  where render_session_id is not null;

-- 3. Enable row-level security.
-- Service-role / admin-only. No user-facing read policy is added.
alter table public.feed_impressions enable row level security;
