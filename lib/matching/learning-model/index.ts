/**
 * lib/matching/learning-model/index.ts
 *
 * Public API for the Phase 15 shadow scorer.
 *
 * ─── NOTICE ──────────────────────────────────────────────────────────────────
 * • Offline experimental model.  Not investment advice.
 * • Does not predict startup success.
 * • scoreMatch in lib/matching/score.ts is the active production ranker.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export { COEFFICIENTS_VERSION, FEATURE_ORDER } from "./coefficients";
export { featuresToVector } from "./feature-vector";
export { scoreWithLearningModel } from "./scorer";
export type { ModelScoreResult } from "./scorer";
