import { withUserRls } from "@/lib/db";

/**
 * Build the payload for a single user's weekly digest email.
 *
 * Reads the last 7 days of activity and returns a structured payload
 * that the email template can render. The cron calls this for every
 * user with notification_prefs.weeklyDigest = true, then enqueues the
 * payload into email_outbox with template 'digest.weekly'.
 */

export type DigestPayload = {
  recipientName: string;
  newFeedMatches: number;
  unansweredIntros: number;
  recentProfileViews: number;
  completionPct: number;
};

export async function buildDigestForUser(
  userId: string,
): Promise<DigestPayload | null> {
  return withUserRls<DigestPayload | null>(null, async (sql) => {
    const user = await sql<{ name: string | null; profile_completion_pct: number }[]>`
      select name, profile_completion_pct from public.users where id = ${userId} limit 1
    `;
    if (user.length === 0) return null;

    const [matches, intros, views] = await Promise.all([
      sql<{ count: number }[]>`
        select count(*)::int as count from public.matches
        where (founder_user_id = ${userId} or investor_user_id = ${userId})
          and matched_at > now() - interval '7 days'
      `,
      sql<{ count: number }[]>`
        select count(*)::int as count from public.intro_requests
        where recipient_user_id = ${userId}
          and status = 'pending'
      `,
      sql<{ count: number }[]>`
        select count(*)::int as count from public.profile_views
        where target_user_id = ${userId}
          and viewed_at > now() - interval '7 days'
      `,
    ]);

    return {
      recipientName: user[0].name ?? "there",
      newFeedMatches: matches[0]?.count ?? 0,
      unansweredIntros: intros[0]?.count ?? 0,
      recentProfileViews: views[0]?.count ?? 0,
      completionPct: user[0].profile_completion_pct ?? 0,
    };
  });
}

/**
 * Process all eligible users and enqueue digest emails.
 * Called from /api/cron/digest (Railway scheduled, Mondays 9am UTC).
 */
export async function processDigests(): Promise<number> {
  return withUserRls<number>(null, async (sql) => {
    // Find users who opted in to weekly digest.
    const users = await sql<{ id: string }[]>`
      select id from public.users
      where (notification_prefs ->> 'weeklyDigest')::boolean = true
        and account_paused_at is null
        and deletion_requested_at is null
        and account_label = 'verified'
    `;

    let count = 0;
    for (const u of users) {
      try {
        const payload = await buildDigestForUser(u.id);
        if (!payload) continue;

        // Skip if nothing happened this week.
        if (
          payload.newFeedMatches === 0 &&
          payload.unansweredIntros === 0 &&
          payload.recentProfileViews === 0
        ) {
          continue;
        }

        await sql`
          insert into public.email_outbox (user_id, template, payload)
          values (${u.id}, 'digest.weekly', ${JSON.stringify(payload)}::jsonb)
        `;
        count++;
      } catch (err) {
        console.error(`[digest] failed for userId=${u.id}`, err);
      }
    }

    console.log(`[digest] processed ${users.length} users, enqueued ${count}`);
    return count;
  });
}
