-- Sprint 13.D — Intro reschedule + cancel audit.

create table if not exists public.intro_reschedules (
  id uuid primary key default gen_random_uuid(),
  intro_id uuid not null references public.intro_requests(id) on delete cascade,
  actor_user_id uuid not null references public.users(id) on delete cascade,
  action text not null check (action in ('reschedule', 'cancel')),
  previous_time timestamptz,
  new_proposed_times jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists intro_reschedules_intro_idx
  on public.intro_reschedules (intro_id, created_at desc);

alter table public.intro_reschedules enable row level security;

drop policy if exists "intro_reschedules select participant" on public.intro_reschedules;
create policy "intro_reschedules select participant"
  on public.intro_reschedules for select
  using (
    public.app_user_id() = actor_user_id
    or exists (
      select 1 from public.intro_requests ir
      where ir.id = intro_id
        and (ir.sender_user_id = public.app_user_id() or ir.recipient_user_id = public.app_user_id())
    )
  );

drop policy if exists "intro_reschedules insert as actor" on public.intro_reschedules;
create policy "intro_reschedules insert as actor"
  on public.intro_reschedules for insert
  with check (public.app_user_id() = actor_user_id);

-- Add a cancelled_at column to intro_requests for meeting cancellation
-- (distinct from the status='withdrawn' which is about the request itself).
alter table public.intro_requests
  add column if not exists meeting_cancelled_at timestamptz,
  add column if not exists meeting_cancel_reason text;
