"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
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
  newToday: number;
};

export function TopMatchCard({ matches, newToday }: TopMatchCardProps) {
  const [index, setIndex] = useState(0);
  const safeIndex = Math.max(0, Math.min(matches.length - 1, index));
  const investor = matches[safeIndex];

  const go = (delta: number) => {
    const next = (safeIndex + delta + matches.length) % matches.length;
    setIndex(next);
  };

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

        <CarouselArrow side="left" onClick={() => go(-1)} disabled={matches.length < 2} />
        <CarouselArrow side="right" onClick={() => go(1)} disabled={matches.length < 2} />

        <div className="relative px-6 pt-7 pb-6 sm:px-10 sm:pt-9 sm:pb-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
            <div className="flex flex-1 min-w-0 flex-col">
              <div className="flex items-start gap-4">
                <span
                  aria-hidden
                  className={cn(
                    "shrink-0 inline-flex items-center justify-center",
                    "w-14 h-14 rounded-none",
                    "text-[18px] font-semibold tracking-tight",
                    "bg-[var(--color-brand-tint)] text-[var(--color-brand-ink)]",
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
                        className="inline-flex items-center gap-1 text-[12px] leading-4 font-medium text-[var(--color-brand-ink)]"
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
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                <Detail label="Check size" value={formatCheckRange(investor.checkMin, investor.checkMax)} />
                <Detail label="Stage" value={investor.stages.join(", ")} />
                <Detail label="Geography" value={investor.geographies[0]} />
                <Detail label="Focus" value={investor.sectors.join(", ")} />
              </dl>

              <div className="mt-6">
                <p className="text-[12px] leading-4 font-medium tracking-[0.04em] uppercase text-[var(--color-text-faint)]">
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
            </div>

            <aside className="flex shrink-0 flex-col gap-3 lg:w-[260px]">
              <button
                type="button"
                className={cn(
                  "inline-flex items-center justify-center gap-2",
                  "h-12 px-5 w-full",
                  "rounded-none",
                  "text-[15px] font-semibold text-white",
                  "bg-[var(--color-brand-ink)]",
                  "transition-colors duration-[120ms] ease-out",
                  "hover:bg-[var(--color-brand-ink-hov)]",
                )}
              >
                Interested
              </button>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center justify-center gap-2",
                  "h-12 px-5 w-full",
                  "rounded-none",
                  "border border-[var(--color-border)]",
                  "text-[15px] font-semibold text-[var(--color-text)]",
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
                  "inline-flex items-center justify-center gap-1.5",
                  "h-10 w-full",
                  "text-[13px] font-medium",
                  "text-[var(--color-brand-ink)]",
                  "transition-colors duration-[120ms] ease-out",
                  "hover:text-[var(--color-brand-ink-hov)]",
                )}
              >
                View profile
                <ArrowRight aria-hidden size={14} strokeWidth={1.75} />
              </Link>
            </aside>
          </div>

          {matches.length > 1 && (
            <div className="mt-8 flex items-center justify-center gap-1.5">
              {matches.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Show match ${i + 1} of ${matches.length}`}
                  aria-current={i === safeIndex ? "true" : undefined}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-[180ms] ease-out",
                    i === safeIndex
                      ? "w-6 bg-[var(--color-brand-ink)]"
                      : "w-1.5 bg-[var(--color-border)] hover:bg-[var(--color-text-faint)]",
                  )}
                />
              ))}
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

function CarouselArrow({
  side,
  onClick,
  disabled,
}: {
  side: "left" | "right";
  onClick: () => void;
  disabled?: boolean;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous match" : "Next match"}
      className={cn(
        "absolute top-1/2 z-10 -translate-y-1/2",
        side === "left" ? "left-3" : "right-3",
        "hidden sm:inline-flex items-center justify-center",
        "h-9 w-9 rounded-full",
        "border border-[var(--color-border)]",
        "bg-[var(--color-bg)] text-[var(--color-text-muted)]",
        "transition-colors duration-[120ms] ease-out",
        "hover:bg-[var(--color-surface)] hover:text-[var(--color-text)] hover:border-[var(--color-text-faint)]",
        "disabled:opacity-40 disabled:pointer-events-none",
      )}
    >
      <Icon aria-hidden size={16} strokeWidth={1.75} />
    </button>
  );
}
