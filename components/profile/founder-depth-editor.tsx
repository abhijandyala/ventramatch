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
} from "@/app/build/depth-actions";
import type {
  StartupTeamMemberInput,
  StartupRoundDetailsInput,
  StartupCapTableSummaryInput,
  StartupUseOfFundsInput,
  StartupTractionSignalInput,
  StartupMarketAnalysisInput,
  StartupCompetitorInput,
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
    </div>
  );
}
