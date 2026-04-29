"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Reveal } from "@/components/landing/reveal";

/**
 * Numbers — the market context, with a 3D prism viz.
 *
 * Asymmetric layout: real research embedded in prose on the left,
 * a hand-built 3D prism chart on the right comparing reply rates.
 * Three rectangular prisms in oblique projection; heights map to the
 * response rate. Cold email and Warm intro are inked black, VentraMatch
 * is the only brand-green prism. Each label is engraved (rotated text)
 * on the right side face.
 *
 * Prisms grow from the baseline on viewport entry. SVG only — no chart
 * library, no third-party 3D engine. Respects prefers-reduced-motion.
 */

const PRISMS = [
  {
    key: "cold",
    label: "Cold email",
    range: "1–10%",
    valuePct: 5,
    tone: "ink" as const,
  },
  {
    key: "warm",
    label: "Warm intro",
    range: "30–70%",
    valuePct: 40,
    tone: "ink" as const,
  },
  {
    key: "vm",
    label: "VentraMatch",
    range: "early estimate",
    valuePct: 65,
    tone: "brand" as const,
  },
];

// SVG viewBox + prism geometry (all in viewBox units)
const VIEW_W = 600;
const VIEW_H = 360;
const BASE_Y = 312; // common baseline the prisms sit on
const PRISM_W = 76;
const DEPTH_X = 26;
const DEPTH_Y = 20;
const MIN_H = 80; // smallest prism is still tall enough for an engraved label
const MAX_H = 232;
const SCALE_REF_PCT = 70; // 70% of headroom maps to MAX_H

// Hand-placed prism x positions so the visible footprint (PRISM_W + DEPTH_X)
// is evenly spaced across the viewBox.
const PRISM_X = [78, 248, 418];

// Face palettes per tone — small shade-shift between front / top / right
// gives the cartoon-y oblique-3D look without any rendering tricks.
const PALETTES = {
  ink: {
    front: "#1F2937",
    top: "#374151",
    right: "#0F172A",
    label: "rgba(255,255,255,0.82)",
  },
  brand: {
    front: "#16A34A",
    top: "#22C55E",
    right: "#15803D",
    label: "#FFFFFF",
  },
};

type Palette = (typeof PALETTES)[keyof typeof PALETTES];

const STROKE = "#0F172A";
const STROKE_W = 1.6;

export function Numbers() {
  return (
    <section className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
      <div className="mx-auto max-w-[1280px] px-6 py-24 md:py-32">
        <div className="grid grid-cols-1 items-start gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          {/* Prose */}
          <div>
            <Reveal>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
                The market we&apos;re in
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h2
                className="mt-5 max-w-[24ch] text-balance font-semibold tracking-[-0.012em] text-[color:var(--color-text-strong)]"
                style={{ fontSize: "var(--type-h2)", lineHeight: 1.1 }}
              >
                A search problem dressed up as a sales problem.
              </h2>
            </Reveal>
            <Reveal delay={160}>
              <p
                className="mt-6 text-[color:var(--color-text-muted)]"
                style={{ fontSize: "var(--type-body-lg)", lineHeight: 1.65 }}
              >
                A pre-seed founder reaches out to <Stat>50–250</Stat> investors to close{" "}
                <Stat>5–20</Stat> checks. Cold-email reply rates sit at <Stat>1–10%</Stat>.
                There are <Stat>300,000+</Stat> active US angels and <Stat>2,500+</Stat>{" "}
                active VC funds, and most aren&apos;t the right fit for your raise.
              </p>
            </Reveal>
            <Reveal delay={220}>
              <p className="mt-5 text-[14px] leading-relaxed text-[color:var(--color-text-faint)]">
                Sources: Carta state-of-startups 2025, AngelList market data, OpenVC.
              </p>
            </Reveal>
          </div>

          {/* Prism chart */}
          <Reveal delay={120} className="w-full">
            <PrismChart />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Stat({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[0.95em] font-semibold tabular-nums text-[color:var(--color-text-strong)]">
      {children}
    </span>
  );
}

function PrismChart() {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    if (reduced) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <div
      ref={ref}
      className="rounded-[20px] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] p-6 md:p-8"
    >
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[color:var(--color-text-faint)]">
          Founder → investor reply rates
        </p>
        <p className="font-mono text-[11px] tabular-nums text-[color:var(--color-text-faint)]">
          % responding
        </p>
      </div>

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="mt-3 w-full"
        role="img"
        aria-label="Three reply-rate prisms growing from a common baseline. Cold email is short and inked, warm intro is medium and inked, VentraMatch is the tallest prism in brand green."
      >
        {/* Subtle dashed shelf — broken under each prism so it reads as a baseline, not a chart axis */}
        <ShelfLine />

        {PRISMS.map((p, i) => {
          const x = PRISM_X[i];
          const targetH = Math.max(
            MIN_H,
            Math.round((p.valuePct / SCALE_REF_PCT) * MAX_H),
          );
          return (
            <Prism
              key={p.key}
              x={x}
              baseY={BASE_Y}
              w={PRISM_W}
              h={targetH}
              dx={DEPTH_X}
              dy={DEPTH_Y}
              palette={PALETTES[p.tone]}
              label={p.label}
              valueText={p.range}
              shown={shown}
              reduced={reduced}
              delay={i * 200}
            />
          );
        })}
      </svg>

      <p className="mt-5 text-[12px] leading-snug text-[color:var(--color-text-faint)]">
        VentraMatch target reflects what we believe scored, mutually-interested
        outreach should achieve. Real numbers will replace this once we have them.
      </p>
    </div>
  );
}

/** Faint dashed shelf with gaps under each prism, drawn behind everything. */
function ShelfLine() {
  // Render two short segments: one to the left of the first prism, one to the
  // right of the last. Skips drawing under the prism footprints so it reads as
  // a baseline rather than a chart axis.
  const left = { x1: 36, x2: PRISM_X[0] - 6 };
  const right = { x1: PRISM_X[2] + PRISM_W + DEPTH_X + 6, x2: VIEW_W - 36 };
  const between1 = {
    x1: PRISM_X[0] + PRISM_W + DEPTH_X + 6,
    x2: PRISM_X[1] - 6,
  };
  const between2 = {
    x1: PRISM_X[1] + PRISM_W + DEPTH_X + 6,
    x2: PRISM_X[2] - 6,
  };
  return (
    <g stroke="#d1d5db" strokeWidth={1} strokeDasharray="3 5">
      <line x1={left.x1} y1={BASE_Y + 0.5} x2={left.x2} y2={BASE_Y + 0.5} />
      <line x1={between1.x1} y1={BASE_Y + 0.5} x2={between1.x2} y2={BASE_Y + 0.5} />
      <line x1={between2.x1} y1={BASE_Y + 0.5} x2={between2.x2} y2={BASE_Y + 0.5} />
      <line x1={right.x1} y1={BASE_Y + 0.5} x2={right.x2} y2={BASE_Y + 0.5} />
    </g>
  );
}

function Prism({
  x,
  baseY,
  w,
  h,
  dx,
  dy,
  palette,
  label,
  valueText,
  shown,
  reduced,
  delay,
}: {
  x: number;
  baseY: number;
  w: number;
  h: number;
  dx: number;
  dy: number;
  palette: Palette;
  label: string;
  valueText: string;
  shown: boolean;
  reduced: boolean;
  delay: number;
}) {
  const top = baseY - h;
  const cx = x + w / 2;

  // Polygon vertex strings for the three visible faces.
  const frontPoints = `${x},${top} ${x + w},${top} ${x + w},${baseY} ${x},${baseY}`;
  const topPoints = `${x},${top} ${x + w},${top} ${x + w + dx},${top - dy} ${x + dx},${top - dy}`;
  const rightPoints = `${x + w},${top} ${x + w + dx},${top - dy} ${x + w + dx},${baseY - dy} ${x + w},${baseY}`;

  // Engraved label centered on the right face, rotated -90° to read sideways.
  const rightCx = x + w + dx / 2;
  const rightCy = top + h / 2 - dy / 2;

  // Value range below the baseline, centered under the prism's visible footprint.
  const valueX = x + (w + dx) / 2;
  const valueY = baseY + 26;

  const prismDuration = 1100;
  const labelDelay = delay + (reduced ? 0 : prismDuration - 250);

  // Inline style for the prism faces group — scaleY grows the prism from
  // the baseline. transform-box is set to view-box so transform-origin
  // resolves in viewBox coordinates rather than the element's bbox.
  const facesStyle: CSSProperties = {
    transform: shown ? "scaleY(1)" : "scaleY(0.0001)",
    transformOrigin: `${cx}px ${baseY}px`,
    transformBox: "view-box",
    transition: reduced
      ? "none"
      : `transform ${prismDuration}ms cubic-bezier(0.22, 1, 0.36, 1)`,
    transitionDelay: `${delay}ms`,
  };

  const fadeStyle: CSSProperties = {
    opacity: shown ? 1 : 0,
    transition: reduced ? "none" : "opacity 380ms ease",
    transitionDelay: `${labelDelay}ms`,
  };

  return (
    <g>
      {/* Prism faces grow up from the baseline. Order: right → top → front
          (back-to-front in oblique projection sense). */}
      <g style={facesStyle}>
        <polygon
          points={rightPoints}
          fill={palette.right}
          stroke={STROKE}
          strokeWidth={STROKE_W}
          strokeLinejoin="round"
        />
        <polygon
          points={topPoints}
          fill={palette.top}
          stroke={STROKE}
          strokeWidth={STROKE_W}
          strokeLinejoin="round"
        />
        <polygon
          points={frontPoints}
          fill={palette.front}
          stroke={STROKE}
          strokeWidth={STROKE_W}
          strokeLinejoin="round"
        />
      </g>

      {/* Engraved label on the right side face (rotated -90°). Fades in
          after the prism finishes growing. */}
      <text
        x={rightCx}
        y={rightCy}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={palette.label}
        fontSize={10}
        fontWeight={700}
        letterSpacing="0.14em"
        fontFamily="var(--font-mono, ui-monospace, monospace)"
        style={{ textTransform: "uppercase", ...fadeStyle }}
        transform={`rotate(-90 ${rightCx} ${rightCy})`}
      >
        {label}
      </text>

      {/* Range / context label below the baseline */}
      <text
        x={valueX}
        y={valueY}
        textAnchor="middle"
        fill="#6b7280"
        fontSize={11}
        fontFamily="var(--font-mono, ui-monospace, monospace)"
        style={fadeStyle}
      >
        {valueText}
      </text>
    </g>
  );
}
