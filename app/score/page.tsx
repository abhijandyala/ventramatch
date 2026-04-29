import Link from "next/link";
import { Wordmark } from "@/components/landing/wordmark";
import { ScoreViz } from "@/components/landing/score-viz";

/**
 * /score — Dedicated page for the "We score the fit, openly." statement.
 * The actual viz is in components/landing/score-viz.tsx so it can also be
 * embedded in the homepage's HowMatchingWorks sticky-scroll section.
 */

export default function ScorePage() {
  return (
    <main className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]/85 px-5 backdrop-blur md:px-8">
        <Wordmark size="sm" />
        <Link
          href="/"
          className="text-[12.5px] text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-strong)]"
        >
          ← Back to home
        </Link>
      </header>

      <section className="mx-auto max-w-[840px] px-5 py-16 text-center md:px-6 md:py-20">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
          02 · Open scoring
        </p>
        <h1
          className="mt-5 text-balance font-semibold text-[color:var(--color-text-strong)]"
          style={{
            fontSize: "clamp(36px, 5.4vw, 60px)",
            lineHeight: 1.04,
            letterSpacing: "var(--tracking-h1)",
          }}
        >
          We score the fit,{" "}
          <span className="text-[color:var(--color-brand)]">openly</span>.
        </h1>
        <p className="mx-auto mt-5 max-w-[58ch] text-pretty text-[15.5px] leading-[1.6] text-[color:var(--color-text-muted)]">
          Every match shows the percentage and a one-line reason. The exact
          formula lives in the repo at{" "}
          <code className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-1.5 py-0.5 font-mono text-[12.5px] font-medium text-[color:var(--color-text-strong)]">
            lib/matching/score.ts
          </code>
          .
        </p>
      </section>

      <section className="mx-auto w-full max-w-[1080px] px-5 pb-24 md:px-6 md:pb-32">
        <ScoreViz />
      </section>
    </main>
  );
}
