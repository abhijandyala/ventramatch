"use server";

import { revalidatePath } from "next/cache";
import { auth, unstable_update } from "@/auth";
import { withUserRls } from "@/lib/db";
import { onboardingSchema, type OnboardingInput } from "@/lib/validation/onboarding";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveOnboardingAction(input: OnboardingInput): Promise<ActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false, error: "Unauthorized." };
  }

  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  try {
    await withUserRls(userId, async (sql) => {
      if (data.role === "founder") {
        const { industry, stage, amountRaising, location } = data.info;
        await sql`
          insert into public.founder_matching_preferences
            (user_id, industry, stage, amount_raising, location)
          values
            (${userId}, ${industry}, ${stage}, ${amountRaising}, ${location})
          on conflict (user_id) do update set
            industry = excluded.industry,
            stage = excluded.stage,
            amount_raising = excluded.amount_raising,
            location = excluded.location
        `;
      } else {
        const { checkSize, preferredStage, sectors, geography, leadFollow } = data.info;
        await sql`
          insert into public.investor_matching_preferences
            (user_id, check_size, preferred_stage, sectors, geography, lead_follow_preference)
          values
            (
              ${userId},
              ${checkSize},
              ${preferredStage},
              ${sql.array(sectors)},
              ${geography},
              ${leadFollow}
            )
          on conflict (user_id) do update set
            check_size = excluded.check_size,
            preferred_stage = excluded.preferred_stage,
            sectors = excluded.sectors,
            geography = excluded.geography,
            lead_follow_preference = excluded.lead_follow_preference
        `;
      }

      await sql`
        update public.users
        set role = ${data.role}::public.user_role,
            onboarding_completed = true
        where id = ${userId}
      `;
    });
  } catch (error) {
    console.error("[saveOnboardingAction] save failed", error);
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
    // Token refresh failure is non-fatal: the next request will pick up the
    // fresh value from the DB on the JWT callback's natural refresh, and the
    // middleware will route correctly. Log and continue.
    console.error("[saveOnboardingAction] session refresh failed", error);
  }

  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  return { ok: true };
}
