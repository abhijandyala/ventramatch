"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";

type Result = { ok: true } | { ok: false; error: string };

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function markNotificationReadAction(
  input: { id: string },
): Promise<Result> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Sign in." };
  try {
    await withUserRls(userId, async (sql) => {
      await sql`
        update public.notifications
        set read_at = now()
        where id = ${input.id} and user_id = ${userId} and read_at is null
      `;
    });
    revalidatePath("/notifications");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not mark as read." };
  }
}

export async function markAllNotificationsReadAction(): Promise<Result> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Sign in." };
  try {
    await withUserRls(userId, async (sql) => {
      await sql`
        update public.notifications
        set read_at = now()
        where user_id = ${userId} and read_at is null
      `;
    });
    revalidatePath("/notifications");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not mark all as read." };
  }
}

export async function dismissNotificationAction(
  input: { id: string },
): Promise<Result> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Sign in." };
  try {
    await withUserRls(userId, async (sql) => {
      await sql`
        update public.notifications
        set dismissed_at = now()
        where id = ${input.id} and user_id = ${userId}
      `;
    });
    revalidatePath("/notifications");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not dismiss." };
  }
}
