import type { Route } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { withUserRls } from "@/lib/db";
import { ReportActions } from "./report-actions-client";
import type { ReportReason, ReportStatus } from "@/types/database";

export const dynamic = "force-dynamic";

type ReportRow = {
  id: string;
  reporter_name: string | null;
  reporter_email: string;
  reported_name: string | null;
  reported_email: string;
  reported_user_id: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  resolved_by_name: string | null;
  resolution_notes: string | null;
  created_at: Date | string;
};

const STATUS_COLORS: Record<ReportStatus, string> = {
  open: "var(--color-text-strong)",
  reviewing: "var(--color-brand)",
  actioned: "var(--color-brand-strong)",
  dismissed: "var(--color-text-faint)",
};

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin("reviewer");
  const params = await searchParams;
  const statusFilter = (["open", "reviewing", "actioned", "dismissed"] as ReportStatus[]).includes(
    params.status as ReportStatus,
  )
    ? (params.status as ReportStatus)
    : null;

  const reports = await withUserRls<ReportRow[]>(null, async (sql) => {
    return sql<ReportRow[]>`
      select r.id, r.reason, r.details, r.status,
             r.resolution_notes, r.created_at, r.reported_user_id,
             rep.name as reporter_name, rep.email as reporter_email,
             tgt.name as reported_name, tgt.email as reported_email,
             resolver.name as resolved_by_name
      from public.reports r
      join public.users rep on rep.id = r.reporter_user_id
      join public.users tgt on tgt.id = r.reported_user_id
      left join public.users resolver on resolver.id = r.resolved_by
      ${statusFilter ? sql`where r.status = ${statusFilter}::public.report_status` : sql``}
      order by r.created_at desc
      limit 100
    `;
  });

  const statuses: (ReportStatus | "all")[] = ["all", "open", "reviewing", "actioned", "dismissed"];

  return (
    <main className="mx-auto w-full max-w-[1200px] px-5 py-8 md:px-8">
      <header className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
          Admin
        </p>
        <h1 className="mt-1 text-[20px] font-semibold tracking-tight text-[var(--color-text-strong)]">
          Reports ({reports.length})
        </h1>
      </header>

      <nav className="mb-5 flex flex-wrap gap-1.5">
        {statuses.map((s) => {
          const active = (s === "all" && !statusFilter) || s === statusFilter;
          const href = s === "all" ? "/admin/reports" : `/admin/reports?status=${s}`;
          return (
            <Link
              key={s}
              href={href as Route}
              className="inline-flex h-9 items-center px-3 text-[12.5px] font-medium transition-colors"
              style={{
                background: active ? "var(--color-text-strong)" : "var(--color-bg)",
                color: active ? "white" : "var(--color-text-muted)",
                border: `1px solid ${active ? "var(--color-text-strong)" : "var(--color-border)"}`,
              }}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </Link>
          );
        })}
      </nav>

      {reports.length === 0 ? (
        <p className="text-[13px] text-[var(--color-text-muted)]">
          No reports{statusFilter ? ` with status "${statusFilter}"` : ""}.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-3 border bg-[var(--color-surface)] p-4"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em]"
                      style={{
                        color: STATUS_COLORS[r.status],
                        border: `1px solid ${STATUS_COLORS[r.status]}`,
                      }}
                    >
                      {r.status}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-faint)]">
                      {r.reason.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-[var(--color-text-strong)]">
                    <span className="text-[var(--color-text-muted)]">Reported:</span>{" "}
                    <Link
                      href={`/admin/users/${r.reported_user_id}` as Route}
                      className="font-medium hover:underline"
                    >
                      {r.reported_name ?? r.reported_email}
                    </Link>
                  </p>
                  <p className="text-[12px] text-[var(--color-text-faint)]">
                    By: {r.reporter_name ?? r.reporter_email} · {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <p className="text-[13px] leading-[1.55] text-[var(--color-text)]">
                {r.details.length > 300 ? r.details.slice(0, 300) + "…" : r.details}
              </p>

              {r.resolution_notes ? (
                <p className="border-l-2 border-[var(--color-border)] pl-3 text-[12px] text-[var(--color-text-muted)]">
                  Resolution: {r.resolution_notes}
                  {r.resolved_by_name ? ` (by ${r.resolved_by_name})` : ""}
                </p>
              ) : null}

              {r.status === "open" || r.status === "reviewing" ? (
                <ReportActions reportId={r.id} currentStatus={r.status} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
