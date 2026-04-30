import { withUserRls } from "@/lib/db";

/**
 * Activity timeline — a chronological view of things that happened to
 * the current user. Derived from existing tables (no new table needed).
 *
 * Sources (UNION, ordered by timestamp desc):
 *   1. profile_views → "X viewed your profile"
 *   2. matches → "You matched with X"
 *   3. intro_requests (sender_user_id = me) → "You sent an intro to X"
 *   4. intro_requests (recipient_user_id = me) → "X sent you an intro"
 *   5. verifications (status=confirmed) → "Your employment at X was confirmed"
 *   6. notifications (system announcements) → pass-through
 *
 * Each row is normalised to { kind, ts, label, link }.
 */

export type ActivityItem = {
  kind: "view" | "match" | "intro_sent" | "intro_received" | "verification" | "system";
  ts: Date;
  label: string;
  link: string | null;
};

export async function fetchActivityTimeline(
  userId: string,
  opts: { limit?: number } = {},
): Promise<ActivityItem[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? 50, 200));

  return withUserRls<ActivityItem[]>(userId, async (sql) => {
    type Row = {
      kind: ActivityItem["kind"];
      ts: Date | string;
      label: string;
      link: string | null;
    };

    const rows = await sql<Row[]>`
      (
        select
          'view'::text as kind,
          pv.viewed_at as ts,
          coalesce(u.name, 'Someone') || ' viewed your profile' as label,
          '/p/' || pv.viewer_user_id as link
        from public.profile_views pv
        join public.users u on u.id = pv.viewer_user_id
        where pv.target_user_id = ${userId}
        order by pv.viewed_at desc
        limit ${limit}
      )
      union all
      (
        select
          'match'::text as kind,
          m.matched_at as ts,
          'Mutual match with ' || coalesce(
            case when m.founder_user_id = ${userId}
                 then (select name from public.users where id = m.investor_user_id)
                 else (select name from public.users where id = m.founder_user_id)
            end, 'someone'
          ) as label,
          '/matches' as link
        from public.matches m
        where m.founder_user_id = ${userId} or m.investor_user_id = ${userId}
        order by m.matched_at desc
        limit ${limit}
      )
      union all
      (
        select
          'intro_sent'::text as kind,
          ir.created_at as ts,
          'You sent an intro request to ' || coalesce(
            (select name from public.users where id = ir.recipient_user_id), 'someone'
          ) as label,
          '/inbox/' || ir.id as link
        from public.intro_requests ir
        where ir.sender_user_id = ${userId}
        order by ir.created_at desc
        limit ${limit}
      )
      union all
      (
        select
          'intro_received'::text as kind,
          ir.created_at as ts,
          coalesce(
            (select name from public.users where id = ir.sender_user_id), 'Someone'
          ) || ' sent you an intro request' as label,
          '/inbox/' || ir.id as link
        from public.intro_requests ir
        where ir.recipient_user_id = ${userId}
        order by ir.created_at desc
        limit ${limit}
      )
      union all
      (
        select
          'verification'::text as kind,
          v.created_at as ts,
          'Verification confirmed: ' || coalesce(v.claim_summary, v.kind::text) as label,
          '/build#verification-panel' as link
        from public.verifications v
        where v.user_id = ${userId} and v.status = 'confirmed'
        order by v.created_at desc
        limit ${limit}
      )
      order by ts desc
      limit ${limit}
    `;

    return rows.map((r) => ({
      kind: r.kind as ActivityItem["kind"],
      ts: new Date(r.ts),
      label: r.label,
      link: r.link,
    }));
  });
}
