"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * ScoreViz — auto-cycling, color-coded scoring visualization.
 *
 * Two parties flank a circular gauge made of 5 segments — one per input,
 * each in its own brand-palette color. As inputs reveal, their segments
 * fill from segment-start to (segment-length × value). The cumulative
 * score number ticks up at the center. Below, a breakdown table mirrors
 * the same color coding.
 *
 * Design choices (vs. the earlier "single green ring + grey rows"):
 *   - Per-input tones (brand · info · warn · ink · muted)
 *   - Sharper corners (rounded-[14px] / [10px], not 24/16)
 *   - Stronger borders (border-strong on outer card)
 *   - Accent strip on each party card (startup → brand; investor → info)
 *   - Color-coded left bars on breakdown rows
 *
 * Used by:
 *   - /score (the dedicated page)
 *   - HowMatchingWorks (the homepage sticky-scroll section, step 02)
 *
 * Props:
 *   - showFooter (default true): pair dots + "view the formula" link
 */

const CYCLE_MS = 10000;
const REVEAL_FIRST_DELAY_MS = 700;
const REVEAL_INTERVAL_MS = 700;
const REASON_DELAY_MS = 4700;

type Tone = "brand" | "info" | "warn" | "ink" | "muted";

const TONE_STROKE: Record<Tone, string> = {
  brand: "var(--color-brand)",
  info: "var(--color-info)",
  warn: "var(--color-warn)",
  ink: "var(--color-text-strong)",
  muted: "var(--color-text-muted)",
};

const TONE_TEXT: Record<Tone, string> = {
  brand: "text-[color:var(--color-brand-strong)]",
  info: "text-[color:var(--color-info)]",
  warn: "text-[color:var(--color-warn)]",
  ink: "text-[color:var(--color-text-strong)]",
  muted: "text-[color:var(--color-text-muted)]",
};

const TONE_BG_BAR: Record<Tone, string> = {
  brand: "bg-[color:var(--color-brand)]",
  info: "bg-[color:var(--color-info)]",
  warn: "bg-[color:var(--color-warn)]",
  ink: "bg-[color:var(--color-text-strong)]",
  muted: "bg-[color:var(--color-text-faint)]",
};

type Input = {
  key: string;
  label: string;
  value: number;
  weight: number;
  reason: string;
  tone: Tone;
};

type Party = {
  name: string;
  meta: string;
  detail: string;
  initial: string;
};

type Pair = {
  id: string;
  startup: Party;
  investor: Party;
  inputs: Input[]; // exactly 5; weights sum to 100
  reason: string;
};

const PAIRS: Pair[] = [
  {
    id: "modal-northbound",
    startup: {
      name: "Modal Labs",
      meta: "AI / ML · Serverless compute",
      detail: "Seed · $1.0M raise · NYC",
      initial: "ML",
    },
    investor: {
      name: "Northbound Capital",
      meta: "AI infra · DevTools · Data",
      detail: "Pre-seed/Seed · $250K – $2.5M · NYC",
      initial: "NB",
    },
    inputs: [
      { key: "sector", label: "Sector", value: 0.95, weight: 30, reason: "AI infra ⊂ AI / ML", tone: "brand" },
      { key: "stage", label: "Stage", value: 1.0, weight: 25, reason: "Both back Seed", tone: "info" },
      { key: "check", label: "Check size", value: 1.0, weight: 20, reason: "$1.0M inside band", tone: "warn" },
      { key: "geo", label: "Geography", value: 1.0, weight: 15, reason: "NYC ⇄ NYC", tone: "ink" },
      { key: "traction", label: "Traction", value: 0.5, weight: 10, reason: "Early — 3-mo growth only", tone: "muted" },
    ],
    reason: "Sector, stage, check, geo all line up. Traction is early.",
  },
  {
    id: "brace-khosla",
    startup: {
      name: "Brace",
      meta: "Consumer fintech",
      detail: "Pre-seed · $500K raise · SF",
      initial: "BR",
    },
    investor: {
      name: "Khosla Ventures",
      meta: "Deep tech · Hard problems",
      detail: "Seed/A/B · $2 – $10M · SF",
      initial: "KV",
    },
    inputs: [
      { key: "sector", label: "Sector", value: 0.3, weight: 30, reason: "Consumer fintech outside thesis", tone: "brand" },
      { key: "stage", label: "Stage", value: 0.5, weight: 25, reason: "KV rarely writes pre-seed", tone: "info" },
      { key: "check", label: "Check size", value: 0.4, weight: 20, reason: "$500K below their band", tone: "warn" },
      { key: "geo", label: "Geography", value: 1.0, weight: 15, reason: "Both SF", tone: "ink" },
      { key: "traction", label: "Traction", value: 0.8, weight: 10, reason: "Strong metrics for stage", tone: "muted" },
    ],
    reason: "Same city, but check too small and sector outside the thesis.",
  },
  {
    id: "pulse-a16z",
    startup: {
      name: "Pulse Health",
      meta: "Healthtech · Continuous monitoring",
      detail: "Seed · $3.0M raise · Boston",
      initial: "PH",
    },
    investor: {
      name: "a16z Bio + Health",
      meta: "Bio · Health systems",
      detail: "Seed/A · $2 – $15M · Bay Area",
      initial: "az",
    },
    inputs: [
      { key: "sector", label: "Sector", value: 0.85, weight: 30, reason: "Healthtech ∩ Health systems", tone: "brand" },
      { key: "stage", label: "Stage", value: 1.0, weight: 25, reason: "Both back Seed", tone: "info" },
      { key: "check", label: "Check size", value: 1.0, weight: 20, reason: "$3.0M inside band", tone: "warn" },
      { key: "geo", label: "Geography", value: 0.4, weight: 15, reason: "Boston ⇄ Bay Area, soft signal", tone: "ink" },
      { key: "traction", label: "Traction", value: 0.7, weight: 10, reason: "Solid pilots", tone: "muted" },
    ],
    reason: "Strong fit on the algorithm; geography is the only soft signal.",
  },
];

export function ScoreViz({ showFooter = true }: { showFooter?: boolean }) {
  const [pairIdx, setPairIdx] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [showReason, setShowReason] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [inView, setInView] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollAtRef = useRef<number>(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.2 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => {
      lastScrollAtRef.current = Date.now();
      if (paused) setPaused(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onScroll);
    };
  }, [paused]);

  useEffect(() => {
    setRevealedCount(0);
    setShowReason(false);

    if (reduced) {
      setRevealedCount(PAIRS[pairIdx].inputs.length);
      setShowReason(true);
      return;
    }
    if (paused || !inView) return;

    const timeouts: number[] = [];
    for (let i = 0; i < PAIRS[pairIdx].inputs.length; i++) {
      timeouts.push(
        window.setTimeout(
          () => setRevealedCount(i + 1),
          REVEAL_FIRST_DELAY_MS + i * REVEAL_INTERVAL_MS,
        ),
      );
    }
    timeouts.push(window.setTimeout(() => setShowReason(true), REASON_DELAY_MS));
    timeouts.push(
      window.setTimeout(
        () => setPairIdx((p) => (p + 1) % PAIRS.length),
        CYCLE_MS,
      ),
    );

    return () => timeouts.forEach((t) => window.clearTimeout(t));
  }, [pairIdx, paused, inView, reduced]);

  const pair = PAIRS[pairIdx];
  const score = Math.round(
    pair.inputs
      .slice(0, revealedCount)
      .reduce((sum, inp) => sum + inp.value * inp.weight, 0),
  );

  const onHoverEnter = () => {
    if (Date.now() - lastScrollAtRef.current < 250) return;
    setPaused(true);
  };

  return (
    <div
      ref={containerRef}
      className="w-full"
      onMouseEnter={onHoverEnter}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="overflow-hidden rounded-[14px] border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        {/* Top: cards + gauge */}
        <div className="grid grid-cols-1 items-stretch gap-6 p-6 md:grid-cols-[1fr_auto_1fr] md:gap-10 md:p-9 lg:p-12">
          <PartyCard label="Startup" tone="brand" party={pair.startup} pairId={pair.id} side="left" />
          <SegmentedGauge inputs={pair.inputs} revealedCount={revealedCount} score={score} pairId={pair.id} />
          <PartyCard label="Investor" tone="info" party={pair.investor} pairId={pair.id} side="right" />
        </div>

        <div className="border-t border-[color:var(--color-border)]" />

        {/* Breakdown */}
        <div className="bg-[color:var(--color-bg)] p-6 md:p-9 lg:p-12">
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
            Breakdown
          </p>
          <ul className="mt-4 overflow-hidden rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] divide-y divide-[color:var(--color-border)]">
            {pair.inputs.map((input, i) => {
              const revealed = i < revealedCount;
              const contribution = (input.value * input.weight).toFixed(1);
              return (
                <BreakdownRow
                  key={`${pair.id}-${input.key}`}
                  input={input}
                  revealed={revealed}
                  contribution={contribution}
                />
              );
            })}
          </ul>

          <div className="mt-6 min-h-[64px]">
            <AnimatePresence mode="wait">
              {showReason && (
                <motion.div
                  key={pair.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-[10px] border-l-[3px] border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] px-4 py-3"
                >
                  <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
                    One-line reason
                  </p>
                  <p className="mt-1 max-w-[60ch] text-[14.5px] leading-[1.55] text-[color:var(--color-text-strong)]">
                    {pair.reason}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {showFooter && (
        <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            {PAIRS.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setPairIdx(i)}
                type="button"
                className={[
                  "h-1.5 rounded-full transition-all",
                  i === pairIdx
                    ? "w-8 bg-[color:var(--color-text-strong)]"
                    : "w-1.5 bg-[color:var(--color-border-strong)] hover:bg-[color:var(--color-text-muted)]",
                ].join(" ")}
                aria-label={`Show pair ${i + 1}`}
              />
            ))}
          </div>
          <a
            href="https://github.com/abhijandyala/ventramatch/blob/main/lib/matching/score.ts"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-strong)]"
          >
            view the formula →
          </a>
        </div>
      )}
    </div>
  );
}

/* ---------------- Party card with accent strip ---------------- */

function PartyCard({
  label,
  party,
  side,
  tone,
  pairId,
}: {
  label: string;
  party: Party;
  side: "left" | "right";
  tone: Tone;
  pairId: string;
}) {
  return (
    <motion.div
      key={`${pairId}-${side}`}
      initial={{ opacity: 0, x: side === "left" ? -16 : 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={[
        "relative overflow-hidden rounded-[12px] border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] p-5 pt-6",
        side === "right" ? "text-right" : "text-left",
      ].join(" ")}
    >
      {/* Accent strip — top edge */}
      <span
        aria-hidden
        className={["absolute inset-x-0 top-0 h-[3px]", TONE_BG_BAR[tone]].join(" ")}
      />
      <p
        className={[
          "font-mono text-[10px] font-semibold uppercase tracking-[0.18em]",
          TONE_TEXT[tone],
        ].join(" ")}
      >
        {label}
      </p>
      <div
        className={[
          "mt-2.5 flex items-center gap-3",
          side === "right" ? "flex-row-reverse" : "",
        ].join(" ")}
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-[color:var(--color-bg)] font-mono text-[11px] font-semibold uppercase text-[color:var(--color-text-strong)] ring-1 ring-[color:var(--color-border-strong)]">
          {party.initial}
        </div>
        <p className="text-[16px] font-semibold leading-tight text-[color:var(--color-text-strong)]">
          {party.name}
        </p>
      </div>
      <p className="mt-3 text-[12.5px] text-[color:var(--color-text-strong)]">
        {party.meta}
      </p>
      <p className="mt-1 font-mono text-[11px] text-[color:var(--color-text-muted)]">
        {party.detail}
      </p>
    </motion.div>
  );
}

/* ---------------- Segmented multi-color gauge ---------------- */

function SegmentedGauge({
  inputs,
  revealedCount,
  score,
  pairId,
}: {
  inputs: Input[];
  revealedCount: number;
  score: number;
  pairId: string;
}) {
  const r = 86;
  const cx = 100;
  const cy = 100;
  const c = 2 * Math.PI * r;

  // Pre-compute each segment's geometry. Weights are out of 100; the ring
  // covers a full revolution so 1pt of weight = c/100 of arc length.
  let cumulativeWeight = 0;
  const segments = inputs.map((input) => {
    const startWeight = cumulativeWeight;
    const segmentLen = (input.weight / 100) * c;
    cumulativeWeight += input.weight;
    return { input, startWeight, segmentLen };
  });

  return (
    <div
      className="relative mx-auto h-[210px] w-[210px] shrink-0"
      key={pairId}
    >
      <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
        {/* Track — single faint ring underneath */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="6"
        />
        {/* Per-input segments */}
        {segments.map(({ input, startWeight, segmentLen }, i) => {
          const revealed = i < revealedCount;
          const fillFraction = revealed ? input.value : 0;
          // Rotate so the segment starts at the top (`-90°`) plus its
          // cumulative weight expressed in degrees.
          const startAngle = (startWeight / 100) * 360 - 90;
          return (
            <motion.circle
              key={input.key}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={TONE_STROKE[input.tone]}
              strokeWidth="6"
              strokeLinecap="butt"
              strokeDasharray={`${segmentLen} ${c - segmentLen}`}
              initial={{ strokeDashoffset: 0 - 0 + segmentLen }}
              animate={{
                strokeDashoffset: segmentLen - segmentLen * fillFraction,
              }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              transform={`rotate(${startAngle} ${cx} ${cy})`}
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          key={score}
          initial={{ opacity: 0.6, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="font-semibold leading-none tracking-[-0.02em] text-[color:var(--color-text-strong)] tabular-nums"
          style={{ fontSize: "56px" }}
        >
          {score}
          <span className="ml-0.5 text-[28px] text-[color:var(--color-text-muted)]">%</span>
        </motion.span>
        <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
          Match score
        </span>
      </div>
    </div>
  );
}

/* ---------------- Breakdown row with tone bar ---------------- */

function BreakdownRow({
  input,
  revealed,
  contribution,
}: {
  input: Input;
  revealed: boolean;
  contribution: string;
}) {
  return (
    <li>
      <motion.div
        animate={{ opacity: revealed ? 1 : 0.32 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex items-center gap-4 px-4 py-3 md:gap-6 md:px-5"
      >
        {/* Tone bar — left edge */}
        <span
          aria-hidden
          className={[
            "absolute inset-y-0 left-0 w-[3px]",
            TONE_BG_BAR[input.tone],
          ].join(" ")}
        />
        {/* Check */}
        <span
          className={[
            "ml-1 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold transition-colors",
            revealed
              ? `${TONE_BG_BAR[input.tone]} text-white`
              : "border border-[color:var(--color-border-strong)] text-[color:var(--color-text-faint)]",
          ].join(" ")}
        >
          {revealed ? "✓" : ""}
        </span>
        {/* Label */}
        <span
          className={[
            "w-[100px] shrink-0 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em]",
            TONE_TEXT[input.tone],
          ].join(" ")}
        >
          {input.label}
        </span>
        {/* Reason */}
        <span className="flex-1 truncate text-[13.5px] text-[color:var(--color-text-strong)]">
          {input.reason}
        </span>
        {/* Weight badge */}
        <span className="hidden w-[70px] shrink-0 text-right font-mono text-[11px] tabular-nums text-[color:var(--color-text-faint)] sm:inline">
          weight {input.weight}
        </span>
        {/* Contribution */}
        <span
          className={[
            "w-[60px] shrink-0 text-right font-mono text-[12px] font-semibold tabular-nums",
            revealed
              ? TONE_TEXT[input.tone]
              : "text-[color:var(--color-text-faint)]",
          ].join(" ")}
        >
          +{contribution}
        </span>
      </motion.div>
    </li>
  );
}
