import { Wordmark } from "@/components/landing/wordmark";
import { MatchFlow } from "@/components/landing/match-flow";

/**
 * Landing page — Phase 0 (foundation).
 *
 * The hero is intentionally side-neutral: founders use this app to find
 * investors, investors use it to find founders. Copy must serve both sides
 * and never address one of them in the second person.
 *
 * Hero layout: centered stacked headline + two short sentences + the
 * MatchFlow visual (animated startup × investor pairs cycling through).
 * No video slot here in v1 — the MatchFlow is the hero proof.
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

      <div className="relative mx-auto flex max-w-[960px] flex-col items-center gap-7 px-6 pt-24 pb-14 text-center md:pt-32">
        <h1
          className="text-balance font-semibold leading-[0.98]"
          style={{
            fontSize: "var(--type-display)",
            letterSpacing: "var(--tracking-display)",
          }}
        >
          <span className="block text-[color:var(--color-text-strong)]">Fundraising,</span>
          <span className="block text-[color:var(--color-brand)]">matched.</span>
        </h1>

        <div
          className="max-w-[56ch] text-pretty text-[color:var(--color-text-muted)]"
          style={{ fontSize: "var(--type-body-lg)", lineHeight: 1.55 }}
        >
          <p>Founders find investors who back their stage.</p>
          <p>Investors find startups in their thesis.</p>
        </div>
      </div>

      {/* Hero proof — animated sample pairings cycling through. */}
      <div className="relative mx-auto max-w-[1200px] px-6 pb-24 md:pb-32">
        <MatchFlow />
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
