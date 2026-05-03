"use client";

import { useState, useCallback } from "react";
import type { SeriesPoint } from "@/lib/dashboards/mock-data";

/**
 * Interactive engagement area chart with hover tooltips, Y-axis scale,
 * data-point markers, and summary stats in the header.
 */

const CHART_W = 600;
const CHART_H = 240;
const PAD = { t: 20, r: 16, b: 36, l: 44 };

export function EngagementChart({
  series,
  label = "Profile engagement",
  periodLabel = "Last 8 weeks",
}: {
  series: SeriesPoint[];
  label?: string;
  periodLabel?: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const onHover = useCallback((i: number | null) => setHoveredIdx(i), []);

  if (series.length < 2) return null;

  const values = series.map((p) => p.y);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const niceMax = Math.ceil(max / 10) * 10;
  const latest = values[values.length - 1];
  const prev = values[values.length - 2];
  const delta = prev > 0 ? Math.round(((latest - prev) / prev) * 100) : 0;
  const total = values.reduce((a, b) => a + b, 0);
  const avg = Math.round(total / values.length);

  const plotW = CHART_W - PAD.l - PAD.r;
  const plotH = CHART_H - PAD.t - PAD.b;

  function toX(i: number) { return PAD.l + (i / (series.length - 1)) * plotW; }
  function toY(v: number) { return PAD.t + plotH - (v / niceMax) * plotH; }

  const points = series.map((p, i) => ({ x: toX(i), y: toY(p.y) }));

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${PAD.t + plotH} L ${points[0].x.toFixed(1)} ${PAD.t + plotH} Z`;

  const gridLines = [0.25, 0.5, 0.75, 1.0];

  const hovered = hoveredIdx !== null ? series[hoveredIdx] : null;
  const hoveredPt = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      {/* Header with summary stats */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--color-border)] px-5 pt-5 pb-3">
        <div>
          <h3 className="text-[13px] font-semibold tracking-tight text-[var(--color-text)]">
            {label}
          </h3>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-faint)]">{periodLabel}</p>
        </div>
        <div className="flex items-baseline gap-4">
          <div className="text-right">
            <p className="font-mono text-[18px] font-semibold tabular-nums leading-none text-[var(--color-text-strong)]">
              {latest.toLocaleString()}
            </p>
            <p className="mt-1 text-[10px] text-[var(--color-text-faint)]">
              latest
              {delta !== 0 && (
                <span
                  className="ml-1.5 font-mono font-semibold"
                  style={{ color: delta > 0 ? "var(--color-brand)" : "var(--color-danger)" }}
                >
                  {delta > 0 ? "+" : ""}{delta}%
                </span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[14px] font-medium tabular-nums leading-none text-[var(--color-text-muted)]">
              {avg}
            </p>
            <p className="mt-1 text-[10px] text-[var(--color-text-faint)]">avg</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative px-2 pt-4 pb-1">
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="block w-full"
          style={{ minHeight: 200 }}
          role="img"
          aria-label={`${label} chart`}
        >
          <defs>
            <linearGradient id="engAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.14} />
              <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* Y-axis grid lines + labels */}
          {gridLines.map((frac) => {
            const y = toY(niceMax * frac);
            return (
              <g key={frac}>
                <line
                  x1={PAD.l} y1={y} x2={CHART_W - PAD.r} y2={y}
                  stroke="var(--color-border)" strokeWidth={0.4}
                  strokeDasharray={frac < 1 ? "3 3" : undefined}
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
          <text
            x={PAD.l - 8} y={PAD.t + plotH}
            textAnchor="end" dominantBaseline="middle"
            className="fill-[var(--color-text-faint)]"
            style={{ fontSize: "9px" }}
          >
            0
          </text>

          {/* Filled area */}
          <path d={areaPath} fill="url(#engAreaGrad)" />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke="var(--color-brand)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Data point dots */}
          {points.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x} cy={pt.y}
              r={hoveredIdx === i ? 5 : 3}
              fill={hoveredIdx === i ? "var(--color-brand)" : "white"}
              stroke="var(--color-brand)"
              strokeWidth={hoveredIdx === i ? 2 : 1.5}
              vectorEffect="non-scaling-stroke"
              style={{ transition: "r 120ms ease" }}
            />
          ))}

          {/* Hover crosshair */}
          {hoveredPt && hoveredIdx !== null && (
            <line
              x1={hoveredPt.x} y1={PAD.t}
              x2={hoveredPt.x} y2={PAD.t + plotH}
              stroke="var(--color-text-faint)" strokeWidth={0.8}
              strokeDasharray="3 2"
              vectorEffect="non-scaling-stroke"
              opacity={0.5}
            />
          )}

          {/* Invisible wider hit areas for hover */}
          {points.map((pt, i) => (
            <rect
              key={`hit-${i}`}
              x={pt.x - plotW / series.length / 2}
              y={PAD.t}
              width={plotW / series.length}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
              style={{ cursor: "crosshair" }}
            />
          ))}

          {/* X-axis labels */}
          {series.map((p, i) => (
            <text
              key={i}
              x={toX(i)} y={CHART_H - 8}
              textAnchor="middle"
              className="fill-[var(--color-text-faint)]"
              style={{
                fontSize: "9px",
                fontWeight: hoveredIdx === i ? 600 : 400,
                fill: hoveredIdx === i ? "var(--color-text)" : undefined,
              }}
            >
              {p.x}
            </text>
          ))}
        </svg>

        {/* Hover tooltip */}
        {hovered && hoveredPt && hoveredIdx !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2"
            style={{
              left: `${((hoveredPt.x / CHART_W) * 100).toFixed(1)}%`,
              top: 8,
            }}
          >
            <div className="border border-[var(--color-border)] bg-white px-3 py-2 shadow-sm">
              <p className="text-[10px] text-[var(--color-text-faint)]">{hovered.x}</p>
              <p className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums text-[var(--color-text-strong)]">
                {hovered.y.toLocaleString()}
              </p>
              {hoveredIdx > 0 && (
                <p className="mt-0.5 text-[10px]">
                  <span
                    className="font-mono font-semibold"
                    style={{
                      color: hovered.y >= series[hoveredIdx - 1].y
                        ? "var(--color-brand)"
                        : "var(--color-danger)",
                    }}
                  >
                    {hovered.y >= series[hoveredIdx - 1].y ? "+" : ""}
                    {hovered.y - series[hoveredIdx - 1].y}
                  </span>
                  <span className="text-[var(--color-text-faint)]"> vs prev</span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
