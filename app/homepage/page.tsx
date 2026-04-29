"use client";

import { useState } from "react";
import { Wordmark } from "@/components/landing/wordmark";

/**
 * Post-auth /homepage — the first screen a user lands on after sign-up
 * or sign-in. Two counter-scrolling logo strips (real brand logos served
 * from Clearbit's free logo CDN), a sticky product nav, role-aware
 * welcome copy, and a minimal "Start matching" link. No auth logic —
 * Adhvik wires that.
 *
 * Role toggle in the nav is a temporary affordance so we can demo both
 * the founder and investor views at the same URL while auth isn't yet
 * wired up. Once role-from-session exists, drop the toggle.
 */

type Role = "founder" | "investor";

type Logo = {
  name: string;
  /** Local SVG file in /public/logos/. Real brand artwork, multi-color. */
  file: string;
};

// Real, multi-color brand SVGs downloaded to /public/logos/. Sources:
//   - Tech logos from svgl.app (open-source brand SVG collection)
//   - VC firm logos from Wikimedia Commons
const LOGOS: Logo[] = [
  { name: "Linear", file: "linear.svg" },
  { name: "Y Combinator", file: "ycombinator.svg" },
  { name: "Vercel", file: "vercel.svg" },
  { name: "Sequoia Capital", file: "sequoia.svg" },
  { name: "Anthropic", file: "anthropic.svg" },
  { name: "Notion", file: "notion.svg" },
  { name: "Stripe", file: "stripe.svg" },
  { name: "Founders Fund", file: "foundersfund.svg" },
  { name: "OpenAI", file: "openai.svg" },
  { name: "a16z", file: "a16z.svg" },
  { name: "Figma", file: "figma.svg" },
  { name: "Supabase", file: "supabase.svg" },
  { name: "Replit", file: "replit.svg" },
  { name: "Cursor", file: "cursor.svg" },
  { name: "Perplexity", file: "perplexity.svg" },
  { name: "Airtable", file: "airtable.svg" },
  { name: "GitHub", file: "github.svg" },
  { name: "Slack", file: "slack.svg" },
  { name: "Discord", file: "discord.svg" },
  { name: "Khosla Ventures", file: "khosla.svg" },
];

// Each row scrolls the full set so there's always content filling the
// viewport regardless of where the loop is. The two rows differ only by
// scroll direction, with the bottom row offset so it doesn't mirror.
const ROW_TOP = LOGOS;
const ROW_BOTTOM = [...LOGOS.slice(10), ...LOGOS.slice(0, 10)];

const COPY: Record<Role, { headline: string; sub: string }> = {
  founder: {
    headline: "Investors who back your stage.",
    sub: "Complete your profile to see who's actively writing checks for raises like yours.",
  },
  investor: {
    headline: "Startups in your thesis.",
    sub: "Complete your profile to see deals filtered by sector, stage, and check size.",
  },
};

export default function PostAuthHomePage() {
  const [role, setRole] = useState<Role>("founder");
  const copy = COPY[role];

  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col bg-[color:var(--color-bg)] text-[color:var(--color-text)]"
    >
      <ProductNav role={role} setRole={setRole} />

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <OrbBackdrop />

        <section className="relative z-10 ml-auto mr-[15%] flex max-w-[420px] flex-col items-end py-20 text-right md:py-28">
          <h1
            className="text-balance font-semibold tracking-[-0.014em] text-[color:var(--color-text-strong)]"
            style={{ fontSize: "var(--type-h1)", lineHeight: 1.05 }}
          >
            {copy.headline}
          </h1>

          <a
            href="/feed"
            className="group mt-10 inline-flex items-center gap-2 text-[color:var(--color-text-strong)] transition-colors hover:text-[color:var(--color-brand)]"
          >
            <span className="text-[17px] font-semibold tracking-[-0.005em] underline-offset-[6px] group-hover:underline">
              Start matching
            </span>
            <ArrowRight />
          </a>
        </section>
      </div>

      <MarqueeStrip logos={ROW_BOTTOM} direction="right" />
    </main>
  );
}

/* ---------- Logo strip — real brand artwork, flush tiles ---------- */

function MarqueeStrip({
  logos,
  direction,
}: {
  logos: Logo[];
  direction: "left" | "right";
}) {
  const trackClass =
    direction === "left" ? "vm-marquee-left" : "vm-marquee-right";
  return (
    <div
      className="overflow-hidden bg-white"
      aria-hidden
      style={{
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 8%, #000 20%, #000 80%, rgba(0,0,0,0.6) 92%, transparent 100%)",
        maskImage:
          "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 8%, #000 20%, #000 80%, rgba(0,0,0,0.6) 92%, transparent 100%)",
      }}
    >
      <div className={`flex w-max ${trackClass}`}>
        {[...logos, ...logos].map((logo, i) => (
          <LogoSquare key={`${logo.name}-${i}`} logo={logo} />
        ))}
      </div>
    </div>
  );
}

function LogoSquare({ logo }: { logo: Logo }) {
  return (
    <span
      className="grid h-[88px] w-[88px] shrink-0 place-items-center border-r border-[color:var(--color-border)] bg-white"
      title={logo.name}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/logos/${logo.file}`}
        alt={logo.name}
        loading="lazy"
        decoding="async"
        className="h-11 w-11 object-contain"
      />
    </span>
  );
}

/* ---------- Soft green orb sliced by horizontal frosted bands ---------- */

function OrbBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Outer halo — huge, extremely soft, barely there. Drifts on its
          own slow wobbly path so the orb feels alive. */}
      <div
        className="vm-orb-1 absolute left-1/2 -translate-x-1/2"
        style={{
          width: 2400,
          height: 1800,
          bottom: "-45%",
          background:
            "radial-gradient(ellipse 60% 55% at 50% 55%, rgba(22,163,74,0.35) 0%, rgba(34,197,94,0.15) 30%, rgba(22,163,74,0.05) 55%, transparent 75%)",
          filter: "blur(80px)",
          willChange: "transform",
        }}
      />

      {/* Mid glow — warmer, slightly more saturated. Drifts at a different
          speed and path so it decouples from the halo. */}
      <div
        className="vm-orb-2 absolute left-1/2 -translate-x-1/2"
        style={{
          width: 1600,
          height: 1200,
          bottom: "-30%",
          background:
            "radial-gradient(ellipse 50% 50% at 50% 55%, rgba(34,197,94,0.55) 0%, rgba(22,163,74,0.3) 30%, rgba(21,128,61,0.08) 55%, transparent 70%)",
          filter: "blur(60px)",
          willChange: "transform",
        }}
      />

      {/* Hot core — the brightest point. Slowest drift, biggest wobble. */}
      <div
        className="vm-orb-3 absolute left-1/2 -translate-x-1/2"
        style={{
          width: 900,
          height: 600,
          bottom: "-8%",
          background:
            "radial-gradient(ellipse at 50% 60%, rgba(34,197,94,0.7) 0%, rgba(22,163,74,0.35) 40%, transparent 65%)",
          filter: "blur(45px)",
          willChange: "transform",
        }}
      />

      {/* Horizontal frosted bands — different shades of glass catching
          the green glow. Some barely-there, some deeply frosted. */}
      <GlassBand top="2%"  height={160} blur={8}  opacity={0.06} />
      <GlassBand top="22%" height={200} blur={24} opacity={0.20} />
      <GlassBand top="46%" height={120} blur={14} opacity={0.10} />
      <GlassBand top="58%" height={220} blur={28} opacity={0.25} />
      <GlassBand top="80%" height={140} blur={10} opacity={0.08} />
      <GlassBand top="94%" height={180} blur={20} opacity={0.16} />
    </div>
  );
}

function GlassBand({
  top,
  height,
  blur,
  opacity,
}: {
  top: string;
  height: number;
  blur: number;
  opacity: number;
}) {
  // Each band has its own blur intensity and white-fill opacity, so the
  // six bands read as different "thicknesses" of frosted glass — some
  // barely there (light haze), some deeply frosted (heavy matte).
  const borderAlpha = Math.min(opacity * 1.4, 0.35);
  return (
    <div
      className="absolute inset-x-0"
      style={{
        top,
        height,
        background: `linear-gradient(to bottom, rgba(255,255,255,${opacity * 1.2}) 0%, rgba(255,255,255,${opacity * 0.6}) 50%, rgba(255,255,255,${opacity}) 100%)`,
        backdropFilter: `blur(${blur}px) saturate(${120 + blur * 2}%)`,
        WebkitBackdropFilter: `blur(${blur}px) saturate(${120 + blur * 2}%)`,
        borderTop: `1px solid rgba(255,255,255,${borderAlpha})`,
        borderBottom: `1px solid rgba(255,255,255,${borderAlpha * 0.6})`,
      }}
    />
  );
}

/* ---------- Product nav ---------- */

const NAV_LINKS: Array<{ label: string; href: string }> = [
  { label: "Feed", href: "/feed" },
  { label: "Matches", href: "/matches" },
  { label: "Profile", href: "/profile" },
  { label: "Dashboard", href: "/dashboard" },
];

function ProductNav({
  role,
  setRole,
}: {
  role: Role;
  setRole: (r: Role) => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--color-bg)]/70">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-6 px-6">
        <div className="flex items-center gap-10">
          <Wordmark size="md" />
          <nav
            aria-label="Primary"
            className="hidden items-center gap-7 md:flex"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-strong)]"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <RoleToggle role={role} setRole={setRole} />
          <span
            aria-hidden
            className="grid h-9 w-9 place-items-center rounded-[8px] bg-[color:var(--color-brand-tint)] font-mono text-[11px] font-semibold uppercase tracking-tight text-[color:var(--color-brand-strong)] ring-1 ring-[color:var(--color-border)]"
          >
            VM
          </span>
        </div>
      </div>
    </header>
  );
}

function RoleToggle({
  role,
  setRole,
}: {
  role: Role;
  setRole: (r: Role) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Switch role view (temporary)"
      className="hidden items-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-0.5 sm:flex"
    >
      {(["founder", "investor"] as const).map((option) => {
        const active = option === role;
        return (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setRole(option)}
            className={[
              "rounded-full px-3 py-1 text-[12px] font-medium capitalize transition-colors",
              active
                ? "bg-[color:var(--color-text-strong)] text-white"
                : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-strong)]",
            ].join(" ")}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Inline arrow icon ---------- */

function ArrowRight() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-transform duration-200 group-hover:translate-x-1"
      aria-hidden
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
