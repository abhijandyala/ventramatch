"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowRight, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/common/Chip";
import { MatchScore } from "@/components/common/MatchScore";
import { formatUsd, type SampleStartup } from "@/lib/dashboards/mock-data";

type StartupCardProps = {
  startup: SampleStartup;
  className?: string;
};

export function StartupCard({ startup, className }: StartupCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const focused = params.get("focus") === startup.id;

  const focusThis = () => {
    const next = new URLSearchParams(Array.from(params.entries()));
    next.set("focus", startup.id);
    router.replace(`${pathname}?${next.toString()}` as Route, { scroll: false });
  };

  return (
    <article
      aria-label={`${startup.name}, ${Math.round(startup.score)} percent match`}
      aria-current={focused ? "true" : undefined}
      onClick={focusThis}
      className={cn(
        "group relative grid grid-cols-[auto_1fr_auto] items-start gap-5 p-5",
        "border rounded-none",
        "bg-[var(--color-surface)]",
        "transition-colors duration-[120ms] ease-out",
        "cursor-pointer",
        focused
          ? "border-[var(--color-brand-ink)] bg-[var(--color-surface-2)]"
          : "border-[var(--color-border)] hover:bg-[var(--color-surface-2)]",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex items-center justify-center",
          "w-10 h-10 rounded-none",
          "text-[14px] font-semibold tracking-tight",
          "bg-[var(--color-brand-tint)] text-[var(--color-brand-ink)]",
        )}
      >
        {startup.initials}
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h4 className="text-[16px] leading-6 font-semibold tracking-[-0.01em] text-[var(--color-text)]">
            {startup.name}
          </h4>
          <span className="text-[12px] leading-4 text-[var(--color-text-faint)]">
            {startup.location}
          </span>
        </div>

        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {startup.sectors.map((sector) => (
            <li key={sector}>
              <Chip>{sector}</Chip>
            </li>
          ))}
        </ul>

        <p className="mt-3 max-w-[60ch] text-[13px] leading-5 text-[var(--color-text-muted)]">
          {startup.oneLiner}
        </p>

        <dl className="mt-4 grid grid-cols-3 gap-x-6 gap-y-1 text-[13px] leading-5">
          <Metric label="Stage" value={startup.stage} />
          <Metric label="Ask" value={formatUsd(startup.ask)} />
          <Metric label="MRR" value={formatUsd(startup.mrr)} />
        </dl>
      </div>

      <div className="flex flex-col items-end gap-3">
        <MatchScore score={startup.score} reason={startup.reason} />

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`Save ${startup.name}`}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "inline-flex items-center justify-center h-8 w-8",
              "rounded-none",
              "text-[var(--color-text-muted)]",
              "transition-colors duration-[120ms] ease-out",
              "hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]",
            )}
          >
            <Bookmark aria-hidden size={14} strokeWidth={1.75} />
          </button>
        </div>

        <Link
          href={`/startups/${startup.id}` as Route}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center gap-1",
            "h-8 px-3 rounded-none",
            "text-[13px] font-medium text-white",
            "bg-[var(--color-brand-ink)]",
            "transition-colors duration-[120ms] ease-out",
            "hover:bg-[var(--color-brand-ink-hov)]",
          )}
        >
          View details
          <ArrowRight aria-hidden size={12} strokeWidth={1.75} />
        </Link>

        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "text-[12px] leading-4 font-medium",
            "text-[var(--color-text-faint)]",
            "transition-colors duration-[120ms] ease-out",
            "hover:text-[var(--color-text-muted)]",
          )}
        >
          Pass
        </button>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] leading-4 text-[var(--color-text-faint)]">{label}</dt>
      <dd className="font-mono text-[13px] leading-5 tabular-nums text-[var(--color-text)]">
        {value}
      </dd>
    </div>
  );
}
