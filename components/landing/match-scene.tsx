"use client";

import { useEffect, useRef, useState } from "react";

/**
 * MatchScene is the hero proof: a founder card on the left, an investor card
 * on the right, with the brand wordmark "match" connecting them. On enter, the
 * cards slide in, the connector draws, and the badge pops in. After that, a
 * very quiet ambient float keeps it alive without distracting.
 *
 * Distinct from any patented UI:
 *   - no full-bleed photo card
 *   - no bottom-row of round action buttons
 *   - no card stack
 *   - the scene is two side-by-side profiles, scoring is shown by the chips, not a dating swipe surface.
 */

export function MatchScene() {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const r = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(r);
    if (r) {
      setShown(true);
      return;
    }
    if (!ref.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="relative isolate w-full max-w-[640px]"
      aria-hidden="true"
    >
      {/* Plate */}
      <div className="relative overflow-hidden rounded-[20px] border border-[color:var(--color-border)] bg-white">
        {/* Subtle grid backdrop only inside the plate */}
        <div
          className="absolute inset-0 opacity-[0.55]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(15,23,42,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.045) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage:
              "radial-gradient(ellipse at center, black 50%, transparent 90%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at center, black 50%, transparent 90%)",
          }}
        />

        <div className="relative grid grid-cols-[1fr_auto_1fr] items-stretch gap-0 px-6 py-9 sm:px-9 sm:py-11">
          {/* Founder card */}
          <div
            className="relative z-10 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              opacity: shown ? 1 : 0,
              transform: shown ? "translateX(0)" : "translateX(-14px)",
            }}
          >
            <ProfileCard
              role="Founder"
              roleColor="text-[color:var(--color-info)]"
              roleDot="bg-[color:var(--color-info)]"
              name="Anonymous · pre-seed AI"
              meta="San Francisco · 2 founders"
              chips={[
                { label: "AI infra" },
                { label: "Pre-seed" },
                { label: "Raising $1M" },
              ]}
              line="Building autonomous QA agents for production webapps. ~30 design partners."
              float={!reduced ? "founder" : "off"}
            />
          </div>

          {/* Connector */}
          <div className="relative z-10 mx-3 flex w-[120px] items-center justify-center sm:mx-5 sm:w-[140px]">
            <Connector shown={shown} />
          </div>

          {/* Investor card */}
          <div
            className="relative z-10 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] delay-150"
            style={{
              opacity: shown ? 1 : 0,
              transform: shown ? "translateX(0)" : "translateX(14px)",
            }}
          >
            <ProfileCard
              role="Investor"
              roleColor="text-[color:var(--color-brand-strong)]"
              roleDot="bg-[color:var(--color-brand)]"
              name="Anonymous angel"
              meta="New York · solo check writer"
              chips={[
                { label: "Pre-seed" },
                { label: "$50K–$250K" },
                { label: "Dev tools, AI" },
              ]}
              line="Backs technical founders at the earliest stage. ~6 checks a year."
              float={!reduced ? "investor" : "off"}
            />
          </div>
        </div>
      </div>

      {/* Floating animation keyframes scoped to this component */}
      <style jsx>{`
        :global(.vm-float-a) {
          animation: vm-floatA 7s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        :global(.vm-float-b) {
          animation: vm-floatB 8s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        @keyframes vm-floatA {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes vm-floatB {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.vm-float-a),
          :global(.vm-float-b) {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ---------- internal ---------- */

type Chip = { label: string };

function ProfileCard({
  role,
  roleColor,
  roleDot,
  name,
  meta,
  chips,
  line,
  float,
}: {
  role: string;
  roleColor: string;
  roleDot: string;
  name: string;
  meta: string;
  chips: Chip[];
  line: string;
  float: "founder" | "investor" | "off";
}) {
  const floatCls =
    float === "founder" ? "vm-float-a" : float === "investor" ? "vm-float-b" : "";

  return (
    <div
      className={`rounded-[14px] border border-[color:var(--color-border)] bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04),0_18px_36px_-24px_rgba(15,23,42,0.18)] ${floatCls}`}
    >
      {/* role chip */}
      <p
        className={`inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] ${roleColor}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${roleDot}`} />
        {role}
      </p>

      <p className="mt-3 text-[14px] font-semibold leading-tight text-[color:var(--color-text-strong)]">
        {name}
      </p>
      <p className="mt-1 text-[12px] text-[color:var(--color-text-muted)]">{meta}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span
            key={c.label}
            className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--color-text-strong)]"
          >
            {c.label}
          </span>
        ))}
      </div>

      <p className="mt-3 text-[12px] leading-[1.45] text-[color:var(--color-text-muted)]">
        {line}
      </p>
    </div>
  );
}

function Connector({ shown }: { shown: boolean }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {/* horizontal line, draws on enter via stroke-dashoffset */}
      <svg
        viewBox="0 0 100 4"
        preserveAspectRatio="none"
        className="absolute inset-x-0 top-1/2 h-[2px] w-full -translate-y-1/2"
        aria-hidden
      >
        <line
          x1="0"
          y1="2"
          x2="100"
          y2="2"
          stroke="var(--color-border-strong)"
          strokeWidth="1"
        />
        <line
          x1="0"
          y1="2"
          x2="100"
          y2="2"
          stroke="var(--color-brand)"
          strokeWidth="1.5"
          strokeDasharray="100"
          strokeDashoffset={shown ? "0" : "100"}
          style={{
            transition:
              "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1) 250ms",
          }}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Match badge */}
      <div
        className="relative z-10 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          opacity: shown ? 1 : 0,
          transform: shown ? "scale(1)" : "scale(0.6)",
          transitionDelay: shown ? "950ms" : "0ms",
        }}
      >
        <div className="rounded-full border border-[color:var(--color-brand)]/30 bg-white px-3 py-1.5 shadow-[0_4px_18px_-4px_rgba(22,163,74,0.45)]">
          <span className="font-semibold tracking-tight text-[14px]">
            <span className="text-[color:var(--color-text-faint)]">Ventra</span>
            <span className="text-[color:var(--color-brand)]">match</span>
          </span>
        </div>
      </div>
    </div>
  );
}
