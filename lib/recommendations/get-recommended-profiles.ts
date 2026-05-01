/**
 * Single public entry point for the recommendation layer.
 *
 * The UI consumes recommendations through this function only. It is
 * deliberately the SOLE boundary so that swapping the placeholder ranking
 * for a future ML/LLM service is a single-file change.
 *
 * Today this delegates to `placeholder-ranking.ts` which is a deterministic
 * three-tier scorer. Tomorrow this could call out to an internal
 * recommendations service, an OpenAI-powered reranker, or a hybrid.
 *
 * Stability guarantees:
 *   - Same input → same output (deterministic).
 *   - Returns at most `limit` items.
 *   - Returns at least one item if `candidateProfiles` is non-empty.
 *   - Never throws on empty / malformed inputs.
 */

import { rankCandidates } from "./placeholder-ranking";
import type {
  GetRecommendedProfilesArgs,
  RecommendationProfile,
} from "./types";

const DEFAULT_LIMIT = 12;

export function getRecommendedProfiles(
  args: GetRecommendedProfilesArgs,
): RecommendationProfile[] {
  const { currentUserProfile, candidateProfiles, limit = DEFAULT_LIMIT } = args;

  if (!candidateProfiles || candidateProfiles.length === 0) {
    return [];
  }

  const ranked = rankCandidates(currentUserProfile, candidateProfiles);
  return ranked.slice(0, limit);
}

export type {
  RecommendationProfile,
  CurrentUserSnapshot,
  RecommendationContext,
} from "./types";
