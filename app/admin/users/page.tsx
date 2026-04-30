import type { Route } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { withUserRls } from "@/lib/db";
import type { AccountLabel, UserRole } from "@/types/database";

export const dynamic = "force-dynamic";

type UserListRow = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole | null;
  account_label: AccountLabel;
  account_paused_at: Date | string | null;
  deletion_requested_at: Date | string | null;
  created_at: Date | string;
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin("reviewer");
  const { q } = await searchParams;
  const search = q?.trim() ?? "";

  const users = await withUserRls<UserListRow[]>(null, async (sql) => {
    if (search) {
      return sql<UserListRow[]>`
        select id, email, name, role, account_label,
               account_paused_at, deletion_requested_at, created_at
        from public.users
        where name ilike ${"%" + search + "%"}
           or email ilike ${"%" + search + "%"}
           or id::text = ${search}
        order by created_at desc
        limit 100
      `;
    }
    return sql<UserListRow[]>`
      select id, email, name, role, account_label,
             account_paused_at, deletion_requested_at, created_at
      from public.users
      order by created_at desc
      limit 100
    `;
  });

  return (
    <main className="mx-auto w-full max-w-[1200px] px-5 py-8 md:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
            Admin
          </p>
          <h1 className="mt-1 text-[20px] font-semibold tracking-tight text-[var(--color-text-strong)]">
            Users ({users.length})
          </h1>
        </div>
        <form method="GET" className="flex items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search name, email, or id…"
            className="h-9 w-[280px] border bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-text)]"
            style={{ borderColor: "var(--color-border)" }}
          />
          <button
            type="submit"
            className="h-9 px-3 text-[13px] font-medium text-white"
            style={{ background: "var(--color-text-strong)" }}
          >
            Search
          </button>
        </form>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
              <th className="pb-2 pr-4 font-medium">Name</th>
              <th className="pb-2 pr-4 font-medium">Email</th>
              <th className="pb-2 pr-4 font-medium">Role</th>
              <th className="pb-2 pr-4 font-medium">Status</th>
              <th className="pb-2 pr-4 font-medium">Joined</th>
              <th className="pb-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-surface)]"
              >
                <td className="py-3 pr-4">
                  <Link
                    href={`/admin/users/${u.id}` as Route}
                    className="font-medium text-[var(--color-text-strong)] hover:underline"
                  >
                    {u.name ?? "—"}
                  </Link>
                </td>
                <td className="py-3 pr-4 font-mono text-[12px] text-[var(--color-text-muted)]">
                  {u.email}
                </td>
                <td className="py-3 pr-4 capitalize text-[var(--color-text-muted)]">
                  {u.role ?? "—"}
                </td>
                <td className="py-3 pr-4">
                  <StatusPill label={u.account_label} paused={Boolean(u.account_paused_at)} deletion={Boolean(u.deletion_requested_at)} />
                </td>
                <td className="py-3 pr-4 text-[var(--color-text-faint)]">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="py-3">
                  <Link
                    href={`/admin/users/${u.id}` as Route}
                    className="text-[12px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]"
                  >
                    Detail →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 ? (
        <p className="mt-8 text-center text-[13px] text-[var(--color-text-muted)]">
          {search ? `No users matching "${search}".` : "No users yet."}
        </p>
      ) : null}
    </main>
  );
}

function StatusPill({
  label,
  paused,
  deletion,
}: {
  label: AccountLabel;
  paused: boolean;
  deletion: boolean;
}) {
  const text = deletion ? "Deleting" : paused ? "Paused" : label;
  const color =
    label === "banned" || deletion
      ? "var(--color-danger)"
      : label === "verified"
        ? "var(--color-brand-strong)"
        : "var(--color-text-muted)";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]"
      style={{
        color,
        background: label === "banned" || deletion ? "var(--color-surface)" : "var(--color-bg)",
        border: `1px solid ${color}`,
      }}
    >
      {text}
    </span>
  );
}
