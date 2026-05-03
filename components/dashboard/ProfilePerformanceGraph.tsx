"use client";

/**
 * Multi-line area chart for profile/deal-flow performance.
 * Smooth curves via cardinal spline interpolation — looks organic, not robotic.
 */

type LineSeries = {
  label: string;
  color: string;
  data: number[];
};

type Props = {
  periods: string[];
  lines: LineSeries[];
  title?: string;
};

const CHART_W = 700;
const CHART_H = 220;
const PAD = { t: 20, r: 20, b: 36, l: 44 };

function catmullRomToPath(
  points: { x: number; y: number }[],
  tension = 0.35,
): string {
  if (points.length < 2) return "";
  const pts = points;
  const n = pts.length;
  let d = `M ${pts[0].x} ${pts[0].y}`;

  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, n - 1)];

    const cp1x = p1.x + ((p2.x - p0.x) * tension) / 3;
    const cp1y = p1.y + ((p2.y - p0.y) * tension) / 3;
    const cp2x = p2.x - ((p3.x - p1.x) * tension) / 3;
    const cp2y = p2.y - ((p3.y - p1.y) * tension) / 3;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function ProfilePerformanceGraph({
  periods,
  lines,
  title = "Profile performance",
}: Props) {
  const n = periods.length;
  if (n < 2) return null;

  const allVals = lines.flatMap((l) => l.data);
  const maxVal = Math.max(...allVals, 1);
  const niceMax = Math.ceil(maxVal / 10) * 10;

  const plotW = CHART_W - PAD.l - PAD.r;
  const plotH = CHART_H - PAD.t - PAD.b;

  function toX(i: number) { return PAD.l + (i / (n - 1)) * plotW; }
  function toY(v: number) { return PAD.t + plotH - (v / niceMax) * plotH; }

  const gridLines = [0.25, 0.5, 0.75, 1.0];

  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="flex items-baseline justify-between gap-2 border-b border-[var(--color-border)] px-5 pt-5 pb-3">
        <h3 className="text-[13px] font-semibold tracking-tight text-[var(--color-text)]">
          {title}
        </h3>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {lines.map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span
                className="inline-block h-[7px] w-[7px] rounded-full"
                style={{ backgroundColor: l.color }}
              />
              <span className="text-[10.5px] text-[var(--color-text-muted)]">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-5">
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="block w-full"
          style={{ minHeight: 200 }}
          role="img"
          aria-label={`${title} chart`}
        >
          <defs>
            {lines.map((l, li) => (
              <linearGradient key={li} id={`perfGrad${li}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={l.color} stopOpacity={0.12} />
                <stop offset="100%" stopColor={l.color} stopOpacity={0.01} />
              </linearGradient>
            ))}
          </defs>

          {/* Horizontal grid */}
          {gridLines.map((frac) => {
            const y = toY(niceMax * frac);
            return (
              <g key={frac}>
                <line
                  x1={PAD.l} y1={y} x2={CHART_W - PAD.r} y2={y}
                  stroke="var(--color-border)" strokeWidth={0.4}
                />
                <text
                  x={PAD.l - 8} y={y}
                  textAnchor="end" dominantBaseline="middle"
                  className="fill-[var(--color-text-faint)]"
                  style={{ fontSize: "9px" }}
                >
                  {Math.round(niceMax * frac)}
                </text>
              </g>
            );
          })}

          {/* Baseline */}
          <line
            x1={PAD.l} y1={PAD.t + plotH} x2={CHART_W - PAD.r} y2={PAD.t + plotH}
            stroke="var(--color-border)" strokeWidth={0.5}
          />

          {/* Area fills + lines */}
          {lines.map((l, li) => {
            const pts = l.data.map((v, i) => ({ x: toX(i), y: toY(v) }));
            const linePath = catmullRomToPath(pts);
            const areaPath = `${linePath} L ${pts[n - 1].x} ${PAD.t + plotH} L ${pts[0].x} ${PAD.t + plotH} Z`;

            return (
              <g key={li}>
                <path d={areaPath} fill={`url(#perfGrad${li})`} />
                <path
                  d={linePath}
                  fill="none"
                  stroke={l.color}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={pts[n - 1].x} cy={pts[n - 1].y} r={3}
                  fill={l.color}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}

          {/* Vertical tick marks + x labels */}
          {periods.map((label, i) => {
            const x = toX(i);
            return (
              <g key={i}>
                <line
                  x1={x} y1={PAD.t + plotH} x2={x} y2={PAD.t + plotH + 4}
                  stroke="var(--color-border)" strokeWidth={0.5}
                />
                <text
                  x={x} y={CHART_H - 8}
                  textAnchor="middle"
                  className="fill-[var(--color-text-faint)]"
                  style={{ fontSize: "9px" }}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
