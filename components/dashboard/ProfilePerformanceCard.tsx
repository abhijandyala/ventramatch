import { StatBlock } from "./StatBlock";
import { AreaSpark } from "./AreaSpark";
import type { SeriesPoint, Stat } from "@/lib/dashboards/mock-data";

type ProfilePerformanceCardProps = {
  stats: [Stat, Stat, Stat, Stat];
  series: SeriesPoint[];
  borderless?: boolean;
};

export function ProfilePerformanceCard({ stats, series, borderless = false }: ProfilePerformanceCardProps) {
  const inner = (
    <>
      <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <StatBlock
            key={stat.label}
            label={stat.label}
            value={stat.value}
            delta={stat.delta}
            size="sm"
          />
        ))}
      </div>
      <AreaSpark
        series={series}
        ariaLabel="Profile views over the last 8 weeks, trending up."
        className="mt-5"
      />
    </>
  );

  if (borderless) {
    return <div>{inner}</div>;
  }

  return (
    <section
      aria-labelledby="profile-perf-title"
      className="rounded-none border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <h3
        id="profile-perf-title"
        className="text-[14px] leading-5 font-semibold tracking-tight text-[var(--color-text)] mb-4"
      >
        Profile performance
        <span className="ml-2 text-[12px] leading-4 font-normal text-[var(--color-text-faint)]">
          (this month)
        </span>
      </h3>
      {inner}
    </section>
  );
}
