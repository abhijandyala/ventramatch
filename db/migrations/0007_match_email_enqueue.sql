-- Sprint 5: when a mutual match is created, enqueue a transactional email
-- to BOTH parties. The email worker (separate Railway service, see Sprint 3)
-- consumes from public.email_outbox and sends via Resend.
--
-- We attach a brand-new trigger to public.matches (after insert) rather than
-- modifying the existing create_match_on_mutual_like function in 0001 — keeps
-- the migration history honest and lets us evolve the email payload separately
-- from the match logic.

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
  -- Look up identities once. Both sides see slightly different copy in
  -- the email — the founder hears "An investor wants to talk", the
  -- investor hears "A founder wants to talk". Names + the counterparty's
  -- 1-line label go in the payload so the template can render without
  -- another query at send time.
  select u.email, u.name into founder_email, founder_name
    from public.users u where u.id = new.founder_user_id;
  select u.email, u.name into investor_email, investor_name
    from public.users u where u.id = new.investor_user_id;

  select s.name into startup_name
    from public.startups s where s.user_id = new.founder_user_id;
  select coalesce(i.firm, i.name) into firm_name
    from public.investors i where i.user_id = new.investor_user_id;

  -- Founder gets one row…
  if founder_email is not null then
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

  -- …investor gets the mirrored row.
  if investor_email is not null then
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

drop trigger if exists matches_enqueue_emails on public.matches;
create trigger matches_enqueue_emails
  after insert on public.matches
  for each row execute function public.enqueue_match_emails();

-- Add 'match.created' to the documented set of email templates by widening
-- the EmailTemplate hint in lib types if you check; the email_outbox.template
-- column is just `text` so this is a docs-only note.
