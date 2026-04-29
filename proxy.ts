import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

// Next 16 proxy. Wraps Auth.js v5's edge-safe middleware. Route-protection
// logic lives in authConfig.callbacks.authorized so it can be tested and
// reused.
export function proxy(request: NextRequest) {
  return (auth as unknown as (req: NextRequest) => Response | Promise<Response>)(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2)$).*)",
  ],
};
