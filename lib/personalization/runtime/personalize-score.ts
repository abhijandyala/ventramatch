/**
 * lib/personalization/runtime/personalize-score.ts
 *
 * Phase 17 — Personalize Bucket A (eligible + model-scored items) by
 * blending the global ML score with the actor's preference vector.
 *
 * ─── NOTICE ──────────────────────────────────────────────────────────────────
 * • Not investment advice.
 * • Does not predict startup success or investment returns.
 * • scoreMatch in lib/matching/score.ts is the fallback ranker.
 * • Personalization CANNOT override hard eligibility.
 *   Bucket B (null-scored) and Bucket C (ineligible) are never passed to
 *   this function and are always placed after Bucket A in the final feed.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ─── BLENDING FORMULA (mirrors personalize.py Phase 12b-i) ───────────────────
 *   global_norm          = modelScore / 4.0          ∈ [0, 1]
 *   personalization_score                            ∈ [-1, 1]
 *   final_score          = global_norm + behavior_confidence × 0.5 × personalization_score
 *
 * The global model dominates at all confidence levels.  A maximally active
 * user (confidence ≈ 0.40) can shift a ranking by at most ±20% of the score
 * range (0.40 × 0.5 = ±0.20).  Cold-start users (confidence < 0.03) shift
 * by < ±1.5%.
 *
 * ─── DIMENSION WEIGHTS (Phase 17) ────────────────────────────────────────────
 *   sector          0.25
 *   stage           0.15
 *   customer_type   0.15
 *   geography       0.10
 *   business_model  0.00  (deferred — no production column yet)
 *   lead_follow     0.00  (deferred — no production data yet)
 *   semantic        0.00  (deferred — no embeddings yet)
 *   ───────────────────────
 *   Total active    0.65  (remaining 0.35 contributes 0)
 */

import type { PreferenceVector, StartupContext } from "@/lib/personalization/runtime/preference-vector";
import { normaliseSector } from "@/lib/profile/sectors";

// ── Constants ─────────────────────────────────────────────────────────────

const DIM_WEIGHTS = {
  sector:         0.25,
  stage:          0.15,
  customer_type:  0.15,
  geography:      0.10,
  // Deferred dimensions — reserved for Phase 18+:
  business_model: 0.00,
  lead_follow:    0.00,
  semantic:       0.00,
} as const;

const EXPECTED_LABEL_MAX = 4.0;

// ── Types ──────────────────────────────────────────────────────────────────

type RankableItem = {
  card: { userId: string };
  match: { score: number };
};

export type PersonalizeResult<T extends RankableItem> = {
  items: T[];
  /** True if personalization was meaningfully applied (changed/confirmed order). */
  applied: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────

function clamp(v: number, lo = -1, hi = 1): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Best-match score from a preference map vs a list of values. */
function mapScore(prefMap: Record<string, number>, values: string[]): number {
  if (values.length === 0 || Object.keys(prefMap).length === 0) return 0;
  return Math.max(0, ...values.map((v) => prefMap[v] ?? 0));
}

// ── Per-candidate dimension scores ────────────────────────────────────────

function dimSector(ctx: StartupContext, pref: PreferenceVector): number {
  const sectors = [
    ...(ctx.startup_sectors ?? []),
    ...(ctx.industry ? [ctx.industry] : []),
  ].map((s) => normaliseSector(s)).filter(Boolean);
  const pos = mapScore(pref.positive_sectors, sectors);
  const neg = mapScore(pref.negative_sectors, sectors);
  return clamp(pos - neg);
}

function dimStage(ctx: StartupContext, pref: PreferenceVector): number {
  const stages = ctx.stage ? [ctx.stage] : [];
  const pos = mapScore(pref.positive_stages, stages);
  const neg = mapScore(pref.negative_stages, stages);
  return clamp(pos - neg);
}

function dimCustomerType(ctx: StartupContext, pref: PreferenceVector): number {
  const ctypes = ctx.customer_type ? [ctx.customer_type] : [];
  const pos = mapScore(pref.positive_customer_types, ctypes);
  const neg = mapScore(pref.negative_customer_types, ctypes);
  return clamp(pos - neg);
}

function dimGeography(ctx: StartupContext, pref: PreferenceVector): number {
  const geos = ctx.location ? [ctx.location.split(",")[0].trim()] : [];
  const pos = mapScore(pref.positive_geographies, geos);
  const neg = mapScore(pref.negative_geographies, geos);
  return clamp(pos - neg);
}

function personalizationScore(ctx: StartupContext, pref: PreferenceVector): number {
  const dims =
    DIM_WEIGHTS.sector        * dimSector(ctx, pref) +
    DIM_WEIGHTS.stage         * dimStage(ctx, pref) +
    DIM_WEIGHTS.customer_type * dimCustomerType(ctx, pref) +
    DIM_WEIGHTS.geography     * dimGeography(ctx, pref);
  // business_model, lead_follow, semantic → 0.0 in Phase 17
  return clamp(dims);
}

// ── Stable comparator ─────────────────────────────────────────────────────

function byFinalScore(
  a: { finalScore: number; modelScore: number; item: RankableItem },
  b: { finalScore: number; modelScore: number; item: RankableItem },
): number {
  const fd = b.finalScore - a.finalScore;
  if (fd !== 0) return fd;
  const md = b.modelScore - a.modelScore;
  if (md !== 0) return md;
  const sd = b.item.match.score - a.item.match.score;
  if (sd !== 0) return sd;
  return a.item.card.userId < b.item.card.userId ? -1 : a.item.card.userId > b.item.card.userId ? 1 : 0;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Re-sort Bucket A items using the blended (global model + personalization) score.
 *
 * IMPORTANT: This function only receives Bucket A — items that are both
 * eligible for model ranking AND have a finite model score.  Ineligible items
 * (Bucket C) and null-scored items (Bucket B) are never passed here and
 * must remain after Bucket A in the final feed.
 *
 * @param items       Bucket A items (eligible + scored) in their current ML order.
 * @param modelScores Map<userId, modelScore> — the raw ML expected label ∈ [0,4].
 * @param startupCtxs Map<userId, StartupContext> — production startup/investor data.
 * @param prefVector  The actor's preference vector.
 *
 * @returns PersonalizeResult — never throws; on failure returns original ML order.
 */
export function personalizeBucketA<T extends RankableItem>(
  items: T[],
  modelScores: Map<string, number>,
  startupCtxs: Map<string, StartupContext>,
  prefVector: PreferenceVector,
): PersonalizeResult<T> {
  if (items.length === 0) return { items, applied: false };

  try {
    const conf = prefVector.behavior_confidence;

    // Score each item; if any individual scoring fails, keep the ML score.
    const scored: { finalScore: number; modelScore: number; item: T }[] = [];

    for (const item of items) {
      const userId = item.card.userId;
      const modelScore = modelScores.get(userId);

      if (modelScore == null || !Number.isFinite(modelScore)) {
        // Shouldn't happen for Bucket A but be defensive.
        scored.push({ finalScore: -Infinity, modelScore: 0, item });
        continue;
      }

      const globalNorm = modelScore / EXPECTED_LABEL_MAX;

      let persScore = 0;
      try {
        const ctx = startupCtxs.get(userId);
        if (ctx) {
          persScore = personalizationScore(ctx, prefVector);
        }
      } catch {
        // Per-item personalization failure: keep global norm.
        persScore = 0;
      }

      const finalScore = globalNorm + conf * 0.5 * persScore;
      scored.push({ finalScore, modelScore, item });
    }

    // Sort by final_score desc → modelScore desc → scoreMatch desc → userId asc.
    scored.sort(byFinalScore);

    return { items: scored.map((s) => s.item), applied: true };
  } catch {
    // Bulk personalization failure: return original ML order.
    return { items, applied: false };
  }
}
