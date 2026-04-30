-- Sprint 11.A — Admin role system.
--
-- Admin is a privilege, not a marketplace identity. Separate from
-- users.role ('founder'|'investor') so the same person can be both a
-- founder AND a reviewer. The admins table has service-role-only RLS
-- so regular users can't even read it.
--
-- Roles:
--   reviewer    — can triage reports, view user details
--   admin       — can ban/unban, override reviews, manage users
--   super_admin — can grant/revoke admin roles

do $$ begin
  create type public.admin_role as enum ('reviewer', 'admin', 'super_admin');
exception when duplicate_object then null; end $$;

create table if not exists public.admins (
  user_id uuid primary key references public.users(id) on delete cascade,
  role public.admin_role not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null
);

alter table public.admins enable row level security;

-- No public-facing policies — only the service role (bypasses RLS) can
-- read or write this table. The app's requireAdmin() helper runs with
-- withUserRls(null, ...) which uses the service connection.

-- Helper function for use in other policies or triggers.
create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.admins where user_id = p_user_id)
$$;

-- Audit log for admin actions. Append-only.
create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.users(id) on delete cascade,
  action text not null,
  target_user_id uuid references public.users(id) on delete set null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_actions_actor_idx
  on public.admin_actions (actor_user_id, created_at desc);
create index if not exists admin_actions_target_idx
  on public.admin_actions (target_user_id, created_at desc);

alter table public.admin_actions enable row level security;
-- Service-role only — no public policies.
