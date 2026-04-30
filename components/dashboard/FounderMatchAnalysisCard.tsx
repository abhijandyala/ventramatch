import { Disclaimer } from "@/components/common/Disclaimer";
import { RadarChart, type RadarAxis } from "@/components/dashboard/RadarChart";
import type { SampleInvestor } from "@/lib/dashboards/mock-data";

type FounderMatchAnalysisCardProps = {
  investor: SampleInvestor;
  /** When true, omits the outer card border/padding (used inside a combined card). */
  borderless?: boolean;
};

type Axis = { label: string; key: string; weight: number; value: number };

const AXES_META: Omit<Axis, "value">[] = [
  { label: "Sector", key: "sector", weight: 30 },
  { label: "Stage", key: "stage", weight: 25 },
  { label: "Check size", key: "check", weight: 20 },
  { label: "Geography", key: "geography", weight: 15 },
  { label: "Traction", key: "traction", weight: 10 },
];

function getAxes(investor: SampleInvestor): Axis[] {
  const bd = investor.breakdown ?? {
    sector: 0, stage: 0, check: 0, geography: 0, traction: 0,
  };
  return AXES_META.map((a) => ({
    ...a,
    value: (bd as Record<string, number>)[a.key] ?? 0,
  }));
}

function toRadarAxes(axes: Axis[]): RadarAxis[] {
  return axes.map((a) => ({
    key: `${a.key}_match`,
    label: a.label,
    weight: a.weight,
    value: a.value,
  }));
}

function buildAnalysis(investor: SampleInvestor): string {
  const axes = getAxes(investor);
  const perfect: string[] = [];
  const partial: string[] = [];
  const weak: string[] = [];

  for (const a of axes) {
    if (a.value >= 0.9) perfect.push(a.label.toLowerCase());
    else if (a.value >= 0.5) partial.push(a.label.toLowerCase());
    else weak.push(a.label.toLowerCase());
  }

  const parts: string[] = [];
  if (perfect.length > 0) parts.push(`Full match on ${joinList(perfect)}.`);
  if (partial.length > 0) parts.push(`Partial on ${joinList(partial)}.`);
  if (weak.length > 0) {
    parts.push(
      `${joinList(weak, true)} ${weak.length === 1 ? "is" : "are"} the weakest axis.`,
    );
  }
  return parts.join(" ");
}

function joinList(items: string[], capitalize = false): string {
  const result =
    items.length <= 2
      ? items.join(" and ")
      : `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
  if (capitalize && result.length > 0) {
    return result.charAt(0).toUpperCase() + result.slice(1);
  }
  return result;
}

export function FounderMatchAnalysisCard({
  investor,
  borderless = false,
}: FounderMatchAnalysisCardProps) {
  const analysis = buildAnalysis(investor);
  const axes = getAxes(investor);
  const radarAxes = toRadarAxes(axes);

  const inner = (
    <>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[28px] leading-8 font-semibold tabular-nums text-[var(--color-text)]">
          {investor.score}%
        </span>
        <span className="text-[13px] leading-5 text-[var(--color-text-muted)]">
          match score
        </span>
      </div>

      <p className="mt-3 text-[13px] leading-5 text-[var(--color-text-muted)]">
        {analysis}
      </p>

      <RadarChart
        axes={radarAxes}
        size={180}
        ariaLabel={`Match breakdown for ${investor.name}.`}
        className="mt-4 self-center"
      />

      <dl className="mt-4 flex flex-col gap-2.5">
        {axes.map((axis) => {
          const pct = Math.round(axis.value * 100);
          return (
            <div key={axis.key} className="flex items-center gap-3">
              <dt className="w-[72px] shrink-0 text-[12px] leading-4 text-[var(--color-text-faint)]">
                {axis.label}
              </dt>
              <div className="flex-1 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: "var(--color-brand)",
                    opacity: pct >= 80 ? 1 : pct >= 50 ? 0.7 : 0.4,
                  }}
                />
              </div>
              <dd className="w-[40px] shrink-0 text-right font-mono text-[12px] leading-4 tabular-nums text-[var(--color-text)]">
                {pct}%
              </dd>
              <dd className="w-[28px] shrink-0 text-right font-mono text-[11px] leading-4 tabular-nums text-[var(--color-text-faint)]">
                {axis.weight}%
              </dd>
            </div>
          );
        })}
      </dl>

      <p className="mt-4 text-[12px] leading-4 text-[var(--color-text-faint)]">
        Updates when you browse a different investor.
      </p>

      <Disclaimer className="mt-3" />
    </>
  );

  if (borderless) {
    return <div className="flex flex-col">{inner}</div>;
  }

  return (
    <section
      aria-labelledby="founder-match-analysis-title"
      className="rounded-none border border-[var(--color-border)] bg-[var(--color-surface)] p-5 flex flex-col h-full"
    >
      <header className="flex items-baseline justify-between mb-4">
        <h3
          id="founder-match-analysis-title"
          className="text-[14px] leading-5 font-semibold tracking-tight text-[var(--color-text)]"
        >
          Match analysis
        </h3>
        <span className="text-[12px] leading-4 font-medium text-[var(--color-text-faint)]">
          {investor.name}
        </span>
      </header>
      {inner}
    </section>
  );
}
