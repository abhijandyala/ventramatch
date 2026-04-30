import { withUserRls } from "@/lib/db";
import type { Database, IntroRequestStatus, UserRole } from "@/types/database";

type IntroRow = Database["public"]["Tables"]["intro_requests"]["Row"];

export type IntroDirection = "incoming" | "outgoing";

/**
 * Single intro request decorated with the OTHER party's display info, so
 * the inbox/list UI doesn't have to make N more queries per row.
 */
export type IntroSummary = {
  id: string;
  matchId: string;
  status: IntroRequestStatus;
  direction: IntroDirection;
  message: string;
  proposedTimes: string[];
  linkUrl: string | null;
  acceptedTime: string | null;
  responseMessage: string | null;
  createdAt: Date;
  respondedAt: Date | null;
  expiresAt: Date;
  /** Who's on the OTHER side of this intro (relative to viewer). */
  otherUserId: string;
  otherName: string;
  otherRole: UserRole | null;
  /** Optional context: startup name or investor firm for quick scanning. */
  otherStartupName: string | null;
  otherFirm: string | null;
};

/** Used for the dashboard / nav badge. */
export type IntroBadgeCounts = {
  /** Pending requests addressed to me (need response). */
  needsResponse: number;
  /** Pending requests I sent that have not been answered yet. */
  awaitingReply: number;
};

// ──────────────────────────────────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────────────────────────────────

type RawRow = IntroRow & {
  other_user_id: string;
  other_name: string | null;
  other_role: UserRole | null;
  other_startup_name: string | null;
  other_firm: string | null;
};

function toSummary(row: RawRow, viewerId: string): IntroSummary {
  const direction: IntroDirection =
    row.sender_user_id === viewerId ? "outgoing" : "incoming";
  return {
    id: row.id,
    matchId: row.match_id,
    status: row.status,
    direction,
    message: row.message,
    proposedTimes: row.proposed_times ?? [],
    linkUrl: row.link_url,
    acceptedTime: row.accepted_time,
    responseMessage: row.response_message,
    createdAt: new Date(row.created_at),
    respondedAt: row.responded_at ? new Date(row.responded_at) : null,
    expiresAt: new Date(row.expires_at),
    otherUserId: row.other_user_id,
    otherName: row.other_name ?? "Unknown",
    otherRole: row.other_role,
    otherStartupName: row.other_startup_name,
    otherFirm: row.other_firm,
  };
}

// ──────────────────────────────────────────────────────────────────────────
//  Queries
// ──────────────────────────────────────────────────────────────────────────

export async function fetchIntrosForUser(
  userId: string,
  opts: { direction?: IntroDirection | "all"; status?: IntroRequestStatus | "all"; limit?: number } = {},
): Promise<IntroSummary[]> {
  const direction = opts.direction ?? "all";
  const status = opts.status ?? "all";
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 500));

  return withUserRls<IntroSummary[]>(userId, async (sql) => {
    // We project the OTHER party in a single CTE-style join so the UI gets
    // everything it needs in one trip.
    const rows = await sql<RawRow[]>`
      with base as (
        select i.*,
          case when i.sender_user_id = ${userId}
               then i.recipient_user_id
               else i.sender_user_id
          end as other_user_id
        from public.intro_requests i
        where i.sender_user_id = ${userId} or i.recipient_user_id = ${userId}
      )
      select b.*,
             u.name as other_name,
             u.role as other_role,
             s.name as other_startup_name,
             inv.firm as other_firm
      from base b
      join public.users u on u.id = b.other_user_id
      left join public.startups s on s.user_id = b.other_user_id
      left join public.investors inv on inv.user_id = b.other_user_id
      where (${direction} = 'all'
             or (${direction} = 'incoming' and b.recipient_user_id = ${userId})
             or (${direction} = 'outgoing' and b.sender_user_id = ${userId}))
        and (${status} = 'all' or b.status::text = ${status})
        and not exists (
          select 1 from public.blocks bl
          where (bl.blocker_user_id = ${userId} and bl.blocked_user_id = b.other_user_id)
             or (bl.blocker_user_id = b.other_user_id and bl.blocked_user_id = ${userId})
        )
      order by b.created_at desc
      limit ${limit}
    `;

    console.log(
      `[intros:fetch] userId=${userId} direction=${direction} status=${status} returned=${rows.length}`,
    );
    return rows.map((r) => toSummary(r, userId));
  });
}

export async function fetchIntroById(
  introId: string,
  viewerId: string,
): Promise<IntroSummary | null> {
  return withUserRls<IntroSummary | null>(viewerId, async (sql) => {
    const rows = await sql<RawRow[]>`
      with base as (
        select i.*,
          case when i.sender_user_id = ${viewerId}
               then i.recipient_user_id
               else i.sender_user_id
          end as other_user_id
        from public.intro_requests i
        where i.id = ${introId}
          and (i.sender_user_id = ${viewerId} or i.recipient_user_id = ${viewerId})
        limit 1
      )
      select b.*,
             u.name as other_name,
             u.role as other_role,
             s.name as other_startup_name,
             inv.firm as other_firm
      from base b
      join public.users u on u.id = b.other_user_id
      left join public.startups s on s.user_id = b.other_user_id
      left join public.investors inv on inv.user_id = b.other_user_id
      limit 1
    `;
    return rows.length === 0 ? null : toSummary(rows[0], viewerId);
  });
}

export async function fetchIntroBadgeCounts(userId: string): Promise<IntroBadgeCounts> {
  return withUserRls<IntroBadgeCounts>(userId, async (sql) => {
    const rows = await sql<{ needs_response: number; awaiting_reply: number }[]>`
      with pending as (
        select sender_user_id, recipient_user_id,
               case when sender_user_id = ${userId}
                    then recipient_user_id else sender_user_id end as other_user_id
        from public.intro_requests
        where (sender_user_id = ${userId} or recipient_user_id = ${userId})
          and status = 'pending'
      )
      select
        count(*) filter (where recipient_user_id = ${userId})::int as needs_response,
        count(*) filter (where sender_user_id = ${userId})::int as awaiting_reply
      from pending p
      where not exists (
        select 1 from public.blocks bl
        where (bl.blocker_user_id = ${userId} and bl.blocked_user_id = p.other_user_id)
           or (bl.blocker_user_id = p.other_user_id and bl.blocked_user_id = ${userId})
      )
    `;
    return {
      needsResponse: rows[0]?.needs_response ?? 0,
      awaitingReply: rows[0]?.awaiting_reply ?? 0,
    };
  });
}

/**
 * Used by the "Send intro" UI on /p/[userId] and /matches to know whether
 * a button should be enabled (no pending intro outstanding for this match).
 *
 * Returns the existing pending intro (if any) so the UI can deep-link to it.
 */
export async function fetchPendingIntroForMatch(
  viewerId: string,
  matchId: string,
): Promise<IntroSummary | null> {
  return withUserRls<IntroSummary | null>(viewerId, async (sql) => {
    const rows = await sql<RawRow[]>`
      with base as (
        select i.*,
          case when i.sender_user_id = ${viewerId}
               then i.recipient_user_id
               else i.sender_user_id
          end as other_user_id
        from public.intro_requests i
        where i.match_id = ${matchId}
          and i.status = 'pending'
          and (i.sender_user_id = ${viewerId} or i.recipient_user_id = ${viewerId})
        order by i.created_at desc
        limit 1
      )
      select b.*,
             u.name as other_name,
             u.role as other_role,
             s.name as other_startup_name,
             inv.firm as other_firm
      from base b
      join public.users u on u.id = b.other_user_id
      left join public.startups s on s.user_id = b.other_user_id
      left join public.investors inv on inv.user_id = b.other_user_id
    `;
    return rows.length === 0 ? null : toSummary(rows[0], viewerId);
  });
}
