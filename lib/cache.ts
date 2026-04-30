import { Redis } from "@upstash/redis";

/**
 * Server-only cache layer backed by Upstash Redis (REST-based, edge-safe).
 *
 * Two patterns:
 *   1. cacheable(key, ttlSecs, fn) — read-through cache. If key exists
 *      and is < TTL, return cached. Otherwise call fn(), cache, return.
 *   2. invalidate(key) — delete a cached key immediately. Called alongside
 *      revalidatePath() in write actions.
 *
 * When UPSTASH_REDIS_REST_URL is unset the helper falls through to calling
 * fn() directly with no caching — so dev environments work without Redis.
 *
 * Namespace: all keys are prefixed with "vm:" to keep the Upstash DB
 * organized if you ever share it with another project.
 */

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

const PREFIX = "vm:";

function prefixed(key: string): string {
  return PREFIX + key;
}

/**
 * Read-through cache.
 *
 * @param key   — stable, unique per user+query. Convention: `<op>:<userId>`.
 * @param ttl   — seconds. 60 = re-query at most once per minute.
 * @param fn    — the actual data-fetching function. Only called on cache miss.
 */
export async function cacheable<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>,
): Promise<T> {
  const redis = getRedis();
  if (!redis) return fn();

  const k = prefixed(key);
  try {
    const cached = await redis.get<T>(k);
    if (cached !== null && cached !== undefined) return cached;
  } catch {
    // Redis down → fall through to fn().
  }

  const result = await fn();

  try {
    await redis.set(k, result, { ex: ttl });
  } catch {
    // Non-fatal — we still return the fresh result.
  }

  return result;
}

/** Delete a cached key. Call alongside revalidatePath(). */
export async function invalidate(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(prefixed(key));
  } catch {
    // Non-fatal.
  }
}

/** Delete all keys matching a prefix pattern. Use sparingly. */
export async function invalidatePattern(pattern: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const keys = await redis.keys(prefixed(pattern));
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Non-fatal.
  }
}
