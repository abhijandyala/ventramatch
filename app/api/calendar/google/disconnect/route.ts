import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { disconnect } from "@/lib/calendar/google";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  await disconnect(session.user.id);
  return NextResponse.json({ ok: true });
}
