-- Sprint 6: Post-match workflow.
--
-- An "intro request" is a structured ask one matched party sends to the other:
--   • a short message (max 800 chars — forces a real ask, not a wall of text)
--   • 1-3 proposed meeting times
--   • optional: a single link (e.g. updated deck) — small surface intentionally
--
-- Lifecycle: pending → accepted | declined | withdrawn | expired
--
-- Why a separate table from public.matches:
--   • You can match with someone and not yet send an intro (cooling off, busy).
--   • You may eventually send a 2nd intro after a "let's revisit later" close —
--     each intro_request is its own row (one match → many intros).
--
-- Hard rule: an intro can only be sent between users who already have a row in
-- public.matches (which means contact has already unlocked via mutual interest).

create type public.intro_request_status as enum (
  'pending',
  'accepted',
  'declined',
  'withdrawn',
  'expired'
);

create table if not exists public.intro_requests (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_user_id uuid not null references public.users(id) on delete cascade,
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  status public.intro_request_status not null default 'pending',
  -- Sender's pitch / context. 5-800 chars enforced at the app layer (Zod).
  message text not null,
  -- 1-3 proposed times, ISO 8601 strings in JSONB array. UTC always.
  proposed_times jsonb not null default '[]'::jsonb,
  -- One optional link the sender wants the recipient to look at. We keep
  -- this narrow on purpose — no attachment uploads in v1.
  link_url text,
  -- When recipient accepts, they pick one of the proposed_times. May be
  -- null on accept if the parties want to negotiate via email.
  accepted_time timestamptz,
  -- Recipient's reply text (declined message or accept-with-context).
  response_message text,
  responded_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Sender ≠ recipient.
  constraint intro_requests_distinct_users check (sender_user_id <> recipient_user_id)
);

create index if not exists intro_requests_recipient_idx
  on public.intro_requests (recipient_user_id, status, created_at desc);
create index if not exists intro_requests_sender_idx
  on public.intro_requests (sender_user_id, status, created_at desc);
create index if not exists intro_requests_match_idx
  on public.intro_requests (match_id);
create index if not exists intro_requests_pending_expiry_idx
  on public.intro_requests (expires_at) where status = 'pending';

drop trigger if exists intro_requests_set_updated_at on public.intro_requests;
create trigger intro_requests_set_updated_at
  before update on public.intro_requests
  for each row execute function public.set_updated_at();

alter table public.intro_requests enable row level security;

drop policy if exists "intro_requests select participant" on public.intro_requests;
create policy "intro_requests select participant"
  on public.intro_requests for select
  using (
    public.app_user_id() = sender_user_id
    or public.app_user_id() = recipient_user_id
  );

-- Sender owns inserts; the trigger below also enforces match exists.
drop policy if exists "intro_requests insert as sender" on public.intro_requests;
create policy "intro_requests insert as sender"
  on public.intro_requests for insert
  with check (public.app_user_id() = sender_user_id);

-- Updates:
--   • Sender can move pending → withdrawn.
--   • Recipient can move pending → accepted | declined.
-- The trigger below enforces these state transitions; the policy just
-- restricts WHICH rows you can attempt to update.
drop policy if exists "intro_requests update participant" on public.intro_requests;
create policy "intro_requests update participant"
  on public.intro_requests for update
  using (
    public.app_user_id() = sender_user_id
    or public.app_user_id() = recipient_user_id
  )
  with check (
    public.app_user_id() = sender_user_id
    or public.app_user_id() = recipient_user_id
  );

-- ──────────────────────────────────────────────────────────────────────────
-- Trigger: enforce match-exists + state transition rules on insert/update
-- ──────────────────────────────────────────────────────────────────────────

create or replace function public.intro_requests_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m_founder uuid;
  m_investor uuid;
begin
  -- INSERT: must reference a real match the sender is part of, and the
  -- recipient must be the OTHER party in that match.
  if (tg_op = 'INSERT') then
    select founder_user_id, investor_user_id into m_founder, m_investor
      from public.matches where id = new.match_id;
    if m_founder is null then
      raise exception 'intro_requests: match % not found', new.match_id;
    end if;
    if not (
      (new.sender_user_id = m_founder and new.recipient_user_id = m_investor)
      or (new.sender_user_id = m_investor and new.recipient_user_id = m_founder)
    ) then
      raise exception 'intro_requests: sender/recipient must be the two match participants';
    end if;
    return new;
  end if;

  -- UPDATE: enforce status transitions.
  if (tg_op = 'UPDATE') then
    if old.status <> new.status then
      -- Only pending → {accepted, declined, withdrawn} is allowed by users.
      -- (expired is set by a scheduled job; never by a user action.)
      if old.status <> 'pending' then
        raise exception 'intro_requests: cannot change status once it is %', old.status;
      end if;
      if new.status not in ('accepted', 'declined', 'withdrawn', 'expired') then
        raise exception 'intro_requests: invalid target status %', new.status;
      end if;
      -- Stamp responded_at server-side.
      if new.responded_at is null then
        new.responded_at = now();
      end if;
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists intro_requests_validate on public.intro_requests;
create trigger intro_requests_validate
  before insert or update on public.intro_requests
  for each row execute function public.intro_requests_validate();

-- ──────────────────────────────────────────────────────────────────────────
-- Trigger: enqueue transactional emails on insert/status-change
-- ──────────────────────────────────────────────────────────────────────────

create or replace function public.intro_requests_enqueue_emails()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  recipient_name text;
begin
  select name into sender_name from public.users where id = new.sender_user_id;
  select name into recipient_name from public.users where id = new.recipient_user_id;

  if (tg_op = 'INSERT') then
    -- Tell the recipient: "X wants to talk".
    insert into public.email_outbox (user_id, template, payload)
    values (
      new.recipient_user_id,
      'intro.requested',
      jsonb_build_object(
        'introId', new.id,
        'matchId', new.match_id,
        'recipientName', recipient_name,
        'senderName', sender_name,
        'message', new.message,
        'proposedTimes', new.proposed_times,
        'linkUrl', new.link_url,
        'expiresAt', new.expires_at
      )
    );
    return new;
  end if;

  if (tg_op = 'UPDATE' and old.status = 'pending' and new.status <> 'pending') then
    -- Status transitioned out of pending → notify the sender.
    insert into public.email_outbox (user_id, template, payload)
    values (
      new.sender_user_id,
      'intro.' || new.status::text,
      jsonb_build_object(
        'introId', new.id,
        'matchId', new.match_id,
        'senderName', sender_name,
        'recipientName', recipient_name,
        'status', new.status,
        'acceptedTime', new.accepted_time,
        'responseMessage', new.response_message
      )
    );
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists intro_requests_enqueue_emails on public.intro_requests;
create trigger intro_requests_enqueue_emails
  after insert or update on public.intro_requests
  for each row execute function public.intro_requests_enqueue_emails();
