"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Reveal } from "@/components/landing/reveal";
import { MediaSlot } from "@/components/landing/media-slot";
import type { MediaSlotId } from "@/lib/landing/media";

/**
 * FiveInputs — the algorithm, made readable.
 *
 * Layout: centered head + a 5-tab strip + one large showcase card. The
 * active tab's underline doubles as a progress bar that fills over the
 * cycle window; when it completes, the next tab takes over. Modeled on
 * Serval's "Get to know Serval" pattern.
 *
 * Behavior contracts:
 *   - Auto-advances every CYCLE_MS while the section is in view.
 *   - Underline progress bar is the canonical timer (CSS animation), and
 *     `onAnimationEnd` advances the active tab so visual + state stay
 *     locked together.
 *   - Hover / focus pauses the animation in place via
 *     animation-play-state; mouse leave / blur resumes from that point.
 *   - prefers-reduced-motion: stays on the first tab, no auto-advance,
 *     no crossfade between panels.
 *   - Real <button role="tab"> elements with aria-selected / aria-controls.
 */

const CYCLE_MS = 5500;

type Input = {
  key: string;
  name: string;
  weightPct: number;
  body: string;
  slot: MediaSlotId;
};

const INPUTS: Input[] = [
  {
    key: "sector",
    name: "Sector",
    weightPct: 30,
    body:
      "Investor sectors versus startup industry. Exact match scores 1.0; curated synonyms ship in v1.1. The biggest single signal. Most early-stage investors will not write outside their declared categories.",
    slot: "inputSector",
  },
  {
    key: "stage",
    name: "Stage",
    weightPct: 25,
    body:
      "Pre-seed, seed, Series A, Series B+. The investor must explicitly back the stage; no fuzzy guessing. A pre-seed founder pitching a Series B fund is the most common kind of wasted email.",
    slot: "inputStage",
  },
  {
    key: "check",
    name: "Check size",
    weightPct: 20,
    body:
      "Inside the investor's stated band scores 1.0. Outside falls off linearly toward 0. A $50K angel and a $5M lead are both wrong-fit when the raise size is wrong, even if every other input lines up.",
    slot: "inputCheck",
  },
  {
    key: "geography",
    name: "Geography",
    weightPct: 15,
    body:
      "Soft signal. In-market scores 1.0; out-of-market still scores 0.4 because angels often go remote. Weighted lower than the harder filters because geography binds less than people think it does.",
    slot: "inputGeography",
  },
  {
    key: "traction",
    name: "Traction",
    weightPct: 10,
    body:
      "Self-reported text length is the v1 stub. v1.1 parses MRR, paying customers, and pilots into normalized signal. Lowest weight on purpose: traction is the easiest input to fake on a profile.",
    slot: "inputTraction",
  },
];

export function FiveInputs() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  // Only cycle when the section is on screen.
  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.25 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  const current = INPUTS[active];
  const animationActive = !reduced && inView;
  // The underline pauses on hover but stays visible at its current width.
  const playState = paused ? "paused" : "running";

  const advance = () => {
    if (paused) return; // safety: don't advance while user is hovering
    setActive((a) => (a + 1) % INPUTS.length);
  };

  return (
    <section
      ref={sectionRef}
      id="how"
      className="border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]"
    >
      <div className="mx-auto max-w-[1280px] px-6 py-20 md:py-24">
        {/* ---------- Section head — minimal label only ---------- */}
        <Reveal>
          <h2 className="text-center font-mono text-[16px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-strong)] md:text-[18px]">
            The algorithm
          </h2>
        </Reveal>

        {/* ---------- Tab strip — bordered segmented control ---------- */}
        <Reveal delay={120}>
          <div className="mt-8 flex justify-center md:mt-10">
            <div
              role="tablist"
              aria-label="Match score inputs"
              className="inline-flex items-stretch overflow-hidden rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
            >
              {INPUTS.map((it, i) => {
                const isActive = i === active;
                return (
                  <button
                    key={it.key}
                    type="button"
                    role="tab"
                    id={`five-inputs-tab-${it.key}`}
                    aria-selected={isActive}
                    aria-controls={`five-inputs-panel-${it.key}`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setActive(i)}
                    onMouseEnter={() => setPaused(true)}
                    onMouseLeave={() => setPaused(false)}
                    onFocus={() => setPaused(true)}
                    onBlur={() => setPaused(false)}
                    className={[
                      "relative px-4 py-3 text-[13px] font-medium transition-colors md:px-6 md:py-3.5 md:text-[14px]",
                      i > 0
                        ? "border-l border-[color:var(--color-border)]"
                        : "",
                      isActive
                        ? "text-[color:var(--color-text-strong)]"
                        : "text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-bg)] hover:text-[color:var(--color-text-strong)]",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="flex items-center gap-2">
                      <span>{it.name}</span>
                      <span
                        className={[
                          "font-mono text-[10px] tabular-nums transition-colors md:text-[11px]",
                          isActive
                            ? "text-[color:var(--color-brand)]"
                            : "text-[color:var(--color-text-faint)]",
                        ].join(" ")}
                      >
                        {it.weightPct}%
                      </span>
                    </span>

                    {isActive &&
                      (animationActive ? (
                        <span
                          // key on `active` so the bar resets when tab changes;
                          // pause/resume happens via animationPlayState (no remount).
                          key={active}
                          onAnimationEnd={advance}
                          style={{
                            transformOrigin: "left",
                            animation: `vm-progress ${CYCLE_MS}ms linear forwards`,
                            animationPlayState: playState,
                          }}
                          className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] bg-[color:var(--color-text-strong)]"
                        />
                      ) : (
                        // Reduced motion / out of view: solid underline, no animation.
                        <span className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] bg-[color:var(--color-text-strong)]" />
                      ))}
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* ---------- Showcase card · 4/8 split, image-led ---------- */}
        <div className="mt-10">
          <div
            className="relative overflow-hidden rounded-[20px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div
              role="tabpanel"
              id={`five-inputs-panel-${current.key}`}
              aria-labelledby={`five-inputs-tab-${current.key}`}
              className="grid grid-cols-1 md:min-h-[520px] md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]"
            >
              {/* left: copy (compact) */}
              <div className="relative flex items-center p-7 md:p-9 lg:p-11">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={current.key}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{
                      duration: 0.35,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
                      {String(active + 1).padStart(2, "0")} / 05
                    </p>
                    <h3
                      className="mt-3 font-semibold tracking-[-0.012em] text-[color:var(--color-text-strong)]"
                      style={{
                        fontSize: "clamp(22px, 2.4vw, 28px)",
                        lineHeight: 1.1,
                      }}
                    >
                      {current.name}
                    </h3>
                    <p className="mt-4 max-w-[36ch] text-[13.5px] leading-[1.6] text-[color:var(--color-text-muted)]">
                      {current.body}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* right: media (dominant) */}
              <div className="relative flex items-center justify-center border-t border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-5 md:border-l md:border-t-0 md:p-7 lg:p-8">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={current.key}
                    initial={{ opacity: 0, scale: 0.985 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.985 }}
                    transition={{
                      duration: 0.35,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="w-full max-w-[560px]"
                  >
                    <MediaSlot slot={current.slot} className="rounded-[14px]" />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
