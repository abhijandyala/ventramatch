/**
 * lib/quality/review.ts
 *
 * Profile quality review orchestrator (Phase 13).
 *
 * ─── PURPOSE ─────────────────────────────────────────────────────────────────
 * Applies all active rule categories to a startup or investor profile and
 * returns a structured ReviewResult suitable for writing to the production
 * `applications` and `application_reviews` tables.
 *
 * This is a BOT RECOMMENDATION ONLY.  The production database enforces that
 * only a human reviewer can set a terminal application status ('accepted',
 * 'rejected', 'banned') — see the `applications_terminal_requires_human`
 * constraint in db/migrations/0005_application_review.sql.
 *
 * ─── GUARANTEES ──────────────────────────────────────────────────────────────
 * • Pure functions: no I/O, no database access, no network calls.
 * • Deterministic: same input + same RULESET_VERSION → same output.
 * • Performance: < 50 ms per profile (typically < 10 ms with Phase 13b rules).
 * • No investment language in user_visible_summary — outputs describe
 *   profile completeness and structure only, never funding potential or
 *   startup quality as an investment.
 *
 * ─── VERDICT MAPPING (Phase 13b) ────────────────────────────────────────────
 *   any block       → decline
 *   2+ suspect      → flag
 *   1 suspect       → needs_changes
 *   3+ warning      → needs_changes
 *   1–2 warning     → accept  (minor imperfections allowed)
 *   info-only / clean → accept
 *
 * This is slightly less aggressive than Phase 13a because Phase 13b adds
 * six rule categories that generate more warnings on typical profiles.
 * A low threshold (1 warning → needs_changes) would bounce many legitimate
 * profiles that just have a short optional field.
 *
 * ─── EXTENDING IN FUTURE PHASES ─────────────────────────────────────────────
 * To add a new rule category:
 *   1. Create lib/quality/rules/<category>.ts
 *   2. Import and call it in runStartupRules / runInvestorRules below.
 *   3. Bump RULESET_VERSION (minor if new flags may fire on clean profiles).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type {
  QualityFlag,
  QualitySeverity,
  ReviewResult,
  ReviewVerdict,
  StartupQualityInput,
  InvestorQualityInput,
} from "./types";
import { RULESET_VERSION } from "./ruleset-version";

// ── Rule category imports ────────────────────────────────────────────────────

import { checkStartupFieldShape,        checkInvestorFieldShape        } from "./rules/field-shape";
import { checkStartupLengthThresholds,  checkInvestorLengthThresholds  } from "./rules/length-thresholds";
import { checkStartupFormatSafety,      checkInvestorFormatSafety      } from "./rules/format-safety";
import { checkStartupBuzzwordDensity,   checkInvestorBuzzwordDensity   } from "./rules/buzzword-density";
import { checkStartupNumericRealism,    checkInvestorNumericRealism    } from "./rules/numeric-realism";
import { checkStartupCrossFieldConsistency, checkInvestorCrossFieldConsistency } from "./rules/cross-field-consistency";
import { checkStartupSpamPatterns,      checkInvestorSpamPatterns      } from "./rules/spam-patterns";

// ── Rule runner helpers ──────────────────────────────────────────────────────

/** Run all active startup rule categories and collect flags. */
function runStartupRules(input: StartupQualityInput): QualityFlag[] {
  return [
    ...checkStartupFieldShape(input),
    ...checkStartupLengthThresholds(input),
    ...checkStartupFormatSafety(input),
    ...checkStartupBuzzwordDensity(input),
    ...checkStartupNumericRealism(input),
    ...checkStartupCrossFieldConsistency(input),
    ...checkStartupSpamPatterns(input),
  ];
}

/** Run all active investor rule categories and collect flags. */
function runInvestorRules(input: InvestorQualityInput): QualityFlag[] {
  return [
    ...checkInvestorFieldShape(input),
    ...checkInvestorLengthThresholds(input),
    ...checkInvestorFormatSafety(input),
    ...checkInvestorBuzzwordDensity(input),
    ...checkInvestorNumericRealism(input),
    ...checkInvestorCrossFieldConsistency(input),
    ...checkInvestorSpamPatterns(input),
  ];
}

// ── Verdict mapper (Phase 13b) ───────────────────────────────────────────────

/**
 * Map a set of flags to a bot verdict.
 *
 * Precedence: block > suspect (≥2) > suspect(1) ≥ warnings(3+) > warnings(1-2) > clean
 *
 * Phase 13b reasoning: with seven rule categories now running, a well-formed
 * profile may accumulate 1–2 warnings from minor style or completeness issues
 * (e.g. info-level website absence + one buzzword hit).  Sending those to
 * needs_changes would create excessive review queue noise.  The 3+ warning
 * threshold means a profile needs at least three distinct quality issues before
 * being bounced back.
 *
 * Note: 'ban' is never emitted by Phase 13 rules.  It is included only for
 * schema parity with the production `review_verdict` enum.
 */
function mapVerdict(flags: QualityFlag[]): ReviewVerdict {
  const blocks   = flags.filter((f) => f.severity === "block").length;
  const suspects = flags.filter((f) => f.severity === "suspect").length;
  const warnings = flags.filter((f) => f.severity === "warning").length;

  if (blocks > 0) return "decline";
  if (suspects >= 2) return "flag";
  if (suspects >= 1 || warnings >= 3) return "needs_changes";
  return "accept";
}

// ── Confidence ───────────────────────────────────────────────────────────────

/**
 * Compute bot_confidence ∈ [0, 1] for the given verdict and flags.
 *
 * Interpretation:
 *   < 0.50  → borderline; human should examine carefully.
 *   0.50–0.75 → moderate confidence; standard queue priority.
 *   > 0.75  → high confidence; human can triage quickly.
 *
 * Phase 13b adjustment: accept with 1-2 warnings gets lower confidence
 * than Phase 13a's unconditional 0.70 — the presence of warnings means
 * the acceptance is less clean.
 */
function computeConfidence(verdict: ReviewVerdict, flags: QualityFlag[]): number {
  const blocks   = flags.filter((f) => f.severity === "block").length;
  const suspects = flags.filter((f) => f.severity === "suspect").length;
  const warnings = flags.filter((f) => f.severity === "warning").length;

  let confidence: number;

  switch (verdict) {
    case "accept":
      // Clean accept vs minor-warning accept
      confidence = warnings === 0 ? 0.70 : Math.max(0.50, 0.65 - warnings * 0.05);
      break;
    case "decline":
      confidence = Math.min(0.95, 0.75 + blocks * 0.05);
      break;
    case "flag":
      confidence = Math.min(0.88, 0.65 + suspects * 0.06);
      break;
    case "needs_changes":
      if (suspects >= 1) {
        confidence = 0.62;
      } else {
        confidence = Math.min(0.78, 0.52 + warnings * 0.04);
      }
      break;
    case "ban":
      confidence = 0.90;
      break;
  }

  return Math.round(confidence * 1000) / 1000;
}

// ── Reason codes ─────────────────────────────────────────────────────────────

const ACTIONABLE_SEVERITIES: Set<QualitySeverity> = new Set(["block", "suspect", "warning"]);

function buildReasonCodes(flags: QualityFlag[]): string[] {
  return [
    ...new Set(
      flags
        .filter((f) => ACTIONABLE_SEVERITIES.has(f.severity))
        .map((f) => f.code),
    ),
  ];
}

// ── User-visible summary ─────────────────────────────────────────────────────

/**
 * Generate a safe, user-facing summary for `applications.decision_summary`.
 *
 * RULES:
 *   • No investment language ("promising", "fundable", "strong team").
 *   • No startup-success predictions.
 *   • Plain, actionable language about profile completeness and quality.
 *   • Maximum ~3 sentences.
 */
function buildUserSummary(
  verdict: ReviewVerdict,
  flags: QualityFlag[],
  profileKind: "startup" | "investor",
): string {
  const kindLabel = profileKind === "startup" ? "startup" : "investor";

  switch (verdict) {
    case "accept": {
      const n = flags.filter((f) => f.severity === "warning").length;
      if (n === 0) {
        return (
          `Your ${kindLabel} profile looks complete and well-structured. ` +
          `It will go to our review team for a final check before going live.`
        );
      }
      return (
        `Your ${kindLabel} profile looks good overall with a few minor things to consider. ` +
        `It will go to our review team shortly — you may want to address the suggestions in the next version.`
      );
    }

    case "needs_changes": {
      const blockFlags   = flags.filter((f) => f.severity === "block");
      const suspectFlags = flags.filter((f) => f.severity === "suspect");
      const warnFlags    = flags.filter((f) => f.severity === "warning");
      const actionable   = [...blockFlags, ...suspectFlags, ...warnFlags];
      if (actionable.length === 0) {
        return `Please review your ${kindLabel} profile and address any outstanding items before resubmitting.`;
      }
      const first = actionable[0].message.split(".")[0];
      const more  = actionable.length > 1 ? ` and ${actionable.length - 1} other item(s)` : "";
      return (
        `Your ${kindLabel} profile needs a few updates before it can be reviewed. ` +
        `Please address: ${first}${more}. ` +
        `You can resubmit after making changes.`
      );
    }

    case "decline": {
      const blockFlags = flags.filter((f) => f.severity === "block");
      const fieldHint  = blockFlags[0]?.field
        ? ` (${blockFlags[0].field.replace(/_/g, " ")})`
        : "";
      return (
        `Your ${kindLabel} profile is missing critical required information${fieldHint} ` +
        `and cannot be reviewed in its current state. ` +
        `Please complete the required fields and resubmit.`
      );
    }

    case "flag":
      return (
        `Your ${kindLabel} profile has been flagged for manual review. ` +
        `Our team will look at it shortly and send you an update.`
      );

    case "ban":
      return (
        `Your ${kindLabel} profile has been flagged for a serious issue. ` +
        `Please contact support for assistance.`
      );
  }
}

// ── Sort flags ───────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<QualitySeverity, number> = {
  block: 0, suspect: 1, warning: 2, info: 3,
};

function sortFlags(flags: QualityFlag[]): QualityFlag[] {
  return [...flags].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Review a startup profile and return a structured ReviewResult.
 *
 * This is a BOT RECOMMENDATION.  Human sign-off is required before any
 * terminal status ('accepted', 'rejected', 'banned') is applied.
 *
 * Phase 13 usage (offline / synthetic harness — Phase 13c):
 *   import { reviewStartup } from "@/lib/quality/review";
 *   const result = reviewStartup(startupInput);
 *
 * Phase 14 usage (production wiring):
 *   const result = reviewStartup(toStartupQualityInput(startupRow, depthCounts));
 *   await db.upsert("applications", { bot_recommendation: result.bot_recommendation, ... });
 *   await db.insert("application_reviews", { reviewer_kind: "rules", ... });
 */
export function reviewStartup(input: StartupQualityInput): ReviewResult {
  const rawFlags   = runStartupRules(input);
  const flags      = sortFlags(rawFlags);
  const verdict    = mapVerdict(flags);
  const confidence = computeConfidence(verdict, flags);

  return {
    bot_recommendation:    verdict,
    bot_confidence:        confidence,
    flags,
    decision_reason_codes: buildReasonCodes(flags),
    user_visible_summary:  buildUserSummary(verdict, flags, "startup"),
    ruleset_version:       RULESET_VERSION,
    checked_at:            new Date().toISOString(),
    profile_kind:          "startup",
  };
}

/**
 * Review an investor profile and return a structured ReviewResult.
 * Same guarantees and usage notes as reviewStartup above.
 */
export function reviewInvestor(input: InvestorQualityInput): ReviewResult {
  const rawFlags   = runInvestorRules(input);
  const flags      = sortFlags(rawFlags);
  const verdict    = mapVerdict(flags);
  const confidence = computeConfidence(verdict, flags);

  return {
    bot_recommendation:    verdict,
    bot_confidence:        confidence,
    flags,
    decision_reason_codes: buildReasonCodes(flags),
    user_visible_summary:  buildUserSummary(verdict, flags, "investor"),
    ruleset_version:       RULESET_VERSION,
    checked_at:            new Date().toISOString(),
    profile_kind:          "investor",
  };
}
