import { cn } from "@/lib/utils";
import { MatchScore } from "@/components/common/MatchScore";
import type { SampleInvestor } from "@/lib/dashboards/mock-data";

type RecommendedRowProps = {
  investor: SampleInvestor;
  className?: string;
};

export function RecommendedRow({ investor, className }: RecommendedRowProps) {
  return (
    <article
      className={cn(
        "group flex items-center gap-3 p-3",
        "border border-[var(--color-border)]",
        "rounded-none",
        "bg-[var(--color-surface)]",
        "transition-colors duration-[120ms] ease-out",
        "hover:bg-[var(--color-surface-2)]",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "shrink-0 inline-flex items-center justify-center",
          "w-8 h-8 rounded-none",
          "text-[12px] font-semibold tracking-tight",
          "bg-[var(--color-brand-tint)] text-[var(--color-brand-ink)]",
        )}
      >
        {investor.initials}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] leading-5 font-semibold tracking-tight text-[var(--color-text)] truncate">
          {investor.name}
        </p>
        <p className="text-[12px] leading-4 text-[var(--color-text-faint)] truncate">
          {investor.firm}
        </p>
      </div>
      <MatchScore score={investor.score} reason={investor.reason} size="sm" />
    </article>
  );
}
