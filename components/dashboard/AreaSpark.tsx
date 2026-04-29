import { cn } from "@/lib/utils";
import type { SeriesPoint } from "@/lib/dashboards/mock-data";

type AreaSparkProps = {
  series: SeriesPoint[];
  height?: number;
  ariaLabel?: string;
  className?: string;
};

const PADDING_X = 4;
const PADDING_Y = 6;
const VIEWBOX_WIDTH = 480;

export function AreaSpark({
  series,
  height = 96,
  ariaLabel,
  className,
}: AreaSparkProps) {
  if (series.length < 2) return null;

  const ys = series.map((p) => p.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const range = max - min || 1;

  const innerW = VIEWBOX_WIDTH - PADDING_X * 2;
  const innerH = height - PADDING_Y * 2;

  const points = series.map((p, i) => {
    const x = PADDING_X + (i / (series.length - 1)) * innerW;
    const y = PADDING_Y + innerH - ((p.y - min) / range) * innerH;
    return { x, y, label: p.x, value: p.y };
  });

  const linePath = points
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`)
    .join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(
    height - PADDING_Y
  ).toFixed(2)} L ${points[0].x.toFixed(2)} ${(height - PADDING_Y).toFixed(2)} Z`;

  const baselineY = height - PADDING_Y + 0.5;

  const summary =
    ariaLabel ??
    `Trend from ${points[0].value} to ${points[points.length - 1].value}.`;

  return (
    <figure className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={summary}
        className="block w-full"
        style={{ height }}
      >
        <line
          x1={PADDING_X}
          x2={VIEWBOX_WIDTH - PADDING_X}
          y1={baselineY}
          y2={baselineY}
          stroke="var(--color-border)"
          strokeWidth={1}
        />
        <path
          d={areaPath}
          opacity={0.18}
          style={{ fill: "var(--color-brand)" }}
        />
        <path
          d={linePath}
          fill="none"
          strokeWidth={1.75}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ stroke: "var(--color-brand)" }}
        />
      </svg>
      <figcaption className="mt-1 flex items-center justify-between text-[11px] leading-4 text-[var(--color-text-faint)] tabular-nums">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </figcaption>
    </figure>
  );
}
