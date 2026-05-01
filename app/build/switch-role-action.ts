"use server";

import { revalidatePath } from "next/cache";
import { auth, unstable_update } from "@/auth";
import { withUserRls } from "@/lib/db";
import type { UserRole } from "@/types/database";

type Result = { ok: true } | { ok: false; error: string };

export async function switchRoleAction(
  newRole: "founder" | "investor",
): Promise<Result> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Unauthorized." };

  const current = session.user.role as UserRole | null;
  if (current === newRole) return { ok: true };

  try {
    await withUserRls(userId, async (sql) => {
      await sql`
        update public.users
        set role = ${newRole}::public.user_role
        where id = ${userId}
      `;
    });
  } catch (err) {
    console.error("[switchRole] DB update failed", err);
    return { ok: false, error: "Could not switch role. Try again." };
  }

  try {
    await unstable_update({ user: { role: newRole } });
  } catch (err) {
    console.error("[switchRole] session refresh failed", err);
  }

  revalidatePath("/build");
  revalidatePath("/build/investor");
  revalidatePath("/dashboard");
  return { ok: true };
}
