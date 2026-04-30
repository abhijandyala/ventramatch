import type { ReactNode } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/landing/wordmark";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
      <header className="sticky top-0 z-40 border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--color-bg)]/70">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-6">
          <Wordmark size="md" />
          <nav aria-label="Legal" className="flex items-center gap-6 text-[13px]">
            <Link
              href="/legal/tos"
              className="text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-strong)]"
            >
              Terms
            </Link>
            <Link
              href="/legal/privacy"
              className="text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-strong)]"
            >
              Privacy
            </Link>
            <Link
              href="/"
              className="text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-strong)]"
            >
              Back home
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-6 py-16">
        {children}
      </main>
    </div>
  );
}
