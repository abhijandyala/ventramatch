import { createHash } from "node:crypto";
import { isValidAvatarKey, presignedGetUrl } from "@/lib/storage/s3";

/**
 * Avatar URL resolution + initials fallback color.
 *
 * Three sources, in priority order:
 *   1. user-uploaded avatar    (avatar_storage_key — presigned)
 *   2. OAuth provider picture  (users.image — passes through)
 *   3. null                    (UI shows initials in a deterministic colour)
 *
 * Server-only because presignedGetUrl needs AWS credentials. Pages that
 * fetch users for list views (feed, matches, recent viewers) call this
 * once per user and pass the URL into the <Avatar> component, which is
 * a pure presentational thing.
 *
 * Caching: presigned URLs have a 24h TTL. We cache them in
 * users.avatar_url at upload time. If the cached URL is stale (>23h old),
 * we re-presign at read time. Generation is local HMAC, no network call.
 */

const CACHE_TTL_HOURS = 23; // re-presign before AWS expiry

export type AvatarSource = {
  /** users.avatar_storage_key — preferred when present. */
  storageKey?: string | null;
  /** users.avatar_url — cached presigned URL from upload time. */
  cachedUrl?: string | null;
  /** users.avatar_updated_at — drives the cache-staleness check. */
  cachedAt?: string | Date | null;
  /** users.image — OAuth provider picture, fallback. */
  oauthImage?: string | null;
};

/**
 * Resolve the URL we should pass to <Avatar src={...}>. Returns null if
 * no avatar of any kind is set; the component then renders initials.
 *
 * Awaitable because regenerating a presigned URL is async. For a list of
 * users, kick this off in parallel via Promise.all().
 */
export async function resolveAvatarUrl(
  source: AvatarSource,
): Promise<string | null> {
  if (source.storageKey && isValidAvatarKey(source.storageKey)) {
    if (
      source.cachedUrl &&
      source.cachedAt &&
      cacheIsFresh(source.cachedAt, CACHE_TTL_HOURS)
    ) {
      return source.cachedUrl;
    }
    try {
      return await presignedGetUrl({
        key: source.storageKey,
        expiresIn: 24 * 60 * 60,
      });
    } catch (err) {
      console.warn("[avatar:resolve] presign failed; falling back to oauth/null", err);
    }
  }
  return source.oauthImage ?? null;
}

function cacheIsFresh(at: string | Date, hours: number): boolean {
  const ms = typeof at === "string" ? Date.parse(at) : at.getTime();
  if (!Number.isFinite(ms)) return false;
  return Date.now() - ms < hours * 60 * 60 * 1000;
}

// ──────────────────────────────────────────────────────────────────────────
//  Initials + deterministic fallback color
// ──────────────────────────────────────────────────────────────────────────

/**
 * Up to 2 characters from the name. Falls back to "?" for blank input.
 *   - "Marc Andreessen" → "MA"
 *   - "Acme Labs"        → "AL"
 *   - "alice"            → "A"
 *   - ""                 → "?"
 */
export function avatarInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return (parts[0]![0] ?? "").toUpperCase() + (parts[parts.length - 1]![0] ?? "").toUpperCase();
}

/**
 * 12-color palette aligned to brand. Each colour pairs a soft background
 * tint with a darker foreground for the initials. Picked to be readable
 * at all sizes and to look intentional when many appear together (a feed
 * of 30 cards shouldn't look like a christmas tree).
 */
export const AVATAR_PALETTE: { bg: string; fg: string }[] = [
  { bg: "#e6efe9", fg: "#205a3a" }, // sage / forest
  { bg: "#fde7d8", fg: "#84410f" }, // peach / clay
  { bg: "#e1eaf6", fg: "#23477e" }, // ice / navy
  { bg: "#f1e6f4", fg: "#5a2570" }, // lilac / plum
  { bg: "#f6e8c8", fg: "#6e4e0c" }, // sand / olive
  { bg: "#dcf0ec", fg: "#1d5d52" }, // mint / teal
  { bg: "#f4dada", fg: "#7a1f1f" }, // blush / rust
  { bg: "#dee5f3", fg: "#2c3a6c" }, // pearl / indigo
  { bg: "#ebe5da", fg: "#4a3a23" }, // cream / cocoa
  { bg: "#ddebd6", fg: "#2f5a1d" }, // moss / forest
  { bg: "#f0d8e4", fg: "#742454" }, // rose / wine
  { bg: "#e0e8e2", fg: "#2f4a39" }, // ash / pine
];

/**
 * Pick a palette index deterministically from a stable id (usually userId).
 * Same user → same colour every render. Pure function, no I/O.
 */
export function avatarColorIndex(id: string): number {
  if (!id) return 0;
  // Fast non-crypto hash via sha1 + first byte. Crypto here is overkill
  // but it's already in node:crypto and we don't need anything fancier.
  const hash = createHash("sha1").update(id).digest();
  return hash[0]! % AVATAR_PALETTE.length;
}

export function avatarPaletteFor(id: string) {
  return AVATAR_PALETTE[avatarColorIndex(id)]!;
}
