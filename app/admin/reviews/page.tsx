import type { Route } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { withUserRls } from "@/lib/db";

export const dynamic = "force-dynamic";

type QueueRow = {
  id: string;
  status: string;
  submitted_at: Date | string | null;
  resubmit_count: number;
  bot_recommendation: string | null;
  bot_confidence: number | null;
  ruleset_version: string | null;
  decision_reason_codes: string[] | null;
  user_id: string;
  user_email: string;
  user_name: string | null;
  user_role: "founder" | "investor" | null;
  account_label: string;
};

export default async function AdminReviewsQueuePage() {
  await requireAdmin("reviewer");

  const rows = await withUserRls<QueueRow[]>(null, async (sql) => {
    return sql<QueueRow[]>`
      select
        a.id,
        a.status,
        a.submitted_at,
        a.resubmit_count,
        a.bot_recommendation,
        a.bot_confidence,
        a.ruleset_version,
        a.decision_reason_codes,
        u.id       as user_id,
        u.email    as user_email,
        u.name     as user_name,
        u.role     as user_role,
        u.account_label
      from public.applications a
      join public.users u on u.id = a.user_id
      where a.status in ('submitted', 'under_review', 'needs_changes')
      order by
        case a.bot_recommendation
          when 'ban'          then 0
          when 'decline'      then 1
          when 'flag'         then 2
          when 'needs_changes' then 3
          when 'accept'       then 4
          else                     5
        end asc,
        a.submitted_at asc nulls last
      limit 200
    `;
  });

  const submitted    = rows.filter((r) => r.status === "submitted");
  const underReview  = rows.filter((r) => r.status === "under_review");
  const needsChanges = rows.filter((r) => r.status === "needs_changes");

  function ageSince(ts: Date | string | null): string {
    if (!ts) return "—";
    const ms = Date.now() - new Date(ts).getTime();
    const h  = Math.floor(ms / 3_600_000);
    if (h < 1)  return `${Math.floor(ms / 60_000)}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  function recBadge(rec: string | null) {
    if (!rec) return null;
    const colors: Record<string, string> = {
      ban:          "bg-red-700 text-white",
      decline:      "bg-red-500 text-white",
      flag:         "bg-orange-500 text-white",
      needs_changes:"bg-yellow-500 text-black",
      accept:       "bg-green-600 text-white",
    };
    return (
      <span
        className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${colors[rec] ?? "bg-[var(--color-surface)]"}`}
      >
        {rec.replace(/_/g, " ")}
      </span>
    );
  }

  function QueueSection({ title, items }: { title: string; items: QueueRow[] }) {
    if (items.length === 0) return null;
    return (
      <section className="mt-8">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-widest text-[var(--color-text-faint)]">
          {title} ({items.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[11px] uppercase tracking-widest text-[var(--color-text-faint)]">
                <th className="pb-2 pr-4 font-medium">User</th>
                <th className="pb-2 pr-4 font-medium">Role</th>
                <th className="pb-2 pr-4 font-medium">Age</th>
                <th className="pb-2 pr-4 font-medium">Bot rec</th>
                <th className="pb-2 pr-4 font-medium">Conf</th>
                <th className="pb-2 pr-4 font-medium">Resubmits</th>
                <th className="pb-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[var(--color-border)] last:border-none"
                >
                  <td className="py-2.5 pr-4">
                    <div className="text-[var(--color-text-strong)]">
                      {r.user_name ?? "Unnamed"}
                    </div>
                    <div className="font-mono text-[11px] text-[var(--color-text-faint)]">
                      {r.user_email}
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 capitalize text-[var(--color-text-muted)]">
                    {r.user_role ?? "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-[var(--color-text-muted)]">
                    {ageSince(r.submitted_at)}
                  </td>
                  <td className="py-2.5 pr-4">{recBadge(r.bot_recommendation)}</td>
                  <td className="py-2.5 pr-4 text-[var(--color-text-muted)]">
                    {r.bot_confidence != null
                      ? Math.round(r.bot_confidence * 100) + "%"
                      : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-[var(--color-text-muted)]">
                    {r.resubmit_count}
                  </td>
                  <td className="py-2.5">
                    <Link
                      href={`/admin/reviews/${r.id}` as Route}
                      className="text-[12px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] px-5 py-8 md:px-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--color-text-strong)]">
            Application review queue
          </h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            {rows.length} application{rows.length !== 1 ? "s" : ""} awaiting review.
            Sorted highest-risk first.
          </p>
        </div>
      </header>

      {rows.length === 0 && (
        <p className="mt-12 text-center text-[14px] text-[var(--color-text-faint)]">
          Queue is empty. 🎉
        </p>
      )}

      <QueueSection title="Submitted — awaiting bot review or human triage" items={submitted} />
      <QueueSection title="Under review" items={underReview} />
      <QueueSection title="Needs changes — returned to applicant" items={needsChanges} />
    </main>
  );
}
