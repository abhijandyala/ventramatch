import { NextResponse, type NextRequest } from "next/server";

// Next.js 16+ proxy. Add session refresh / auth when an auth library is wired (Auth.js, Clerk, etc.).

export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2)$).*)",
  ],
};
