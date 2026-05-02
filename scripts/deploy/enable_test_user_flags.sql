-- scripts/deploy/enable_test_user_flags.sql
--
-- Enable Phase 14–17 feature flags for ONE test user only.
--
-- ─── INSTRUCTIONS ────────────────────────────────────────────────────────────
-- 1. Apply migrations 0036–0040 first (apply_phase_14_17_migrations.sh).
-- 2. Find your test user UUID (see query at the bottom of this file).
-- 3. Replace every occurrence of 'YOUR-USER-UUID-HERE' with the real UUID.
-- 4. Run:
--      psql "$DATABASE_URL" -f scripts/deploy/enable_test_user_flags.sql
-- 5. Do NOT remove the target_user_ids restriction.
--    Setting target_user_ids = null enables the flag for ALL users globally.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ⚠  Do not run this file without editing the UUID placeholder first.
--    Searching for the literal string 'YOUR-USER-UUID-HERE' is a good
--    pre-flight check:
--      grep -c 'YOUR-USER-UUID-HERE' scripts/deploy/enable_test_user_flags.sql
--    If the output is > 0, you have not replaced all placeholders.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Step 0: Find your user UUID by email ─────────────────────────────────────
-- Run this first, separately, to find the UUID you need:
--
--   psql "$DATABASE_URL" -c "select id, email, role from public.users where email = 'YOUR_EMAIL_HERE';"
--
-- Then replace 'YOUR-USER-UUID-HERE' below with the returned UUID.


-- ── Step 1: Enable feed flags for the test user ───────────────────────────────
-- Enables impression logging, shadow scoring, ML ranking, and personalization
-- for the test user's session only. No other user is affected.

insert into public.feature_flags (name, enabled, target_user_ids, description)
values
  ('feed_impression_logging',
   true,
   ARRAY['YOUR-USER-UUID-HERE']::uuid[],
   'Phase 14d: log feed impressions — enabled for test user only.'),

  ('feed_model_shadow_scoring',
   true,
   ARRAY['YOUR-USER-UUID-HERE']::uuid[],
   'Phase 15: ML shadow scoring — enabled for test user only.'),

  ('feed_ml_ranking',
   true,
   ARRAY['YOUR-USER-UUID-HERE']::uuid[],
   'Phase 16: ML ranker — enabled for test user only. scoreMatch remains fallback.'),

  ('feed_personalization',
   true,
   ARRAY['YOUR-USER-UUID-HERE']::uuid[],
   'Phase 17: behavior personalization — enabled for test user only. Requires feed_ml_ranking.')

on conflict (name) do update
  set enabled         = true,
      target_user_ids = ARRAY['YOUR-USER-UUID-HERE']::uuid[];


-- ── Step 2: Enable quality_review_bot_writes (separate — profile submission) ──
-- Only run this section when testing profile submission and the bot review queue.
-- This makes the bot run every time the test user submits a profile build form.
--
-- Uncomment and run separately when you are specifically testing:
--   app/build/actions.ts → runBotReviewAndPersist
--   app/build/investor/actions.ts → runBotReviewAndPersist
--   app/admin/reviews/ → admin review queue
--
-- insert into public.feature_flags (name, enabled, target_user_ids, description)
-- values (
--   'quality_review_bot_writes',
--   true,
--   ARRAY['YOUR-USER-UUID-HERE']::uuid[],
--   'Phase 14a: bot quality review on profile submission — enabled for test user only.'
-- )
-- on conflict (name) do update
--   set enabled         = true,
--       target_user_ids = ARRAY['YOUR-USER-UUID-HERE']::uuid[];


-- ── Step 3: Confirm the current flag state ────────────────────────────────────
select
  name,
  enabled,
  target_user_ids,
  description
from public.feature_flags
where name in (
  'quality_review_bot_writes',
  'feed_impression_logging',
  'feed_model_shadow_scoring',
  'feed_ml_ranking',
  'feed_personalization'
)
order by name;


-- ── ROLLBACK: Turn all risky flags OFF globally ───────────────────────────────
-- Run this SQL to revert to the safe default state at any time:
--
-- update public.feature_flags
-- set enabled = false, target_user_ids = null
-- where name in (
--   'quality_review_bot_writes',
--   'feed_impression_logging',
--   'feed_model_shadow_scoring',
--   'feed_ml_ranking',
--   'feed_personalization'
-- );
--
-- Or equivalently via the migration script:
--   ./scripts/deploy/apply_phase_14_17_migrations.sh
-- (re-running is safe — all migrations use IF NOT EXISTS / ON CONFLICT DO NOTHING)
