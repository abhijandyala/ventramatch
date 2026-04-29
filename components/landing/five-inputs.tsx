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
      <div className="mx-auto max-w-[1280px] px-6 py-24 md:py-32">
        {/* ---------- Section head ---------- */}
        <div className="mx-auto max-w-[60ch] text-center">
          <Reveal>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
              The algorithm
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h2
              className="mt-5 text-balance font-semibold text-[color:var(--color-text-strong)]"
              style={{
                fontSize: "var(--type-h1)",
                letterSpacing: "var(--tracking-h1)",
                lineHeight: 1.05,
              }}
            >
              Five inputs. One score. Always shown.
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p
              className="mt-5 text-pretty text-[color:var(--color-text-muted)]"
              style={{ fontSize: "var(--type-body-lg)", lineHeight: 1.55 }}
            >
              Match scores are a weighted sum, not a black-box ranking. The
              exact formula lives in the repo at{" "}
              <code className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-1.5 py-0.5 font-mono text-[13px] font-medium text-[color:var(--color-text-strong)]">
                lib/matching/score.ts
              </code>
              .
            </p>
          </Reveal>
        </div>

        {/* ---------- Tab strip (underline = progress bar) ---------- */}
        <Reveal delay={240}>
          <div
            role="tablist"
            aria-label="Match score inputs"
            className="mt-14 flex flex-wrap items-center justify-center gap-x-1 gap-y-1 border-b border-[color:var(--color-border)] md:mt-16"
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
                    "relative px-4 pb-3 pt-2 text-[13px] font-medium transition-colors md:px-5 md:text-[14px]",
                    isActive
                      ? "text-[color:var(--color-text-strong)]"
                      : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-strong)]",
                  ].join(" ")}
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
                        className="absolute -bottom-[1px] left-2 right-2 h-[2px] rounded-full bg-[color:var(--color-text-strong)] md:left-3 md:right-3"
                      />
                    ) : (
                      // Reduced motion / out of view: solid underline, no animation.
                      <span className="absolute -bottom-[1px] left-2 right-2 h-[2px] rounded-full bg-[color:var(--color-text-strong)] md:left-3 md:right-3" />
                    ))}
                </button>
              );
            })}
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
                    <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-1">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-text-faint)]">
                        Weight
                      </span>
                      <span className="font-mono text-[12px] font-semibold tabular-nums text-[color:var(--color-brand)]">
                        {current.weightPct}%
                      </span>
                    </div>
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

        <p className="mt-6 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--color-text-faint)]">
          Hover to pause · click any tab to jump
        </p>
      </div>
    </section>
  );
}
