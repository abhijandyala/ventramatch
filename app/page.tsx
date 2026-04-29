import { Wordmark } from "@/components/landing/wordmark";
import { MediaSlot } from "@/components/landing/media-slot";

/**
 * Landing page — Phase 0 (foundation).
 *
 * Minimal by design. Phase 1 builds the structural page on top of these
 * primitives once foundation is reviewed.
 *
 * Hero is intentionally side-neutral: founders use this app to find
 * investors, investors use it to find founders. The copy must serve both
 * sides and never address one of them in the second person.
 *
 * Layout: centered text. Right-side visual removed. The hero media slot
 * sits below the text as a wide block (lands in Phase 1+).
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
      {/* Subtle grid backdrop. Masked so it fades into the page. */}
      <div className="pointer-events-none absolute inset-0 grid-faint [mask-image:linear-gradient(to_bottom,white_25%,transparent_85%)]" />

      <div className="relative mx-auto flex max-w-[960px] flex-col items-center gap-8 px-6 pt-24 pb-12 text-center md:pt-32">
        <h1
          className="text-balance font-semibold text-[color:var(--color-text-strong)]"
          style={{
            fontSize: "var(--type-display)",
            lineHeight: 1.02,
            letterSpacing: "var(--tracking-display)",
          }}
        >
          Fundraising matches, scored on fit.
        </h1>

        <p
          className="max-w-[62ch] text-pretty text-[color:var(--color-text-muted)]"
          style={{ fontSize: "var(--type-body-lg)", lineHeight: 1.55 }}
        >
          VentraMatch scores every founder–investor pair on the five things both sides actually filter on — sector, stage, check size, geography, traction. Mutual interest unlocks contact. No cold-email lottery, no warm-intro gatekeeping.
        </p>

        <p className="text-[12px] font-mono uppercase tracking-[0.1em] text-[color:var(--color-text-faint)]">
          Phase 1 builds the full landing page on top of these foundation primitives
        </p>
      </div>

      {/* Hero media block — full-width within the max content width, sits below the centered text. */}
      <div className="relative mx-auto max-w-[1200px] px-6 pb-24 md:pb-32">
        <MediaSlot slot="hero" className="mx-auto max-w-[1100px]" />
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
