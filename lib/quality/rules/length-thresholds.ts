/**
 * lib/quality/rules/length-thresholds.ts
 *
 * Rule category: text length thresholds beyond basic presence.
 *
 * These checks complement field-shape.ts:
 *   field-shape → presence and minimum length for core required fields.
 *   length-thresholds → upper bounds, depth-field minimums, and quality thresholds.
 *
 * Severity guidance:
 *   warning — text exists but is too brief to be substantive for an optional field,
 *             or too verbose for a field with a documented limit.
 *   info    — field is optional and omitted; noted but not actionable.
 *   block   — reserved for completely unusable required text (handled in field-shape).
 *             This file does NOT add block flags.
 */

import type { QualityFlag, StartupQualityInput, InvestorQualityInput } from "../types";

// ── Thresholds ──────────────────────────────────────────────────────────────

const STARTUP_ONE_LINER_MAX   = 240;
const STARTUP_PROBLEM_MIN     = 40;
const STARTUP_SOLUTION_MIN    = 40;
const STARTUP_FOUNDER_BG_MIN  = 30;

const INVESTOR_THESIS_MAX     = 2000;
const INVESTOR_ANTI_MIN       = 10;  // per anti-thesis entry

// ── Helpers ─────────────────────────────────────────────────────────────────

function str(v: string | null | undefined): string {
  return v?.trim() ?? "";
}

function flag(
  code: string,
  severity: QualityFlag["severity"],
  message: string,
  field: string,
  metadata?: Record<string, unknown>,
): QualityFlag {
  return { code, severity, message, field, ...(metadata ? { metadata } : {}) };
}

// ── Startup checks ───────────────────────────────────────────────────────────

export function checkStartupLengthThresholds(input: StartupQualityInput): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const oneLiner = str(input.one_liner);

  // one_liner upper bound (lower bound is in field-shape)
  if (oneLiner.length > STARTUP_ONE_LINER_MAX) {
    flags.push(flag(
      "one_liner_too_long",
      "warning",
      `The one-liner is ${oneLiner.length} characters — please keep it under ${STARTUP_ONE_LINER_MAX}. A shorter description is easier for investors to digest at a glance.`,
      "one_liner",
      { length: oneLiner.length, max: STARTUP_ONE_LINER_MAX },
    ));
  }

  // problem statement — optional depth field
  const problem = str(input.problem);
  if (problem.length > 0 && problem.length < STARTUP_PROBLEM_MIN) {
    flags.push(flag(
      "problem_statement_too_short",
      "warning",
      `Problem statement is only ${problem.length} characters. Aim for at least ${STARTUP_PROBLEM_MIN} characters to describe the problem clearly.`,
      "problem",
      { length: problem.length, min: STARTUP_PROBLEM_MIN },
    ));
  }

  // solution overview — optional depth field
  const solution = str(input.solution);
  if (solution.length > 0 && solution.length < STARTUP_SOLUTION_MIN) {
    flags.push(flag(
      "solution_overview_too_short",
      "warning",
      `Solution description is only ${solution.length} characters. Aim for at least ${STARTUP_SOLUTION_MIN} characters to explain your approach.`,
      "solution",
      { length: solution.length, min: STARTUP_SOLUTION_MIN },
    ));
  }

  // founder background — optional field; note if very thin
  const bg = str(input.founder_background);
  if (bg.length > 0 && bg.length < STARTUP_FOUNDER_BG_MIN) {
    flags.push(flag(
      "founder_background_thin",
      "info",
      `Founder background is only ${bg.length} characters. A brief sentence about your relevant experience helps investors evaluate your team.`,
      "founder_background",
      { length: bg.length, min: STARTUP_FOUNDER_BG_MIN },
    ));
  }

  return flags;
}

// ── Investor checks ──────────────────────────────────────────────────────────

export function checkInvestorLengthThresholds(input: InvestorQualityInput): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const thesis = str(input.thesis);

  // thesis upper bound (lower bound is in field-shape)
  if (thesis.length > INVESTOR_THESIS_MAX) {
    flags.push(flag(
      "thesis_too_long",
      "warning",
      `Investment thesis is ${thesis.length} characters — please keep it under ${INVESTOR_THESIS_MAX}. A focused thesis is easier to evaluate than a comprehensive document.`,
      "thesis",
      { length: thesis.length, max: INVESTOR_THESIS_MAX },
    ));
  }

  // anti-thesis entries — optional; if present each should be substantive
  if (Array.isArray(input.anti_thesis_texts) && input.anti_thesis_texts.length > 0) {
    for (let i = 0; i < input.anti_thesis_texts.length; i++) {
      const entry = input.anti_thesis_texts[i].trim();
      if (entry.length > 0 && entry.length < INVESTOR_ANTI_MIN) {
        flags.push(flag(
          "anti_thesis_entry_too_short",
          "info",
          `Anti-thesis entry #${i + 1} is only ${entry.length} characters. Describe what you want to avoid in more detail.`,
          "anti_thesis_texts",
          { entryIndex: i, length: entry.length, min: INVESTOR_ANTI_MIN },
        ));
        break; // flag once; not once per entry
      }
    }
  }

  return flags;
}
