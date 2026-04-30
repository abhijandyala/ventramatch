-- Sprint 10.B — In-app notifications.
--
-- A lightweight notification system. The existing email_outbox still
-- handles transactional emails; this table powers the in-app bell badge
-- and the /notifications page. Both surfaces query the same table.
--
-- Existing triggers (match.created in 0007, intro.* in 0008) will be
-- extended to also insert a notification row alongside the email_outbox
-- row. We do that in a new helper function to keep the pattern DRY.

do $$ begin
  create type public.notification_kind as enum (
    'match.created',
    'intro.requested',
    'intro.accepted',
    'intro.declined',
    'intro.withdrawn',
    'verification.confirmed',
    'system.announcement'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind public.notification_kind not null,
  payload jsonb not null default '{}'::jsonb,
  link text,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create index if not exists notifications_user_all_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications select own" on public.notifications;
create policy "notifications select own"
  on public.notifications for select
  using (public.app_user_id() = user_id);

drop policy if exists "notifications update own" on public.notifications;
create policy "notifications update own"
  on public.notifications for update
  using (public.app_user_id() = user_id)
  with check (public.app_user_id() = user_id);

-- Helper function for inserting notifications from triggers or app code.
-- Keeps the insert pattern DRY.
create or replace function public.create_notification(
  p_user_id uuid,
  p_kind text,
  p_payload jsonb,
  p_link text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nid uuid;
begin
  insert into public.notifications (user_id, kind, payload, link)
  values (p_user_id, p_kind::public.notification_kind, p_payload, p_link)
  returning id into nid;
  return nid;
end;
$$;

-- Wire into existing match trigger: add notification alongside email.
create or replace function public.enqueue_match_emails()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  founder_email text;
  investor_email text;
  founder_name text;
  investor_name text;
  startup_name text;
  firm_name text;
begin
  select u.email, u.name into founder_email, founder_name
    from public.users u where u.id = new.founder_user_id;
  select u.email, u.name into investor_email, investor_name
    from public.users u where u.id = new.investor_user_id;

  select s.name into startup_name
    from public.startups s where s.user_id = new.founder_user_id;
  select coalesce(i.firm, i.name) into firm_name
    from public.investors i where i.user_id = new.investor_user_id;

  -- Notification for founder
  perform public.create_notification(
    new.founder_user_id, 'match.created',
    jsonb_build_object('matchId', new.id, 'counterpartyLabel', firm_name),
    '/matches'
  );
  -- Notification for investor
  perform public.create_notification(
    new.investor_user_id, 'match.created',
    jsonb_build_object('matchId', new.id, 'counterpartyLabel', startup_name),
    '/matches'
  );

  -- Email (honors notification_prefs via should_send_email)
  if founder_email is not null
     and public.should_send_email(new.founder_user_id, 'match.created') then
    insert into public.email_outbox (user_id, template, payload)
    values (
      new.founder_user_id, 'match.created',
      jsonb_build_object(
        'matchId', new.id, 'recipientName', founder_name,
        'recipientRole', 'founder', 'counterpartyLabel', firm_name,
        'startupName', startup_name
      )
    );
  end if;

  if investor_email is not null
     and public.should_send_email(new.investor_user_id, 'match.created') then
    insert into public.email_outbox (user_id, template, payload)
    values (
      new.investor_user_id, 'match.created',
      jsonb_build_object(
        'matchId', new.id, 'recipientName', investor_name,
        'recipientRole', 'investor', 'counterpartyLabel', startup_name,
        'firmName', firm_name
      )
    );
  end if;

  return new;
end;
$$;

-- Wire into intro trigger: add notification alongside email.
create or replace function public.intro_requests_enqueue_emails()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  recipient_name text;
  template_name text;
begin
  select name into sender_name from public.users where id = new.sender_user_id;
  select name into recipient_name from public.users where id = new.recipient_user_id;

  if (tg_op = 'INSERT') then
    -- Notification for recipient
    perform public.create_notification(
      new.recipient_user_id, 'intro.requested',
      jsonb_build_object('introId', new.id, 'senderName', sender_name),
      '/inbox/' || new.id
    );
    -- Email
    if public.should_send_email(new.recipient_user_id, 'intro.requested') then
      insert into public.email_outbox (user_id, template, payload)
      values (
        new.recipient_user_id, 'intro.requested',
        jsonb_build_object(
          'introId', new.id, 'matchId', new.match_id,
          'recipientName', recipient_name, 'senderName', sender_name,
          'message', new.message, 'proposedTimes', new.proposed_times,
          'linkUrl', new.link_url, 'expiresAt', new.expires_at
        )
      );
    end if;
    return new;
  end if;

  if (tg_op = 'UPDATE' and old.status = 'pending' and new.status <> 'pending') then
    template_name := 'intro.' || new.status::text;
    -- Notification for sender (their request got a response)
    perform public.create_notification(
      new.sender_user_id, template_name,
      jsonb_build_object('introId', new.id, 'recipientName', recipient_name, 'status', new.status),
      '/inbox/' || new.id
    );
    -- Email
    if public.should_send_email(new.sender_user_id, template_name) then
      insert into public.email_outbox (user_id, template, payload)
      values (
        new.sender_user_id, template_name,
        jsonb_build_object(
          'introId', new.id, 'matchId', new.match_id,
          'senderName', sender_name, 'recipientName', recipient_name,
          'status', new.status, 'acceptedTime', new.accepted_time,
          'responseMessage', new.response_message
        )
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;
