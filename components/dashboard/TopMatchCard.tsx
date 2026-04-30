"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/common/Chip";
import { MatchScore } from "@/components/common/MatchScore";
import {
  formatCheckRange,
  type SampleInvestor,
} from "@/lib/dashboards/mock-data";

type TopMatchCardProps = {
  matches: SampleInvestor[];
  focusedId: string;
  newToday: number;
};

export function TopMatchCard({ matches, focusedId, newToday }: TopMatchCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const safeIndex = Math.max(
    0,
    matches.findIndex((m) => m.id === focusedId),
  );
  const investor = matches[safeIndex] ?? matches[0];

  const setFocus = (id: string) => {
    const next = new URLSearchParams(Array.from(params.entries()));
    next.set("focus", id);
    router.replace(`${pathname}?${next.toString()}` as Route, { scroll: false });
  };

  const go = (delta: number) => {
    const len = matches.length;
    if (len < 2) return;
    const nextIndex = (safeIndex + delta + len) % len;
    setFocus(matches[nextIndex].id);
  };

  const hasMultiple = matches.length > 1;

  return (
    <section
      aria-labelledby="top-match-title"
      className="flex flex-col gap-4"
    >
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2
          id="top-match-title"
          className="text-[16px] leading-6 font-semibold tracking-tight text-[var(--color-text)]"
        >
          Top match for you
        </h2>
        <p className="text-[13px] leading-5 text-[var(--color-text-muted)]">
          Great fit based on your profile and goals.
        </p>
        <span
          aria-label={`${newToday} new investors today`}
          className="ml-auto inline-flex items-center gap-2 text-[13px] leading-5 text-[var(--color-text-muted)] tabular-nums"
        >
          <span
            aria-hidden
            className="block w-1.5 h-1.5 rounded-full bg-[var(--color-success)]"
          />
          {newToday} new investors today
        </span>
      </header>

      <article
        aria-label={`Top match: ${investor.name}, ${Math.round(investor.score)} percent match`}
        className={cn(
          "relative overflow-hidden",
          "rounded-none",
          "border border-[var(--color-border)]",
          "bg-[var(--color-surface)]",
          "ring-1 ring-[var(--color-brand-tint)] ring-inset",
        )}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-40",
            "bg-[radial-gradient(70%_55%_at_18%_0%,var(--color-brand-tint)_0%,transparent_70%)]",
            "opacity-80",
          )}
        />

        <div className="relative px-6 pt-7 pb-6 sm:px-8 sm:pt-7 sm:pb-6">
          <div className="flex items-start gap-4">
            <span
              aria-hidden
              className={cn(
                "shrink-0 inline-flex items-center justify-center",
                "w-14 h-14 rounded-none",
                "text-[18px] font-semibold tracking-tight",
                "bg-[var(--color-brand-tint)] text-[var(--color-brand)]",
                "ring-1 ring-[var(--color-border)]",
              )}
            >
              {investor.initials}
            </span>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h3 className="text-[20px] leading-7 font-semibold tracking-[-0.015em] text-[var(--color-text)]">
                  {investor.name}
                </h3>
                {investor.verified && (
                  <span
                    title={`Verified via ${investor.verified.source}`}
                    className="inline-flex items-center gap-1 text-[12px] leading-4 font-medium"
                    style={{ color: "var(--color-brand)" }}
                  >
                    <ShieldCheck aria-hidden size={14} strokeWidth={1.75} />
                    {investor.verified.label}
                  </span>
                )}
                <MatchScore
                  score={investor.score}
                  reason={investor.reason}
                  className="ml-auto sm:ml-2"
                />
              </div>
              <p className="mt-1 text-[13px] leading-5 text-[var(--color-text-muted)]">
                {investor.firm}
                <span className="text-[var(--color-text-faint)]">
                  {` · ${investor.location}`}
                </span>
              </p>
              {investor.description && (
                <p className="mt-2 text-[13px] leading-5 text-[var(--color-text-muted)]">
                  {investor.description}
                </p>
              )}
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
            <Detail label="Check size" value={formatCheckRange(investor.checkMin, investor.checkMax)} />
            <Detail label="Stage" value={investor.stages.join(", ")} />
            <Detail label="Geography" value={investor.geographies[0]} />
            <Detail label="Focus" value={investor.sectors.join(", ")} />
          </dl>

          <div className="mt-5">
            <p className="text-[11px] leading-4 font-medium tracking-[0.04em] uppercase text-[var(--color-text-faint)]">
              Why it&apos;s a great match
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {investor.whyMatchChips.map((chip) => (
                <li key={chip}>
                  <Chip>{chip}</Chip>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 pt-5 border-t border-[var(--color-border)]">
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center gap-1.5",
                "h-10 px-5",
                "rounded-none",
                "text-[14px] font-semibold text-white",
                "transition-colors duration-[120ms] ease-out",
              )}
              style={{ backgroundColor: "var(--color-brand)" }}
            >
              Interested
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center gap-1.5",
                "h-10 px-5",
                "rounded-none",
                "border border-[var(--color-border)]",
                "text-[14px] font-medium text-[var(--color-text)]",
                "bg-[var(--color-bg)]",
                "transition-colors duration-[120ms] ease-out",
                "hover:bg-[var(--color-surface-2)] hover:border-[var(--color-text-faint)]",
              )}
            >
              Pass
            </button>
            <Link
              href={`/investors/${investor.id}` as Route}
              className={cn(
                "inline-flex items-center gap-1",
                "h-10 px-2",
                "text-[13px] font-medium",
                "transition-colors duration-[120ms] ease-out",
              )}
              style={{ color: "var(--color-brand)" }}
            >
              View profile
              <ArrowRight aria-hidden size={14} strokeWidth={1.75} />
            </Link>
          </div>

          {hasMultiple && (
            <div className="mt-5 flex items-center justify-center gap-3">
              <PaginationArrow side="left" onClick={() => go(-1)} />
              <div className="flex items-center gap-1.5">
                {matches.map((m, i) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setFocus(m.id)}
                    aria-label={`Show match ${i + 1} of ${matches.length}`}
                    aria-current={i === safeIndex ? "true" : undefined}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-[180ms] ease-out",
                      i === safeIndex
                        ? "w-6"
                        : "w-1.5 bg-[var(--color-border)] hover:bg-[var(--color-text-faint)]",
                    )}
                    style={i === safeIndex ? { backgroundColor: "var(--color-brand)" } : undefined}
                  />
                ))}
              </div>
              <PaginationArrow side="right" onClick={() => go(1)} />
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[12px] leading-4 text-[var(--color-text-faint)]">{label}</dt>
      <dd className="text-[14px] leading-5 font-medium text-[var(--color-text)]">{value}</dd>
    </div>
  );
}

function PaginationArrow({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous match" : "Next match"}
      className={cn(
        "inline-flex items-center justify-center",
        "h-7 w-7 rounded-full",
        "border border-[var(--color-border)]",
        "bg-[var(--color-surface)] text-[var(--color-text-muted)]",
        "transition-colors duration-[120ms] ease-out",
        "hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] hover:border-[var(--color-text-faint)]",
        "focus-visible:outline-none",
      )}
    >
      <Icon aria-hidden size={14} strokeWidth={1.75} />
    </button>
  );
}
