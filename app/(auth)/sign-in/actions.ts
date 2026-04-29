"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { signInSchema, type SignInInput } from "@/lib/validation/auth";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function signInAction(input: SignInInput): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    console.log(`[signInAction] validation failed: ${parsed.error.issues[0]?.message}`);
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  console.log(`[signInAction] attempting credentials sign-in for email=${parsed.data.email}`);

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
    console.log(`[signInAction] success for email=${parsed.data.email}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      console.log(`[signInAction] AuthError type=${error.type} email=${parsed.data.email}`);
      if (error.type === "CredentialsSignin") {
        return { ok: false, error: "Wrong email or password." };
      }
      return { ok: false, error: "Could not sign in. Try again." };
    }
    console.error("[signInAction] unexpected error", error);
    throw error;
  }
}
