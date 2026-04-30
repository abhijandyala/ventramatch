"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import { LEGAL_TOS_VERSION, LEGAL_PRIVACY_VERSION } from "./versions";

type Result = { ok: true } | { ok: false; error: string };

export async function acceptLegalAction(): Promise<Result> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sign in." };

  try {
    await withUserRls(session.user.id, async (sql) => {
      await sql`
        update public.users
        set tos_version_accepted = ${LEGAL_TOS_VERSION},
            privacy_version_accepted = ${LEGAL_PRIVACY_VERSION},
            tos_accepted_at = now(),
            privacy_accepted_at = now()
        where id = ${session.user.id}
      `;
    });
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save acceptance." };
  }
}
