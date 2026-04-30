"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "build", "dashboard", "feed", "help",
  "homepage", "inbox", "legal", "matches", "notifications", "onboarding",
  "profile", "searches", "settings", "sign-in", "sign-up",
]);

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Slug must be at least 3 characters.")
  .max(32, "Slug must be at most 32 characters.")
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    "Use only lowercase letters, numbers, and dashes. Must start and end with a letter or number.",
  )
  .refine((s) => !RESERVED_SLUGS.has(s), { message: "That slug is reserved." });

export async function setPublicProfileAction(input: {
  enabled: boolean;
  slug?: string;
}): Promise<Result<{ slug?: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in." };
  const userId = session.user.id;

  if (!input.enabled) {
    try {
      await withUserRls(userId, async (sql) => {
        await sql`
          update public.users
          set public_profile_enabled = false, public_slug = null
          where id = ${userId}
        `;
      });
      revalidatePath("/settings");
      return { ok: true };
    } catch {
      return { ok: false, error: "Could not disable." };
    }
  }

  const parsed = slugSchema.safeParse(input.slug);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid slug." };
  }
  const slug = parsed.data;

  try {
    await withUserRls(userId, async (sql) => {
      const taken = await sql<{ id: string }[]>`
        select id from public.users
        where public_slug = ${slug} and id <> ${userId}
        limit 1
      `;
      if (taken.length > 0) throw new Error("That slug is taken.");

      await sql`
        update public.users
        set public_profile_enabled = true, public_slug = ${slug}
        where id = ${userId}
      `;
    });
    revalidatePath("/settings");
    revalidatePath(`/u/${slug}`);
    return { ok: true, slug };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not save.",
    };
  }
}
