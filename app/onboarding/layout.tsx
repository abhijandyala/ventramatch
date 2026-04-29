import type { ReactNode } from "react";
import { Wordmark } from "@/components/landing/wordmark";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh bg-[var(--color-bg)]">
      {/* Subtle grid backdrop — same mask treatment as auth / landing hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 grid-faint [mask-image:linear-gradient(to_bottom,white_30%,transparent_90%)]"
      />

      {/* Minimal nav — brand anchor; no back link since middleware guards this route */}
      <header className="relative z-10 flex h-14 items-center border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 px-6 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-bg)]/70">
        <Wordmark size="md" asLink={false} />
      </header>

      <main
        id="main-content"
        className="relative z-10 grid place-items-center px-4 py-12 sm:py-16"
      >
        {children}
      </main>
    </div>
  );
}
