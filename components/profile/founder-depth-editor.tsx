"use client";

/**
 * Founder profile depth editor.
 *
 * Collapsible sections appended after the main builder wizard on /build.
 * Each section saves independently so the user can fill them in any order.
 *
 * Data flow:
 *   - Props carry the current saved state (loaded server-side in
 *     app/build/page.tsx via fetchStartupDepth).
 *   - On save, the section calls the corresponding server action and shows
 *     an inline success / error state.
 *   - No global form state — each section is self-contained.
 *
 * Disclaimer: Bands and percentages shown here are founder-stated. They
 * are informational only and are not investment advice. This copy must
 * appear near any financial-figure input.
 */

import { useState, useTransition } from "react";
import { SaveIndicator, type SaveStatus } from "@/components/profile/save-indicator";
import {
  saveStartupTeamAction,
  saveStartupRoundDetailsAction,
  saveStartupCapTableAction,
  saveStartupUseOfFundsAction,
  saveStartupTractionAction,
  saveStartupMarketAnalysisAction,
  saveStartupCompetitorsAction,
  saveStartupNarrativeAction,
} from "@/app/build/depth-actions";
import type {
  StartupTeamMemberInput,
  StartupRoundDetailsInput,
  StartupCapTableSummaryInput,
  StartupUseOfFundsInput,
  StartupTractionSignalInput,
  StartupMarketAnalysisInput,
  StartupCompetitorInput,
  StartupNarrativeInput,
} from "@/lib/validation/depth";
import type { StartupDepthView } from "@/lib/profile/visibility";

// ──────────────────────────────────────────────────────────────────────────
//  Shared layout
// ──────────────────────────────────────────────────────────────────────────

function SectionShell({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[var(--color-border)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div>
          <p className="text-[13.5px] font-semibold tracking-tight text-[var(--color-text-strong)]">
            {title}
          </p>
          <p className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">
            {hint}
          </p>
        </div>
        <span
          className="shrink-0 text-[var(--color-text-faint)] transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open ? (
        <div className="border-t border-[var(--color-border)] px-5 pb-6 pt-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function SaveBar({
  saving,
  result,
  onSave,
}: {
  saving: boolean;
  result: { ok: boolean; message: string } | null;
  onSave: () => void;
}) {
  const status: SaveStatus = saving ? "saving" : result?.ok === false ? "error" : result?.ok === true ? "saved" : "idle";
  return (
    <SaveIndicator
      variant="bar"
      status={status}
      errorMessage={result?.ok === false ? result.message : null}
      onSave={onSave}
      label="Save section"
    />
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[160px_1fr]">
      <label className="pt-2 text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
        {label}
      </label>
      <div>{children}</div>
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string | number | null | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "number" | "url" | "date";
}) {
  return (
    <input
      type={type}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 w-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
    />
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: T | null | undefined;
  onChange: (v: T | undefined) => void;
  options: { value: T; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value as T) || undefined)}
      className="h-9 w-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
    >
      <option value="">{placeholder ?? "— select —"}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[var(--color-text)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      {label}
    </label>
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  maxLength,
  hint,
}: {
  value: string | null | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  hint?: string;
}) {
  const charCount = (value ?? "").length;
  return (
    <div className="space-y-1">
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
      />
      <div className="flex items-center justify-between text-[11px] text-[var(--color-text-faint)]">
        {hint ? <span>{hint}</span> : <span />}
        {maxLength && (
          <span className={charCount > maxLength * 0.9 ? "text-amber-600" : ""}>
            {charCount}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Team section
// ──────────────────────────────────────────────────────────────────────────

const EQUITY_BAND_OPTIONS = [
  { value: "under_5" as const, label: "Under 5%" },
  { value: "5_15" as const, label: "5–15%" },
  { value: "15_30" as const, label: "15–30%" },
  { value: "30_50" as const, label: "30–50%" },
  { value: "over_50" as const, label: "50%+" },
];

function TeamSection({ initial }: { initial: StartupDepthView["team"] }) {
  const [members, setMembers] = useState<StartupTeamMemberInput[]>(
    initial.length > 0
      ? initial.map((m) => ({
          name: m.name,
          role: m.role,
          is_founder: m.is_founder,
          is_full_time: m.is_full_time,
          bio: m.bio ?? undefined,
          prior_company: m.prior_company ?? undefined,
          prior_role: m.prior_role ?? undefined,
          linkedin_url: m.linkedin_url ?? undefined,
          github_url: m.github_url ?? undefined,
          equity_pct_band:
            (m.equity_pct_band as StartupTeamMemberInput["equity_pct_band"]) ??
            undefined,
          display_order: m.display_order,
        }))
      : [],
  );
  const [saving, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function addMember() {
    setMembers((prev) => [
      ...prev,
      {
        name: "",
        role: "",
        is_founder: false,
        is_full_time: true,
        display_order: prev.length,
      },
    ]);
  }

  function update(i: number, patch: Partial<StartupTeamMemberInput>) {
    setMembers((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }

  function remove(i: number) {
    setMembers((prev) => prev.filter((_, idx) => idx !== i));
  }

  function save() {
    start(async () => {
      const r = await saveStartupTeamAction(members);
      setResult(r.ok ? { ok: true, message: "Saved." } : { ok: false, message: r.error });
    });
  }

  return (
    <SectionShell
      title="Team"
      hint="Founders, co-founders, and key hires visible to verified investors."
    >
      <div className="space-y-4">
        {members.map((m, i) => (
          <div
            key={i}
            className="space-y-3 border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
                Member {i + 1}
              </p>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-[12px] text-[var(--color-text-faint)] hover:text-red-600"
              >
                Remove
              </button>
            </div>
            <FieldRow label="Name">
              <Input value={m.name} onChange={(v) => update(i, { name: v })} placeholder="Jane Smith" />
            </FieldRow>
            <FieldRow label="Role / title">
              <Input value={m.role} onChange={(v) => update(i, { role: v })} placeholder="CTO" />
            </FieldRow>
            <div className="flex flex-wrap gap-4">
              <Checkbox
                checked={m.is_founder ?? false}
                onChange={(v) => update(i, { is_founder: v })}
                label="Co-founder"
              />
              <Checkbox
                checked={m.is_full_time ?? true}
                onChange={(v) => update(i, { is_full_time: v })}
                label="Full-time"
              />
            </div>
            <FieldRow label="Equity band">
              <Select
                value={m.equity_pct_band}
                onChange={(v) => update(i, { equity_pct_band: v })}
                options={EQUITY_BAND_OPTIONS}
                placeholder="— select —"
              />
            </FieldRow>
            <FieldRow label="Prior company">
              <Input value={m.prior_company} onChange={(v) => update(i, { prior_company: v })} placeholder="Stripe" />
            </FieldRow>
            <FieldRow label="Prior role">
              <Input value={m.prior_role} onChange={(v) => update(i, { prior_role: v })} placeholder="Engineer" />
            </FieldRow>
            <FieldRow label="LinkedIn">
              <Input value={m.linkedin_url} onChange={(v) => update(i, { linkedin_url: v })} placeholder="https://linkedin.com/in/..." type="url" />
            </FieldRow>
            <FieldRow label="Bio">
              <textarea
                value={m.bio ?? ""}
                onChange={(e) => update(i, { bio: e.target.value })}
                placeholder="Short bio — 1–2 sentences."
                rows={2}
                maxLength={600}
                className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
              />
            </FieldRow>
          </div>
        ))}
        <button
          type="button"
          onClick={addMember}
          className="h-9 border border-dashed border-[var(--color-border)] px-4 text-[12.5px] text-[var(--color-text-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand-strong)]"
        >
          + Add member
        </button>
      </div>
      <SaveBar saving={saving} result={result} onSave={save} />
    </SectionShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Round details section
// ──────────────────────────────────────────────────────────────────────────

const INSTRUMENT_OPTIONS = [
  { value: "safe_post_money" as const, label: "SAFE (post-money)" },
  { value: "safe_pre_money" as const, label: "SAFE (pre-money)" },
  { value: "priced_round" as const, label: "Priced equity" },
  { value: "convertible_note" as const, label: "Convertible note" },
];

const LEAD_STATUS_OPTIONS = [
  { value: "open" as const, label: "Open — no commitments yet" },
  { value: "soliciting_lead" as const, label: "Looking for a lead" },
  { value: "lead_committed" as const, label: "Lead committed" },
  { value: "oversubscribed" as const, label: "Oversubscribed" },
];

const VALUATION_BAND_OPTIONS = [
  { value: "under_3m" as const, label: "Under $3M" },
  { value: "3_5m" as const, label: "$3–5M" },
  { value: "5_10m" as const, label: "$5–10M" },
  { value: "10_20m" as const, label: "$10–20M" },
  { value: "20_50m" as const, label: "$20–50M" },
  { value: "50_100m" as const, label: "$50–100M" },
  { value: "over_100m" as const, label: "Over $100M" },
];

function RoundSection({ initial }: { initial: StartupDepthView["round"] }) {
  const [form, setForm] = useState<StartupRoundDetailsInput>({
    instrument: (initial?.instrument as StartupRoundDetailsInput["instrument"]) ?? undefined,
    valuation_band: (initial?.valuation_band as StartupRoundDetailsInput["valuation_band"]) ?? undefined,
    target_raise_usd: initial?.target_raise_usd ?? undefined,
    min_check_usd: initial?.min_check_usd ?? undefined,
    lead_status: (initial?.lead_status as StartupRoundDetailsInput["lead_status"]) ?? "open",
    close_by_date: initial?.close_by_date ?? undefined,
    committed_amount_usd: initial?.committed_amount_usd ?? 0,
    use_of_funds_summary: initial?.use_of_funds_summary ?? undefined,
    instrument_terms_summary: initial?.instrument_terms_summary ?? undefined,
    runway_months_after_raise: initial?.runway_months_after_raise ?? undefined,
    milestones_summary: initial?.milestones_summary ?? undefined,
  });
  const [saving, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function save() {
    start(async () => {
      const r = await saveStartupRoundDetailsAction(form);
      setResult(r.ok ? { ok: true, message: "Saved." } : { ok: false, message: r.error });
    });
  }

  return (
    <SectionShell
      title="Round details"
      hint="Instrument, valuation band, lead status. Visible to verified investors pre-match."
    >
      <p className="mb-4 text-[11.5px] italic text-[var(--color-text-faint)]">
        Bands are founder-stated and informational only. Not investment advice.
      </p>
      <div className="space-y-3">
        <FieldRow label="Instrument">
          <Select
            value={form.instrument}
            onChange={(v) => setForm((f) => ({ ...f, instrument: v }))}
            options={INSTRUMENT_OPTIONS}
          />
        </FieldRow>
        <FieldRow label="Valuation band">
          <Select
            value={form.valuation_band}
            onChange={(v) => setForm((f) => ({ ...f, valuation_band: v }))}
            options={VALUATION_BAND_OPTIONS}
          />
        </FieldRow>
        <FieldRow label="Target raise ($)">
          <Input
            type="number"
            value={form.target_raise_usd}
            onChange={(v) => setForm((f) => ({ ...f, target_raise_usd: v ? Number(v) : undefined }))}
            placeholder="500000"
          />
        </FieldRow>
        <FieldRow label="Min check ($)">
          <Input
            type="number"
            value={form.min_check_usd}
            onChange={(v) => setForm((f) => ({ ...f, min_check_usd: v ? Number(v) : undefined }))}
            placeholder="25000"
          />
        </FieldRow>
        <FieldRow label="Lead status">
          <Select
            value={form.lead_status}
            onChange={(v) => setForm((f) => ({ ...f, lead_status: v ?? "open" }))}
            options={LEAD_STATUS_OPTIONS}
          />
        </FieldRow>
        <FieldRow label="Close by">
          <Input
            type="date"
            value={form.close_by_date}
            onChange={(v) => setForm((f) => ({ ...f, close_by_date: v || undefined }))}
          />
        </FieldRow>
        <FieldRow label="Committed ($)">
          <Input
            type="number"
            value={form.committed_amount_usd}
            onChange={(v) => setForm((f) => ({ ...f, committed_amount_usd: v ? Number(v) : 0 }))}
            placeholder="0"
          />
        </FieldRow>
        <FieldRow label="Use of funds (summary)">
          <textarea
            value={form.use_of_funds_summary ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, use_of_funds_summary: e.target.value || undefined }))}
            placeholder="~60% engineering, ~40% GTM ramp."
            rows={2}
            maxLength={500}
            className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
          />
        </FieldRow>
        <FieldRow label="Key terms">
          <textarea
            value={form.instrument_terms_summary ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, instrument_terms_summary: e.target.value || undefined }))}
            placeholder="Pro-rata rights, MFN, standard YC SAFE terms."
            rows={2}
            maxLength={500}
            className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
          />
        </FieldRow>
        <FieldRow label="Runway (months)">
          <Input
            type="number"
            value={form.runway_months_after_raise}
            onChange={(v) => setForm((f) => ({ ...f, runway_months_after_raise: v ? Number(v) : undefined }))}
            placeholder="18"
          />
        </FieldRow>
        <FieldRow label="Milestones">
          <TextArea
            value={form.milestones_summary}
            onChange={(v) => setForm((f) => ({ ...f, milestones_summary: v || undefined }))}
            placeholder="Key milestones you plan to hit with this raise: product launch, first 100 customers, etc."
            rows={3}
            maxLength={1500}
            hint="What will you achieve with this funding?"
          />
        </FieldRow>
      </div>
      <SaveBar saving={saving} result={result} onSave={save} />
    </SectionShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Traction signals section
// ──────────────────────────────────────────────────────────────────────────

const TRACTION_KIND_OPTIONS = [
  { value: "mrr" as const, label: "MRR ($)" },
  { value: "arr" as const, label: "ARR ($)" },
  { value: "gross_revenue" as const, label: "Gross revenue ($)" },
  { value: "paying_customers" as const, label: "Paying customers" },
  { value: "design_partners" as const, label: "Design partners" },
  { value: "signed_lois" as const, label: "Signed LOIs" },
  { value: "waitlist_size" as const, label: "Waitlist size" },
  { value: "dau" as const, label: "DAU" },
  { value: "mau" as const, label: "MAU" },
  { value: "retention_day_30" as const, label: "D30 retention (%)" },
  { value: "retention_day_90" as const, label: "D90 retention (%)" },
  { value: "nps" as const, label: "NPS (−100 to 100)" },
  { value: "gross_margin_pct" as const, label: "Gross margin (%)" },
  { value: "cac_usd" as const, label: "CAC ($)" },
  { value: "ltv_usd" as const, label: "LTV ($)" },
  { value: "contracted_revenue" as const, label: "Contracted revenue ($)" },
  { value: "gmv" as const, label: "GMV ($)" },
];

const SOURCE_KIND_OPTIONS = [
  { value: "stripe_dashboard" as const, label: "Stripe dashboard" },
  { value: "bank_statement" as const, label: "Bank statement" },
  { value: "crm_export" as const, label: "CRM export" },
  { value: "csv_upload" as const, label: "CSV upload" },
  { value: "self_attested" as const, label: "Self-attested" },
  { value: "other" as const, label: "Other" },
];

function TractionSection({ initial }: { initial: StartupDepthView["traction"] }) {
  const [signals, setSignals] = useState<StartupTractionSignalInput[]>(
    initial.length > 0
      ? initial.map((s) => ({
          kind: s.kind,
          value_numeric: typeof s.value_numeric === "string" ? Number(s.value_numeric) : s.value_numeric,
          period_start: s.period_start ?? undefined,
          period_end: s.period_end ?? undefined,
          evidence_url: s.evidence_url ?? undefined,
          source_kind: s.source_kind,
          self_reported: s.self_reported,
          notes: s.notes ?? undefined,
          display_order: s.display_order,
        }))
      : [],
  );
  const [saving, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function add() {
    setSignals((prev) => [
      ...prev,
      { kind: "mrr", value_numeric: 0, source_kind: "self_attested", self_reported: true, display_order: prev.length },
    ]);
  }

  function update(i: number, patch: Partial<StartupTractionSignalInput>) {
    setSignals((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function remove(i: number) {
    setSignals((prev) => prev.filter((_, idx) => idx !== i));
  }

  function save() {
    start(async () => {
      const r = await saveStartupTractionAction(signals);
      setResult(r.ok ? { ok: true, message: "Saved." } : { ok: false, message: r.error });
    });
  }

  return (
    <SectionShell
      title="Traction signals"
      hint="Structured metrics replace the freeform traction text in the matching engine."
    >
      <p className="mb-4 text-[11.5px] italic text-[var(--color-text-faint)]">
        Self-reported values are labeled until verified via evidence URL. Be accurate.
      </p>
      <div className="space-y-4">
        {signals.map((s, i) => (
          <div
            key={i}
            className="space-y-3 border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
                Signal {i + 1}
              </p>
              <button type="button" onClick={() => remove(i)} className="text-[12px] text-[var(--color-text-faint)] hover:text-red-600">
                Remove
              </button>
            </div>
            <FieldRow label="Metric">
              <Select
                value={s.kind}
                onChange={(v) => update(i, { kind: v ?? "mrr" })}
                options={TRACTION_KIND_OPTIONS}
              />
            </FieldRow>
            <FieldRow label="Value">
              <Input
                type="number"
                value={s.value_numeric}
                onChange={(v) => update(i, { value_numeric: v ? Number(v) : 0 })}
                placeholder="e.g. 25000"
              />
            </FieldRow>
            <FieldRow label="Source">
              <Select
                value={s.source_kind}
                onChange={(v) => update(i, { source_kind: v ?? "self_attested" })}
                options={SOURCE_KIND_OPTIONS}
              />
            </FieldRow>
            <FieldRow label="Evidence URL">
              <Input
                type="url"
                value={s.evidence_url}
                onChange={(v) => update(i, { evidence_url: v || undefined })}
                placeholder="https://dashboard.stripe.com/..."
              />
            </FieldRow>
            <FieldRow label="Notes">
              <Input
                value={s.notes}
                onChange={(v) => update(i, { notes: v || undefined })}
                placeholder="Excludes one enterprise pilot."
              />
            </FieldRow>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="h-9 border border-dashed border-[var(--color-border)] px-4 text-[12.5px] text-[var(--color-text-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand-strong)]"
        >
          + Add signal
        </button>
      </div>
      <SaveBar saving={saving} result={result} onSave={save} />
    </SectionShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Market analysis section
// ──────────────────────────────────────────────────────────────────────────

const MARKET_BAND_OPTIONS = [
  { value: "under_100m" as const, label: "Under $100M" },
  { value: "100m_500m" as const, label: "$100M–$500M" },
  { value: "500m_1b" as const, label: "$500M–$1B" },
  { value: "1b_10b" as const, label: "$1B–$10B" },
  { value: "10b_100b" as const, label: "$10B–$100B" },
  { value: "over_100b" as const, label: "Over $100B" },
];

function MarketSection({ initial }: { initial: StartupDepthView["market"] }) {
  const [form, setForm] = useState<StartupMarketAnalysisInput>({
    tam_band: (initial?.tam_band as StartupMarketAnalysisInput["tam_band"]) ?? undefined,
    sam_band: (initial?.sam_band as StartupMarketAnalysisInput["sam_band"]) ?? undefined,
    som_band: (initial?.som_band as StartupMarketAnalysisInput["som_band"]) ?? undefined,
    methodology_summary: initial?.methodology_summary ?? undefined,
    source_links:
      Array.isArray(initial?.source_links)
        ? (initial.source_links as unknown as string[]).filter((s): s is string => typeof s === "string")
        : [],
  });
  const [saving, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [newSource, setNewSource] = useState("");

  function save() {
    start(async () => {
      const r = await saveStartupMarketAnalysisAction(form);
      setResult(r.ok ? { ok: true, message: "Saved." } : { ok: false, message: r.error });
    });
  }

  return (
    <SectionShell
      title="Market analysis"
      hint="TAM / SAM / SOM bands and your methodology. Visible to verified investors."
    >
      <div className="space-y-3">
        <FieldRow label="TAM">
          <Select value={form.tam_band} onChange={(v) => setForm((f) => ({ ...f, tam_band: v }))} options={MARKET_BAND_OPTIONS} />
        </FieldRow>
        <FieldRow label="SAM">
          <Select value={form.sam_band} onChange={(v) => setForm((f) => ({ ...f, sam_band: v }))} options={MARKET_BAND_OPTIONS} />
        </FieldRow>
        <FieldRow label="SOM">
          <Select value={form.som_band} onChange={(v) => setForm((f) => ({ ...f, som_band: v }))} options={MARKET_BAND_OPTIONS} />
        </FieldRow>
        <FieldRow label="Methodology">
          <textarea
            value={form.methodology_summary ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, methodology_summary: e.target.value || undefined }))}
            placeholder="Bottoms-up: 12k US mid-market hospitals × $50k ACP × 30% reach."
            rows={3}
            maxLength={1000}
            className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
          />
        </FieldRow>
        <FieldRow label="Sources">
          <div className="space-y-2">
            {(form.source_links ?? []).map((url, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 truncate text-[12.5px] text-[var(--color-text-muted)]">{url}</span>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, source_links: f.source_links?.filter((_, idx) => idx !== i) }))}
                  className="text-[11.5px] text-[var(--color-text-faint)] hover:text-red-600"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="url"
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                placeholder="https://..."
                className="h-8 flex-1 border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
              />
              <button
                type="button"
                disabled={!newSource.trim()}
                onClick={() => {
                  if (!newSource.trim()) return;
                  setForm((f) => ({ ...f, source_links: [...(f.source_links ?? []), newSource.trim()] }));
                  setNewSource("");
                }}
                className="h-8 px-3 text-[12.5px] font-medium text-white disabled:opacity-40"
                style={{ background: "var(--color-brand)" }}
              >
                Add
              </button>
            </div>
          </div>
        </FieldRow>
      </div>
      <SaveBar saving={saving} result={result} onSave={save} />
    </SectionShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Competitive landscape section
// ──────────────────────────────────────────────────────────────────────────

function CompetitorsSection({ initial }: { initial: StartupDepthView["competitors"] }) {
  const [rows, setRows] = useState<StartupCompetitorInput[]>(
    initial.length > 0
      ? initial.map((c) => ({
          competitor_name: c.competitor_name,
          differentiation: c.differentiation ?? undefined,
          link_url: c.link_url ?? undefined,
          display_order: c.display_order,
        }))
      : [],
  );
  const [saving, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function add() {
    setRows((prev) => [
      ...prev,
      { competitor_name: "", display_order: prev.length },
    ]);
  }

  function update(i: number, patch: Partial<StartupCompetitorInput>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function remove(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function save() {
    start(async () => {
      const r = await saveStartupCompetitorsAction(rows);
      setResult(r.ok ? { ok: true, message: "Saved." } : { ok: false, message: r.error });
    });
  }

  return (
    <SectionShell
      title="Competitive landscape"
      hint="Name your competitors and your differentiation. Visible to verified investors."
    >
      <div className="space-y-4">
        {rows.map((row, i) => (
          <div
            key={i}
            className="space-y-3 border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
                Competitor {i + 1}
              </p>
              <button type="button" onClick={() => remove(i)} className="text-[12px] text-[var(--color-text-faint)] hover:text-red-600">
                Remove
              </button>
            </div>
            <FieldRow label="Name">
              <Input value={row.competitor_name} onChange={(v) => update(i, { competitor_name: v })} placeholder="Acme Corp" />
            </FieldRow>
            <FieldRow label="Differentiation">
              <textarea
                value={row.differentiation ?? ""}
                onChange={(e) => update(i, { differentiation: e.target.value || undefined })}
                placeholder="We do X; they focus on Y and don't cover Z."
                rows={2}
                maxLength={500}
                className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
              />
            </FieldRow>
            <FieldRow label="Link">
              <Input type="url" value={row.link_url} onChange={(v) => update(i, { link_url: v || undefined })} placeholder="https://acmecorp.com" />
            </FieldRow>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="h-9 border border-dashed border-[var(--color-border)] px-4 text-[12.5px] text-[var(--color-text-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand-strong)]"
        >
          + Add competitor
        </button>
      </div>
      <SaveBar saving={saving} result={result} onSave={save} />
    </SectionShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Cap table section
// ──────────────────────────────────────────────────────────────────────────

const FOUNDERS_PCT_OPTIONS = [
  { value: "under_50" as const, label: "Under 50%" },
  { value: "50_70" as const, label: "50–70%" },
  { value: "70_85" as const, label: "70–85%" },
  { value: "85_95" as const, label: "85–95%" },
  { value: "over_95" as const, label: "95%+" },
];

const EMPLOYEE_POOL_OPTIONS = [
  { value: "none" as const, label: "None yet" },
  { value: "under_10" as const, label: "Under 10%" },
  { value: "10_15" as const, label: "10–15%" },
  { value: "15_20" as const, label: "15–20%" },
  { value: "over_20" as const, label: "20%+" },
];

const OUTSIDE_INVESTORS_OPTIONS = [
  { value: "none_yet" as const, label: "None yet" },
  { value: "under_15" as const, label: "Under 15%" },
  { value: "15_25" as const, label: "15–25%" },
  { value: "25_35" as const, label: "25–35%" },
  { value: "over_35" as const, label: "35%+" },
];

const LAST_ROUND_OPTIONS = [
  { value: "under_500k" as const, label: "Under $500K" },
  { value: "500k_1m" as const, label: "$500K–$1M" },
  { value: "1m_3m" as const, label: "$1M–$3M" },
  { value: "3m_10m" as const, label: "$3M–$10M" },
  { value: "10m_25m" as const, label: "$10M–$25M" },
  { value: "over_25m" as const, label: "$25M+" },
];

function CapTableSection({ initial }: { initial: StartupDepthView["capTable"] }) {
  const [form, setForm] = useState<StartupCapTableSummaryInput>({
    founders_pct_band: (initial?.founders_pct_band as StartupCapTableSummaryInput["founders_pct_band"]) ?? undefined,
    employee_pool_pct_band: (initial?.employee_pool_pct_band as StartupCapTableSummaryInput["employee_pool_pct_band"]) ?? undefined,
    outside_investors_pct_band: (initial?.outside_investors_pct_band as StartupCapTableSummaryInput["outside_investors_pct_band"]) ?? undefined,
    prior_raises_count: initial?.prior_raises_count ?? 0,
    last_round_amount_band: (initial?.last_round_amount_band as StartupCapTableSummaryInput["last_round_amount_band"]) ?? undefined,
    last_round_year: initial?.last_round_year ?? undefined,
  });
  const [saving, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function save() {
    start(async () => {
      const r = await saveStartupCapTableAction(form);
      setResult(r.ok ? { ok: true, message: "Saved." } : { ok: false, message: r.error });
    });
  }

  return (
    <SectionShell
      title="Cap table summary"
      hint="Ownership bands — no exact percentages. Visible to verified investors."
    >
      <p className="mb-4 text-[11.5px] italic text-[var(--color-text-faint)]">
        Bands are approximate and informational only. Not investment advice.
      </p>
      <div className="space-y-3">
        <FieldRow label="Founders">
          <Select value={form.founders_pct_band} onChange={(v) => setForm((f) => ({ ...f, founders_pct_band: v }))} options={FOUNDERS_PCT_OPTIONS} />
        </FieldRow>
        <FieldRow label="Employee pool">
          <Select value={form.employee_pool_pct_band} onChange={(v) => setForm((f) => ({ ...f, employee_pool_pct_band: v }))} options={EMPLOYEE_POOL_OPTIONS} />
        </FieldRow>
        <FieldRow label="Outside investors">
          <Select value={form.outside_investors_pct_band} onChange={(v) => setForm((f) => ({ ...f, outside_investors_pct_band: v }))} options={OUTSIDE_INVESTORS_OPTIONS} />
        </FieldRow>
        <FieldRow label="Prior raises">
          <Input type="number" value={form.prior_raises_count} onChange={(v) => setForm((f) => ({ ...f, prior_raises_count: v ? Number(v) : 0 }))} placeholder="0" />
        </FieldRow>
        <FieldRow label="Last round size">
          <Select value={form.last_round_amount_band} onChange={(v) => setForm((f) => ({ ...f, last_round_amount_band: v }))} options={LAST_ROUND_OPTIONS} />
        </FieldRow>
        <FieldRow label="Last round year">
          <Input type="number" value={form.last_round_year} onChange={(v) => setForm((f) => ({ ...f, last_round_year: v ? Number(v) : undefined }))} placeholder="2023" />
        </FieldRow>
      </div>
      <SaveBar saving={saving} result={result} onSave={save} />
    </SectionShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Narrative section (0035 investor-grade depth)
// ──────────────────────────────────────────────────────────────────────────

const ACV_BAND_OPTIONS = [
  { value: "under_1k" as const, label: "Under $1K" },
  { value: "1k_10k" as const, label: "$1K–$10K" },
  { value: "10k_50k" as const, label: "$10K–$50K" },
  { value: "50k_250k" as const, label: "$50K–$250K" },
  { value: "250k_1m" as const, label: "$250K–$1M" },
  { value: "over_1m" as const, label: "Over $1M" },
];

const GROSS_MARGIN_OPTIONS = [
  { value: "under_30" as const, label: "Under 30%" },
  { value: "30_50" as const, label: "30–50%" },
  { value: "50_70" as const, label: "50–70%" },
  { value: "70_85" as const, label: "70–85%" },
  { value: "over_85" as const, label: "Over 85%" },
];

const SALES_CYCLE_OPTIONS = [
  { value: "under_1wk" as const, label: "Under 1 week" },
  { value: "1_4wk" as const, label: "1–4 weeks" },
  { value: "1_3mo" as const, label: "1–3 months" },
  { value: "3_6mo" as const, label: "3–6 months" },
  { value: "6_12mo" as const, label: "6–12 months" },
  { value: "over_12mo" as const, label: "Over 12 months" },
];

function NarrativeSection({ initial }: { initial: StartupDepthView["narrative"] }) {
  const [form, setForm] = useState<StartupNarrativeInput>({
    // Problem
    problem_statement: initial?.problem_statement ?? undefined,
    target_customer: initial?.target_customer ?? undefined,
    current_alternatives: initial?.current_alternatives ?? undefined,
    why_alternatives_fail: initial?.why_alternatives_fail ?? undefined,
    // Solution
    product_summary: initial?.product_summary ?? undefined,
    key_features: initial?.key_features ?? undefined,
    technical_moat: initial?.technical_moat ?? undefined,
    roadmap: initial?.roadmap ?? undefined,
    // Market narrative
    target_market: initial?.target_market ?? undefined,
    market_trend: initial?.market_trend ?? undefined,
    beachhead_market: initial?.beachhead_market ?? undefined,
    why_now: initial?.why_now ?? undefined,
    // Customer proof
    notable_customers: initial?.notable_customers ?? undefined,
    customer_proof: initial?.customer_proof ?? undefined,
    retention_engagement: initial?.retention_engagement ?? undefined,
    // Business model
    revenue_model: initial?.revenue_model ?? undefined,
    pricing: initial?.pricing ?? undefined,
    average_contract_value_band: (initial?.average_contract_value_band as StartupNarrativeInput["average_contract_value_band"]) ?? undefined,
    gross_margin_band: (initial?.gross_margin_band as StartupNarrativeInput["gross_margin_band"]) ?? undefined,
    sales_cycle_band: (initial?.sales_cycle_band as StartupNarrativeInput["sales_cycle_band"]) ?? undefined,
    // Go-to-market
    acquisition_channels: initial?.acquisition_channels ?? undefined,
    current_gtm: initial?.current_gtm ?? undefined,
    planned_gtm: initial?.planned_gtm ?? undefined,
    why_channels_work: initial?.why_channels_work ?? undefined,
    // Competition narrative
    why_we_win: initial?.why_we_win ?? undefined,
    defensibility: initial?.defensibility ?? undefined,
    investor_misunderstanding: initial?.investor_misunderstanding ?? undefined,
    // Team narrative
    founder_background: initial?.founder_background ?? undefined,
    founder_market_fit: initial?.founder_market_fit ?? undefined,
    technical_strengths: initial?.technical_strengths ?? undefined,
    business_strengths: initial?.business_strengths ?? undefined,
    advisors: initial?.advisors ?? undefined,
    key_hires_needed: initial?.key_hires_needed ?? undefined,
    // Risks
    technical_risk: initial?.technical_risk ?? undefined,
    market_risk: initial?.market_risk ?? undefined,
    execution_risk: initial?.execution_risk ?? undefined,
    biggest_unknown: initial?.biggest_unknown ?? undefined,
    failure_scenario: initial?.failure_scenario ?? undefined,
  });
  const [saving, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function save() {
    start(async () => {
      const r = await saveStartupNarrativeAction(form);
      setResult(r.ok ? { ok: true, message: "Saved." } : { ok: false, message: r.error });
    });
  }

  return (
    <SectionShell
      title="Investor pitch narrative"
      hint="Structured answers to key investor questions. Improves match quality and profile strength."
    >
      <div className="space-y-6">
        {/* Problem */}
        <div className="space-y-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
            Problem
          </p>
          <FieldRow label="Problem statement">
            <TextArea
              value={form.problem_statement}
              onChange={(v) => setForm((f) => ({ ...f, problem_statement: v || undefined }))}
              placeholder="What specific pain point are you solving? Be concrete."
              maxLength={1500}
              hint="Investors need to understand the problem clearly."
            />
          </FieldRow>
          <FieldRow label="Target customer">
            <TextArea
              value={form.target_customer}
              onChange={(v) => setForm((f) => ({ ...f, target_customer: v || undefined }))}
              placeholder="Who has this problem? Be specific about the persona, company size, or segment."
              rows={2}
              maxLength={800}
            />
          </FieldRow>
          <FieldRow label="Current alternatives">
            <TextArea
              value={form.current_alternatives}
              onChange={(v) => setForm((f) => ({ ...f, current_alternatives: v || undefined }))}
              placeholder="How do customers solve this problem today? Manual processes, competitors, workarounds?"
              rows={2}
              maxLength={1200}
            />
          </FieldRow>
          <FieldRow label="Why alternatives fail">
            <TextArea
              value={form.why_alternatives_fail}
              onChange={(v) => setForm((f) => ({ ...f, why_alternatives_fail: v || undefined }))}
              placeholder="What's wrong with current solutions? Why is there an opening?"
              rows={2}
              maxLength={1200}
            />
          </FieldRow>
        </div>

        {/* Solution */}
        <div className="space-y-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
            Solution
          </p>
          <FieldRow label="Product summary">
            <TextArea
              value={form.product_summary}
              onChange={(v) => setForm((f) => ({ ...f, product_summary: v || undefined }))}
              placeholder="What is your product and how does it work? Keep it crisp."
              maxLength={1500}
              hint="Describe what you've built, not the vision."
            />
          </FieldRow>
          <FieldRow label="Key features">
            <TextArea
              value={form.key_features}
              onChange={(v) => setForm((f) => ({ ...f, key_features: v || undefined }))}
              placeholder="List 3–5 core features that differentiate you."
              rows={3}
              maxLength={2000}
            />
          </FieldRow>
          <FieldRow label="Technical moat">
            <TextArea
              value={form.technical_moat}
              onChange={(v) => setForm((f) => ({ ...f, technical_moat: v || undefined }))}
              placeholder="What's hard to replicate? Proprietary data, algorithms, integrations, network effects?"
              rows={2}
              maxLength={1200}
            />
          </FieldRow>
          <FieldRow label="Roadmap">
            <TextArea
              value={form.roadmap}
              onChange={(v) => setForm((f) => ({ ...f, roadmap: v || undefined }))}
              placeholder="Key product milestones for the next 12–18 months."
              rows={3}
              maxLength={2000}
            />
          </FieldRow>
        </div>

        {/* Market narrative */}
        <div className="space-y-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
            Market
          </p>
          <FieldRow label="Target market">
            <TextArea
              value={form.target_market}
              onChange={(v) => setForm((f) => ({ ...f, target_market: v || undefined }))}
              placeholder="Who are you selling to? Industry, segment, geography."
              rows={2}
              maxLength={1000}
            />
          </FieldRow>
          <FieldRow label="Market trend">
            <TextArea
              value={form.market_trend}
              onChange={(v) => setForm((f) => ({ ...f, market_trend: v || undefined }))}
              placeholder="What macro trends are driving this market? Regulatory, technological, behavioral?"
              rows={2}
              maxLength={1200}
            />
          </FieldRow>
          <FieldRow label="Beachhead market">
            <TextArea
              value={form.beachhead_market}
              onChange={(v) => setForm((f) => ({ ...f, beachhead_market: v || undefined }))}
              placeholder="Where are you starting? Which niche will you dominate first?"
              rows={2}
              maxLength={1000}
            />
          </FieldRow>
          <FieldRow label="Why now?">
            <TextArea
              value={form.why_now}
              onChange={(v) => setForm((f) => ({ ...f, why_now: v || undefined }))}
              placeholder="Why is this the right time for this company to exist?"
              rows={2}
              maxLength={1200}
              hint="Timing is often the #1 factor in startup success."
            />
          </FieldRow>
        </div>

        {/* Customer proof */}
        <div className="space-y-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
            Customer proof
          </p>
          <FieldRow label="Notable customers">
            <TextArea
              value={form.notable_customers}
              onChange={(v) => setForm((f) => ({ ...f, notable_customers: v || undefined }))}
              placeholder="Name-drop if you can. Fortune 500, well-known brands, logos."
              rows={2}
              maxLength={1200}
            />
          </FieldRow>
          <FieldRow label="Customer proof">
            <TextArea
              value={form.customer_proof}
              onChange={(v) => setForm((f) => ({ ...f, customer_proof: v || undefined }))}
              placeholder="Quotes, case studies, ROI metrics from existing customers."
              rows={3}
              maxLength={2000}
              hint="Specifics beat generalities."
            />
          </FieldRow>
          <FieldRow label="Retention / engagement">
            <TextArea
              value={form.retention_engagement}
              onChange={(v) => setForm((f) => ({ ...f, retention_engagement: v || undefined }))}
              placeholder="How sticky is the product? Churn, usage frequency, NPS."
              rows={2}
              maxLength={1200}
            />
          </FieldRow>
        </div>

        {/* Business model */}
        <div className="space-y-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
            Business model
          </p>
          <FieldRow label="Revenue model">
            <TextArea
              value={form.revenue_model}
              onChange={(v) => setForm((f) => ({ ...f, revenue_model: v || undefined }))}
              placeholder="SaaS, marketplace, usage-based, transactional, licensing?"
              rows={2}
              maxLength={800}
            />
          </FieldRow>
          <FieldRow label="Pricing">
            <TextArea
              value={form.pricing}
              onChange={(v) => setForm((f) => ({ ...f, pricing: v || undefined }))}
              placeholder="Tiers, pricing points, how you charge."
              rows={2}
              maxLength={1000}
            />
          </FieldRow>
          <FieldRow label="ACV band">
            <Select
              value={form.average_contract_value_band}
              onChange={(v) => setForm((f) => ({ ...f, average_contract_value_band: v }))}
              options={ACV_BAND_OPTIONS}
              placeholder="Average contract value"
            />
          </FieldRow>
          <FieldRow label="Gross margin">
            <Select
              value={form.gross_margin_band}
              onChange={(v) => setForm((f) => ({ ...f, gross_margin_band: v }))}
              options={GROSS_MARGIN_OPTIONS}
              placeholder="Gross margin band"
            />
          </FieldRow>
          <FieldRow label="Sales cycle">
            <Select
              value={form.sales_cycle_band}
              onChange={(v) => setForm((f) => ({ ...f, sales_cycle_band: v }))}
              options={SALES_CYCLE_OPTIONS}
              placeholder="Typical sales cycle"
            />
          </FieldRow>
        </div>

        {/* Go-to-market */}
        <div className="space-y-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
            Go-to-market
          </p>
          <FieldRow label="Acquisition channels">
            <TextArea
              value={form.acquisition_channels}
              onChange={(v) => setForm((f) => ({ ...f, acquisition_channels: v || undefined }))}
              placeholder="Outbound, inbound, PLG, partnerships, referrals?"
              rows={2}
              maxLength={1200}
            />
          </FieldRow>
          <FieldRow label="Current GTM">
            <TextArea
              value={form.current_gtm}
              onChange={(v) => setForm((f) => ({ ...f, current_gtm: v || undefined }))}
              placeholder="What's working today? What channels drive growth?"
              rows={2}
              maxLength={1200}
            />
          </FieldRow>
          <FieldRow label="Planned GTM">
            <TextArea
              value={form.planned_gtm}
              onChange={(v) => setForm((f) => ({ ...f, planned_gtm: v || undefined }))}
              placeholder="What will you do differently with funding?"
              rows={2}
              maxLength={1200}
            />
          </FieldRow>
          <FieldRow label="Why channels work">
            <TextArea
              value={form.why_channels_work}
              onChange={(v) => setForm((f) => ({ ...f, why_channels_work: v || undefined }))}
              placeholder="Evidence that your GTM strategy is effective."
              rows={2}
              maxLength={1200}
            />
          </FieldRow>
        </div>

        {/* Competition narrative */}
        <div className="space-y-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
            Competition
          </p>
          <FieldRow label="Why we win">
            <TextArea
              value={form.why_we_win}
              onChange={(v) => setForm((f) => ({ ...f, why_we_win: v || undefined }))}
              placeholder="What makes you win deals over competitors? Be specific."
              rows={2}
              maxLength={1200}
              hint="Per-competitor details go in the Competitive Landscape section above."
            />
          </FieldRow>
          <FieldRow label="Defensibility">
            <TextArea
              value={form.defensibility}
              onChange={(v) => setForm((f) => ({ ...f, defensibility: v || undefined }))}
              placeholder="Why can't a bigger player copy you? Moats, switching costs, network effects."
              rows={2}
              maxLength={1200}
            />
          </FieldRow>
          <FieldRow label="Investor misperceptions">
            <TextArea
              value={form.investor_misunderstanding}
              onChange={(v) => setForm((f) => ({ ...f, investor_misunderstanding: v || undefined }))}
              placeholder="What do investors often get wrong about your space or company?"
              rows={2}
              maxLength={1200}
            />
          </FieldRow>
        </div>

        {/* Team narrative */}
        <div className="space-y-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
            Team
          </p>
          <FieldRow label="Founder background">
            <TextArea
              value={form.founder_background}
              onChange={(v) => setForm((f) => ({ ...f, founder_background: v || undefined }))}
              placeholder="Relevant experience, achievements, domain expertise."
              rows={3}
              maxLength={2000}
              hint="Per-person details go in the Team section above."
            />
          </FieldRow>
          <FieldRow label="Founder-market fit">
            <TextArea
              value={form.founder_market_fit}
              onChange={(v) => setForm((f) => ({ ...f, founder_market_fit: v || undefined }))}
              placeholder="Why are YOU the right person/team to solve this problem?"
              rows={2}
              maxLength={1200}
            />
          </FieldRow>
          <FieldRow label="Technical strengths">
            <TextArea
              value={form.technical_strengths}
              onChange={(v) => setForm((f) => ({ ...f, technical_strengths: v || undefined }))}
              placeholder="Engineering depth, technical credibility, patents, publications."
              rows={2}
              maxLength={1000}
            />
          </FieldRow>
          <FieldRow label="Business strengths">
            <TextArea
              value={form.business_strengths}
              onChange={(v) => setForm((f) => ({ ...f, business_strengths: v || undefined }))}
              placeholder="Sales/marketing chops, fundraising experience, operator background."
              rows={2}
              maxLength={1000}
            />
          </FieldRow>
          <FieldRow label="Advisors">
            <TextArea
              value={form.advisors}
              onChange={(v) => setForm((f) => ({ ...f, advisors: v || undefined }))}
              placeholder="Notable advisors, board members, or investors already involved."
              rows={2}
              maxLength={1200}
            />
          </FieldRow>
          <FieldRow label="Key hires needed">
            <TextArea
              value={form.key_hires_needed}
              onChange={(v) => setForm((f) => ({ ...f, key_hires_needed: v || undefined }))}
              placeholder="What roles will you hire with this raise?"
              rows={2}
              maxLength={1000}
            />
          </FieldRow>
        </div>

        {/* Risks */}
        <div className="space-y-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
            Risks
          </p>
          <p className="text-[11.5px] italic text-[var(--color-text-faint)]">
            Being upfront about risks builds trust with investors.
          </p>
          <FieldRow label="Technical risk">
            <TextArea
              value={form.technical_risk}
              onChange={(v) => setForm((f) => ({ ...f, technical_risk: v || undefined }))}
              placeholder="What technical challenges remain? What might not work?"
              rows={2}
              maxLength={1000}
            />
          </FieldRow>
          <FieldRow label="Market risk">
            <TextArea
              value={form.market_risk}
              onChange={(v) => setForm((f) => ({ ...f, market_risk: v || undefined }))}
              placeholder="What market assumptions could be wrong? Timing, demand, competition?"
              rows={2}
              maxLength={1000}
            />
          </FieldRow>
          <FieldRow label="Execution risk">
            <TextArea
              value={form.execution_risk}
              onChange={(v) => setForm((f) => ({ ...f, execution_risk: v || undefined }))}
              placeholder="What operational challenges do you face? Hiring, scaling, partnerships?"
              rows={2}
              maxLength={1000}
            />
          </FieldRow>
          <FieldRow label="Biggest unknown">
            <TextArea
              value={form.biggest_unknown}
              onChange={(v) => setForm((f) => ({ ...f, biggest_unknown: v || undefined }))}
              placeholder="What's the one thing you wish you knew but don't?"
              rows={2}
              maxLength={800}
            />
          </FieldRow>
          <FieldRow label="Failure scenario">
            <TextArea
              value={form.failure_scenario}
              onChange={(v) => setForm((f) => ({ ...f, failure_scenario: v || undefined }))}
              placeholder="How could this company fail? What would cause it?"
              rows={2}
              maxLength={1000}
            />
          </FieldRow>
        </div>
      </div>
      <SaveBar saving={saving} result={result} onSave={save} />
    </SectionShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Root export
// ──────────────────────────────────────────────────────────────────────────

export function FounderDepthEditor({ depth }: { depth: StartupDepthView }) {
  return (
    <div className="space-y-3">
      <h2 className="mt-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
        Profile depth
      </h2>
      <p className="text-[13px] text-[var(--color-text-muted)]">
        These sections are optional but significantly improve match quality and
        what verified investors see before expressing interest.
      </p>
      <TeamSection initial={depth.team} />
      <RoundSection initial={depth.round} />
      <TractionSection initial={depth.traction} />
      <MarketSection initial={depth.market} />
      <CompetitorsSection initial={depth.competitors} />
      <CapTableSection initial={depth.capTable} />
      <NarrativeSection initial={depth.narrative} />
    </div>
  );
}
