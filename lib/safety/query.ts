import { withUserRls } from "@/lib/db";
import type { UserRole } from "@/types/database";

export type BlockedUserSummary = {
  userId: string;
  blockedAt: Date;
  reason: string | null;
  /** Display info for the row. May be null if the user has been deleted/paused. */
  name: string | null;
  role: UserRole | null;
  startupName: string | null;
  firm: string | null;
};

/** List the users I've blocked (for the /settings#blocked surface). */
export async function fetchBlockedUsers(viewerId: string): Promise<BlockedUserSummary[]> {
  return withUserRls<BlockedUserSummary[]>(viewerId, async (sql) => {
    type Row = {
      blocked_user_id: string;
      created_at: Date | string;
      reason: string | null;
      name: string | null;
      role: UserRole | null;
      startup_name: string | null;
      firm: string | null;
    };
    const rows = await sql<Row[]>`
      select b.blocked_user_id, b.created_at, b.reason,
             u.name, u.role,
             s.name as startup_name,
             inv.firm
      from public.blocks b
      join public.users u on u.id = b.blocked_user_id
      left join public.startups s on s.user_id = b.blocked_user_id
      left join public.investors inv on inv.user_id = b.blocked_user_id
      where b.blocker_user_id = ${viewerId}
      order by b.created_at desc
    `;
    return rows.map((r) => ({
      userId: r.blocked_user_id,
      blockedAt: new Date(r.created_at),
      reason: r.reason,
      name: r.name,
      role: r.role,
      startupName: r.startup_name,
      firm: r.firm,
    }));
  });
}

/**
 * True if there is a block in either direction between viewer and other.
 * Used by /p/[userId] to short-circuit rendering before any view recording.
 */
export async function isBlockedEitherWay(
  viewerId: string,
  otherUserId: string,
): Promise<boolean> {
  if (viewerId === otherUserId) return false;
  return withUserRls<boolean>(viewerId, async (sql) => {
    const rows = await sql<{ exists: boolean }[]>`
      select exists (
        select 1 from public.blocks
        where (blocker_user_id = ${viewerId} and blocked_user_id = ${otherUserId})
           or (blocker_user_id = ${otherUserId} and blocked_user_id = ${viewerId})
      ) as exists
    `;
    return rows[0]?.exists ?? false;
  });
}
