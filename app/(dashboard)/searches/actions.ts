"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import {
  feedFiltersSchema,
  type FeedFilters,
} from "@/lib/feed/filters";

/**
 * Saved searches: small CRUD surface.
 *
 * Auth: any signed-in user. We don't requireWrite() because saved searches
 * don't impact other users (no cross-side effects).
 */

const saveInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(80, "Keep it short — 80 chars max."),
  filters: feedFiltersSchema,
  notifyEmail: z.boolean().optional(),
});
export type SaveInput = z.infer<typeof saveInputSchema>;

const renameSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
});

const setNotifySchema = z.object({
  id: z.string().uuid(),
  notify: z.boolean(),
});

const deleteSchema = z.object({ id: z.string().uuid() });

type ActionResult<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function saveSearchAction(
  raw: SaveInput,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Sign in to save searches." };

  const parsed = saveInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Normalise: strip undefineds so the JSONB stays clean.
  const filtersToStore = stripUndefined(parsed.data.filters);

  try {
    const id = await withUserRls<string>(userId, async (sql) => {
      const rows = await sql<{ id: string }[]>`
        insert into public.saved_searches (user_id, name, filters, notify_email)
        values (
          ${userId},
          ${parsed.data.name},
          ${JSON.stringify(filtersToStore)}::jsonb,
          ${parsed.data.notifyEmail ?? false}
        )
        returning id
      `;
      return rows[0].id;
    });
    console.log(`[saved-search:save] userId=${userId} id=${id}`);
    revalidatePath("/searches");
    revalidatePath("/feed");
    return { ok: true, id };
  } catch (err) {
    console.error("[saved-search:save] failed", err);
    return { ok: false, error: "Could not save search." };
  }
}

export async function deleteSearchAction(
  raw: { id: string },
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Sign in." };

  const parsed = deleteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid id." };

  try {
    await withUserRls(userId, async (sql) => {
      await sql`
        delete from public.saved_searches
        where id = ${parsed.data.id} and user_id = ${userId}
      `;
    });
    console.log(`[saved-search:delete] userId=${userId} id=${parsed.data.id}`);
    revalidatePath("/searches");
    return { ok: true };
  } catch (err) {
    console.error("[saved-search:delete] failed", err);
    return { ok: false, error: "Could not delete." };
  }
}

export async function renameSearchAction(
  raw: { id: string; name: string },
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Sign in." };

  const parsed = renameSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await withUserRls(userId, async (sql) => {
      await sql`
        update public.saved_searches
        set name = ${parsed.data.name}
        where id = ${parsed.data.id} and user_id = ${userId}
      `;
    });
    revalidatePath("/searches");
    return { ok: true };
  } catch (err) {
    console.error("[saved-search:rename] failed", err);
    return { ok: false, error: "Could not rename." };
  }
}

export async function setSearchNotifyAction(
  raw: { id: string; notify: boolean },
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Sign in." };

  const parsed = setNotifySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  try {
    await withUserRls(userId, async (sql) => {
      await sql`
        update public.saved_searches
        set notify_email = ${parsed.data.notify}
        where id = ${parsed.data.id} and user_id = ${userId}
      `;
    });
    revalidatePath("/searches");
    return { ok: true };
  } catch (err) {
    console.error("[saved-search:notify] failed", err);
    return { ok: false, error: "Could not update." };
  }
}

function stripUndefined(filters: FeedFilters): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}
