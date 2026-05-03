"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { FilterPanel } from "@/components/feed/filter-panel";
import { SaveSearchButton } from "@/components/feed/save-search-button";
import { cn } from "@/lib/utils";

export function FeedToolbar({ role }: { role: "founder" | "investor" }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex w-full items-start gap-3">
      {/* Filter toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-2 px-3.5 text-[12px] font-medium transition-colors",
          "border border-[var(--color-border)]",
          open
            ? "bg-[var(--color-text)] text-white"
            : "bg-white text-[var(--color-text)] hover:bg-[var(--color-surface)]",
        )}
      >
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <line x1="2" y1="4" x2="14" y2="4" />
          <line x1="4" y1="8" x2="12" y2="8" />
          <line x1="6" y1="12" x2="10" y2="12" />
        </svg>
        Filters
      </button>

      {open ? (
        /* Filter panel opens inline to the right */
        <div className="min-w-0 flex-1 border border-[var(--color-border)] bg-white">
          <Suspense fallback={<FilterPanelSkeleton />}>
            <FilterPanel role={role} />
          </Suspense>
        </div>
      ) : (
        /* Saved searches — visible only when filters are closed */
        <>
          <Link
            href={"/searches" as Route}
            className="inline-flex h-9 shrink-0 items-center px-3.5 text-[12px] font-medium text-[var(--color-text-muted)] border border-[var(--color-border)] bg-white transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
          >
            Saved searches
          </Link>
          <Suspense fallback={null}>
            <SaveSearchButton />
          </Suspense>
        </>
      )}
    </div>
  );
}

function FilterPanelSkeleton() {
  return (
    <div className="p-4">
      <p className="text-[11px] text-[var(--color-text-faint)]">Loading filters...</p>
    </div>
  );
}
