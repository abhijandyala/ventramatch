-- Sprint 9.5.D — Multi-sector support for startups.
--
-- Pre-Sprint 9.5 the wizard collected "up to 3 sectors" but only
-- `sectors[0]` was persisted to `startups.industry` (a single text
-- column). The other two were silently dropped. This migration adds
-- `startup_sectors text[]` so all 3 survive, and makes the feed query
-- / matching score use the array intersection instead of equality.
--
-- The legacy `industry` column stays — it's still the primary sector
-- used by the publish gate and basic feeds. `startup_sectors` is
-- strictly additive.
--
-- Backfill: copy `industry` into `startup_sectors` for any existing row
-- that has a non-empty industry but no sectors array yet. Zero startups
-- in prod right now, so this is a no-op in practice.

alter table public.startups
  add column if not exists startup_sectors text[] not null default '{}';

-- Backfill existing rows.
update public.startups
  set startup_sectors = array[industry]
  where industry is not null
    and industry <> ''
    and (startup_sectors is null or array_length(startup_sectors, 1) is null);

-- GIN index for array overlap queries (&&) in the feed.
create index if not exists startups_sectors_gin_idx
  on public.startups using gin (startup_sectors);

-- Update the search vector trigger to include all sectors, not just the
-- primary industry. This means FTS queries like "fintech climate" hit
-- a startup that has both sectors.
create or replace function public.startups_refresh_search_vector()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.industry, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(new.startup_sectors, ' '), '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.one_liner, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.traction, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(new.location, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(new.website, '')), 'D');
  return new;
end;
$$;

-- Reindex existing rows to pick up the new vector content.
update public.startups set name = name;
