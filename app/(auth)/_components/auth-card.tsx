"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Wordmark } from "@/components/landing/wordmark";
import { ProviderButtons } from "./provider-buttons";
import { EmailForm } from "./email-form";

const DarkVeil = dynamic(() => import("@/components/ui/dark-veil"), {
  ssr: false,
});

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

  return (
    <div className="relative h-dvh overflow-hidden" style={{ background: "var(--color-bg)" }}>
      {/* Full-screen DarkVeil shader — beige + green waves across the entire page */}
      <div className="absolute inset-0">
        <DarkVeil
          speed={0.3}
          warpAmount={0.3}
          resolutionScale={1}
          baseColor={[0.953, 0.937, 0.898]}
          accentColor={[0.086, 0.639, 0.290]}
          brightBoost={2.2}
        />
      </div>

      {/* Content layer on top of the shader */}
      <div className="relative z-10 flex h-full">
        {/* Left — 60% — wordmark bottom-left, headline top-right */}
        <div className="hidden h-full w-[60%] flex-col justify-between p-10 md:flex">
          <div>
            <h1
              className="font-serif font-semibold leading-[0.96] tracking-tight text-[var(--color-text-strong)]"
              style={{ fontSize: "clamp(36px, 3.8vw, 52px)" }}
            >
              Fundraising,
              <br />
              <span className="text-[var(--color-brand)]">matched.</span>
            </h1>
          </div>

          <Wordmark size="md" />
        </div>

        {/* Right — 50% — full-height frosted panel flush to the right edge */}
        <div className="flex h-full w-full md:w-[50%] md:ml-auto">
          {/* Mobile-only wordmark */}
          <div className="relative mb-8 md:hidden flex items-center justify-center w-full pt-8">
            <Wordmark size="md" />
          </div>

          <div
            className="flex h-full w-full flex-col items-center justify-center px-12 py-10 md:px-16"
            style={{
              background: "rgba(255,255,255,0.40)",
              backdropFilter: "blur(40px) saturate(160%)",
              WebkitBackdropFilter: "blur(40px) saturate(160%)",
              borderLeft: "1px solid rgba(255,255,255,0.30)",
            }}
          >
            <div className="w-full max-w-[440px]">
              {mode === "sign-in" && (
                <Suspense fallback={null}>
                  <VerifiedBanner />
                </Suspense>
              )}
              <h2 className="text-[28px] font-semibold tracking-tight text-[var(--color-text)]">
                {copy.heading}
              </h2>
              <p className="mt-2 text-[15px] leading-[1.5] text-[var(--color-text-muted)]">
                {copy.subheading}
              </p>

              <div className="mt-8">
                <ProviderButtons />
              </div>

              <div className="my-6 flex items-center gap-3" aria-hidden="true">
                <div className="h-px flex-1 bg-[var(--color-border)]" />
                <span className="text-[11px] tracking-widest uppercase text-[var(--color-text-faint)]">
                  or
                </span>
                <div className="h-px flex-1 bg-[var(--color-border)]" />
              </div>

              <EmailForm mode={mode} />

              <p className="mt-6 text-center text-[14px] text-[var(--color-text-muted)]">
                {copy.switchPrompt}{" "}
                <Link
                  href={copy.switchHref as "/sign-up" | "/sign-in"}
                  className="font-medium text-[var(--color-text)] underline-offset-4 hover:underline"
                >
                  {copy.switchLabel}
                </Link>
              </p>

              <p className="mt-4 text-center text-[11px] leading-5 text-[var(--color-text-faint)]">
                By continuing you agree to VentraMatch&apos;s Terms and Privacy
                Policy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VerifiedBanner() {
  const params = useSearchParams();
  if (params.get("verified") !== "1") return null;
  return (
    <div
      role="status"
      className="mb-5 flex items-start gap-2 px-4 py-3 text-[13px] leading-[1.5]"
      style={{
        background: "var(--color-brand-tint)",
        border: "1px solid var(--color-brand)",
        color: "var(--color-brand-strong)",
      }}
    >
      <span aria-hidden className="mt-0.5">✓</span>
      <span>
        Email verified. Sign in below to finish setting up your account.
      </span>
    </div>
  );
}
