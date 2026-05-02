/**
 * lib/quality/types.ts
 *
 * Data types for the profile quality review system (Phase 13).
 *
 * ─── PURPOSE ─────────────────────────────────────────────────────────────────
 * This module supports a rules-based quality review of founder and investor
 * profiles.  It detects incomplete, vague, spam, or structurally inconsistent
 * profiles before they enter the discovery feed.
 *
 * This is NOT:
 *   • Match scoring — the quality layer is upstream of lib/matching/.
 *   • Investment advice — quality labels describe profile completeness and
 *     content structure, never funding suitability or startup success potential.
 *   • A replacement for human review — bot recommendations are suggestions only.
 *     The production database constraint (applications_terminal_requires_human)
 *     ensures only a human can flip an application to 'accepted', 'rejected',
 *     or 'banned'.  See db/migrations/0005_application_review.sql.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Performance contract: all rule functions must complete in < 50 ms per profile
 * with zero network calls.  This is enforced by design — all rules are pure
 * TypeScript with no async operations.
 */

// ── Severity ────────────────────────────────────────────────────────────────

/**
 * How serious a detected quality issue is.
 *
 * info     — noteworthy but not actionable; logged for analytics.
 * warning  — should be fixed; 3+ warnings → needs_changes verdict.
 * block    — must be fixed; any block → decline verdict.
 * suspect  — unusual or potentially fraudulent; 2+ suspects → flag for
 *            human review.  Never auto-bans.
 */
export type QualitySeverity = "info" | "warning" | "block" | "suspect";

// ── Verdict ─────────────────────────────────────────────────────────────────

/**
 * The bot's recommendation.  Maps directly to the production
 * `public.review_verdict` enum in db/migrations/0005_application_review.sql.
 *
 * accept       — profile passes all rules; recommend admitting.
 * needs_changes— fixable issues found; bounce back for revision.
 * decline      — critical problems; recommend soft reject.
 * flag         — bot uncertain or suspicious signals; punt to human.
 * ban          — reserved: bot can recommend but only humans can execute.
 *               (Not emitted by Phase 13 rules yet; added here for
 *               schema parity with the production enum.)
 */
export type ReviewVerdict =
  | "accept"
  | "needs_changes"
  | "decline"
  | "flag"
  | "ban";

// ── Individual flag ─────────────────────────────────────────────────────────

/**
 * A single quality finding from one rule check.
 *
 * Flags are serialized into `application_reviews.rule_results` (jsonb) and
 * their codes written to `application_reviews.flags` (text[]).  Keep codes
 * stable across ruleset versions — changing a code is a breaking change for
 * the human review queue.
 */
export type QualityFlag = {
  /** Stable short identifier, e.g. "name_min_length", "sectors_empty". */
  code: string;
  severity: QualitySeverity;
  /** Human-readable description safe for internal reviewers.  Not user-facing. */
  message: string;
  /** Which profile field triggered this flag, if applicable. */
  field?: string;
  /**
   * Additional structured context (e.g. the actual value length, the
   * threshold that was violated).  Never store the full field value here
   * to avoid duplicating PII in the audit log.
   */
  metadata?: Record<string, unknown>;
};

// ── Full review result ───────────────────────────────────────────────────────

/**
 * The output of one bot review pass for a single profile.
 *
 * Fields map directly to production schema columns:
 *   bot_recommendation   → applications.bot_recommendation
 *   bot_confidence       → applications.bot_confidence
 *   decision_reason_codes→ applications.decision_reason_codes
 *   user_visible_summary → applications.decision_summary
 *   flags + metadata     → application_reviews.rule_results (jsonb)
 *                          application_reviews.flags (text[])
 *
 * ⚠️  This is a bot RECOMMENDATION.  No production code may promote
 * bot_recommendation to a terminal application status without a human
 * reviewer.  See db/migrations/0005_application_review.sql constraint
 * applications_terminal_requires_human.
 */
export type ReviewResult = {
  /** See ReviewVerdict above. */
  bot_recommendation: ReviewVerdict;

  /**
   * Confidence in the recommendation, in [0, 1].
   *
   *   < 0.5  borderline cases; human should look carefully.
   *   0.5–0.75  moderate confidence; standard queue priority.
   *   > 0.75  high confidence; can be triaged lower priority by human.
   *
   * Always deterministic for the same input + ruleset version.
   */
  bot_confidence: number;

  /** Ordered by severity (block → suspect → warning → info). */
  flags: QualityFlag[];

  /**
   * Short stable flag codes for `applications.decision_reason_codes`.
   * Subset of flag.code values; excludes info-level codes.
   */
  decision_reason_codes: string[];

  /**
   * Safe, user-facing plain text.  Must not contain investment language,
   * predictions about success, or internal reviewer notes.
   * Written to `applications.decision_summary`.
   */
  user_visible_summary: string;

  /**
   * Version of the ruleset that produced this result.
   * Recorded in `application_reviews.reviewer_id` as 'rules:<version>'.
   */
  ruleset_version: string;

  /** When this result was computed (ISO 8601). */
  checked_at: string;

  /** Which side of the marketplace was reviewed. */
  profile_kind: "startup" | "investor";
};

// ── Normalized input types ───────────────────────────────────────────────────
//
// These are plain objects constructed from production DB rows or synthetic
// profiles.  They intentionally do not import from @/types/database so the
// quality library can be tested and used in offline scripts without a
// database client.
//
// When Phase 14 wires the quality library into production, a thin adapter
// function will map Database["public"]["Tables"]["startups"]["Row"] → StartupQualityInput.

/**
 * Normalized startup profile for quality review.
 * Constructed from the `startups` table row plus optional depth-table counts.
 */
export type StartupQualityInput = {
  profile_kind: "startup";

  // Core identity
  name: string | null;
  one_liner: string | null;
  website: string | null;
  /** User's email address — used for burner-domain check. Optional: skip if not available. */
  email?: string | null;

  // Pitch narrative (from startup_narrative depth table or synthetic data)
  problem?: string | null;
  solution?: string | null;
  founder_background?: string | null;

  // Sector/stage mandate
  /** Legacy single-sector string (startups.industry). */
  industry: string | null;
  /** Canonical sectors array (startups.startup_sectors[]). */
  startup_sectors: string[];
  /** startup_stage enum value as string. */
  stage: string | null;

  // Financial
  /** USD raise amount; null if not set. */
  raise_amount: number | null;
  /** Year the startup was founded; null if not set. */
  founded_year?: number | null;

  // Location
  location: string | null;

  // Additional profile fields
  customer_type: string | null;
  business_model: string | null;
  traction: string | null; // freeform traction text
  deck_url: string | null;

  // Depth-table signal counts (undefined = depth tables not loaded; skip depth rules)
  traction_signals_count?: number;
  team_members_count?: number;
};

/**
 * Normalized investor profile for quality review.
 * Constructed from the `investors` table row plus optional depth-table counts.
 */
export type InvestorQualityInput = {
  profile_kind: "investor";

  // Core identity
  name: string | null;
  firm: string | null;
  thesis: string | null;
  /** User's email address — used for burner-domain check. Optional. */
  email?: string | null;

  // Mandate
  sectors: string[];
  stages: string[];
  geographies: string[];
  lead_or_follow: string | null;

  // Financial mandate
  check_min: number | null;
  check_max: number | null;
  is_active: boolean | null;

  /**
   * Anti-thesis text snippets (from investor_anti_patterns table or
   * anti_thesis.founder_profiles in synthetic data).
   * Each entry is a short descriptive string the investor wants to avoid.
   */
  anti_thesis_texts?: string[];

  // Depth-table signal counts
  check_bands_count?: number;
  portfolio_entries_count?: number;
};
