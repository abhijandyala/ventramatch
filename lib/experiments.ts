import { createHash } from "node:crypto";
import { withUserRls } from "@/lib/db";
import { cacheable } from "@/lib/cache";

/**
 * Homegrown A/B experiment framework.
 *
 * An experiment has a name and N variants (default: "control" | "treatment").
 * Assignment is deterministic by sha256(experimentName + userId) so:
 *   - Same user always sees the same variant (no flicker).
 *   - No per-user storage needed.
 *   - Roughly 50/50 split for 2 variants.
 *
 * Experiments are defined in the feature_flags table with a naming
 * convention: prefix "exp:" (e.g. "exp:feed-sort-v2"). The flag's
 * `enabled` field controls whether the experiment is running.
 *
 * Usage:
 *   const v = await variant("feed-sort-v2", userId);
 *   if (v === "treatment") { ... }
 *
 * To create an experiment:
 *   INSERT INTO feature_flags (name, enabled, description)
 *   VALUES ('exp:feed-sort-v2', true, 'Test new feed sort algorithm');
 *
 * To end an experiment (everyone gets control):
 *   UPDATE feature_flags SET enabled = false WHERE name = 'exp:feed-sort-v2';
 */

export type Variant = "control" | "treatment";

/**
 * Deterministic variant assignment.
 *
 * @param experiment — experiment name (without the "exp:" prefix; we add it).
 * @param userId — the user to assign. Null/undefined → always "control".
 * @returns "control" or "treatment".
 */
export async function variant(
  experiment: string,
  userId?: string | null,
): Promise<Variant> {
  if (!userId) return "control";

  const flagName = `exp:${experiment}`;

  // Check if the experiment is enabled (cached 30s via flag system).
  const enabled = await cacheable(`exp:enabled:${flagName}`, 30, async () => {
    const row = await withUserRls<{ enabled: boolean } | null>(null, async (sql) => {
      const rows = await sql<{ enabled: boolean }[]>`
        select enabled from public.feature_flags where name = ${flagName} limit 1
      `;
      return rows[0] ?? null;
    });
    return row?.enabled ?? false;
  });

  if (!enabled) return "control";

  // Deterministic assignment via hash.
  return assignVariant(experiment, userId);
}

/**
 * Pure function: deterministic 50/50 split by hashing experiment + userId.
 * Exported for unit testing.
 */
export function assignVariant(experiment: string, userId: string): Variant {
  const hash = createHash("sha256")
    .update(`${experiment}:${userId}`)
    .digest();
  // First byte mod 2: 0 = control, 1 = treatment.
  return (hash[0]! % 2 === 0) ? "control" : "treatment";
}
