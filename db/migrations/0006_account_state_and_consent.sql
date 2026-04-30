-- Sprint 1 of the onboarding plan: account state machine + consent tracking.
--
-- profile_state drives feature gating across the app:
--   none      → just signed up, no onboarding done
--   basic     → finished the 3-step onboarding
--   partial   → started /build, < 80% complete
--   complete  → /build at >= 80%, awaiting auto-review
--   pending_review → submitted, AI review running
--   verified  → auto-review accepted (or manual)
--   rejected  → auto-review rejected; user can edit and re-submit
--
-- profile_completion_pct is computed by the server on each builder save
-- (so we never trust a client-provided value).

alter table public.users
  add column if not exists profile_state text not null default 'none'
    check (profile_state in (
      'none','basic','partial','complete','pending_review','verified','rejected'
    )),
  add column if not exists profile_completion_pct int not null default 0
    check (profile_completion_pct between 0 and 100),
  add column if not exists tos_accepted_at timestamptz,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists linkedin_url text,
  add column if not exists github_url text,
  add column if not exists website_url text,
  add column if not exists profile_draft jsonb,
  add column if not exists auto_review_status text
    check (auto_review_status in ('accept','reject','manual') or auto_review_status is null),
  add column if not exists auto_review_reason text,
  add column if not exists auto_review_at timestamptz;

-- Backfill existing users: anyone who already finished onboarding (per the
-- old `onboarding_completed` boolean) is at least 'basic'. We can't tell
-- whether they're past 'basic' yet because /build wasn't wired up.
update public.users
  set profile_state = 'basic'
  where onboarding_completed = true
    and profile_state = 'none';

-- Cookie / consent helper index — fast lookups when we audit who accepted
-- which version of the policies.
create index if not exists users_tos_accepted_at_idx
  on public.users (tos_accepted_at);
