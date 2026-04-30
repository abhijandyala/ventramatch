import { NextResponse, type NextRequest } from "next/server";
import { processDigests } from "@/lib/email/build-digest";

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
    const count = await processDigests();
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    console.error("[cron:digest] failed", err);
    return NextResponse.json({ ok: false, error: "Digest failed." }, { status: 500 });
  }
}
