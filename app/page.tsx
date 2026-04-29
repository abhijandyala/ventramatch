import { Wordmark } from "@/components/landing/wordmark";
import { MatchFlow } from "@/components/landing/match-flow";
import { SourceTicker } from "@/components/landing/source-ticker";
import { FiveInputs } from "@/components/landing/five-inputs";
import { Numbers } from "@/components/landing/numbers";
import { HowMatchingWorks } from "@/components/landing/how-matching-works";
import { ProductVision } from "@/components/landing/product-vision";
import { FAQ } from "@/components/landing/faq";
import GradualBlur from "@/components/ui/gradual-blur";

/**
 * Landing page — Phase 2.5.
 *
 * Side-neutral throughout: founders use this app to find investors,
 * investors use it to find founders. Copy must serve both sides.
 *
 * Section order:
 *   1. Sticky nav
 *   2. Hero (centered + MatchFlow visual)
 *   3. Source ticker (credibility row, no marquee)
 *   4. Five inputs (the algorithm, made readable, with B1–B5 slots)
 *   5. Numbers (real research + custom SVG bar chart)
 *   6. How matching works (3 steps + Slot D motion graphic)
 *   7. Product vision (asymmetric bento — roadmap, not promises)
 *   8. FAQ (editorial 2-col, audience-grouped)
 *   9. Footer
 *
 * No waitlist (per locked decision). No fake product mockups.
 * No SEC / compliance band (intentionally cut).
 */

export default function HomePage() {
  return (
    <main
      id="main-content"
      className="bg-[color:var(--color-bg)] text-[color:var(--color-text)]"
    >
      <Nav />
      <Hero />
      <SourceTicker />
      <FiveInputs />
      <Numbers />
      <HowMatchingWorks />
      <ProductVision />
      <FAQ />
      <Footer />
      
      <GradualBlur
        target="page"
        position="bottom"
        height="7rem"
        strength={2}
        divCount={5}
        curve="bezier"
        exponential
        opacity={1}
      />
    </main>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--color-bg)]/70">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-6">
        <Wordmark size="md" />
        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          <a
            href="#how"
            className="text-sm text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-strong)]"
          >
            How matching works
          </a>
          <a
            href="#vision"
            className="text-sm text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-strong)]"
          >
            Vision
          </a>
          <a
            href="#faq"
            className="text-sm text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-strong)]"
          >
            FAQ
          </a>
          <div className="ml-1 flex items-center gap-3">
            <a
              href="/sign-in"
              className="text-sm font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-strong)]"
            >
              Sign in
            </a>
            <a
              href="/sign-up"
              className="rounded-[var(--radius-sm)] bg-[color:var(--color-brand)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[color:var(--color-brand-strong)]"
            >
              Get started
            </a>
          </div>
        </nav>
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

        <div className="flex items-center gap-4">
          <a
            href="/sign-up"
            className="rounded-[var(--radius)] bg-[color:var(--color-brand)] px-6 py-3 text-[15px] font-semibold text-white shadow-[0_1px_3px_rgba(22,163,74,0.25)] transition-all hover:bg-[color:var(--color-brand-strong)] hover:shadow-[0_2px_8px_rgba(22,163,74,0.3)]"
          >
            Get started
          </a>
          <a
            href="/sign-in"
            className="rounded-[var(--radius)] border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-6 py-3 text-[15px] font-semibold text-[color:var(--color-text-strong)] transition-colors hover:bg-[color:var(--color-bg)]"
          >
            Sign in
          </a>
        </div>
      </div>

      {/* Hero proof — animated sample pairings cycling through. */}
      <div className="relative mx-auto max-w-[1320px] px-6 pb-24 md:pb-32">
        <MatchFlow />
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[color:var(--color-bg)]">
      <div className="mx-auto max-w-[1280px] px-6 py-16">
        <div className="flex flex-col items-start gap-10 md:flex-row md:items-end md:justify-between">
          <div>
            <Wordmark size="lg" />
            <p className="mt-5 max-w-[40ch] text-[14px] leading-[1.65] text-[color:var(--color-text-muted)]">
              Score-based matching for founders and investors. Mutual interest unlocks contact.
            </p>
          </div>
          <nav
            aria-label="Footer"
            className="flex flex-wrap gap-x-8 gap-y-3 text-[14px] text-[color:var(--color-text-muted)]"
          >
            <a href="#how" className="hover:text-[color:var(--color-text-strong)]">
              How matching works
            </a>
            <a href="#vision" className="hover:text-[color:var(--color-text-strong)]">
              Vision
            </a>
            <a href="#faq" className="hover:text-[color:var(--color-text-strong)]">
              FAQ
            </a>
            <a
              href="https://github.com/abhijandyala/ventramatch"
              className="hover:text-[color:var(--color-text-strong)]"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </nav>
        </div>

        <div className="mt-14 flex flex-col items-start gap-3 border-t border-[color:var(--color-border)] pt-6 text-[12px] text-[color:var(--color-text-faint)] md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} VentraMatch.</p>
          <p>
            Informational only. Not investment advice. Sample pairings shown
            on this page are illustrative.
          </p>
        </div>
      </div>
    </footer>
  );
}
