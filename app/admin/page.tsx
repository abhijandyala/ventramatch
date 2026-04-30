import type { Route } from "next";
import Link from "next/link";

export default function AdminHomePage() {
  return (
    <main className="mx-auto w-full max-w-[1100px] px-5 py-12 md:px-8">
      <h1 className="text-[24px] font-semibold tracking-tight text-[var(--color-text-strong)]">
        Admin panel
      </h1>
      <p className="mt-2 max-w-[60ch] text-[14px] text-[var(--color-text-muted)]">
        Manage users, triage reports, and view platform metrics.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AdminCard
          title="Users"
          desc="Search, view, ban/unban."
          href="/admin/users"
        />
        <AdminCard
          title="Reports"
          desc="Triage abuse reports."
          href="/admin/reports"
        />
      </div>
    </main>
  );
}

function AdminCard({
  title,
  desc,
  href,
}: {
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href as Route}
      className="flex flex-col gap-2 border bg-[var(--color-surface)] p-5 transition-colors hover:border-[var(--color-text-faint)]"
      style={{ borderColor: "var(--color-border)" }}
    >
      <p className="text-[16px] font-semibold text-[var(--color-text-strong)]">
        {title}
      </p>
      <p className="text-[13px] text-[var(--color-text-muted)]">{desc}</p>
    </Link>
  );
}
