import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";

/**
 * Server-side admin gate. Returns the userId if the current session
 * belongs to an admin with at least the given minimum role. Otherwise
 * redirects to / (not 403, to avoid confirming /admin/* exists).
 *
 * Role hierarchy: reviewer < admin < super_admin.
 *
 * Runs with `withUserRls(null, ...)` because the admins table has no
 * public-facing RLS policy — only the service role can read it.
 */

type AdminRole = "reviewer" | "admin" | "super_admin";

const ROLE_RANK: Record<AdminRole, number> = {
  reviewer: 1,
  admin: 2,
  super_admin: 3,
};

export async function requireAdmin(
  minRole: AdminRole = "reviewer",
): Promise<{ userId: string; adminRole: AdminRole }> {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const userId = session.user.id;

  const row = await withUserRls<{ role: AdminRole } | null>(null, async (sql) => {
    const rows = await sql<{ role: AdminRole }[]>`
      select role from public.admins where user_id = ${userId} limit 1
    `;
    return rows[0] ?? null;
  });

  if (!row || ROLE_RANK[row.role] < ROLE_RANK[minRole]) {
    console.log(`[admin:gate] denied userId=${userId} has=${row?.role ?? "none"} needs=${minRole}`);
    redirect("/");
  }

  return { userId, adminRole: row.role };
}
