-- Sprint 9.5.C — User avatars.
--
-- Today there's no avatar anywhere in the product. Feed cards show only
-- text. NextAuth's `users.image` column (added in 0002) is populated by
-- OAuth providers (Google/LinkedIn/GitHub returns the user's profile pic),
-- but we don't render it. This migration adds:
--
--   * users.avatar_storage_key  — S3 key for a user-uploaded avatar.
--                                 Format: avatars/<userId>/<uuid>.{jpg|png|webp}.
--                                 When set, the read path prefers this
--                                 over the OAuth-provided users.image.
--   * users.avatar_url          — Cached public URL (presigned, long TTL).
--                                 Re-generated on every upload. Reads fall
--                                 through to a fresh presign if the cached
--                                 URL is past TTL.
--   * users.avatar_updated_at   — When the row was last modified by the
--                                 uploader. Drives a cache buster on the
--                                 read URL.
--
-- The pipeline also handles deletion: a remove sets all three to null;
-- the S3 object is deleted by the route. Hard account-deletion (when
-- the cron lands) MUST also delete the S3 object.
--
-- No backfill: existing users without OAuth pictures get the initials
-- fallback rendered by components/profile/avatar.tsx.

alter table public.users
  add column if not exists avatar_storage_key text,
  add column if not exists avatar_url text,
  add column if not exists avatar_updated_at timestamptz;

create index if not exists users_avatar_updated_at_idx
  on public.users (avatar_updated_at)
  where avatar_storage_key is not null;
