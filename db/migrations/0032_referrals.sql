-- Sprint 14.C — Referral system.

create table if not exists public.referral_codes (
  code text primary key check (length(code) between 6 and 20),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  kind text not null default 'general'
    check (kind in ('founder_invites_investor', 'investor_invites_founder', 'general')),
  created_at timestamptz not null default now()
);

create index if not exists referral_codes_owner_idx
  on public.referral_codes (owner_user_id);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.referral_codes(code) on delete cascade,
  referred_user_id uuid not null references public.users(id) on delete cascade,
  signed_up_at timestamptz not null default now(),
  became_verified_at timestamptz,
  unique (code, referred_user_id)
);

create index if not exists referrals_referred_idx
  on public.referrals (referred_user_id);

-- Track who referred the user (set at signup from ?ref= param).
alter table public.users
  add column if not exists referrer_user_id uuid references public.users(id) on delete set null;

-- RLS: owner can read their own codes + referrals.
alter table public.referral_codes enable row level security;
drop policy if exists "referral_codes select own" on public.referral_codes;
create policy "referral_codes select own"
  on public.referral_codes for select
  using (owner_user_id = public.app_user_id());
drop policy if exists "referral_codes insert own" on public.referral_codes;
create policy "referral_codes insert own"
  on public.referral_codes for insert
  with check (owner_user_id = public.app_user_id());

alter table public.referrals enable row level security;
drop policy if exists "referrals select via code owner" on public.referrals;
create policy "referrals select via code owner"
  on public.referrals for select
  using (
    exists (
      select 1 from public.referral_codes rc
      where rc.code = referrals.code
        and rc.owner_user_id = public.app_user_id()
    )
  );
