"use client";

import type { Role, InvestorType } from "@/lib/validation/onboarding";
import { Field, TextArea } from "./form-controls";
import { cn } from "@/lib/utils";

type ProfileData = {
  companyName: string;
  investorType: InvestorType;
  firmName: string;
  description: string;
  /**
   * Optional preference text. Strongest single signal for the future
   * ML/LLM recommendation model. Stored on `users.goals`.
   */
  lookingFor: string;
};

type Props = {
  role: Role;
  value: ProfileData;
  onChange: (next: ProfileData) => void;
  errors: Partial<Record<string, string>>;
};

export type { ProfileData };

const FOUNDER_LOOKING_FOR_PLACEHOLDER =
  "We are looking for AI, devtools, or B2B SaaS investors who can write $250K–$750K checks, help with enterprise sales, and understand seed-stage technical teams.";
const INVESTOR_LOOKING_FOR_PLACEHOLDER =
  "I am looking for seed-stage AI, fintech, or healthcare startups with strong technical founders, early traction, and room to invest $100K–$500K.";

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
        <LookingForField
          value={value.lookingFor}
          onChange={(v) => onChange({ ...value, lookingFor: v })}
          placeholder={FOUNDER_LOOKING_FOR_PLACEHOLDER}
          error={errors.lookingFor}
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
      <LookingForField
        value={value.lookingFor}
        onChange={(v) => onChange({ ...value, lookingFor: v })}
        placeholder={INVESTOR_LOOKING_FOR_PLACEHOLDER}
        error={errors.lookingFor}
      />
    </div>
  );
}

/**
 * Optional textarea capturing the user's open-ended preference. Stored on
 * `users.goals`. This is the strongest single signal for the future ML/LLM
 * recommendation model — encourage filling it out, but never block onboarding.
 */
function LookingForField({
  value,
  onChange,
  placeholder,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <TextArea
        id="lookingFor"
        label="What are you looking for?"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        error={error}
        maxLength={800}
      />
      <p className="text-[12px] leading-relaxed text-[var(--color-text-faint)]">
        Optional, but the more specific you are the better matches you&apos;ll see.
        You can edit this anytime.
      </p>
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
