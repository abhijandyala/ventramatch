"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";

/**
 * One-time banner shown on the dashboard when the user lands with
 * `?published=1` after successfully submitting their profile from /build.
 *
 * Nudges them back to fill depth sections + verifications, which drive
 * the matching algorithm uplift. Self-dismisses on click.
 */
export function PublishedBanner() {
  const params = useSearchParams();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (params.get("published") === "1") {
      setVisible(true);
      // Clean up the URL so a refresh doesn't re-show the banner.
      const url = new URL(window.location.href);
      url.searchParams.delete("published");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  }, [params]);

  if (!visible) return null;

  return (
    <div
      className="mb-4 flex flex-wrap items-center justify-between gap-3 border bg-[var(--color-brand-tint)] p-4"
      style={{ borderColor: "var(--color-brand)" }}
    >
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-[var(--color-text-strong)]">
          Profile published.
        </p>
        <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
          Add depth sections and verifications to climb the rankings — investors
          see richer profiles first.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={"/build#depth-editor" as Route}
          className="inline-flex h-9 items-center px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--color-brand)" }}
        >
          Add depth →
        </Link>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="inline-flex h-9 items-center px-3 text-[12.5px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
