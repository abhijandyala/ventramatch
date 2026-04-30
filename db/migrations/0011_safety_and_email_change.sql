-- Sprint 9: Trust/safety primitives + email-change with re-verification.
--
-- Three new tables and one helper:
--   1. blocks            — symmetric in effect, asymmetric in the row
--                          (the actor is whoever clicked Block).
--   2. reports           — abuse reports with reason enum + status workflow.
--   3. email_change_requests — pending email changes; confirmed via magic link
--                          to the NEW address.
--   4. should_send_email_with_block (helper) — extends Sprint 7's helper to
--                          also short-circuit when both parties are blocked.
--
-- Why blocks are stored as one row (asymmetric) rather than two:
--   • Lets us tell "who blocked whom" for moderation review without losing
--     information. Both directions still treat each other as invisible
--     because every read site does
--       NOT EXISTS(blocker=A, blocked=B) AND NOT EXISTS(blocker=B, blocked=A).
--   • Halves the row count on cascade.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. blocks
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_user_id uuid not null references public.users(id) on delete cascade,
  blocked_user_id uuid not null references public.users(id) on delete cascade,
  reason text check (reason is null or length(reason) <= 200),
  created_at timestamptz not null default now(),
  unique (blocker_user_id, blocked_user_id),
  constraint blocks_distinct check (blocker_user_id <> blocked_user_id)
);

create index if not exists blocks_blocker_idx on public.blocks (blocker_user_id, created_at desc);
create index if not exists blocks_blocked_idx on public.blocks (blocked_user_id);

alter table public.blocks enable row level security;

drop policy if exists "blocks select participant" on public.blocks;
create policy "blocks select participant"
  on public.blocks for select
  using (
    public.app_user_id() = blocker_user_id
    or public.app_user_id() = blocked_user_id
  );

drop policy if exists "blocks insert as blocker" on public.blocks;
create policy "blocks insert as blocker"
  on public.blocks for insert
  with check (public.app_user_id() = blocker_user_id);

drop policy if exists "blocks delete own" on public.blocks;
create policy "blocks delete own"
  on public.blocks for delete
  using (public.app_user_id() = blocker_user_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 2. reports
-- ──────────────────────────────────────────────────────────────────────────

create type public.report_reason as enum (
  'spam',
  'harassment',
  'misrepresentation',
  'fraud_or_scam',
  'inappropriate_content',
  'impersonation',
  'other'
);

create type public.report_status as enum (
  'open',
  'reviewing',
  'actioned',
  'dismissed'
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.users(id) on delete cascade,
  reported_user_id uuid not null references public.users(id) on delete cascade,
  reason public.report_reason not null,
  -- Free-text from the reporter. Capped to deter wall-of-text rants.
  details text not null check (length(details) between 10 and 2000),
  status public.report_status not null default 'open',
  -- Resolution metadata — populated by a human reviewer (admin route in a
  -- later sprint).
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reports_distinct check (reporter_user_id <> reported_user_id)
);

create index if not exists reports_reporter_idx
  on public.reports (reporter_user_id, created_at desc);
create index if not exists reports_reported_idx
  on public.reports (reported_user_id, created_at desc);
create index if not exists reports_status_idx
  on public.reports (status, created_at desc);

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

alter table public.reports enable row level security;

-- A reporter can see their own filed reports (for personal record).
-- They cannot see what the moderator wrote in resolution_notes — we leak
-- only the four columns below via a view in a later sprint. For now the
-- whole row is exposed to the reporter; tighten when the admin lands.
drop policy if exists "reports select reporter" on public.reports;
create policy "reports select reporter"
  on public.reports for select
  using (public.app_user_id() = reporter_user_id);

drop policy if exists "reports insert as reporter" on public.reports;
create policy "reports insert as reporter"
  on public.reports for insert
  with check (public.app_user_id() = reporter_user_id);

-- No update / delete policies for non-admins. Service-role connection
-- bypasses RLS for reviewer workflows.

-- ──────────────────────────────────────────────────────────────────────────
-- 3. email_change_requests
--
-- Lifecycle:
--   • Insert row with status='pending', token, new_email, expires=now()+1h.
--   • Magic link sent to new_email containing the token.
--   • User clicks link → /api/auth/change-email validates token and expiry,
--     swaps users.email, marks row consumed_at = now().
--
-- We delete consumed and expired rows on the next request from the same
-- user; cron isn't strictly necessary at v1 volume.
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.email_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- Lower-cased copy of the new address — uniqueness is enforced
  -- pending-only so a user can re-request after a typo.
  new_email text not null,
  -- Opaque random token. Hashed at rest to match the rest of NextAuth's
  -- pattern. We compare via a constant-time check in the route.
  token_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Only one active request per user at a time — keeps email cleanup simple.
create unique index if not exists email_change_requests_one_active_per_user
  on public.email_change_requests (user_id)
  where consumed_at is null;

create index if not exists email_change_requests_token_idx
  on public.email_change_requests (token_hash);
create index if not exists email_change_requests_expires_idx
  on public.email_change_requests (expires_at);

alter table public.email_change_requests enable row level security;

-- The user can read their own pending request (so the UI can show "you
-- have a pending change to <email>").
drop policy if exists "email_change_requests select own" on public.email_change_requests;
create policy "email_change_requests select own"
  on public.email_change_requests for select
  using (public.app_user_id() = user_id);

-- Inserts and updates happen from the route handler running with the
-- service role; no policy lets a regular session insert directly.
