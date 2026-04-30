import { withUserRls } from "@/lib/db";
import { cacheable } from "@/lib/cache";

/**
 * Server-side feature flags.
 *
 * Two modes:
 *   1. Global: flag.enabled applies to everyone.
 *   2. Targeted: flag.target_user_ids lists specific users who see it.
 *
 * Cached for 30s via the Redis cache layer (or falls through to DB when
 * Redis isn't configured). Flags change infrequently enough that 30s is
 * a reasonable stale window.
 *
 * Usage:
 *   if (await flag("new-feed-v2", userId)) { ... }
 *
 * To create/toggle a flag:
 *   insert into feature_flags (name, enabled) values ('new-feed-v2', true);
 *   update feature_flags set enabled = false where name = 'new-feed-v2';
 *   update feature_flags set target_user_ids = array['<uuid>'] where name = 'new-feed-v2';
 */

type FlagRow = {
  enabled: boolean;
  target_user_ids: string[] | null;
};

export async function flag(
  name: string,
  userId?: string | null,
): Promise<boolean> {
  return cacheable(`flag:${name}:${userId ?? "global"}`, 30, async () => {
    const row = await withUserRls<FlagRow | null>(null, async (sql) => {
      const rows = await sql<FlagRow[]>`
        select enabled, target_user_ids
        from public.feature_flags
        where name = ${name}
        limit 1
      `;
      return rows[0] ?? null;
    });

    if (!row) return false;
    if (!row.enabled) return false;

    // If targeted, check if the user is in the list.
    if (row.target_user_ids && row.target_user_ids.length > 0) {
      return userId ? row.target_user_ids.includes(userId) : false;
    }

    // Global flag, enabled.
    return true;
  });
}

/**
 * Fetch all flags for display in an admin view.
 */
export async function fetchAllFlags(): Promise<
  { name: string; enabled: boolean; targetCount: number; description: string | null }[]
> {
  return withUserRls<
    { name: string; enabled: boolean; targetCount: number; description: string | null }[]
  >(null, async (sql) => {
    type Row = {
      name: string;
      enabled: boolean;
      target_count: number;
      description: string | null;
    };
    const rows = await sql<Row[]>`
      select name, enabled,
             coalesce(array_length(target_user_ids, 1), 0)::int as target_count,
             description
      from public.feature_flags
      order by name
    `;
    return rows.map((r) => ({
      name: r.name,
      enabled: r.enabled,
      targetCount: r.target_count,
      description: r.description,
    }));
  });
}
