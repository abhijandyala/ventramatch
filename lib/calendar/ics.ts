import { randomUUID } from "node:crypto";

/**
 * Build a RFC 5545 iCalendar string. No external dependency — the spec
 * for a single VEVENT is straightforward enough to emit directly.
 *
 * Usage:
 *   const ics = buildIcs({ ... });
 *   // Attach as email attachment or serve from GET route with
 *   // Content-Type: text/calendar; charset=utf-8
 */

export type IcsInput = {
  summary: string;
  description: string;
  start: Date;
  durationMinutes?: number;
  location?: string;
  organizer?: { name: string; email: string };
  attendees?: { name: string; email: string }[];
};

export function buildIcs(input: IcsInput): string {
  const uid = randomUUID() + "@ventramatch.com";
  const now = formatIcsDate(new Date());
  const start = formatIcsDate(input.start);
  const endMs =
    input.start.getTime() + (input.durationMinutes ?? 30) * 60_000;
  const end = formatIcsDate(new Date(endMs));

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VentraMatch//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcsText(input.summary)}`,
    `DESCRIPTION:${escapeIcsText(input.description)}`,
  ];

  if (input.location) {
    lines.push(`LOCATION:${escapeIcsText(input.location)}`);
  }

  if (input.organizer) {
    lines.push(
      `ORGANIZER;CN=${escapeIcsText(input.organizer.name)}:mailto:${input.organizer.email}`,
    );
  }

  if (input.attendees) {
    for (const a of input.attendees) {
      lines.push(
        `ATTENDEE;CN=${escapeIcsText(a.name)};RSVP=TRUE;ROLE=REQ-PARTICIPANT:mailto:${a.email}`,
      );
    }
  }

  lines.push("STATUS:CONFIRMED");
  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");

  return lines.join("\r\n") + "\r\n";
}

/** Format a Date as an iCalendar UTC timestamp: 20260430T120000Z */
function formatIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escape special chars in iCalendar text values. */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}
