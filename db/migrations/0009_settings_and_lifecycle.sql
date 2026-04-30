-- Sprint 7: Account settings, notifications, and lifecycle (pause / delete).
--
-- Adds three concepts to public.users:
--   1. notification_prefs (jsonb)  — opt-in/out for each transactional family.
--   2. account_paused_at (timestamptz) — the user voluntarily hid themselves
--      from the discovery feed. Match-state and inbox keep working.
--   3. deletion_requested_at (timestamptz) — soft-delete with a 30-day grace
--      period. The hard-delete is performed by an external cron job
--      (out of scope for this migration). Until then the row is preserved
--      so the user can cancel; for product purposes paused == deletion-pending.
--
-- Plus a small helper: should_send_email(user_id, template) used by the
-- existing match.created and intro.* enqueue triggers so users who opted
-- out actually stop receiving them.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. New columns on users
-- ──────────────────────────────────────────────────────────────────────────

alter table public.users
  add column if not exists notification_prefs jsonb not null default jsonb_build_object(
    'matches',         true,   -- match.created
    'intros',          true,   -- intro.requested / intro.{accepted,declined,withdrawn,expired}
    'reviewUpdates',   true,   -- review.* (Adhvik's worker may already key off this)
    'weeklyDigest',    false,  -- reserved for the digest job
    'productUpdates',  false   -- mirrors marketing_opt_in but isolated for granularity
  ),
  add column if not exists account_paused_at timestamptz,
  add column if not exists deletion_requested_at timestamptz;

-- Backfill: respect users who already opted out of marketing during signup.
update public.users
  set notification_prefs = jsonb_set(notification_prefs, '{productUpdates}', to_jsonb(marketing_opt_in))
  where notification_prefs ->> 'productUpdates' = 'false'
    and marketing_opt_in = true;

-- Indexes for the cron jobs that will eventually scan these.
create index if not exists users_paused_at_idx on public.users (account_paused_at);
create index if not exists users_deletion_requested_at_idx on public.users (deletion_requested_at);

-- ──────────────────────────────────────────────────────────────────────────
-- 2. should_send_email helper
--
--    Returns false when:
--      • the user is missing (defensive)
--      • the user opted out of the matching pref family
--      • the user is in deletion grace (we honour the request immediately by
--        suppressing all transactional mail except the deletion confirmation)
--    Otherwise returns true.
--
--    Mapping from template → pref key is centralised here so the email
--    worker doesn't have to duplicate the logic.
-- ──────────────────────────────────────────────────────────────────────────

create or replace function public.should_send_email(p_user_id uuid, p_template text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  prefs jsonb;
  deletion_at timestamptz;
  pref_key text;
begin
  select notification_prefs, deletion_requested_at
    into prefs, deletion_at
    from public.users
    where id = p_user_id;

  if prefs is null then
    return false;
  end if;

  -- Honour deletion request — block all but the explicit deletion email.
  if deletion_at is not null and p_template <> 'account.deletion_requested' then
    return false;
  end if;

  pref_key := case
    when p_template = 'match.created' then 'matches'
    when p_template like 'intro.%' then 'intros'
    when p_template like 'review.%' then 'reviewUpdates'
    when p_template = 'reminder.complete_profile' then 'reviewUpdates'
    when p_template = 'digest.weekly' then 'weeklyDigest'
    when p_template like 'product.%' then 'productUpdates'
    else null
  end;

  -- Templates that don't map to any preference (e.g. account.* security mail)
  -- always send.
  if pref_key is null then
    return true;
  end if;

  return coalesce((prefs ->> pref_key)::boolean, true);
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Recreate the existing enqueue triggers to honour preferences.
--    Functions are defined in 0007_match_email_enqueue.sql (matches) and
--    0008_intro_requests.sql (intros). We replace the function bodies; the
--    triggers themselves stay attached.
-- ──────────────────────────────────────────────────────────────────────────

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

  if founder_email is not null
     and public.should_send_email(new.founder_user_id, 'match.created') then
    insert into public.email_outbox (user_id, template, payload)
    values (
      new.founder_user_id,
      'match.created',
      jsonb_build_object(
        'matchId', new.id,
        'recipientName', founder_name,
        'recipientRole', 'founder',
        'counterpartyLabel', firm_name,
        'startupName', startup_name
      )
    );
  end if;

  if investor_email is not null
     and public.should_send_email(new.investor_user_id, 'match.created') then
    insert into public.email_outbox (user_id, template, payload)
    values (
      new.investor_user_id,
      'match.created',
      jsonb_build_object(
        'matchId', new.id,
        'recipientName', investor_name,
        'recipientRole', 'investor',
        'counterpartyLabel', startup_name,
        'firmName', firm_name
      )
    );
  end if;

  return new;
end;
$$;

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
    if public.should_send_email(new.recipient_user_id, 'intro.requested') then
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
    end if;
    return new;
  end if;

  if (tg_op = 'UPDATE' and old.status = 'pending' and new.status <> 'pending') then
    template_name := 'intro.' || new.status::text;
    if public.should_send_email(new.sender_user_id, template_name) then
      insert into public.email_outbox (user_id, template, payload)
      values (
        new.sender_user_id,
        template_name,
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
    end if;
    return new;
  end if;

  return new;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Convenience: a check constraint we want to add lazily — the deletion
--    request must always be in the past (no future-scheduled deletes via
--    direct SQL).
-- ──────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_deletion_not_future'
  ) then
    alter table public.users
      add constraint users_deletion_not_future
      check (deletion_requested_at is null or deletion_requested_at <= now() + interval '1 minute');
  end if;
end$$;
