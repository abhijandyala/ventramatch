"use server";

import { revalidatePath } from "next/cache";
import { auth, unstable_update } from "@/auth";
import { withUserRls } from "@/lib/db";
import { onboardingSchema, type OnboardingInput } from "@/lib/validation/onboarding";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveOnboardingAction(input: OnboardingInput): Promise<ActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  console.log(`[saveOnboarding] userId=${userId ?? "none"} role=${input.role}`);

  if (!userId) {
    console.error("[saveOnboarding] no session — unauthorized");
    return { ok: false, error: "Unauthorized." };
  }

  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    console.log(`[saveOnboarding] validation failed: ${parsed.error.issues[0]?.message}`);
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  try {
    await withUserRls(userId, async (sql) => {
      const companyName =
        data.profile.role === "founder"
          ? data.profile.companyName
          : data.profile.investorType === "firm"
            ? (data.profile.firmName ?? null)
            : null;

      const investorType =
        data.profile.role === "investor" ? data.profile.investorType : null;

      await sql`
        update public.users
        set role = ${data.role}::public.user_role,
            company_name = ${companyName},
            investor_type = ${investorType},
            bio = ${data.profile.description},
            goals = ${data.goals.goals},
            onboarding_completed = true
        where id = ${userId}
      `;
    });
  } catch (error) {
    console.error("[saveOnboarding] save failed", error);
    return { ok: false, error: "Could not save your onboarding. Try again." };
  }

  try {
    await unstable_update({
      user: {
        role: data.role,
        onboardingCompleted: true,
      },
    });
  } catch (error) {
    console.error("[saveOnboarding] session refresh failed", error);
  }

  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  revalidatePath("/homepage");
  console.log(`[saveOnboarding] success for userId=${userId} role=${data.role}`);
  return { ok: true };
}
