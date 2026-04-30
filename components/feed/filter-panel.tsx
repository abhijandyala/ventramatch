"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { Loader2, Search, X } from "lucide-react";
import {
  DEFAULT_FILTERS,
  STAGE_LABELS,
  STARTUP_STAGES,
  SORT_LABELS,
  SORT_OPTIONS,
  filtersToSearchParams,
  hasActiveFilters,
  parseFeedFilters,
  type FeedFilters,
  type SortOption,
} from "@/lib/feed/filters";
import type { StartupStage } from "@/types/database";

/**
 * Sidebar of filters that drives /feed.
 *
 * URL-driven: every change pushes to the router so back/forward + sharing
 * work. Filters live in the URL; saved searches are just snapshots of the
 * current URL params.
 *
 * Shape changes per role:
 *   • investor viewer → industries label "Sectors", amount label "Raise size"
 *   • founder viewer → industries label "Investor sectors", amount label "Check size"
 */

type Props = {
  role: "founder" | "investor";
  /**
   * The set of distinct values in the result set today, used to populate
   * autocomplete-style chips. Optional — when not provided the user types
   * their own.
   */
  facets?: {
    industries: string[];
    geographies: string[];
  };
};

export function FilterPanel({ role, facets }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const filters = useMemo(() => parseFeedFilters(searchParams), [searchParams]);
  const active = hasActiveFilters(filters);

  function update(next: Partial<FeedFilters>) {
    const merged: FeedFilters = { ...filters, ...next };
    const sp = filtersToSearchParams(merged);
    const url = sp.toString() ? `/feed?${sp.toString()}` : "/feed";
    startTransition(() => router.push(url as Route));
  }

  function clearAll() {
    startTransition(() => router.push("/feed" as Route));
  }

  const isInvestor = role === "investor";
  const labels = {
    industries: isInvestor ? "Sectors" : "Investor sectors",
    amount: isInvestor ? "Raise size" : "Check size",
  };

  return (
    <aside
      aria-label="Filters"
      className="flex flex-col gap-6 border bg-[var(--color-surface)] p-4"
      style={{ borderColor: "var(--color-border)" }}
    >
      <header className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
          Filters
        </p>
        {active ? (
          <button
            type="button"
            onClick={clearAll}
            disabled={isPending}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)] disabled:opacity-60"
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X size={11} />}
            Clear all
          </button>
        ) : null}
      </header>

      {/* Search */}
      <SearchField defaultValue={filters.q ?? ""} onSubmit={(q) => update({ q: q || undefined })} />

      {/* Sort */}
      <FieldGroup label="Sort by">
        <div className="flex flex-wrap gap-1.5">
          {SORT_OPTIONS.map((s) => {
            const checked = filters.sort === s;
            return (
              <Chip
                key={s}
                label={SORT_LABELS[s]}
                checked={checked}
                onToggle={() => update({ sort: s as SortOption })}
              />
            );
          })}
        </div>
      </FieldGroup>

      {/* Stages */}
      <FieldGroup label="Stage">
        <div className="flex flex-wrap gap-1.5">
          {STARTUP_STAGES.map((s) => {
            const checked = filters.stages.includes(s);
            return (
              <Chip
                key={s}
                label={STAGE_LABELS[s]}
                checked={checked}
                onToggle={() => {
                  const next = checked
                    ? filters.stages.filter((x) => x !== s)
                    : ([...filters.stages, s] as StartupStage[]);
                  update({ stages: next });
                }}
              />
            );
          })}
        </div>
      </FieldGroup>

      {/* Industries / sectors */}
      <FieldGroup label={labels.industries}>
        <FreeInputChips
          values={filters.industries}
          suggestions={facets?.industries ?? []}
          placeholder="e.g. Fintech, Climate, B2B SaaS"
          onChange={(v) => update({ industries: v })}
        />
      </FieldGroup>

      {/* Geographies */}
      <FieldGroup label="Location">
        <FreeInputChips
          values={filters.geographies}
          suggestions={facets?.geographies ?? []}
          placeholder="e.g. NYC, SF, EU"
          onChange={(v) => update({ geographies: v })}
        />
      </FieldGroup>

      {/* Amount range */}
      <FieldGroup label={labels.amount} hint="USD. Either bound is optional.">
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            placeholder="Min"
            value={filters.amountMin}
            onCommit={(v) => update({ amountMin: v })}
          />
          <NumberInput
            placeholder="Max"
            value={filters.amountMax}
            onCommit={(v) => update({ amountMax: v })}
          />
        </div>
      </FieldGroup>

      {isPending ? (
        <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
          Updating…
        </p>
      ) : null}
    </aside>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Sub-components
// ──────────────────────────────────────────────────────────────────────────

function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
        {label}
      </span>
      {children}
      {hint ? <p className="text-[11px] text-[var(--color-text-faint)]">{hint}</p> : null}
    </div>
  );
}

function Chip({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className="inline-flex items-center px-2.5 py-1 text-[12px] font-medium transition-colors"
      style={{
        background: checked ? "var(--color-text-strong)" : "var(--color-bg)",
        color: checked ? "white" : "var(--color-text-muted)",
        border: `1px solid ${checked ? "var(--color-text-strong)" : "var(--color-border)"}`,
      }}
    >
      {label}
    </button>
  );
}

function SearchField({
  defaultValue,
  onSubmit,
}: {
  defaultValue: string;
  onSubmit: (q: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  // Reset local state when the URL-driven default changes (e.g. clear-all).
  useEffect(() => setValue(defaultValue), [defaultValue]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value.trim());
      }}
      className="flex items-center gap-1.5 border bg-[var(--color-bg)] px-2.5"
      style={{ borderColor: "var(--color-border)" }}
    >
      <Search size={13} className="shrink-0 text-[var(--color-text-faint)]" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search names, industry, thesis…"
        className="h-9 flex-1 bg-transparent text-[13px] text-[var(--color-text)] outline-none"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setValue("");
            onSubmit("");
          }}
          className="grid h-5 w-5 place-items-center text-[var(--color-text-faint)] hover:text-[var(--color-text-strong)]"
        >
          <X size={11} />
        </button>
      ) : null}
    </form>
  );
}

/**
 * Comma-separated free-input that displays existing chips. Suggestions appear
 * as a quick-pick row when the input is empty (or filtered as the user types).
 */
function FreeInputChips({
  values,
  suggestions,
  placeholder,
  onChange,
}: {
  values: string[];
  suggestions: string[];
  placeholder: string;
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const v = raw.trim();
    if (!v) return;
    if (values.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    onChange([...values, v]);
    setDraft("");
  }

  function remove(v: string) {
    onChange(values.filter((x) => x !== v));
  }

  const matching = useMemo(() => {
    const q = draft.trim().toLowerCase();
    const set = new Set(values.map((v) => v.toLowerCase()));
    const all = suggestions.filter((s) => !set.has(s.toLowerCase()));
    if (!q) return all.slice(0, 8);
    return all.filter((s) => s.toLowerCase().includes(q)).slice(0, 8);
  }, [draft, suggestions, values]);

  return (
    <div className="flex flex-col gap-2">
      {values.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <li
              key={v}
              className="inline-flex items-center gap-1 border bg-[var(--color-bg)] px-2 py-1 text-[11.5px] text-[var(--color-text)]"
              style={{ borderColor: "var(--color-text-strong)" }}
            >
              <span>{v}</span>
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => remove(v)}
                className="text-[var(--color-text-faint)] transition-colors hover:text-[var(--color-text-strong)]"
              >
                <X size={10} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          }
          if (e.key === "Backspace" && !draft && values.length > 0) {
            remove(values[values.length - 1]);
          }
        }}
        placeholder={placeholder}
        className="h-9 border bg-[var(--color-bg)] px-2.5 text-[12.5px] text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text)]"
        style={{ borderColor: "var(--color-border)" }}
      />
      {matching.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {matching.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => commit(s)}
                className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
                style={{
                  background: "var(--color-bg)",
                  border: "1px dashed var(--color-border)",
                }}
              >
                + {s}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function NumberInput({
  placeholder,
  value,
  onCommit,
}: {
  placeholder: string;
  value: number | undefined;
  onCommit: (next: number | undefined) => void;
}) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  useEffect(() => setDraft(value == null ? "" : String(value)), [value]);
  function commit() {
    const trimmed = draft.replace(/[^0-9]/g, "");
    if (!trimmed) {
      onCommit(undefined);
    } else {
      onCommit(Math.max(0, Math.floor(Number(trimmed))));
    }
  }
  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
      className="h-9 border bg-[var(--color-bg)] px-2.5 font-mono text-[12.5px] text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text)]"
      style={{ borderColor: "var(--color-border)" }}
    />
  );
}

// Defaults export so other code can read the shape if it ever needs to.
export { DEFAULT_FILTERS };
