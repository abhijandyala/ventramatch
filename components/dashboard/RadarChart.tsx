import { cn } from "@/lib/utils";

export type RadarAxis = {
  /** snake_case key from docs/matching-algorithm.md */
  key: string;
  /** Human label, e.g. "Sector" */
  label: string;
  /** Weight 0-100 (used as a small caption next to the axis label) */
  weight: number;
  /** Sub-score 0-1 from the matching engine */
  value: number;
};

type RadarChartProps = {
  axes: RadarAxis[];
  size?: number;
  ariaLabel?: string;
  className?: string;
};

const VIEWBOX = 320;

export function RadarChart({
  axes,
  size = 240,
  ariaLabel,
  className,
}: RadarChartProps) {
  if (axes.length < 3) return null;

  const cx = VIEWBOX / 2;
  const cy = VIEWBOX / 2;
  const radius = VIEWBOX / 2 - 56; // leave room for labels

  // Start at 12 o'clock, go clockwise.
  const angle = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / axes.length;

  const ringSteps = [0.25, 0.5, 0.75, 1];
  const rings = ringSteps.map((t) => buildPolygon(axes.length, cx, cy, radius * t, angle));

  const valuePoints = axes.map((a, i) => {
    const r = radius * Math.max(0, Math.min(1, a.value));
    return {
      x: cx + r * Math.cos(angle(i)),
      y: cy + r * Math.sin(angle(i)),
    };
  });
  const valuePath = valuePoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .concat("Z")
    .join(" ");

  const summary =
    ariaLabel ??
    `Match breakdown: ${axes
      .map((a) => `${a.label} ${Math.round(a.value * 100)} percent`)
      .join(", ")}.`;

  return (
    <figure className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        role="img"
        aria-label={summary}
        className="block mx-auto"
        style={{ width: size, height: size }}
      >
        {rings.map((points, i) => (
          <polygon
            key={i}
            points={pointsToString(points)}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={1}
          />
        ))}

        {axes.map((_, i) => {
          const x = cx + radius * Math.cos(angle(i));
          const y = cy + radius * Math.sin(angle(i));
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="var(--color-border)"
              strokeWidth={1}
            />
          );
        })}

        <path
          d={valuePath}
          fillOpacity={0.25}
          strokeWidth={1.75}
          strokeLinejoin="round"
          style={{
            fill: "var(--color-brand)",
            stroke: "var(--color-brand)",
          }}
        />

        {valuePoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3}
            style={{ fill: "var(--color-brand)" }}
          />
        ))}

        {axes.map((a, i) => {
          const labelR = radius + 22;
          const x = cx + labelR * Math.cos(angle(i));
          const y = cy + labelR * Math.sin(angle(i));
          const anchor: "start" | "middle" | "end" =
            x < cx - 4 ? "end" : x > cx + 4 ? "start" : "middle";
          return (
            <g key={a.key} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
              <text
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize="11"
                fontFamily="ui-monospace, SF Mono, Menlo, monospace"
                fill="var(--color-text-muted)"
                className="tabular-nums"
              >
                <tspan>{a.label}</tspan>
                <tspan
                  dx="6"
                  fill="var(--color-text-faint)"
                >{`${a.weight}%`}</tspan>
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function buildPolygon(
  n: number,
  cx: number,
  cy: number,
  r: number,
  angle: (i: number) => number,
): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => ({
    x: cx + r * Math.cos(angle(i)),
    y: cy + r * Math.sin(angle(i)),
  }));
}

function pointsToString(points: { x: number; y: number }[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}
