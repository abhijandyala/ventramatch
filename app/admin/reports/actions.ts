"use server";

import { revalidatePath } from "next/cache";
import { withUserRls } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import type { ReportStatus } from "@/types/database";

type Result = { ok: true } | { ok: false; error: string };

export async function setReportStatusAction(input: {
  reportId: string;
  status: ReportStatus;
  notes: string;
}): Promise<Result> {
  const admin = await requireAdmin("reviewer");
  try {
    await withUserRls(null, async (sql) => {
      await sql`
        update public.reports
        set status = ${input.status}::public.report_status,
            resolved_by = ${admin.userId},
            resolved_at = now(),
            resolution_notes = ${input.notes || null}
        where id = ${input.reportId}
      `;
    });
    // Audit
    await withUserRls(null, async (sql) => {
      await sql`
        insert into public.admin_actions
          (actor_user_id, action, reason, metadata)
        values (
          ${admin.userId},
          ${"report_" + input.status},
          ${input.notes || null},
          ${JSON.stringify({ reportId: input.reportId })}::jsonb
        )
      `;
    });
    revalidatePath("/admin/reports");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not update report." };
  }
}
