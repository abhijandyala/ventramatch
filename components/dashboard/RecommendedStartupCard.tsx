import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/common/Chip";
import { MatchScore } from "@/components/common/MatchScore";
import { formatUsd, type SampleStartup } from "@/lib/dashboards/mock-data";

type RecommendedStartupCardProps = {
  startup: SampleStartup;
  className?: string;
};

export function RecommendedStartupCard({ startup, className }: RecommendedStartupCardProps) {
  return (
    <article
      aria-label={`${startup.name}, ${Math.round(startup.score)} percent match`}
      className={cn(
        "group flex items-center gap-4 p-4",
        "border border-[var(--color-border)]",
        "rounded-none",
        "bg-[var(--color-surface)]",
        "transition-colors duration-[120ms] ease-out",
        "hover:bg-[var(--color-surface-2)] hover:border-[var(--color-text-faint)]",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "shrink-0 inline-flex items-center justify-center",
          "w-10 h-10 rounded-none",
          "text-[13px] font-semibold tracking-tight",
          "bg-[var(--color-brand-tint)] text-[var(--color-brand-ink)]",
        )}
      >
        {startup.initials}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h4 className="text-[14px] leading-5 font-semibold tracking-tight text-[var(--color-text)] truncate">
            {startup.name}
          </h4>
          <span className="shrink-0 text-[12px] leading-4 text-[var(--color-text-faint)]">
            {startup.location}
          </span>
        </div>
        <p className="mt-0.5 text-[12px] leading-4 text-[var(--color-text-muted)] truncate">
          {startup.oneLiner}
        </p>
      </div>

      <ul className="hidden sm:flex shrink-0 items-center gap-1">
        {startup.sectors.slice(0, 2).map((s) => (
          <li key={s}>
            <Chip>{s}</Chip>
          </li>
        ))}
      </ul>

      <dl className="hidden md:grid shrink-0 grid-cols-3 gap-x-4 text-[12px] leading-4">
        <div className="text-center">
          <dt className="text-[var(--color-text-faint)]">Stage</dt>
          <dd className="mt-0.5 font-medium text-[var(--color-text)]">{startup.stage}</dd>
        </div>
        <div className="text-center">
          <dt className="text-[var(--color-text-faint)]">Ask</dt>
          <dd className="mt-0.5 font-medium text-[var(--color-text)] tabular-nums font-mono">
            {formatUsd(startup.ask)}
          </dd>
        </div>
        <div className="text-center">
          <dt className="text-[var(--color-text-faint)]">MRR</dt>
          <dd className="mt-0.5 font-medium text-[var(--color-text)] tabular-nums font-mono">
            {formatUsd(startup.mrr)}
          </dd>
        </div>
      </dl>

      <MatchScore score={startup.score} reason={startup.reason} size="sm" className="shrink-0" />

      <div className="shrink-0 flex items-center gap-1">
        <button
          type="button"
          aria-label={`Save ${startup.name}`}
          className={cn(
            "inline-flex items-center justify-center",
            "h-8 w-8 rounded-none",
            "text-[var(--color-text-faint)]",
            "transition-colors duration-[120ms] ease-out",
            "hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]",
          )}
        >
          <Bookmark size={14} strokeWidth={1.75} />
        </button>
        <Link
          href={`/startups/${startup.id}` as Route}
          className={cn(
            "inline-flex items-center gap-1",
            "h-8 px-3 rounded-none",
            "text-[13px] font-medium text-white",
            "bg-[var(--color-brand-ink)]",
            "transition-colors duration-[120ms] ease-out",
            "hover:bg-[var(--color-brand-ink-hov)]",
          )}
        >
          View
          <ArrowRight aria-hidden size={12} strokeWidth={1.75} />
        </Link>
      </div>
    </article>
  );
}
