"use client";

import { useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Loader2 } from "lucide-react";
import { acceptLegalAction } from "@/lib/legal/actions";

/**
 * Modal that blocks the user until they re-accept updated legal documents.
 *
 * Rendered by the (dashboard) layout when the user's stored legal versions
 * don't match the current constants. Uses a native <dialog> overlay that
 * can't be dismissed by clicking outside or pressing Escape.
 */
export function VersionBumpModal({
  tosOutdated,
  privacyOutdated,
}: {
  tosOutdated: boolean;
  privacyOutdated: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (!tosOutdated && !privacyOutdated) return null;

  function accept() {
    startTransition(async () => {
      await acceptLegalAction();
      window.location.reload();
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div
        className="flex w-full max-w-[480px] flex-col gap-5 border bg-[var(--color-bg)] p-6"
        style={{ borderColor: "var(--color-border)" }}
      >
        <header>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--color-text-faint)]">
            Legal update
          </p>
          <h2 className="mt-1 text-[18px] font-semibold tracking-tight text-[var(--color-text-strong)]">
            We&apos;ve updated our terms
          </h2>
          <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--color-text-muted)]">
            Please review and accept the updated documents to continue
            using VentraMatch.
          </p>
        </header>

        <ul className="flex flex-col gap-2">
          {tosOutdated ? (
            <li className="flex items-center justify-between gap-3 border bg-[var(--color-surface)] px-4 py-3" style={{ borderColor: "var(--color-border)" }}>
              <span className="text-[13.5px] font-medium text-[var(--color-text-strong)]">
                Terms of Service
              </span>
              <Link
                href={"/legal/tos" as Route}
                target="_blank"
                className="text-[12px] font-medium text-[var(--color-brand-strong)] underline-offset-4 hover:underline"
              >
                Read →
              </Link>
            </li>
          ) : null}
          {privacyOutdated ? (
            <li className="flex items-center justify-between gap-3 border bg-[var(--color-surface)] px-4 py-3" style={{ borderColor: "var(--color-border)" }}>
              <span className="text-[13.5px] font-medium text-[var(--color-text-strong)]">
                Privacy Policy
              </span>
              <Link
                href={"/legal/privacy" as Route}
                target="_blank"
                className="text-[12px] font-medium text-[var(--color-brand-strong)] underline-offset-4 hover:underline"
              >
                Read →
              </Link>
            </li>
          ) : null}
        </ul>

        <button
          type="button"
          onClick={accept}
          disabled={isPending}
          className="inline-flex h-10 items-center justify-center gap-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: "var(--color-brand)" }}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          I accept the updated terms
        </button>

        <p className="text-[11.5px] leading-[1.55] text-[var(--color-text-faint)]">
          By clicking above you agree to the current version of our Terms of
          Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
