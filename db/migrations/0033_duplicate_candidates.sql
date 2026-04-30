-- Sprint 15.B — Duplicate detection queue.
--
-- Flagged when: same linkedin_url, same email domain + similar name,
-- or same company name. The cron scans daily and inserts candidates;
-- admins review at /admin/duplicates and merge or dismiss.

create table if not exists public.duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references public.users(id) on delete cascade,
  user_b_id uuid not null references public.users(id) on delete cascade,
  reason text not null,
  score real not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'dismissed', 'merged')),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  -- Order doesn't matter: always store smaller UUID first.
  unique (user_a_id, user_b_id)
);

create index if not exists duplicate_candidates_status_idx
  on public.duplicate_candidates (status, created_at desc)
  where status = 'pending';

alter table public.duplicate_candidates enable row level security;
-- Service-role only — admin pages bypass RLS.
