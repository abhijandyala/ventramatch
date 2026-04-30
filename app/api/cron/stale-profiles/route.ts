import { NextResponse, type NextRequest } from "next/server";
import { processStaleReminders } from "@/lib/profiles/stale";

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
    const count = await processStaleReminders();
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    console.error("[cron:stale] failed", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
