/**
 * lib/matching/production-features.ts
 *
 * Adapts live production startup/investor rows to MatchFeatures for the Phase 15
 * shadow scorer.  No DB clients, no network calls.
 *
 * ─── DESIGN NOTES ────────────────────────────────────────────────────────────
 * The Phase 11c LogReg model was trained on SyntheticStartup / SyntheticInvestor
 * objects that contain fields not yet in the production schema
 * (onboarding_interests, anti_thesis, business_model, lead_or_follow, etc.).
 *
 * For those absent fields we apply documented neutral/conservative defaults so
 * the model still produces a meaningful score from the features that DO exist
 * in production.  All defaults are listed in the "Missing field defaults" section
 * of the Phase 15 spec and are documented here field-by-field.
 *
 * IMPORTANT: The computed MatchFeatures values drive only the shadow model score
 * that is stored in feed_impressions.model_score.  They never change feed ordering.
 * scoreMatch in lib/matching/score.ts is the production ranker.
 *
 * ─── NOTICE ──────────────────────────────────────────────────────────────────
 * • Not investment advice.
 * • Does not predict startup success or investment returns.
 * • scoreMatch in lib/matching/score.ts is the active production ranker.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { normaliseSector } from "@/lib/profile/sectors";
import type { MatchFeatures, SyntheticAntiThesis } from "@/lib/matching/features";

// ── Minimal production row shapes ──────────────────────────────────────────
// Defined locally so this module works without importing @/types/database,
// which transitively pulls in DB-client resolution in script contexts.
// Structurally compatible with the real DB rows (checked manually).

/**
 * Fields we read from a live startups row.
 * All are optional/nullable to be defensive against schema variations.
 */
export interface ProductionStartupLike {
  /** Canonical sector labels selected by the founder (multi-sector, up to 3). */
  startup_sectors?: string[] | null;
  /** Legacy single-industry column; fallback when startup_sectors is empty. */
  industry?: string | null;
  /** Current fundraise stage. */
  stage?: string | null;
  /** USD raise target for the current round. */
  raise_amount?: number | null;
  /** Legacy freeform traction description. */
  traction?: string | null;
  /** City, State / City, Country string. */
  location?: string | null;
  /** Primary customer type (consumer, smb, enterprise, …). */
  customer_type?: string | null;
}

/**
 * Fields we read from a live investors row.
 */
export interface ProductionInvestorLike {
  /** Canonical sector labels this investor funds. */
  sectors?: string[] | null;
  /** Stage preferences. */
  stages?: string[] | null;
  /** Minimum check size in USD. */
  check_min?: number | null;
  /** Maximum check size in USD. */
  check_max?: number | null;
  /** Geography preference strings (city / country / region). */
  geographies?: string[] | null;
}

/**
 * Optional structured depth context from child tables — mirrors MatchDepthContext
 * from score.ts without importing it.
 */
export interface ProductionDepthContext {
  /** Rows from startup_traction_signals — drives traction_strength_score. */
  tractionSignals?: Array<{
    kind: string;
    value_numeric: number | string | null;
  }>;
}

// ── Stage ordering for soft stage-distance scoring ────────────────────────
// Must match STAGE_ORDER in lib/matching/features.ts.
const STAGE_ORDER: Record<string, number> = {
  idea: 0,
  pre_seed: 1,
  seed: 2,
  series_a: 3,
  series_b_plus: 4,
};

// ── Sector overlap ────────────────────────────────────────────────────────

function sectorOverlap(
  startup: ProductionStartupLike,
  investor: ProductionInvestorLike,
): number {
  // Prefer multi-sector column; fall back to legacy single industry.
  const rawSectors =
    startup.startup_sectors && startup.startup_sectors.length > 0
      ? startup.startup_sectors
      : startup.industry
        ? [startup.industry]
        : [];

  const investorSectors = investor.sectors ?? [];

  if (rawSectors.length === 0 || investorSectors.length === 0) return 0;

  const normalise = (arr: string[]) =>
    arr.map((s) => normaliseSector(s).toLowerCase());

  const investorSet = new Set(normalise(investorSectors));
  const startupNorm = normalise(rawSectors);
  const matchCount = startupNorm.filter((s) => investorSet.has(s)).length;

  return matchCount / rawSectors.length;
}

// ── Stage match ───────────────────────────────────────────────────────────

function stageMatch(
  startup: ProductionStartupLike,
  investor: ProductionInvestorLike,
): number {
  const investorStages = investor.stages ?? [];
  if (investorStages.length === 0 || !startup.stage) return 0;

  const startupRank = STAGE_ORDER[startup.stage] ?? -1;
  if (startupRank === -1) return 0; // unknown stage

  let best = 0;
  for (const s of investorStages) {
    const rank = STAGE_ORDER[s] ?? -1;
    if (rank === -1) continue;
    const dist = Math.abs(startupRank - rank);
    const score = dist === 0 ? 1.0 : dist === 1 ? 0.5 : dist === 2 ? 0.2 : 0;
    if (score > best) best = score;
  }

  return best;
}

// ── Check size fit ────────────────────────────────────────────────────────

function checkSize(
  startup: ProductionStartupLike,
  investor: ProductionInvestorLike,
): number {
  const raise = startup.raise_amount;
  const checkMin = investor.check_min ?? 0;
  const checkMax = investor.check_max ?? 0;

  if (raise == null || !Number.isFinite(raise) || raise < 0) return 0;
  if (checkMax <= 0) return 0;
  if (raise >= checkMin && raise <= checkMax) return 1;

  if (raise < checkMin) {
    if (checkMin === 0) return 0;
    return Math.max(0, 1 - (checkMin - raise) / checkMin);
  }

  return Math.max(0, 1 - (raise - checkMax) / checkMax);
}

// ── Geography ─────────────────────────────────────────────────────────────
// Simplified vs features.ts: the production feed already does geo filtering
// so most pairs we score will have a plausible geo match.  We replicate the
// same rules (global → 1.0, substring match → 1.0, else → 0.2) without the
// full COUNTRY_CONTINENT and US_STATE expansion that live in features.ts.
// The result feeds the model; any calibration difference is acceptable for
// shadow mode.

function geography(
  startup: ProductionStartupLike,
  investor: ProductionInvestorLike,
): number {
  const location = startup.location;
  const geographies = investor.geographies ?? [];

  if (!location || geographies.length === 0) return 0.5; // neutral default

  const loc = location.toLowerCase().trim();
  const geosLower = geographies.map((g) => g.toLowerCase());

  // Global investor.
  if (geosLower.some((g) => g === "global")) return 1;

  // Remote startup — neutral.
  if (loc === "remote") return geographies.length > 3 ? 0.6 : 0.4;

  // Substring match in either direction.
  if (geosLower.some((g) => loc.includes(g))) return 1;
  const city = loc.split(",")[0].trim();
  if (city && geosLower.some((g) => g.includes(city))) return 1;

  // Default: slight geographic tension.
  return 0.2;
}

// ── Traction strength ─────────────────────────────────────────────────────
// Mirrors the traction scoring in lib/matching/score.ts (v1.1):
//   structured signals when available, freeform text fallback.

const SIGNAL_SCORES: Record<string, (v: number) => number> = {
  mrr:               (v) => (v > 0 ? 1.0 : 0.4),
  arr:               (v) => (v > 0 ? 1.0 : 0.4),
  gross_revenue:     (v) => (v > 0 ? 1.0 : 0.4),
  contracted_revenue:(v) => (v > 0 ? 1.0 : 0.4),
  gmv:               (v) => (v > 0 ? 1.0 : 0.4),
  retention_day_30:  (v) => (v >= 60 ? 1.0 : v >= 40 ? 0.7 : 0.5),
  retention_day_90:  (v) => (v >= 40 ? 1.0 : v >= 20 ? 0.7 : 0.5),
  paying_customers:  (v) => (v >= 100 ? 0.9 : v >= 10 ? 0.85 : 0.6),
  design_partners:   (v) => (v >= 3 ? 0.85 : v >= 1 ? 0.7 : 0),
  signed_lois:       (v) => (v >= 3 ? 0.85 : v >= 1 ? 0.7 : 0),
  growth_rate_mom:   (v) => (v >= 20 ? 0.7 : v > 0 ? 0.5 : 0),
  waitlist_size:     (v) => (v >= 1000 ? 0.7 : v >= 100 ? 0.5 : 0.3),
  nps:               (v) => (v >= 40 ? 0.7 : v >= 20 ? 0.5 : 0.3),
  gross_margin_pct:  (v) => (v >= 60 ? 0.8 : v >= 40 ? 0.6 : v >= 20 ? 0.4 : 0.2),
};

function tractionStrength(
  startup: ProductionStartupLike,
  depth?: ProductionDepthContext,
): number {
  const signals = depth?.tractionSignals;

  if (signals && signals.length > 0) {
    let best = 0;
    for (const s of signals) {
      const scorer = SIGNAL_SCORES[s.kind];
      if (!scorer) continue;
      const v =
        typeof s.value_numeric === "string"
          ? Number(s.value_numeric)
          : (s.value_numeric ?? 0);
      const score = scorer(isFinite(v) ? v : 0);
      if (score > best) best = score;
    }
    if (best > 0) return best;
  }

  // Freeform text fallback (mirrors score.ts v1.1).
  const text = startup.traction;
  if (!text) return 0;
  const len = text.trim().length;
  if (len >= 240) return 1;
  if (len >= 80) return 0.6;
  if (len > 0) return 0.3;
  return 0;
}

// ── Anti-thesis conflict ──────────────────────────────────────────────────
// Replicates the scoring logic from lib/matching/features.ts
// (antiThesisConflictScore + founderProfileConflict) but operates on
// production data columns instead of SyntheticStartup fields.
//
// Component weights (must match features.ts):
//   sector         0.40 — binary: any startup sector in anti_thesis.sectors
//   customer_type  0.30 — binary: startup.customer_type in anti_thesis.customer_types
//   business_model 0.20 — binary: (not in production schema yet, always 0)
//   founder_profile 0.10 — keyword heuristic against startup fields
//
// Phase 17 note: customer_type anti-patterns and business_model anti-patterns
// are not available from the production investor_anti_patterns table yet
// (no matching kind enum value).  Their weights are preserved for future phases;
// current contributions are 0.

function antiThesisConflict(
  startup: ProductionStartupLike,
  antiThesis: SyntheticAntiThesis,
): number {
  // Sector conflict (weight 0.40).
  const antiSectorSet = new Set(
    antiThesis.sectors.map((s) => normaliseSector(s).toLowerCase()),
  );
  const startupSectors =
    startup.startup_sectors && startup.startup_sectors.length > 0
      ? startup.startup_sectors
      : startup.industry
        ? [startup.industry]
        : [];
  const startupSectorsNorm = startupSectors.map((s) => normaliseSector(s).toLowerCase());
  const sectorConflict = startupSectorsNorm.some((s) => antiSectorSet.has(s)) ? 0.4 : 0;

  // Customer-type conflict (weight 0.30 — always 0 in Phase 17, no production kind).
  const antiCustSet = new Set(antiThesis.customer_types.map((c) => c.toLowerCase()));
  const custConflict =
    startup.customer_type && antiCustSet.has(startup.customer_type.toLowerCase()) ? 0.3 : 0;

  // Business-model conflict (weight 0.20 — always 0 in Phase 17, no business_model column).
  const bmConflict = 0;

  // Founder-profile keyword heuristic (max 0.10).
  const founderConflict = productionFounderProfileConflict(startup, antiThesis);

  return Math.min(1, sectorConflict + custConflict + bmConflict + founderConflict);
}

/**
 * Keyword heuristic for founder-profile anti-thesis conflicts.
 * Mirrors features.ts's founderProfileConflict but uses production columns
 * (traction text as a proxy for founder background; one_liner not available
 * in the production row shape).
 * Returns a score in [0, 0.10].
 */
function productionFounderProfileConflict(
  startup: ProductionStartupLike,
  antiThesis: SyntheticAntiThesis,
): number {
  const antiProfiles = antiThesis.founder_profiles;
  if (antiProfiles.length === 0) return 0;

  // Use traction as the best available proxy for founder-background text
  // in Phase 17 (founder_background is not a column on the production
  // startups table).  Signal is weak but honest — we don't invent data.
  const bg = (startup.traction ?? "").toLowerCase();
  let score = 0;

  for (const profile of antiProfiles) {
    const p = profile.toLowerCase();

    if (
      (p.includes("solo") || p.includes("no co-founder")) &&
      (bg.includes("solo founder") || bg.includes("no co-founder"))
    ) {
      score = Math.max(score, 0.07);
    }
    if (
      (p.includes("non-technical") || p.includes("no technical co-founder")) &&
      (bg.includes("no technical") || (bg.includes("mba") && !bg.includes("co-founder")))
    ) {
      score = Math.max(score, 0.08);
    }
    if (
      p.includes("first-time") &&
      (bg.includes("first-time") || bg.includes("first time"))
    ) {
      score = Math.max(score, 0.05);
    }
  }

  return Math.min(0.1, score);
}

// ── Profile completeness ──────────────────────────────────────────────────
// Uses field presence to estimate structural completeness — same intent as
// profileCompletenessScore in features.ts but restricted to production columns.
// Content quality is captured by traction, check size, and sector overlap.

function profileCompleteness(
  startup: ProductionStartupLike,
  investor: ProductionInvestorLike,
): number {
  // Startup completeness (5 signals).
  let startupPoints = 0;
  if ((startup.startup_sectors ?? startup.industry)) startupPoints++;
  if (startup.stage) startupPoints++;
  if (startup.raise_amount != null && startup.raise_amount > 0) startupPoints++;
  if (startup.location) startupPoints++;
  if (startup.traction && startup.traction.trim().length > 20) startupPoints++;
  const startupScore = startupPoints / 5;

  // Investor completeness (4 signals).
  let investorPoints = 0;
  if ((investor.sectors ?? []).length > 0) investorPoints++;
  if ((investor.stages ?? []).length > 0) investorPoints++;
  if ((investor.check_max ?? 0) > 0) investorPoints++;
  if ((investor.geographies ?? []).length > 0) investorPoints++;
  const investorScore = investorPoints / 4;

  return (startupScore + investorScore) / 2;
}

// ── Public adapter ────────────────────────────────────────────────────────

/**
 * Compute MatchFeatures from production-schema startup/investor rows.
 *
 * Features with no production data use documented defaults:
 *   interest_overlap_score    → 0      (no onboarding_interests in rows)
 *   anti_thesis_conflict_score→ 0      (when antiThesis is absent/null)
 *                             → computed from anti-pattern adapter (Phase 17+)
 *   customer_type_overlap_score→ 0.5   (neutral; no investor preference data)
 *   business_model_overlap_score→ 0.5  (neutral; no business_model column yet)
 *   lead_follow_score         → 0.5   (neutral; no lead_or_follow in rows)
 *   semantic_similarity_score → null  (no embeddings service in Phase 15)
 *
 * @param antiThesis Optional — when provided (Phase 17+), computes
 *   anti_thesis_conflict_score from real investor_anti_patterns rows via the
 *   lib/matching/runtime/anti-pattern-adapter.ts pivot.  When absent or null,
 *   anti_thesis_conflict_score defaults to 0 (Phase 15/16 behaviour).
 */
export function computeProductionMatchFeatures(
  startup: ProductionStartupLike,
  investor: ProductionInvestorLike,
  depth?: ProductionDepthContext,
  antiThesis?: SyntheticAntiThesis | null,
): MatchFeatures {
  return {
    sector_overlap_score:          sectorOverlap(startup, investor),
    stage_match_score:             stageMatch(startup, investor),
    check_size_score:              checkSize(startup, investor),
    geography_score:               geography(startup, investor),
    // No onboarding_interests in production rows → conservative 0.
    interest_overlap_score:        0,
    // Phase 17+: computed from investor_anti_patterns via adapter.
    // Phase 15/16 callers that don't pass antiThesis default to 0.
    anti_thesis_conflict_score:    antiThesis ? antiThesisConflict(startup, antiThesis) : 0,
    // No customer_type_preference column → neutral 0.5.
    customer_type_overlap_score:   0.5,
    // No business_model column → neutral 0.5.
    business_model_overlap_score:  0.5,
    // No lead_or_follow preference → neutral 0.5.
    lead_follow_score:             0.5,
    traction_strength_score:       tractionStrength(startup, depth),
    profile_completeness_score:    profileCompleteness(startup, investor),
    // No embeddings service in Phase 15/16/17 → null (imputed to 0.0 by feature-vector.ts).
    semantic_similarity_score:     null,
  };
}
