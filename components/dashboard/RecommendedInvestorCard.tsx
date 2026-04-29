import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/common/Chip";
import { MatchScore } from "@/components/common/MatchScore";
import { formatCheckRange, type SampleInvestor } from "@/lib/dashboards/mock-data";

type RecommendedInvestorCardProps = {
  investor: SampleInvestor;
  className?: string;
};

export function RecommendedInvestorCard({ investor, className }: RecommendedInvestorCardProps) {
  return (
    <article
      aria-label={`${investor.name}, ${Math.round(investor.score)} percent match`}
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
          "bg-[var(--color-brand-tint)] text-[var(--color-brand)]",
        )}
      >
        {investor.initials}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h4 className="text-[14px] leading-5 font-semibold tracking-tight text-[var(--color-text)] truncate">
            {investor.name}
          </h4>
          <span className="shrink-0 text-[12px] leading-4 text-[var(--color-text-faint)]">
            {investor.firm}
          </span>
        </div>
        <p className="mt-0.5 text-[12px] leading-4 text-[var(--color-text-muted)] truncate">
          {investor.location}
        </p>
      </div>

      <ul className="hidden sm:flex shrink-0 items-center gap-1">
        {investor.sectors.slice(0, 2).map((s) => (
          <li key={s}>
            <Chip>{s}</Chip>
          </li>
        ))}
      </ul>

      <dl className="hidden md:grid shrink-0 grid-cols-2 gap-x-4 text-[12px] leading-4">
        <div className="text-center">
          <dt className="text-[var(--color-text-faint)]">Stage</dt>
          <dd className="mt-0.5 font-medium text-[var(--color-text)]">{investor.stages.join(", ")}</dd>
        </div>
        <div className="text-center">
          <dt className="text-[var(--color-text-faint)]">Check</dt>
          <dd className="mt-0.5 font-medium text-[var(--color-text)] tabular-nums font-mono">
            {formatCheckRange(investor.checkMin, investor.checkMax)}
          </dd>
        </div>
      </dl>

      <MatchScore score={investor.score} reason={investor.reason} size="sm" className="shrink-0" />

      <div className="shrink-0 flex items-center gap-1">
        <button
          type="button"
          aria-label={`Save ${investor.name}`}
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
          href={`/investors/${investor.id}` as Route}
          className={cn(
            "inline-flex items-center gap-1",
            "h-8 px-3 rounded-none",
            "text-[13px] font-medium text-white",
            "transition-colors duration-[120ms] ease-out",
          )}
          style={{ backgroundColor: "var(--color-brand)" }}
        >
          View
          <ArrowRight aria-hidden size={12} strokeWidth={1.75} />
        </Link>
      </div>
    </article>
  );
}
