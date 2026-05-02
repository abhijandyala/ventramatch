-- Phase 14a — Quality bot runtime: new columns on applications.
-- Append-only: never edit this file once committed. Add a new migration to fix.
--
-- Adds:
--   1. applications.ruleset_version  — records which ruleset version produced the
--      current bot_recommendation, so reviewers can trace exactly which rules ran.
--   2. applications.last_bot_review_at — timestamp of the most recent bot review pass
--      for this application (updated on every resubmission that triggers a bot pass).
--   3. applications_bot_rec_status_idx — partial index that drives the admin reviewer
--      queue page: submitted/under_review applications ordered by bot recommendation
--      so reviewers can triage declines/flags before accepts.
--
-- Design notes:
--   • No new enum values, no new enums.
--   • Does not weaken applications_terminal_requires_human.
--   • These columns are written only by the bot (reviewer_kind = 'rules').
--     Humans read them as advisory context; they are not user-facing.
--   • RLS: applications table already has service-all write policies; no new
--     policies are needed for these columns.

alter table public.applications
  add column if not exists ruleset_version text;

alter table public.applications
  add column if not exists last_bot_review_at timestamptz;

-- Index for admin reviewer queue: triage submitted/under_review applications
-- ordered by bot recommendation (declines/flags surface first) and submission
-- time. Matches the existing applications_under_review_idx pattern in 0005.
create index if not exists applications_bot_rec_status_idx
  on public.applications (status, bot_recommendation, submitted_at desc)
  where status in ('submitted', 'under_review');
