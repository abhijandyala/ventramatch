"use client";

import { useState } from "react";
import { Check, ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Filters } from "@/lib/dashboards/mock-data";

const STAGE_OPTIONS = ["Pre-Seed", "Seed", "Series A", "Series B+"];
const INDUSTRY_OPTIONS = ["All industries", "B2B SaaS", "Fintech", "Climate Tech", "Healthcare", "Dev Tools"];
const CHECK_OPTIONS = ["Any", "$25K to $250K", "$250K to $1M", "$1M to $5M", "$5M to $10M+"];
const LOCATION_OPTIONS = ["All locations", "United States", "Canada", "Europe", "Remote"];

type FiltersPanelProps = {
  initial: Filters;
};

export function FiltersPanel({ initial }: FiltersPanelProps) {
  const [stages, setStages] = useState<string[]>(initial.stages);
  const [industry, setIndustry] = useState<string>(INDUSTRY_OPTIONS[0]);
  const [check, setCheck] = useState<string>(CHECK_OPTIONS[3]);
  const [location, setLocation] = useState<string>(LOCATION_OPTIONS[0]);

  const reset = () => {
    setStages([]);
    setIndustry(INDUSTRY_OPTIONS[0]);
    setCheck(CHECK_OPTIONS[0]);
    setLocation(LOCATION_OPTIONS[0]);
  };

  const toggleStage = (s: string) => {
    setStages((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  return (
    <aside
      aria-labelledby="filters-title"
      className="rounded-none border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
    >
      <header className="flex items-baseline justify-between">
        <h3
          id="filters-title"
          className="text-[14px] leading-5 font-semibold tracking-tight text-[var(--color-text)]"
        >
          Filters
        </h3>
        <button
          type="button"
          onClick={reset}
          className={cn(
            "inline-flex items-center gap-1",
            "text-[12px] leading-4 font-medium",
            "text-[var(--color-text-muted)]",
            "transition-colors duration-[120ms] ease-out",
            "hover:text-[var(--color-text)]",
          )}
        >
          <RotateCcw aria-hidden size={12} strokeWidth={1.75} />
          Reset
        </button>
      </header>

      <div className="mt-5">
        <FilterLabel>Stage</FilterLabel>
        <ul className="mt-2 flex flex-col gap-1.5">
          {STAGE_OPTIONS.map((s) => (
            <li key={s}>
              <Checkbox
                checked={stages.includes(s)}
                onChange={() => toggleStage(s)}
                label={s}
              />
            </li>
          ))}
        </ul>
      </div>

      <Select
        label="Industry"
        value={industry}
        options={INDUSTRY_OPTIONS}
        onChange={setIndustry}
        className="mt-5"
      />

      <Select
        label="Check size"
        value={check}
        options={CHECK_OPTIONS}
        onChange={setCheck}
        className="mt-5"
      />

      <Select
        label="Location"
        value={location}
        options={LOCATION_OPTIONS}
        onChange={setLocation}
        className="mt-5"
      />

      <button
        type="button"
        className={cn(
          "mt-6 inline-flex w-full items-center justify-center gap-1.5",
          "h-9 rounded-none",
          "border border-[var(--color-border)]",
          "text-[13px] font-medium text-[var(--color-text-muted)]",
          "transition-colors duration-[120ms] ease-out",
          "hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]",
        )}
      >
        <SlidersHorizontal aria-hidden size={12} strokeWidth={1.75} />
        More filters
      </button>
    </aside>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[12px] leading-4 font-medium tracking-[0.04em] uppercase text-[var(--color-text-faint)]">
      {children}
    </span>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="group flex cursor-pointer items-center gap-2.5 text-[13px] leading-5 text-[var(--color-text)]">
      <span
        className={cn(
          "inline-flex items-center justify-center",
          "h-4 w-4 rounded-[3px] border",
          "transition-colors duration-[120ms] ease-out",
          checked
            ? "border-[var(--color-brand-ink)] bg-[var(--color-brand-ink)] text-white"
            : "border-[var(--color-border)] bg-[var(--color-bg)] group-hover:border-[var(--color-text-muted)]",
        )}
      >
        {checked && <Check aria-hidden size={10} strokeWidth={2.5} />}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      {label}
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <FilterLabel>{label}</FilterLabel>
      <div className="relative mt-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-9 w-full appearance-none pl-3 pr-8",
            "rounded-none",
            "border border-[var(--color-border)]",
            "bg-[var(--color-bg)]",
            "text-[13px] leading-5 text-[var(--color-text)]",
            "transition-colors duration-[120ms] ease-out",
            "focus:border-[var(--color-brand-ink)] focus:outline-none",
          )}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          size={14}
          strokeWidth={1.75}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]"
        />
      </div>
    </div>
  );
}
