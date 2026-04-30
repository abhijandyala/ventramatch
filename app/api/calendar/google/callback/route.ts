import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { exchangeCodeAndSave } from "@/lib/calendar/google";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // userId passed as state

  const session = await auth();
  if (!session?.user?.id || !code) {
    return NextResponse.redirect(new URL("/settings#calendar", url.origin));
  }

  // Verify state matches session to prevent CSRF.
  if (state !== session.user.id) {
    console.warn("[calendar:callback] state mismatch");
    return NextResponse.redirect(new URL("/settings?calendar_error=state_mismatch", url.origin));
  }

  try {
    await exchangeCodeAndSave(session.user.id, code);
    return NextResponse.redirect(new URL("/settings?calendar_connected=1#calendar", url.origin));
  } catch (err) {
    console.error("[calendar:callback] exchange failed", err);
    return NextResponse.redirect(new URL("/settings?calendar_error=exchange_failed#calendar", url.origin));
  }
}
