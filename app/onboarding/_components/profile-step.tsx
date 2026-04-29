"use client";

import type { Role, InvestorType } from "@/lib/validation/onboarding";
import { Field, TextArea } from "./form-controls";
import { cn } from "@/lib/utils";

type ProfileData = {
  companyName: string;
  investorType: InvestorType;
  firmName: string;
  description: string;
};

type Props = {
  role: Role;
  value: ProfileData;
  onChange: (next: ProfileData) => void;
  errors: Partial<Record<string, string>>;
};

export type { ProfileData };

export function ProfileStep({ role, value, onChange, errors }: Props) {
  if (role === "founder") {
    return (
      <div className="grid gap-5">
        <Field
          id="companyName"
          label="Startup name"
          placeholder="e.g. Acme Labs"
          value={value.companyName}
          onChange={(v) => onChange({ ...value, companyName: v })}
          error={errors.companyName}
        />
        <TextArea
          id="description"
          label="What does your startup do?"
          placeholder="One or two sentences — what you're building and for whom."
          value={value.description}
          onChange={(v) => onChange({ ...value, description: v })}
          error={errors.description}
          maxLength={300}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <InvestorTypeToggle
        value={value.investorType}
        onChange={(v) => onChange({ ...value, investorType: v })}
      />
      {value.investorType === "firm" && (
        <Field
          id="firmName"
          label="Firm name"
          placeholder="e.g. Sequoia Capital"
          value={value.firmName}
          onChange={(v) => onChange({ ...value, firmName: v })}
          error={errors.firmName}
        />
      )}
      <TextArea
        id="description"
        label={value.investorType === "firm" ? "What does your firm focus on?" : "What do you invest in?"}
        placeholder="One or two sentences — your thesis, sectors, or what excites you."
        value={value.description}
        onChange={(v) => onChange({ ...value, description: v })}
        error={errors.description}
        maxLength={300}
      />
    </div>
  );
}

function InvestorTypeToggle({
  value,
  onChange,
}: {
  value: InvestorType;
  onChange: (v: InvestorType) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-[var(--color-text)]">
        How do you invest?
      </span>
      <div className="flex gap-2">
        {(["firm", "angel"] as const).map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={cn(
                "flex-1 rounded-[var(--radius)] border px-4 py-2.5 text-[14px] font-medium transition-colors duration-150",
                active
                  ? "border-[var(--color-brand-ink)] bg-[var(--color-brand-tint)] text-[var(--color-brand-ink)]"
                  : "border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:border-[var(--color-text-faint)]",
              )}
            >
              {option === "firm" ? "Investment firm" : "Angel investor"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
