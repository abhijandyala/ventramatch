import Link from "next/link";
import { Wordmark } from "@/components/landing/wordmark";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
      <header className="border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--color-bg)]/70">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-6">
          <Wordmark size="md" />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <p className="font-mono text-[12px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
          404 · page not found
        </p>
        <h1
          className="text-balance font-semibold text-[color:var(--color-text-strong)]"
          style={{
            fontSize: "var(--type-h1)",
            letterSpacing: "var(--tracking-h1)",
            lineHeight: 1.05,
          }}
        >
          That page isn&apos;t <span className="text-[color:var(--color-brand)]">matched.</span>
        </h1>
        <p className="max-w-[44ch] text-[16px] leading-[1.6] text-[color:var(--color-text-muted)]">
          The link is wrong or the page never existed. Head back to the
          landing page and pick up the trail.
        </p>
        <Link
          href="/"
          className="mt-2 inline-flex items-center gap-2 rounded-[10px] bg-[color:var(--color-text-strong)] px-5 py-3 text-[15px] font-medium text-white transition-colors hover:bg-black"
        >
          Back to home
        </Link>
      </div>

      <footer className="border-t border-[color:var(--color-border)] bg-[color:var(--color-bg)]">
        <div className="mx-auto max-w-[1280px] px-6 py-8 text-center text-[12px] text-[color:var(--color-text-faint)]">
          © {new Date().getFullYear()} VentraMatch. Informational only.
          Not investment advice.
        </div>
      </footer>
    </main>
  );
}
