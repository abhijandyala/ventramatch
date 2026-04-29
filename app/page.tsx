import { Wordmark } from "@/components/landing/wordmark";
import { MediaSlot } from "@/components/landing/media-slot";

/**
 * Landing page — Phase 0 (foundation).
 *
 * This is intentionally minimal. The real structural page lands in Phase 1
 * once the foundation primitives (MediaSlot + media registry + design tokens)
 * are in place and reviewed.
 *
 * What's here:
 *   - Sticky nav (logo + wordmark, no CTAs — waitlist removed)
 *   - One editorial hero block (no fake UI, no decorative chrome)
 *   - Hero media placeholder (Slot A — the real video lands later)
 *   - A minimal footer
 */

export default function HomePage() {
  return (
    <main className="bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
      <Nav />
      <Hero />
      <Footer />
    </main>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--color-bg)]/70">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
        <Wordmark size="md" />
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--color-text-faint)]">
          Phase 0 · foundation
        </span>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-faint [mask-image:linear-gradient(to_bottom,white_20%,transparent_85%)]" />

      <div className="relative mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-12 px-6 pt-20 pb-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:pt-28 lg:pb-32">
        <div>
          <h1
            className="text-balance font-semibold text-[color:var(--color-text-strong)]"
            style={{
              fontSize: "var(--type-display)",
              lineHeight: 1.02,
              letterSpacing: "var(--tracking-display)",
            }}
          >
            Stop emailing the wrong investors.
          </h1>
          <p
            className="mt-7 max-w-[58ch] text-pretty text-[color:var(--color-text-muted)]"
            style={{ fontSize: "var(--type-body-lg)", lineHeight: 1.55 }}
          >
            VentraMatch scores every investor against your raise on the five things they actually filter on. Mutual interest unlocks contact.
          </p>
          <p className="mt-6 max-w-[44ch] text-[13px] leading-relaxed text-[color:var(--color-text-faint)]">
            Phase 1 builds the full landing page on top of these foundation primitives.
          </p>
        </div>

        <div className="lg:justify-self-end w-full max-w-[680px]">
          <MediaSlot slot="hero" />
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[color:var(--color-border)] bg-[color:var(--color-bg)]">
      <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-4 px-6 py-10 md:flex-row md:items-center">
        <Wordmark size="sm" />
        <p className="text-[12px] text-[color:var(--color-text-faint)]">
          © {new Date().getFullYear()} VentraMatch. Informational only. Not investment advice.
        </p>
        <a
          href="https://github.com/abhijandyala/ventramatch"
          className="text-[13px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-strong)]"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}
