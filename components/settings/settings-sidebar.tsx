"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SETTINGS_NAV_GROUPS } from "./nav";

export function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-full flex-col">
      <nav
        className="sticky top-14 flex flex-col gap-0 px-3 pt-5 pb-6"
        aria-label="Settings sections"
      >
        {SETTINGS_NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={cn("flex flex-col", gi > 0 && "mt-4")}>
            {/* Group label */}
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
              {group.label}
            </p>

            {/* Nav items */}
            {group.items.map((s) => {
              const isActive =
                pathname === s.href || pathname.startsWith(s.href + "/");
              const isDanger = s.href === "/settings/danger";

              return (
                <Link
                  key={s.href}
                  href={s.href as Route}
                  className={cn(
                    "flex items-center border-l-2 px-3 py-[6px] text-[13px] font-medium transition-colors",
                    isActive
                      ? isDanger
                        ? "border-[var(--color-danger)] bg-[#fff1f2] text-[var(--color-danger)]"
                        : "border-[var(--color-brand)] bg-[var(--color-brand-tint)] text-[var(--color-brand-strong)]"
                      : isDanger
                        ? "border-transparent text-[var(--color-danger)] opacity-70 hover:border-[#fca5a5] hover:bg-[#fff1f2] hover:opacity-100"
                        : "border-transparent text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-strong)]",
                  )}
                >
                  {s.label}
                </Link>
              );
            })}
          </div>
        ))}

        {/* Back link */}
        <div className="mt-6 px-2">
          <Link
            href={"/dashboard" as Route}
            className="text-[12px] text-[var(--color-text-faint)] transition-colors hover:text-[var(--color-text-strong)]"
          >
            ← Dashboard
          </Link>
        </div>
      </nav>
    </aside>
  );
}
