"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/landing/wordmark";
import { PixelReveal } from "@/components/ui/pixel-reveal";
import { ProfileDropdown } from "@/components/layout/ProfileDropdown";

type Role = "founder" | "investor";

type Logo = {
  name: string;
  file: string;
};

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

const ROW_BOTTOM = [...LOGOS.slice(10), ...LOGOS.slice(0, 10)];

const COPY: Record<Role, { headline: string }> = {
  founder: { headline: "Investors who back your stage." },
  investor: { headline: "Startups in your thesis." },
};

export default function HomePageClient({
  role,
  name,
  userId,
  avatarSrc,
}: {
  role: Role;
  name: string;
  userId?: string;
  avatarSrc?: string | null;
}) {
  const copy = COPY[role];

  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col bg-[color:var(--color-bg)] text-[color:var(--color-text)]"
    >
      <PixelReveal />
      <ProductNav role={role} name={name} userId={userId} avatarSrc={avatarSrc} />

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

function OrbBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        className="vm-orb-1 absolute left-1/2 -translate-x-1/2"
        style={{
          width: 2400, height: 1800, bottom: "-45%",
          background: "radial-gradient(ellipse 60% 55% at 50% 55%, rgba(22,163,74,0.35) 0%, rgba(34,197,94,0.15) 30%, rgba(22,163,74,0.05) 55%, transparent 75%)",
          filter: "blur(80px)", willChange: "transform",
        }}
      />
      <div
        className="vm-orb-2 absolute left-1/2 -translate-x-1/2"
        style={{
          width: 1600, height: 1200, bottom: "-30%",
          background: "radial-gradient(ellipse 50% 50% at 50% 55%, rgba(34,197,94,0.55) 0%, rgba(22,163,74,0.3) 30%, rgba(21,128,61,0.08) 55%, transparent 70%)",
          filter: "blur(60px)", willChange: "transform",
        }}
      />
      <div
        className="vm-orb-3 absolute left-1/2 -translate-x-1/2"
        style={{
          width: 900, height: 600, bottom: "-8%",
          background: "radial-gradient(ellipse at 50% 60%, rgba(34,197,94,0.7) 0%, rgba(22,163,74,0.35) 40%, transparent 65%)",
          filter: "blur(45px)", willChange: "transform",
        }}
      />
      <GlassBand top="2%"  height={160} blur={8}  opacity={0.06} />
      <GlassBand top="22%" height={200} blur={24} opacity={0.20} />
      <GlassBand top="46%" height={120} blur={14} opacity={0.10} />
      <GlassBand top="58%" height={220} blur={28} opacity={0.25} />
      <GlassBand top="80%" height={140} blur={10} opacity={0.08} />
      <GlassBand top="94%" height={180} blur={20} opacity={0.16} />
    </div>
  );
}

function GlassBand({ top, height, blur, opacity }: { top: string; height: number; blur: number; opacity: number }) {
  const borderAlpha = Math.min(opacity * 1.4, 0.35);
  return (
    <div
      className="absolute inset-x-0"
      style={{
        top, height,
        background: `linear-gradient(to bottom, rgba(255,255,255,${opacity * 1.2}) 0%, rgba(255,255,255,${opacity * 0.6}) 50%, rgba(255,255,255,${opacity}) 100%)`,
        backdropFilter: `blur(${blur}px) saturate(${120 + blur * 2}%)`,
        WebkitBackdropFilter: `blur(${blur}px) saturate(${120 + blur * 2}%)`,
        borderTop: `1px solid rgba(255,255,255,${borderAlpha})`,
        borderBottom: `1px solid rgba(255,255,255,${borderAlpha * 0.6})`,
      }}
    />
  );
}

const NAV_LINKS: Array<{ label: string; href: string }> = [
  { label: "Feed", href: "/feed" },
  { label: "Matches", href: "/matches" },
  { label: "Profiles", href: "/profile" },
  { label: "Dashboard", href: "/dashboard" },
];

function ProductNav({
  role,
  name,
  userId,
  avatarSrc,
}: {
  role: Role;
  name: string;
  userId?: string;
  avatarSrc?: string | null;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--color-bg)]/70">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Wordmark size="md" />
          <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href as Route}
                className={cn(
                  "text-[14px] transition-colors duration-[120ms]",
                  pathname === link.href || pathname.startsWith(`${link.href}/`)
                    ? "font-semibold text-[var(--color-text)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <ProfileDropdown role={role} name={name} userId={userId} avatarSrc={avatarSrc} />
      </div>
    </header>
  );
}

function ArrowRight() {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      className="transition-transform duration-200 group-hover:translate-x-1"
      aria-hidden
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
