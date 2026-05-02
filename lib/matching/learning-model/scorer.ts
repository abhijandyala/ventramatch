/**
 * lib/matching/learning-model/scorer.ts
 *
 * Pure TypeScript LogReg scorer — no Python, no sklearn, no file I/O.
 *
 * Pipeline:
 *   1. raw vector  (featuresToVector)
 *   2. StandardScaler  →  (x - mean) / scale
 *   3. class logits    →  COEF · scaled_x + INTERCEPT  (one per class)
 *   4. softmax
 *   5. expected_label  →  Σ class_index × probability  (continuous in [0, 4])
 *
 * The returned value is a continuous fit score ∈ [0, 4].
 * It is stored in feed_impressions.model_score for later A/B analysis.
 * It is NOT used to re-rank or filter the feed.
 *
 * ─── NOTICE ──────────────────────────────────────────────────────────────────
 * • Offline experimental model.  Not investment advice.
 * • Does not predict startup success or investment returns.
 * • scoreMatch in lib/matching/score.ts is the active production ranker.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { MatchFeatures } from "@/lib/matching/features";
import {
  COEF,
  CLASSES,
  COEFFICIENTS_VERSION,
  INTERCEPT,
  SCALER_MEAN,
  SCALER_SCALE,
} from "./coefficients";
import { featuresToVector } from "./feature-vector";

/** Number of classes the model outputs. */
const N_CLASSES = CLASSES.length; // 5

/** Guard: all sizes must be consistent at module load. */
if (
  COEF.length !== N_CLASSES ||
  INTERCEPT.length !== N_CLASSES ||
  SCALER_MEAN.length !== COEF[0].length ||
  SCALER_SCALE.length !== COEF[0].length
) {
  throw new Error("[learning-model] Coefficient / scaler dimensions mismatch");
}

/**
 * StandardScaler transform: scaled_i = (raw_i - mean_i) / scale_i.
 * Inputs are already validated/clamped by featuresToVector.
 * A defensive guard replaces any unexpected NaN or Infinity with 0.0.
 */
function scale(raw: number[]): number[] {
  return raw.map((v, i) => {
    const s = SCALER_SCALE[i];
    if (s === 0) return 0; // avoid division by zero (profile_completeness constant=1)
    const z = (v - SCALER_MEAN[i]) / s;
    return Number.isFinite(z) ? z : 0;
  });
}

/**
 * Compute class logits: logits[c] = dot(COEF[c], scaled_x) + INTERCEPT[c].
 */
function logits(scaled: number[]): number[] {
  return COEF.map((coefRow, c) => {
    let sum = INTERCEPT[c];
    for (let i = 0; i < scaled.length; i++) {
      sum += coefRow[i] * scaled[i];
    }
    return sum;
  });
}

/**
 * Numerically stable softmax: shift by max logit before exp.
 */
function softmax(lg: number[]): number[] {
  const maxVal = Math.max(...lg);
  const exps = lg.map((v) => Math.exp(v - maxVal));
  const total = exps.reduce((a, b) => a + b, 0);
  if (total === 0) return CLASSES.map(() => 1 / N_CLASSES); // uniform fallback
  return exps.map((e) => e / total);
}

/**
 * Expected label: continuous weighted sum of class indices and their
 * probabilities.  Equivalent to E[Y] where Y ∈ {0,1,2,3,4}.
 */
function expectedLabel(probs: number[]): number {
  return CLASSES.reduce((acc, cls, i) => acc + cls * probs[i], 0);
}

/** Result from the model scorer. */
export type ModelScoreResult = {
  /** Continuous expected label ∈ [0, 4]. */
  score: number;
  /** Probability distribution over 5 classes. */
  classProbabilities: number[];
  /** Coefficient version tag (for logging / debugging). */
  version: string;
};

/**
 * Score a startup-investor pair using the Phase 11c LogReg champion.
 *
 * Returns null on any error, so callers never need to catch.
 * The null path is taken only when the input is completely un-scoreable
 * (e.g., all NaN after clamping, coefficient array mismatch at runtime).
 */
export function scoreWithLearningModel(
  features: MatchFeatures,
): ModelScoreResult | null {
  try {
    const raw     = featuresToVector(features);
    const scaled  = scale(raw);
    const lg      = logits(scaled);
    const probs   = softmax(lg);
    const score   = expectedLabel(probs);

    if (!Number.isFinite(score) || score < 0 || score > 4) {
      console.error("[learning-model] Computed score out of range:", score);
      return null;
    }

    return {
      score,
      classProbabilities: probs,
      version: COEFFICIENTS_VERSION,
    };
  } catch (err) {
    console.error("[learning-model] scoreWithLearningModel error:", err);
    return null;
  }
}
