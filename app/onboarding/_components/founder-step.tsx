"use client";

import {
  STAGE_LABELS,
  type FounderInfoInput,
  type Stage,
} from "@/lib/validation/onboarding";
import { Field, Select } from "./form-controls";

type Props = {
  value: FounderInfoInput;
  onChange: (next: FounderInfoInput) => void;
  errors: Partial<Record<string, string>>;
};

const STAGE_VALUES = Object.keys(STAGE_LABELS) as Stage[];

export function FounderStep({ value, onChange, errors }: Props) {
  return (
    <div className="grid gap-4">
      <Field
        id="industry"
        label="Industry"
        placeholder="e.g. Climate tech"
        value={value.industry}
        onChange={(v) => onChange({ ...value, industry: v })}
        error={errors.industry}
      />
      <Select
        id="stage"
        label="Stage"
        value={value.stage}
        onChange={(v) => onChange({ ...value, stage: v as Stage })}
        error={errors.stage}
      >
        {STAGE_VALUES.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABELS[s]}
          </option>
        ))}
      </Select>
      <Field
        id="amountRaising"
        label="Amount raising"
        placeholder="e.g. $1.5M"
        value={value.amountRaising}
        onChange={(v) => onChange({ ...value, amountRaising: v })}
        error={errors.amountRaising}
      />
      <Field
        id="location"
        label="Location"
        placeholder="e.g. San Francisco, CA"
        value={value.location}
        onChange={(v) => onChange({ ...value, location: v })}
        error={errors.location}
      />
    </div>
  );
}
