"use client";

import type { Role } from "@/lib/validation/onboarding";
import { TextArea } from "./form-controls";

type Props = {
  role: Role;
  value: string;
  onChange: (next: string) => void;
  error?: string;
};

const PLACEHOLDERS: Record<Role, string> = {
  founder:
    "e.g. Find investors actively writing checks at my stage, get warm intros, and close my round faster.",
  investor:
    "e.g. Discover pre-seed startups in climate and AI before they hit my inbox, and connect directly with founders.",
};

export function GoalsStep({ role, value, onChange, error }: Props) {
  return (
    <div className="grid gap-5">
      <TextArea
        id="goals"
        label="What do you hope to achieve on VentraMatch?"
        placeholder={PLACEHOLDERS[role]}
        value={value}
        onChange={onChange}
        error={error}
        maxLength={500}
      />
    </div>
  );
}
