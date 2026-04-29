"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Wordmark } from "@/components/landing/wordmark";

/**
 * /score — Dedicated page for the "We score the fit, openly." statement.
 *
 * Auto-cycling visualization in the spirit of MatchFlow on the home page:
 * two parties flank a circular score gauge; below the gauge the five
 * inputs reveal one at a time, each pushing the gauge forward and
 * stamping a checkmark. After all five are revealed, a one-line reason
 * appears underneath. Then the cycle moves to the next pair.
 *
 * No real backend — scores are hand-tuned per pair to demo the algorithm.
 *
 * Behavior:
 *   - Auto-advances every CYCLE_MS while in view
 *   - Pauses on hover; mouse-leave or any scroll resumes
 *   - prefers-reduced-motion: shows the final state of pair 1, no cycle
 *   - Click a progress dot to jump to a pair
 */

const CYCLE_MS = 10000;
const REVEAL_FIRST_DELAY_MS = 700;
const REVEAL_INTERVAL_MS = 700;
const REASON_DELAY_MS = 4700;

type Input = {
  key: string;
  label: string;
  value: number; // 0..1 normalized
  weight: number; // % weight (sum to 100)
  reason: string;
};

type Party = {
  name: string;
  meta: string; // e.g. "AI / ML · Serverless compute"
  detail: string; // e.g. "Seed · $1.0M raise · NYC"
  initial: string; // 2-letter for the avatar
};

type Pair = {
  id: string;
  startup: Party;
  investor: Party;
  inputs: Input[];
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
      {
        key: "sector",
        label: "Sector",
        value: 0.95,
        weight: 30,
        reason: "AI infra ⊂ AI / ML",
      },
      {
        key: "stage",
        label: "Stage",
        value: 1.0,
        weight: 25,
        reason: "Both back Seed",
      },
      {
        key: "check",
        label: "Check size",
        value: 1.0,
        weight: 20,
        reason: "$1.0M inside band",
      },
      {
        key: "geo",
        label: "Geography",
        value: 1.0,
        weight: 15,
        reason: "NYC ⇄ NYC",
      },
      {
        key: "traction",
        label: "Traction",
        value: 0.5,
        weight: 10,
        reason: "Early — 3-mo growth only",
      },
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
      {
        key: "sector",
        label: "Sector",
        value: 0.3,
        weight: 30,
        reason: "Consumer fintech outside thesis",
      },
      {
        key: "stage",
        label: "Stage",
        value: 0.5,
        weight: 25,
        reason: "KV rarely writes pre-seed",
      },
      {
        key: "check",
        label: "Check size",
        value: 0.4,
        weight: 20,
        reason: "$500K below their band",
      },
      {
        key: "geo",
        label: "Geography",
        value: 1.0,
        weight: 15,
        reason: "Both SF",
      },
      {
        key: "traction",
        label: "Traction",
        value: 0.8,
        weight: 10,
        reason: "Strong metrics for stage",
      },
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
      {
        key: "sector",
        label: "Sector",
        value: 0.85,
        weight: 30,
        reason: "Healthtech ∩ Health systems",
      },
      {
        key: "stage",
        label: "Stage",
        value: 1.0,
        weight: 25,
        reason: "Both back Seed",
      },
      {
        key: "check",
        label: "Check size",
        value: 1.0,
        weight: 20,
        reason: "$3.0M inside band",
      },
      {
        key: "geo",
        label: "Geography",
        value: 0.4,
        weight: 15,
        reason: "Boston ⇄ Bay Area, soft signal",
      },
      {
        key: "traction",
        label: "Traction",
        value: 0.7,
        weight: 10,
        reason: "Solid pilots",
      },
    ],
    reason:
      "Strong fit on the algorithm; geography is the only soft signal.",
  },
];

export default function ScorePage() {
  const [pairIdx, setPairIdx] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [showReason, setShowReason] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [inView, setInView] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollAtRef = useRef<number>(0);

  // prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  // intersection observer (cycle only when on screen)
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

  // suppress hover-pause that fires while the user is scrolling
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

  // animation orchestration: reveal inputs one by one, then reason, then advance
  useEffect(() => {
    setRevealedCount(0);
    setShowReason(false);

    if (reduced) {
      // Show the final state of the current pair, no auto-cycle
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
    timeouts.push(
      window.setTimeout(() => setShowReason(true), REASON_DELAY_MS),
    );
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
    <main className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
      {/* ---------- Top bar ---------- */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]/85 px-5 backdrop-blur md:px-8">
        <Wordmark size="sm" />
        <Link
          href="/"
          className="text-[12.5px] text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-strong)]"
        >
          ← Back to home
        </Link>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="mx-auto max-w-[840px] px-5 py-16 text-center md:px-6 md:py-20">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
          02 · Open scoring
        </p>
        <h1
          className="mt-5 text-balance font-semibold text-[color:var(--color-text-strong)]"
          style={{
            fontSize: "clamp(36px, 5.4vw, 60px)",
            lineHeight: 1.04,
            letterSpacing: "var(--tracking-h1)",
          }}
        >
          We score the fit,{" "}
          <span className="text-[color:var(--color-brand)]">openly</span>.
        </h1>
        <p className="mx-auto mt-5 max-w-[58ch] text-pretty text-[15.5px] leading-[1.6] text-[color:var(--color-text-muted)]">
          Every match shows the percentage and a one-line reason. The exact
          formula lives in the repo at{" "}
          <code className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-1.5 py-0.5 font-mono text-[12.5px] font-medium text-[color:var(--color-text-strong)]">
            lib/matching/score.ts
          </code>
          .
        </p>
      </section>

      {/* ---------- Animated viz ---------- */}
      <section
        ref={containerRef}
        className="mx-auto w-full max-w-[1080px] px-5 pb-24 md:px-6 md:pb-32"
        onMouseEnter={onHoverEnter}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="overflow-hidden rounded-[24px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
          {/* Top: cards + gauge */}
          <div className="grid grid-cols-1 items-center gap-8 p-7 md:grid-cols-[1fr_auto_1fr] md:gap-10 md:p-10 lg:p-14">
            <PartyCard
              label="Startup"
              party={pair.startup}
              align="left"
              pairId={pair.id}
            />
            <Gauge score={score} pairId={pair.id} />
            <PartyCard
              label="Investor"
              party={pair.investor}
              align="right"
              pairId={pair.id}
            />
          </div>

          <div className="border-t border-[color:var(--color-border)]" />

          {/* Breakdown */}
          <div className="p-7 md:p-10 lg:p-14">
            <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
              Breakdown
            </p>
            <ul className="mt-4 divide-y divide-[color:var(--color-border)]">
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

            {/* Reason quote */}
            <div className="mt-7 min-h-[68px]">
              <AnimatePresence mode="wait">
                {showReason && (
                  <motion.div
                    key={pair.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
                      One-line reason
                    </p>
                    <p className="mt-2 max-w-[60ch] text-[15px] leading-[1.55] text-[color:var(--color-text-strong)]">
                      &ldquo;{pair.reason}&rdquo;
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Pair progress dots + formula link */}
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
      </section>
    </main>
  );
}

/* ---------------- Components ---------------- */

function PartyCard({
  label,
  party,
  align,
  pairId,
}: {
  label: string;
  party: Party;
  align: "left" | "right";
  pairId: string;
}) {
  return (
    <motion.div
      key={`${pairId}-${align}`}
      initial={{ opacity: 0, x: align === "left" ? -16 : 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={[
        "rounded-[16px] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] p-5",
        align === "right" ? "text-right" : "text-left",
      ].join(" ")}
    >
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
        {label}
      </p>
      <div
        className={[
          "mt-2.5 flex items-center gap-3",
          align === "right" ? "flex-row-reverse" : "",
        ].join(" ")}
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-[color:var(--color-surface)] font-mono text-[11px] font-semibold uppercase text-[color:var(--color-text-strong)] ring-1 ring-[color:var(--color-border)]">
          {party.initial}
        </div>
        <p className="text-[16px] font-semibold leading-tight text-[color:var(--color-text-strong)]">
          {party.name}
        </p>
      </div>
      <p className="mt-3 text-[12.5px] text-[color:var(--color-text-muted)]">
        {party.meta}
      </p>
      <p className="mt-1 font-mono text-[11px] text-[color:var(--color-text-faint)]">
        {party.detail}
      </p>
    </motion.div>
  );
}

function Gauge({ score, pairId }: { score: number; pairId: string }) {
  const r = 86;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto h-[210px] w-[210px]" key={pairId}>
      <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
        {/* Track */}
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="6"
        />
        {/* Fill */}
        <motion.circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          transform="rotate(-90 100 100)"
        />
        {/* 25 / 50 / 75 ticks (subtle) */}
        {[0.25, 0.5, 0.75].map((t) => {
          const angle = -Math.PI / 2 + t * Math.PI * 2;
          const x1 = 100 + Math.cos(angle) * (r + 6);
          const y1 = 100 + Math.sin(angle) * (r + 6);
          const x2 = 100 + Math.cos(angle) * (r + 11);
          const y2 = 100 + Math.sin(angle) * (r + 11);
          return (
            <line
              key={t}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--color-border-strong)"
              strokeWidth={1}
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
          <span className="ml-0.5 text-[28px] text-[color:var(--color-text-muted)]">
            %
          </span>
        </motion.span>
        <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
          Match score
        </span>
      </div>
    </div>
  );
}

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
        animate={{ opacity: revealed ? 1 : 0.28 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center gap-4 py-3 md:gap-6"
      >
        <span
          className={[
            "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold transition-colors",
            revealed
              ? "bg-[color:var(--color-brand)] text-white"
              : "border border-[color:var(--color-border-strong)] text-[color:var(--color-text-faint)]",
          ].join(" ")}
        >
          {revealed ? "✓" : ""}
        </span>
        <span className="w-[100px] shrink-0 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-[color:var(--color-text-strong)]">
          {input.label}
        </span>
        <span className="flex-1 truncate text-[13.5px] text-[color:var(--color-text-muted)]">
          {input.reason}
        </span>
        <span className="hidden w-[70px] shrink-0 text-right font-mono text-[11px] tabular-nums text-[color:var(--color-text-faint)] sm:inline">
          weight {input.weight}
        </span>
        <span className="w-[60px] shrink-0 text-right font-mono text-[12px] font-semibold tabular-nums text-[color:var(--color-text-strong)]">
          +{contribution}
        </span>
      </motion.div>
    </li>
  );
}
