import type { Route } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { Wordmark } from "@/components/landing/wordmark";

const NAV = [
  { label: "Users", href: "/admin/users" },
  { label: "Reports", href: "/admin/reports" },
  { label: "Duplicates", href: "/admin/duplicates" },
  { label: "Metrics", href: "/admin/metrics" },
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { adminRole } = await requireAdmin("reviewer");

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-text)]">
      <header className="flex h-14 items-center justify-between border-b border-[var(--color-border)] px-5 md:px-8">
        <div className="flex items-center gap-4">
          <Wordmark size="sm" />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-faint)]">
            Admin · {adminRole}
          </span>
        </div>
        <nav className="flex items-center gap-4">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href as Route}
              className="text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
            >
              {n.label}
            </Link>
          ))}
          <Link
            href={"/dashboard" as Route}
            className="text-[12px] text-[var(--color-text-faint)] transition-colors hover:text-[var(--color-text-strong)]"
          >
            ← App
          </Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
