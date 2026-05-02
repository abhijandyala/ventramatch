/**
 * lib/feed/ml-ranker.ts
 *
 * Phase 16 ML ranking wrapper.
 *
 * Takes the ordered output of fetchFeedForFounder/fetchFeedForInvestor (which
 * is always ranked by scoreMatch) and, when the feature flag is enabled,
 * re-ranks it using the Phase 11c LogReg champion model.
 *
 * ─── NOTICE ──────────────────────────────────────────────────────────────────
 * • Offline experimental model.  Not investment advice.
 * • Does not predict startup success or investment returns.
 * • scoreMatch in lib/matching/score.ts is the fallback and remains authoritative
 *   for the 'scorematch' and 'scorematch_fallback' ranker tags.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ─── RANKING CONTRACT ────────────────────────────────────────────────────────
 * When flag is ON and model scoring succeeds:
 *
 *   Bucket A — eligible + model-scored:
 *     sorted by modelScore desc, then scoreMatch score desc, then userId asc
 *
 *   Bucket B — eligible but null model score (feature extraction failed):
 *     sorted by scoreMatch score desc, then userId asc
 *
 *   Bucket C — ineligible (hard eligibility gate fired):
 *     sorted by scoreMatch score desc, then userId asc
 *
 *   Final order: [...A, ...B, ...C]
 *
 *   Ineligible items can NEVER appear before eligible items regardless of
 *   model score or scoreMatch score. This is a hard safety invariant.
 *
 *   No items are dropped or duplicated. output.length === input.length always.
 *
 * ─── FALLBACK PATHS ──────────────────────────────────────────────────────────
 * 1. flagEnabled=false  → input items unchanged; ranker="scorematch"
 * 2. Timeout (250ms default) or scoring throws → scoreMatch order; ranker="scorematch_fallback"
 * 3. null model scores ≥ 50% of items → scoreMatch order; ranker="scorematch_fallback"
 * 4. Any uncaught error in this wrapper → scoreMatch order; ranker="scorematch_fallback"
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { computeShadowScores, type ShadowScoreMap } from "@/lib/feed/shadow-score";
import { loadBehaviorForActor, type BehaviorSet } from "@/lib/personalization/runtime/behavior-loader";
import { buildPreferenceVector, type StartupContext } from "@/lib/personalization/runtime/preference-vector";
import { personalizeBucketA } from "@/lib/personalization/runtime/personalize-score";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Minimal interface for a feed item the ranker processes.
 * Structurally compatible with FeedStartupCard and FeedInvestorCard from
 * lib/feed/query.ts without creating a hard import dependency.
 */
type RankableItem = {
  card: { userId: string };
  match: { score: number };
};

/** Documented ranker tags written to feed_impressions.ranker. */
export type RankerTag =
  | "scorematch"           // flag off — original scoreMatch order
  | "learning_model_v1"   // ML ranked; no personalization (or personalization skipped)
  | "scorematch_fallback"  // ML attempted, fell back to scoreMatch
  | "personalized_v1";    // ML ranked + behavior personalization applied to Bucket A

/** Result of rankFeedForViewer. */
export type RankResult<T extends RankableItem> = {
  /** Reordered (or identical) feed items ready to render. */
  items: T[];
  /** Which ranker produced this ordering — for feed_impressions logging. */
  ranker: RankerTag;
  /** Model scores per target user — pass to logFeedImpressions.shadowScores. */
  shadowScores: ShadowScoreMap | null;
  /** Why a fallback was used, when ranker is "scorematch_fallback". */
  fallbackReason?: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

/** Fraction of null model scores that triggers a full scoreMatch fallback. */
const NULL_RATE_FALLBACK_THRESHOLD = 0.5;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Stable comparator: higher score first; tie-break by string sort on userId. */
function byScoreMatchThenId(a: RankableItem, b: RankableItem): number {
  const scoreDiff = b.match.score - a.match.score;
  if (scoreDiff !== 0) return scoreDiff;
  return a.card.userId < b.card.userId ? -1 : a.card.userId > b.card.userId ? 1 : 0;
}

/** Build a timeout promise that rejects after `ms` milliseconds. */
function rejectAfter(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`ml-ranker: scoring timed out after ${ms}ms`)), ms),
  );
}

// ── Core ML sort ─────────────────────────────────────────────────────────────

type MlBuckets<T extends RankableItem> = {
  bucketA: T[];                            // eligible + scored, in ML order
  bucketAModelScores: Map<string, number>; // userId → modelScore for Bucket A items
  bucketB: T[];                            // eligible, null score (scoreMatch order)
  bucketC: T[];                            // ineligible (scoreMatch order)
};

/**
 * Partition items into three buckets and sort each in ML order.
 * Returns raw buckets so personalization can re-order Bucket A independently.
 */
function partitionBuckets<T extends RankableItem>(
  items: T[],
  shadowScores: ShadowScoreMap,
): MlBuckets<T> {
  const bucketAScored: { item: T; modelScore: number }[] = [];
  const bucketB: T[] = [];
  const bucketC: T[] = [];

  for (const item of items) {
    const entry = shadowScores.get(item.card.userId) ?? null;

    if (!entry) {
      // Could not score at all — treat as eligible-but-null (bucket B).
      bucketB.push(item);
      continue;
    }

    if (!entry.eligibility.eligible_for_model_ranking) {
      bucketC.push(item);
      continue;
    }

    if (!Number.isFinite(entry.modelScore) || entry.modelScore < 0 || entry.modelScore > 4) {
      bucketB.push(item);
      continue;
    }

    bucketAScored.push({ item, modelScore: entry.modelScore });
  }

  // Sort bucket A: modelScore desc → scoreMatch desc → userId asc.
  bucketAScored.sort((a, b) => {
    const modelDiff = b.modelScore - a.modelScore;
    if (modelDiff !== 0) return modelDiff;
    return byScoreMatchThenId(a.item, b.item);
  });

  // Buckets B and C: scoreMatch desc → userId asc.
  bucketB.sort(byScoreMatchThenId);
  bucketC.sort(byScoreMatchThenId);

  return {
    bucketA:           bucketAScored.map((x) => x.item),
    bucketAModelScores: new Map(bucketAScored.map((x) => [x.item.card.userId, x.modelScore])),
    bucketB,
    bucketC,
  };
}

/** Assemble the three buckets into the final ordered list. */
function assembleBuckets<T extends RankableItem>(
  buckets: MlBuckets<T>,
  personalizedA?: T[],
): T[] {
  return [
    ...(personalizedA ?? buckets.bucketA),
    ...buckets.bucketB,
    ...buckets.bucketC,
  ];
}

/**
 * Build a StartupContext map from shadow scores for Bucket A personalization.
 * In Phase 17 we use the data already available in the target user IDs;
 * the actual startup context comes from a separate query or the shadow score
 * entry is extended in Phase 18.  For now we build minimal contexts from
 * what the page already fetched and passed as items.
 */
function buildStartupCtxsFromItems<T extends RankableItem & {
  card: {
    userId: string;
    // Optional enrichment fields forwarded from StartupPublic / InvestorPublic.
    // These may be undefined when the card is a Phase 16-era projected card.
    startup_sectors?: string[] | null;
    industry?: string | null;
    stage?: string | null;
    location?: string | null;
    customer_type?: string | null;
  };
}>(items: T[]): Map<string, StartupContext> {
  const ctxMap = new Map<string, StartupContext>();
  for (const item of items) {
    ctxMap.set(item.card.userId, {
      userId:         item.card.userId,
      startup_sectors: item.card.startup_sectors ?? null,
      industry:        item.card.industry ?? null,
      stage:           (item.card as { stage?: string | null }).stage ?? null,
      location:        (item.card as { location?: string | null }).location ?? null,
      customer_type:   (item.card as { customer_type?: string | null }).customer_type ?? null,
    });
  }
  return ctxMap;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Re-rank feed items using the Phase 16/17 ML model + optional personalization.
 *
 * @param actorUserId           Viewer's user ID.
 * @param actorRole             "investor" or "founder".
 * @param items                 Feed items in scoreMatch order.
 * @param flagEnabled           feed_ml_ranking flag value.
 * @param personalizationEnabled feed_personalization flag value.
 * @param timeoutMs             ML scoring timeout (default 250 ms).
 * @param personalizationTimeoutMs  Personalization timeout (default 150 ms).
 * @param _scoringFn            @internal test override for computeShadowScores.
 * @param _behaviorLoaderFn     @internal test override for loadBehaviorForActor.
 *
 * Fallback chain:
 *   personalization fails → ML ranking order (learning_model_v1)
 *   ML fails/timeout      → scoreMatch order (scorematch_fallback)
 *   flag off              → scoreMatch order (scorematch)
 *
 * Safety invariants:
 *   • Never throws. All errors produce a graceful fallback.
 *   • Never drops or duplicates items. output.length === input.length always.
 *   • Ineligible items (Bucket C) are always after eligible items.
 *   • Personalization never promotes Bucket B or C above Bucket A.
 *   • Cold-start users (behavior_confidence < 0.03) → personalization skipped.
 *   • Personalization requires flagEnabled=true; ignored when ML is off.
 */
export async function rankFeedForViewer<T extends RankableItem>(params: {
  actorUserId: string;
  actorRole: "investor" | "founder";
  items: T[];
  flagEnabled: boolean;
  personalizationEnabled?: boolean;
  timeoutMs?: number;
  personalizationTimeoutMs?: number;
  /** @internal Test-only override for the shadow scoring function. */
  _scoringFn?: (p: { actorUserId: string; actorRole: "investor" | "founder"; targetUserIds: string[] }) => Promise<ShadowScoreMap>;
  /** @internal Test-only override for the behavior loading function. */
  _behaviorLoaderFn?: (actorUserId: string) => Promise<BehaviorSet>;
}): Promise<RankResult<T>> {
  const {
    actorUserId,
    actorRole,
    items,
    flagEnabled,
    personalizationEnabled = false,
    timeoutMs = 250,
    personalizationTimeoutMs = 150,
    _scoringFn,
    _behaviorLoaderFn,
  } = params;

  // ── ML flag off: preserve scoreMatch order exactly ────────────────────
  if (!flagEnabled) {
    return { items, ranker: "scorematch", shadowScores: null };
  }

  if (items.length === 0) {
    return { items, ranker: "learning_model_v1", shadowScores: null };
  }

  const targetUserIds = items.map((it) => it.card.userId);

  try {
    // ── Race model scoring against timeout ────────────────────────────────
    const scoreFn = _scoringFn ?? computeShadowScores;
    const shadowScores = await Promise.race([
      scoreFn({ actorUserId, actorRole, targetUserIds }),
      rejectAfter(timeoutMs),
    ]);

    // ── Bulk null-rate check ──────────────────────────────────────────────
    const nullCount = items.filter((it) => {
      const entry = shadowScores.get(it.card.userId);
      return !entry || !Number.isFinite(entry.modelScore);
    }).length;

    if (nullCount / items.length >= NULL_RATE_FALLBACK_THRESHOLD) {
      return {
        items,
        ranker: "scorematch_fallback",
        shadowScores,
        fallbackReason: `null rate ${nullCount}/${items.length} exceeded ${NULL_RATE_FALLBACK_THRESHOLD}`,
      };
    }

    // ── Apply ML ranking (Phase 16) ────────────────────────────────────────
    const buckets = partitionBuckets(items, shadowScores);

    // ── Phase 17: Personalize Bucket A (flag-gated) ────────────────────────
    if (personalizationEnabled && buckets.bucketA.length > 0) {
      try {
        const behaviorLoaderFn = _behaviorLoaderFn ?? loadBehaviorForActor;

        // Race behavior loading against personalization timeout.
        const behaviorSet = await Promise.race([
          behaviorLoaderFn(actorUserId),
          rejectAfter(personalizationTimeoutMs),
        ]);

        // Build startup contexts from the items available.
        // In Phase 17 the projected card objects may or may not have enrichment
        // fields; buildStartupCtxsFromItems is defensive.
        const ctxMap = buildStartupCtxsFromItems(buckets.bucketA);

        const prefVector = buildPreferenceVector(behaviorSet.events, ctxMap);

        if (!prefVector.is_cold_start) {
          const { items: personalizedA, applied } = personalizeBucketA(
            buckets.bucketA,
            buckets.bucketAModelScores,
            ctxMap,
            prefVector,
          );

          if (applied) {
            const finalItems = assembleBuckets(buckets, personalizedA);
            return { items: finalItems, ranker: "personalized_v1", shadowScores };
          }
        }
        // Cold-start or personalization returned applied=false → fall through to ML order.
      } catch (persErr) {
        // Personalization failure → use ML order (not scoreMatch fallback).
        console.error(
          `[ml-ranker] personalization skipped for actor=${actorUserId}:`,
          persErr instanceof Error ? persErr.message : "unknown error",
        );
      }
    }

    // ── ML order (no personalization or personalization skipped/failed) ────
    const mlItems = assembleBuckets(buckets);
    return { items: mlItems, ranker: "learning_model_v1", shadowScores };

  } catch (err) {
    // ML timeout, DB error, or any other failure → scoreMatch order.
    const reason = err instanceof Error ? err.message : "unknown error";
    console.error(`[ml-ranker] fallback for actor=${actorUserId}: ${reason}`);
    return {
      items,
      ranker: "scorematch_fallback",
      shadowScores: null,
      fallbackReason: reason,
    };
  }
}
