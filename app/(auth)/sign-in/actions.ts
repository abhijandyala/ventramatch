"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { signInSchema, type SignInInput } from "@/lib/validation/auth";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function signInAction(input: SignInInput): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { ok: false, error: "Wrong email or password." };
      }
      return { ok: false, error: "Could not sign in. Try again." };
    }
    throw error;
  }
}
