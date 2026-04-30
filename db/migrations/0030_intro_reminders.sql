-- Sprint 13.E — Idempotency table for meeting reminders.
-- The cron job (Railway scheduled, every 15 min) calls the helper which
-- checks this table before enqueuing so double-sends never happen.

create table if not exists public.intro_reminders_sent (
  intro_id uuid not null references public.intro_requests(id) on delete cascade,
  kind text not null check (kind in ('24h', '1h')),
  sent_at timestamptz not null default now(),
  primary key (intro_id, kind)
);
