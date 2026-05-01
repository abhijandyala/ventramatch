"use server";

import { revalidatePath } from "next/cache";
import { auth, unstable_update } from "@/auth";
import { withUserRls } from "@/lib/db";
import { nextSubmit, nextSaveDraft } from "@/lib/applications/lifecycle";
import {
  submitFounderSchema,
  draftFounderSchema,
  type SubmitFounderInput,
  type DraftFounderInput,
} from "@/lib/validation/applications";
import { founderCompletion, MIN_PUBLISH_PCT } from "@/lib/profile/completion";
import type { ApplicationStatus, Database, ProfileState } from "@/types/database";

type StartupRow = Database["public"]["Tables"]["startups"]["Row"];

/** Project the submit input into the same shape the completion calc expects. */
function inputAsRow(userId: string, data: SubmitFounderInput): StartupRow {
  const now = new Date().toISOString();
  return {
    id: "",
    user_id: userId,
    name: data.companyName,
    one_liner: data.oneLiner,
    industry: data.industry,
    stage: data.stage,
    raise_amount: data.raiseAmount ?? null,
    traction: data.traction ?? null,
    location: data.location ?? null,
    deck_url: data.deckUrl ?? null,
    // Sprint 9.5.B: deck upload writes these out-of-band via /api/deck/upload,
    // not through this draft path. The completion check below treats deck_url
    // as the deck signal, so leaving these null is fine here.
    deck_storage_key: null,
    deck_filename: null,
    deck_uploaded_at: null,
    website: data.website ?? null,
    startup_sectors: data.startupSectors ?? [data.industry],
    // 0035: New basics fields
    founded_year: data.foundedYear ?? null,
    product_status: data.productStatus ?? null,
    customer_type: data.customerType ?? null,
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

function ensureFounderRole(role: "founder" | "investor" | null): string | null {
  if (role === "founder") return null;
  if (role === null) {
    return "Finish onboarding before publishing your startup profile.";
  }
  return "Your account is set up as an investor. Use the investor profile instead.";
}

export async function submitFounderApplicationAction(
  input: SubmitFounderInput,
): Promise<ActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false, error: "Sign in to publish your profile." };
  }

  const parsed = submitFounderSchema.safeParse(input);
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

  const roleError = ensureFounderRole(current.user_role);
  if (roleError) return { ok: false, error: roleError };

  // Server-side completion gate. Strict schema already requires the basics;
  // this catches richer "good enough" thresholds (deck length, traction,
  // location) before we accept the submission and burn a review pass.
  const completion = founderCompletion(inputAsRow(userId, data));
  if (!completion.canPublish) {
    const missingLabels = completion.missing.slice(0, 3).map((m) => m.label).join(", ");
    console.log(
      `[submitFounder] blocked userId=${userId} pct=${completion.pct} missing=${missingLabels}`,
    );
    return {
      ok: false,
      error: `Profile is ${completion.pct}% complete — need at least ${MIN_PUBLISH_PCT}% to publish. Missing: ${missingLabels}.`,
    };
  }

  const transition = nextSubmit(current.status, current.resubmit_count);
  if (!transition.ok) {
    console.log(
      `[submitFounder] blocked userId=${userId} status=${current.status} reason=${transition.reason}`,
    );
    return { ok: false, error: transition.reason };
  }

  try {
    await withUserRls(userId, async (sql) => {
      // Base upsert without 0035 columns for graceful degradation.
      await sql`
        insert into public.startups (
          user_id, name, one_liner, industry, startup_sectors, stage,
          raise_amount, traction, location, deck_url, website
        ) values (
          ${userId},
          ${data.companyName},
          ${data.oneLiner},
          ${data.industry},
          ${data.startupSectors ?? [data.industry]}::text[],
          ${data.stage}::public.startup_stage,
          ${data.raiseAmount ?? null},
          ${data.traction ?? null},
          ${data.location ?? null},
          ${data.deckUrl ?? null},
          ${data.website ?? null}
        )
        on conflict (user_id) do update set
          name             = excluded.name,
          one_liner        = excluded.one_liner,
          industry         = excluded.industry,
          startup_sectors  = excluded.startup_sectors,
          stage            = excluded.stage,
          raise_amount     = excluded.raise_amount,
          traction         = excluded.traction,
          location         = excluded.location,
          deck_url         = excluded.deck_url,
          website          = excluded.website
      `;

      // Try to update 0035 columns separately (graceful fallback if columns don't exist).
      if (data.foundedYear !== undefined || data.productStatus !== undefined || data.customerType !== undefined) {
        try {
          await sql`
            update public.startups set
              founded_year   = coalesce(${data.foundedYear ?? null}, founded_year),
              product_status = coalesce(${data.productStatus ?? null}, product_status),
              customer_type  = coalesce(${data.customerType ?? null}, customer_type)
            where user_id = ${userId}
          `;
        } catch {
          // Columns don't exist yet — gracefully degrade.
        }
      }

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

      // Profile is now complete enough to publish (we just gated on
      // canPublish above). Bump profile_state so middleware/post-auth
      // stop redirecting the user back into /build, and record the
      // completion percentage we computed.
      await sql`
        update public.users
           set profile_state = case
                 when profile_state in ('verified','rejected') then profile_state
                 else 'complete'
               end,
               profile_completion_pct = ${completion.pct}
         where id = ${userId}
      `;

      // Cancel pending day-3 reminder; user is engaged and submitted.
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
    console.error("[submitFounder] DB write failed", error);
    return { ok: false, error: "Could not publish your profile. Try again." };
  }

  // Refresh the JWT so the next request sees profile_state=complete and the
  // user isn't bounced back to /build by middleware.
  try {
    await unstable_update({
      user: { profileState: "complete" satisfies ProfileState },
    });
  } catch (error) {
    console.error("[submitFounder] session refresh failed", error);
  }

  revalidatePath("/account/application");
  revalidatePath("/build");
  console.log(
    `[submitFounder] success userId=${userId} status=${transition.nextStatus} resubmits=${transition.nextResubmitCount}`,
  );
  return { ok: true, status: transition.nextStatus, applicationId: current.id };
}

export async function saveFounderDraftAction(
  input: DraftFounderInput,
): Promise<ActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false, error: "Sign in to save a draft." };
  }

  const parsed = draftFounderSchema.safeParse(input);
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

  const roleError = ensureFounderRole(current.user_role);
  if (roleError) return { ok: false, error: roleError };

  const transition = nextSaveDraft(current.status);
  if (!transition.ok) {
    console.log(
      `[saveFounderDraft] blocked userId=${userId} status=${current.status} reason=${transition.reason}`,
    );
    return { ok: false, error: transition.reason };
  }

  // Drafts may legitimately have nothing to persist yet (user opens /build,
  // hits Save draft to bookmark progress). In that case we only flip status.
  const hasDraftFields =
    data.companyName !== undefined ||
    data.oneLiner !== undefined ||
    data.industry !== undefined ||
    data.stage !== undefined ||
    data.raiseAmount !== undefined ||
    data.traction !== undefined ||
    data.location !== undefined ||
    data.deckUrl !== undefined ||
    data.website !== undefined ||
    data.foundedYear !== undefined ||
    data.productStatus !== undefined ||
    data.customerType !== undefined;

  try {
    await withUserRls(userId, async (sql) => {
      if (hasDraftFields) {
        // startups requires non-null name/one_liner/industry/stage. For draft
        // saves before those exist, persist a minimal stub so we don't lose
        // progress — uses a placeholder that fails the publish schema until
        // the user fills it in (publish runs the strict Zod schema).
        const safeName = data.companyName?.trim() || "Draft (in progress)";
        const safeOneLiner =
          data.oneLiner?.trim() && data.oneLiner.trim().length >= 10
            ? data.oneLiner.trim()
            : "Draft profile — not yet published.";
        const safeIndustry = data.industry?.trim() || "unspecified";
        const safeStage = data.stage ?? "idea";

        const safeSectors = data.startupSectors?.length
          ? data.startupSectors
          : safeIndustry !== "unspecified"
            ? [safeIndustry]
            : [];

        // Base upsert without 0035 columns (founded_year, product_status, customer_type)
        // to gracefully handle the case where migration hasn't been applied yet.
        await sql`
          insert into public.startups (
            user_id, name, one_liner, industry, startup_sectors, stage,
            raise_amount, traction, location, deck_url, website
          ) values (
            ${userId},
            ${safeName},
            ${safeOneLiner},
            ${safeIndustry},
            ${safeSectors}::text[],
            ${safeStage}::public.startup_stage,
            ${data.raiseAmount ?? null},
            ${data.traction ?? null},
            ${data.location ?? null},
            ${data.deckUrl ?? null},
            ${data.website ?? null}
          )
          on conflict (user_id) do update set
            name             = coalesce(${data.companyName ?? null}, public.startups.name),
            one_liner        = coalesce(${data.oneLiner ?? null}, public.startups.one_liner),
            industry         = coalesce(${data.industry ?? null}, public.startups.industry),
            startup_sectors  = case
                                 when ${data.startupSectors ?? null}::text[] is not null
                                 then ${data.startupSectors ?? null}::text[]
                                 else public.startups.startup_sectors
                               end,
            stage            = coalesce(${data.stage ?? null}::public.startup_stage, public.startups.stage),
            raise_amount     = coalesce(${data.raiseAmount ?? null}, public.startups.raise_amount),
            traction         = coalesce(${data.traction ?? null}, public.startups.traction),
            location         = coalesce(${data.location ?? null}, public.startups.location),
            deck_url         = coalesce(${data.deckUrl ?? null}, public.startups.deck_url),
            website          = coalesce(${data.website ?? null}, public.startups.website)
        `;

        // Try to update 0035 columns separately (graceful fallback if columns don't exist).
        if (data.foundedYear !== undefined || data.productStatus !== undefined || data.customerType !== undefined) {
          try {
            await sql`
              update public.startups set
                founded_year   = coalesce(${data.foundedYear ?? null}, founded_year),
                product_status = coalesce(${data.productStatus ?? null}, product_status),
                customer_type  = coalesce(${data.customerType ?? null}, customer_type)
              where user_id = ${userId}
            `;
          } catch {
            // Columns don't exist yet — gracefully degrade.
          }
        }
      }

      await sql`
        update public.applications
           set status = ${transition.nextStatus}::public.application_status
         where id = ${current.id}
      `;

      // Once the user has put real content into /build, escalate
      // profile_state out of 'basic' so we stop pushing them back. We don't
      // downgrade users who are already at higher states (e.g. complete
      // /verified) — those flow through submit, not draft saves.
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
    console.error("[saveFounderDraft] DB write failed", error);
    return { ok: false, error: "Could not save your draft. Try again." };
  }

  // Reflect the bump in the JWT so middleware sees `partial` and lets the
  // user out to /dashboard etc. without bouncing back to /build.
  if (hasDraftFields) {
    try {
      await unstable_update({
        user: { profileState: "partial" satisfies ProfileState },
      });
    } catch (error) {
      console.error("[saveFounderDraft] session refresh failed", error);
    }
  }

  revalidatePath("/account/application");
  console.log(
    `[saveFounderDraft] success userId=${userId} status=${transition.nextStatus}`,
  );
  return { ok: true, status: transition.nextStatus, applicationId: current.id };
}
