/**
 * TEMPORARY placeholder ranking for the onboarding "You might be interested
 * in" preview.
 *
 * This module exists only to simulate discovery during onboarding. The
 * future ML/LLM recommendation service should replace this entire module
 * without requiring UI rewrites — `getRecommendedProfiles` is the single
 * boundary the UI consumes, and this file is the only consumer of that
 * function's signal weights.
 *
 * Three-tier scoring:
 *
 *   Tier 1 (PRIMARY): user's `lookingFor` text is non-empty.
 *     Tokenise, lowercase, drop stopwords, count keyword hits across
 *     candidate fields. Heavy weight (4).
 *
 *   Tier 2 (SECONDARY): `lookingFor` blank but bio or sector hints exist.
 *     Match candidate fields against bio keywords and known sector tags.
 *     Medium weight (2).
 *
 *   Tier 3 (FALLBACK): no signal. Return candidates in their stable demo
 *     order so the grid is never empty.
 *
 * Final ordering = (signal score desc, stable id asc) so ties are
 * deterministic and the grid never reshuffles between renders.
 *
 * NOTE: this is mock-only logic. It does not use `lib/matching/score.ts`
 * or any production database read. Do not import this file from the feed,
 * dashboard, or matching paths.
 */

import type {
  CurrentUserSnapshot,
  RecommendationProfile,
} from "./types";

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "to", "of", "in", "on",
  "at", "by", "for", "with", "from", "as", "is", "are", "was", "were", "be",
  "been", "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "must", "this", "that", "these", "those",
  "we", "i", "you", "he", "she", "it", "they", "them", "us", "our", "your",
  "my", "me", "his", "her", "its", "their", "looking", "want", "need", "like",
  "around", "across", "between", "about", "very", "really", "just", "also",
  "more", "less", "than", "who", "what", "which", "when", "where", "why", "how",
]);

const TOKEN_PATTERN = /[a-z0-9][a-z0-9-]+/g;

function tokenize(text: string | null | undefined): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const matches = lower.match(TOKEN_PATTERN) ?? [];
  return matches.filter((tok) => tok.length >= 3 && !STOPWORDS.has(tok));
}

/**
 * Build a haystack string from a candidate's high-signal fields. Same
 * fields for both kinds — we just collect everything that could plausibly
 * match a user-typed preference.
 */
function candidateHaystack(profile: RecommendationProfile): string {
  if (profile.kind === "startup") {
    return [
      profile.name,
      profile.tagline,
      profile.description,
      profile.sector,
      profile.product,
      profile.idealInvestor,
      profile.location,
      profile.tags.join(" "),
    ].join(" ");
  }
  return [
    profile.name,
    profile.tagline,
    profile.thesis,
    profile.sectors.join(" "),
    profile.geography,
    profile.helpsWith.join(" "),
    profile.founderQualities.join(" "),
    profile.tags.join(" "),
  ].join(" ");
}

function tokenSetOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let hits = 0;
  for (const tok of a) {
    if (setB.has(tok)) hits++;
  }
  return hits;
}

/**
 * Compute a single profile's score against the user's snapshot.
 * Score is non-negative; ties are broken outside this function on
 * stable id.
 */
export function scoreProfile(
  user: CurrentUserSnapshot,
  candidate: RecommendationProfile,
): number {
  const candidateTokens = tokenize(candidateHaystack(candidate));
  if (candidateTokens.length === 0) return 0;

  // Tier 1 — primary signal: lookingFor.
  if (user.lookingFor && user.lookingFor.trim().length > 0) {
    const userTokens = tokenize(user.lookingFor);
    const overlap = tokenSetOverlap(userTokens, candidateTokens);
    if (overlap > 0) return overlap * 4;
    // fall through to Tier 2 — even with lookingFor present, secondary
    // signals can break ties when there's zero direct overlap.
  }

  // Tier 2 — secondary signal: bio keywords + declared sectors.
  const bioTokens = tokenize(user.bio);
  const sectorTokens = (user.sectors ?? []).flatMap((s) => tokenize(s));
  const secondaryOverlap =
    tokenSetOverlap(bioTokens, candidateTokens) +
    tokenSetOverlap(sectorTokens, candidateTokens);
  if (secondaryOverlap > 0) return secondaryOverlap * 2;

  // Tier 3 — fallback: zero score, stable order applied by the caller.
  return 0;
}

/**
 * Rank a candidate pool against the current user. Pure function. Stable.
 * Caller decides limit; we just return the ordered list.
 */
export function rankCandidates(
  user: CurrentUserSnapshot,
  candidates: readonly RecommendationProfile[],
): RecommendationProfile[] {
  const scored = candidates.map((c, i) => ({
    profile: c,
    score: scoreProfile(user, c),
    originalIndex: i,
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-break on the original (stable) order so the grid never reshuffles
    // between renders for the same input.
    return a.originalIndex - b.originalIndex;
  });

  return scored.map((s) => s.profile);
}
