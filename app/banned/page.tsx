import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/landing/wordmark";
import { signOutAction } from "@/lib/account/actions";

export const metadata: Metadata = {
  title: "Account suspended — VentraMatch",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function BannedPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[color:var(--color-bg)] px-6">
      <div className="w-full max-w-[420px] text-center">
        <Wordmark size="md" />

        <div
          className="mt-10 px-8 py-10"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-danger)",
          }}
        >
          <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[color:var(--color-danger)]">
            Account suspended
          </p>
          <h1 className="mt-3 text-[22px] font-semibold tracking-tight text-[color:var(--color-text-strong)]">
            This account has been suspended
          </h1>
          <p className="mt-4 text-[14px] leading-[1.6] text-[color:var(--color-text-muted)]">
            Our review team has determined this account violates our{" "}
            <Link
              href="/legal/tos"
              target="_blank"
              className="font-medium underline underline-offset-4 hover:text-[color:var(--color-text-strong)]"
            >
              Terms of Service
            </Link>
            . If you believe this is a mistake, contact support and we&apos;ll
            review it within two business days.
          </p>
          <div className="mt-7 flex flex-col gap-3">
            <a
              href="mailto:support@ventramatch.com?subject=Account%20suspended%20%E2%80%94%20appeal"
              className="inline-flex h-11 items-center justify-center bg-[color:var(--color-text-strong)] px-5 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
            >
              Contact support
            </a>
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex h-11 w-full items-center justify-center text-[14px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-strong)]"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
