"use server";

import { z } from "zod";
import { withUserRls } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email/send-verification";
import { checkAndStamp, COOLDOWN_SECONDS } from "@/lib/email/rate-limit";

const emailSchema = z.string().trim().toLowerCase().email();

type ActionResult =
  | { ok: true }
  | { ok: false; error: string; retryAfterSeconds?: number };

/**
 * Re-send the verification magic link to a user who already created an
 * account. Looks up the user, rate-limits per email, regenerates token,
 * sends. Always returns a generic success even if the email is unknown,
 * to avoid leaking which emails are registered.
 */
export async function resendVerificationAction(rawEmail: string): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) {
    return { ok: false, error: "Invalid email." };
  }
  const email = parsed.data;

  const rate = checkAndStamp(`verify:${email}`);
  if (!rate.ok) {
    return {
      ok: false,
      error: `Please wait ${rate.retryAfterSeconds}s before requesting another link.`,
      retryAfterSeconds: rate.retryAfterSeconds,
    };
  }

  // Look up the user — only send if they exist and haven't already verified
  type UserRow = { name: string | null; email_verified_at: Date | null };
  let user: UserRow | null = null;
  try {
    user = await withUserRls<UserRow | null>(null, async (sql) => {
      const rows = await sql<UserRow[]>`
        select name, email_verified_at
        from public.users
        where email = ${email}
        limit 1
      `;
      return rows[0] ?? null;
    });
  } catch (error) {
    console.error("[resendVerificationAction] DB lookup failed", error);
    return { ok: false, error: "Could not send. Try again." };
  }

  if (!user) {
    // Don't leak existence — pretend success
    console.log(`[resendVerificationAction] no user for ${email}, returning silent ok`);
    return { ok: true };
  }

  if (user.email_verified_at) {
    // Already verified, no point sending again
    console.log(`[resendVerificationAction] ${email} already verified`);
    return { ok: true };
  }

  const result = await sendVerificationEmail(email, user.name);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  console.log(`[resendVerificationAction] resent for ${email}`);
  return { ok: true };
}

export const RESEND_COOLDOWN_SECONDS = COOLDOWN_SECONDS;
