"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { withUserRls } from "@/lib/db";

type ReviewActionParams = {
  applicationId: string;
  notes: string;
  /** Short, user-facing summary. Required for terminal statuses. */
  summary: string;
  reasonCodes: string[];
};

type Result = { ok: true } | { ok: false; error: string };

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Load the application row and validate it exists and matches the expected
 * status set before proceeding with a review action.
 */
type AppRow = {
  id: string;
  user_id: string;
  status: string;
  resubmit_count: number;
};

async function loadApp(applicationId: string): Promise<AppRow | null> {
  return withUserRls<AppRow | null>(null, async (sql) => {
    const rows = await sql<AppRow[]>`
      select id, user_id, status, resubmit_count
      from public.applications
      where id = ${applicationId}
      limit 1
    `;
    return rows[0] ?? null;
  });
}

/**
 * Insert an application_reviews audit row for a human reviewer.
 * This is NOT the bot row — reviewer_kind = 'human'.
 */
async function insertHumanReviewRow(params: {
  applicationId: string;
  userId: string;
  reviewerUserId: string;
  resubmitCount: number;
  verdict: string;
  notes: string;
  reasonCodes: string[];
}): Promise<void> {
  const reviewerId = `human:${params.reviewerUserId}`;
  const passNo     = params.resubmitCount + 1;

  await withUserRls<void>(null, async (sql) => {
    await sql`
      insert into public.application_reviews (
        application_id, user_id, pass_no,
        reviewer_kind, reviewer_id,
        verdict, confidence, flags, notes, cost_usd
      ) values (
        ${params.applicationId},
        ${params.userId},
        ${passNo},
        'human'::public.reviewer_kind,
        ${reviewerId},
        ${params.verdict}::public.review_verdict,
        1.0,
        ${params.reasonCodes}::text[],
        ${params.notes || null},
        0
      )
    `;
  });
}

/**
 * Enqueue a transactional email for the applicant.
 * Only called for user-facing decisions (accept / needs_changes / reject).
 * NEVER called from the bot review path.
 */
async function enqueueEmail(params: {
  userId: string;
  template: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const payload = params.payload ?? {};
  await withUserRls<void>(null, async (sql) => {
    await sql`
      insert into public.email_outbox (user_id, template, payload)
      values (
        ${params.userId},
        ${params.template},
        ${JSON.stringify(payload)}::jsonb
      )
    `;
  });
}

/**
 * Log an admin action to the audit log.
 */
async function logAdminAction(params: {
  actorUserId: string;
  action: string;
  targetUserId: string;
  reason: string | null;
}): Promise<void> {
  await withUserRls<void>(null, async (sql) => {
    await sql`
      insert into public.admin_actions (actor_user_id, action, target_user_id, reason)
      values (${params.actorUserId}, ${params.action}, ${params.targetUserId}, ${params.reason})
    `;
  });
}

// ── Validate ──────────────────────────────────────────────────────────────────

function validateParams(p: ReviewActionParams, action: string): string | null {
  if (!p.applicationId) return "Missing application ID.";
  if (!p.summary?.trim())  return "Decision summary is required.";
  if (p.summary.length > 1000) return "Decision summary is too long (max 1000 chars).";
  return null;
}

// ── Human review actions ──────────────────────────────────────────────────────

/**
 * Accept the application — sets status='accepted' which triggers the
 * sync_account_label DB trigger to set users.account_label='verified'.
 *
 * ⚠️  Terminal status. Requires decided_by, decided_at, decision_summary per
 * the applications_terminal_requires_human constraint (migration 0005).
 */
export async function acceptApplicationAction(p: ReviewActionParams): Promise<Result> {
  const err = validateParams(p, "accept");
  if (err) return { ok: false, error: err };

  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try { admin = await requireAdmin("reviewer"); }
  catch { return { ok: false, error: "Unauthorized." }; }

  const app = await loadApp(p.applicationId);
  if (!app) return { ok: false, error: "Application not found." };
  if (!["submitted", "under_review", "needs_changes"].includes(app.status)) {
    return { ok: false, error: `Cannot accept an application with status '${app.status}'.` };
  }

  const decidedBy = `human:${admin.userId}`;

  try {
    await withUserRls<void>(null, async (sql) => {
      await sql`
        update public.applications
           set status               = 'accepted'::public.application_status,
               decided_by           = ${decidedBy},
               decided_at           = now(),
               decision_summary     = ${p.summary.trim()},
               decision_reason_codes = ${p.reasonCodes}::text[]
         where id = ${p.applicationId}
      `;
    });

    await insertHumanReviewRow({
      applicationId:  p.applicationId,
      userId:         app.user_id,
      reviewerUserId: admin.userId,
      resubmitCount:  app.resubmit_count,
      verdict:        "accept",
      notes:          p.notes,
      reasonCodes:    p.reasonCodes,
    });

    // Email: review.accepted — sent to applicant
    await enqueueEmail({
      userId:   app.user_id,
      template: "review.accepted",
      payload:  { applicationId: p.applicationId },
    });

    await logAdminAction({
      actorUserId: admin.userId,
      action:      "review_accept",
      targetUserId: app.user_id,
      reason:      p.notes || p.summary,
    });

    return { ok: true };
  } catch (err) {
    console.error("[reviews/actions:accept] failed", err);
    return { ok: false, error: "Could not accept this application. Try again." };
  }
}

/**
 * Request changes — bounces the application back to the applicant for revision.
 * Sets status='needs_changes'; user can resubmit once free.
 */
export async function requestChangesAction(p: ReviewActionParams): Promise<Result> {
  const err = validateParams(p, "request_changes");
  if (err) return { ok: false, error: err };

  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try { admin = await requireAdmin("reviewer"); }
  catch { return { ok: false, error: "Unauthorized." }; }

  const app = await loadApp(p.applicationId);
  if (!app) return { ok: false, error: "Application not found." };
  if (!["submitted", "under_review"].includes(app.status)) {
    return { ok: false, error: `Cannot request changes for status '${app.status}'.` };
  }

  const decidedBy = `human:${admin.userId}`;

  try {
    await withUserRls<void>(null, async (sql) => {
      await sql`
        update public.applications
           set status               = 'needs_changes'::public.application_status,
               decided_by           = ${decidedBy},
               decided_at           = now(),
               decision_summary     = ${p.summary.trim()},
               decision_reason_codes = ${p.reasonCodes}::text[]
         where id = ${p.applicationId}
      `;
    });

    await insertHumanReviewRow({
      applicationId:  p.applicationId,
      userId:         app.user_id,
      reviewerUserId: admin.userId,
      resubmitCount:  app.resubmit_count,
      verdict:        "needs_changes",
      notes:          p.notes,
      reasonCodes:    p.reasonCodes,
    });

    // Email: review.needs_changes — sent to applicant
    await enqueueEmail({
      userId:   app.user_id,
      template: "review.needs_changes",
      payload:  { applicationId: p.applicationId, reasonCodes: p.reasonCodes },
    });

    await logAdminAction({
      actorUserId: admin.userId,
      action:      "review_needs_changes",
      targetUserId: app.user_id,
      reason:      p.notes || p.summary,
    });

    return { ok: true };
  } catch (err) {
    console.error("[reviews/actions:requestChanges] failed", err);
    return { ok: false, error: "Could not request changes. Try again." };
  }
}

/**
 * Decline the application — sets status='rejected'.
 *
 * ⚠️  Terminal status.  User can appeal via the support/appeal path.
 */
export async function declineApplicationAction(p: ReviewActionParams): Promise<Result> {
  const err = validateParams(p, "decline");
  if (err) return { ok: false, error: err };

  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try { admin = await requireAdmin("reviewer"); }
  catch { return { ok: false, error: "Unauthorized." }; }

  const app = await loadApp(p.applicationId);
  if (!app) return { ok: false, error: "Application not found." };
  if (!["submitted", "under_review", "needs_changes"].includes(app.status)) {
    return { ok: false, error: `Cannot decline an application with status '${app.status}'.` };
  }

  const decidedBy = `human:${admin.userId}`;

  try {
    await withUserRls<void>(null, async (sql) => {
      await sql`
        update public.applications
           set status               = 'rejected'::public.application_status,
               decided_by           = ${decidedBy},
               decided_at           = now(),
               decision_summary     = ${p.summary.trim()},
               decision_reason_codes = ${p.reasonCodes}::text[]
         where id = ${p.applicationId}
      `;
    });

    await insertHumanReviewRow({
      applicationId:  p.applicationId,
      userId:         app.user_id,
      reviewerUserId: admin.userId,
      resubmitCount:  app.resubmit_count,
      verdict:        "decline",
      notes:          p.notes,
      reasonCodes:    p.reasonCodes,
    });

    // Email: review.rejected — sent to applicant
    await enqueueEmail({
      userId:   app.user_id,
      template: "review.rejected",
      payload:  { applicationId: p.applicationId },
    });

    await logAdminAction({
      actorUserId: admin.userId,
      action:      "review_decline",
      targetUserId: app.user_id,
      reason:      p.notes || p.summary,
    });

    return { ok: true };
  } catch (err) {
    console.error("[reviews/actions:decline] failed", err);
    return { ok: false, error: "Could not decline this application. Try again." };
  }
}

/**
 * Flag for senior review — keeps the application visible in the queue for
 * another reviewer.  Sets status='under_review' if not already there.
 * No user-facing email.  Not a terminal decision.
 */
export async function flagApplicationAction(p: ReviewActionParams): Promise<Result> {
  // summary is still required so the reviewer's rationale is recorded
  const err = validateParams(p, "flag");
  if (err) return { ok: false, error: err };

  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try { admin = await requireAdmin("reviewer"); }
  catch { return { ok: false, error: "Unauthorized." }; }

  const app = await loadApp(p.applicationId);
  if (!app) return { ok: false, error: "Application not found." };
  if (!["submitted", "under_review", "needs_changes"].includes(app.status)) {
    return { ok: false, error: `Cannot flag an application with status '${app.status}'.` };
  }

  try {
    // Set to under_review so it surfaces for a second reviewer.
    // decided_by is NOT written here — this is not a terminal decision.
    await withUserRls<void>(null, async (sql) => {
      await sql`
        update public.applications
           set status = 'under_review'::public.application_status
         where id = ${p.applicationId}
           and status != 'under_review'
      `;
    });

    await insertHumanReviewRow({
      applicationId:  p.applicationId,
      userId:         app.user_id,
      reviewerUserId: admin.userId,
      resubmitCount:  app.resubmit_count,
      verdict:        "flag",
      notes:          p.notes,
      reasonCodes:    p.reasonCodes,
    });

    // No user-facing email for internal flag.

    await logAdminAction({
      actorUserId: admin.userId,
      action:      "review_flag",
      targetUserId: app.user_id,
      reason:      p.notes || p.summary,
    });

    return { ok: true };
  } catch (err) {
    console.error("[reviews/actions:flag] failed", err);
    return { ok: false, error: "Could not flag this application. Try again." };
  }
}

/**
 * Ban the account — sets status='banned' and users.account_label='banned'
 * (via the sync_account_label DB trigger).
 *
 * ⚠️  Terminal.  Admin role required (not just reviewer).
 * No user-facing email by default — contact support is the channel for ban appeals.
 */
export async function banApplicationAction(p: ReviewActionParams): Promise<Result> {
  const err = validateParams(p, "ban");
  if (err) return { ok: false, error: err };

  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try { admin = await requireAdmin("admin"); }  // requires admin, not just reviewer
  catch { return { ok: false, error: "Unauthorized — admin role required to ban." }; }

  const app = await loadApp(p.applicationId);
  if (!app) return { ok: false, error: "Application not found." };
  if (app.status === "banned") {
    return { ok: false, error: "This account is already banned." };
  }

  const decidedBy = `human:${admin.userId}`;

  try {
    await withUserRls<void>(null, async (sql) => {
      await sql`
        update public.applications
           set status               = 'banned'::public.application_status,
               decided_by           = ${decidedBy},
               decided_at           = now(),
               decision_summary     = ${p.summary.trim()},
               decision_reason_codes = ${p.reasonCodes}::text[]
         where id = ${p.applicationId}
      `;
    });

    await insertHumanReviewRow({
      applicationId:  p.applicationId,
      userId:         app.user_id,
      reviewerUserId: admin.userId,
      resubmitCount:  app.resubmit_count,
      verdict:        "ban",
      notes:          p.notes,
      reasonCodes:    p.reasonCodes,
    });

    // No user-facing email for ban.  Contact support for appeals.

    await logAdminAction({
      actorUserId: admin.userId,
      action:      "review_ban",
      targetUserId: app.user_id,
      reason:      p.notes || p.summary,
    });

    return { ok: true };
  } catch (err) {
    console.error("[reviews/actions:ban] failed", err);
    return { ok: false, error: "Could not ban this account. Try again." };
  }
}
