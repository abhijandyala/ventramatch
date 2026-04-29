"use client";

import { Fragment, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * MatchFlow — hero visual.
 *
 * Big square cards (startup left, investor right) with a center area that
 * shows: a small fake conversation between them (bubbles fade in one at a
 * time), an asymmetric processor "chip" that turns green from outer-to-inner,
 * and the chip's "match" text resolving to "matched!" once the chip fills.
 *
 * Then a new pair takes over.
 *
 * Cycle stages (per pair):
 *   1. messaging — bubbles spawn, alternating sides, with varied positions
 *   2. matching  — chip body fills green over ~1s
 *   3. matched   — center text swaps to "matched!", brief hold, then advance
 *
 * Pairings are illustrative; we never claim these matches actually happened.
 *
 * Respects prefers-reduced-motion: conversation, dashes, and chip fill all
 * pause; the matched state is shown as a static composition.
 */

type Side = {
  name: string;
  domain: string;
  category: string;
  /** italic one-liner: pitch (startups) or thesis (investors) */
  tagline: string;
  /** key data row shown mid-card */
  metric: { label: string; value: string };
  /** small chips listed at the bottom; keep ≤ 3, each ≤ ~14 chars */
  chips: string[];
};

type Message = {
  from: "startup" | "investor";
  text: string;
  /** position offset in pixels relative to the center area's center */
  x: number;
  y: number;
};

type Pair = { startup: Side; investor: Side; conversation: Message[] };

const PAIRS: Pair[] = [
  {
    startup: {
      name: "Cursor",
      domain: "cursor.com",
      category: "AI dev tools",
      tagline: "AI-first code editor for pros.",
      metric: { label: "Traction", value: "Top-of-funnel for dev AI" },
      chips: ["Pre-seed", "$1M raise", "San Francisco"],
    },
    investor: {
      name: "Sequoia",
      domain: "sequoiacap.com",
      category: "Tech, multi-stage",
      tagline: "Backing the daring since 1972.",
      metric: { label: "Portfolio", value: "Apple · Google · OpenAI" },
      chips: ["$250K – $5M", "AI · DevTools", "Menlo Park"],
    },
    conversation: [
      { from: "startup",  text: "Raising $1M for AI dev tools.",  x: -170, y: -120 },
      { from: "investor", text: "Pre-seed AI fits our thesis.",   x: 170,  y: 110  },
      { from: "startup",  text: "30 partners, 4 paying.",         x: -170, y: 120  },
    ],
  },
  {
    startup: {
      name: "Linear",
      domain: "linear.app",
      category: "Productivity",
      tagline: "Issue tracking for modern teams.",
      metric: { label: "Traction", value: "10K+ teams, 90% retention" },
      chips: ["Series A", "$15M raise", "San Francisco"],
    },
    investor: {
      name: "Accel",
      domain: "accel.com",
      category: "Software, growth",
      tagline: "Software-first venture capital.",
      metric: { label: "Portfolio", value: "Slack · Atlassian · Vercel" },
      chips: ["$5M – $40M", "SaaS · Tools", "Palo Alto"],
    },
    conversation: [
      { from: "startup",  text: "Series A, $15M for PLG growth.", x: -170, y: -130 },
      { from: "investor", text: "Productivity SaaS — our lane.",  x: 170,  y: -110 },
      { from: "startup",  text: "100K teams, 90% retention.",     x: -170, y: 120  },
    ],
  },
  {
    startup: {
      name: "Stripe",
      domain: "stripe.com",
      category: "Payments infra",
      tagline: "Payment APIs for the internet.",
      metric: { label: "Traction", value: "$1T+ processed" },
      chips: ["Seed", "$2M raise", "San Francisco"],
    },
    investor: {
      name: "Y Combinator",
      domain: "ycombinator.com",
      category: "Accelerator",
      tagline: "Make something people want.",
      metric: { label: "Portfolio", value: "Airbnb · Stripe · Reddit" },
      chips: ["$500K", "All sectors", "Mountain View"],
    },
    conversation: [
      { from: "startup",  text: "Payment APIs for the web.",       x: -170, y: -120 },
      { from: "investor", text: "Devtools fintech — apply W'09.",  x: 170,  y: 130  },
      { from: "startup",  text: "5 partners signed already.",      x: -170, y: 110  },
    ],
  },
  {
    startup: {
      name: "Anthropic",
      domain: "anthropic.com",
      category: "AI research",
      tagline: "AI safety, deeply considered.",
      metric: { label: "Traction", value: "Top-3 frontier AI lab" },
      chips: ["Series B", "$300M raise", "San Francisco"],
    },
    investor: {
      name: "a16z",
      domain: "a16z.com",
      category: "Tech, all stages",
      tagline: "Software is eating the world.",
      metric: { label: "Portfolio", value: "OpenAI · Coinbase · Figma" },
      chips: ["$10M – $100M", "AI · Frontier", "Menlo Park"],
    },
    conversation: [
      { from: "startup",  text: "Series B for Claude scaling.",    x: -170, y: -130 },
      { from: "investor", text: "Backing the safety-first lab.",   x: 170,  y: -110 },
      { from: "startup",  text: "Enterprise contracts ramping.",   x: -170, y: 120  },
    ],
  },
  {
    startup: {
      name: "Notion",
      domain: "notion.so",
      category: "Workspace",
      tagline: "All-in-one workspace.",
      metric: { label: "Traction", value: "30M+ active users" },
      chips: ["Series C", "$275M ARR", "San Francisco"],
    },
    investor: {
      name: "Index",
      domain: "indexventures.com",
      category: "Software, growth",
      tagline: "Building enduring companies.",
      metric: { label: "Portfolio", value: "Figma · Discord · Roblox" },
      chips: ["$5M – $50M", "Workspace · SaaS", "London / SF"],
    },
    conversation: [
      { from: "startup",  text: "Series C, going international.",  x: -170, y: -110 },
      { from: "investor", text: "Workspace category leader.",      x: 170,  y: 130  },
      { from: "startup",  text: "30M users globally.",             x: -170, y: 130  },
    ],
  },
];

type Stage = "messaging" | "matching" | "matched";

const MESSAGE_DELAY_MS = 700;
const MESSAGE_GAP_MS = 900;
const MATCH_HOLD_MS = 1800;
const MATCHING_DURATION_MS = 1000;

export function MatchFlow() {
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<Stage>("messaging");
  const [visibleMessages, setVisibleMessages] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    const pair = PAIRS[index];

    if (reduced) {
      // Static composition: full conversation visible, fully matched.
      setStage("matched");
      setVisibleMessages(pair.conversation.length);
      return;
    }

    setStage("messaging");
    setVisibleMessages(0);

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Spawn each conversation bubble at staggered intervals.
    pair.conversation.forEach((_, i) => {
      timers.push(
        setTimeout(() => setVisibleMessages(i + 1), MESSAGE_DELAY_MS + i * MESSAGE_GAP_MS),
      );
    });

    const conversationEnd = MESSAGE_DELAY_MS + pair.conversation.length * MESSAGE_GAP_MS;

    // After messaging settles, start the chip's green-fill.
    timers.push(setTimeout(() => setStage("matching"), conversationEnd + 600));
    // After the fill duration, swap text to "matched!".
    timers.push(
      setTimeout(() => setStage("matched"), conversationEnd + 600 + MATCHING_DURATION_MS),
    );
    // Hold then advance to the next pair.
    timers.push(
      setTimeout(
        () => setIndex((i) => (i + 1) % PAIRS.length),
        conversationEnd + 600 + MATCHING_DURATION_MS + MATCH_HOLD_MS,
      ),
    );

    return () => timers.forEach(clearTimeout);
  }, [index, reduced]);

  const pair = PAIRS[index];

  return (
    <div className="relative mx-auto w-full max-w-[1280px]">
      {/* Scoped trace-flow keyframes (slowed down per the spec) */}
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
          animation: vm-trace-right 3.4s linear infinite;
        }
        :global(.vm-trace-l .vm-trace-anim) {
          animation: vm-trace-left 3.4s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.vm-trace-anim) {
            animation: none !important;
          }
        }
      `}</style>

      <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(360px,440px)_minmax(0,1fr)] items-stretch gap-6 sm:gap-8">
        {/* LEFT — startup */}
        <div className="relative flex min-w-0 justify-end">
          <AnimatePresence mode="wait">
            <motion.div
              key={`s-${index}`}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[380px]"
            >
              <SideCard side={pair.startup} role="startup" />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* CENTER — conversation overlay + chip + traces */}
        <div className="relative flex min-h-[380px] items-center justify-center">
          <TraceField
            direction="right"
            className="absolute left-0 top-1/2 h-[260px] w-[calc(50%-140px)] -translate-y-1/2"
          />
          <TraceField
            direction="left"
            className="absolute right-0 top-1/2 h-[260px] w-[calc(50%-140px)] -translate-y-1/2"
          />
          <ConversationOverlay
            key={`conv-${index}`}
            messages={pair.conversation}
            visibleCount={visibleMessages}
          />
          <MatchChip stage={stage} />
        </div>

        {/* RIGHT — investor */}
        <div className="relative flex min-w-0 justify-start">
          <AnimatePresence mode="wait">
            <motion.div
              key={`i-${index}`}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[380px]"
            >
              <SideCard side={pair.investor} role="investor" />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   Cards
   ========================================================================= */

function SideCard({ side, role }: { side: Side; role: "startup" | "investor" }) {
  return (
    <div
      className="relative flex aspect-square w-full flex-col rounded-[18px] border border-[color:var(--color-border)] bg-white p-7 shadow-[0_1px_0_rgba(15,23,42,0.04),0_28px_56px_-32px_rgba(15,23,42,0.18)]"
      aria-label={`${role === "startup" ? "Startup" : "Investor"}: ${side.name}, ${side.category}`}
    >
      {/* Top: role label */}
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[color:var(--color-text-faint)]">
        {role === "startup" ? "Startup" : "Investor"}
      </span>

      {/* Logo + name + category */}
      <div className="mt-6 flex items-center gap-4">
        <CompanyLogo domain={side.domain} name={side.name} />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-[24px] font-semibold tracking-[-0.012em] text-[color:var(--color-text-strong)]">
            {side.name}
          </span>
          <span className="mt-1.5 text-[14px] text-[color:var(--color-text-muted)]">
            {side.category}
          </span>
        </span>
      </div>

      {/* Divider */}
      <div className="my-6 h-px w-full bg-[color:var(--color-border)]" />

      {/* Tagline (italic, like a quote) */}
      <p className="text-[14px] italic leading-snug text-[color:var(--color-text-muted)]">
        &ldquo;{side.tagline}&rdquo;
      </p>

      {/* Metric */}
      <div className="mt-5">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[color:var(--color-text-faint)]">
          {side.metric.label}
        </p>
        <p className="mt-1.5 text-[14px] font-medium text-[color:var(--color-text-strong)]">
          {side.metric.value}
        </p>
      </div>

      {/* Spacer pushes chips to the bottom */}
      <div className="flex-1" />

      {/* Chips */}
      <div className="flex flex-wrap gap-2">
        {side.chips.map((c) => (
          <span
            key={c}
            className="rounded-[7px] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-2.5 py-1 text-[12px] font-medium text-[color:var(--color-text-strong)]"
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

function CompanyLogo({ domain, name }: { domain: string; name: string }) {
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

/* =========================================================================
   Conversation overlay
   ========================================================================= */

function ConversationOverlay({
  messages,
  visibleCount,
}: {
  messages: Message[];
  visibleCount: number;
}) {
  // Each bubble is wrapped twice: an outer positioning div carries the
  // centered (x, y) offset transform, and a motion.div inside handles the
  // entrance fade. Splitting these prevents Framer Motion's transforms from
  // overriding the position transform.
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div className="relative h-full w-full">
        <AnimatePresence>
          {messages.slice(0, visibleCount).map((m, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                left: `calc(50% + ${m.x}px)`,
                top: `calc(50% + ${m.y}px)`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <ChatBubble from={m.from} text={m.text} />
              </motion.div>
            </div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ChatBubble({ from, text }: { from: "startup" | "investor"; text: string }) {
  // iMessage-style chat bubble:
  //   - startup bubble lives on the LEFT side, has a tail at bottom-LEFT
  //     pointing toward the startup card
  //   - investor bubble lives on the RIGHT side, has a tail at bottom-RIGHT
  //     pointing toward the investor card
  //   - bubble's tail-side bottom corner is less rounded so the tail attaches
  //     naturally (this is exactly how iMessage shapes its bubbles)
  const isStartup = from === "startup";

  const fillVar = isStartup ? "var(--color-surface)" : "var(--color-brand-tint)";
  const borderVar = isStartup ? "var(--color-info)" : "var(--color-brand)";

  return (
    <div className="relative">
      <div
        className={`relative whitespace-nowrap border px-4 py-2.5 text-[13px] leading-[1.45] shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)] ${
          isStartup
            ? "rounded-[20px] rounded-bl-[6px] text-[color:var(--color-text-strong)]"
            : "rounded-[20px] rounded-br-[6px] text-[color:var(--color-brand-strong)]"
        }`}
        style={{
          backgroundColor: fillVar,
          borderColor: `color-mix(in oklab, ${borderVar} 35%, transparent)`,
        }}
      >
        {text}
      </div>

      {/* Tail. Path is open (no Z) so the stroke only traces the two OUTER
         edges, blending with the bubble's border on the seam side. */}
      <svg
        className={`absolute h-3.5 w-3 ${isStartup ? "-left-[6px]" : "-right-[6px]"} bottom-[2px]`}
        viewBox="0 0 12 14"
        aria-hidden
      >
        <path
          d={isStartup ? "M 12 0 L 0 14 L 12 14" : "M 0 0 L 12 14 L 0 14"}
          fill={fillVar}
          stroke={`color-mix(in oklab, ${borderVar} 35%, transparent)`}
          strokeWidth="1"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

/* =========================================================================
   Center chip
   ========================================================================= */

function MatchChip({ stage }: { stage: Stage }) {
  const isFilled = stage !== "messaging"; // matching or matched

  // Asymmetric pin layout (left ≠ right; top clusters right; bottom clusters left)
  const leftPins = [22, 50, 72];
  const rightPins = [12, 28, 44, 60, 76, 92];
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

      {/* Chip body — animates background color from white to brand-green
         over MATCHING_DURATION_MS, with an outer-to-inner radial fill. */}
      <motion.div
        animate={{
          backgroundColor: isFilled ? "var(--color-brand)" : "var(--color-surface)",
          borderColor: isFilled ? "var(--color-brand-strong)" : "var(--color-border-strong)",
        }}
        transition={{ duration: MATCHING_DURATION_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
        className="relative h-[160px] w-[220px] overflow-hidden rounded-[8px] border shadow-[0_14px_44px_-14px_rgba(22,163,74,0.4)]"
      >
        {/* Corner notches (3 — top-right omitted for orientation) */}
        <span className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 border-l-2 border-t-2 border-[color:var(--color-brand)]" />
        <span className="pointer-events-none absolute bottom-2 left-2 h-3.5 w-3.5 border-l-2 border-b-2 border-[color:var(--color-brand)]" />
        <span className="pointer-events-none absolute bottom-2 right-2 h-3.5 w-3.5 border-r-2 border-b-2 border-[color:var(--color-brand)]" />

        {/* Pin 1 indicator */}
        <span
          className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-[color:var(--color-brand)]"
          style={{ left: 14, top: 14 }}
        />

        {/* Internal grid (uneven) */}
        <div className="pointer-events-none absolute inset-0 opacity-25">
          <span className="absolute left-0 right-0 block h-px bg-[color:var(--color-brand)]" style={{ top: "32%" }} />
          <span className="absolute left-0 right-0 block h-px bg-[color:var(--color-brand)]" style={{ top: "72%" }} />
          <span className="absolute top-0 bottom-0 block w-px bg-[color:var(--color-brand)]" style={{ left: "26%" }} />
          <span className="absolute top-0 bottom-0 block w-px bg-[color:var(--color-brand)]" style={{ left: "62%" }} />
        </div>

        {/* Inner core (white box). Stays white even when outer fills green —
           per the spec, the inner box is "shielded" from the green wash.
           Centered both axes on the chip body. */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative flex items-center gap-1 rounded-[6px] border border-[color:var(--color-brand)]/45 bg-[color:var(--color-bg)] px-4 py-2">
            <span className="pointer-events-none absolute -left-[3px] -top-[3px] h-1.5 w-1.5 bg-[color:var(--color-brand)]" />
            <span className="pointer-events-none absolute -right-[3px] -top-[3px] h-1.5 w-1.5 bg-[color:var(--color-brand)]" />
            <span className="pointer-events-none absolute -left-[3px] -bottom-[3px] h-1.5 w-1.5 bg-[color:var(--color-brand)]" />
            <span className="pointer-events-none absolute -right-[3px] -bottom-[3px] h-1.5 w-1.5 bg-[color:var(--color-brand)]" />

            <AnimatePresence mode="wait">
              <motion.span
                key={stage === "matched" ? "matched" : "match"}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="text-[20px] font-semibold tracking-tight text-[color:var(--color-brand-strong)]"
              >
                {stage === "matched" ? "matched!" : "match"}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {/* Silkscreen label */}
        <span className="pointer-events-none absolute bottom-3 right-3 font-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
          vmx · 01
        </span>
      </motion.div>
    </div>
  );
}

/* =========================================================================
   Trace field — right-angle PCB-style polylines with endpoint dots
   ========================================================================= */

function TraceField({
  direction,
  className,
}: {
  direction: "right" | "left";
  className?: string;
}) {
  const isRight = direction === "right";

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
          <polyline
            points={pts}
            stroke="var(--color-border)"
            strokeWidth="1"
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            className="vm-trace-anim"
            points={pts}
            stroke="var(--color-brand)"
            strokeWidth="1.5"
            strokeDasharray="6 18"
            fill="none"
            opacity={0.85}
            style={{ animationDelay: `${i * 0.32}s` } as React.CSSProperties}
            vectorEffect="non-scaling-stroke"
          />
        </Fragment>
      ))}

      {cardEndpoints.map(([x, y], i) => (
        <Fragment key={`endpoint-card-${i}`}>
          <circle
            cx={x}
            cy={y}
            r="2.5"
            fill="white"
            stroke="var(--color-brand)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={x} cy={y} r="1" fill="var(--color-brand)" />
        </Fragment>
      ))}
      <circle
        cx={chipEndpoint[0]}
        cy={chipEndpoint[1]}
        r="3.5"
        fill="white"
        stroke="var(--color-brand)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={chipEndpoint[0]} cy={chipEndpoint[1]} r="1.5" fill="var(--color-brand)" />
    </svg>
  );
}
