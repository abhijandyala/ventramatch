"use server";

import { revalidatePath } from "next/cache";
import { auth, unstable_update } from "@/auth";
import { withUserRls } from "@/lib/db";
import { nextSubmit, nextSaveDraft } from "@/lib/applications/lifecycle";
import {
  submitInvestorSchema,
  draftInvestorSchema,
  type SubmitInvestorInput,
  type DraftInvestorInput,
} from "@/lib/validation/applications";
import { investorCompletion, MIN_PUBLISH_PCT } from "@/lib/profile/completion";
import type {
  ApplicationStatus,
  StartupStage,
  Database,
  ProfileState,
} from "@/types/database";

type InvestorRow = Database["public"]["Tables"]["investors"]["Row"];

function inputAsRow(userId: string, data: SubmitInvestorInput): InvestorRow {
  const now = new Date().toISOString();
  return {
    id: "",
    user_id: userId,
    name: data.name,
    firm: data.firm ?? null,
    check_min: data.checkMin,
    check_max: data.checkMax,
    stages: data.stages,
    sectors: data.sectors,
    geographies: data.geographies,
    is_active: data.isActive ?? true,
    thesis: data.thesis ?? null,
    created_at: now,
    updated_at: now,
  };
}

type ActionResult =
  | { ok: true; status: ApplicationStatus; applicationId: string }
  | { ok: false; error: string; field?: string };

type CurrentApplication = {
  id: string;
  status: ApplicationStatus;
  resubmit_count: number;
  user_role: "founder" | "investor" | null;
};

async function loadCurrent(userId: string): Promise<CurrentApplication | null> {
  return withUserRls(userId, async (sql) => {
    const rows = await sql<CurrentApplication[]>`
      select a.id, a.status, a.resubmit_count, u.role as user_role
      from public.applications a
      join public.users u on u.id = a.user_id
      where a.user_id = ${userId}
      limit 1
    `;
    return rows[0] ?? null;
  });
}

function ensureInvestorRole(role: "founder" | "investor" | null): string | null {
  if (role === "investor") return null;
  if (role === null) {
    return "Finish onboarding before publishing your investor profile.";
  }
  return "Your account is set up as a founder. Use the founder profile instead.";
}

export async function submitInvestorApplicationAction(
  input: SubmitInvestorInput,
): Promise<ActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false, error: "Sign in to publish your profile." };
  }

  const parsed = submitInvestorSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? "Invalid input.",
      field: typeof issue?.path[0] === "string" ? issue.path[0] : undefined,
    };
  }
  const data = parsed.data;

  const current = await loadCurrent(userId);
  if (!current) {
    return { ok: false, error: "We can't find your account. Try signing in again." };
  }

  const roleError = ensureInvestorRole(current.user_role);
  if (roleError) return { ok: false, error: roleError };

  const completion = investorCompletion(inputAsRow(userId, data));
  if (!completion.canPublish) {
    const missingLabels = completion.missing.slice(0, 3).map((m) => m.label).join(", ");
    console.log(
      `[submitInvestor] blocked userId=${userId} pct=${completion.pct} missing=${missingLabels}`,
    );
    return {
      ok: false,
      error: `Profile is ${completion.pct}% complete — need at least ${MIN_PUBLISH_PCT}% to publish. Missing: ${missingLabels}.`,
    };
  }

  const transition = nextSubmit(current.status, current.resubmit_count);
  if (!transition.ok) {
    console.log(
      `[submitInvestor] blocked userId=${userId} status=${current.status} reason=${transition.reason}`,
    );
    return { ok: false, error: transition.reason };
  }

  // Postgres array literal for stages enum array. We pass the JS array to
  // postgres-js which serialises it correctly when typed against the column.
  const stages: StartupStage[] = data.stages;
  const isActive = data.isActive ?? true;

  try {
    await withUserRls(userId, async (sql) => {
      await sql`
        insert into public.investors (
          user_id, name, firm, check_min, check_max,
          stages, sectors, geographies, is_active, thesis
        ) values (
          ${userId},
          ${data.name},
          ${data.firm ?? null},
          ${data.checkMin},
          ${data.checkMax},
          ${stages}::public.startup_stage[],
          ${data.sectors},
          ${data.geographies},
          ${isActive},
          ${data.thesis ?? null}
        )
        on conflict (user_id) do update set
          name        = excluded.name,
          firm        = excluded.firm,
          check_min   = excluded.check_min,
          check_max   = excluded.check_max,
          stages      = excluded.stages,
          sectors     = excluded.sectors,
          geographies = excluded.geographies,
          is_active   = excluded.is_active,
          thesis      = excluded.thesis
      `;

      await sql`
        update public.applications
           set status = ${transition.nextStatus}::public.application_status,
               submitted_at = now(),
               resubmit_count = ${transition.nextResubmitCount},
               bot_recommendation = null,
               bot_confidence = null,
               bot_recommended_at = null,
               decided_by = null,
               decided_at = null,
               decision_reason_codes = '{}',
               decision_summary = null
         where id = ${current.id}
      `;

      await sql`
        update public.users
           set profile_state = case
                 when profile_state in ('verified','rejected') then profile_state
                 else 'complete'
               end,
               profile_completion_pct = ${completion.pct}
         where id = ${userId}
      `;

      await sql`
        update public.email_outbox
           set cancelled_at = now()
         where user_id = ${userId}
           and template = 'reminder.complete_profile'
           and sent_at is null
           and cancelled_at is null
      `;
    });
  } catch (error) {
    console.error("[submitInvestor] DB write failed", error);
    return { ok: false, error: "Could not publish your profile. Try again." };
  }

  try {
    await unstable_update({
      user: { profileState: "complete" satisfies ProfileState },
    });
  } catch (error) {
    console.error("[submitInvestor] session refresh failed", error);
  }

  revalidatePath("/account/application");
  revalidatePath("/build/investor");
  console.log(
    `[submitInvestor] success userId=${userId} status=${transition.nextStatus} resubmits=${transition.nextResubmitCount}`,
  );
  return { ok: true, status: transition.nextStatus, applicationId: current.id };
}

export async function saveInvestorDraftAction(
  input: DraftInvestorInput,
): Promise<ActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false, error: "Sign in to save a draft." };
  }

  const parsed = draftInvestorSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? "Invalid input.",
      field: typeof issue?.path[0] === "string" ? issue.path[0] : undefined,
    };
  }
  const data = parsed.data;

  const current = await loadCurrent(userId);
  if (!current) {
    return { ok: false, error: "We can't find your account. Try signing in again." };
  }

  const roleError = ensureInvestorRole(current.user_role);
  if (roleError) return { ok: false, error: roleError };

  const transition = nextSaveDraft(current.status);
  if (!transition.ok) {
    console.log(
      `[saveInvestorDraft] blocked userId=${userId} status=${current.status} reason=${transition.reason}`,
    );
    return { ok: false, error: transition.reason };
  }

  const hasDraftFields =
    data.name !== undefined ||
    data.firm !== undefined ||
    data.checkMin !== undefined ||
    data.checkMax !== undefined ||
    data.stages !== undefined ||
    data.sectors !== undefined ||
    data.geographies !== undefined ||
    data.isActive !== undefined ||
    data.thesis !== undefined;

  try {
    await withUserRls(userId, async (sql) => {
      if (hasDraftFields) {
        // investors requires non-null name + check_min + check_max. Stub
        // values let drafts persist before the user has filled everything in.
        const safeName = data.name?.trim() || "Draft (in progress)";
        const safeMin = data.checkMin ?? 0;
        const safeMax = data.checkMax ?? Math.max(safeMin, 0);
        const safeStages: StartupStage[] = data.stages ?? [];

        await sql`
          insert into public.investors (
            user_id, name, firm, check_min, check_max,
            stages, sectors, geographies, is_active, thesis
          ) values (
            ${userId},
            ${safeName},
            ${data.firm ?? null},
            ${safeMin},
            ${safeMax},
            ${safeStages}::public.startup_stage[],
            ${data.sectors ?? []},
            ${data.geographies ?? []},
            ${data.isActive ?? true},
            ${data.thesis ?? null}
          )
          on conflict (user_id) do update set
            name        = coalesce(${data.name ?? null}, public.investors.name),
            firm        = coalesce(${data.firm ?? null}, public.investors.firm),
            check_min   = coalesce(${data.checkMin ?? null}, public.investors.check_min),
            check_max   = coalesce(${data.checkMax ?? null}, public.investors.check_max),
            stages      = coalesce(
                            ${data.stages ?? null}::public.startup_stage[],
                            public.investors.stages
                          ),
            sectors     = coalesce(${data.sectors ?? null}, public.investors.sectors),
            geographies = coalesce(${data.geographies ?? null}, public.investors.geographies),
            is_active   = coalesce(${data.isActive ?? null}, public.investors.is_active),
            thesis      = coalesce(${data.thesis ?? null}, public.investors.thesis)
        `;
      }

      await sql`
        update public.applications
           set status = ${transition.nextStatus}::public.application_status
         where id = ${current.id}
      `;

      if (hasDraftFields) {
        await sql`
          update public.users
             set profile_state = case
                   when profile_state in ('none','basic') then 'partial'
                   else profile_state
                 end
           where id = ${userId}
        `;
      }
    });
  } catch (error) {
    console.error("[saveInvestorDraft] DB write failed", error);
    return { ok: false, error: "Could not save your draft. Try again." };
  }

  if (hasDraftFields) {
    try {
      await unstable_update({
        user: { profileState: "partial" satisfies ProfileState },
      });
    } catch (error) {
      console.error("[saveInvestorDraft] session refresh failed", error);
    }
  }

  revalidatePath("/account/application");
  console.log(
    `[saveInvestorDraft] success userId=${userId} status=${transition.nextStatus}`,
  );
  return { ok: true, status: transition.nextStatus, applicationId: current.id };
}
