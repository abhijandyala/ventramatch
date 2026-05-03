/**
 * lib/personalization/runtime/behavior-loader.ts
 *
 * Phase 17 — Load the actor's recent behavior signals from production tables.
 *
 * ─── NOTICE ──────────────────────────────────────────────────────────────────
 * • Not investment advice.
 * • Does not predict startup success or investment returns.
 * • scoreMatch in lib/matching/score.ts is the fallback ranker.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Sources queried:
 *   public.interactions    — like / save / pass
 *   public.profile_views   — profile_view
 *   public.intro_requests  — intro_request (sent by actor)
 *
 * 90-day lookback; cap 500 rows per source to bound memory and latency.
 * All queries respect RLS via the actor's own session.
 */

import { withUserRls } from "@/lib/db";

// ── Types ──────────────────────────────────────────────────────────────────

export type BehaviorAction =
  | "like"
  | "save"
  | "pass"
  | "profile_view"
  | "intro_request";

export type BehaviorEvent = {
  targetUserId: string;
  action: BehaviorAction;
  createdAt: Date;
};

export type BehaviorSet = {
  events: BehaviorEvent[];
  /** Epoch the load ran — for cache/debug purposes. */
  loadedAt: Date;
};

// ── Empty set helper ───────────────────────────────────────────────────────

const EMPTY_BEHAVIOR: BehaviorSet = { events: [], loadedAt: new Date(0) };

// ── Loader ─────────────────────────────────────────────────────────────────

/**
 * Load the actor's behavior events from the last 90 days.
 *
 * @param actorUserId  The viewing user's ID.  Uses their RLS context.
 * @returns BehaviorSet — always resolves, never rejects.
 *          On DB failure, returns an empty set so personalization is skipped.
 */
export async function loadBehaviorForActor(
  actorUserId: string,
): Promise<BehaviorSet> {
  const events: BehaviorEvent[] = [];

  try {
    await withUserRls(actorUserId, async (sql) => {
      // ── Interactions (like / save / pass) ─────────────────────────────
      type InteractionRow = {
        target_user_id: string;
        action: string;
        created_at: Date;
      };
      const interactionRows = await sql<InteractionRow[]>`
        select target_user_id, action::text, created_at
        from public.interactions
        where actor_user_id = ${actorUserId}
          and created_at > now() - interval '90 days'
        order by created_at desc
        limit 500
      `;
      for (const r of interactionRows) {
        const a = r.action as BehaviorAction;
        if (a === "like" || a === "save" || a === "pass") {
          events.push({
            targetUserId: r.target_user_id,
            action: a,
            createdAt: new Date(r.created_at),
          });
        }
      }

      // ── Profile views ─────────────────────────────────────────────────
      type ViewRow = {
        target_user_id: string;
        viewed_at: Date;
      };
      const viewRows = await sql<ViewRow[]>`
        select target_user_id, viewed_at
        from public.profile_views
        where viewer_user_id = ${actorUserId}
          and viewed_at > now() - interval '90 days'
        order by viewed_at desc
        limit 500
      `;
      for (const r of viewRows) {
        events.push({
          targetUserId: r.target_user_id,
          action: "profile_view",
          createdAt: new Date(r.viewed_at),
        });
      }

      // ── Intro requests sent by actor ──────────────────────────────────
      type IntroRow = {
        recipient_user_id: string;
        created_at: Date;
      };
      const introRows = await sql<IntroRow[]>`
        select recipient_user_id, created_at
        from public.intro_requests
        where sender_user_id = ${actorUserId}
          and created_at > now() - interval '90 days'
        order by created_at desc
        limit 500
      `;
      for (const r of introRows) {
        events.push({
          targetUserId: r.recipient_user_id,
          action: "intro_request",
          createdAt: new Date(r.created_at),
        });
      }
    });
  } catch (err) {
    // DB failure → return empty behavior so personalization is skipped.
    console.error(
      `[personalization:behavior-loader] failed for actor=${actorUserId}:`,
      err instanceof Error ? err.message : "unknown error",
    );
    return { ...EMPTY_BEHAVIOR, loadedAt: new Date() };
  }

  return { events, loadedAt: new Date() };
}
