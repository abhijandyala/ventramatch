"use client";

import { Building2, Coins } from "lucide-react";
import type { Role } from "@/lib/validation/onboarding";
import { cn } from "@/lib/utils";

type Props = {
  value: Role | null;
  onChange: (role: Role) => void;
};

const OPTIONS: Array<{
  role: Role;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}> = [
  {
    role: "founder",
    label: "Founder",
    description: "I'm building a startup and looking to raise capital.",
    icon: Building2,
  },
  {
    role: "investor",
    label: "Investor",
    description: "I write checks into early-stage startups.",
    icon: Coins,
  },
];

export function RoleStep({ value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Are you a founder or an investor?" className="grid gap-3">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const selected = value === opt.role;
        return (
          <button
            key={opt.role}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.role)}
            className={cn(
              "flex w-full items-start gap-4 rounded-[var(--radius-md)] border bg-[var(--color-surface)] px-5 py-4 text-left",
              "transition-colors duration-150",
              selected
                ? "border-[var(--color-brand-ink)] bg-[var(--color-brand-tint)]"
                : "border-[var(--color-border)] hover:border-[var(--color-text-faint)]",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius)]",
                selected
                  ? "bg-[var(--color-brand-ink)] text-white"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-[15px] font-medium text-[var(--color-text)]">{opt.label}</span>
              <span className="text-[13px] leading-5 text-[var(--color-text-muted)]">
                {opt.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
