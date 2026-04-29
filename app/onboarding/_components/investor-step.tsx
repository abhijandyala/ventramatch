"use client";

import {
  LEAD_FOLLOW_LABELS,
  STAGE_LABELS,
  type InvestorInfoInput,
  type LeadFollow,
  type Stage,
} from "@/lib/validation/onboarding";
import { Field, Select } from "./form-controls";

type Props = {
  value: InvestorInfoInput;
  onChange: (next: InvestorInfoInput) => void;
  errors: Partial<Record<string, string>>;
};

const STAGE_VALUES = Object.keys(STAGE_LABELS) as Stage[];
const LEAD_FOLLOW_VALUES = Object.keys(LEAD_FOLLOW_LABELS) as LeadFollow[];

export function InvestorStep({ value, onChange, errors }: Props) {
  return (
    <div className="grid gap-4">
      <Field
        id="checkSize"
        label="Check size"
        placeholder="e.g. $25K–$100K"
        value={value.checkSize}
        onChange={(v) => onChange({ ...value, checkSize: v })}
        error={errors.checkSize}
      />
      <Select
        id="preferredStage"
        label="Preferred stage"
        value={value.preferredStage}
        onChange={(v) => onChange({ ...value, preferredStage: v as Stage })}
        error={errors.preferredStage}
      >
        {STAGE_VALUES.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABELS[s]}
          </option>
        ))}
      </Select>
      <Field
        id="sectors"
        label="Sectors"
        placeholder="e.g. Climate, Fintech, Bio (comma separated)"
        value={value.sectors.join(", ")}
        onChange={(v) =>
          onChange({
            ...value,
            sectors: v
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0),
          })
        }
        error={errors.sectors}
        hint="Up to 12 sectors. Separate with commas."
      />
      <Field
        id="geography"
        label="Geography"
        placeholder="e.g. North America, EU"
        value={value.geography}
        onChange={(v) => onChange({ ...value, geography: v })}
        error={errors.geography}
      />
      <Select
        id="leadFollow"
        label="Lead or follow?"
        value={value.leadFollow}
        onChange={(v) => onChange({ ...value, leadFollow: v as LeadFollow })}
        error={errors.leadFollow}
      >
        {LEAD_FOLLOW_VALUES.map((s) => (
          <option key={s} value={s}>
            {LEAD_FOLLOW_LABELS[s]}
          </option>
        ))}
      </Select>
    </div>
  );
}
