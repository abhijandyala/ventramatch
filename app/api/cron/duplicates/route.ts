import { NextResponse, type NextRequest } from "next/server";
import { scanForDuplicates } from "@/lib/admin/duplicates";

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
    const count = await scanForDuplicates();
    return NextResponse.json({ ok: true, newCandidates: count });
  } catch (err) {
    console.error("[cron:duplicates] failed", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
