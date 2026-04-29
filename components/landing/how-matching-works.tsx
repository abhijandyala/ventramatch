"use client";

import { useState } from "react";
import { Reveal } from "@/components/landing/reveal";
import { MediaSlot } from "@/components/landing/media-slot";
import { ScoreViz } from "@/components/landing/score-viz";

/**
 * HowMatchingWorks — stacked-sticky-header storytelling section.
 *
 * Three rectangular headers stack as the user scrolls. Each header pins
 * to a top offset that accounts for the page nav + the headers above it,
 * so by the end of the section all three are visible as a tidy stack.
 *
 * Step content beneath each header:
 *   01 Build one structured profile  → side toggle + profile-builder video
 *   02 We score the fit, openly      → embedded ScoreViz auto-cycle
 *   03 Mutual interest unlocks       → blank placeholder for now
 *
 * After the section ends, all stickies release and the page returns to
 * normal scroll.
 *
 * Heights:
 *   - NAV_HEIGHT   = 64px  (matches the page nav <header>)
 *   - HEADER_HEIGHT= 84px  (each rect)
 *   - PANEL_MIN    = 90vh  (each step content area)
 *
 * Don't change NAV_HEIGHT here without changing the page nav too.
 */

const NAV_HEIGHT = 64;
const HEADER_HEIGHT = 84;

const STEPS = [
  { n: "01", title: "Build one structured profile." },
  { n: "02", title: "We score the fit, openly." },
  { n: "03", title: "Mutual interest unlocks contact." },
];

export function HowMatchingWorks() {
  return (
    <section className="bg-[color:var(--color-bg)]">
      {/* ---------- Title ---------- */}
      <div className="mx-auto max-w-[60ch] px-6 pt-24 pb-14 text-center md:pt-32">
        <Reveal>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
            The flow
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
            Three steps. No spreadsheets.
          </h2>
        </Reveal>
      </div>

      {/* ---------- Sticky scroll container ---------- */}
      <div className="relative">
        <StickyHeader index={0} number={STEPS[0].n} title={STEPS[0].title} />
        <Step1Panel />

        <StickyHeader index={1} number={STEPS[1].n} title={STEPS[1].title} />
        <Step2Panel />

        <StickyHeader index={2} number={STEPS[2].n} title={STEPS[2].title} />
        <Step3Panel />
      </div>
    </section>
  );
}

/* ---------------- Sticky rect header ---------------- */

function StickyHeader({
  index,
  number,
  title,
}: {
  index: number;
  number: string;
  title: string;
}) {
  const top = NAV_HEIGHT + index * HEADER_HEIGHT;
  const z = 30 - index * 10; // 30, 20, 10
  return (
    <div
      className="border-y border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
      style={{ position: "sticky", top, zIndex: z, height: HEADER_HEIGHT }}
    >
      <div className="mx-auto flex h-full max-w-[1280px] items-center justify-center gap-3 px-6">
        <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-brand)]">
          {number}
        </span>
        <span aria-hidden className="h-4 w-px bg-[color:var(--color-border-strong)]" />
        <h3
          className="text-center font-semibold tracking-[-0.012em] text-[color:var(--color-text-strong)]"
          style={{ fontSize: "clamp(16px, 2vw, 22px)", lineHeight: 1.15 }}
        >
          {title}
        </h3>
      </div>
    </div>
  );
}

/* ---------------- Step 01 — Build profile ---------------- */

function Step1Panel() {
  const [side, setSide] = useState<"startup" | "investor">("startup");
  return (
    <div className="bg-[color:var(--color-bg)]">
      <div
        className="mx-auto flex max-w-[1080px] flex-col items-center justify-center px-6 py-16 md:py-20 lg:py-24"
        style={{ minHeight: "85vh" }}
      >
        {/* Side toggle */}
        <SideToggle side={side} onChange={setSide} />

        {/* Video / placeholder */}
        <div className="mt-8 w-full overflow-hidden rounded-[20px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
          <MediaSlot
            slot={side === "startup" ? "profileBuilderStartup" : "profileBuilderInvestor"}
          />
        </div>

        {/* Side-specific blurb */}
        <div className="mt-7 max-w-[58ch] text-center">
          {side === "startup" ? (
            <p className="text-[14.5px] leading-[1.65] text-[color:var(--color-text-muted)]">
              Founders fill five fields once: <strong className="text-[color:var(--color-text-strong)]">sector, stage, check size, geography, traction</strong>.
              Plus a deck. Same shape on both sides — no questionnaires, no
              dropdown sprawl.
            </p>
          ) : (
            <p className="text-[14.5px] leading-[1.65] text-[color:var(--color-text-muted)]">
              Investors describe their thesis once: <strong className="text-[color:var(--color-text-strong)]">sectors they back, stages they write at, check range, geography, recent activity</strong>.
              Same five filters as the founder side.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SideToggle({
  side,
  onChange,
}: {
  side: "startup" | "investor";
  onChange: (s: "startup" | "investor") => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-1">
      {(["startup", "investor"] as const).map((s) => {
        const on = side === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            aria-pressed={on}
            className={[
              "rounded-full px-5 py-1.5 text-[12.5px] font-medium capitalize transition-colors",
              on
                ? "bg-[color:var(--color-text-strong)] text-white"
                : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-strong)]",
            ].join(" ")}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Step 02 — Score viz ---------------- */

function Step2Panel() {
  return (
    <div className="bg-[color:var(--color-bg)]">
      <div
        className="mx-auto flex max-w-[1080px] flex-col justify-center px-6 py-16 md:py-20 lg:py-24"
        style={{ minHeight: "85vh" }}
      >
        <ScoreViz showFooter={false} />
      </div>
    </div>
  );
}

/* ---------------- Step 03 — Placeholder ---------------- */

function Step3Panel() {
  return (
    <div className="bg-[color:var(--color-bg)]">
      <div
        className="mx-auto grid max-w-[1080px] place-items-center px-6 py-16 md:py-20"
        style={{ minHeight: "60vh" }}
      >
        <div className="rounded-[20px] border-2 border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-10 py-14 text-center">
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
            Coming next
          </p>
          <p className="mt-3 max-w-[44ch] text-[14.5px] leading-[1.6] text-[color:var(--color-text-muted)]">
            The unlock motion-graphic lands here. Mutual interest reveals
            contact info on both sides at the same instant.
          </p>
        </div>
      </div>
    </div>
  );
}
