import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import { buildIcs } from "@/lib/calendar/ics";

/**
 * GET /api/intros/[introId]/calendar.ics
 *
 * Returns an .ics file for an accepted intro. Auth-gated to participants.
 * Useful when neither party has Google Calendar connected.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ introId: string }> },
) {
  const { introId } = await ctx.params;

  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Not authorized.", { status: 401 });
  }
  const viewerId = session.user.id;

  type Row = {
    sender_user_id: string;
    recipient_user_id: string;
    status: string;
    accepted_time: string | null;
    sender_name: string;
    sender_email: string;
    recipient_name: string;
    recipient_email: string;
  };

  const row = await withUserRls<Row | null>(viewerId, async (sql) => {
    const rows = await sql<Row[]>`
      select ir.sender_user_id, ir.recipient_user_id, ir.status, ir.accepted_time,
             su.name as sender_name, su.email as sender_email,
             ru.name as recipient_name, ru.email as recipient_email
      from public.intro_requests ir
      join public.users su on su.id = ir.sender_user_id
      join public.users ru on ru.id = ir.recipient_user_id
      where ir.id = ${introId}
        and (ir.sender_user_id = ${viewerId} or ir.recipient_user_id = ${viewerId})
      limit 1
    `;
    return rows[0] ?? null;
  });

  if (!row) {
    return new NextResponse("Not found.", { status: 404 });
  }
  if (row.status !== "accepted" || !row.accepted_time) {
    return new NextResponse("Intro not yet accepted or no time confirmed.", { status: 400 });
  }

  const ics = buildIcs({
    summary: `VentraMatch: ${row.sender_name} ↔ ${row.recipient_name}`,
    description: `VentraMatch intro request.\n\nSender: ${row.sender_name}\nRecipient: ${row.recipient_name}`,
    start: new Date(row.accepted_time),
    durationMinutes: 30,
    attendees: [
      { name: row.sender_name, email: row.sender_email },
      { name: row.recipient_name, email: row.recipient_email },
    ],
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="ventramatch-intro.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
