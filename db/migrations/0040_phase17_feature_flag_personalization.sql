-- Phase 17 — Seed feature flag for behavior-based personalization.
-- Append-only: never edit this file once committed. Add a new migration to fix.
--
-- Creates the 'feed_personalization' flag row so admins can enable personalization
-- without a code deploy.  The flag defaults to disabled (false).
--
-- Design decisions:
--   1. No schema change.  feature_flags already has the right columns.
--   2. Idempotent: ON CONFLICT DO NOTHING means re-running is safe.
--   3. This flag requires feed_ml_ranking=on.  If feed_ml_ranking is off,
--      the application ignores feed_personalization regardless of its value.
--   4. Personalization only re-orders Bucket A (eligible + model-scored).
--      Ineligible candidates remain after eligible candidates unconditionally.
--   5. Rollout plan: set target_user_ids before enabling globally.
--
-- To enable for specific users:
--   update public.feature_flags
--   set target_user_ids = array['<uuid1>', '<uuid2>']
--   where name = 'feed_personalization';
--
-- Flag hierarchy (all default off):
--   feed_impression_logging   → Phase 14d: log impressions
--   feed_model_shadow_scoring → Phase 15: log model scores alongside scoreMatch
--   feed_ml_ranking           → Phase 16: ML model ranks the feed
--   feed_personalization      → Phase 17: blend user behavior into Bucket A order

insert into public.feature_flags (name, enabled, description)
values (
  'feed_personalization',
  false,
  'Phase 17: apply behavior-based personalization adjustment after ML ranking on Bucket A (eligible + model-scored items). Requires feed_ml_ranking=on. Not investment advice.'
)
on conflict (name) do nothing;
