/**
 * lib/feed/impression-log.ts
 *
 * Server-side feed impression logger (Phase 14d).
 *
 * ─── PURPOSE ─────────────────────────────────────────────────────────────────
 * Records which candidates the feed showed to which users at which position.
 * Combined with public.interactions (like/pass/save), this enables:
 *   • precision@K: of the top-K candidates we showed, how many were liked?
 *   • NDCG: weighted ranking quality metric.
 *   • A/B testing: compare rankers by interaction rate per cohort.
 *
 * ─── CALL SITES ──────────────────────────────────────────────────────────────
 * Called from server components:
 *   app/(dashboard)/feed/page.tsx     — surface: 'feed_main'
 *   app/(dashboard)/dashboard/page.tsx — surface: 'dashboard_recommended'
 *
 * Both call sites gate on the feature flag 'feed_impression_logging'.
 *
 * ─── SAFETY GUARANTEES ───────────────────────────────────────────────────────
 * • Logging failures NEVER break feed rendering — all errors are caught and
 *   logged to console.error only.
 * • This function does NOT write to interactions, matches, profile_views,
 *   intro_requests, or any other table.
 * • This function does NOT re-sort or filter the items array.
 * • Rankings are not changed.  scoreMatch remains the ranker.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { withUserRls } from "@/lib/db";

/**
 * Minimal interface for a feed item that can be impression-logged.
 * Structurally compatible with FeedStartupCard and FeedInvestorCard from
 * lib/feed/query.ts without creating an import dependency on that module.
 */
type ImpressableItem = {
  card: { userId: string };
  match: { score: number };
};

type LogFeedImpressionsParams = {
  /** The user who is viewing the feed. */
  actorUserId: string;
  /**
   * Ordered list of feed items as rendered.  Index 0 → feed_position 1.
   * These must be the REAL items (not mock/demo backfill items).
   */
  items: ImpressableItem[];
  /**
   * UI surface.  Documented values:
   *   'feed_main'             — /feed full page
   *   'dashboard_recommended' — dashboard "Recommended for you" rail
   */
  surface: string;
  /**
   * Which ranker produced this ordered list.  Documented values:
   *   'scorematch'          — current production heuristic (Phase 14d)
   *   'scorematch+elig'     — future: with eligibility pre-filter
   *   'learning_model_v1'   — future: Phase 15 LogReg model
   *   'personalized_v1'     — future: Phase 16+ personalization
   */
  ranker: string;
  /**
   * A/B cohort tag.  Null when no experiment is running (Phase 14d default).
   * Set to e.g. 'control' or 'treatment_a' in Phase 15+.
   */
  experimentCohort?: string | null;
  /**
   * Snapshot of active filters/search/sort at the time of the render.
   * Null when the surface has no filters (e.g. dashboard rail).
   */
  filterContext?: Record<string, unknown> | null;
  /**
   * UUID shared by all impressions from a single render call.
   * Used for deduplication (unique index on actor + target + session).
   * Generate with crypto.randomUUID() at the call site.
   */
  renderSessionId?: string | null;
  // ── Phase 15: shadow model score columns ───────────────────────────────────
  /**
   * Per-target model scores from the Phase 15 shadow scorer.
   * Key = target_user_id; value = null when the pair could not be scored.
   * Omit this parameter entirely if shadow scoring is disabled (backward-
   * compatible: existing call sites that don't pass this will log null columns).
   */
  shadowScores?: Map<string, { modelScore: number; modelVersion: string } | null> | null;
};

// ── Row shape ─────────────────────────────────────────────────────────────────

/** One row as it will be written to public.feed_impressions. */
export type ImpressionRow = {
  actor_user_id:     string;
  target_user_id:    string;
  feed_position:     number;
  score:             number;
  ranker:            string;
  surface:           string;
  experiment_cohort: string | null;
  filter_context:    Record<string, unknown> | null;
  render_session_id: string | null;
  scorematch_score:  number;
  model_score:       number | null;
  model_version:     string | null;
};

/**
 * Pure helper — build the row objects that will be inserted into
 * public.feed_impressions.  No I/O, no DB access.
 *
 * Extracted so validation scripts can assert row shape without a real DB.
 * logFeedImpressions calls this internally; the SQL insert behaviour is unchanged.
 */
export function buildImpressionRows(params: LogFeedImpressionsParams): ImpressionRow[] {
  const {
    actorUserId,
    items,
    surface,
    ranker,
    experimentCohort = null,
    filterContext = null,
    renderSessionId = null,
    shadowScores = null,
  } = params;

  return items.map((item, idx) => {
    const shadow = shadowScores?.get(item.card.userId) ?? null;
    return {
      actor_user_id:     actorUserId,
      target_user_id:    item.card.userId,
      feed_position:     idx + 1,
      score:             item.match.score,
      ranker,
      surface,
      experiment_cohort: experimentCohort,
      filter_context:    filterContext,
      render_session_id: renderSessionId,
      scorematch_score:  item.match.score,
      model_score:       shadow?.modelScore ?? null,
      model_version:     shadow?.modelVersion ?? null,
    };
  });
}

/**
 * Batch-insert one feed_impressions row per item.
 *
 * Failures are caught internally and written to console.error — this
 * function never throws.  Awaiting it adds ≤ 20 ms for 50 rows on a
 * typical Railway Postgres instance.
 */
export async function logFeedImpressions(
  params: LogFeedImpressionsParams,
): Promise<void> {
  const { items } = params;

  if (items.length === 0) return;

  try {
    // Build the rows using the pure helper, then serialize and INSERT.
    const rows = buildImpressionRows(params);

    // withUserRls(null, ...) uses the service role — bypasses RLS so we can
    // write to a service-only table without a user-facing insert policy.
    // Serialize the rows as a JSON string so postgres.js sees a simple text
    // parameter.  json_to_recordset handles the Postgres-side parsing.
    // This avoids postgres.js typed-template overload ambiguity that arises
    // from mixed nullable types (uuid | null, jsonb | null, etc.) in the
    // sql(rows) multi-row helper.
    const payload = JSON.stringify(rows);

    await withUserRls(null, async (sql) => {
      // json_to_recordset turns the JSON array into a typed result set.
      // ON CONFLICT DO NOTHING: silently discards rows that would violate
      // the render-dedup partial unique index (actor+target+session_id).
      await sql`
        insert into public.feed_impressions
          (actor_user_id, target_user_id, feed_position, score,
           ranker, surface, experiment_cohort, filter_context, render_session_id,
           scorematch_score, model_score, model_version)
        select
          (x.actor_user_id)::uuid,
          (x.target_user_id)::uuid,
          (x.feed_position)::int,
          (x.score)::int,
          x.ranker::text,
          x.surface::text,
          x.experiment_cohort::text,
          x.filter_context::jsonb,
          (x.render_session_id)::uuid,
          (x.scorematch_score)::int,
          (x.model_score)::numeric,
          x.model_version::text
        from json_to_recordset(${payload}::json) as x(
          actor_user_id     text,
          target_user_id    text,
          feed_position     int,
          score             int,
          ranker            text,
          surface           text,
          experiment_cohort text,
          filter_context    json,
          render_session_id text,
          scorematch_score  int,
          model_score       numeric,
          model_version     text
        )
        on conflict do nothing
      `;
    });
  } catch (err) {
    // Intentionally swallowed.  Impression logging must never block rendering.
    console.error(
      `[feed:impressions] failed actor=${params.actorUserId}` +
      ` surface=${params.surface} ranker=${params.ranker}` +
      ` n=${params.items.length}:`,
      err instanceof Error ? err.message : "unknown error",
    );
  }
}
