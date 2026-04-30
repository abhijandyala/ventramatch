import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { withUserRls } from "@/lib/db";
import { AdminUserActions } from "./admin-user-actions";
import type { AccountLabel, UserRole } from "@/types/database";

export const dynamic = "force-dynamic";

type UserDetail = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole | null;
  account_label: AccountLabel;
  account_paused_at: Date | string | null;
  deletion_requested_at: Date | string | null;
  email_verified_at: Date | string | null;
  onboarding_completed: boolean;
  created_at: Date | string;
};

type ActionLog = {
  action: string;
  actor_name: string | null;
  reason: string | null;
  created_at: Date | string;
};

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin("reviewer");
  const { id: userId } = await params;

  const [user, actions] = await Promise.all([
    withUserRls<UserDetail | null>(null, async (sql) => {
      const rows = await sql<UserDetail[]>`
        select id, email, name, role, account_label,
               account_paused_at, deletion_requested_at,
               email_verified_at, onboarding_completed, created_at
        from public.users where id = ${userId} limit 1
      `;
      return rows[0] ?? null;
    }),
    withUserRls<ActionLog[]>(null, async (sql) => {
      return sql<ActionLog[]>`
        select a.action, u.name as actor_name, a.reason, a.created_at
        from public.admin_actions a
        left join public.users u on u.id = a.actor_user_id
        where a.target_user_id = ${userId}
        order by a.created_at desc
        limit 50
      `;
    }),
  ]);

  if (!user) notFound();

  return (
    <main className="mx-auto w-full max-w-[960px] px-5 py-8 md:px-8">
      <Link
        href={"/admin/users" as Route}
        className="text-[12px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
      >
        ← Back to users
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--color-text-strong)]">
            {user.name ?? "Unnamed"}
          </h1>
          <p className="mt-1 font-mono text-[13px] text-[var(--color-text-muted)]">
            {user.email}
          </p>
        </div>
        <AdminUserActions
          userId={user.id}
          accountLabel={user.account_label}
          paused={Boolean(user.account_paused_at)}
        />
      </header>

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InfoCard label="Role" value={user.role ?? "—"} />
        <InfoCard label="Status" value={user.account_label} />
        <InfoCard label="Email verified" value={user.email_verified_at ? "Yes" : "No"} />
        <InfoCard label="Onboarded" value={user.onboarding_completed ? "Yes" : "No"} />
        <InfoCard label="Joined" value={new Date(user.created_at).toLocaleDateString()} />
        <InfoCard label="Paused" value={user.account_paused_at ? new Date(user.account_paused_at).toLocaleDateString() : "No"} />
        <InfoCard label="Deletion req" value={user.deletion_requested_at ? new Date(user.deletion_requested_at).toLocaleDateString() : "No"} />
        <InfoCard label="User ID" value={user.id.slice(0, 8) + "…"} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
          Admin action log
        </h2>
        {actions.length === 0 ? (
          <p className="text-[13px] text-[var(--color-text-muted)]">No admin actions yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {actions.map((a, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-3 border bg-[var(--color-surface)] px-4 py-3"
                style={{ borderColor: "var(--color-border)" }}
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--color-text-strong)]">
                    {a.action}
                  </p>
                  {a.reason ? (
                    <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{a.reason}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right text-[11px] text-[var(--color-text-faint)]">
                  <p>{a.actor_name ?? "System"}</p>
                  <p>{new Date(a.created_at).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <Link
          href={`/p/${user.id}` as Route}
          className="text-[13px] font-medium text-[var(--color-brand-strong)] underline-offset-4 hover:underline"
        >
          View public profile →
        </Link>
      </section>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="border bg-[var(--color-surface)] px-3 py-2.5"
      style={{ borderColor: "var(--color-border)" }}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-faint)]">
        {label}
      </p>
      <p className="mt-1 text-[13px] font-medium text-[var(--color-text-strong)]">
        {value}
      </p>
    </div>
  );
}
