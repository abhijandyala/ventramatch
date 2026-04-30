-- Sprint 12.C — Performance indexes for hot read paths.
--
-- Added after reading every query in lib/feed/query.ts, lib/intros/query.ts,
-- lib/profile/views.ts, and the admin views. These cover the most common
-- sequential scans that would degrade at scale.

-- Feed queries filter by account_label + paused + deletion. Composite
-- partial index lets Postgres skip non-verified users without scanning.
create index if not exists users_verified_active_idx
  on public.users (id)
  where account_label = 'verified'
    and account_paused_at is null
    and deletion_requested_at is null;

-- Notifications: unread count is queried on every page load (bell badge).
-- The partial index on (user_id) WHERE read_at IS NULL is already in 0022;
-- add a covering index for the count-only path.
create index if not exists notifications_user_unread_count_idx
  on public.notifications (user_id)
  where read_at is null and dismissed_at is null;

-- Intro badge counts: filter by pending + participant.
create index if not exists intro_requests_pending_participant_idx
  on public.intro_requests (sender_user_id, recipient_user_id)
  where status = 'pending';

-- Profile views: the 24h debounce check queries (viewer, target, viewed_at desc).
-- The existing index from 0010 covers (viewer, target, viewed_at desc)
-- which is sufficient. No additional partial index needed (now() is
-- not stable enough for a WHERE predicate).

-- Blocks: symmetric check happens on every feed row, match row, intro
-- row, and profile view. Two partial indexes for the two directions.
create index if not exists blocks_pair_a_idx
  on public.blocks (blocker_user_id, blocked_user_id);
create index if not exists blocks_pair_b_idx
  on public.blocks (blocked_user_id, blocker_user_id);

-- Email outbox: the email worker scans for unsent rows.
create index if not exists email_outbox_pending_idx
  on public.email_outbox (send_after, created_at)
  where sent_at is null and cancelled_at is null;

-- Enable pg_stat_statements if available (Railway has it by default).
-- This is a no-op if already enabled; errors are swallowed.
do $$
begin
  execute 'create extension if not exists pg_stat_statements';
exception when others then
  raise notice 'pg_stat_statements not available — skipping';
end $$;
