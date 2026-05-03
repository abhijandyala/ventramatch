/**
 * lib/quality/rules/buzzword-density.ts
 *
 * Rule category: buzzword density in pitch and thesis text.
 *
 * A high density of generic startup buzzwords without accompanying specifics
 * is a quality signal.  The goal is to nudge founders toward concrete,
 * falsifiable claims — not to penalise normal startup language.
 *
 * Algorithm:
 *   1. Tokenise text into whitespace-separated words (lowercased).
 *   2. Slide a window matching the BUZZWORDS list (single and multi-word).
 *   3. density = buzzword_token_count / total_word_count
 *   4. Apply tiered warning thresholds.
 *   5. Assess "substance" signals: numbers, dollar amounts, percentages,
 *      specific technical terms.
 *
 * Severity:
 *   warning — density > 0.30; content is vague but may still be valid.
 *   suspect — density > 0.50 AND no substance signals found.
 *             (block is too aggressive for stylistic issues)
 *
 * ⚠️  This rule is intentionally conservative.  It should not auto-block
 * profiles for using common startup vocabulary; it surfaces them for human
 * review so the reviewer can judge context.
 */

import type { QualityFlag, StartupQualityInput, InvestorQualityInput } from "../types";
import { BUZZWORDS } from "../buzzwords";

// ── Thresholds ────────────────────────────────────────────────────────────────

const DENSITY_WARNING_THRESHOLD = 0.30;
const DENSITY_SUSPECT_THRESHOLD = 0.50;
const MIN_WORDS_FOR_DENSITY     = 8;   // skip very short texts

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

/** Escape special regex characters in a string. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Tokenise to lowercase words, stripping punctuation. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9'-]/g, ""))
    .filter((t) => t.length > 0);
}

interface DensityResult {
  totalWords: number;
  buzzwordTokenCount: number;
  density: number;
  matched: string[];
}

/**
 * Compute buzzword density for a given text.
 *
 * For multi-word buzzwords (e.g. "actionable insights"), the matched
 * token count reflects the number of words in the phrase, not just 1.
 * This prevents a long 5-word buzzword phrase from being "cheaper" than
 * five individual one-word buzzwords.
 */
function computeDensity(text: string): DensityResult {
  const words = tokenize(text);
  if (words.length === 0) {
    return { totalWords: 0, buzzwordTokenCount: 0, density: 0, matched: [] };
  }

  const lowerText = text.toLowerCase();
  const matched: string[] = [];
  let buzzwordTokenCount = 0;

  for (const buzzword of BUZZWORDS) {
    // Use word-boundary regex to avoid partial matches.
    const escaped = escapeRegex(buzzword);
    const pattern = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$|[,.:;!?])`, "i");
    if (pattern.test(lowerText)) {
      matched.push(buzzword);
      buzzwordTokenCount += buzzword.split(/\s+/).length;
    }
  }

  const density = buzzwordTokenCount / words.length;
  return { totalWords: words.length, buzzwordTokenCount, density, matched };
}

/**
 * Heuristic: does the text contain enough concrete substance to balance
 * the buzzword density?
 *
 * Substance signals:
 *   - Dollar amounts ($X, $XM, $XK, etc.)
 *   - Numbers followed by key metrics (users, customers, revenue)
 *   - Percentage figures
 *   - Proper nouns or technical terms ≥ 10 characters that are not buzzwords
 */
function hasSubstance(text: string): boolean {
  // Dollar amounts
  if (/\$\s*[\d,.]+\s*[kmbt]?/i.test(text)) return true;

  // Numbers with context
  if (/\d[\d,.]*\s*[kmbt]?\s+(?:users?|customers?|clients?|revenue|mrr|arr|contracts?|pilots?)/i.test(text)) return true;

  // Percentages
  if (/\d+\s*%/.test(text)) return true;

  // Years or dates suggesting specific timeframes
  if (/\b(q[1-4]\s*20\d\d|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+20\d\d)\b/i.test(text)) return true;

  // Long non-buzzword technical terms (10+ chars)
  const buzzwordSet = new Set(BUZZWORDS);
  const longSpecificTerms = tokenize(text).filter(
    (w) => w.length >= 10 && !buzzwordSet.has(w),
  );
  if (longSpecificTerms.length >= 2) return true;

  return false;
}

/** Run buzzword density check on a single text field. */
function checkFieldDensity(
  text: string,
  fieldName: string,
  label: string,
): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const trimmed = text.trim();

  if (trimmed.length === 0) return flags;

  const result = computeDensity(trimmed);

  if (result.totalWords < MIN_WORDS_FOR_DENSITY) return flags;
  if (result.density <= DENSITY_WARNING_THRESHOLD) return flags;

  const densityPct = Math.round(result.density * 100);
  const topBuzzwords = result.matched.slice(0, 5).join(", ");

  if (result.density > DENSITY_SUSPECT_THRESHOLD && !hasSubstance(trimmed)) {
    flags.push(flag(
      "buzzword_density_suspect",
      "suspect",
      `${label} contains a high proportion of generic buzzwords (${densityPct}% of words) with little concrete information. Please add specific metrics, product details, or customer examples.`,
      fieldName,
      {
        density: Math.round(result.density * 1000) / 1000,
        buzzword_count: result.matched.length,
        total_words: result.totalWords,
        examples: topBuzzwords,
        has_substance: false,
      },
    ));
  } else {
    flags.push(flag(
      "buzzword_density_high",
      "warning",
      `${label} uses many generic buzzwords (${densityPct}% of words). Consider replacing phrases like "${topBuzzwords}" with specific, concrete claims.`,
      fieldName,
      {
        density: Math.round(result.density * 1000) / 1000,
        buzzword_count: result.matched.length,
        total_words: result.totalWords,
        examples: topBuzzwords,
        has_substance: hasSubstance(trimmed),
      },
    ));
  }

  return flags;
}

// ── Startup checks ────────────────────────────────────────────────────────────

export function checkStartupBuzzwordDensity(input: StartupQualityInput): QualityFlag[] {
  const flags: QualityFlag[] = [];

  if (input.one_liner) {
    flags.push(...checkFieldDensity(input.one_liner, "one_liner", "One-liner"));
  }
  if (input.problem) {
    flags.push(...checkFieldDensity(input.problem, "problem", "Problem statement"));
  }
  if (input.solution) {
    flags.push(...checkFieldDensity(input.solution, "solution", "Solution description"));
  }

  return flags;
}

// ── Investor checks ───────────────────────────────────────────────────────────

export function checkInvestorBuzzwordDensity(input: InvestorQualityInput): QualityFlag[] {
  const flags: QualityFlag[] = [];

  if (input.thesis) {
    flags.push(...checkFieldDensity(input.thesis, "thesis", "Investment thesis"));
  }

  return flags;
}
