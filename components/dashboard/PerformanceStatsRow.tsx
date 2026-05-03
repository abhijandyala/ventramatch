import type { Stat } from "@/lib/dashboards/mock-data";

/**
 * Row of 4 KPI stat cards with delta badges. Pure server component, no JS.
 * Uses the Stat type from mock-data (which will be the same shape for real
 * data once wired).
 */
export function PerformanceStatsRow({
  stats,
  title = "Performance this month",
}: {
  stats: [Stat, Stat, Stat, Stat];
  title?: string;
}) {
  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="flex items-baseline justify-between gap-2 border-b border-[var(--color-border)] px-5 pt-5 pb-3">
        <h3 className="text-[13px] font-semibold tracking-tight text-[var(--color-text)]">
          {title}
        </h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[var(--color-border)]">
        {stats.map((stat) => (
          <div key={stat.label} className="px-5 py-5">
            <p className="text-[11px] tracking-wide uppercase text-[var(--color-text-faint)]">
              {stat.label}
            </p>
            <p className="mt-2 font-mono text-[22px] font-semibold tabular-nums leading-none text-[var(--color-text-strong)]">
              {stat.value.toLocaleString()}
            </p>
            {stat.delta && (
              <span
                className="mt-2 inline-flex items-center gap-0.5 font-mono text-[10px] font-bold tabular-nums"
                style={{
                  color:
                    stat.delta.trend === "up"
                      ? "var(--color-brand)"
                      : stat.delta.trend === "down"
                        ? "var(--color-danger)"
                        : "var(--color-text-faint)",
                }}
              >
                {stat.delta.trend === "up" ? "+" : stat.delta.trend === "down" ? "-" : ""}
                {stat.delta.value}%
                <span className="ml-1 font-normal text-[var(--color-text-faint)]">
                  {stat.delta.periodLabel}
                </span>
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
