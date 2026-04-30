"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { MobileDrawer } from "@/components/ui/mobile-drawer";
import { FilterPanel } from "@/components/feed/filter-panel";
import { SaveSearchButton } from "@/components/feed/save-search-button";

/**
 * Shown only below lg (1024px). Toggles a bottom-sheet drawer containing
 * the FilterPanel + SaveSearchButton. On desktop these render directly
 * in the sidebar; this component renders nothing.
 */
export function MobileFilterToggle({ role }: { role: "founder" | "investor" }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-full items-center justify-center gap-2 border bg-[var(--color-surface)] text-[13px] font-medium text-[var(--color-text-strong)] transition-colors hover:bg-[var(--color-bg)]"
        style={{ borderColor: "var(--color-border)" }}
      >
        <SlidersHorizontal size={14} />
        Filters & search
      </button>

      <MobileDrawer open={open} onClose={() => setOpen(false)} title="Filters">
        <FilterPanel role={role} />
        <div className="mt-4">
          <SaveSearchButton />
        </div>
      </MobileDrawer>
    </>
  );
}
