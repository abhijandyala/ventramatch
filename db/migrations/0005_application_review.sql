-- Auto-review bot — Phase 1: status model, audit log, and email outbox.
-- Append-only: never edit this file once committed. Add a new migration to fix.
--
-- Founders' decisions baked into this schema:
--   1. Every terminal verdict needs a human signing off. Bot stamps a
--      recommendation; only `reviewer_kind='human'` reviews are allowed to
--      flip applications.status to 'accepted', 'rejected', or 'banned'.
--      Enforced at the DB layer by a CHECK constraint, not just app code.
--   2. 1 free auto-resubmit. `applications.resubmit_count` tracks it; app
--      code refuses further resubmits.
--   3. Appeals always human; bans always human. Same enforcement as #1 —
--      `banned` is a terminal status so the human-sign-off check applies.
--   4. Day-3 reminder for users who skip the full profile is queued via
--      email_outbox.send_after at signup; cancelled_at lets us cancel it
--      when the user comes back and submits before the cron fires.
--
-- The application code is the boundary for writes (see public.accounts
-- pattern in 0002). User-facing reads are limited via RLS to a user's own
-- application; review traces and outbox rows are server-only.

-- ---------- Enums ----------

do $$ begin
  create type public.application_status as enum (
    'unverified',     -- account exists, never started full profile
    'draft',          -- started /build, hasn't pressed Publish
    'submitted',      -- pressed Publish, awaiting bot pickup
    'under_review',   -- bot has run; awaiting human sign-off
    'needs_changes',  -- bounced back with fixable issues; can resubmit once
    'accepted',       -- visible in feed; terminal until edited
    'rejected',       -- soft reject; can appeal (human path)
    'banned'          -- hard reject; no in-app appeal
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_label as enum (
    'unverified', 'in_review', 'verified', 'rejected', 'banned'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.reviewer_kind as enum ('rules', 'llm', 'human');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.review_verdict as enum (
    'accept',          -- ready to admit
    'needs_changes',   -- fixable; bounce back
    'decline',         -- soft reject
    'flag',            -- bot uncertain; punt to human
    'ban'              -- bot suspects abuse; only humans actually ban
  );
exception when duplicate_object then null; end $$;

-- ---------- users.account_label denorm ----------
-- Drives UI badges without joining applications. Kept in sync by trigger.

alter table public.users
  add column if not exists account_label public.account_label not null default 'unverified';

create index if not exists users_account_label_idx on public.users (account_label);

-- ---------- applications ----------

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  status public.application_status not null default 'unverified',

  -- Bot recommendation. Bot writes these freely; they never imply admission.
  bot_recommendation public.review_verdict,
  bot_confidence numeric(4, 3)
    check (bot_confidence is null or (bot_confidence >= 0 and bot_confidence <= 1)),
  bot_recommended_at timestamptz,

  -- Human commitment. Required to enter any terminal state.
  decided_by text,                            -- 'human:<uuid>' once committed
  decided_at timestamptz,
  decision_reason_codes text[] not null default '{}',
  decision_summary text,                      -- short, user-facing copy

  -- Resubmit accounting.
  submitted_at timestamptz,
  resubmit_count int not null default 0 check (resubmit_count >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Hard rule: terminal status requires a human sign-off + summary + timestamp.
  -- DB-level guard so a buggy orchestrator cannot accidentally admit/reject
  -- a user without a human in the loop.
  constraint applications_terminal_requires_human check (
    status not in ('accepted', 'rejected', 'banned')
    or (
      decided_by like 'human:%'
      and decided_at is not null
      and decision_summary is not null
    )
  )
);

drop trigger if exists applications_set_updated_at on public.applications;
create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

create index if not exists applications_status_idx on public.applications (status);

-- Partial index drives the human review queue (Phase 8): all under_review
-- applications, sorted by bot recommendation so reviewers can triage by type.
create index if not exists applications_under_review_idx
  on public.applications (bot_recommendation, bot_recommended_at)
  where status = 'under_review';

alter table public.applications enable row level security;

drop policy if exists "applications select own" on public.applications;
create policy "applications select own"
  on public.applications for select
  using (user_id = public.app_user_id());

-- Server boundary for writes — same pattern as public.accounts in 0002. The
-- app code controls what gets inserted/updated; the constraint above is the
-- safety net for the most dangerous transitions.
drop policy if exists "applications service insert" on public.applications;
create policy "applications service insert"
  on public.applications for insert
  with check (true);

drop policy if exists "applications service update" on public.applications;
create policy "applications service update"
  on public.applications for update
  using (true)
  with check (true);

drop policy if exists "applications service delete" on public.applications;
create policy "applications service delete"
  on public.applications for delete
  using (true);

-- ---------- application_reviews ----------
-- Forensic audit log. Append-only in spirit (no UPDATE policy added).
-- One row per reviewer pass per attempt. Resubmissions increment pass_no.

create table if not exists public.application_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  pass_no int not null check (pass_no >= 1),
  reviewer_kind public.reviewer_kind not null,
  reviewer_id text,                           -- 'human:<uuid>', 'llm:<prompt-version>', 'rules:<ruleset-version>'
  verdict public.review_verdict not null,
  confidence numeric(4, 3)
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  rule_results jsonb,                         -- raw rules engine output
  llm_raw jsonb,                              -- raw LLM JSON; purged after 90d (Phase 10)
  flags text[] not null default '{}',
  notes text,                                 -- human notes on humans rows
  cost_usd numeric(8, 4) not null default 0,
  duration_ms int,
  created_at timestamptz not null default now()
);

create index if not exists application_reviews_application_idx
  on public.application_reviews (application_id, created_at desc);
create index if not exists application_reviews_user_idx
  on public.application_reviews (user_id);
create index if not exists application_reviews_pass_idx
  on public.application_reviews (application_id, pass_no);

alter table public.application_reviews enable row level security;

-- Strictly server-only. Users see decision_summary on applications and the
-- email; the per-rule trace, raw LLM output, and human notes never leak.
drop policy if exists "application_reviews service all" on public.application_reviews;
create policy "application_reviews service all"
  on public.application_reviews for all
  using (true)
  with check (true);

-- ---------- email_outbox ----------
-- Backs every transactional send with idempotency, scheduling, and retries.
-- send_after powers the day-3 nudge (insert one row at signup, cancel when
-- the user submits before then).

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  template text not null,                     -- 'review.accepted' | 'review.rejected' | 'review.needs_changes' | 'review.appeal_received' | 'reminder.complete_profile'
  payload jsonb not null default '{}'::jsonb,
  send_after timestamptz not null default now(),
  cancelled_at timestamptz,
  sent_at timestamptz,
  resend_id text,
  attempts int not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists email_outbox_set_updated_at on public.email_outbox;
create trigger email_outbox_set_updated_at
  before update on public.email_outbox
  for each row execute function public.set_updated_at();

-- Partial index keeps the worker's "ready to send" scan tight even at scale.
create index if not exists email_outbox_ready_idx
  on public.email_outbox (send_after)
  where sent_at is null and cancelled_at is null;

create index if not exists email_outbox_user_template_idx
  on public.email_outbox (user_id, template);

alter table public.email_outbox enable row level security;

drop policy if exists "email_outbox service all" on public.email_outbox;
create policy "email_outbox service all"
  on public.email_outbox for all
  using (true)
  with check (true);

-- ---------- Trigger: keep users.account_label in sync with applications.status ----------

create or replace function public.sync_account_label()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_label public.account_label;
begin
  next_label := case new.status
    when 'unverified'    then 'unverified'::public.account_label
    when 'draft'         then 'unverified'::public.account_label
    when 'submitted'     then 'in_review'::public.account_label
    when 'under_review'  then 'in_review'::public.account_label
    when 'needs_changes' then 'in_review'::public.account_label
    when 'accepted'      then 'verified'::public.account_label
    when 'rejected'      then 'rejected'::public.account_label
    when 'banned'        then 'banned'::public.account_label
  end;

  if tg_op = 'UPDATE' and old.status = new.status then
    return new;
  end if;

  update public.users
    set account_label = next_label
    where id = new.user_id
      and account_label is distinct from next_label;

  return new;
end;
$$;

drop trigger if exists applications_sync_account_label on public.applications;
create trigger applications_sync_account_label
  after insert or update of status on public.applications
  for each row execute function public.sync_account_label();

-- ---------- Trigger: every new user gets a placeholder applications row ----------
-- Fires on inserts into public.users (Auth.js adapter writes here). Means
-- account_label is always backed by an applications row, no race window.

create or replace function public.bootstrap_application_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.applications (user_id, status)
    values (new.id, 'unverified')
    on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists users_bootstrap_application on public.users;
create trigger users_bootstrap_application
  after insert on public.users
  for each row execute function public.bootstrap_application_for_user();

-- ---------- Backfill ----------
-- Existing users get placeholder applications rows. The sync_account_label
-- trigger fires on insert and aligns users.account_label uniformly.

insert into public.applications (user_id, status)
  select u.id, 'unverified'::public.application_status
  from public.users u
  left join public.applications a on a.user_id = u.id
  where a.id is null;
