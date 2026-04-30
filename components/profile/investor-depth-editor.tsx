"use client";

/**
 * Investor profile depth editor.
 *
 * Collapsible sections appended after the main builder wizard on /build/investor.
 * Same pattern as FounderDepthEditor: each section saves independently.
 */

import { useState, useTransition } from "react";
import { SaveIndicator, type SaveStatus } from "@/components/profile/save-indicator";
import {
  saveInvestorTeamAction,
  saveInvestorCheckBandsAction,
  saveInvestorPortfolioAction,
  saveInvestorTrackRecordAction,
  saveInvestorDecisionProcessAction,
  saveInvestorValueAddAction,
  saveInvestorAntiPatternsAction,
} from "@/app/build/investor/depth-actions";
import type {
  InvestorTeamMemberInput,
  InvestorCheckBandInput,
  InvestorPortfolioEntryInput,
  InvestorTrackRecordInput,
  InvestorDecisionProcessInput,
  InvestorValueAddEntryInput,
  InvestorAntiPatternEntryInput,
} from "@/lib/validation/depth";
import type { InvestorDepthView } from "@/lib/profile/visibility";

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
          <p className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">{hint}</p>
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
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[180px_1fr]">
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
  type?: "text" | "number" | "url";
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

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[var(--color-text)]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Team section
// ──────────────────────────────────────────────────────────────────────────

function InvestorTeamSection({ initial }: { initial: InvestorDepthView["team"] }) {
  const [members, setMembers] = useState<InvestorTeamMemberInput[]>(
    initial.length > 0
      ? initial.map((m) => ({
          name: m.name,
          role: m.role,
          is_decision_maker: m.is_decision_maker,
          bio: m.bio ?? undefined,
          linkedin_url: m.linkedin_url ?? undefined,
          display_order: m.display_order,
        }))
      : [],
  );
  const [saving, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function add() {
    setMembers((prev) => [
      ...prev,
      { name: "", role: "", is_decision_maker: false, display_order: prev.length },
    ]);
  }

  function update(i: number, patch: Partial<InvestorTeamMemberInput>) {
    setMembers((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }

  function save() {
    start(async () => {
      const r = await saveInvestorTeamAction(members);
      setResult(r.ok ? { ok: true, message: "Saved." } : { ok: false, message: r.error });
    });
  }

  return (
    <SectionShell
      title="Team"
      hint="GPs, partners, associates — founders want to know who they'd pitch."
    >
      <div className="space-y-4">
        {members.map((m, i) => (
          <div key={i} className="space-y-3 border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">Member {i + 1}</p>
              <button type="button" onClick={() => setMembers((prev) => prev.filter((_, idx) => idx !== i))} className="text-[12px] text-[var(--color-text-faint)] hover:text-red-600">Remove</button>
            </div>
            <FieldRow label="Name"><Input value={m.name} onChange={(v) => update(i, { name: v })} placeholder="Alex Park" /></FieldRow>
            <FieldRow label="Role / title"><Input value={m.role} onChange={(v) => update(i, { role: v })} placeholder="General Partner" /></FieldRow>
            <Checkbox checked={m.is_decision_maker ?? false} onChange={(v) => update(i, { is_decision_maker: v })} label="Decision maker (who founders pitch)" />
            <FieldRow label="LinkedIn"><Input type="url" value={m.linkedin_url} onChange={(v) => update(i, { linkedin_url: v || undefined })} placeholder="https://linkedin.com/in/..." /></FieldRow>
            <FieldRow label="Bio">
              <textarea
                value={m.bio ?? ""}
                onChange={(e) => update(i, { bio: e.target.value || undefined })}
                placeholder="1–2 sentence bio."
                rows={2}
                maxLength={600}
                className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
              />
            </FieldRow>
          </div>
        ))}
        <button type="button" onClick={add} className="h-9 border border-dashed border-[var(--color-border)] px-4 text-[12.5px] text-[var(--color-text-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand-strong)]">
          + Add member
        </button>
      </div>
      <SaveBar saving={saving} result={result} onSave={save} />
    </SectionShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Check bands section
// ──────────────────────────────────────────────────────────────────────────

const STAGE_OPTIONS = [
  { value: "idea" as const, label: "Idea" },
  { value: "pre_seed" as const, label: "Pre-seed" },
  { value: "seed" as const, label: "Seed" },
  { value: "series_a" as const, label: "Series A" },
  { value: "series_b_plus" as const, label: "Series B+" },
];

const CHECK_ROLE_OPTIONS = [
  { value: "lead" as const, label: "Lead" },
  { value: "follow" as const, label: "Follow" },
];

const OWNERSHIP_OPTIONS = [
  { value: "under_5pct" as const, label: "Under 5%" },
  { value: "5_10" as const, label: "5–10%" },
  { value: "10_20" as const, label: "10–20%" },
  { value: "over_20" as const, label: "20%+" },
];

function CheckBandsSection({ initial }: { initial: InvestorDepthView["checkBands"] }) {
  const [bands, setBands] = useState<InvestorCheckBandInput[]>(
    initial.length > 0
      ? initial.map((b) => ({
          stage: b.stage,
          role: b.role,
          check_min_usd: b.check_min_usd,
          check_max_usd: b.check_max_usd,
          ownership_target_band: (b.ownership_target_band as InvestorCheckBandInput["ownership_target_band"]) ?? undefined,
        }))
      : [],
  );
  const [saving, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function add() {
    setBands((prev) => [
      ...prev,
      { stage: "seed", role: "lead", check_min_usd: 0, check_max_usd: 0 },
    ]);
  }

  function update(i: number, patch: Partial<InvestorCheckBandInput>) {
    setBands((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  function save() {
    start(async () => {
      const r = await saveInvestorCheckBandsAction(bands);
      setResult(r.ok ? { ok: true, message: "Saved." } : { ok: false, message: r.error });
    });
  }

  return (
    <SectionShell
      title="Check sizes per stage"
      hint="Lead vs follow, per stage — one row per combination. Powers the matching engine."
    >
      <p className="mb-4 text-[11.5px] italic text-[var(--color-text-faint)]">
        Values are in USD. These replace the legacy single check range in the matching score.
      </p>
      <div className="space-y-4">
        {bands.map((b, i) => (
          <div key={i} className="space-y-3 border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">Band {i + 1}</p>
              <button type="button" onClick={() => setBands((prev) => prev.filter((_, idx) => idx !== i))} className="text-[12px] text-[var(--color-text-faint)] hover:text-red-600">Remove</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Stage"><Select value={b.stage} onChange={(v) => update(i, { stage: v ?? "seed" })} options={STAGE_OPTIONS} /></FieldRow>
              <FieldRow label="Role"><Select value={b.role} onChange={(v) => update(i, { role: v ?? "lead" })} options={CHECK_ROLE_OPTIONS} /></FieldRow>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Min ($)"><Input type="number" value={b.check_min_usd} onChange={(v) => update(i, { check_min_usd: Number(v) || 0 })} placeholder="100000" /></FieldRow>
              <FieldRow label="Max ($)"><Input type="number" value={b.check_max_usd} onChange={(v) => update(i, { check_max_usd: Number(v) || 0 })} placeholder="500000" /></FieldRow>
            </div>
            <FieldRow label="Target ownership"><Select value={b.ownership_target_band} onChange={(v) => update(i, { ownership_target_band: v })} options={OWNERSHIP_OPTIONS} /></FieldRow>
          </div>
        ))}
        <button type="button" onClick={add} className="h-9 border border-dashed border-[var(--color-border)] px-4 text-[12.5px] text-[var(--color-text-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand-strong)]">
          + Add band
        </button>
      </div>
      <SaveBar saving={saving} result={result} onSave={save} />
    </SectionShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Portfolio section
// ──────────────────────────────────────────────────────────────────────────

const INVESTOR_ROLE_OPTIONS = [
  { value: "lead" as const, label: "Led" },
  { value: "co_lead" as const, label: "Co-led" },
  { value: "follow" as const, label: "Followed" },
  { value: "participant" as const, label: "Participated" },
];

const EXIT_KIND_OPTIONS = [
  { value: "acquired" as const, label: "Acquired" },
  { value: "ipo" as const, label: "IPO" },
  { value: "shutdown" as const, label: "Shutdown" },
  { value: "n_a" as const, label: "N/A" },
];

function PortfolioSection({ initial }: { initial: InvestorDepthView["portfolio"] }) {
  const [entries, setEntries] = useState<InvestorPortfolioEntryInput[]>(
    initial.length > 0
      ? initial.map((e) => ({
          company_name: e.company_name,
          year: e.year ?? undefined,
          role: e.role,
          is_public_listing: true,
          sector: e.sector ?? undefined,
          is_exited: e.is_exited,
          exit_kind: (e.exit_kind as InvestorPortfolioEntryInput["exit_kind"]) ?? undefined,
          notes: e.notes ?? undefined,
          display_order: e.display_order,
        }))
      : [],
  );
  const [saving, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function add() {
    setEntries((prev) => [
      ...prev,
      { company_name: "", role: "lead", is_public_listing: true, is_exited: false, display_order: prev.length },
    ]);
  }

  function update(i: number, patch: Partial<InvestorPortfolioEntryInput>) {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  function save() {
    start(async () => {
      const r = await saveInvestorPortfolioAction(entries);
      setResult(r.ok ? { ok: true, message: "Saved." } : { ok: false, message: r.error });
    });
  }

  return (
    <SectionShell
      title="Portfolio"
      hint="Mark private rows — they weight matching but don't show to founders."
    >
      <div className="space-y-4">
        {entries.map((e, i) => (
          <div key={i} className="space-y-3 border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">Entry {i + 1}</p>
              <button type="button" onClick={() => setEntries((prev) => prev.filter((_, idx) => idx !== i))} className="text-[12px] text-[var(--color-text-faint)] hover:text-red-600">Remove</button>
            </div>
            <FieldRow label="Company"><Input value={e.company_name} onChange={(v) => update(i, { company_name: v })} placeholder="Acme Inc." /></FieldRow>
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Year"><Input type="number" value={e.year} onChange={(v) => update(i, { year: v ? Number(v) : undefined })} placeholder="2022" /></FieldRow>
              <FieldRow label="Role"><Select value={e.role} onChange={(v) => update(i, { role: v ?? "lead" })} options={INVESTOR_ROLE_OPTIONS} /></FieldRow>
            </div>
            <FieldRow label="Sector"><Input value={e.sector} onChange={(v) => update(i, { sector: v || undefined })} placeholder="Fintech" /></FieldRow>
            <div className="flex flex-wrap gap-4">
              <Checkbox checked={e.is_public_listing ?? true} onChange={(v) => update(i, { is_public_listing: v })} label="Public listing" />
              <Checkbox checked={e.is_exited ?? false} onChange={(v) => update(i, { is_exited: v })} label="Exited" />
            </div>
            {e.is_exited ? (
              <FieldRow label="Exit kind"><Select value={e.exit_kind} onChange={(v) => update(i, { exit_kind: v })} options={EXIT_KIND_OPTIONS} /></FieldRow>
            ) : null}
            <FieldRow label="Notes"><Input value={e.notes} onChange={(v) => update(i, { notes: v || undefined })} placeholder="Led $3M seed; on board." /></FieldRow>
          </div>
        ))}
        <button type="button" onClick={add} className="h-9 border border-dashed border-[var(--color-border)] px-4 text-[12.5px] text-[var(--color-text-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand-strong)]">
          + Add entry
        </button>
      </div>
      <SaveBar saving={saving} result={result} onSave={save} />
    </SectionShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Track record section
// ──────────────────────────────────────────────────────────────────────────

const DEAL_COUNT_OPTIONS = [
  { value: "under_10" as const, label: "Under 10" },
  { value: "10_25" as const, label: "10–25" },
  { value: "25_50" as const, label: "25–50" },
  { value: "50_100" as const, label: "50–100" },
  { value: "over_100" as const, label: "100+" },
];

const FOLLOW_ON_OPTIONS = [
  { value: "under_25" as const, label: "Under 25%" },
  { value: "25_50" as const, label: "25–50%" },
  { value: "50_75" as const, label: "50–75%" },
  { value: "over_75" as const, label: "75%+" },
];

const OWNERSHIP_OPTIONS2 = [
  { value: "under_5pct" as const, label: "Under 5%" },
  { value: "5_10" as const, label: "5–10%" },
  { value: "10_20" as const, label: "10–20%" },
  { value: "over_20" as const, label: "20%+" },
];

const FUND_SIZE_OPTIONS = [
  { value: "under_25m" as const, label: "Under $25M" },
  { value: "25_100m" as const, label: "$25–100M" },
  { value: "100_500m" as const, label: "$100–500M" },
  { value: "500m_1b" as const, label: "$500M–$1B" },
  { value: "over_1b" as const, label: "$1B+" },
];

const DRY_POWDER_OPTIONS = [
  { value: "depleted" as const, label: "Depleted" },
  { value: "under_25m" as const, label: "Under $25M" },
  { value: "25_100m" as const, label: "$25–100M" },
  { value: "100_500m" as const, label: "$100–500M" },
  { value: "over_500m" as const, label: "$500M+" },
];

function TrackRecordSection({ initial }: { initial: InvestorDepthView["trackRecord"] }) {
  const [form, setForm] = useState<InvestorTrackRecordInput>({
    total_deals_band: (initial?.total_deals_band as InvestorTrackRecordInput["total_deals_band"]) ?? undefined,
    first_money_in_count_band: (initial?.first_money_in_count_band as InvestorTrackRecordInput["first_money_in_count_band"]) ?? undefined,
    follow_on_rate_band: (initial?.follow_on_rate_band as InvestorTrackRecordInput["follow_on_rate_band"]) ?? undefined,
    avg_ownership_band: (initial?.avg_ownership_band as InvestorTrackRecordInput["avg_ownership_band"]) ?? undefined,
    fund_size_band: (initial?.fund_size_band as InvestorTrackRecordInput["fund_size_band"]) ?? undefined,
    fund_vintage_year: initial?.fund_vintage_year ?? undefined,
    dry_powder_band: (initial?.dry_powder_band as InvestorTrackRecordInput["dry_powder_band"]) ?? undefined,
  });
  const [saving, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function save() {
    start(async () => {
      const r = await saveInvestorTrackRecordAction(form);
      setResult(r.ok ? { ok: true, message: "Saved." } : { ok: false, message: r.error });
    });
  }

  return (
    <SectionShell title="Track record" hint="All bands — disclosed at match tier. Dry powder visible post-match only.">
      <div className="space-y-3">
        <FieldRow label="Total deals"><Select value={form.total_deals_band} onChange={(v) => setForm((f) => ({ ...f, total_deals_band: v }))} options={DEAL_COUNT_OPTIONS} /></FieldRow>
        <FieldRow label="First-money-in"><Select value={form.first_money_in_count_band} onChange={(v) => setForm((f) => ({ ...f, first_money_in_count_band: v }))} options={DEAL_COUNT_OPTIONS} /></FieldRow>
        <FieldRow label="Follow-on rate"><Select value={form.follow_on_rate_band} onChange={(v) => setForm((f) => ({ ...f, follow_on_rate_band: v }))} options={FOLLOW_ON_OPTIONS} /></FieldRow>
        <FieldRow label="Avg ownership"><Select value={form.avg_ownership_band} onChange={(v) => setForm((f) => ({ ...f, avg_ownership_band: v }))} options={OWNERSHIP_OPTIONS2} /></FieldRow>
        <FieldRow label="Fund size"><Select value={form.fund_size_band} onChange={(v) => setForm((f) => ({ ...f, fund_size_band: v }))} options={FUND_SIZE_OPTIONS} /></FieldRow>
        <FieldRow label="Fund vintage"><Input type="number" value={form.fund_vintage_year} onChange={(v) => setForm((f) => ({ ...f, fund_vintage_year: v ? Number(v) : undefined }))} placeholder="2021" /></FieldRow>
        <FieldRow label="Dry powder">
          <div>
            <Select value={form.dry_powder_band} onChange={(v) => setForm((f) => ({ ...f, dry_powder_band: v }))} options={DRY_POWDER_OPTIONS} />
            <p className="mt-1 text-[11px] italic text-[var(--color-text-faint)]">Visible to founders only after mutual match.</p>
          </div>
        </FieldRow>
      </div>
      <SaveBar saving={saving} result={result} onSave={save} />
    </SectionShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Decision process section
// ──────────────────────────────────────────────────────────────────────────

const TIME_TO_TS_OPTIONS = [
  { value: "one_week" as const, label: "Within a week" },
  { value: "two_weeks" as const, label: "Within 2 weeks" },
  { value: "one_month" as const, label: "Within a month" },
  { value: "two_months" as const, label: "Within 2 months" },
  { value: "quarter_plus" as const, label: "A quarter or more" },
];

function DecisionProcessSection({ initial }: { initial: InvestorDepthView["decisionProcess"] }) {
  const [form, setForm] = useState<InvestorDecisionProcessInput>({
    time_to_term_sheet_band: (initial?.time_to_term_sheet_band as InvestorDecisionProcessInput["time_to_term_sheet_band"]) ?? undefined,
    ic_required: initial?.ic_required ?? true,
    references_required: initial?.references_required ?? false,
    data_room_required: initial?.data_room_required ?? false,
    partner_meeting_required: initial?.partner_meeting_required ?? true,
    process_narrative: initial?.process_narrative ?? undefined,
  });
  const [saving, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function save() {
    start(async () => {
      const r = await saveInvestorDecisionProcessAction(form);
      setResult(r.ok ? { ok: true, message: "Saved." } : { ok: false, message: r.error });
    });
  }

  return (
    <SectionShell title="Decision process" hint="How you decide — founders care about timeline and requirements.">
      <div className="space-y-3">
        <FieldRow label="Time to term sheet"><Select value={form.time_to_term_sheet_band} onChange={(v) => setForm((f) => ({ ...f, time_to_term_sheet_band: v }))} options={TIME_TO_TS_OPTIONS} /></FieldRow>
        <div className="flex flex-wrap gap-4">
          <Checkbox checked={form.ic_required ?? true} onChange={(v) => setForm((f) => ({ ...f, ic_required: v }))} label="IC required" />
          <Checkbox checked={form.partner_meeting_required ?? true} onChange={(v) => setForm((f) => ({ ...f, partner_meeting_required: v }))} label="Partner meeting required" />
          <Checkbox checked={form.references_required ?? false} onChange={(v) => setForm((f) => ({ ...f, references_required: v }))} label="References required" />
          <Checkbox checked={form.data_room_required ?? false} onChange={(v) => setForm((f) => ({ ...f, data_room_required: v }))} label="Data room required" />
        </div>
        <FieldRow label="Narrative">
          <textarea
            value={form.process_narrative ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, process_narrative: e.target.value || undefined }))}
            placeholder="We move fast on thesis fits; IC for net-new sectors."
            rows={2}
            maxLength={400}
            className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
          />
        </FieldRow>
      </div>
      <SaveBar saving={saving} result={result} onSave={save} />
    </SectionShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Value add section
// ──────────────────────────────────────────────────────────────────────────

const VALUE_ADD_OPTIONS = [
  { value: "recruiting" as const, label: "Recruiting" },
  { value: "gtm_intros" as const, label: "GTM intros" },
  { value: "sales_intros" as const, label: "Sales intros" },
  { value: "customer_intros" as const, label: "Customer intros" },
  { value: "board_governance" as const, label: "Board / governance" },
  { value: "regulatory" as const, label: "Regulatory" },
  { value: "technical_dd" as const, label: "Technical DD" },
  { value: "fundraising_strategy" as const, label: "Fundraising strategy" },
  { value: "international_expansion" as const, label: "International expansion" },
];

function ValueAddSection({ initial }: { initial: InvestorDepthView["valueAdd"] }) {
  const [entries, setEntries] = useState<InvestorValueAddEntryInput[]>(
    initial.length > 0
      ? initial.map((v) => ({ kind: v.kind, narrative: v.narrative ?? undefined, display_order: v.display_order }))
      : [],
  );
  const [saving, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function add() {
    setEntries((prev) => [...prev, { kind: "recruiting", display_order: prev.length }]);
  }

  function update(i: number, patch: Partial<InvestorValueAddEntryInput>) {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  function save() {
    start(async () => {
      const r = await saveInvestorValueAddAction(entries);
      setResult(r.ok ? { ok: true, message: "Saved." } : { ok: false, message: r.error });
    });
  }

  return (
    <SectionShell title="Value add" hint="Beyond-the-check support you actually provide.">
      <div className="space-y-4">
        {entries.map((e, i) => (
          <div key={i} className="space-y-3 border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">Entry {i + 1}</p>
              <button type="button" onClick={() => setEntries((prev) => prev.filter((_, idx) => idx !== i))} className="text-[12px] text-[var(--color-text-faint)] hover:text-red-600">Remove</button>
            </div>
            <FieldRow label="Type"><Select value={e.kind} onChange={(v) => update(i, { kind: v ?? "recruiting" })} options={VALUE_ADD_OPTIONS} /></FieldRow>
            <FieldRow label="Narrative">
              <Input value={e.narrative} onChange={(v) => update(i, { narrative: v || undefined })} placeholder="Placed 3 VPEs in 2025." />
            </FieldRow>
          </div>
        ))}
        <button type="button" onClick={add} className="h-9 border border-dashed border-[var(--color-border)] px-4 text-[12.5px] text-[var(--color-text-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand-strong)]">
          + Add
        </button>
      </div>
      <SaveBar saving={saving} result={result} onSave={save} />
    </SectionShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Anti-patterns section
// ──────────────────────────────────────────────────────────────────────────

const ANTI_PATTERN_OPTIONS = [
  { value: "sector" as const, label: "Sector" },
  { value: "stage" as const, label: "Stage" },
  { value: "geography" as const, label: "Geography" },
  { value: "founder_profile" as const, label: "Founder profile" },
  { value: "check_size" as const, label: "Check size" },
  { value: "other" as const, label: "Other" },
];

function AntiPatternsSection({ initial }: { initial: InvestorDepthView["antiPatterns"] }) {
  const [entries, setEntries] = useState<InvestorAntiPatternEntryInput[]>(
    initial.length > 0
      ? initial.map((p) => ({ kind: p.kind, narrative: p.narrative, display_order: p.display_order }))
      : [],
  );
  const [saving, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function add() {
    setEntries((prev) => [...prev, { kind: "other", narrative: "", display_order: prev.length }]);
  }

  function update(i: number, patch: Partial<InvestorAntiPatternEntryInput>) {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  function save() {
    start(async () => {
      const r = await saveInvestorAntiPatternsAction(entries);
      setResult(r.ok ? { ok: true, message: "Saved." } : { ok: false, message: r.error });
    });
  }

  return (
    <SectionShell title="Won't invest if…" hint="Explicit anti-patterns save both sides from wasted intros.">
      <div className="space-y-4">
        {entries.map((e, i) => (
          <div key={i} className="space-y-3 border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">Entry {i + 1}</p>
              <button type="button" onClick={() => setEntries((prev) => prev.filter((_, idx) => idx !== i))} className="text-[12px] text-[var(--color-text-faint)] hover:text-red-600">Remove</button>
            </div>
            <FieldRow label="Category"><Select value={e.kind} onChange={(v) => update(i, { kind: v ?? "other" })} options={ANTI_PATTERN_OPTIONS} /></FieldRow>
            <FieldRow label="Narrative">
              <textarea
                value={e.narrative}
                onChange={(el) => update(i, { narrative: el.target.value })}
                placeholder="We don't back solo technical founders without a commercial co-founder."
                rows={2}
                maxLength={300}
                className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
              />
            </FieldRow>
          </div>
        ))}
        <button type="button" onClick={add} className="h-9 border border-dashed border-[var(--color-border)] px-4 text-[12.5px] text-[var(--color-text-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand-strong)]">
          + Add
        </button>
      </div>
      <SaveBar saving={saving} result={result} onSave={save} />
    </SectionShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Root export
// ──────────────────────────────────────────────────────────────────────────

export function InvestorDepthEditor({ depth }: { depth: InvestorDepthView }) {
  return (
    <div className="space-y-3">
      <h2 className="mt-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
        Profile depth
      </h2>
      <p className="text-[13px] text-[var(--color-text-muted)]">
        These sections strengthen your profile for founders doing due diligence.
        Per-stage check bands directly power the matching score.
      </p>
      <InvestorTeamSection initial={depth.team} />
      <CheckBandsSection initial={depth.checkBands} />
      <PortfolioSection initial={depth.portfolio} />
      <TrackRecordSection initial={depth.trackRecord} />
      <DecisionProcessSection initial={depth.decisionProcess} />
      <ValueAddSection initial={depth.valueAdd} />
      <AntiPatternsSection initial={depth.antiPatterns} />
    </div>
  );
}
