"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/landing/wordmark";
import { Avatar } from "@/components/profile/avatar";

type Role = "founder" | "investor" | null;

export type ProductNavProps = {
  role: Role;
  name: string;
  userId?: string;
  avatarSrc?: string | null;
};

function navLinks(role: Role): Array<{ label: string; href: string }> {
  const profileHref = role === "investor" ? "/build/investor" : "/build";
  return [
    { label: "Homepage", href: "/homepage" },
    { label: "Feed", href: "/feed" },
    { label: "Matches", href: "/matches" },
    { label: "Profile", href: profileHref },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Settings", href: "/settings" },
  ];
}

export function ProductNav({ role, name, userId, avatarSrc }: ProductNavProps) {
  const pathname = usePathname();
  const links = navLinks(role);

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--color-bg)]/70">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Wordmark size="md" asLink={false} />
          <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
            {links.map((link) => {
              const active =
                pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href as Route}
                  className={cn(
                    "text-[14px] transition-colors duration-[120ms]",
                    active
                      ? "font-semibold text-[var(--color-text)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {role && (
            <span className="hidden rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2.5 py-0.5 text-[12px] font-medium capitalize text-[color:var(--color-text-muted)] sm:inline-flex">
              {role}
            </span>
          )}
          <Link
            href={"/dashboard" as Route}
            aria-label="Go to dashboard"
            className="flex h-9 w-9 shrink-0 items-center justify-center transition-opacity duration-[120ms] hover:opacity-75"
          >
            <Avatar
              id={userId ?? name ?? "vm"}
              name={name}
              src={avatarSrc}
              size="sm"
            />
          </Link>
        </div>
      </div>
    </header>
  );
}
