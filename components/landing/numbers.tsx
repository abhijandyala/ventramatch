"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal } from "@/components/landing/reveal";

/**
 * Numbers — the market context, with one custom data viz.
 *
 * Asymmetric layout: real research embedded in prose on the left,
 * a hand-built horizontal bar chart on the right comparing reply rates.
 * Numbers count up on viewport entry. No chart library — the chart is
 * ~50 lines of SVG.
 */

const REPLY_RATE_BARS = [
  { label: "Cold email", value: 5, range: "1–10%", tone: "muted" as const },
  { label: "Warm intro", value: 40, range: "30–70%", tone: "muted" as const },
  { label: "VentraMatch (target)", value: 65, range: "early estimate", tone: "brand" as const },
];

export function Numbers() {
  return (
    <section className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
      <div className="mx-auto max-w-[1280px] px-6 py-24 md:py-32">
        <div className="grid grid-cols-1 items-start gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          {/* Prose */}
          <div>
            <Reveal>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
                The market we're in
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
                active VC funds, and most aren't the right fit for your raise.
              </p>
            </Reveal>
            <Reveal delay={220}>
              <p className="mt-5 text-[14px] leading-relaxed text-[color:var(--color-text-faint)]">
                Sources: Carta state-of-startups 2025, AngelList market data, OpenVC.
              </p>
            </Reveal>
          </div>

          {/* Chart */}
          <Reveal delay={120} className="w-full">
            <ReplyRateChart />
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

function ReplyRateChart() {
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
      className="rounded-[20px] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] p-7 md:p-9"
    >
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[color:var(--color-text-faint)]">
          Founder → investor reply rates
        </p>
        <p className="font-mono text-[11px] tabular-nums text-[color:var(--color-text-faint)]">
          % responding
        </p>
      </div>

      <ul className="mt-7 space-y-7">
        {REPLY_RATE_BARS.map((bar, i) => (
          <li key={bar.label}>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[15px] font-semibold text-[color:var(--color-text-strong)]">
                {bar.label}
              </span>
              <span className="font-mono text-[14px] tabular-nums text-[color:var(--color-text-muted)]">
                {bar.range}
              </span>
            </div>
            <div className="mt-2 h-[10px] w-full overflow-hidden rounded-full bg-[color:var(--color-surface-2)]">
              <div
                className="h-full rounded-full transition-[width] ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  width: shown ? `${bar.value}%` : "0%",
                  transitionDuration: "1100ms",
                  transitionDelay: `${i * 180}ms`,
                  backgroundColor:
                    bar.tone === "brand"
                      ? "var(--color-brand)"
                      : "var(--color-text-faint)",
                }}
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-7 text-[12px] leading-snug text-[color:var(--color-text-faint)]">
        VentraMatch target reflects what we believe scored, mutually-interested
        outreach should achieve. Real numbers will replace this once we have them.
      </p>
    </div>
  );
}
