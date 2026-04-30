/**
 * In-memory rate limiter for email sends. Per-process state — fine for a
 * single Railway instance. If we scale horizontally, swap this for Redis.
 */

const lastSentAt = new Map<string, number>();

const COOLDOWN_MS = 60 * 1000; // 60 seconds between sends per key

export type RateCheck =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

/**
 * Returns ok=true and stamps the key as "just sent". If the key was used
 * within COOLDOWN_MS, returns ok=false with seconds remaining.
 *
 * Call this immediately before sending an email so the timestamp reflects
 * the actual send attempt.
 */
export function checkAndStamp(key: string): RateCheck {
  const now = Date.now();
  const last = lastSentAt.get(key) ?? 0;
  const elapsed = now - last;
  if (elapsed < COOLDOWN_MS) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((COOLDOWN_MS - elapsed) / 1000),
    };
  }
  lastSentAt.set(key, now);
  // Garbage-collect old entries occasionally so the map doesn't grow forever
  if (lastSentAt.size > 5000) {
    for (const [k, t] of lastSentAt) {
      if (now - t > COOLDOWN_MS * 4) lastSentAt.delete(k);
    }
  }
  return { ok: true };
}

export const COOLDOWN_SECONDS = COOLDOWN_MS / 1000;
