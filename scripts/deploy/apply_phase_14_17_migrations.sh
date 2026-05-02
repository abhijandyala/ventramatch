#!/usr/bin/env bash
# scripts/deploy/apply_phase_14_17_migrations.sh
#
# Apply VentraMatch Phase 14–17 database migrations to Railway Postgres.
#
# ─── SAFETY ──────────────────────────────────────────────────────────────────
# • Requires manual confirmation before any SQL is executed.
# • Uses -v ON_ERROR_STOP=1 so psql aborts on the first error.
# • All five migrations are additive only — no DROP, no TRUNCATE, no RENAME.
# • After migrations, all risky feature flags are forced to enabled=false
#   globally so no user sees any behaviour change on deploy.
# • DATABASE_URL is never echoed or logged.
#
# ─── USAGE ───────────────────────────────────────────────────────────────────
# export DATABASE_URL="YOUR_RAILWAY_DATABASE_URL"
# ./scripts/deploy/apply_phase_14_17_migrations.sh
#
# When prompted, type exactly:  APPLY_PHASE_14_17
#
# ─── REQUIRED PSQL ───────────────────────────────────────────────────────────
# Install postgres client if missing:
#   brew install libpq && brew link --force libpq   # macOS
#   sudo apt-get install postgresql-client           # Debian/Ubuntu
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# ── 1. DATABASE_URL guard ─────────────────────────────────────────────────────

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo ""
  echo "  ERROR: DATABASE_URL is not set."
  echo "  Export your Railway Postgres DATABASE_URL first:"
  echo "    export DATABASE_URL=\"YOUR_RAILWAY_DATABASE_URL\""
  echo ""
  exit 1
fi

# ── 2. Safe DB preview (never print credentials or full URL) ──────────────────

# Extract host from postgresql://user:pass@host:port/dbname
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+)[:/].*|\1|')
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's|.*/([^?]+)(\?.*)?$|\1|')

echo ""
echo "══════════════════════════════════════════════════════════════════"
echo "  VentraMatch — Railway Postgres Migration"
echo "  Phases 14–17 (migrations 0036–0040)"
echo "══════════════════════════════════════════════════════════════════"
echo ""
echo "  Target host:     ${DB_HOST}"
echo "  Target database: ${DB_NAME}"
echo ""
echo "  ⚠  All risky feature flags will be forced OFF after migration."
echo "  ⚠  No user will see any behaviour change until you explicitly"
echo "     enable flags for a test user with enable_test_user_flags.sql."
echo ""

# ── 3. Migration file existence check ─────────────────────────────────────────

MIGRATIONS=(
  "db/migrations/0036_phase14_quality_runtime.sql"
  "db/migrations/0037_phase14d_feed_impressions.sql"
  "db/migrations/0038_phase15_model_shadow_scores.sql"
  "db/migrations/0039_phase16_feature_flag_ml_ranking.sql"
  "db/migrations/0040_phase17_feature_flag_personalization.sql"
)

echo "  Checking migration files..."
for MIGRATION in "${MIGRATIONS[@]}"; do
  FULL_PATH="${REPO_ROOT}/${MIGRATION}"
  if [[ ! -f "$FULL_PATH" ]]; then
    echo ""
    echo "  ERROR: Migration file not found: ${FULL_PATH}"
    echo "  Run this script from the repo root, or ensure the branch is up to date."
    echo ""
    exit 1
  fi
  echo "    ✓  ${MIGRATION}"
done
echo ""

# ── 4. Manual confirmation ────────────────────────────────────────────────────

echo "  About to apply migrations 0036–0040 to Railway Postgres."
echo ""
echo "  Type exactly the following to proceed (copy-paste is fine):"
echo ""
echo "    APPLY_PHASE_14_17"
echo ""
read -r CONFIRM

if [[ "$CONFIRM" != "APPLY_PHASE_14_17" ]]; then
  echo ""
  echo "  Confirmation failed. No changes made."
  echo ""
  exit 1
fi

echo ""
echo "  Confirmation accepted. Applying migrations..."
echo ""

# ── 5. Apply migrations in order ─────────────────────────────────────────────

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "${REPO_ROOT}/db/migrations/0036_phase14_quality_runtime.sql"
echo "  ✓  0036_phase14_quality_runtime.sql"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "${REPO_ROOT}/db/migrations/0037_phase14d_feed_impressions.sql"
echo "  ✓  0037_phase14d_feed_impressions.sql"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "${REPO_ROOT}/db/migrations/0038_phase15_model_shadow_scores.sql"
echo "  ✓  0038_phase15_model_shadow_scores.sql"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "${REPO_ROOT}/db/migrations/0039_phase16_feature_flag_ml_ranking.sql"
echo "  ✓  0039_phase16_feature_flag_ml_ranking.sql"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "${REPO_ROOT}/db/migrations/0040_phase17_feature_flag_personalization.sql"
echo "  ✓  0040_phase17_feature_flag_personalization.sql"

echo ""
echo "  All 5 migrations applied successfully."
echo ""

# ── 6. Force all risky flags OFF globally, upsert any missing rows ────────────

echo "  Disabling all risky feature flags globally..."
echo ""

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'ENDSQL'
-- Force all risky Phase 14–17 flags to disabled globally.
-- Any missing flag rows are inserted (disabled).
-- This runs AFTER migrations so the feature_flags table definitely exists.

insert into public.feature_flags (name, enabled, target_user_ids, description)
values
  ('quality_review_bot_writes',
   false, null,
   'Phase 14a: run bot quality review on profile submission. Default off.'),
  ('feed_impression_logging',
   false, null,
   'Phase 14d: log feed impressions to feed_impressions table. Default off.'),
  ('feed_model_shadow_scoring',
   false, null,
   'Phase 15: log ML model shadow score alongside scoreMatch. Default off.'),
  ('feed_ml_ranking',
   false, null,
   'Phase 16: use ML model as primary feed ranker. scoreMatch remains fallback. Default off.'),
  ('feed_personalization',
   false, null,
   'Phase 17: apply behavior personalization after ML ranking. Requires feed_ml_ranking=on. Default off.')
on conflict (name) do update
  set enabled          = false,
      target_user_ids  = null;

-- Confirmation query so we can see the result.
select name, enabled, target_user_ids
from public.feature_flags
where name in (
  'quality_review_bot_writes',
  'feed_impression_logging',
  'feed_model_shadow_scoring',
  'feed_ml_ranking',
  'feed_personalization'
)
order by name;
ENDSQL

echo "  ✓  All risky flags confirmed disabled globally."
echo ""

# ── 7. Schema verification ────────────────────────────────────────────────────

echo "  Running schema verification checks..."
echo ""

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'ENDSQL'
-- 7a. applications table has Phase 14a columns
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'applications'
      and column_name  = 'ruleset_version'
  ) then
    raise exception 'SCHEMA CHECK FAILED: applications.ruleset_version column missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'applications'
      and column_name  = 'last_bot_review_at'
  ) then
    raise exception 'SCHEMA CHECK FAILED: applications.last_bot_review_at column missing';
  end if;
  raise notice 'CHECK PASSED: applications has ruleset_version and last_bot_review_at';
end $$;

-- 7b. feed_impressions table exists
do $$ begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name   = 'feed_impressions'
  ) then
    raise exception 'SCHEMA CHECK FAILED: feed_impressions table missing';
  end if;
  raise notice 'CHECK PASSED: feed_impressions table exists';
end $$;

-- 7c. feed_impressions has Phase 15 model scoring columns
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'feed_impressions'
      and column_name  = 'scorematch_score'
  ) then
    raise exception 'SCHEMA CHECK FAILED: feed_impressions.scorematch_score missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'feed_impressions'
      and column_name  = 'model_score'
  ) then
    raise exception 'SCHEMA CHECK FAILED: feed_impressions.model_score missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'feed_impressions'
      and column_name  = 'model_version'
  ) then
    raise exception 'SCHEMA CHECK FAILED: feed_impressions.model_version missing';
  end if;
  raise notice 'CHECK PASSED: feed_impressions has scorematch_score, model_score, model_version';
end $$;

-- 7d. feed_impressions has RLS enabled
do $$ begin
  if not exists (
    select 1 from pg_tables
    where schemaname = 'public'
      and tablename  = 'feed_impressions'
      and rowsecurity = true
  ) then
    raise exception 'SCHEMA CHECK FAILED: feed_impressions does not have RLS enabled';
  end if;
  raise notice 'CHECK PASSED: feed_impressions has RLS enabled';
end $$;

-- 7e. No public SELECT policy exists for feed_impressions
do $$ begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'feed_impressions'
      and cmd        = 'SELECT'
  ) then
    raise exception 'SCHEMA CHECK FAILED: unexpected public SELECT policy on feed_impressions';
  end if;
  raise notice 'CHECK PASSED: no public SELECT policy on feed_impressions';
end $$;

-- 7f. feature_flags has feed_ml_ranking enabled=false
do $$ begin
  if not exists (
    select 1 from public.feature_flags
    where name = 'feed_ml_ranking' and enabled = false
  ) then
    raise exception 'SCHEMA CHECK FAILED: feed_ml_ranking flag is not present or is enabled';
  end if;
  raise notice 'CHECK PASSED: feed_ml_ranking is present and enabled=false';
end $$;

-- 7g. feature_flags has feed_personalization enabled=false
do $$ begin
  if not exists (
    select 1 from public.feature_flags
    where name = 'feed_personalization' and enabled = false
  ) then
    raise exception 'SCHEMA CHECK FAILED: feed_personalization flag is not present or is enabled';
  end if;
  raise notice 'CHECK PASSED: feed_personalization is present and enabled=false';
end $$;

-- Summary of all flag states
select
  name,
  enabled,
  target_user_ids,
  description
from public.feature_flags
where name in (
  'quality_review_bot_writes',
  'feed_impression_logging',
  'feed_model_shadow_scoring',
  'feed_ml_ranking',
  'feed_personalization'
)
order by name;
ENDSQL

# ── 8. Final summary ──────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════════════════════════════"
echo "  MIGRATION COMPLETE"
echo "══════════════════════════════════════════════════════════════════"
echo ""
echo "  ✓  5 migrations applied (0036–0040)"
echo "  ✓  Schema verified — all required columns and tables present"
echo "  ✓  RLS enabled on feed_impressions, no public read policy"
echo "  ✓  All 5 risky feature flags set to enabled=false globally"
echo ""
echo "  Next step: enable flags for a specific test user only."
echo ""
echo "    1. Find your user UUID:"
echo "       psql \"\$DATABASE_URL\" -c \"select id, email from public.users where email = 'YOUR_EMAIL';\""
echo ""
echo "    2. Edit scripts/deploy/enable_test_user_flags.sql:"
echo "       Replace YOUR-USER-UUID-HERE with the UUID from step 1."
echo ""
echo "    3. Apply to the DB:"
echo "       psql \"\$DATABASE_URL\" -f scripts/deploy/enable_test_user_flags.sql"
echo ""
echo "  ⚠  Do NOT set enabled=true with target_user_ids=null until the team"
echo "     has validated behaviour for the targeted test cohort."
echo ""
