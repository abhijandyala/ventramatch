"use server";

import { withUserRls } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { signUpSchema, type SignUpInput } from "@/lib/validation/auth";
import { sendVerificationEmail } from "@/lib/email/send-verification";
import { checkAndStamp } from "@/lib/email/rate-limit";

type ActionResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

export async function signUpAction(input: SignUpInput): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    console.log(`[signUpAction] validation failed: ${parsed.error.issues[0]?.message}`);
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { name, email, password } = parsed.data;
  console.log(`[signUpAction] attempting sign-up for email=${email}`);

  try {
    const passwordHash = await hashPassword(password);

    const created = await withUserRls<{ id: string } | null>(null, async (sql) => {
      const existing = await sql<{ id: string }[]>`
        select id from public.users where email = ${email} limit 1
      `;
      if (existing.length > 0) return null;

      const rows = await sql<{ id: string }[]>`
        insert into public.users (email, name, password_hash, onboarding_completed)
        values (${email}, ${name}, ${passwordHash}, false)
        returning id
      `;
      return rows[0] ?? null;
    });

    if (!created) {
      return { ok: false, error: "An account with that email already exists." };
    }
  } catch (error) {
    console.error("[signUpAction] insert failed", error);
    return { ok: false, error: "Could not create your account. Try again." };
  }

  // Rate-limit per email so a single user can't spam-create + spam-resend
  const rate = checkAndStamp(`verify:${email}`);
  if (!rate.ok) {
    // Account is created, just rate-limited from sending — direct them to verify page
    console.log(`[signUpAction] rate-limited send for ${email}, retry in ${rate.retryAfterSeconds}s`);
    return { ok: true, email };
  }

  const sendResult = await sendVerificationEmail(email, name);
  if (!sendResult.ok) {
    // Email failed but account exists — still send them to the verify page where they can resend
    console.error(`[signUpAction] verification email failed for ${email}`);
    return { ok: true, email };
  }

  console.log(`[signUpAction] success for email=${email}`);
  return { ok: true, email };
}
