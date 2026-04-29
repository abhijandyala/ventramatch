import type { ReactNode } from "react";
import { Wordmark } from "@/components/landing/wordmark";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[var(--color-bg)]">

      {/* ── Ambient gradient blobs — the glassmorphism needs something to blur over ── */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* Brand green — bottom-left */}
        <div
          className="absolute -bottom-40 -left-40 h-[560px] w-[560px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(22,163,74,0.32) 0%, transparent 70%)",
            filter: "blur(0px)",
          }}
        />
        {/* Warm amber — top-right */}
        <div
          className="absolute -right-32 -top-32 h-[480px] w-[480px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(245,158,11,0.22) 0%, transparent 70%)",
            filter: "blur(0px)",
          }}
        />
        {/* Sky / teal — center, slightly right */}
        <div
          className="absolute left-[55%] top-[35%] h-[360px] w-[360px] -translate-y-1/2 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)",
            filter: "blur(0px)",
          }}
        />
        {/* Soft rose — upper-left */}
        <div
          className="absolute -left-16 top-[15%] h-[300px] w-[300px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(244,114,182,0.14) 0%, transparent 70%)",
            filter: "blur(0px)",
          }}
        />
      </div>

      {/* Subtle 56px grid on top of the blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 grid-faint opacity-60 [mask-image:linear-gradient(to_bottom,white_30%,transparent_85%)]"
      />

      {/* Minimal header */}
      <header className="relative z-10 flex h-14 items-center border-b border-white/30 bg-white/20 px-6 backdrop-blur-md">
        <Wordmark size="md" asLink={false} />
      </header>

      <main
        id="main-content"
        className="relative z-10 grid min-h-[calc(100dvh-3.5rem)] place-items-start justify-items-center px-5 pt-14 pb-20 sm:pt-16 sm:pb-24"
      >
        {children}
      </main>
    </div>
  );
}
