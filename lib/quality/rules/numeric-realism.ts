/**
 * lib/quality/rules/numeric-realism.ts
 *
 * Rule category: plausibility checks on numeric mandate fields.
 *
 * These checks detect values that are technically valid (non-null, numeric)
 * but implausible for the stated context.  The intent is to surface profiles
 * where founders or investors may have entered unrealistic numbers, not to
 * make any judgment about their likelihood of success or investment merit.
 *
 * This is NOT investment advice.
 * This does NOT predict startup success or funding outcomes.
 * Thresholds are heuristic starting points; they will be calibrated against
 * real application data when the quality system is wired to production.
 *
 * Severity:
 *   warning — value is outside the typical band for this stage/category;
 *             not uncommon for real edge cases.  Human should verify.
 *   block   — NOT used in this file.  Numeric plausibility issues are never
 *             auto-declined because context matters significantly.
 */

import type { QualityFlag, StartupQualityInput, InvestorQualityInput } from "../types";

// ── Stage-to-raise bands (USD) ────────────────────────────────────────────────
// Outside these bands → warning (not block).
// Approved in Phase 13 planning.

const RAISE_BANDS: Record<string, { min: number; max: number }> = {
  idea:          { min: 0,        max: 2_000_000 },
  pre_seed:      { min: 50_000,   max: 3_000_000 },
  seed:          { min: 200_000,  max: 8_000_000 },
  series_a:      { min: 2_000_000, max: 25_000_000 },
  series_b_plus: { min: 5_000_000, max: 200_000_000 },
};

// ── Investor check size heuristics ────────────────────────────────────────────

const INVESTOR_CHECK_ABSOLUTE_MIN     = 1_000;        // $1K
const INVESTOR_WIDE_RANGE_MULTIPLIER  = 500;          // check_max/check_min > 500× is suspect
const INVESTOR_MAX_PLAUSIBLE_CHECK    = 500_000_000;  // $500M

// ── Helpers ───────────────────────────────────────────────────────────────────

function flag(
  code: string,
  severity: QualityFlag["severity"],
  message: string,
  field: string,
  metadata?: Record<string, unknown>,
): QualityFlag {
  return { code, severity, message, field, ...(metadata ? { metadata } : {}) };
}

function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

// ── Startup checks ────────────────────────────────────────────────────────────

export function checkStartupNumericRealism(input: StartupQualityInput): QualityFlag[] {
  const flags: QualityFlag[] = [];

  const stage = input.stage?.trim();
  const raise = input.raise_amount;

  // Stage-to-raise band check
  if (stage && raise !== null && raise !== undefined && raise > 0) {
    const band = RAISE_BANDS[stage];
    if (band) {
      if (raise > band.max) {
        flags.push(flag(
          "raise_above_stage_band",
          "warning",
          `Target raise of ${formatUSD(raise)} appears high for the "${stage}" stage. Typical range is up to ${formatUSD(band.max)}. Please verify this is correct.`,
          "raise_amount",
          { raise_amount: raise, stage, typical_max: band.max, typical_min: band.min },
        ));
      } else if (band.min > 0 && raise < band.min) {
        flags.push(flag(
          "raise_below_stage_band",
          "warning",
          `Target raise of ${formatUSD(raise)} appears low for the "${stage}" stage. Typical range starts at ${formatUSD(band.min)}.`,
          "raise_amount",
          { raise_amount: raise, stage, typical_max: band.max, typical_min: band.min },
        ));
      }
    }
  }

  // Founded year: cannot be in the future
  if (input.founded_year !== null && input.founded_year !== undefined) {
    const currentYear = new Date().getFullYear();
    if (input.founded_year > currentYear) {
      flags.push(flag(
        "founded_year_in_future",
        "warning",
        `Founded year ${input.founded_year} is in the future. Please enter the actual year your company was founded.`,
        "founded_year",
        { founded_year: input.founded_year, current_year: currentYear },
      ));
    } else if (input.founded_year < 1900) {
      flags.push(flag(
        "founded_year_implausible",
        "warning",
        `Founded year ${input.founded_year} is implausibly early. Please verify.`,
        "founded_year",
        { founded_year: input.founded_year },
      ));
    }
  }

  return flags;
}

// ── Investor checks ───────────────────────────────────────────────────────────

export function checkInvestorNumericRealism(input: InvestorQualityInput): QualityFlag[] {
  const flags: QualityFlag[] = [];

  const checkMin = input.check_min;
  const checkMax = input.check_max;

  const hasMin = typeof checkMin === "number" && checkMin !== null;
  const hasMax = typeof checkMax === "number" && checkMax !== null;

  // Both present and positive: check plausibility
  if (hasMin && hasMax && (checkMin as number) > 0 && (checkMax as number) > 0) {
    const min = checkMin as number;
    const max = checkMax as number;

    // Absolute minimum sanity
    if (min < INVESTOR_CHECK_ABSOLUTE_MIN) {
      flags.push(flag(
        "check_min_implausibly_low",
        "warning",
        `Minimum check size of ${formatUSD(min)} is unusually low for an institutional investor profile. Please verify.`,
        "check_min",
        { check_min: min, threshold: INVESTOR_CHECK_ABSOLUTE_MIN },
      ));
    }

    // Maximum sanity
    if (max > INVESTOR_MAX_PLAUSIBLE_CHECK) {
      flags.push(flag(
        "check_max_implausibly_high",
        "warning",
        `Maximum check size of ${formatUSD(max)} is unusually large. Please verify.`,
        "check_max",
        { check_max: max, threshold: INVESTOR_MAX_PLAUSIBLE_CHECK },
      ));
    }

    // Absurdly wide range (max/min > 500×)
    if (max / min > INVESTOR_WIDE_RANGE_MULTIPLIER) {
      flags.push(flag(
        "check_range_implausibly_wide",
        "warning",
        `Check size range from ${formatUSD(min)} to ${formatUSD(max)} is very wide (${Math.round(max / min)}×). Most investors have a tighter range. Please consider narrowing it or using per-stage check bands.`,
        "check_max",
        { check_min: min, check_max: max, ratio: Math.round(max / min) },
      ));
    }
  }

  return flags;
}
