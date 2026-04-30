-- Sprint 14.A — Public profile opt-in.

alter table public.users
  add column if not exists public_profile_enabled boolean not null default false,
  add column if not exists public_slug text;

-- Unique + constrained slug (3-32 chars, lowercase alphanumeric + dash).
create unique index if not exists users_public_slug_unique_idx
  on public.users (public_slug)
  where public_slug is not null;

-- Enforce slug format at DB level.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_slug_format'
  ) then
    alter table public.users
      add constraint users_slug_format
      check (
        public_slug is null
        or (length(public_slug) between 3 and 32
            and public_slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$')
      );
  end if;
end $$;
