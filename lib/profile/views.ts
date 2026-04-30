"use server";

import { withUserRls } from "@/lib/db";

/**
 * Record a profile view, debounced to one row per (viewer, target) per 24h.
 *
 * Why an action instead of a regular insert in the page query: the page
 * itself is a Server Component and might be re-rendered for caching /
 * RSC navigation reasons that aren't real "I opened the page" intent.
 * Calling this from the page once on render is fine — the 24h debounce
 * cap means we don't pollute the table even if RSC re-renders happen.
 *
 * Self-views are silently ignored.
 */
export async function recordProfileView(
  viewerUserId: string,
  targetUserId: string,
): Promise<void> {
  if (!viewerUserId || !targetUserId || viewerUserId === targetUserId) return;

  try {
    await withUserRls(viewerUserId, async (sql) => {
      // Insert only if (a) no view by this viewer in the last 24h, and
      // (b) no block exists in either direction.
      const rows = await sql<{ id: string }[]>`
        insert into public.profile_views (viewer_user_id, target_user_id)
        select ${viewerUserId}, ${targetUserId}
        where not exists (
          select 1 from public.profile_views
          where viewer_user_id = ${viewerUserId}
            and target_user_id = ${targetUserId}
            and viewed_at > now() - interval '24 hours'
        )
        and not exists (
          select 1 from public.blocks
          where (blocker_user_id = ${viewerUserId} and blocked_user_id = ${targetUserId})
             or (blocker_user_id = ${targetUserId} and blocked_user_id = ${viewerUserId})
        )
        returning id
      `;
      if (rows.length > 0) {
        console.log(
          `[profile:view-record] viewer=${viewerUserId} target=${targetUserId} id=${rows[0].id}`,
        );
      }
    });
  } catch (err) {
    // Non-fatal — analytics signal. We swallow so that a temp DB issue
    // never blocks profile rendering.
    console.warn("[profile:view-record] failed", err);
  }
}
