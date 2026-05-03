-- Phase 16 — Seed feature flag for ML feed ranking.
-- Append-only: never edit this file once committed. Add a new migration to fix.
--
-- Creates the 'feed_ml_ranking' flag row so admins can enable ML ranking
-- without a code deploy.  The flag defaults to disabled (false) so no user
-- sees any behaviour change until the team intentionally enables it for a
-- targeted cohort.
--
-- Design decisions:
--   1. No schema change.  feature_flags already has the right columns.
--   2. Idempotent: ON CONFLICT DO NOTHING means re-running this migration
--      is safe and does not overwrite any admin-set enabled/target_user_ids.
--   3. target_user_ids left null (not set here) — the admin row or a follow-up
--      UPDATE sets specific test users before enabling globally.
--   4. enabled = false: Phase 16 ships this flag disabled everywhere.
--   5. A second flag, 'feed_model_shadow_scoring', was seeded in Phase 15 and
--      controls shadow logging independently.  They are orthogonal:
--        feed_model_shadow_scoring=on, feed_ml_ranking=off  → Phase 15 behaviour
--        feed_ml_ranking=on                                  → Phase 16 behaviour
--        both on                                             → Phase 16 + Phase 15 logging
--
-- To enable for specific users without re-deploying:
--   update public.feature_flags
--   set target_user_ids = array['<uuid1>', '<uuid2>']
--   where name = 'feed_ml_ranking';
--
-- To enable globally (after validation passes):
--   update public.feature_flags set enabled = true, target_user_ids = null
--   where name = 'feed_ml_ranking';

insert into public.feature_flags (name, enabled, description)
values (
  'feed_ml_ranking',
  false,
  'Phase 16: use Phase 11c LogReg model as primary feed ranker. scoreMatch remains fallback. Ineligible candidates sorted after eligible ML-ranked candidates. Not investment advice.'
)
on conflict (name) do nothing;
