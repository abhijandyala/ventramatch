/**
 * lib/personalization/runtime/preference-vector.ts
 *
 * Phase 17 — Build a preference vector from a user's behavior events.
 *
 * ─── NOTICE ──────────────────────────────────────────────────────────────────
 * • Not investment advice.
 * • Does not predict startup success or investment returns.
 * • scoreMatch in lib/matching/score.ts is the fallback ranker.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Mirrors the core math of scripts/ml/personalization/preference_vector.py
 * (Phases 12a-iii) but implemented in TypeScript for production use.
 *
 * That Python script is untouched — this is a parallel production adapter.
 *
 * ─── ACTION WEIGHTS ──────────────────────────────────────────────────────────
 * intro_request  +1.0  (strongest positive signal — explicit commitment)
 * save           +0.7
 * like           +0.5
 * profile_view   +0.2  (weak — browse behaviour)
 * pass           -1.0  (explicit rejection — same magnitude as intro_request)
 *
 * ─── DIMENSIONS (Phase 17) ───────────────────────────────────────────────────
 * Active: sector, stage, customer_type, geography   (0.65 total weight)
 * Deferred: business_model (0.10), lead_follow (0.05), semantic (0.20)
 *           → contribute 0 until production data / embeddings are available
 *
 * ─── COLD-START ──────────────────────────────────────────────────────────────
 * behavior_confidence < 0.03 → personalization should be skipped entirely.
 * Callers check PreferenceVector.isColdStart() before applying scores.
 */

import type { BehaviorEvent } from "@/lib/personalization/runtime/behavior-loader";
import { normaliseSector } from "@/lib/profile/sectors";

// ── Constants matching preference_vector.py ────────────────────────────────

const ACTION_WEIGHTS: Record<string, number> = {
  intro_request:  1.0,
  save:           0.7,
  like:           0.5,
  profile_view:   0.2,
  pass:           1.0,  // applied as NEGATIVE
};

const POSITIVE_ACTIONS = new Set(["intro_request", "save", "like", "profile_view"]);
const NEGATIVE_ACTIONS = new Set(["pass"]);

// Logistic confidence curve parameters (mirrors preference_vector.py lines 107–110).
const CONFIDENCE_MAX       = 0.40;
const CONFIDENCE_MIDPOINT  = 15.0;
const CONFIDENCE_SLOPE     = 5.0;
const COLD_START_THRESHOLD = 0.03;

// ── Helper types ──────────────────────────────────────────────────────────

/** Normalised preference map: value → net weighted score. */
type PreferenceMap = Record<string, number>;

// ── Math utilities ────────────────────────────────────────────────────────

function clamp(v: number, lo = -1, hi = 1): number {
  return Math.min(hi, Math.max(lo, v));
}

function logisticConfidence(nWeighted: number): number {
  const exponent = -(nWeighted - CONFIDENCE_MIDPOINT) / CONFIDENCE_SLOPE;
  return CONFIDENCE_MAX / (1 + Math.exp(exponent));
}

// ── CategoryAccumulator ───────────────────────────────────────────────────

class CategoryAccumulator {
  private readonly pos: Map<string, number> = new Map();
  private readonly neg: Map<string, number> = new Map();

  addPositive(values: string[], weight: number): void {
    for (const v of values) {
      if (v) this.pos.set(v, (this.pos.get(v) ?? 0) + weight);
    }
  }

  addNegative(values: string[], weight: number): void {
    for (const v of values) {
      if (v) this.neg.set(v, (this.neg.get(v) ?? 0) + weight);
    }
  }

  toPositiveMap(maxTotal?: number): PreferenceMap {
    return normaliseCategoryMap(this.pos, maxTotal);
  }

  toNegativeMap(maxTotal?: number): PreferenceMap {
    return normaliseCategoryMap(this.neg, maxTotal);
  }
}

function normaliseCategoryMap(raw: Map<string, number>, maxTotal?: number): PreferenceMap {
  if (raw.size === 0) return {};
  const total = Array.from(raw.values()).reduce((a, b) => a + b, 0);
  const divisor = maxTotal ?? total;
  if (divisor === 0) return {};
  const result: PreferenceMap = {};
  for (const [k, v] of raw) {
    result[k] = clamp(v / divisor, 0, 1);
  }
  return result;
}

// ── Startup context for accumulation ──────────────────────────────────────

/**
 * Production startup fields needed to populate preference accumulators.
 * Matches the raw startup row available in shadow-score.ts / ml-ranker.ts.
 */
export type StartupContext = {
  userId: string;
  startup_sectors?: string[] | null;
  industry?: string | null;
  stage?: string | null;
  location?: string | null;
  customer_type?: string | null;
};

// ── Preference vector output ───────────────────────────────────────────────

export type PreferenceVector = {
  /** Logistic confidence in [0, 0.40]. */
  behavior_confidence: number;
  /** True when confidence < COLD_START_THRESHOLD — personalization should be skipped. */
  is_cold_start: boolean;
  /** Total weighted actions (used for diagnostics). */
  total_weighted_actions: number;

  // Positive preference maps (normalised to [0,1]).
  positive_sectors:       PreferenceMap;
  positive_stages:        PreferenceMap;
  positive_customer_types: PreferenceMap;
  positive_geographies:   PreferenceMap;

  // Negative preference maps (normalised to [0,1]).
  negative_sectors:       PreferenceMap;
  negative_stages:        PreferenceMap;
  negative_customer_types: PreferenceMap;
  negative_geographies:   PreferenceMap;
};

// ── Vector builder ────────────────────────────────────────────────────────

/**
 * Build a PreferenceVector from the actor's behavior events.
 *
 * @param events      BehaviorEvent[] from the behavior loader.
 * @param startupCtx  Map<targetUserId, StartupContext> for positive/negative targets.
 *                    Events whose targetUserId is not in this map contribute 0 signal.
 * @returns PreferenceVector — always returns, never throws.
 */
export function buildPreferenceVector(
  events: BehaviorEvent[],
  startupCtx: Map<string, StartupContext>,
): PreferenceVector {
  const sectorAcc     = new CategoryAccumulator();
  const stageAcc      = new CategoryAccumulator();
  const custTypeAcc   = new CategoryAccumulator();
  const geoAcc        = new CategoryAccumulator();

  let totalWeighted = 0;

  for (const event of events) {
    const weight = ACTION_WEIGHTS[event.action] ?? 0;
    if (weight === 0) continue;

    const ctx = startupCtx.get(event.targetUserId);
    if (!ctx) continue;

    const sectors = [
      ...(ctx.startup_sectors ?? []),
      ...(ctx.industry ? [ctx.industry] : []),
    ].map((s) => normaliseSector(s)).filter(Boolean);

    const stages = ctx.stage ? [ctx.stage] : [];
    const custTypes = ctx.customer_type ? [ctx.customer_type] : [];
    const geos = ctx.location ? [ctx.location.split(",")[0].trim()] : [];

    if (POSITIVE_ACTIONS.has(event.action)) {
      totalWeighted += weight;
      sectorAcc.addPositive(sectors, weight);
      stageAcc.addPositive(stages, weight);
      custTypeAcc.addPositive(custTypes, weight);
      geoAcc.addPositive(geos, weight);
    } else if (NEGATIVE_ACTIONS.has(event.action)) {
      totalWeighted += weight;
      sectorAcc.addNegative(sectors, weight);
      stageAcc.addNegative(stages, weight);
      custTypeAcc.addNegative(custTypes, weight);
      geoAcc.addNegative(geos, weight);
    }
  }

  const behavior_confidence = logisticConfidence(totalWeighted);

  return {
    behavior_confidence,
    is_cold_start: behavior_confidence < COLD_START_THRESHOLD,
    total_weighted_actions: totalWeighted,

    positive_sectors:       sectorAcc.toPositiveMap(),
    positive_stages:        stageAcc.toPositiveMap(),
    positive_customer_types: custTypeAcc.toPositiveMap(),
    positive_geographies:   geoAcc.toPositiveMap(),

    negative_sectors:       sectorAcc.toNegativeMap(),
    negative_stages:        stageAcc.toNegativeMap(),
    negative_customer_types: custTypeAcc.toNegativeMap(),
    negative_geographies:   geoAcc.toNegativeMap(),
  };
}
