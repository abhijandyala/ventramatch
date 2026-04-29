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
    <div className="relative mx-auto w-full max-w-[1000px]">
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

      <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(180px,260px)_minmax(0,1fr)] items-center gap-4 sm:gap-6">
        {/* LEFT — startup */}
        <div className="relative flex min-w-0 justify-end">
          <AnimatePresence mode="wait">
            <motion.div
              key={`s-${index}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[340px]"
            >
              <SideCard side={pair.startup} role="startup" />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* CENTER — traces + chip */}
        <div className="relative flex h-[140px] items-center justify-center">
          <TraceField direction="right" className="absolute left-0 top-1/2 h-[100px] w-[calc(50%-72px)] -translate-y-1/2" />
          <TraceField direction="left" className="absolute right-0 top-1/2 h-[100px] w-[calc(50%-72px)] -translate-y-1/2" />
          <MatchChip />
        </div>

        {/* RIGHT — investor */}
        <div className="relative flex min-w-0 justify-start">
          <AnimatePresence mode="wait">
            <motion.div
              key={`i-${index}`}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[340px]"
            >
              <SideCard side={pair.investor} role="investor" />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <p className="mt-7 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-faint)]">
        Sample pairings · cycling
      </p>
    </div>
  );
}

/* ---------- Cards ---------- */

function SideCard({ side, role }: { side: Side; role: "startup" | "investor" }) {
  return (
    <div
      className="relative flex w-full flex-col gap-4 rounded-[12px] border border-[color:var(--color-border)] bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04),0_18px_36px_-24px_rgba(15,23,42,0.16)]"
      aria-label={`${role === "startup" ? "Startup" : "Investor"}: ${side.name}, ${side.category}`}
    >
      <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[color:var(--color-text-faint)]">
        {role === "startup" ? "Startup" : "Investor"}
      </span>
      <div className="flex items-center gap-4">
        <CompanyLogo domain={side.domain} name={side.name} />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-[16px] font-semibold tracking-[-0.005em] text-[color:var(--color-text-strong)]">
            {side.name}
          </span>
          <span className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
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
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] bg-[color:var(--color-brand-tint)] text-[18px] font-semibold text-[color:var(--color-brand-strong)]">
        {initial}
      </span>
    );
  }

  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-[color:var(--color-border)] bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 object-contain"
        loading="lazy"
        decoding="async"
        onError={() => setErrored(true)}
      />
    </span>
  );
}

/* ---------- Center chip ---------- */

function MatchChip() {
  return (
    <div className="relative z-10 flex items-center gap-2 rounded-[10px] border border-[color:var(--color-border-strong)] bg-white px-4 py-2.5 shadow-[0_6px_24px_-6px_rgba(22,163,74,0.35)]">
      {/* SMT-style corner pads */}
      <span className="pointer-events-none absolute -left-[3px] -top-[3px] h-1.5 w-1.5 rounded-[1px] bg-[color:var(--color-border-strong)]" />
      <span className="pointer-events-none absolute -right-[3px] -top-[3px] h-1.5 w-1.5 rounded-[1px] bg-[color:var(--color-border-strong)]" />
      <span className="pointer-events-none absolute -left-[3px] -bottom-[3px] h-1.5 w-1.5 rounded-[1px] bg-[color:var(--color-border-strong)]" />
      <span className="pointer-events-none absolute -right-[3px] -bottom-[3px] h-1.5 w-1.5 rounded-[1px] bg-[color:var(--color-border-strong)]" />

      {/* Lead indicators (where traces visually attach) */}
      <span className="pointer-events-none absolute -left-2 top-1/2 h-[2px] w-2 -translate-y-1/2 bg-[color:var(--color-brand)]" />
      <span className="pointer-events-none absolute -right-2 top-1/2 h-[2px] w-2 -translate-y-1/2 bg-[color:var(--color-brand)]" />

      {/* Body */}
      <Image
        src="/logo.png"
        alt=""
        width={18}
        height={18}
        className="object-contain"
        style={{ height: 18, width: "auto" }}
      />
      <span className="text-[14px] font-semibold tracking-tight text-[color:var(--color-brand-strong)]">
        match
      </span>
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

  const traces = isRight
    ? [
        "0,12 22,12 22,30 100,30",
        "0,28 100,28",
        "0,32 100,32",
        "0,48 64,48 64,30 100,30",
      ]
    : [
        "100,12 78,12 78,30 0,30",
        "100,28 0,28",
        "100,32 0,32",
        "100,48 36,48 36,30 0,30",
      ];

  return (
    <svg
      viewBox="0 0 100 60"
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
            strokeWidth="1.25"
            strokeDasharray="4 12"
            fill="none"
            opacity={i === 1 || i === 2 ? 0.55 : 0.85}
            style={{ animationDelay: `${i * 0.18}s` } as React.CSSProperties}
            vectorEffect="non-scaling-stroke"
          />
        </Fragment>
      ))}
    </svg>
  );
}
