"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Field ─────────────────────────────────────────────────────────────── */

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
};

export function Field({ id, label, value, onChange, placeholder, error, hint }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-[var(--color-text)]">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(
          "h-11 w-full rounded-[var(--radius)] border px-3.5 text-[15px] text-[var(--color-text)]",
          "bg-white placeholder:text-[var(--color-text-faint)]",
          "transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-ink)]/20",
          error
            ? "border-[var(--color-danger)]"
            : "border-[var(--color-border)] hover:border-[var(--color-text-faint)]",
        )}
      />
      {error ? (
        <p id={`${id}-error`} className="text-[13px] text-[var(--color-danger)]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[12px] text-[var(--color-text-faint)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ─── TextArea ───────────────────────────────────────────────────────────── */

type TextAreaProps = {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  error?: string;
  maxLength?: number;
};

export function TextArea({ id, label, value, onChange, placeholder, error, maxLength }: TextAreaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[13px] font-medium text-[var(--color-text)]">
          {label}
        </label>
        {maxLength ? (
          <span className="text-[12px] text-[var(--color-text-faint)]">
            {value.length} / {maxLength}
          </span>
        ) : null}
      </div>
      <textarea
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          "w-full resize-none rounded-[var(--radius)] border px-3.5 py-2.5 text-[15px] leading-relaxed text-[var(--color-text)]",
          "bg-white placeholder:text-[var(--color-text-faint)]",
          "transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-ink)]/20",
          error
            ? "border-[var(--color-danger)]"
            : "border-[var(--color-border)] hover:border-[var(--color-text-faint)]",
        )}
      />
      {error ? (
        <p id={`${id}-error`} className="text-[13px] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ─── Select ─────────────────────────────────────────────────────────────── */

type SelectProps = {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  children: ReactNode;
};

export function Select({ id, label, value, onChange, error, children }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-[var(--color-text)]">
        {label}
      </label>
      <select
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          "h-11 w-full rounded-[var(--radius)] border px-3.5 text-[15px] text-[var(--color-text)]",
          "bg-white transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-ink)]/20",
          error
            ? "border-[var(--color-danger)]"
            : "border-[var(--color-border)] hover:border-[var(--color-text-faint)]",
        )}
      >
        {children}
      </select>
      {error ? (
        <p id={`${id}-error`} className="text-[13px] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ─── SectorChips ────────────────────────────────────────────────────────── */

const SECTOR_OPTIONS = [
  "AI / ML",
  "Climate",
  "Fintech",
  "Healthcare",
  "EdTech",
  "Consumer",
  "Enterprise SaaS",
  "Hardware",
  "Crypto / Web3",
  "Biotech",
  "E-commerce",
  "Dev Tools",
  "Media",
  "Marketplace",
  "Deep Tech",
  "Future of Work",
  "Space",
  "Defense",
  "Gaming",
  "Mobility",
];

type SectorChipsProps = {
  value: string[];
  onChange: (next: string[]) => void;
  error?: string;
};

export function SectorChips({ value, onChange, error }: SectorChipsProps) {
  function toggle(sector: string) {
    if (value.includes(sector)) {
      onChange(value.filter((s) => s !== sector));
    } else if (value.length < 12) {
      onChange([...value, sector]);
    }
  }

  const atMax = value.length >= 12;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-[var(--color-text)]">Sectors</span>
        <span className="text-[12px] text-[var(--color-text-faint)]">
          {value.length} / 12 selected
        </span>
      </div>

      <div
        role="group"
        aria-label="Select sectors (up to 12)"
        className="flex flex-wrap gap-2"
      >
        {SECTOR_OPTIONS.map((sector) => {
          const selected = value.includes(sector);
          const disabled = atMax && !selected;

          return (
            <button
              key={sector}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => toggle(sector)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border",
                "px-3 py-1.5 text-[13px] font-medium",
                "transition-all duration-150",
                selected
                  ? "border-[var(--color-brand-ink)] bg-[var(--color-brand-tint)] text-[var(--color-brand-ink)]"
                  : [
                      "border-[var(--color-border)] bg-white text-[var(--color-text-muted)]",
                      "hover:border-[var(--color-text-faint)]",
                    ],
                disabled && "cursor-not-allowed opacity-40",
              )}
            >
              {selected ? <Check className="h-3 w-3" strokeWidth={2.5} /> : null}
              {sector}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="text-[13px] text-[var(--color-danger)]">{error}</p>
      ) : (
        atMax && (
          <p className="text-[12px] text-[var(--color-text-faint)]">
            12 sectors selected. Deselect one to change.
          </p>
        )
      )}
    </div>
  );
}
