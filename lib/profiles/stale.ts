import { withUserRls } from "@/lib/db";

/**
 * Stale profile detection.
 *
 * Two surfaces:
 *   1. Cron (daily): enqueue "freshen up" emails for users who haven't
 *      updated their profile in 90+ days.
 *   2. Read path: isProfileStale(updatedAt) returns true when > 90 days —
 *      the UI shows a freshness badge on /p/[userId].
 *
 * The feed query down-ranks stale profiles in Sprint 15.A by applying a
 * 0.7 multiplier to the match score for profiles > 180 days old.
 */

const STALE_DAYS = 90;
const VERY_STALE_DAYS = 180;

export function isProfileStale(updatedAt: Date | string | null): boolean {
  if (!updatedAt) return true;
  const ms = Date.now() - new Date(updatedAt).getTime();
  return ms > STALE_DAYS * 24 * 60 * 60 * 1000;
}

export function isProfileVeryStale(updatedAt: Date | string | null): boolean {
  if (!updatedAt) return true;
  const ms = Date.now() - new Date(updatedAt).getTime();
  return ms > VERY_STALE_DAYS * 24 * 60 * 60 * 1000;
}

/** Multiplier for the feed ranking. 1.0 = fresh, 0.7 = very stale. */
export function freshnessFactor(updatedAt: Date | string | null): number {
  if (isProfileVeryStale(updatedAt)) return 0.7;
  return 1.0;
}

/**
 * Cron-invocable: find users with stale profiles who haven't received
 * a freshen-up email in the last 30 days, enqueue an email for each.
 */
export async function processStaleReminders(): Promise<number> {
  return withUserRls<number>(null, async (sql) => {
    type Row = { id: string };

    // Users who:
    //   - Are verified (no point reminding unverified)
    //   - Haven't updated their profile in 90+ days
    //   - Aren't paused or deleting
    //   - Haven't received a freshen-up email in the last 30 days
    const users = await sql<Row[]>`
      select u.id
      from public.users u
      left join public.startups s on s.user_id = u.id
      left join public.investors i on i.user_id = u.id
      where u.account_label = 'verified'
        and u.account_paused_at is null
        and u.deletion_requested_at is null
        and (
          (s.updated_at is not null and s.updated_at < now() - interval '90 days')
          or (i.updated_at is not null and i.updated_at < now() - interval '90 days')
        )
        and not exists (
          select 1 from public.email_outbox eo
          where eo.user_id = u.id
            and eo.template = 'reminder.complete_profile'
            and eo.created_at > now() - interval '30 days'
        )
      limit 200
    `;

    let count = 0;
    for (const u of users) {
      try {
        await sql`
          insert into public.email_outbox (user_id, template, payload)
          values (${u.id}, 'reminder.complete_profile', '{}'::jsonb)
        `;
        count++;
      } catch {
        // Skip on error, continue with next user.
      }
    }

    console.log(`[stale] scanned ${users.length} users, enqueued ${count} reminders`);
    return count;
  });
}
