/**
 * lib/matching/eligibility.ts
 *
 * Hard eligibility policy for the VentraMatch synthetic matching lab.
 *
 * ─── NOTICE ────────────────────────────────────────────────────────────────
 * This module is part of the synthetic matching pipeline only.
 * It does NOT modify scoreMatch in lib/matching/score.ts.
 * It does NOT modify the production feed in lib/feed/query.ts.
 * It is NEVER wired into any production path.
 * All data it operates on is entirely synthetic.
 * Nothing produced by this module is investment advice.
 * Nothing produced by this module predicts startup success or investment returns.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * PURPOSE
 * ───────
 * Hard eligibility separates two conceptually distinct operations in the future
 * global matching model:
 *
 *   1. Hard eligibility gate (this module) — determines whether a pair is even
 *      safe/reasonable to rank at all. These are POLICY rules, not learned
 *      preferences. They encode hard investor mandate constraints (anti-thesis,
 *      stage, check size) that must be respected unconditionally and must never
 *      be overridden by any ranking signal, including high semantic similarity
 *      or high profile-completeness scores.
 *
 *   2. Model ranking — applies only to eligible pairs. A GBM or other
 *      classifier learns relative preference signals across eligible pairs.
 *      Ineligible pairs must be filtered before the model ever sees a pair
 *      at inference time.
 *
 * Hard constraints are NOT the same as the label caps in
 * scripts/generate-synthetic-match-pairs.ts. Label caps reduce the label
 * ceiling of a pair (a soft ceiling on the score assigned). Eligibility removes
 * the pair from the ranking pool entirely. The two mechanisms co-exist:
 *   - Caps → "this pair can score at most 2 (possible fit)"
 *   - Eligibility gate → "this pair must not be ranked at all"
 *
 * For context and the authoritative description, see:
 *   docs/synthetic-matching-lab.md  (Phase 10 section, to be added)
 *
 * IMPORT NOTE
 * ───────────
 * This module imports from lib/matching/features.ts via a relative path, not
 * the @/* alias, so it can be required by tsx scripts without bundler aliasing.
 */

import type { MatchFeatures } from "./features";

// ─── Policy thresholds ─────────────────────────────────────────────────────
// These are policy constants, not tunable weights.
// Do not adjust these in a calibration pass — they encode hard mandate rules.
// Any change must be reviewed by the team and documented in
// docs/synthetic-matching-lab.md and scripts/ml/eligibility.py (Phase 10b).

export const HARD_ELIGIBILITY_THRESHOLDS = {
  /**
   * anti_thesis_conflict_score >= this → ineligible.
   *
   * Mirrors the anti-thesis label cap in generate-synthetic-match-pairs.ts
   * (ANTI_THESIS_CAP = 0.5). The cap reduces the label ceiling; this removes
   * the pair from the model's training/inference scope entirely.
   */
  ANTI_THESIS_MAX: 0.5,

  /**
   * stage_match_score === STAGE_MIN (i.e. exactly 0) → ineligible.
   *
   * Zero stage score means no overlap at all between startup stage and the
   * investor's stated stage list. An investor focused exclusively on Series A
   * cannot be meaningfully ranked against an idea-stage startup.
   */
  STAGE_MIN: 0,

  /**
   * check_size_score < this → ineligible.
   *
   * A score below 0.25 means the startup's raise amount is far enough outside
   * the investor's check band that ranking adds no useful signal. Mirrors the
   * label cap CHECK_SIZE_CAP = 0.25 in generate-synthetic-match-pairs.ts.
   */
  CHECK_SIZE_MIN: 0.25,
} as const;

// ─── Types ─────────────────────────────────────────────────────────────────

/**
 * The three hard eligibility failure modes.
 *
 * Values are intentionally short slug strings so they can be used as CSV
 * column names, JSON keys, and Python dict keys without transformation.
 */
export type HardFilterReason =
  | "anti_thesis_conflict"
  | "stage_mismatch"
  | "check_size_mismatch";

/**
 * Result of evaluateEligibility.
 *
 * Stored verbatim in each pair record in data/synthetic-matching/pairs.json.
 * Python training scripts read these fields directly; do not rename without
 * updating scripts/ml/eligibility.py (Phase 10b).
 */
export interface EligibilityResult {
  /** True only when hard_filter_reasons is empty. */
  eligible_for_model_ranking: boolean;
  /**
   * Zero or more reasons this pair was blocked. Empty array when eligible.
   * A pair may have multiple reasons (e.g., stage mismatch AND check-size
   * mismatch); all applicable reasons are reported.
   */
  hard_filter_reasons: HardFilterReason[];
}

// ─── Core function ─────────────────────────────────────────────────────────

/**
 * Evaluate whether a startup–investor feature pair is eligible for model
 * ranking.
 *
 * This function applies hard policy constraints only. It does NOT assign or
 * modify labels. It does NOT learn or change over time. It must be called
 * before a ranking model is applied — at inference time, ineligible pairs
 * must be filtered before the model runs.
 *
 * @param features  The MatchFeatures object from computeMatchFeatures.
 * @returns         An EligibilityResult with eligible_for_model_ranking and
 *                  hard_filter_reasons (empty if eligible).
 */
export function evaluateEligibility(features: MatchFeatures): EligibilityResult {
  const reasons: HardFilterReason[] = [];

  if (features.anti_thesis_conflict_score >= HARD_ELIGIBILITY_THRESHOLDS.ANTI_THESIS_MAX) {
    reasons.push("anti_thesis_conflict");
  }

  // Strict equality: only stage_match_score === 0 triggers this gate.
  // Adjacent-stage pairs (score = 0.5) remain eligible for ranking even
  // though they will score lower on the stage dimension.
  if (features.stage_match_score === HARD_ELIGIBILITY_THRESHOLDS.STAGE_MIN) {
    reasons.push("stage_mismatch");
  }

  if (features.check_size_score < HARD_ELIGIBILITY_THRESHOLDS.CHECK_SIZE_MIN) {
    reasons.push("check_size_mismatch");
  }

  return {
    eligible_for_model_ranking: reasons.length === 0,
    hard_filter_reasons: reasons,
  };
}
