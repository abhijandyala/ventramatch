/**
 * lib/quality/rules/field-shape.ts
 *
 * Rule category: field presence and basic shape validation.
 *
 * These are the cheapest, most reliable checks — they run first in the
 * pipeline and typically account for the majority of bot-recommended declines.
 *
 * Rules in this file:
 *   • Core field presence (name, one_liner / thesis, sectors, stages)
 *   • Minimum length thresholds
 *   • Test-data / garbage input detection
 *   • Numeric sanity (raise_amount non-negative; check_min ≤ check_max)
 *   • Basic plausibility (location not a single character, etc.)
 *
 * Rules NOT in this file (added in Phase 13b):
 *   • Buzzword density (requires token-level analysis)
 *   • Stage-to-raise plausibility bands (numeric-realism category)
 *   • Cross-field consistency (narrative vs one_liner duplication, etc.)
 *   • Spam pattern detection (format-safety category)
 *
 * All functions are pure: no I/O, no async, no database access.
 * Performance: < 1 ms per profile for this rule category.
 */

import type { QualityFlag, StartupQualityInput, InvestorQualityInput } from "../types";

// ── Internal helpers ────────────────────────────────────────────────────────

/** Trimmed string or empty string if null/undefined. */
function str(v: string | null | undefined): string {
  return v?.trim() ?? "";
}

/** True if the value is a non-empty, non-whitespace string of at least `min` characters. */
function hasLength(v: string | null | undefined, min = 1): boolean {
  return str(v).length >= min;
}

/**
 * Patterns that strongly indicate test or placeholder data.
 * Matches against the LOWERCASED, TRIMMED value.
 *
 * Severity: suspect (unusual; punt to human) or block (clear garbage).
 * We use suspect for most entries because automated blocking of names is risky —
 * some legitimate companies have short or unusual names ("Og", "aa").
 */
const TEST_DATA_PATTERNS: RegExp[] = [
  /^a+s*d+f*$/,           // "asdf", "asdff"
  /^q+w*e*r*t*y*$/,        // "qwerty"
  /^test\s*\d*$/i,         // "test", "test1", "Test 2"
  /^foo\b/i,               // "foo", "Foo Inc"
  /^bar\b/i,               // "bar", "bar startup"
  /^baz\b/i,
  /^null$/i,
  /^undefined$/i,
  /^lorem\s+ipsum/i,
  /^x+$/i,                  // "xxx", "xxxx"
  /^sample\b/i,
  /^dummy\b/i,
  /^placeholder\b/i,
  /^your\s+(company|startup|firm)\s+name/i,
  /^enter\s+(your|company)/i,
  /^todo\b/i,
];

/** Returns true if the value looks like test/placeholder data. */
function looksLikeTestData(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v.length === 0) return false;
  // All same character (e.g. "aaaa", "####")
  if (v.length >= 2 && new Set(v).size === 1) return true;
  return TEST_DATA_PATTERNS.some((p) => p.test(v));
}

/** Emit a QualityFlag. */
function flag(
  code: string,
  severity: QualityFlag["severity"],
  message: string,
  field: string,
  metadata?: Record<string, unknown>,
): QualityFlag {
  return { code, severity, message, field, ...(metadata ? { metadata } : {}) };
}

// ── Startup field-shape checks ──────────────────────────────────────────────

/**
 * Run all field-shape checks for a startup profile.
 * Returns every flag that fired; an empty array means all checks passed.
 */
export function checkStartupFieldShape(input: StartupQualityInput): QualityFlag[] {
  const flags: QualityFlag[] = [];

  // ── name ───────────────────────────────────────────────────────────────────
  const name = str(input.name);
  if (!hasLength(name)) {
    flags.push(flag(
      "name_missing",
      "block",
      "Company name is required but was not provided.",
      "name",
    ));
  } else if (name.length < 2) {
    flags.push(flag(
      "name_min_length",
      "block",
      `Company name must be at least 2 characters (got ${name.length}).`,
      "name",
      { length: name.length, min: 2 },
    ));
  } else if (looksLikeTestData(name)) {
    flags.push(flag(
      "name_test_data",
      "suspect",
      "Company name matches a test/placeholder pattern. Please verify this is a real company name.",
      "name",
    ));
  }

  // ── one_liner ──────────────────────────────────────────────────────────────
  const oneLiner = str(input.one_liner);
  if (!hasLength(oneLiner)) {
    flags.push(flag(
      "one_liner_missing",
      "block",
      "A one-line description is required but was not provided.",
      "one_liner",
    ));
  } else if (oneLiner.length < 30) {
    flags.push(flag(
      "one_liner_too_short",
      "warning",
      `The one-liner should be at least 30 characters (got ${oneLiner.length}). Please describe what your startup does in more detail.`,
      "one_liner",
      { length: oneLiner.length, min: 30 },
    ));
  }

  // ── sectors ────────────────────────────────────────────────────────────────
  // Accept either the canonical array or the legacy industry string.
  const hasSectors =
    (Array.isArray(input.startup_sectors) && input.startup_sectors.length > 0) ||
    hasLength(input.industry);
  if (!hasSectors) {
    flags.push(flag(
      "sectors_empty",
      "block",
      "At least one sector is required. Please choose a sector that best describes your startup.",
      "startup_sectors",
    ));
  }

  // ── stage ──────────────────────────────────────────────────────────────────
  if (!hasLength(input.stage)) {
    flags.push(flag(
      "stage_missing",
      "block",
      "Company stage is required. Please select your current fundraising stage.",
      "stage",
    ));
  }

  // ── raise_amount ───────────────────────────────────────────────────────────
  // raise_amount is optional (may be null). If present, must be non-negative.
  if (input.raise_amount !== null && input.raise_amount !== undefined) {
    if (input.raise_amount < 0) {
      flags.push(flag(
        "raise_amount_negative",
        "block",
        "Target raise amount cannot be negative.",
        "raise_amount",
        { value: input.raise_amount },
      ));
    }
  }

  // ── location ───────────────────────────────────────────────────────────────
  // Optional field, but if present it should be substantive.
  const location = str(input.location);
  if (hasLength(location) && location.length < 3) {
    flags.push(flag(
      "location_too_short",
      "warning",
      `Location appears too short to be a valid place name (got "${location}"). Please enter a city, region, or country.`,
      "location",
      { length: location.length },
    ));
  }

  // ── website ────────────────────────────────────────────────────────────────
  // Optional, but a website is a strong trust signal; warn if missing.
  // (Phase 13b will validate the URL format; here we only note absence.)
  if (!hasLength(input.website)) {
    flags.push(flag(
      "website_missing",
      "info",
      "A website URL would strengthen your profile. This is not required but is strongly recommended.",
      "website",
    ));
  }

  return flags;
}

// ── Investor field-shape checks ─────────────────────────────────────────────

/**
 * Run all field-shape checks for an investor profile.
 * Returns every flag that fired; an empty array means all checks passed.
 */
export function checkInvestorFieldShape(input: InvestorQualityInput): QualityFlag[] {
  const flags: QualityFlag[] = [];

  // ── name ───────────────────────────────────────────────────────────────────
  const name = str(input.name);
  if (!hasLength(name)) {
    flags.push(flag(
      "name_missing",
      "block",
      "Investor name is required but was not provided.",
      "name",
    ));
  } else if (name.length < 2) {
    flags.push(flag(
      "name_min_length",
      "block",
      `Investor name must be at least 2 characters (got ${name.length}).`,
      "name",
      { length: name.length, min: 2 },
    ));
  } else if (looksLikeTestData(name)) {
    flags.push(flag(
      "name_test_data",
      "suspect",
      "Investor name matches a test/placeholder pattern. Please verify this is a real person or firm name.",
      "name",
    ));
  }

  // ── firm ───────────────────────────────────────────────────────────────────
  // Optional (solo angels may have no firm), but if provided it must be substantive.
  const firm = str(input.firm);
  if (hasLength(firm) && firm.length < 2) {
    flags.push(flag(
      "firm_too_short",
      "warning",
      `Firm name must be at least 2 characters if provided (got ${firm.length}).`,
      "firm",
      { length: firm.length },
    ));
  }

  // ── thesis ─────────────────────────────────────────────────────────────────
  const thesis = str(input.thesis);
  if (!hasLength(thesis)) {
    flags.push(flag(
      "thesis_missing",
      "block",
      "An investment thesis is required. Please describe what you look for in startups.",
      "thesis",
    ));
  } else if (thesis.length < 50) {
    flags.push(flag(
      "thesis_too_short",
      "warning",
      `Investment thesis should be at least 50 characters (got ${thesis.length}). Please add more detail about your investment focus.`,
      "thesis",
      { length: thesis.length, min: 50 },
    ));
  }

  // ── sectors ────────────────────────────────────────────────────────────────
  if (!Array.isArray(input.sectors) || input.sectors.length === 0) {
    flags.push(flag(
      "sectors_empty",
      "block",
      "At least one sector is required. Please select the sectors you invest in.",
      "sectors",
    ));
  }

  // ── stages ─────────────────────────────────────────────────────────────────
  if (!Array.isArray(input.stages) || input.stages.length === 0) {
    flags.push(flag(
      "stages_empty",
      "block",
      "At least one investment stage is required. Please select the stages you invest in.",
      "stages",
    ));
  }

  // ── geographies ────────────────────────────────────────────────────────────
  if (!Array.isArray(input.geographies) || input.geographies.length === 0) {
    flags.push(flag(
      "geographies_empty",
      "block",
      "At least one geography is required. Please select the regions you invest in, or indicate 'Global'.",
      "geographies",
    ));
  }

  // ── check size range ───────────────────────────────────────────────────────
  const hasMin = typeof input.check_min === "number" && input.check_min !== null;
  const hasMax = typeof input.check_max === "number" && input.check_max !== null;

  if (hasMin && (input.check_min as number) <= 0) {
    flags.push(flag(
      "check_min_not_positive",
      "block",
      "Minimum check size must be greater than 0.",
      "check_min",
      { value: input.check_min },
    ));
  }

  if (hasMax && (input.check_max as number) <= 0) {
    flags.push(flag(
      "check_max_not_positive",
      "block",
      "Maximum check size must be greater than 0.",
      "check_max",
      { value: input.check_max },
    ));
  }

  if (
    hasMin && hasMax &&
    (input.check_min as number) > 0 &&
    (input.check_max as number) > 0 &&
    (input.check_min as number) > (input.check_max as number)
  ) {
    flags.push(flag(
      "check_range_inverted",
      "block",
      `Minimum check size ($${input.check_min?.toLocaleString()}) cannot be greater than maximum ($${input.check_max?.toLocaleString()}).`,
      "check_min",
      { check_min: input.check_min, check_max: input.check_max },
    ));
  }

  // ── is_active ──────────────────────────────────────────────────────────────
  // Investors who mark themselves inactive should not publish to the feed.
  // This is a warning (not a block) because is_active may be null for drafts.
  if (input.is_active === false) {
    flags.push(flag(
      "investor_not_active",
      "warning",
      "Your profile is marked as inactive. Please mark yourself as active before publishing to ensure startups can find you.",
      "is_active",
    ));
  }

  return flags;
}
