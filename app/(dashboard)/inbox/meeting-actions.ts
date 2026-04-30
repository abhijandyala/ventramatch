"use server";

import { revalidatePath } from "next/cache";
import { withUserRls } from "@/lib/db";
import { requireWrite } from "@/lib/auth/access";
import { deleteEvent, hasCalendar } from "@/lib/calendar/google";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Cancel a scheduled meeting. Both parties can cancel.
 * Marks meeting_cancelled_at on the intro, logs to intro_reschedules,
 * and deletes the Google Calendar events (if any).
 */
export async function cancelMeetingAction(input: {
  introId: string;
  reason?: string;
}): Promise<ActionResult> {
  const access = await requireWrite();
  if (!access.ok) return { ok: false, error: access.message };

  try {
    await withUserRls(access.userId, async (sql) => {
      // Verify participant + status.
      const rows = await sql<{
        sender_user_id: string;
        recipient_user_id: string;
        status: string;
        accepted_time: string | null;
        calendar_event_id_sender: string | null;
        calendar_event_id_recipient: string | null;
      }[]>`
        select sender_user_id, recipient_user_id, status, accepted_time,
               calendar_event_id_sender, calendar_event_id_recipient
        from public.intro_requests
        where id = ${input.introId}
        limit 1
      `;
      if (rows.length === 0) throw new Error("Intro not found.");
      const row = rows[0];
      if (
        row.sender_user_id !== access.userId &&
        row.recipient_user_id !== access.userId
      ) {
        throw new Error("Not a participant.");
      }
      if (row.status !== "accepted") {
        throw new Error("Can only cancel accepted meetings.");
      }

      // Mark cancelled.
      await sql`
        update public.intro_requests
        set meeting_cancelled_at = now(),
            meeting_cancel_reason = ${input.reason ?? null}
        where id = ${input.introId}
      `;

      // Audit log.
      await sql`
        insert into public.intro_reschedules
          (intro_id, actor_user_id, action, previous_time, reason)
        values (
          ${input.introId},
          ${access.userId},
          'cancel',
          ${row.accepted_time},
          ${input.reason ?? null}
        )
      `;

      // Delete Google Calendar events (fire-and-forget per party).
      if (row.calendar_event_id_sender) {
        void deleteEvent(row.sender_user_id, row.calendar_event_id_sender).catch(() => undefined);
      }
      if (row.calendar_event_id_recipient) {
        void deleteEvent(row.recipient_user_id, row.calendar_event_id_recipient).catch(() => undefined);
      }
    });

    console.log(
      `[meeting:cancel] introId=${input.introId} by=${access.userId}`,
    );
    revalidatePath("/inbox");
    revalidatePath(`/inbox/${input.introId}`);
    return { ok: true };
  } catch (err) {
    console.error("[meeting:cancel] failed", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not cancel.",
    };
  }
}

/**
 * Reschedule: propose new times. Keeps status='accepted' but the
 * acceptedTime is cleared until the other party picks a new time.
 * Calendar events are deleted (they'll be recreated on re-accept).
 */
export async function rescheduleMeetingAction(input: {
  introId: string;
  newProposedTimes: string[];
}): Promise<ActionResult> {
  const access = await requireWrite();
  if (!access.ok) return { ok: false, error: access.message };

  if (
    !input.newProposedTimes ||
    input.newProposedTimes.length === 0 ||
    input.newProposedTimes.length > 3
  ) {
    return { ok: false, error: "Propose 1-3 new times." };
  }

  try {
    await withUserRls(access.userId, async (sql) => {
      const rows = await sql<{
        sender_user_id: string;
        recipient_user_id: string;
        status: string;
        accepted_time: string | null;
        calendar_event_id_sender: string | null;
        calendar_event_id_recipient: string | null;
      }[]>`
        select sender_user_id, recipient_user_id, status, accepted_time,
               calendar_event_id_sender, calendar_event_id_recipient
        from public.intro_requests
        where id = ${input.introId}
        limit 1
      `;
      if (rows.length === 0) throw new Error("Intro not found.");
      const row = rows[0];
      if (
        row.sender_user_id !== access.userId &&
        row.recipient_user_id !== access.userId
      ) {
        throw new Error("Not a participant.");
      }
      if (row.status !== "accepted") {
        throw new Error("Can only reschedule accepted meetings.");
      }

      // Reset to pending-like state: clear acceptedTime, set new proposals.
      await sql`
        update public.intro_requests
        set accepted_time = null,
            proposed_times = ${JSON.stringify(input.newProposedTimes)}::jsonb,
            responded_at = null,
            calendar_event_id_sender = null,
            calendar_event_id_recipient = null
        where id = ${input.introId}
      `;

      // Audit.
      await sql`
        insert into public.intro_reschedules
          (intro_id, actor_user_id, action, previous_time, new_proposed_times, reason)
        values (
          ${input.introId},
          ${access.userId},
          'reschedule',
          ${row.accepted_time},
          ${JSON.stringify(input.newProposedTimes)}::jsonb,
          null
        )
      `;

      // Delete old calendar events.
      if (row.calendar_event_id_sender) {
        void deleteEvent(row.sender_user_id, row.calendar_event_id_sender).catch(() => undefined);
      }
      if (row.calendar_event_id_recipient) {
        void deleteEvent(row.recipient_user_id, row.calendar_event_id_recipient).catch(() => undefined);
      }
    });

    console.log(
      `[meeting:reschedule] introId=${input.introId} by=${access.userId} newTimes=${input.newProposedTimes.length}`,
    );
    revalidatePath("/inbox");
    revalidatePath(`/inbox/${input.introId}`);
    return { ok: true };
  } catch (err) {
    console.error("[meeting:reschedule] failed", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not reschedule.",
    };
  }
}
