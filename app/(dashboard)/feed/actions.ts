"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withUserRls } from "@/lib/db";
import { requireWrite } from "@/lib/auth/access";
import { invalidate } from "@/lib/cache";
import type { InteractionAction } from "@/types/database";

/**
 * Express interest / pass / save on a counterparty profile from the feed.
 *
 * Flow:
 *   - Gate via requireWrite() — needs to be email-verified, onboarded,
 *     and not in_review/rejected/banned.
 *   - Insert into public.interactions with the appropriate action.
 *   - The DB trigger `interactions_create_match` (in 0001_initial_schema.sql)
 *     handles the mutual-match detection: when both sides have inserted
 *     a 'like' on each other, a row in public.matches is inserted
 *     atomically and contact unlocks. We don't compute it client-side.
 *   - The trigger also enqueues a 'match.created' email_outbox row for both
 *     parties (added in this sprint, see migration 0007 below).
 */

const inputSchema = z.object({
  targetUserId: z.string().uuid(),
  action: z.enum(["like", "pass", "save"]),
});

export type InteractionResult =
  | { ok: true; action: InteractionAction; alreadyExisted: boolean }
  | { ok: false; error: string };

export async function recordInteractionAction(
  rawInput: { targetUserId: string; action: "like" | "pass" | "save" },
): Promise<InteractionResult> {
  const access = await requireWrite();
  if (!access.ok) {
    return { ok: false, error: access.message };
  }

  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { targetUserId, action } = parsed.data;

  if (targetUserId === access.userId) {
    return { ok: false, error: "You can't interact with your own profile." };
  }

  let alreadyExisted = false;
  try {
    await withUserRls(access.userId, async (sql) => {
      // The unique constraint (actor, target, action) means re-inserting
      // the same action is a no-op. We surface that to the UI so we can
      // skip the optimistic state flicker.
      const rows = await sql<{ inserted: number }[]>`
        with ins as (
          insert into public.interactions (actor_user_id, target_user_id, action)
          values (${access.userId}, ${targetUserId}, ${action}::public.interaction_action)
          on conflict (actor_user_id, target_user_id, action) do nothing
          returning 1 as inserted
        )
        select coalesce(sum(inserted), 0)::int as inserted from ins
      `;
      alreadyExisted = (rows[0]?.inserted ?? 0) === 0;
    });
  } catch (error) {
    console.error("[feed:interaction] DB write failed", error);
    return { ok: false, error: "Could not save your action. Try again." };
  }

  console.log(
    `[feed:interaction] actor=${access.userId} target=${targetUserId} action=${action} new=${!alreadyExisted}`,
  );

  // Refresh any surface that reads from interactions/matches.
  revalidatePath("/feed");
  revalidatePath("/dashboard");
  revalidatePath("/matches");

  // Invalidate cached stats for both parties.
  void invalidate(`profileStats:${access.userId}`);
  void invalidate(`profileStats:${targetUserId}`);

  return { ok: true, action, alreadyExisted };
}
