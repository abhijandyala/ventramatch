import type { Route } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, type Role, type SessionUser } from "@/lib/auth/session";

// Routes we redirect to. /login is owned by the teammate (not yet typed in the
// route tree), so we cast to Route to satisfy Next 16 typedRoutes.
const ROLE_HOMES: Record<Role, Route> = {
  founder: "/dashboard" as Route,
  investor: "/feed" as Route,
};

const LOGIN_HREF = "/login" as Route;

/**
 * Page-level bouncer. Each dashboard route calls this with the role it
 * serves. Three outcomes:
 *  - anonymous           -> redirect("/login")
 *  - signed in, mismatch -> redirect to the user's role home
 *  - signed in, match    -> return the SessionUser
 *
 * The signup flow does not need to know role logic; it can always
 * redirect("/dashboard") and the dashboards will self-correct.
 */
export async function requireRole(expected: Role): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_HREF);
  if (user.role !== expected) redirect(ROLE_HOMES[user.role]);
  return user;
}
