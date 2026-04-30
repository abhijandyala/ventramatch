"use server";

import { revalidatePath } from "next/cache";
import { withUserRls } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";

type Result = { ok: true } | { ok: false; error: string };

async function logAction(
  actorId: string,
  action: string,
  targetId: string | null,
  reason: string | null,
) {
  await withUserRls(null, async (sql) => {
    await sql`
      insert into public.admin_actions (actor_user_id, action, target_user_id, reason)
      values (${actorId}, ${action}, ${targetId}, ${reason})
    `;
  });
}

export async function banUserAction(input: {
  userId: string;
  reason: string;
}): Promise<Result> {
  const admin = await requireAdmin("admin");
  try {
    await withUserRls(null, async (sql) => {
      await sql`
        update public.users
        set account_label = 'banned'
        where id = ${input.userId}
      `;
    });
    await logAction(admin.userId, "ban", input.userId, input.reason);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not ban user." };
  }
}

export async function unbanUserAction(input: {
  userId: string;
}): Promise<Result> {
  const admin = await requireAdmin("admin");
  try {
    await withUserRls(null, async (sql) => {
      await sql`
        update public.users
        set account_label = 'unverified'
        where id = ${input.userId} and account_label = 'banned'
      `;
    });
    await logAction(admin.userId, "unban", input.userId, null);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not unban user." };
  }
}

export async function pauseUserAction(input: {
  userId: string;
}): Promise<Result> {
  const admin = await requireAdmin("admin");
  try {
    await withUserRls(null, async (sql) => {
      await sql`
        update public.users
        set account_paused_at = coalesce(account_paused_at, now())
        where id = ${input.userId}
      `;
    });
    await logAction(admin.userId, "force_pause", input.userId, null);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not pause user." };
  }
}

export async function resumeUserAction(input: {
  userId: string;
}): Promise<Result> {
  const admin = await requireAdmin("admin");
  try {
    await withUserRls(null, async (sql) => {
      await sql`
        update public.users
        set account_paused_at = null
        where id = ${input.userId}
      `;
    });
    await logAction(admin.userId, "force_resume", input.userId, null);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not resume user." };
  }
}
