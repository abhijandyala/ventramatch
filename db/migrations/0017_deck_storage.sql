-- Sprint 9.5.B — Deck file uploads.
--
-- Pre-Sprint 9.5 the founder builder's "Deck" step was a placeholder UI
-- saying "coming soon" with a freeform URL input as the only path forward.
-- Founders had to host their deck on Google Drive / DocSend / Notion
-- separately. This migration adds the columns needed to store decks in
-- our own S3-compatible bucket as opt-in alongside the existing URL.
--
-- Three columns:
--   * deck_storage_key  — the object key in S3 (e.g. decks/<userId>/<uuid>.pdf).
--                         NEVER store the public URL — buckets/regions can
--                         change. Generate presigned download URLs at read
--                         time so we can rotate buckets without a data
--                         migration and so the URL itself is short-lived.
--   * deck_filename     — the original filename the user uploaded
--                         ("AcmeQ2 2026 Deck.pdf"), shown in the UI for
--                         humans. Capped at 200 chars to deter pathological
--                         inputs.
--   * deck_uploaded_at  — server-set timestamp. Drives the "Updated 3d ago"
--                         badge on the founder's own /build page and any
--                         freshness indicator on the read side.
--
-- The legacy `deck_url` column from 0001_initial_schema.sql stays — users
-- with an external link continue to work unchanged. The read path
-- (lib/profile/visibility.ts → projectStartupTier2 + the GET route) prefers
-- `deck_storage_key` when set and falls back to `deck_url`.
--
-- No backfill: existing rows have null storage_key and continue to use
-- their `deck_url`. Empty cluster anyway (we verified 0 startups in prod
-- when applying this migration).

alter table public.startups
  add column if not exists deck_storage_key text,
  add column if not exists deck_filename text
    check (deck_filename is null or length(deck_filename) between 1 and 200),
  add column if not exists deck_uploaded_at timestamptz;

create index if not exists startups_deck_uploaded_at_idx
  on public.startups (deck_uploaded_at)
  where deck_storage_key is not null;
