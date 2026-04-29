"use client";

import { Fragment, useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

/**
 * MatchFlow — the hero visual.
 *
 * Two cards (startup left, investor right) cycling through five sample pairs.
 * Connected through a center "chip" by traces that make right-angle bends
 * like circuit-board paths. Animated dashes flow inward along the traces.
 *
 * Pairings are illustrative only; we never claim these matches actually
 * happened on the platform. Names and logos of public companies / well-known
 * firms are used as recognizable category exemplars.
 *
 * Logos: fetched from logo.clearbit.com/{domain}; if a logo fails to load
 * we fall back to a brand-tinted letter tile so the layout never breaks.
 *
 * Respects prefers-reduced-motion: cycling pauses, dashes stop flowing,
 * the first pair stays as a static composition.
 */

type Side = {
  name: string;
  category: string;
  domain: string;
};

type Pair = { startup: Side; investor: Side };

const PAIRS: Pair[] = [
  {
    startup: { name: "Cursor", category: "AI dev tools", domain: "cursor.com" },
    investor: { name: "Sequoia", category: "Tech, multi-stage", domain: "sequoiacap.com" },
  },
  {
    startup: { name: "Linear", category: "Productivity", domain: "linear.app" },
    investor: { name: "Accel", category: "Software, growth", domain: "accel.com" },
  },
  {
    startup: { name: "Stripe", category: "Payments", domain: "stripe.com" },
    investor: { name: "Y Combinator", category: "Accelerator", domain: "ycombinator.com" },
  },
  {
    startup: { name: "Anthropic", category: "AI research", domain: "anthropic.com" },
    investor: { name: "a16z", category: "Tech, all stages", domain: "a16z.com" },
  },
  {
    startup: { name: "Notion", category: "Workspace", domain: "notion.so" },
    investor: { name: "Index", category: "Software, growth", domain: "indexventures.com" },
  },
];

const CYCLE_MS = 3500;

export function MatchFlow() {
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % PAIRS.length), CYCLE_MS);
    return () => clearInterval(id);
  }, [reduced]);

  const pair = PAIRS[index];

  return (
    <div className="relative mx-auto w-full max-w-[1280px]">
      <style jsx>{`
        @keyframes vm-trace-right {
          to {
            stroke-dashoffset: -16;
          }
        }
        @keyframes vm-trace-left {
          to {
            stroke-dashoffset: 16;
          }
        }
        :global(.vm-trace-r .vm-trace-anim) {
          animation: vm-trace-right 1.6s linear infinite;
        }
        :global(.vm-trace-l .vm-trace-anim) {
          animation: vm-trace-left 1.6s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.vm-trace-anim) {
            animation: none !important;
          }
        }
      `}</style>

      <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(380px,500px)_minmax(0,1fr)] items-center gap-5 sm:gap-8">
        {/* LEFT — startup */}
        <div className="relative flex min-w-0 justify-end">
          <AnimatePresence mode="wait">
            <motion.div
              key={`s-${index}`}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[420px]"
            >
              <SideCard side={pair.startup} role="startup" />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* CENTER — traces + chip. Tall to give the spaced trace lines room. */}
        <div className="relative flex h-[260px] items-center justify-center">
          <TraceField
            direction="right"
            className="absolute left-0 top-1/2 h-[220px] w-[calc(50%-128px)] -translate-y-1/2"
          />
          <TraceField
            direction="left"
            className="absolute right-0 top-1/2 h-[220px] w-[calc(50%-128px)] -translate-y-1/2"
          />
          <MatchChip />
        </div>

        {/* RIGHT — investor */}
        <div className="relative flex min-w-0 justify-start">
          <AnimatePresence mode="wait">
            <motion.div
              key={`i-${index}`}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 14 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[420px]"
            >
              <SideCard side={pair.investor} role="investor" />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ---------- Cards ---------- */

function SideCard({ side, role }: { side: Side; role: "startup" | "investor" }) {
  return (
    <div
      className="relative flex w-full flex-col gap-6 rounded-[16px] border border-[color:var(--color-border)] bg-white p-7 shadow-[0_1px_0_rgba(15,23,42,0.04),0_24px_48px_-28px_rgba(15,23,42,0.18)]"
      aria-label={`${role === "startup" ? "Startup" : "Investor"}: ${side.name}, ${side.category}`}
    >
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--color-text-faint)]">
        {role === "startup" ? "Startup" : "Investor"}
      </span>
      <div className="flex items-center gap-5">
        <CompanyLogo domain={side.domain} name={side.name} />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-[22px] font-semibold tracking-[-0.012em] text-[color:var(--color-text-strong)]">
            {side.name}
          </span>
          <span className="mt-1.5 text-[14px] text-[color:var(--color-text-muted)]">
            {side.category}
          </span>
        </span>
      </div>
    </div>
  );
}

function CompanyLogo({ domain, name }: { domain: string; name: string }) {
  // Two-tier source. Clearbit's free Logo API was deprecated when HubSpot
  // acquired them, so we lead with Google's favicon service (always returns
  // a usable icon) and then fall back to a brand-tinted letter tile.
  const [errored, setErrored] = useState(false);
  const initial = name[0]?.toUpperCase() ?? "?";

  if (errored) {
    return (
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[10px] bg-[color:var(--color-brand-tint)] text-[24px] font-semibold text-[color:var(--color-brand-strong)]">
        {initial}
      </span>
    );
  }

  return (
    <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[color:var(--color-border)] bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
        alt=""
        width={48}
        height={48}
        className="h-12 w-12 object-contain"
        loading="lazy"
        decoding="async"
        onError={() => setErrored(true)}
      />
    </span>
  );
}

/* ---------- Center chip ---------- */

function MatchChip() {
  // Processor-chip aesthetic, intentionally asymmetric — like a real IC:
  //   - Different pin counts per side (4 left, 6 right)
  //   - Top pins clustered to the right; bottom pins clustered to the left
  //   - Pin 1 indicator dot in the top-left
  //   - Off-center "VMX/01" silkscreen label in the bottom-right
  //   - Center core (V/ + match) positioned slightly left of geometric center
  //   - Internal grid lines at uneven positions
  //
  // Light theme. Brand-green accents only (no cyan / no purple).

  // Side pin positions match where the trace convergence dots land (y=40 in
  // 0..80 viewBox = 50% of the chip height vertically); the rest of the side
  // pins are decorative.
  const leftPins = [22, 50, 72]; // 3 — fewer
  const rightPins = [12, 28, 44, 60, 76, 92]; // 6 — denser

  // Top pins cluster on the right side; bottom on the left. Picks asymmetry.
  const topPins = [54, 64, 74, 84, 94];
  const bottomPins = [8, 18, 28, 38, 48, 58];

  return (
    <div className="relative z-10">
      {/* Side pins */}
      {leftPins.map((top, i) => (
        <span
          key={`l-${i}`}
          className="pointer-events-none absolute h-[6px] w-3 rounded-[1px] bg-[color:var(--color-border-strong)]"
          style={{ left: -10, top: `${top}%`, transform: "translateY(-50%)" }}
        >
          <span className="absolute right-0 top-0 block h-full w-[3px] bg-[color:var(--color-brand)]" />
        </span>
      ))}
      {rightPins.map((top, i) => (
        <span
          key={`r-${i}`}
          className="pointer-events-none absolute h-[6px] w-3 rounded-[1px] bg-[color:var(--color-border-strong)]"
          style={{ right: -10, top: `${top}%`, transform: "translateY(-50%)" }}
        >
          <span className="absolute left-0 top-0 block h-full w-[3px] bg-[color:var(--color-brand)]" />
        </span>
      ))}

      {/* Top + bottom pins (asymmetric clusters) */}
      {topPins.map((left, i) => (
        <span
          key={`t-${i}`}
          className="pointer-events-none absolute h-3 w-[6px] rounded-[1px] bg-[color:var(--color-border-strong)]"
          style={{ top: -10, left: `${left}%`, transform: "translateX(-50%)" }}
        >
          <span className="absolute bottom-0 left-0 block h-[3px] w-full bg-[color:var(--color-brand)]" />
        </span>
      ))}
      {bottomPins.map((left, i) => (
        <span
          key={`b-${i}`}
          className="pointer-events-none absolute h-3 w-[6px] rounded-[1px] bg-[color:var(--color-border-strong)]"
          style={{ bottom: -10, left: `${left}%`, transform: "translateX(-50%)" }}
        >
          <span className="absolute left-0 top-0 block h-[3px] w-full bg-[color:var(--color-brand)]" />
        </span>
      ))}

      {/* Chip body — landscape rectangle, slightly wider than tall */}
      <div className="relative h-[180px] w-[260px] overflow-hidden rounded-[8px] border border-[color:var(--color-border-strong)] bg-white shadow-[0_14px_44px_-14px_rgba(22,163,74,0.4)]">
        {/* Corner notches — top-right is omitted intentionally so the chip
            reads as having a defined orientation, not a centered emblem */}
        <span className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 border-l-2 border-t-2 border-[color:var(--color-brand)]" />
        <span className="pointer-events-none absolute bottom-2 left-2 h-3.5 w-3.5 border-l-2 border-b-2 border-[color:var(--color-brand)]" />
        <span className="pointer-events-none absolute bottom-2 right-2 h-3.5 w-3.5 border-r-2 border-b-2 border-[color:var(--color-brand)]" />

        {/* Pin 1 indicator (small filled circle, industry-standard chip marker) */}
        <span
          className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-[color:var(--color-brand)]"
          style={{ left: 14, top: 14 }}
        />

        {/* Internal grid (uneven spacing) */}
        <div className="pointer-events-none absolute inset-0 opacity-25">
          <span className="absolute left-0 right-0 block h-px bg-[color:var(--color-brand)]" style={{ top: "32%" }} />
          <span className="absolute left-0 right-0 block h-px bg-[color:var(--color-brand)]" style={{ top: "72%" }} />
          <span className="absolute top-0 bottom-0 block w-px bg-[color:var(--color-brand)]" style={{ left: "26%" }} />
          <span className="absolute top-0 bottom-0 block w-px bg-[color:var(--color-brand)]" style={{ left: "62%" }} />
        </div>

        {/* Faint die outline behind the core (shifted off-center) */}
        <span
          className="pointer-events-none absolute rounded-[3px] border border-dashed border-[color:var(--color-brand)]/25"
          style={{ left: "16%", top: "26%", width: "62%", height: "44%" }}
        />

        {/* Center core (V/ + match) — positioned slightly left of geometric center */}
        <div className="absolute inset-0 flex items-center" style={{ paddingLeft: "10%" }}>
          <div className="relative flex items-center gap-2 rounded-[6px] border border-[color:var(--color-brand)]/45 bg-[color:var(--color-bg)] px-3.5 py-2">
            <span className="pointer-events-none absolute -left-[3px] -top-[3px] h-1.5 w-1.5 bg-[color:var(--color-brand)]" />
            <span className="pointer-events-none absolute -right-[3px] -top-[3px] h-1.5 w-1.5 bg-[color:var(--color-brand)]" />
            <span className="pointer-events-none absolute -left-[3px] -bottom-[3px] h-1.5 w-1.5 bg-[color:var(--color-brand)]" />
            <span className="pointer-events-none absolute -right-[3px] -bottom-[3px] h-1.5 w-1.5 bg-[color:var(--color-brand)]" />

            <Image
              src="/logo.png"
              alt=""
              width={20}
              height={20}
              className="object-contain"
              style={{ height: 20, width: "auto" }}
            />
            <span className="text-[17px] font-semibold tracking-tight text-[color:var(--color-brand-strong)]">
              match
            </span>
          </div>
        </div>

        {/* Silkscreen label — bottom-right, off-center, like real chip markings */}
        <span className="pointer-events-none absolute bottom-3 right-3 font-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
          vmx · 01
        </span>
      </div>
    </div>
  );
}

/* ---------- Trace field (right-angle PCB-style paths) ---------- */

function TraceField({
  direction,
  className,
}: {
  direction: "right" | "left";
  className?: string;
}) {
  // viewBox is 100×60. Traces converge at the inner edge (the chip side):
  //   - right direction (LEFT half of layout): converge at x=100, y=30
  //   - left direction (RIGHT half of layout): converge at x=0,   y=30
  //
  // Each path bends with right angles only. 4 traces with different bend
  // depths so the field reads as a busy circuit, not a uniform comb.
  const isRight = direction === "right";

  // ViewBox is 100×80 (taller now to give the spaced lines room). All four
  // traces converge on the chip-side edge near y=40.
  const traces = isRight
    ? [
        "0,8  20,8  20,40 100,40",
        "0,28 38,28 38,40 100,40",
        "0,52 56,52 56,40 100,40",
        "0,72 70,72 70,40 100,40",
      ]
    : [
        "100,8  80,8  80,40 0,40",
        "100,28 62,28 62,40 0,40",
        "100,52 44,52 44,40 0,40",
        "100,72 30,72 30,40 0,40",
      ];

  // Card-side endpoints (where dots go on the card side)
  const cardEndpoints = isRight
    ? [
        [0, 8],
        [0, 28],
        [0, 52],
        [0, 72],
      ]
    : [
        [100, 8],
        [100, 28],
        [100, 52],
        [100, 72],
      ];
  const chipEndpoint = isRight ? [100, 40] : [0, 40];

  return (
    <svg
      viewBox="0 0 100 80"
      preserveAspectRatio="none"
      className={`${isRight ? "vm-trace-r" : "vm-trace-l"} ${className ?? ""}`}
      aria-hidden="true"
    >
      {traces.map((pts, i) => (
        <Fragment key={i}>
          {/* base (always visible, very subtle) */}
          <polyline
            points={pts}
            stroke="var(--color-border)"
            strokeWidth="1"
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
          {/* animated brand-green dashes flowing inward */}
          <polyline
            className="vm-trace-anim"
            points={pts}
            stroke="var(--color-brand)"
            strokeWidth="1.5"
            strokeDasharray="5 14"
            fill="none"
            opacity={0.85}
            style={{ animationDelay: `${i * 0.18}s` } as React.CSSProperties}
            vectorEffect="non-scaling-stroke"
          />
        </Fragment>
      ))}

      {/* PCB-via dots at the card-side endpoints */}
      {cardEndpoints.map(([x, y], i) => (
        <Fragment key={`endpoint-card-${i}`}>
          <circle cx={x} cy={y} r="2.5" fill="white" stroke="var(--color-brand)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <circle cx={x} cy={y} r="1" fill="var(--color-brand)" />
        </Fragment>
      ))}

      {/* Convergence dot at the chip-side endpoint (slightly larger) */}
      <circle cx={chipEndpoint[0]} cy={chipEndpoint[1]} r="3.5" fill="white" stroke="var(--color-brand)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <circle cx={chipEndpoint[0]} cy={chipEndpoint[1]} r="1.5" fill="var(--color-brand)" />
    </svg>
  );
}
