"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
          "h-11 w-full rounded-[var(--radius)] border px-3 text-[15px] text-[var(--color-text)]",
          "bg-[var(--color-surface)] placeholder:text-[var(--color-text-faint)]",
          "transition-colors duration-150",
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
          "h-11 w-full rounded-[var(--radius)] border px-3 text-[15px] text-[var(--color-text)]",
          "bg-[var(--color-surface)] transition-colors duration-150",
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
