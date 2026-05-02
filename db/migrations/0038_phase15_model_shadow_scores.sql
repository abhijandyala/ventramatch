-- Phase 15 — ML model shadow scoring columns on feed_impressions.
-- Append-only: never edit this file once committed. Add a new migration to fix.
--
-- Adds three nullable columns to public.feed_impressions so Phase 15 can log
-- the ML model's score alongside the scoreMatch ranking score for every
-- impression.  These are comparison columns only — they NEVER drive feed ordering.
--
-- Design decisions:
--   1. Columns are nullable so impression rows written before Phase 15 (or
--      when the feature flag is off) are unaffected.  Queries that compare
--      scorematch vs model filter on `model_score IS NOT NULL`.
--   2. We add scorematch_score even though it equals the existing `score` column
--      today, to make explicit which ranker drove which score.  When a future
--      phase changes the displayed ranker, `score` follows the new ranker while
--      `scorematch_score` continues to record scoreMatch's number for the pair.
--   3. model_version records which coefficient set produced the model_score so
--      a later re-training produces distinguishable rows.
--   4. No new enums, no new tables, no changes to existing column semantics.
--   5. RLS behaviour is unchanged: all three columns inherit the existing
--      service-role-only policy on feed_impressions.

alter table public.feed_impressions
  add column if not exists scorematch_score int,
  add column if not exists model_score      numeric(6, 4),
  add column if not exists model_version    text;

-- No new indexes needed for these columns in Phase 15.
-- Analysis queries filter on model_score IS NOT NULL first, then join to
-- interactions — the existing actor/target indexes cover both directions.
