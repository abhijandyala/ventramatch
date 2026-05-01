"use server";

import { revalidatePath } from "next/cache";
import { auth, unstable_update } from "@/auth";
import { withUserRls } from "@/lib/db";
import { onboardingSchema, type OnboardingInput } from "@/lib/validation/onboarding";
import type { ProfileState } from "@/types/database";

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

  let nextProfileState: ProfileState = "basic";
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

      // `goals` stores the optional "what are you looking for?" preference
      // text from onboarding step 2. Normalise blank to null so a returning
      // user with an empty textarea doesn't overwrite a previously-saved
      // value with an empty string.
      const lookingFor = data.profile.lookingFor?.trim() || null;

      const rows = await sql<{ profile_state: ProfileState }[]>`
        update public.users
        set role = ${data.role}::public.user_role,
            company_name = ${companyName},
            investor_type = ${investorType},
            bio = ${data.profile.description},
            goals = coalesce(${lookingFor}, goals),
            onboarding_completed = true,
            profile_state = case
              when profile_state in ('partial','complete','pending_review','verified','rejected')
                then profile_state
              else 'basic'
            end
        where id = ${userId}
        returning profile_state
      `;
      if (rows[0]) nextProfileState = rows[0].profile_state;
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
        profileState: nextProfileState,
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
