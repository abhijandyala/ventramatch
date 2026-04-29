"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/common/Chip";
import { MatchScore } from "@/components/common/MatchScore";
import {
  formatUsd,
  type SampleStartup,
} from "@/lib/dashboards/mock-data";

type TopStartupCardProps = {
  /** Full ranked list of startups; the carousel walks them in order. */
  startups: SampleStartup[];
  /** Currently focused startup id, derived server-side from ?focus= or defaulted. */
  focusedId: string;
  /** "X new startups today" indicator beside the section header. */
  newToday: number;
};

export function TopStartupCard({ startups, focusedId, newToday }: TopStartupCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const safeIndex = Math.max(
    0,
    startups.findIndex((s) => s.id === focusedId),
  );
  const startup = startups[safeIndex] ?? startups[0];

  const setFocus = (id: string) => {
    const next = new URLSearchParams(Array.from(params.entries()));
    next.set("focus", id);
    router.replace(`${pathname}?${next.toString()}` as Route, { scroll: false });
  };

  const go = (delta: number) => {
    const len = startups.length;
    if (len < 2) return;
    const nextIndex = (safeIndex + delta + len) % len;
    setFocus(startups[nextIndex].id);
  };

  const hasMultiple = startups.length > 1;

  return (
    <section aria-labelledby="top-startup-title" className="flex flex-col gap-4">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2
          id="top-startup-title"
          className="text-[16px] leading-6 font-semibold tracking-tight text-[var(--color-text)]"
        >
          Top match for you
        </h2>
        <p className="text-[13px] leading-5 text-[var(--color-text-muted)]">
          Highest scoring startup in your active filters.
        </p>
        <span
          aria-label={`${newToday} new startups today`}
          className="ml-auto inline-flex items-center gap-2 text-[13px] leading-5 text-[var(--color-text-muted)] tabular-nums"
        >
          <span
            aria-hidden
            className="block w-1.5 h-1.5 rounded-full bg-[var(--color-success)]"
          />
          {newToday} new startups today
        </span>
      </header>

      <article
        aria-label={`Top startup: ${startup.name}, ${Math.round(startup.score)} percent match`}
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

        <div className="relative px-5 pt-5 pb-5 sm:px-8 sm:pt-7 sm:pb-6">
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
              {startup.initials}
            </span>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h3 className="text-[20px] leading-7 font-semibold tracking-[-0.015em] text-[var(--color-text)]">
                  {startup.name}
                </h3>
                {startup.verified && (
                  <span
                    title={`Verified via ${startup.verified.source}`}
                    className="inline-flex items-center gap-1 text-[12px] leading-4 font-medium text-[var(--color-brand)]"
                  >
                    <ShieldCheck aria-hidden size={14} strokeWidth={1.75} />
                    {startup.verified.label}
                  </span>
                )}
                <MatchScore
                  score={startup.score}
                  reason={startup.reason}
                  className="ml-auto sm:ml-2"
                />
              </div>
              <p className="mt-1 text-[13px] leading-5 text-[var(--color-text-muted)]">
                {startup.oneLiner}
                <span className="text-[var(--color-text-faint)]">
                  {` · ${startup.location}`}
                </span>
              </p>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
            <Detail label="Stage" value={startup.stage} />
            <Detail label="Ask" value={formatUsd(startup.ask)} mono />
            <Detail label="MRR" value={formatUsd(startup.mrr)} mono />
            <Detail
              label="Growth (MoM)"
              value={startup.growthMoM != null ? `${startup.growthMoM}%` : "—"}
              mono
            />
          </dl>

          <div className="mt-5">
            <p className="text-[11px] leading-4 font-medium tracking-[0.04em] uppercase text-[var(--color-text-faint)]">
              Why it&apos;s a great match
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {startup.whyMatchChips.map((chip) => (
                <li key={chip}>
                  <Chip>{chip}</Chip>
                </li>
              ))}
            </ul>
          </div>

          {startup.description && (
            <p className="mt-5 text-[13px] leading-5 text-[var(--color-text-muted)] max-w-[70ch]">
              {startup.description}
            </p>
          )}

          {/* TODO(handoff): Interested navigates to the startup detail page where the
              investor confirms intent. The actual match action (mutual interest unlock)
              fires from that detail page, not from here. Pass is a soft dismiss. */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 pt-5 border-t border-[var(--color-border)]">
            <Link
              href={`/startups/${startup.id}` as Route}
              className={cn(
                "inline-flex items-center justify-center gap-1.5",
                "h-10 px-5",
                "rounded-none",
                "text-[14px] font-semibold text-white",
                "bg-[var(--color-brand)]",
                "transition-colors duration-[120ms] ease-out",
                "hover:bg-[var(--color-brand-strong)]",
              )}
            >
              Interested
              <ArrowRight aria-hidden size={14} strokeWidth={1.75} />
            </Link>
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
          </div>

          {hasMultiple && (
            <div className="mt-5 flex items-center justify-center gap-3">
              <PaginationArrow side="left" onClick={() => go(-1)} />
              <div className="flex items-center gap-1.5">
                {startups.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setFocus(s.id)}
                    aria-label={`Show match ${i + 1} of ${startups.length}`}
                    aria-current={i === safeIndex ? "true" : undefined}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-[180ms] ease-out",
                      i === safeIndex
                        ? "w-6 bg-[var(--color-brand)]"
                        : "w-1.5 bg-[var(--color-border)] hover:bg-[var(--color-text-faint)]",
                    )}
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

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[12px] leading-4 text-[var(--color-text-faint)]">{label}</dt>
      <dd
        className={cn(
          "text-[14px] leading-5 font-medium text-[var(--color-text)]",
          mono && "font-mono tabular-nums",
        )}
      >
        {value}
      </dd>
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
        "bg-[var(--color-bg)] text-[var(--color-text-muted)]",
        "transition-colors duration-[120ms] ease-out",
        "hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] hover:border-[var(--color-text-faint)]",
        "focus-visible:outline-none",
      )}
    >
      <Icon aria-hidden size={14} strokeWidth={1.75} />
    </button>
  );
}
