import { cn } from "@/lib/utils";
import { Chip } from "@/components/common/Chip";
import { MatchScore } from "@/components/common/MatchScore";
import { formatCheckRange, type SampleInvestor } from "@/lib/dashboards/mock-data";

type InvestorCardProps = {
  investor: SampleInvestor;
  density?: "comfortable" | "compact";
  className?: string;
};

export function InvestorCard({
  investor,
  density = "comfortable",
  className,
}: InvestorCardProps) {
  const padding = density === "compact" ? "p-5" : "p-6";

  return (
    <article
      aria-label={`${investor.name}, ${Math.round(investor.score)} percent match`}
      className={cn(
        "group relative flex flex-col h-full",
        padding,
        "border border-[var(--color-border)]",
        "rounded-none",
        "bg-[var(--color-surface)]",
        "transition-colors duration-[120ms] ease-out",
        "hover:bg-[var(--color-surface-2)] hover:border-[var(--color-text-faint)]",
        className,
      )}
    >
      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "shrink-0 inline-flex items-center justify-center",
            "w-10 h-10 rounded-none",
            "text-[13px] font-semibold tracking-tight",
            "bg-[var(--color-brand-tint)] text-[var(--color-brand-ink)]",
          )}
        >
          {investor.initials}
        </span>

        <div className="flex-1 min-w-0">
          <h4 className="text-[15px] leading-5 font-semibold tracking-[-0.01em] text-[var(--color-text)]">
            {investor.name}
          </h4>
          <p className="mt-0.5 text-[12px] leading-4 text-[var(--color-text-muted)]">
            {investor.firm}
            <span className="text-[var(--color-text-faint)]">{` · ${investor.location}`}</span>
          </p>
        </div>

        <MatchScore
          score={investor.score}
          reason={investor.reason}
          className="shrink-0"
        />
      </header>

      <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px] leading-5">
        <dt className="text-[var(--color-text-faint)]">Stage</dt>
        <dd className="text-[var(--color-text)]">{investor.stages.join(", ")}</dd>
        <dt className="text-[var(--color-text-faint)]">Check</dt>
        <dd className="text-[var(--color-text)] tabular-nums">
          {formatCheckRange(investor.checkMin, investor.checkMax)}
        </dd>
        <dt className="text-[var(--color-text-faint)]">Geography</dt>
        <dd className="text-[var(--color-text)]">{investor.geographies.join(", ")}</dd>
      </dl>

      <ul className="mt-4 flex flex-wrap gap-1.5">
        {investor.sectors.map((sector) => (
          <li key={sector}>
            <Chip>{sector}</Chip>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-[13px] leading-5 text-[var(--color-text-muted)]">
        {investor.reason}
      </p>

      <footer className="mt-5 flex flex-col gap-3 pt-4 border-t border-[var(--color-border)]">
        <span className="inline-flex items-center gap-2 text-[12px] leading-4 text-[var(--color-text-muted)]">
          <span
            aria-hidden
            className={cn(
              "block w-1.5 h-1.5 rounded-full",
              investor.isActive
                ? "bg-[var(--color-success)]"
                : "bg-[var(--color-border)]",
            )}
          />
          {investor.activityLabel}
        </span>

        <div className="flex items-center justify-between gap-3 text-[13px] leading-5">
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center",
              "h-8 px-3 rounded-none",
              "font-medium text-white",
              "bg-[var(--color-brand-ink)]",
              "transition-colors duration-[120ms] ease-out",
              "hover:bg-[var(--color-brand-ink-hov)]",
            )}
          >
            Interested
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              Save
            </button>
            <span aria-hidden className="text-[var(--color-text-faint)]">
              ·
            </span>
            <button
              type="button"
              className="text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]"
            >
              Pass
            </button>
          </div>
        </div>
      </footer>
    </article>
  );
}
