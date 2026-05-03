"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SETTINGS_NAV } from "./nav";

export function SettingsMobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings sections"
      className="sticky top-0 z-20 flex overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 scrollbar-none lg:hidden"
    >
      {SETTINGS_NAV.map((s) => {
        const isActive = pathname === s.href || pathname.startsWith(s.href + "/");
        return (
          <Link
            key={s.href}
            href={s.href as Route}
            className={cn(
              "shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-[12.5px] font-medium transition-colors",
              isActive
                ? "border-[var(--color-text-strong)] text-[var(--color-text-strong)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]",
            )}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
