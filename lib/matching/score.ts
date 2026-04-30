/**
 * Match score v1.1. Weighted compatibility between a startup and an investor.
 *
 * Spec lives in docs/matching-algorithm.md. Disclaimer: this is a heuristic.
 * It is informational and is never investment advice.
 *
 * v1.1 changes (Phase 5 / profile-depth sprint):
 *   - `tractionScore` uses structured `startup_traction_signals` rows when
 *     available; falls back to the freeform `traction` string.
 *   - `checkScore` uses `investor_check_bands` per-stage rows when available;
 *     falls back to the legacy `check_min` / `check_max` scalar.
 *   - New weight for `process`: a "lead wanted + investor has open lead slot"
 *     signal drives a small bonus (0.05 weight).
 */

import type { Database } from "@/types/database";
import { sectorMatches } from "@/lib/profile/sectors";

type Startup = Database["public"]["Tables"]["startups"]["Row"];
type Investor = Database["public"]["Tables"]["investors"]["Row"];
type TractionSignalRow =
  Database["public"]["Tables"]["startup_traction_signals"]["Row"];
type CheckBandRow =
  Database["public"]["Tables"]["investor_check_bands"]["Row"];

const WEIGHTS = {
  sector: 0.28,
  stage: 0.23,
  check: 0.2,
  geography: 0.14,
  traction: 0.1,
  process: 0.05,
} as const;

export interface MatchResult {
  /** 0–100 integer percent. */
  score: number;
  /** One-line, human-readable rationale. Plain English; no marketing words. */
  reason: string;
  /** Breakdown for debugging and dashboard display. Each sub is 0..1. */
  breakdown: {
    sector: number;
    stage: number;
    check: number;
    geography: number;
    traction: number;
    process: number;
  };
}

export type MatchDepthContext = {
  /** Structured traction signals from startup_traction_signals. */
  tractionSignals?: TractionSignalRow[];
  /** Per-stage check bands from investor_check_bands. */
  checkBands?: CheckBandRow[];
  /**
   * True if the startup's startup_round_details.lead_status is
   * 'open' or 'soliciting_lead'.
   */
  wantsLead?: boolean;
};

/**
 * Score a startup–investor pair.
 *
 * @param startup  The canonical startups row.
 * @param investor The canonical investors row.
 * @param depth    Optional structured depth data from the child tables.
 *                 When provided, structured fields take precedence over
 *                 the freeform fallbacks on the parent rows.
 */
export function scoreMatch(
  startup: Startup,
  investor: Investor,
  depth?: MatchDepthContext,
): MatchResult {
  // Sprint 9.5.D: use the full sectors array when available; fall back to
  // the legacy single `industry` column for pre-migration rows.
  const startupSectors =
    startup.startup_sectors?.length > 0 ? startup.startup_sectors : [startup.industry];
  const sector = sectorScore(startupSectors, investor.sectors);
  const stage = stageScore(startup.stage, investor.stages);
  const check = checkScore(
    startup.raise_amount,
    startup.stage,
    investor.check_min,
    investor.check_max,
    depth?.checkBands,
  );
  const geography = geographyScore(startup.location, investor.geographies);
  const traction = tractionScore(startup.traction, depth?.tractionSignals);
  const process = processScore(startup.stage, depth?.wantsLead, depth?.checkBands);

  const raw =
    sector * WEIGHTS.sector +
    stage * WEIGHTS.stage +
    check * WEIGHTS.check +
    geography * WEIGHTS.geography +
    traction * WEIGHTS.traction +
    process * WEIGHTS.process;

  const score = Math.round(raw * 100);
  const reason = buildReason(
    { sector, stage, check, geography, traction, process },
    investor,
    depth,
  );

  return {
    score,
    reason,
    breakdown: { sector, stage, check, geography, traction, process },
  };
}

function sectorScore(startupSectors: string[], investorSectors: string[]): number {
  if (investorSectors.length === 0 || startupSectors.length === 0) return 0;
  // Any overlap counts as a match. Canonical normalisation so legacy
  // aliases ("Healthcare") match canonical labels ("Healthtech").
  return startupSectors.some((s) => sectorMatches(s, investorSectors)) ? 1 : 0;
}

function stageScore(
  startupStage: Database["public"]["Enums"]["startup_stage"],
  investorStages: Database["public"]["Enums"]["startup_stage"][],
): number {
  if (investorStages.length === 0) return 0;
  return investorStages.includes(startupStage) ? 1 : 0;
}

function checkScore(
  raiseAmount: number | null,
  startupStage: Database["public"]["Enums"]["startup_stage"],
  legacyCheckMin: number,
  legacyCheckMax: number,
  checkBands?: CheckBandRow[],
): number {
  if (raiseAmount == null) return 0;

  // Prefer per-stage band when available — look for a lead band first, then
  // follow, at the startup's stage.
  if (checkBands && checkBands.length > 0) {
    const stageBands = checkBands.filter((b) => b.stage === startupStage);
    if (stageBands.length > 0) {
      // Take the best score across all role bands for this stage.
      return Math.max(
        ...stageBands.map((b) =>
          rangeScore(raiseAmount, b.check_min_usd, b.check_max_usd),
        ),
      );
    }
  }

  // Legacy fallback: scalar check_min / check_max on the investors row.
  if (legacyCheckMax <= 0) return 0;
  return rangeScore(raiseAmount, legacyCheckMin, legacyCheckMax);
}

function rangeScore(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return 1;
  const distance =
    value < min ? (min - value) / min : (value - max) / max;
  return Math.max(0, 1 - distance);
}

function geographyScore(
  startupLocation: string | null,
  investorGeos: string[],
): number {
  if (!startupLocation || investorGeos.length === 0) return 0;
  const target = startupLocation.toLowerCase();
  return investorGeos.some((g) => target.includes(g.toLowerCase())) ? 1 : 0.4;
}

/**
 * Traction score v1.1 — structured signals when present, freeform fallback.
 *
 * Structured scoring: the BEST single signal drives the score so a startup
 * with one strong confirmed metric (e.g. $50K MRR from Stripe) scores the
 * same as one with five weaker ones. This avoids rewarding signal quantity
 * over signal quality.
 *
 * Tiers (mirrors investor mental model):
 *   1.0 — revenue signal (MRR, ARR, gross_revenue) or high D30 retention
 *   0.85 — customers / design partners / signed LOIs
 *   0.7  — growth rate ≥ 20 % or waitlist > 1000 or NPS > 40
 *   0.5  — any other confirmed structured signal
 *   0.3  — freeform traction text (≥ 80 chars)
 *   0.1  — freeform traction text (< 80 chars)
 *   0.0  — no traction
 */
function tractionScore(
  legacyTraction: string | null,
  signals?: TractionSignalRow[],
): number {
  if (signals && signals.length > 0) {
    const best = signals.reduce((max, s) => {
      const score = signalScore(s);
      return score > max ? score : max;
    }, 0);
    if (best > 0) return best;
  }

  // Freeform fallback (v1 behaviour).
  if (!legacyTraction) return 0;
  const len = legacyTraction.trim().length;
  if (len >= 240) return 1;
  if (len >= 80) return 0.6;
  if (len > 0) return 0.3;
  return 0;
}

function signalScore(s: TractionSignalRow): number {
  const v = typeof s.value_numeric === "string"
    ? Number(s.value_numeric)
    : s.value_numeric;
  switch (s.kind) {
    case "mrr":
    case "arr":
    case "gross_revenue":
    case "contracted_revenue":
    case "gmv":
      return v > 0 ? 1.0 : 0.4;
    case "retention_day_30":
      return v >= 60 ? 1.0 : v >= 40 ? 0.7 : 0.5;
    case "retention_day_90":
      return v >= 40 ? 1.0 : v >= 20 ? 0.7 : 0.5;
    case "paying_customers":
      return v >= 100 ? 0.9 : v >= 10 ? 0.85 : 0.6;
    case "design_partners":
    case "signed_lois":
      return v >= 3 ? 0.85 : v >= 1 ? 0.7 : 0;
    case "gross_margin_pct":
      return v >= 70 ? 0.9 : v >= 50 ? 0.7 : 0.5;
    case "nps":
      return v >= 40 ? 0.7 : v >= 0 ? 0.5 : 0.3;
    case "dau":
    case "mau":
    case "waitlist_size":
      return v >= 1000 ? 0.7 : v >= 100 ? 0.5 : 0.3;
    case "cac_usd":
    case "ltv_usd":
      return 0.5;
    default:
      return 0.5;
  }
}

/**
 * Process fit signal: does the investor have capacity (a lead or follow
 * check band) for the startup's stage AND does the startup want a lead?
 * Small bonus only — not enough to outweigh mandate mismatch.
 */
function processScore(
  startupStage: Database["public"]["Enums"]["startup_stage"],
  wantsLead?: boolean,
  checkBands?: CheckBandRow[],
): number {
  if (!checkBands || checkBands.length === 0) return 0;
  const hasLeadBand = checkBands.some(
    (b) => b.stage === startupStage && b.role === "lead",
  );
  if (wantsLead && hasLeadBand) return 1;
  const hasAnyBand = checkBands.some((b) => b.stage === startupStage);
  return hasAnyBand ? 0.5 : 0;
}

function buildReason(
  parts: MatchResult["breakdown"],
  investor: Investor,
  depth?: MatchDepthContext,
): string {
  const reasons: string[] = [];
  if (parts.sector === 1 && investor.sectors[0])
    reasons.push(`invests in ${investor.sectors[0]}`);
  if (parts.stage === 1 && investor.stages[0])
    reasons.push(`backs ${stageLabel(investor.stages[0])}`);
  if (parts.check === 1) {
    reasons.push(
      depth?.checkBands?.length
        ? "check size fits per-stage mandate"
        : "check size fits",
    );
  }
  if (parts.geography >= 1) reasons.push("covers your geography");
  if (parts.traction >= 0.9) reasons.push("strong traction signal");
  if (parts.process === 1) reasons.push("actively seeking a lead");

  if (reasons.length === 0) return "Low overall fit. Improve profile or check filters.";
  return (
    reasons
      .slice(0, 2)
      .join(" and ")
      .replace(/^\w/, (c) => c.toUpperCase()) + "."
  );
}

function stageLabel(
  stage: Database["public"]["Enums"]["startup_stage"],
): string {
  switch (stage) {
    case "idea":
      return "idea-stage";
    case "pre_seed":
      return "pre-seed";
    case "seed":
      return "seed";
    case "series_a":
      return "Series A";
    case "series_b_plus":
      return "Series B+";
  }
}
