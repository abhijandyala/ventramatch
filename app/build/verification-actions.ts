"use server";

/**
 * Server actions for the verifications + references_received tables (0016).
 *
 * submitVerificationAction    — creates a new pending verification row for
 *                               the signed-in user's self-attested claim.
 *                               The verifier worker (future Phase 6) picks
 *                               these up and flips them to confirmed/rejected.
 *
 * requestReferenceAction      — sends a magic-link reference request.
 *                               Creates the references_received row with
 *                               a sha256-hashed token and enqueues an email.
 *                               The public confirm route handles the token.
 *
 * cancelReferenceAction       — lets the user expire a pending request
 *                               (status → 'expired') so they can resend.
 *
 * Auth: requireWrite() — must be signed in, email verified, onboarded.
 */

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { withUserRls } from "@/lib/db";
import { requireWrite } from "@/lib/auth/access";
import { sendReferenceRequestEmail } from "@/lib/email/send-reference-request";
import {
  submitVerificationSchema,
  requestReferenceSchema,
  type SubmitVerificationInput,
  type RequestReferenceInput,
} from "@/lib/validation/depth";

type VerifResult = { ok: true } | { ok: false; error: string };

function parseError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Unexpected error. Try again.";
}

// ──────────────────────────────────────────────────────────────────────────
//  Submit a self-attested verification claim
// ──────────────────────────────────────────────────────────────────────────

export async function submitVerificationAction(
  input: SubmitVerificationInput,
): Promise<VerifResult> {
  const access = await requireWrite();
  if (!access.ok) return { ok: false, error: access.message };
  const userId = access.userId;

  const parsed = submitVerificationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const d = parsed.data;

  try {
    await withUserRls(userId, async (sql) => {
      // One active verification per kind. If a prior confirmed one exists
      // with this kind, the unique index prevents a duplicate — the user
      // should delete/expire first. We use INSERT and let it fail gracefully
      // with a useful message.
      await sql`
        insert into public.verifications
          (user_id, kind, evidence_url, claim_summary, status, verified_by)
        values (
          ${userId},
          ${d.kind}::public.verification_kind,
          ${d.evidence_url ?? null},
          ${d.claim_summary ?? null},
          'pending',
          'self'
        )
      `;
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("verifications_one_active_per_kind")) {
      return {
        ok: false,
        error: "You already have a confirmed verification for this type.",
      };
    }
    return { ok: false, error: parseError(e) };
  }

  revalidatePath("/build");
  revalidatePath("/build/investor");
  revalidatePath(`/p/${userId}`);
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
//  Request a reference (magic-link)
// ──────────────────────────────────────────────────────────────────────────

export async function requestReferenceAction(
  input: RequestReferenceInput,
): Promise<VerifResult> {
  const access = await requireWrite();
  if (!access.ok) return { ok: false, error: access.message };
  const userId = access.userId;

  const parsed = requestReferenceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const d = parsed.data;

  // Generate a cryptographically random token; hash it before storage.
  // The raw token is placed in the email magic link so the referee can
  // confirm without signing in. The route handler does a constant-time
  // compare of sha256(rawToken) against the stored hash.
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  // Fetch the requester's display name + company for the email subject line.
  type UserMeta = { name: string | null; company_name: string | null };
  let userMeta: UserMeta = { name: null, company_name: null };
  try {
    const rows = await withUserRls<UserMeta[]>(userId, async (sql) =>
      sql<UserMeta[]>`
        select name, company_name from public.users where id = ${userId} limit 1
      `,
    );
    userMeta = rows[0] ?? userMeta;
  } catch {
    // Non-fatal — email will still send with generic copy.
  }

  try {
    await withUserRls(userId, async (sql) => {
      // Unique index: one active (status='sent') request per
      // (user_id, lower(referee_email)). Fail visibly if already pending.
      await sql`
        insert into public.references_received
          (user_id, referee_email, referee_name, relationship, token_hash)
        values (
          ${userId},
          ${d.referee_email.toLowerCase()},
          ${d.referee_name},
          ${d.relationship},
          ${tokenHash}
        )
      `;

      // Outbox row for audit trail (and future worker).
      await sql`
        insert into public.email_outbox
          (user_id, template, payload)
        values (
          ${userId},
          'reference.requested',
          ${JSON.stringify({
            refereeEmail: d.referee_email,
            refereeName: d.referee_name,
            relationship: d.relationship,
          })}::jsonb
        )
      `;
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("references_received_one_active")) {
      return {
        ok: false,
        error:
          "A reference request is already pending for this email. Wait for it to expire or cancel it first.",
      };
    }
    return { ok: false, error: parseError(e) };
  }

  // Send email directly via Resend (no in-repo outbox worker yet).
  // If Resend isn't configured the sender logs the link to console for dev.
  const emailResult = await sendReferenceRequestEmail({
    rawToken,
    requesterName: userMeta.name,
    requesterCompany: userMeta.company_name,
    refereeName: d.referee_name,
    refereeEmail: d.referee_email.toLowerCase(),
    relationship: d.relationship,
  });
  if (!emailResult.ok) {
    return { ok: false, error: emailResult.error };
  }

  revalidatePath("/build");
  revalidatePath("/build/investor");
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
//  Cancel a pending reference request
// ──────────────────────────────────────────────────────────────────────────

export async function cancelReferenceAction(
  referenceId: string,
): Promise<VerifResult> {
  const access = await requireWrite();
  if (!access.ok) return { ok: false, error: access.message };
  const userId = access.userId;

  if (!referenceId || referenceId.length !== 36) {
    return { ok: false, error: "Invalid reference ID." };
  }

  try {
    await withUserRls(userId, async (sql) => {
      await sql`
        update public.references_received
           set status = 'expired'
         where id = ${referenceId}
           and user_id = ${userId}
           and status = 'sent'
      `;
    });
  } catch (e) {
    return { ok: false, error: parseError(e) };
  }

  revalidatePath("/build");
  revalidatePath("/build/investor");
  return { ok: true };
}
