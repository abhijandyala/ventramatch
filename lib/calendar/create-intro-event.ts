import { withUserRls } from "@/lib/db";
import {
  createEvent,
  hasCalendar,
  type CalendarEventInput,
} from "./google";

/**
 * After an intro is accepted with a confirmed time, create Google Calendar
 * events for both parties (if they have calendars connected).
 *
 * Non-blocking: failures are logged but don't affect the intro acceptance.
 * The intro detail page shows a banner if event creation failed.
 *
 * Called from respondIntroAction when action='accept' + acceptedTime is set.
 */
export async function createIntroCalendarEvents(opts: {
  introId: string;
  senderUserId: string;
  senderEmail: string;
  senderName: string;
  recipientUserId: string;
  recipientEmail: string;
  recipientName: string;
  acceptedTime: Date;
  introLink: string;
}): Promise<void> {
  const {
    introId,
    senderUserId,
    senderEmail,
    senderName,
    recipientUserId,
    recipientEmail,
    recipientName,
    acceptedTime,
    introLink,
  } = opts;

  const description = [
    `VentraMatch intro between ${senderName} and ${recipientName}.`,
    "",
    `View details: ${introLink}`,
    "",
    "This event was created automatically when the intro was accepted.",
  ].join("\n");

  const eventInput: CalendarEventInput = {
    summary: `VentraMatch: ${senderName} ↔ ${recipientName}`,
    description,
    start: acceptedTime,
    durationMinutes: 30,
    attendeeEmails: [senderEmail, recipientEmail],
  };

  const results: {
    senderEventId: string | null;
    recipientEventId: string | null;
  } = { senderEventId: null, recipientEventId: null };

  // Create in parallel for both parties.
  const [senderHas, recipientHas] = await Promise.all([
    hasCalendar(senderUserId),
    hasCalendar(recipientUserId),
  ]);

  const promises: Promise<void>[] = [];

  if (senderHas) {
    promises.push(
      createEvent(senderUserId, eventInput)
        .then((id) => {
          results.senderEventId = id;
        })
        .catch((err) => {
          console.error("[calendar:create-event] sender failed", err);
        }),
    );
  }

  if (recipientHas) {
    promises.push(
      createEvent(recipientUserId, eventInput)
        .then((id) => {
          results.recipientEventId = id;
        })
        .catch((err) => {
          console.error("[calendar:create-event] recipient failed", err);
        }),
    );
  }

  await Promise.all(promises);

  // Persist event IDs so reschedule/cancel can reference them.
  if (results.senderEventId || results.recipientEventId) {
    try {
      await withUserRls(null, async (sql) => {
        await sql`
          update public.intro_requests
          set calendar_event_id_sender = ${results.senderEventId},
              calendar_event_id_recipient = ${results.recipientEventId}
          where id = ${introId}
        `;
      });
    } catch (err) {
      console.error("[calendar:create-event] DB update failed", err);
    }
  }

  console.log(
    `[calendar:create-event] introId=${introId} sender=${results.senderEventId ?? "none"} recipient=${results.recipientEventId ?? "none"}`,
  );
}
