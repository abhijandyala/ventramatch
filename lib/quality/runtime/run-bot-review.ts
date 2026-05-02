/**
 * lib/quality/runtime/run-bot-review.ts
 *
 * Thin orchestrator for the bot quality review step that runs after a
 * successful profile submission.
 *
 * ─── CALL SITE CONTRACT ──────────────────────────────────────────────────────
 * Called from app/build/actions.ts and app/build/investor/actions.ts, INSIDE
 * the existing withUserRls transaction, after all other writes succeed.
 *
 * If this function throws, the outer transaction rolls back — the submission
 * is not persisted and the user sees "could not publish your profile".  This is
 * the correct behaviour: we prefer a clean rollback over a partial state where
 * the application is submitted but has no review row.
 *
 * ─── GUARANTEES ──────────────────────────────────────────────────────────────
 * • Pure rule evaluation: reviewStartup / reviewInvestor have no side effects.
 * • No email_outbox writes.
 * • No terminal status mutations (enforced both here and by persist.ts).
 * • scoreMatch in lib/matching/score.ts is never touched.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { reviewStartup, reviewInvestor } from "@/lib/quality/review";
import type { ReviewResult } from "@/lib/quality/types";
import type { withUserRls } from "@/lib/db";
import { toStartupQualityInput, toInvestorQualityInput } from "./profile-adapters";
import { persistBotReview } from "./persist";
import type { Database } from "@/types/database";

type SqlTemplate = Parameters<Parameters<typeof withUserRls>[1]>[0];
type StartupRow  = Database["public"]["Tables"]["startups"]["Row"];
type InvestorRow = Database["public"]["Tables"]["investors"]["Row"];

export type BotReviewParams = {
  /** The postgres.js sql client from the currently-open transaction. */
  sql: SqlTemplate;
  /** applications.id for the submission being reviewed. */
  applicationId: string;
  /** users.id of the applicant. */
  userId: string;
  /**
   * Which sequential review pass this is.
   * Convention: nextResubmitCount + 1  (1 for first submission, 2 for first
   * resubmit, etc.).  Matches application_reviews.pass_no semantics from
   * migration 0005.
   */
  passNo: number;
  /** The user's email address from the session, for burner-domain checks. */
  email?: string | null;
} & (
  | { profileKind: "startup";  startupRow:  StartupRow  }
  | { profileKind: "investor"; investorRow: InvestorRow }
);

/**
 * Run the quality bot review and persist the result inside the open transaction.
 *
 * Returns the ReviewResult so the caller can log it or include it in telemetry.
 * The caller does not need to do anything with the return value for correctness.
 */
export async function runBotReviewAndPersist(
  params: BotReviewParams,
): Promise<ReviewResult> {
  const { sql, applicationId, userId, passNo, email } = params;
  const opts = { email: email ?? null };

  // ── 1. Compute quality review (pure, < 10 ms, no I/O) ────────────────────────
  const t0 = Date.now();
  let result: ReviewResult;

  if (params.profileKind === "startup") {
    const input = toStartupQualityInput(params.startupRow, opts);
    result = reviewStartup(input);
  } else {
    const input = toInvestorQualityInput(params.investorRow, opts);
    result = reviewInvestor(input);
  }

  const durationMs = Date.now() - t0;

  console.log(
    `[quality/runtime] userId=${userId} kind=${params.profileKind} ` +
    `verdict=${result.bot_recommendation} conf=${result.bot_confidence} ` +
    `flags=${result.flags.length} duration=${durationMs}ms ` +
    `ruleset=${result.ruleset_version}`,
  );

  // ── 2. Persist into the open transaction ─────────────────────────────────────
  // If this throws, the entire outer withUserRls transaction rolls back so
  // the application is never left in a partial state.
  await persistBotReview(sql, { applicationId, userId, passNo, result, durationMs });

  return result;
}
