/**
 * lib/matching/features.ts
 *
 * Pair-level feature extraction for founder–investor profile-fit matching.
 *
 * ─── NOTICE ────────────────────────────────────────────────────────────────
 * This module is part of the VentraMatch synthetic matching pipeline
 * (data/synthetic-matching/) and is designed to be usable by both offline
 * scripts and future production matching code via a thin type adapter.
 *
 * This module is NOT investment advice.
 * This module does NOT predict startup success or investment returns.
 * This module does NOT produce a fundability score or return-potential score.
 * All scores represent profile-fit and intro relevance between two profiles.
 *
 * Labels derived from these features are synthetic algorithm-development
 * artifacts and must never be presented as investment recommendations.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Import note: normaliseSector is a pure function with no external dependencies.
 * It is imported via a relative path (not the @/* alias) so this module can
 * be required by tsx scripts and production code without divergent resolution.
 */

import { normaliseSector } from "../profile/sectors";

// ─── Synthetic domain types ────────────────────────────────────────────────
// Defined locally so this module runs in offline/script contexts without
// importing from the production Database types, which assume Next.js bundler
// resolution and may pull in DB-client imports transitively.

/** Mirrors public.startup_stage in the production database. */
export type SyntheticStage =
  | "idea"
  | "pre_seed"
  | "seed"
  | "series_a"
  | "series_b_plus";

/**
 * Traction tier labels used in data/synthetic-matching/startups.json.
 * Ordered weakest → strongest.
 */
export type SyntheticTractionTier =
  | "no_traction"
  | "waitlist"
  | "design_partners"
  | "pilots"
  | "paying_customers"
  | "mrr"
  | "arr"
  | "enterprise_contracts";

/** Mirrors the customer_type check constraint added in migration 0035. */
export type SyntheticCustomerType =
  | "consumer"
  | "smb"
  | "enterprise"
  | "developer"
  | "government"
  | "marketplace"
  | "other";

export type TechnicalDepth = "low" | "medium" | "high";

export type DistributionMotion =
  | "product_led"
  | "sales_led"
  | "community_led"
  | "marketplace"
  | "channel";

export type LeadFollowPreference = "lead" | "follow" | "either";

// ─── Anti-thesis structure ─────────────────────────────────────────────────

/**
 * Structured investor anti-thesis. Maps to the shape in
 * data/synthetic-matching/investors.json and mirrors the intent of the
 * investor_anti_patterns table (migration 0015).
 */
export interface SyntheticAntiThesis {
  /** Sector labels the investor will not fund. Use canonical labels from lib/profile/sectors.ts. */
  sectors: string[];
  /** Customer types the investor avoids. */
  customer_types: string[];
  /** Business model strings the investor avoids. */
  business_models: string[];
  /**
   * Free-text phrases describing founder profiles the investor will not back.
   * Used for keyword-based conflict detection in anti_thesis_conflict_score.
   * This is a heuristic; Phase 3 may replace it with embedding similarity.
   */
  founder_profiles: string[];
}

// ─── Synthetic profile interfaces ─────────────────────────────────────────

/**
 * Synthetic startup profile for algorithm development.
 *
 * Intentionally richer than Database["public"]["Tables"]["startups"]["Row"]:
 * includes structured business_model, traction tier, technical_depth, and
 * distribution_motion — fields that are not yet columns in the live schema.
 *
 * Do NOT cast real production startups to this type without verifying that
 * each field is available and populated in the live row.
 */
export interface SyntheticStartup {
  id: string;
  name: string;
  one_liner: string;
  problem: string;
  solution: string;
  /** Canonical sector labels from lib/profile/sectors.ts. */
  sectors: string[];
  stage: SyntheticStage;
  /** USD amount for the current raise round. */
  raise_amount: number;
  location: string;
  customer_type: SyntheticCustomerType;
  business_model: string;
  traction: SyntheticTractionTier;
  founder_background: string;
  technical_depth: TechnicalDepth;
  distribution_motion: DistributionMotion;
  onboarding_interests: string[];
}

/**
 * Synthetic investor profile for algorithm development.
 *
 * Richer than Database["public"]["Tables"]["investors"]["Row"]: includes
 * structured anti_thesis, lead_or_follow preference, onboarding_interests,
 * and per-type customer and business model preferences.
 */
export interface SyntheticInvestor {
  id: string;
  name: string;
  firm: string;
  investment_thesis: string;
  /** Canonical sector labels from lib/profile/sectors.ts. */
  sectors: string[];
  anti_thesis: SyntheticAntiThesis;
  stages: SyntheticStage[];
  check_min: number;
  check_max: number;
  geographies: string[];
  customer_type_preference: string[];
  business_model_preference: string[];
  lead_or_follow: LeadFollowPreference;
  portfolio_style: string;
  onboarding_interests: string[];
}

// ─── Feature output interface ──────────────────────────────────────────────

/**
 * All pair-level features for one startup–investor pair.
 *
 * Numeric fields are in [0, 1] unless documented otherwise.
 * These features represent profile-fit quality only — not the probability
 * of funding, not startup success, and not investment return potential.
 */
export interface MatchFeatures {
  /**
   * Fraction of the startup's sectors that appear in the investor's sector
   * list, using canonical normalisation via lib/profile/sectors.ts on both
   * sides. 0 = no sector overlap; 1 = all startup sectors are in the mandate.
   */
  sector_overlap_score: number;

  /**
   * Stage compatibility.
   *   1.0 = investor stages include the startup's stage exactly.
   *   0.5 = closest investor stage is one step away (e.g., pre_seed vs seed).
   *   0.2 = closest investor stage is two steps away.
   *   0.0 = no plausible stage overlap.
   */
  stage_match_score: number;

  /**
   * How well startup.raise_amount fits within the investor's
   * [check_min, check_max] band.
   *   1.0 = within range.
   *   Soft linear falloff outside the range.
   *   0.0 = raise amount is far outside range.
   * Mirrors the rangeScore logic in lib/matching/score.ts.
   */
  check_size_score: number;

  /**
   * Geographic compatibility.
   *   1.0 = confirmed match (city/state/country/continent aligns).
   *   0.4–0.6 = startup is remote or geography is ambiguous.
   *   0.2 = geographic tension — startup and investor locations do not overlap.
   *   0.0 = no location data available.
   */
  geography_score: number;

  /**
   * Set-overlap between startup.onboarding_interests and
   * investor.onboarding_interests, normalised by the larger set.
   * 0 = no shared interests; 1 = complete overlap.
   */
  interest_overlap_score: number;

  /**
   * [0, 1] — HIGHER IS WORSE. Intentionally inverted from all other scores.
   *   0.0 = no anti-thesis conflict detected.
   *   1.0 = startup violates investor anti-thesis on sector, customer type,
   *         and business model simultaneously.
   *
   * The labeling script uses this to cap match labels:
   *   >= 0.5 → label capped at "weak fit" (1)
   *   >= 0.7 → label capped at "poor fit" (0)
   *
   * Component weights: sector 0.40 + customer_type 0.30 + business_model 0.20
   *                    + founder_profile_keywords 0.10.
   */
  anti_thesis_conflict_score: number;

  /**
   * Compatibility between startup.customer_type and
   * investor.customer_type_preference, using a semantic compatibility matrix.
   * 1.0 = exact match; partial credit for economically compatible types;
   * 0.0 = incompatible.
   */
  customer_type_overlap_score: number;

  /**
   * Compatibility between startup.business_model and
   * investor.business_model_preference, using a compatibility matrix that
   * captures similar revenue models (e.g., subscription ≈ enterprise license).
   * 1.0 = exact match; partial credit for similar models; 0.0 = incompatible.
   */
  business_model_overlap_score: number;

  /**
   * Fit between the investor's lead/follow role preference and the startup's
   * engagement signals (inferred from onboarding_interests).
   *   1.0 = investor is "either", or investor leads and startup wants engagement.
   *   0.5 = investor follows but startup signals a need for an engaged lead.
   *   0.7–0.8 = acceptable but not ideal alignment.
   */
  lead_follow_score: number;

  /**
   * Numeric strength of startup.traction, mapping tier labels to [0, 1].
   *   0.0 = no_traction … 1.0 = enterprise_contracts.
   */
  traction_strength_score: number;

  /**
   * Average completeness of both profiles based on field presence,
   * non-empty arrays, and minimum text-length thresholds.
   *   1.0 = both profiles are complete.
   *   0.0 = one or both profiles are nearly empty.
   *
   * Deliberately weak synthetic profiles (e.g., startup_032 Voxium) score
   * similarly to strong ones here because they have all fields filled in —
   * profile_completeness measures structure, not content quality.
   * Content quality is captured by traction_strength, check_size, and
   * anti_thesis_conflict.
   */
  profile_completeness_score: number;

  /**
   * Cosine similarity between the startup's pitch text embedding and the
   * investor's thesis text embedding, in [-1, 1].
   *
   * Computed using sentence-transformers/all-MiniLM-L6-v2 (384-dim, L2-normalised)
   * by scripts/ml/compute_embeddings.py. Startup text = one_liner + problem +
   * solution + founder_background. Investor text = investment_thesis.
   *
   * Null when pre-computed embeddings are not available (e.g., compute_embeddings.py
   * has not been run yet). A null value is preserved so downstream arithmetic does
   * not accidentally treat missing data as zero similarity.
   *
   * This score represents profile-fit text similarity only.
   * It is NOT investment advice and does NOT predict startup success.
   */
  semantic_similarity_score: number | null;
}

// ─── Internal constants ────────────────────────────────────────────────────

const STAGE_ORDER: Record<SyntheticStage, number> = {
  idea: 0,
  pre_seed: 1,
  seed: 2,
  series_a: 3,
  series_b_plus: 4,
};

const TRACTION_SCORES: Record<SyntheticTractionTier, number> = {
  no_traction: 0.0,
  waitlist: 0.2,
  design_partners: 0.4,
  pilots: 0.55,
  paying_customers: 0.7,
  mrr: 0.8,
  arr: 0.9,
  enterprise_contracts: 1.0,
};

/**
 * Compatibility between startup customer types and investor customer type
 * preferences. Asymmetric by design: enterprise investors tolerate SMB at 0.5
 * but a pure consumer investor is a hard 0 for enterprise startups.
 */
const CUSTOMER_TYPE_COMPAT: Partial<
  Record<SyntheticCustomerType, Record<string, number>>
> = {
  consumer: { consumer: 1.0, marketplace: 0.4 },
  smb: { smb: 1.0, enterprise: 0.5, developer: 0.3, marketplace: 0.3 },
  enterprise: { enterprise: 1.0, smb: 0.5, developer: 0.4, government: 0.3 },
  developer: { developer: 1.0, enterprise: 0.5, smb: 0.4 },
  government: { government: 1.0, enterprise: 0.3 },
  marketplace: { marketplace: 1.0, consumer: 0.4, smb: 0.3 },
  other: { other: 0.7 },
};

/**
 * Compatibility between business models. Captures economically similar models
 * (subscription ≈ enterprise_license) and clearly incompatible ones
 * (direct_to_consumer vs enterprise_license).
 */
const BM_COMPAT: Record<string, Record<string, number>> = {
  subscription_saas: {
    subscription_saas: 1.0,
    enterprise_license: 0.7,
    freemium_saas: 0.7,
    usage_based: 0.6,
    data_licensing: 0.4,
    hardware_plus_software: 0.3,
    direct_to_consumer: 0.2,
    platform_fee: 0.3,
  },
  usage_based: {
    usage_based: 1.0,
    subscription_saas: 0.6,
    enterprise_license: 0.5,
    freemium_saas: 0.5,
    platform_fee: 0.4,
  },
  marketplace_take_rate: {
    marketplace_take_rate: 1.0,
    platform_fee: 0.6,
    transactional_payments: 0.5,
    freemium_saas: 0.3,
    subscription_saas: 0.2,
  },
  enterprise_license: {
    enterprise_license: 1.0,
    subscription_saas: 0.7,
    usage_based: 0.5,
    data_licensing: 0.4,
  },
  transactional_payments: {
    transactional_payments: 1.0,
    marketplace_take_rate: 0.5,
    platform_fee: 0.4,
    subscription_saas: 0.2,
  },
  hardware_plus_software: {
    hardware_plus_software: 1.0,
    subscription_saas: 0.4,
    enterprise_license: 0.4,
  },
  freemium_saas: {
    freemium_saas: 1.0,
    subscription_saas: 0.7,
    usage_based: 0.5,
    marketplace_take_rate: 0.3,
  },
  direct_to_consumer: {
    direct_to_consumer: 1.0,
    subscription_saas: 0.3,
    marketplace_take_rate: 0.3,
  },
  platform_fee: {
    platform_fee: 1.0,
    marketplace_take_rate: 0.6,
    transactional_payments: 0.4,
    subscription_saas: 0.3,
  },
  data_licensing: {
    data_licensing: 1.0,
    subscription_saas: 0.4,
    enterprise_license: 0.4,
    usage_based: 0.3,
  },
};

// US state abbreviations. Used to detect US-based startup locations.
const US_STATE_PATTERN =
  /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/;

const MIDWEST_STATES = new Set([
  "IL",
  "OH",
  "MI",
  "IN",
  "MN",
  "WI",
  "IA",
  "MO",
  "ND",
  "SD",
  "NE",
  "KS",
]);

/**
 * Minimal country-to-continent map covering the countries present in
 * data/synthetic-matching/startups.json. Used so that an investor specifying
 * "Africa" correctly matches a startup in "Lagos, Nigeria".
 */
const COUNTRY_CONTINENT: Record<string, string> = {
  nigeria: "africa",
  kenya: "africa",
  ghana: "africa",
  "south africa": "africa",
  egypt: "africa",
  ethiopia: "africa",
  singapore: "southeast asia",
  indonesia: "southeast asia",
  philippines: "southeast asia",
  malaysia: "southeast asia",
  vietnam: "southeast asia",
  thailand: "southeast asia",
  japan: "asia",
  china: "asia",
  india: "asia",
  "south korea": "asia",
  brazil: "latin america",
  mexico: "latin america",
  colombia: "latin america",
  argentina: "latin america",
  chile: "latin america",
  "united kingdom": "europe",
  germany: "europe",
  france: "europe",
  netherlands: "europe",
  sweden: "europe",
  spain: "europe",
  israel: "middle east",
  "united arab emirates": "middle east",
};

/**
 * Synonym/normalisation map for onboarding_interests.
 *
 * Startup and investor sides describe the same underlying signals with
 * different vocabulary. This map bridges near-synonyms explicitly so the
 * overlap function doesn't require identical string values to produce a match.
 *
 * Design rules:
 *   - Only clearly defensible pairs are included. No broad fuzzy matching.
 *   - Entries are bidirectional: if X maps to Y, Y should also map to X
 *     (unless the relationship is intentionally one-directional).
 *   - Deliberately excluded (reasons inline):
 *       marketing_support ↔ community_driven_growth  — different mechanics;
 *         paid/PR support vs organic/viral growth are not the same signal.
 *       follow_on_capital ↔ strong_revenue_growth    — funding strategy vs
 *         portfolio metric; different dimensions, not near-synonyms.
 *       recruiting_help ↔ technical_founders         — startup need vs
 *         founder attribute; conflating would inflate scores arbitrarily.
 *       board_expertise ↔ repeat_founders            — too indirect; repeat
 *         founders often skip formal board meetings at early stage.
 *       product_strategy ↔ ai_native / vertical_saas — too generic vs too
 *         specific; would create broad false overlaps.
 */
const INTEREST_SYNONYMS: Record<string, string[]> = {
  // "Help us close enterprise deals" (startup) ↔ "We back enterprise contract wins" (investor).
  enterprise_sales_intros: ["enterprise_contracts"],
  enterprise_contracts: ["enterprise_sales_intros"],

  // "We have / want a developer community" (startup) ↔ "We value developer ecosystems" (investor).
  developer_community: ["developer_ecosystem"],
  // developer_ecosystem also maps to hands_on_technical_support because an
  // investor focused on developer ecosystems typically provides hands-on
  // technical involvement — the same signal as a startup requesting it.
  developer_ecosystem: ["developer_community", "hands_on_technical_support"],

  // "We need regulatory expertise from investors" (startup) ↔ "We look for regulatory moat" (investor).
  regulatory_expertise: ["regulatory_moat"],
  regulatory_moat: ["regulatory_expertise"],

  // "We need hands-on technical involvement from investors" (startup) ↔
  // "We invest in developer ecosystem companies" (investor). Shared signal:
  // both sides value deep technical engagement.
  // Note: reverse mapping is handled via developer_ecosystem above.
  hands_on_technical_support: ["developer_ecosystem"],
};

// ─── Embedding types and cosine similarity ────────────────────────────────

/**
 * A pre-computed text embedding vector from sentence-transformers/all-MiniLM-L6-v2.
 * All vectors are L2-normalised so dot product equals cosine similarity.
 * Produced by scripts/ml/compute_embeddings.py — NOT generated at runtime.
 */
export type EmbeddingVector = number[];

/**
 * Cosine similarity between two L2-normalised embedding vectors.
 *
 * Because both inputs are unit vectors, this is equivalent to the dot product.
 * Result is in [-1, 1]; typical values for profile text pairs are [0.1, 0.7].
 *
 * Returns null if either vector is missing, has zero length, or has a length
 * mismatch — so callers never accidentally use a numeric zero as real similarity.
 *
 * This computes TEXT SIMILARITY only. It is not a measure of investment quality,
 * startup potential, or likelihood of funding.
 */
export function cosineSimilarity(
  a: EmbeddingVector | null | undefined,
  b: EmbeddingVector | null | undefined,
): number | null {
  if (!a || !b || a.length === 0 || a.length !== b.length) return null;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Compute all pair-level match features for one synthetic startup–investor pair.
 *
 * Deterministic: given the same inputs the function always returns the same
 * output. No side effects, no network calls, no randomness.
 *
 * @param startup          A synthetic startup from data/synthetic-matching/startups.json.
 * @param investor         A synthetic investor from data/synthetic-matching/investors.json.
 * @param startupEmbedding Optional pre-computed embedding for the startup's text,
 *                         produced by scripts/ml/compute_embeddings.py. Null-safe.
 * @param investorEmbedding Optional pre-computed embedding for the investor's thesis,
 *                          produced by scripts/ml/compute_embeddings.py. Null-safe.
 * @returns A MatchFeatures object. Consult field-level JSDoc for semantics.
 */
export function computeMatchFeatures(
  startup: SyntheticStartup,
  investor: SyntheticInvestor,
  startupEmbedding?: EmbeddingVector | null,
  investorEmbedding?: EmbeddingVector | null,
): MatchFeatures {
  return {
    sector_overlap_score: sectorOverlapScore(startup, investor),
    stage_match_score: stageMatchScore(startup, investor),
    check_size_score: checkSizeScore(startup, investor),
    geography_score: geographyScore(startup, investor),
    interest_overlap_score: interestOverlapScore(startup, investor),
    anti_thesis_conflict_score: antiThesisConflictScore(startup, investor),
    customer_type_overlap_score: customerTypeOverlapScore(startup, investor),
    business_model_overlap_score: businessModelOverlapScore(startup, investor),
    lead_follow_score: leadFollowScore(startup, investor),
    traction_strength_score: tractionStrengthScore(startup),
    profile_completeness_score: profileCompletenessScore(startup, investor),
    // Semantic similarity via sentence-transformers/all-MiniLM-L6-v2 (384-dim).
    // Null when compute_embeddings.py has not been run. Weight in the labeling
    // formula is 0 — labels are derived from structured features only (Phase 7).
    // The training model (train_synthetic_matching.py) uses this as a 12th feature.
    semantic_similarity_score: cosineSimilarity(startupEmbedding, investorEmbedding),
  };
}

// ─── Score implementations ─────────────────────────────────────────────────

/**
 * Fraction of the startup's sectors that appear in the investor's sector list,
 * after canonical normalisation on both sides.
 *
 * We measure from the startup's perspective ("what fraction of my focus areas
 * does this investor cover?") because a startup with a single sector that
 * perfectly matches should score 1.0, not 0.25 just because the investor
 * covers 4 sectors.
 */
function sectorOverlapScore(
  startup: SyntheticStartup,
  investor: SyntheticInvestor,
): number {
  if (startup.sectors.length === 0 || investor.sectors.length === 0) return 0;

  const normalise = (arr: string[]) =>
    arr.map((s) => normaliseSector(s).toLowerCase());

  const investorSet = new Set(normalise(investor.sectors));
  const startupNorm = normalise(startup.sectors);
  const matchCount = startupNorm.filter((s) => investorSet.has(s)).length;

  return matchCount / startup.sectors.length;
}

/**
 * Stage compatibility between startup and investor.
 * Takes the best score across all investor stages.
 */
function stageMatchScore(
  startup: SyntheticStartup,
  investor: SyntheticInvestor,
): number {
  if (investor.stages.length === 0) return 0;

  const startupRank = STAGE_ORDER[startup.stage];
  let best = 0;

  for (const s of investor.stages) {
    const dist = Math.abs(startupRank - STAGE_ORDER[s]);
    const score = dist === 0 ? 1.0 : dist === 1 ? 0.5 : dist === 2 ? 0.2 : 0;
    if (score > best) best = score;
  }

  return best;
}

/**
 * Check size fit. Mirrors the rangeScore helper in lib/matching/score.ts.
 *
 * Within [check_min, check_max]: 1.0.
 * Below: falloff = (check_min - raise) / check_min.
 * Above: falloff = (raise - check_max) / check_max.
 * Result clamped to [0, 1].
 */
function checkSizeScore(
  startup: SyntheticStartup,
  investor: SyntheticInvestor,
): number {
  const raise = startup.raise_amount;
  const { check_min, check_max } = investor;

  if (check_max <= 0) return 0;
  if (raise >= check_min && raise <= check_max) return 1;

  if (raise < check_min) {
    return Math.max(0, 1 - (check_min - raise) / check_min);
  }

  return Math.max(0, 1 - (raise - check_max) / check_max);
}

/**
 * Geographic match between startup location and investor geographies.
 *
 * Matching strategy (in priority order):
 *   1. "Global" investor → always 1.0.
 *   2. "Remote" startup → neutral (0.4–0.6 depending on investor breadth).
 *   3. Investor geography string is a substring of startup location
 *      (e.g., investor: "Nigeria" vs startup: "Lagos, Nigeria").
 *   4. Startup city name is a substring of investor geography string
 *      (e.g., investor: "United States — Midwest" vs startup: "Detroit, MI").
 *   5. US state code + investor covers "United States" broadly (no regional
 *      qualifier). "United States — Midwest" is excluded from this step so
 *      a San Francisco startup does not score 1.0 against a Midwest-only fund.
 *   6. US state code + investor covers "Midwest" + state is in MIDWEST_STATES.
 *   7. Country/continent matching for international locations — only when no US
 *      state code was found (to prevent 2-letter abbreviation substring collisions).
 *   8. Default → 0.2 geographic tension.
 */
function geographyScore(
  startup: SyntheticStartup,
  investor: SyntheticInvestor,
): number {
  const { location } = startup;
  const { geographies } = investor;

  if (!location || geographies.length === 0) return 0;

  const loc = location.toLowerCase().trim();
  const geosLower = geographies.map((g) => g.toLowerCase());

  // 1. Global investor.
  if (geosLower.some((g) => g === "global")) return 1;

  // 2. Remote startup.
  if (loc === "remote") return geographies.length > 3 ? 0.6 : 0.4;

  // 3. Any investor geography is a substring of startup location.
  if (geosLower.some((g) => loc.includes(g))) return 1;

  // 4. Startup city is a substring of an investor geography string.
  const city = loc.split(",")[0].trim();
  if (city && geosLower.some((g) => g.includes(city))) return 1;

  // 5–6. US state code checks.
  const stateMatch = location.match(US_STATE_PATTERN);
  if (stateMatch) {
    const code = stateMatch[0].toUpperCase();
    // Step 5: investor broadly covers the United States with no regional qualifier.
    // Exclude strings like "United States — Midwest" (contains "—") so that a
    // San Francisco startup does not claim a full match against a Midwest-only fund.
    const hasBroadUSGeo = geosLower.some(
      (g) => g.includes("united states") && !g.includes("midwest") && !g.includes("—"),
    );
    if (hasBroadUSGeo) return 1;
    // Step 6: Midwest-specific investor and startup is in a Midwest US state.
    if (MIDWEST_STATES.has(code) && geosLower.some((g) => g.includes("midwest")))
      return 1;
  }

  // 7. Country/continent matching for international locations only.
  // This step is skipped when a US state code is present because 2-letter US
  // state abbreviations (CO, PA, CA, GA, OR, MA, NY, etc.) can substring-match
  // unrelated foreign geography strings (e.g., "CO" inside "Wisconsin", "CA"
  // inside "Canada" or "Africa", "GA" inside "Singapore" or "Michigan").
  // US locations are handled exhaustively by steps 5–6 via the state code.
  const locationParts = loc.split(",");
  if (!stateMatch && locationParts.length > 1) {
    const country = locationParts[locationParts.length - 1].trim();
    if (country) {
      if (geosLower.some((g) => g.includes(country))) return 1;
      const continent = COUNTRY_CONTINENT[country];
      if (continent && geosLower.some((g) => g.includes(continent))) return 1;
    }
  }

  // 8. Geographic tension.
  return 0.2;
}

/**
 * Expands a single interest token to the set of tokens it is considered
 * equivalent to, using INTEREST_SYNONYMS. The original token is always
 * included in the returned set.
 */
function expandInterest(token: string): Set<string> {
  const lower = token.toLowerCase();
  return new Set([lower, ...(INTEREST_SYNONYMS[lower] ?? [])]);
}

/**
 * Normalised set-overlap between startup and investor onboarding_interests,
 * with synonym expansion (via INTEREST_SYNONYMS) so near-synonymous
 * vocabulary on each side can still produce a match.
 * Divided by the larger set size to avoid inflating scores when one side
 * lists very few interests.
 */
function interestOverlapScore(
  startup: SyntheticStartup,
  investor: SyntheticInvestor,
): number {
  const a = startup.onboarding_interests;
  const b = investor.onboarding_interests;
  if (a.length === 0 || b.length === 0) return 0;

  // Expand every investor interest token to include its synonyms once,
  // then use a flat set for O(1) membership tests below.
  const expandedB = new Set(
    b.flatMap((token) => [...expandInterest(token)]),
  );

  // A startup interest counts as a match if the token itself or any of its
  // synonyms appears in the investor's expanded interest set.
  const matchCount = a.filter((token) =>
    [...expandInterest(token)].some((t) => expandedB.has(t)),
  ).length;

  return matchCount / Math.max(a.length, b.length);
}

/**
 * Anti-thesis conflict score. Returns [0, 1] where HIGHER IS WORSE.
 *
 * Component weights sum to 1.0:
 *   sector conflict       0.40 — any startup sector in anti_thesis.sectors
 *   customer type         0.30 — startup customer_type in anti_thesis.customer_types
 *   business model        0.20 — startup business_model in anti_thesis.business_models
 *   founder profile (kw)  0.10 — keyword heuristic against founder_background text
 *
 * Canonical sector normalisation is applied to both sides so alias differences
 * (e.g., "Healthcare" vs "Healthtech") don't cause false negatives.
 */
function antiThesisConflictScore(
  startup: SyntheticStartup,
  investor: SyntheticInvestor,
): number {
  const { anti_thesis } = investor;

  // Sector conflict.
  const antiSectorSet = new Set(
    anti_thesis.sectors.map((s) => normaliseSector(s).toLowerCase()),
  );
  const startupSectorsNorm = startup.sectors.map((s) =>
    normaliseSector(s).toLowerCase(),
  );
  const sectorConflict = startupSectorsNorm.some((s) => antiSectorSet.has(s))
    ? 0.4
    : 0;

  // Customer type conflict.
  const antiCustSet = new Set(
    anti_thesis.customer_types.map((c) => c.toLowerCase()),
  );
  const customerConflict = antiCustSet.has(startup.customer_type.toLowerCase())
    ? 0.3
    : 0;

  // Business model conflict.
  const antiBmSet = new Set(
    anti_thesis.business_models.map((bm) => bm.toLowerCase()),
  );
  const bmConflict = antiBmSet.has(startup.business_model.toLowerCase())
    ? 0.2
    : 0;

  // Founder profile keyword heuristic (max 0.10).
  const founderConflict = founderProfileConflict(startup, investor);

  return Math.min(1, sectorConflict + customerConflict + bmConflict + founderConflict);
}

/**
 * Keyword-based heuristic for founder profile anti-thesis conflicts.
 * Returns a score in [0, 0.10].
 *
 * This is a heuristic and is intentionally capped low — the structured
 * sector/customer_type/business_model checks carry most of the signal.
 * Phase 3 may replace this with embedding similarity over founder_background
 * vs anti_thesis.founder_profiles text.
 */
function founderProfileConflict(
  startup: SyntheticStartup,
  investor: SyntheticInvestor,
): number {
  const antiProfiles = investor.anti_thesis.founder_profiles;
  if (antiProfiles.length === 0) return 0;

  const bg = startup.founder_background.toLowerCase();
  const oneliner = startup.one_liner.toLowerCase();
  let score = 0;

  for (const profile of antiProfiles) {
    const p = profile.toLowerCase();

    // "Solo" or "no co-founder" anti-thesis vs solo-founder background.
    if (
      (p.includes("solo") || p.includes("no co-founder")) &&
      (bg.includes("solo founder") || bg.includes("no co-founder"))
    ) {
      score = Math.max(score, 0.07);
    }

    // Non-technical founder anti-thesis.
    if (
      (p.includes("non-technical") || p.includes("no technical co-founder")) &&
      (bg.includes("no technical") ||
        (bg.includes("mba") && !bg.includes("co-founder")))
    ) {
      score = Math.max(score, 0.08);
    }

    // First-time founder anti-thesis.
    if (
      p.includes("first-time") &&
      (bg.includes("first-time") || bg.includes("first time"))
    ) {
      score = Math.max(score, 0.05);
    }

    // Vague/generic description anti-thesis — use one_liner as a proxy.
    if ((p.includes("vague") || p.includes("generic")) && oneliner.length < 40) {
      score = Math.max(score, 0.06);
    }

    // Pre-revenue consumer anti-thesis.
    if (
      (p.includes("pre-revenue") || p.includes("b2c consumer")) &&
      (startup.traction === "no_traction" || startup.traction === "waitlist") &&
      startup.customer_type === "consumer"
    ) {
      score = Math.max(score, 0.07);
    }
  }

  return Math.min(0.1, score);
}

/**
 * Compatibility between startup customer type and investor preferences.
 * Uses CUSTOMER_TYPE_COMPAT to give partial credit to economically adjacent
 * types (e.g., smb ↔ enterprise = 0.5).
 */
function customerTypeOverlapScore(
  startup: SyntheticStartup,
  investor: SyntheticInvestor,
): number {
  const { customer_type_preference } = investor;
  if (customer_type_preference.length === 0) return 0.5;

  const compatMap = CUSTOMER_TYPE_COMPAT[startup.customer_type] ?? {};
  const scores = customer_type_preference.map(
    (pref) => compatMap[pref.toLowerCase()] ?? 0,
  );
  return Math.max(0, ...scores);
}

/**
 * Compatibility between startup business model and investor preferences.
 * Uses BM_COMPAT to give partial credit for similar models.
 */
function businessModelOverlapScore(
  startup: SyntheticStartup,
  investor: SyntheticInvestor,
): number {
  const { business_model_preference } = investor;
  if (business_model_preference.length === 0) return 0.5;

  const bmRow = BM_COMPAT[startup.business_model] ?? {};
  const scores = business_model_preference.map(
    (pref) => bmRow[pref.toLowerCase()] ?? 0,
  );
  return Math.max(0, ...scores);
}

/**
 * Fit between the investor's lead/follow preference and the startup's
 * engagement signals.
 *
 * Engagement signals are inferred from onboarding_interests: startups listing
 * "hands_on_technical_support", "board_expertise", "recruiting_help", or
 * "fundraising_strategy" are treated as wanting an engaged lead investor.
 *
 * Rationale: a follow-only investor checking into a startup that explicitly
 * needs a lead creates a process gap that typically blocks the deal.
 */
function leadFollowScore(
  startup: SyntheticStartup,
  investor: SyntheticInvestor,
): number {
  const { lead_or_follow } = investor;
  if (lead_or_follow === "either") return 1.0;

  const ENGAGEMENT_SIGNALS = new Set([
    "hands_on_technical_support",
    "board_expertise",
    "recruiting_help",
    "fundraising_strategy",
  ]);
  const wantsEngagement = startup.onboarding_interests.some((i) =>
    ENGAGEMENT_SIGNALS.has(i),
  );

  if (wantsEngagement) {
    return lead_or_follow === "lead" ? 1.0 : 0.5;
  }

  // No explicit engagement signal — both lead and follow are acceptable.
  return lead_or_follow === "lead" ? 0.8 : 0.7;
}

/** Maps startup traction tier to [0, 1]. */
function tractionStrengthScore(startup: SyntheticStartup): number {
  return TRACTION_SCORES[startup.traction] ?? 0;
}

/**
 * Profile completeness score — average of startup and investor completeness.
 *
 * Startup checks (15 total):
 *   name, one_liner >= 40 chars, problem >= 60 chars, solution >= 60 chars,
 *   sectors non-empty, stage, raise_amount > 0, location, customer_type,
 *   business_model, traction, founder_background >= 60 chars, technical_depth,
 *   distribution_motion, onboarding_interests non-empty.
 *
 * Investor checks (14 total):
 *   name, firm, investment_thesis >= 100 chars, sectors non-empty,
 *   stages non-empty, check_min >= 0, check_max > check_min, geographies
 *   non-empty, customer_type_preference non-empty, business_model_preference
 *   non-empty, lead_or_follow, at least one anti_thesis field non-empty,
 *   onboarding_interests non-empty, portfolio_style non-empty.
 */
function profileCompletenessScore(
  startup: SyntheticStartup,
  investor: SyntheticInvestor,
): number {
  const startupChecks: boolean[] = [
    startup.name.length > 0,
    startup.one_liner.length >= 40,
    startup.problem.length >= 60,
    startup.solution.length >= 60,
    startup.sectors.length > 0,
    Boolean(startup.stage),
    startup.raise_amount > 0,
    startup.location.length > 0,
    Boolean(startup.customer_type),
    startup.business_model.length > 0,
    Boolean(startup.traction),
    startup.founder_background.length >= 60,
    Boolean(startup.technical_depth),
    Boolean(startup.distribution_motion),
    startup.onboarding_interests.length > 0,
  ];

  const investorChecks: boolean[] = [
    investor.name.length > 0,
    investor.firm.length > 0,
    investor.investment_thesis.length >= 100,
    investor.sectors.length > 0,
    investor.stages.length > 0,
    investor.check_min >= 0,
    investor.check_max > investor.check_min,
    investor.geographies.length > 0,
    investor.customer_type_preference.length > 0,
    investor.business_model_preference.length > 0,
    Boolean(investor.lead_or_follow),
    investor.anti_thesis.sectors.length > 0 ||
      investor.anti_thesis.customer_types.length > 0 ||
      investor.anti_thesis.business_models.length > 0,
    investor.onboarding_interests.length > 0,
    investor.portfolio_style.length > 0,
  ];

  const startupScore =
    startupChecks.filter((b) => b).length / startupChecks.length;
  const investorScore =
    investorChecks.filter((b) => b).length / investorChecks.length;

  return (startupScore + investorScore) / 2;
}
