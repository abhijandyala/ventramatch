import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildConsentUrl } from "@/lib/calendar/google";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/sign-in", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
  }
  const url = buildConsentUrl(session.user.id);
  return NextResponse.redirect(url);
}
