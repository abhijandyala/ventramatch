"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { dismissDuplicate } from "@/lib/admin/duplicates";

export async function dismissDuplicateAction(input: {
  candidateId: string;
}): Promise<{ ok: boolean }> {
  const admin = await requireAdmin("reviewer");
  await dismissDuplicate(input.candidateId, admin.userId);
  revalidatePath("/admin/duplicates");
  return { ok: true };
}
