-- Sprint 11.D — Admin metrics views.
--
-- Plain views (not materialized) for v1 — cheap, always fresh, and our
-- table sizes are small enough that the aggregations are instant. Switch
-- to materialized + hourly refresh when we cross ~50K users.

-- Daily signups (last 90 days)
create or replace view public.admin_daily_signups as
select date_trunc('day', created_at)::date as day,
       count(*)::int as signups
from public.users
where created_at > now() - interval '90 days'
group by 1
order by 1;

-- Daily matches
create or replace view public.admin_daily_matches as
select date_trunc('day', matched_at)::date as day,
       count(*)::int as matches
from public.matches
where matched_at > now() - interval '90 days'
group by 1
order by 1;

-- Daily intros sent
create or replace view public.admin_daily_intros as
select date_trunc('day', created_at)::date as day,
       count(*)::int as intros_sent,
       count(*) filter (where status = 'accepted')::int as intros_accepted,
       count(*) filter (where status = 'declined')::int as intros_declined
from public.intro_requests
where created_at > now() - interval '90 days'
group by 1
order by 1;

-- Verification funnel
create or replace view public.admin_verification_funnel as
select
  count(*)::int as total_users,
  count(*) filter (where email_verified_at is not null)::int as email_verified,
  count(*) filter (where onboarding_completed = true)::int as onboarded,
  count(*) filter (where account_label = 'verified')::int as profile_verified,
  count(*) filter (where account_label = 'banned')::int as banned
from public.users;

-- 7-day rolling rates
create or replace view public.admin_rates_7d as
select
  (select count(*)::int from public.matches
   where matched_at > now() - interval '7 days') as matches_7d,
  (select count(*)::int from public.intro_requests
   where created_at > now() - interval '7 days') as intros_sent_7d,
  (select count(*)::int from public.intro_requests
   where created_at > now() - interval '7 days'
     and status = 'accepted') as intros_accepted_7d,
  (select count(*)::int from public.users
   where created_at > now() - interval '7 days') as signups_7d;
