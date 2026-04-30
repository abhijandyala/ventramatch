import { NextResponse, type NextRequest } from "next/server";
import { processReminders } from "@/lib/calendar/reminders";

/**
 * GET /api/cron/reminders
 *
 * Called by Railway's scheduled service every 15 minutes. Protected by
 * a shared secret so random internet traffic can't trigger reminder
 * floods. Set CRON_SECRET in Railway env vars.
 *
 * Returns { ok, count } with the number of reminders enqueued.
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  try {
    const count = await processReminders();
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    console.error("[cron:reminders] failed", err);
    return NextResponse.json(
      { ok: false, error: "Reminder processing failed." },
      { status: 500 },
    );
  }
}
