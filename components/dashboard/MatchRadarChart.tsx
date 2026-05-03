"use client";

/**
 * Pentagon-shaped match analysis radar chart.
 * Exactly 5 axes rendered as a clean pentagon with concentric grid rings,
 * a filled data polygon, and a bottom legend with scores.
 */

const SIZE = 280;
const CENTER = SIZE / 2;
const RADIUS = 105;
const LABEL_OFFSET = 22;
const RINGS = [0.2, 0.4, 0.6, 0.8, 1.0];
const N = 5;
const ANGLE_STEP = (2 * Math.PI) / N;
const START_ANGLE = -Math.PI / 2; // top vertex

type Axis = { label: string; value: number }; // 0-100

function polar(angle: number, r: number): [number, number] {
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

function pentagonPath(r: number): string {
  return Array.from({ length: N })
    .map((_, i) => {
      const [x, y] = polar(START_ANGLE + i * ANGLE_STEP, r);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ") + " Z";
}

export function MatchRadarChart({
  axes,
  title = "Match analysis",
}: {
  axes: [Axis, Axis, Axis, Axis, Axis];
  title?: string;
}) {
  const dataPoints = axes.map((a, i) => {
    const angle = START_ANGLE + i * ANGLE_STEP;
    return polar(angle, (a.value / 100) * RADIUS);
  });
  const dataPath = dataPoints.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ") + " Z";

  const axisEnds = axes.map((_, i) => polar(START_ANGLE + i * ANGLE_STEP, RADIUS));
  const labelPositions = axes.map((_, i) => polar(START_ANGLE + i * ANGLE_STEP, RADIUS + LABEL_OFFSET));

  const avg = Math.round(axes.reduce((s, a) => s + a.value, 0) / N);

  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-2 border-b border-[var(--color-border)] px-5 pt-5 pb-3">
        <h3 className="text-[13px] font-semibold tracking-tight text-[var(--color-text)]">
          {title}
        </h3>
        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-faint)]">
          Avg
          <span className="font-mono font-semibold text-[var(--color-text)]">{avg}</span>
        </span>
      </div>

      {/* Pentagon chart */}
      <div className="flex items-center justify-center px-6 py-7">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="block w-full"
          style={{ maxWidth: SIZE, aspectRatio: "1 / 1" }}
          role="img"
          aria-label={`${title} pentagon chart`}
        >
          {/* Concentric pentagon grid */}
          {RINGS.map((frac) => (
            <path
              key={frac}
              d={pentagonPath(RADIUS * frac)}
              fill="none"
              stroke="var(--color-border)"
              strokeWidth={frac === 1.0 ? 0.8 : 0.4}
              opacity={0.55}
            />
          ))}

          {/* Axis spokes */}
          {axisEnds.map(([x, y], i) => (
            <line
              key={i}
              x1={CENTER}
              y1={CENTER}
              x2={x}
              y2={y}
              stroke="var(--color-border)"
              strokeWidth={0.4}
              opacity={0.4}
            />
          ))}

          {/* Filled data area */}
          <path
            d={dataPath}
            fill="var(--color-brand)"
            fillOpacity={0.12}
            stroke="var(--color-brand)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />

          {/* Data vertex dots */}
          {dataPoints.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={3} fill="var(--color-brand)" />
          ))}

          {/* Axis labels */}
          {labelPositions.map(([x, y], i) => (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-[var(--color-text-muted)]"
              style={{ fontSize: "9.5px", fontWeight: 500, letterSpacing: "-0.01em" }}
            >
              {axes[i].label}
            </text>
          ))}
        </svg>
      </div>

      {/* Bottom legend */}
      <div className="grid grid-cols-5 border-t border-[var(--color-border)] divide-x divide-[var(--color-border)]">
        {axes.map((a) => (
          <div key={a.label} className="flex flex-col items-center gap-0.5 py-3 px-1">
            <span className="font-mono text-[14px] font-semibold tabular-nums text-[var(--color-text-strong)]">
              {a.value}
            </span>
            <span className="truncate text-[9px] text-[var(--color-text-faint)]">
              {a.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

