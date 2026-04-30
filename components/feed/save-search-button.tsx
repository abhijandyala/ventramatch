"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { Bookmark, Loader2 } from "lucide-react";
import {
  hasActiveFilters,
  parseFeedFilters,
} from "@/lib/feed/filters";
import { saveSearchAction } from "@/app/(dashboard)/searches/actions";

/**
 * Button mounted under the FilterPanel that snapshots the current URL
 * params into a saved search. Disabled when no filters are active —
 * saving "all results" is meaningless.
 *
 * Two-state UI: idle button → inline name input → saved confirmation.
 */
export function SaveSearchButton() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseFeedFilters(searchParams), [searchParams]);
  const active = hasActiveFilters(filters);
  const [stage, setStage] = useState<"idle" | "naming" | "saved">("idle");
  const [name, setName] = useState("");
  const [notify, setNotify] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function suggestName(): string {
    const parts: string[] = [];
    if (filters.q) parts.push(`"${filters.q}"`);
    if (filters.industries.length) parts.push(filters.industries.slice(0, 2).join("/"));
    if (filters.stages.length) parts.push(filters.stages[0]);
    if (filters.geographies.length) parts.push(filters.geographies[0]);
    return parts.length ? parts.join(" · ") : "Untitled search";
  }

  function commit() {
    setError(null);
    const finalName = name.trim() || suggestName();
    startTransition(async () => {
      const res = await saveSearchAction({
        name: finalName,
        filters,
        notifyEmail: notify,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setStage("saved");
      setTimeout(() => setStage("idle"), 2400);
    });
  }

  if (stage === "saved") {
    return (
      <div className="flex items-center justify-between gap-3 border bg-[var(--color-brand-tint)] px-3 py-2 text-[12px] text-[var(--color-brand-strong)]" style={{ borderColor: "var(--color-brand)" }}>
        <span>Saved.</span>
        <button
          type="button"
          onClick={() => router.push("/searches" as Route)}
          className="font-medium underline-offset-4 hover:underline"
        >
          View saved →
        </button>
      </div>
    );
  }

  if (!active) {
    return (
      <p className="text-[11.5px] text-[var(--color-text-faint)]">
        Adjust filters to save this search.
      </p>
    );
  }

  if (stage === "idle") {
    return (
      <button
        type="button"
        onClick={() => {
          setName(suggestName());
          setStage("naming");
        }}
        className="inline-flex w-full items-center justify-center gap-2 px-3 py-2 text-[12.5px] font-medium text-[var(--color-text-strong)] transition-colors"
        style={{
          background: "var(--color-bg)",
          border: "1px dashed var(--color-text-strong)",
        }}
      >
        <Bookmark size={12} />
        Save this search
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 border bg-[var(--color-surface)] p-3" style={{ borderColor: "var(--color-border)" }}>
      <input
        type="text"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        placeholder="Name this search"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") setStage("idle");
        }}
        className="border bg-[var(--color-bg)] px-2.5 py-1.5 text-[12.5px] text-[var(--color-text)] outline-none focus:border-[var(--color-text)]"
        style={{ borderColor: "var(--color-border)" }}
      />
      <label className="flex items-start gap-2 text-[11.5px] text-[var(--color-text-muted)]">
        <input
          type="checkbox"
          checked={notify}
          onChange={(e) => setNotify(e.target.checked)}
          className="mt-0.5 accent-[var(--color-brand)]"
        />
        <span>Email me when new matches appear (weekly).</span>
      </label>
      {error ? (
        <p role="alert" className="text-[11.5px] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setStage("idle")}
          className="text-[11.5px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={commit}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "var(--color-text-strong)" }}
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Save
        </button>
      </div>
    </div>
  );
}
