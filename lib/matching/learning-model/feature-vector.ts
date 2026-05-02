/**
 * lib/matching/learning-model/feature-vector.ts
 *
 * Maps a MatchFeatures object to the numeric vector the LogReg model expects,
 * applying imputation and validation before scaling.
 *
 * ─── IMPUTATION CONTRACT (must match train_synthetic_matching.py) ─────────────
 * The training pipeline imputes null → 0.0 BEFORE StandardScaler runs:
 *
 *   val = p["features"].get(col)
 *   if val is None:
 *       row[col] = 0.0   # ← this is what we replicate here
 *
 * Any null value must become 0.0 here, not after scaling, or the predictions
 * will be miscalibrated (0 after scaling ≠ 0 before scaling).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { MatchFeatures } from "@/lib/matching/features";
import { FEATURE_ORDER } from "./coefficients";

/**
 * The number of features.  Must match FEATURE_ORDER.length.
 * Asserted at module load time below.
 */
const N_FEATURES = 12;

if (FEATURE_ORDER.length !== N_FEATURES) {
  throw new Error(
    `[learning-model] FEATURE_ORDER length ${FEATURE_ORDER.length} ≠ ${N_FEATURES}`,
  );
}

/**
 * Convert null/undefined/NaN/Infinity to a safe numeric value.
 *
 * @param v     Raw feature value from MatchFeatures.
 * @param dflt  Default when the value is absent or invalid.  Must be finite.
 *              Per the imputation contract, dflt is typically 0.0.
 * @param lo    Lower bound for clamping (inclusive).
 * @param hi    Upper bound for clamping (inclusive).
 */
function safe(
  v: number | null | undefined,
  dflt: number,
  lo = -Infinity,
  hi = Infinity,
): number {
  if (v == null || !Number.isFinite(v)) return dflt;
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Map MatchFeatures to the raw (pre-scaling) 12-element numeric vector
 * expected by the LogReg model, applying imputation for nulls and
 * clamping for out-of-range values.
 *
 * ⚠️  The semantic_similarity_score is always null for production profiles
 * in Phase 15 (no embeddings service is running).  It is imputed to 0.0,
 * matching the training-time null-imputation in train_synthetic_matching.py.
 * The model was trained with many null-semantic rows, so this is safe.
 *
 * Feature order must match FEATURE_ORDER / FEATURE_COLS exactly.
 */
export function featuresToVector(features: MatchFeatures): number[] {
  // Each value: safe() applies the [0, 1] guard and null-imputation.
  // anti_thesis_conflict_score can legitimately be 0 even when high conflict;
  // it inverts the usual scale so higher = worse.  Range is still [0, 1].
  return [
    safe(features.sector_overlap_score,          0.0, 0, 1),
    safe(features.stage_match_score,             0.0, 0, 1),
    safe(features.check_size_score,              0.0, 0, 1),
    safe(features.geography_score,               0.5, 0, 1),  // neutral default
    safe(features.interest_overlap_score,        0.0, 0, 1),
    safe(features.anti_thesis_conflict_score,    0.0, 0, 1),
    safe(features.customer_type_overlap_score,   0.5, 0, 1),  // neutral default
    safe(features.business_model_overlap_score,  0.5, 0, 1),  // neutral default
    safe(features.lead_follow_score,             0.5, 0, 1),  // neutral default
    safe(features.traction_strength_score,       0.0, 0, 1),
    safe(features.profile_completeness_score,    1.0, 0, 1),  // assume complete
    // ↓ semantic_similarity_score: null in production → 0.0 (imputation contract)
    safe(features.semantic_similarity_score,     0.0, 0, 1),
  ];
}
