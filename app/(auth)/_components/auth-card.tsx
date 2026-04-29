"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/landing/wordmark";
import { ProviderButtons } from "./provider-buttons";
import { EmailForm } from "./email-form";
import { cn } from "@/lib/utils";

type Mode = "sign-in" | "sign-up";

const COPY: Record<
  Mode,
  {
    heading: string;
    subheading: string;
    switchPrompt: string;
    switchLabel: string;
    switchHref: string;
  }
> = {
  "sign-in": {
    heading: "Welcome back",
    subheading: "Sign in to continue your fundraising loop.",
    switchPrompt: "New to VentraMatch?",
    switchLabel: "Create an account",
    switchHref: "/sign-up",
  },
  "sign-up": {
    heading: "Create your account",
    subheading: "Find investors who match your stage, sector, and check size.",
    switchPrompt: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/sign-in",
  },
};

export function AuthCard({ mode }: { mode: Mode }) {
  const copy = COPY[mode];
  const pathname = usePathname();
  const current: Mode = pathname === "/sign-up" ? "sign-up" : "sign-in";

  return (
    <div className="flex min-h-dvh">

      {/* ══════════════════════════════════════
          Left — dark brand panel (md+)
          ══════════════════════════════════════ */}
      <div className="relative hidden md:flex md:w-1/2 flex-col justify-between overflow-hidden bg-[#0f172a] p-12">

        {/* Grid backdrop */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid-faint-light"
        />

        {/* Wordmark — top-left */}
        <div className="relative z-10 inline-flex items-center gap-2.5">
          <Image
            src="/logo.svg"
            alt=""
            width={28}
            height={28}
            priority
            className="object-contain"
            style={{ width: "auto", height: 28 }}
          />
          <span className="text-[18px] font-semibold tracking-tight text-white">
            Ventra<span className="text-[var(--color-brand)]">match</span>
          </span>
        </div>

        {/* Hero copy — vertically centred */}
        <div className="relative z-10">
          <p className="mb-5 font-mono text-[11px] tracking-[0.15em] text-[var(--color-brand)] uppercase">
            Score-based matching
          </p>
          <h1
            className="font-serif font-semibold leading-[0.96] tracking-tight text-white"
            style={{ fontSize: "clamp(40px, 4.2vw, 58px)" }}
          >
            Fundraising,
            <br />
            <span className="text-[var(--color-brand)]">matched.</span>
          </h1>
          <p className="mt-7 max-w-[32ch] text-[15px] leading-[1.65] text-white/50">
            Score every founder–investor pair on sector, stage, check size,
            geography, and traction. Mutual interest unlocks contact.
          </p>
        </div>

        {/* Legal — bottom-left */}
        <p className="relative z-10 text-[11px] text-white/25">
          Informational only — not investment advice.
        </p>
      </div>

      {/* ══════════════════════════════════════
          Right — form panel
          ══════════════════════════════════════ */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[var(--color-bg)] px-8 py-10">

        {/* Mobile-only wordmark */}
        <div className="mb-8 md:hidden">
          <Wordmark size="md" />
        </div>

        <div className="w-full max-w-[380px]">

          {/* Tab strip */}
          <Tabs current={current} />

          {/* Heading */}
          <div className="mt-5 mb-5">
            <h2 className="text-[20px] font-semibold tracking-tight text-[var(--color-text)]">
              {copy.heading}
            </h2>
            <p className="mt-1 text-[13px] leading-[1.5] text-[var(--color-text-muted)]">
              {copy.subheading}
            </p>
          </div>

          {/* OAuth — compact 3-column grid */}
          <p className="mb-2 text-[11px] font-medium tracking-[0.07em] text-[var(--color-text-faint)] uppercase">
            Continue with
          </p>
          <ProviderButtons compact />

          {/* Divider */}
          <div className="my-4 flex items-center gap-3" aria-hidden="true">
            <div className="h-px flex-1 bg-[var(--color-border)]" />
            <span className="text-[11px] tracking-widest text-[var(--color-text-faint)] uppercase">
              or
            </span>
            <div className="h-px flex-1 bg-[var(--color-border)]" />
          </div>

          {/* Email form */}
          <EmailForm mode={mode} />

          {/* Switch mode */}
          <p className="mt-5 text-center text-[13px] text-[var(--color-text-muted)]">
            {copy.switchPrompt}{" "}
            <Link
              href={copy.switchHref as "/sign-up" | "/sign-in"}
              className="font-medium text-[var(--color-text)] underline-offset-4 hover:underline"
            >
              {copy.switchLabel}
            </Link>
          </p>

          {/* Legal */}
          <p className="mt-3 text-center text-[11px] leading-5 text-[var(--color-text-faint)]">
            By continuing you agree to VentraMatch&apos;s Terms and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

function Tabs({ current }: { current: Mode }) {
  return (
    <div
      role="tablist"
      aria-label="Authentication mode"
      className="grid grid-cols-2 rounded-[var(--radius)] bg-[var(--color-border)] p-[3px]"
    >
      <TabLink href="/sign-in" active={current === "sign-in"} label="Sign In" />
      <TabLink href="/sign-up" active={current === "sign-up"} label="Sign Up" />
    </div>
  );
}

function TabLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href as "/sign-in" | "/sign-up"}
      role="tab"
      aria-selected={active}
      className={cn(
        "flex h-9 items-center justify-center rounded-[7px] text-[13px] font-medium transition-colors duration-150",
        active
          ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm"
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
      )}
    >
      {label}
    </Link>
  );
}
