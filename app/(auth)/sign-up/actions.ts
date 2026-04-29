"use server";

import { signIn } from "@/auth";
import { withUserRls } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { signUpSchema, type SignUpInput } from "@/lib/validation/auth";

type ActionResult = { ok: true } | { ok: false; error: string };

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

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (error) {
    console.error("[signUpAction] auto sign-in failed", error);
    return { ok: false, error: "Account created but sign-in failed. Please sign in." };
  }

  console.log(`[signUpAction] success for email=${email}`);
  return { ok: true };
}
