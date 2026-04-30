import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";

/**
 * GET /api/account/export
 *
 * Returns a JSON snapshot of everything we hold about the requesting user.
 * Triggered by the "Download my data" button on /settings.
 *
 * Scope (per docs/legal.md → user data rights):
 *   • users row (sans password_hash)
 *   • startups / investors profile (whichever applies)
 *   • interactions and matches (both directions)
 *   • intro_requests (sender or recipient)
 *   • notification preferences + consent timestamps
 *
 * We do NOT include the OTHER party's identifying info verbatim — only their
 * user_id — to avoid leaking third-party data through one user's export.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const userId = session.user.id;

  const data = await withUserRls<Record<string, unknown>>(userId, async (sql) => {
    const [
      userRows,
      startupRows,
      investorRows,
      interactionRows,
      matchRows,
      introRows,
    ] = await Promise.all([
      sql`
        select id, email, name, role, image, account_label, profile_state,
               profile_completion_pct, marketing_opt_in, notification_prefs,
               linkedin_url, github_url, website_url,
               tos_accepted_at, privacy_accepted_at, account_paused_at,
               deletion_requested_at, email_verified_at, onboarding_completed,
               created_at, updated_at
        from public.users where id = ${userId}
      `,
      sql`select * from public.startups where user_id = ${userId}`,
      sql`select * from public.investors where user_id = ${userId}`,
      sql`
        select id, action, target_user_id, created_at
        from public.interactions
        where actor_user_id = ${userId}
        order by created_at desc
      `,
      sql`
        select id, founder_user_id, investor_user_id, matched_at, contact_unlocked
        from public.matches
        where founder_user_id = ${userId} or investor_user_id = ${userId}
        order by matched_at desc
      `,
      sql`
        select id, match_id, sender_user_id, recipient_user_id, status,
               message, proposed_times, link_url, accepted_time,
               response_message, responded_at, expires_at, created_at, updated_at
        from public.intro_requests
        where sender_user_id = ${userId} or recipient_user_id = ${userId}
        order by created_at desc
      `,
    ]);

    return {
      meta: {
        exportedAt: new Date().toISOString(),
        version: 1,
        userId,
        notice:
          "Counterparty user_ids appear here for your records. Their personal info has been omitted; their data export contains their copy.",
      },
      user: userRows[0] ?? null,
      profile: {
        startup: startupRows[0] ?? null,
        investor: investorRows[0] ?? null,
      },
      interactions: interactionRows,
      matches: matchRows,
      introRequests: introRows,
    };
  });

  console.log(`[account:export] userId=${userId}`);

  const filename = `ventramatch-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
