/**
 * lib/quality/rules/cross-field-consistency.ts
 *
 * Rule category: cross-field consistency checks.
 *
 * These checks look for contradictions or redundancies ACROSS fields within
 * the same profile.  Individual field validity is handled by field-shape,
 * length-thresholds, buzzword-density, and numeric-realism.
 *
 * Phase 13b checks:
 *   • one_liner and problem statement should not be near-duplicates.
 *   • one_liner and solution description should not be near-duplicates.
 *   • Traction description and stage should be mutually plausible.
 *   • Investor with very broad mandate (all sectors, all stages) should
 *     have a specific thesis — otherwise the mandate is uninformative.
 *
 * Severity:
 *   suspect — near-duplication across narrative fields (possible copy-paste).
 *   warning — traction/stage tension; broad mandate with thin thesis.
 *   info    — (none in this file for now)
 *
 * Algorithm for near-duplication: word Jaccard similarity.
 *   similarity = |words(A) ∩ words(B)| / |words(A) ∪ words(B)|
 *   Skip words with < 4 characters (stop-word filtering).
 *   Threshold 0.70 → suspect.
 */

import type { QualityFlag, StartupQualityInput, InvestorQualityInput } from "../types";

// ── Thresholds ─────────────────────────────────────────────────────────────────

const DUPLICATE_SUSPECT_THRESHOLD  = 0.70;  // Jaccard similarity
const DUPLICATE_WARNING_THRESHOLD  = 0.50;
const TRACTION_STAGE_MISMATCH_TERMS = ["arr", "mrr", "revenue", "paying", "enterprise contracts"];
const BROAD_MANDATE_SECTORS_MIN    = 8;    // ≥ 8 sectors → "very broad"
const BROAD_MANDATE_STAGES_MIN     = 4;    // ≥ 4 stages → "all-stage"
const BROAD_MANDATE_THESIS_MIN     = 80;   // thesis must have ≥ 80 chars to compensate

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

function str(v: string | null | undefined): string {
  return v?.trim() ?? "";
}

/** Tokenise to meaningful words (≥ 4 chars, alphanumeric). */
function meaningfulWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length >= 4),
  );
}

/**
 * Jaccard similarity between two text strings based on word overlap.
 * Returns 0 when either string is too short to compare.
 */
function jaccardSimilarity(a: string, b: string): number {
  const wordsA = meaningfulWords(a);
  const wordsB = meaningfulWords(b);

  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  if (wordsA.size < 3 || wordsB.size < 3) return 0; // too short for reliable comparison

  let intersectionSize = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersectionSize++;
  }

  const unionSize = wordsA.size + wordsB.size - intersectionSize;
  return intersectionSize / Math.max(1, unionSize);
}

/** Check if a text string contains stage-mismatch traction signals. */
function containsHighTractionTerms(text: string): boolean {
  const lc = text.toLowerCase();
  return TRACTION_STAGE_MISMATCH_TERMS.some((term) => lc.includes(term));
}

// ── Startup checks ────────────────────────────────────────────────────────────

export function checkStartupCrossFieldConsistency(input: StartupQualityInput): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const oneLiner = str(input.one_liner);
  const problem  = str(input.problem);
  const solution = str(input.solution);

  // ── one_liner ↔ problem near-duplication ─────────────────────────────────
  if (oneLiner && problem) {
    const sim = jaccardSimilarity(oneLiner, problem);
    if (sim >= DUPLICATE_SUSPECT_THRESHOLD) {
      flags.push(flag(
        "one_liner_problem_duplicate",
        "suspect",
        `The one-liner and problem statement appear very similar (${Math.round(sim * 100)}% word overlap). Each field should describe something distinct — the one-liner summarises the whole company; the problem statement explains the specific pain you're solving.`,
        "problem",
        { similarity: Math.round(sim * 100) },
      ));
    } else if (sim >= DUPLICATE_WARNING_THRESHOLD) {
      flags.push(flag(
        "one_liner_problem_similar",
        "warning",
        `The one-liner and problem statement have significant overlap (${Math.round(sim * 100)}% shared words). Consider making them more distinct.`,
        "problem",
        { similarity: Math.round(sim * 100) },
      ));
    }
  }

  // ── one_liner ↔ solution near-duplication ────────────────────────────────
  if (oneLiner && solution) {
    const sim = jaccardSimilarity(oneLiner, solution);
    if (sim >= DUPLICATE_SUSPECT_THRESHOLD) {
      flags.push(flag(
        "one_liner_solution_duplicate",
        "suspect",
        `The one-liner and solution description appear very similar (${Math.round(sim * 100)}% word overlap). The solution section should explain HOW you solve the problem, not repeat the company summary.`,
        "solution",
        { similarity: Math.round(sim * 100) },
      ));
    }
  }

  // ── Traction / stage mismatch ──────────────────────────────────────────────
  // If stage = 'idea' but traction text mentions ARR, revenue, enterprise
  // contracts → something doesn't add up.  Warn (don't block — maybe they
  // just submitted before updating the stage).
  const stage = str(input.stage);
  const traction = str(input.traction);
  if (stage === "idea" && traction && containsHighTractionTerms(traction)) {
    flags.push(flag(
      "traction_stage_mismatch",
      "warning",
      `Your profile is listed as "Idea" stage but the traction description mentions revenue, ARR, or enterprise contracts. Please verify your stage or update your traction description.`,
      "stage",
      { stage, traction_terms_found: TRACTION_STAGE_MISMATCH_TERMS.filter(t => traction.toLowerCase().includes(t)) },
    ));
  }

  return flags;
}

// ── Investor checks ───────────────────────────────────────────────────────────

export function checkInvestorCrossFieldConsistency(input: InvestorQualityInput): QualityFlag[] {
  const flags: QualityFlag[] = [];

  const thesis    = str(input.thesis);
  const sectors   = Array.isArray(input.sectors)   ? input.sectors   : [];
  const stages    = Array.isArray(input.stages)     ? input.stages    : [];

  // ── Broad mandate + thin thesis ───────────────────────────────────────────
  // An investor who invests in "everything" with a very short thesis gives
  // little signal to founders.  This is a soft warning, not a block.
  const veryBroadSectors = sectors.length >= BROAD_MANDATE_SECTORS_MIN;
  const veryBroadStages  = stages.length  >= BROAD_MANDATE_STAGES_MIN;

  if (
    (veryBroadSectors || veryBroadStages) &&
    thesis.length > 0 &&
    thesis.length < BROAD_MANDATE_THESIS_MIN
  ) {
    const broadDescriptor = veryBroadSectors
      ? `${sectors.length} sectors`
      : `${stages.length} investment stages`;
    flags.push(flag(
      "broad_mandate_thin_thesis",
      "warning",
      `Your mandate covers ${broadDescriptor}, but the investment thesis is only ${thesis.length} characters. A broader mandate calls for a more detailed thesis so founders can understand what you actually look for.`,
      "thesis",
      {
        sector_count: sectors.length,
        stage_count: stages.length,
        thesis_length: thesis.length,
      },
    ));
  }

  return flags;
}
