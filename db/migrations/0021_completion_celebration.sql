-- Sprint 10.A — one-time confetti celebration when profile reaches 100%.
alter table public.users
  add column if not exists celebrated_completion_at timestamptz;
