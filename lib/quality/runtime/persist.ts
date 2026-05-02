/**
 * lib/quality/runtime/persist.ts
 *
 * Writes the bot quality review result to the `applications` and
 * `application_reviews` tables.
 *
 * ─── CRITICAL CONSTRAINTS ────────────────────────────────────────────────────
 * 1. NEVER sets a terminal application status (accepted / rejected / banned).
 *    The DB constraint `applications_terminal_requires_human` enforces this at
 *    the database level; this module adds a code-level guard as well.
 *
 * 2. NEVER enqueues email_outbox rows.  User-facing emails are sent only when
 *    a human reviewer commits a terminal decision.
 *
 * 3. Stores COMPACT rule output only in rule_results — flag codes, severities,
 *    and field names.  Full message text and metadata with user-generated
 *    content are stripped before storage to keep the audit log small and free
 *    of PII copies.
 *
 * 4. The `sql` parameter must be the tagged-template function from an already-
 *    open withUserRls transaction so the write is atomic with the submission.
 *    If the persist throws, the entire outer transaction rolls back.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { ReviewResult } from "@/lib/quality/types";
import type { withUserRls } from "@/lib/db";

/** Extract the sql template function type from withUserRls callback signature. */
type SqlTemplate = Parameters<Parameters<typeof withUserRls>[1]>[0];

/**
 * Compact representation of a single flag stored in application_reviews.rule_results.
 * Never contains full message strings or user-generated text snippets.
 */
type CompactFlag = {
  code: string;
  severity: string;
  field: string | null;
};

/**
 * Persist a bot review result inside an already-open DB transaction.
 *
 * @param sql           The postgres.js tagged-template client from the outer
 *                      withUserRls transaction.  Must already be active.
 * @param applicationId The applications.id for the submitted profile.
 * @param userId        The users.id of the applicant.
 * @param passNo        Which review pass this is.  Convention: resubmit_count + 1
 *                      (1 for first submission, 2 after a free resubmit, etc.).
 * @param result        The ReviewResult from reviewStartup / reviewInvestor.
 * @param durationMs    How long the rule engine took (for cost monitoring).
 */
export async function persistBotReview(
  sql: SqlTemplate,
  params: {
    applicationId: string;
    userId: string;
    passNo: number;
    result: ReviewResult;
    durationMs?: number;
  },
): Promise<void> {
  const { applicationId, userId, passNo, result, durationMs = 0 } = params;

  // Defensive guard: never write a terminal status from the bot path.
  // (The DB constraint is the authoritative guard; this is belt-and-suspenders.)
  const terminalVerdicts = new Set(["accept", "reject", "ban"] as const);
  const botRec = result.bot_recommendation;
  if (terminalVerdicts.has(botRec as "accept" | "reject" | "ban") && botRec !== "accept") {
    // 'accept' is fine as a bot recommendation — it doesn't flip status.
    // 'reject' and 'ban' would need human sign-off in DB; just log and skip persist.
    console.error(
      `[quality/runtime/persist] unexpected terminal verdict "${botRec}" from bot — skipping persist`,
    );
    return;
  }

  // Build compact flags: strip full messages and user-generated metadata snippets.
  // We keep: code, severity, field (structural info only).
  const compactFlags: CompactFlag[] = result.flags.map((f) => ({
    code:     f.code,
    severity: f.severity,
    field:    f.field ?? null,
  }));

  // The jsonb stored in application_reviews.rule_results.
  // Compact: no full text, no metadata values that contain user content.
  const ruleResults = {
    verdict:         botRec,
    profile_kind:    result.profile_kind,
    ruleset_version: result.ruleset_version,
    flags:           compactFlags,
  };

  // ── 1. Update applications row ───────────────────────────────────────────────
  // Writes advisory fields only.  Does NOT touch: status, decided_by, decided_at,
  // decision_summary (those are human-only fields).
  await sql`
    update public.applications
       set bot_recommendation    = ${botRec}::public.review_verdict,
           bot_confidence        = ${result.bot_confidence},
           bot_recommended_at    = now(),
           ruleset_version       = ${result.ruleset_version},
           last_bot_review_at    = now(),
           decision_reason_codes = ${result.decision_reason_codes}::text[]
     where id = ${applicationId}
  `;

  // ── 2. Insert application_reviews audit row ───────────────────────────────────
  // reviewer_kind = 'rules', reviewer_id = 'rules:<version>' per migration 0005
  // conventions.  One row per bot review pass; humans add their own row on top.
  const reviewerId = `rules:${result.ruleset_version}`;
  const roundedMs  = Math.round(durationMs);

  await sql`
    insert into public.application_reviews (
      application_id,
      user_id,
      pass_no,
      reviewer_kind,
      reviewer_id,
      verdict,
      confidence,
      rule_results,
      flags,
      cost_usd,
      duration_ms
    ) values (
      ${applicationId},
      ${userId},
      ${passNo},
      'rules'::public.reviewer_kind,
      ${reviewerId},
      ${botRec}::public.review_verdict,
      ${result.bot_confidence},
      ${JSON.stringify(ruleResults)}::jsonb,
      ${result.decision_reason_codes}::text[],
      0,
      ${roundedMs}
    )
  `;
}
