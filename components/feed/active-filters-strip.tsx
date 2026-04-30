"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { X } from "lucide-react";
import {
  STAGE_LABELS,
  filtersToSearchParams,
  hasActiveFilters,
  parseFeedFilters,
  type FeedFilters,
} from "@/lib/feed/filters";

/**
 * Renders the currently-applied filters as removable chips above the feed
 * results. Mirrors the FilterPanel state — both read from URL params.
 *
 * Renders nothing when no filters are active.
 */
export function ActiveFiltersStrip() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = parseFeedFilters(searchParams);
  const [, startTransition] = useTransition();

  if (!hasActiveFilters(filters)) return null;

  function update(next: Partial<FeedFilters>) {
    const merged: FeedFilters = { ...filters, ...next };
    const sp = filtersToSearchParams(merged);
    startTransition(() => router.push((sp.toString() ? `/feed?${sp.toString()}` : "/feed") as Route));
  }

  const chips: { id: string; label: string; onRemove: () => void }[] = [];

  if (filters.q) {
    chips.push({
      id: "q",
      label: `“${filters.q}”`,
      onRemove: () => update({ q: undefined }),
    });
  }
  for (const stage of filters.stages) {
    chips.push({
      id: `stage:${stage}`,
      label: STAGE_LABELS[stage],
      onRemove: () => update({ stages: filters.stages.filter((s) => s !== stage) }),
    });
  }
  for (const ind of filters.industries) {
    chips.push({
      id: `ind:${ind}`,
      label: ind,
      onRemove: () => update({ industries: filters.industries.filter((s) => s !== ind) }),
    });
  }
  for (const geo of filters.geographies) {
    chips.push({
      id: `geo:${geo}`,
      label: geo,
      onRemove: () => update({ geographies: filters.geographies.filter((s) => s !== geo) }),
    });
  }
  if (filters.amountMin != null) {
    chips.push({
      id: "amountMin",
      label: `≥ $${filters.amountMin.toLocaleString()}`,
      onRemove: () => update({ amountMin: undefined }),
    });
  }
  if (filters.amountMax != null) {
    chips.push({
      id: "amountMax",
      label: `≤ $${filters.amountMax.toLocaleString()}`,
      onRemove: () => update({ amountMax: undefined }),
    });
  }

  return (
    <ul className="mb-4 flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={c.onRemove}
            className="inline-flex items-center gap-1.5 px-2 py-1 text-[11.5px] font-medium text-[var(--color-text-strong)] transition-colors"
            style={{
              background: "var(--color-brand-tint)",
              border: "1px solid var(--color-brand)",
            }}
          >
            {c.label}
            <X size={10} aria-label={`Remove ${c.label}`} />
          </button>
        </li>
      ))}
    </ul>
  );
}
