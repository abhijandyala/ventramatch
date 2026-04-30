"use client";

import {
  useCallback,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { Wordmark } from "@/components/landing/wordmark";
import { InvestorDepthEditor } from "@/components/profile/investor-depth-editor";
import { VerificationPanel, type OwnVerification, type OwnReference } from "@/components/profile/verification-panel";
import type { StartupStage, AccountLabel } from "@/types/database";
import type { InvestorDepthView } from "@/lib/profile/visibility";
import type {
  SubmitInvestorInput,
  DraftInvestorInput,
} from "@/lib/validation/applications";
import { INVESTOR_SECTORS } from "@/lib/profile/sectors";
import {
  saveInvestorDraftAction,
  submitInvestorApplicationAction,
} from "./actions";

function isReadOnly(label: AccountLabel): boolean {
  return label === "in_review";
}

// ──────────────────────────────────────────────────────────────────────────
//  UI draft (richer than canonical schema; collapses at submit)
// ──────────────────────────────────────────────────────────────────────────

type InvestorType = "angel" | "syndicate" | "early" | "growth" | "family" | "cvc";
type RemoteOk = "yes" | "b2b_only" | "no";
type Position = "lead" | "follow" | "either";

export type InvestorUiDraft = {
  identity: {
    fullName: string;
    role: string;
    firmName: string;
    workEmail: string;
    website: string;
    linkedinUrl: string;
    city: string;
    foundedYear: number | null;
  };
  type: InvestorType | null;
  sectors: { sectors: string[]; thesis: string; antiThesis: string };
  stages: StartupStage[];
  check: {
    minCheck: number | null;
    sweetSpot: number | null;
    maxCheck: number | null;
    position: Position | null;
    annualCapacity: number | null;
    maxValuation: number | null;
  };
  geo: { regions: string[]; remoteOk: RemoteOk | null; officeHours: string };
  track: {
    totalChecks: number | null;
    yearsInvesting: number | null;
    checksLast12mo: number | null;
    recent: { company: string; round: string; year: number | null; checkSize: string }[];
  };
};

export const EMPTY_INVESTOR_DRAFT: InvestorUiDraft = {
  identity: { fullName: "", role: "", firmName: "", workEmail: "", website: "", linkedinUrl: "", city: "", foundedYear: null },
  type: null,
  sectors: { sectors: [], thesis: "", antiThesis: "" },
  stages: [],
  check: { minCheck: null, sweetSpot: null, maxCheck: null, position: null, annualCapacity: null, maxValuation: null },
  geo: { regions: [], remoteOk: null, officeHours: "" },
  track: { totalChecks: null, yearsInvesting: null, checksLast12mo: null, recent: [] },
};

// ──────────────────────────────────────────────────────────────────────────
//  Mapping rich UI → canonical schema
// ──────────────────────────────────────────────────────────────────────────

function buildThesis(d: InvestorUiDraft): string | undefined {
  const parts: string[] = [];
  if (d.sectors.thesis.trim()) parts.push(d.sectors.thesis.trim());
  if (d.sectors.antiThesis.trim()) parts.push(`Anti-thesis: ${d.sectors.antiThesis.trim()}`);
  if (d.geo.officeHours.trim()) parts.push(`Office hours: ${d.geo.officeHours.trim()}`);
  const result = parts.join(" · ");
  return result || undefined;
}

function toSubmitInput(d: InvestorUiDraft): SubmitInvestorInput {
  return {
    name: [d.identity.fullName.trim(), d.identity.role.trim()].filter(Boolean).join(" — ") || d.identity.fullName.trim(),
    firm: d.identity.firmName.trim() || undefined,
    checkMin: d.check.minCheck ?? 0,
    checkMax: d.check.maxCheck ?? 0,
    stages: d.stages,
    sectors: d.sectors.sectors,
    geographies: d.geo.regions,
    isActive: true,
    thesis: buildThesis(d),
  };
}

function toDraftInput(d: InvestorUiDraft): DraftInvestorInput {
  const draft: DraftInvestorInput = {};
  if (d.identity.fullName.trim()) draft.name = d.identity.fullName.trim();
  if (d.identity.firmName.trim()) draft.firm = d.identity.firmName.trim();
  if (d.check.minCheck != null) draft.checkMin = d.check.minCheck;
  if (d.check.maxCheck != null) draft.checkMax = d.check.maxCheck;
  if (d.stages.length) draft.stages = d.stages;
  if (d.sectors.sectors.length) draft.sectors = d.sectors.sectors;
  if (d.geo.regions.length) draft.geographies = d.geo.regions;
  const t = buildThesis(d);
  if (t) draft.thesis = t;
  return draft;
}

// ──────────────────────────────────────────────────────────────────────────
//  Constants
// ──────────────────────────────────────────────────────────────────────────

const STEPS = [
  { key: "identity", title: "Identity" },
  { key: "type",     title: "Type" },
  { key: "sectors",  title: "Sectors" },
  { key: "stages",   title: "Stages" },
  { key: "check",    title: "Check" },
  { key: "geo",      title: "Geography" },
  { key: "track",    title: "Track record" },
  { key: "review",   title: "Review" },
] as const;

const STEP_HEADERS = [
  { title: "Tell us who's behind the check.", sub: "Founders see your name, role, and firm before anything else." },
  { title: "What kind of investor are you?", sub: "Sets the tone of matches and routes you to the right verification track." },
  { title: "What do you invest in?", sub: "Pick every sector you actively write checks into." },
  { title: "What stages do you back?", sub: "We only show you founders raising at one of your stages." },
  { title: "What's your check size?", sub: "Founders are pre-filtered against this band before they ever see you." },
  { title: "Where do you invest?", sub: "Geography is a soft signal — out-of-market still scores, just lower." },
  { title: "Show your track record.", sub: "Recent checks build trust faster than a tagline. Founders see this." },
  { title: "Looking good. Review and publish.", sub: "Final pass before founders can match with you." },
];

const TYPES: { key: InvestorType; label: string; note: string }[] = [
  { key: "angel",     label: "Solo angel",       note: "Personal capital, single-decision" },
  { key: "syndicate", label: "Syndicate lead",   note: "AngelList / Sweater style" },
  { key: "early",     label: "Early-stage VC",   note: "Pre-seed through Series A" },
  { key: "growth",    label: "Growth VC",        note: "Series B+ and later" },
  { key: "family",    label: "Family office",    note: "Multi-asset, longer horizon" },
  { key: "cvc",       label: "Corporate VC",     note: "Strategic + financial returns" },
];

// Founders and investors share one sector taxonomy so matching equality
// holds. See lib/profile/sectors.ts.
const SECTOR_OPTIONS = INVESTOR_SECTORS;

const STAGES_WITH_NOTES: { key: StartupStage; label: string; note: string }[] = [
  { key: "idea",          label: "Idea",      note: "Just an idea" },
  { key: "pre_seed",      label: "Pre-seed",  note: "$0 – $2M" },
  { key: "seed",          label: "Seed",      note: "$2M – $5M" },
  { key: "series_a",      label: "Series A",  note: "$5M – $20M" },
  { key: "series_b_plus", label: "Series B+", note: "$20M+" },
];

const STAGE_LABEL: Record<StartupStage, string> = {
  idea: "Idea",
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  series_b_plus: "Series B+",
};

const REGION_OPTIONS = [
  "USA — West", "USA — East", "USA — Other", "Canada", "UK", "Europe",
  "LATAM", "MENA", "Asia", "Australia", "Africa",
] as const;

const POSITIONS = [
  { key: "lead" as const,   label: "Lead only" },
  { key: "follow" as const, label: "Follow only" },
  { key: "either" as const, label: "Either lead or follow" },
];

const REMOTE_OPTIONS = [
  { key: "yes" as const,      label: "Yes" },
  { key: "b2b_only" as const, label: "Only for B2B" },
  { key: "no" as const,       label: "No" },
];

// ──────────────────────────────────────────────────────────────────────────
//  Top-level
// ──────────────────────────────────────────────────────────────────────────

export function InvestorBuilder({
  initial,
  accountLabel,
  depthView,
  ownVerifications = [],
  ownReferences = [],
}: {
  initial: InvestorUiDraft;
  accountLabel: AccountLabel;
  depthView?: InvestorDepthView | null;
  ownVerifications?: OwnVerification[];
  ownReferences?: OwnReference[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<InvestorUiDraft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isPublishing, startPublishing] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const total = STEPS.length;
  const t = STEP_HEADERS[step];
  const isReview = step === total - 1;
  const readOnly = isReadOnly(accountLabel);

  const save = useCallback(
    (next?: InvestorUiDraft) =>
      new Promise<boolean>((resolve) => {
        startSaving(async () => {
          const result = await saveInvestorDraftAction(toDraftInput(next ?? draft));
          if (!result.ok) {
            setFormError(result.error);
            resolve(false);
            return;
          }
          setFormError(null);
          setSavedAt(new Date().toLocaleTimeString());
          resolve(true);
        });
      }),
    [draft],
  );

  function patchIdentity(p: Partial<InvestorUiDraft["identity"]>) {
    setDraft((d) => ({ ...d, identity: { ...d.identity, ...p } }));
  }
  function patchSectors(p: Partial<InvestorUiDraft["sectors"]>) {
    setDraft((d) => ({ ...d, sectors: { ...d.sectors, ...p } }));
  }
  function patchCheck(p: Partial<InvestorUiDraft["check"]>) {
    setDraft((d) => ({ ...d, check: { ...d.check, ...p } }));
  }
  function patchGeo(p: Partial<InvestorUiDraft["geo"]>) {
    setDraft((d) => ({ ...d, geo: { ...d.geo, ...p } }));
  }
  function patchTrack(p: Partial<InvestorUiDraft["track"]>) {
    setDraft((d) => ({ ...d, track: { ...d.track, ...p } }));
  }

  async function handleContinue() {
    const ok = await save();
    if (ok) setStep((s) => Math.min(total - 1, s + 1));
  }

  function handlePublish() {
    setErrors({});
    setFormError(null);
    startPublishing(async () => {
      const result = await submitInvestorApplicationAction(toSubmitInput(draft));
      if (!result.ok) {
        setFormError(result.error);
        if (result.field) setErrors({ [result.field]: result.error });
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <main className="min-h-screen bg-[color:var(--color-surface)] text-[color:var(--color-text)]">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]/90 px-5 backdrop-blur md:px-8">
        <div className="flex items-center gap-4">
          <Wordmark size="sm" />
          <span aria-hidden className="hidden h-4 w-px bg-[color:var(--color-border)] sm:block" />
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] sm:inline">
            Build profile · Investor
          </span>
        </div>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => save()}
            disabled={isSaving || readOnly}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-[color:var(--color-text-faint)] transition-colors hover:text-[color:var(--color-text-strong)] disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {readOnly ? "Read-only" : isSaving ? "Saving…" : savedAt ? `Saved ${savedAt}` : "Save draft"}
          </button>
          <Link
            href="/dashboard"
            className="text-[12.5px] text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-strong)]"
          >
            Save &amp; exit
          </Link>
        </div>
      </header>

      <div className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
        <div className="mx-auto max-w-[960px] px-5 py-7 md:px-8 md:py-8">
          <Stepper step={step} setStep={setStep} />
        </div>
      </div>

      <BuilderBanner accountLabel={accountLabel} />

      <section className="mx-auto w-full max-w-[760px] px-5 py-12 md:px-8 md:py-16">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
          Step {String(step + 1).padStart(2, "0")} of {String(total).padStart(2, "0")}
          <span aria-hidden className="mx-2 text-[color:var(--color-border-strong)]">·</span>
          {STEPS[step].title}
        </p>
        <h1
          className="mt-3 text-balance font-semibold tracking-[-0.014em] text-[color:var(--color-text-strong)]"
          style={{ fontSize: "clamp(26px, 3vw, 34px)", lineHeight: 1.12 }}
        >
          {t.title}
        </h1>
        <p className="mt-3 max-w-[58ch] text-[14.5px] leading-[1.6] text-[color:var(--color-text-muted)]">
          {t.sub}
        </p>

        <div className="mt-10">
          {step === 0 && <IdentityStep draft={draft} patch={patchIdentity} errors={errors} />}
          {step === 1 && <TypeStep draft={draft} setType={(t) => setDraft((d) => ({ ...d, type: t }))} />}
          {step === 2 && <SectorsStep draft={draft} patch={patchSectors} />}
          {step === 3 && <StagesStep draft={draft} setStages={(s) => setDraft((d) => ({ ...d, stages: s }))} />}
          {step === 4 && <CheckStep draft={draft} patch={patchCheck} errors={errors} />}
          {step === 5 && <GeoStep draft={draft} patch={patchGeo} />}
          {step === 6 && <TrackStep draft={draft} patch={patchTrack} />}
          {step === 7 && <ReviewStep draft={draft} fieldErrors={errors} />}
        </div>

        {formError ? (
          <p
            role="alert"
            className="mt-6 rounded-[10px] border border-[color:var(--color-danger)] bg-[color:var(--color-bg)] px-4 py-3 text-[13px] text-[color:var(--color-danger)]"
          >
            {formError}
          </p>
        ) : null}
      </section>

      <footer className="sticky bottom-0 border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[760px] items-center justify-between px-5 py-4 md:px-8 md:py-5">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || isSaving || isPublishing}
            className="text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-strong)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Back
          </button>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--color-text-faint)] sm:inline">
            {step + 1} / {total}
          </span>
          {!isReview ? (
            <button
              type="button"
              onClick={handleContinue}
              disabled={isSaving || readOnly}
              className="inline-flex items-center gap-2 rounded-[10px] bg-[color:var(--color-text-strong)] px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[color:var(--color-text)] disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Continue →
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePublish}
              disabled={isPublishing || readOnly}
              className="inline-flex items-center gap-2 rounded-[10px] bg-[color:var(--color-brand)] px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[color:var(--color-brand-strong)] disabled:opacity-60"
            >
              {isPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Publish profile
            </button>
          )}
        </div>
      </footer>

      {depthView ? (
        <section className="mx-auto w-full max-w-[760px] border-t border-[color:var(--color-border)] px-5 py-10 md:px-8 md:py-12">
          <InvestorDepthEditor depth={depthView} />
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-[760px] border-t border-[color:var(--color-border)] px-5 py-10 md:px-8 md:py-12">
        <VerificationPanel
          ownVerifications={ownVerifications}
          ownReferences={ownReferences}
        />
      </section>
    </main>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Stepper
// ──────────────────────────────────────────────────────────────────────────

function Stepper({ step, setStep }: { step: number; setStep: (i: number) => void }) {
  return (
    <ol className="flex items-start">
      {STEPS.map((s, i) => {
        const isActive = i === step;
        const isComplete = i < step;
        return (
          <li key={s.key} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <span
                aria-hidden
                className={[
                  "h-[2px] flex-1 transition-colors",
                  i === 0 ? "bg-transparent" : i <= step ? "bg-[color:var(--color-brand)]" : "bg-[color:var(--color-border)]",
                ].join(" ")}
              />
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-current={isActive ? "step" : undefined}
                className={[
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] font-semibold transition-colors",
                  isActive
                    ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-white"
                    : isComplete
                      ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
                      : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-faint)]",
                ].join(" ")}
              >
                {isComplete ? "✓" : i + 1}
              </button>
              <span
                aria-hidden
                className={[
                  "h-[2px] flex-1 transition-colors",
                  i === STEPS.length - 1 ? "bg-transparent" : i < step ? "bg-[color:var(--color-brand)]" : "bg-[color:var(--color-border)]",
                ].join(" ")}
              />
            </div>
            <button
              type="button"
              onClick={() => setStep(i)}
              className={[
                "mt-2.5 max-w-full truncate px-1 text-[11.5px] font-medium transition-colors",
                isActive ? "text-[color:var(--color-text-strong)]" : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-strong)]",
              ].join(" ")}
            >
              {s.title}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Steps
// ──────────────────────────────────────────────────────────────────────────

function IdentityStep({
  draft,
  patch,
  errors,
}: {
  draft: InvestorUiDraft;
  patch: (p: Partial<InvestorUiDraft["identity"]>) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="Full name" required error={errors.name}>
        <Input value={draft.identity.fullName} onChange={(v) => patch({ fullName: v })} />
      </Field>
      <Field label="Title / Role" required>
        <Input value={draft.identity.role} onChange={(v) => patch({ role: v })} placeholder="Partner, Principal, Angel, etc." />
      </Field>
      <Field label="Firm name">
        <Input value={draft.identity.firmName} onChange={(v) => patch({ firmName: v })} placeholder='Leave blank if "Solo angel"' />
      </Field>
      <Field label="Work email" required>
        <Input value={draft.identity.workEmail} onChange={(v) => patch({ workEmail: v })} placeholder="you@firm.com" />
      </Field>
      <Field label="Website">
        <Input value={draft.identity.website} onChange={(v) => patch({ website: v })} placeholder="https://..." />
      </Field>
      <Field label="LinkedIn">
        <Input value={draft.identity.linkedinUrl} onChange={(v) => patch({ linkedinUrl: v })} placeholder="linkedin.com/in/..." />
      </Field>
      <Field label="Headquarters">
        <Input value={draft.identity.city} onChange={(v) => patch({ city: v })} placeholder="City, State / Country" />
      </Field>
      <Field label="Founded">
        <Input
          value={draft.identity.foundedYear?.toString() ?? ""}
          onChange={(v) => patch({ foundedYear: v ? Number(v) : null })}
          placeholder="YYYY"
        />
      </Field>
    </div>
  );
}

function TypeStep({
  draft,
  setType,
}: {
  draft: InvestorUiDraft;
  setType: (t: InvestorType) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
      {TYPES.map((t) => {
        const on = draft.type === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(t.key)}
            className={[
              "flex h-full flex-col items-start rounded-[14px] border p-5 text-left transition-colors",
              on
                ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] ring-1 ring-[color:var(--color-brand)]"
                : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-text-strong)]",
            ].join(" ")}
          >
            <span className={["text-[15px] font-semibold leading-tight", on ? "text-[color:var(--color-brand-strong)]" : "text-[color:var(--color-text-strong)]"].join(" ")}>
              {t.label}
            </span>
            <span className="mt-2 text-[12px] leading-snug text-[color:var(--color-text-muted)]">
              {t.note}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SectorsStep({
  draft,
  patch,
}: {
  draft: InvestorUiDraft;
  patch: (p: Partial<InvestorUiDraft["sectors"]>) => void;
}) {
  const selected = new Set(draft.sectors.sectors);
  function toggle(s: string) {
    if (selected.has(s)) {
      patch({ sectors: draft.sectors.sectors.filter((x) => x !== s) });
    } else {
      patch({ sectors: [...draft.sectors.sectors, s] });
    }
  }
  return (
    <div className="space-y-7">
      <div>
        <p className="mb-3 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-[color:var(--color-text-faint)]">
          Sectors I write checks into
        </p>
        <div className="flex flex-wrap gap-2">
          {SECTOR_OPTIONS.map((s) => {
            const on = selected.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggle(s)}
                className={[
                  "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  on
                    ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
                    : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-text-strong)]",
                ].join(" ")}
              >
                {s}
              </button>
            );
          })}
        </div>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--color-text-faint)]">
          {draft.sectors.sectors.length} selected
        </p>
      </div>
      <div className="border-t border-[color:var(--color-border)] pt-6">
        <Field label="Investment thesis (public)">
          <Textarea
            placeholder="One paragraph on what you back and why founders should care."
            value={draft.sectors.thesis}
            onChange={(v) => patch({ thesis: v })}
          />
        </Field>
      </div>
      <div>
        <Field label="Anti-thesis (private — used to filter)">
          <Input
            placeholder='e.g. "No consumer social, no crypto-only plays"'
            value={draft.sectors.antiThesis}
            onChange={(v) => patch({ antiThesis: v })}
          />
        </Field>
      </div>
    </div>
  );
}

function StagesStep({
  draft,
  setStages,
}: {
  draft: InvestorUiDraft;
  setStages: (s: StartupStage[]) => void;
}) {
  const selected = new Set(draft.stages);
  function toggle(s: StartupStage) {
    if (selected.has(s)) {
      setStages(draft.stages.filter((x) => x !== s));
    } else {
      setStages([...draft.stages, s]);
    }
  }
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {STAGES_WITH_NOTES.map((s) => {
          const on = selected.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              className={[
                "flex flex-col items-start rounded-[14px] border p-5 text-left transition-colors",
                on
                  ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] ring-1 ring-[color:var(--color-brand)]"
                  : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-text-strong)]",
              ].join(" ")}
            >
              <span className={["text-[15px] font-semibold", on ? "text-[color:var(--color-brand-strong)]" : "text-[color:var(--color-text-strong)]"].join(" ")}>
                {s.label}
              </span>
              <span className="mt-2 font-mono text-[10.5px] tabular-nums text-[color:var(--color-text-muted)]">
                {s.note}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CheckStep({
  draft,
  patch,
  errors,
}: {
  draft: InvestorUiDraft;
  patch: (p: Partial<InvestorUiDraft["check"]>) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-7">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Field label="Min check" required error={errors.checkMin}>
          <Input
            prefix="$"
            value={draft.check.minCheck?.toString() ?? ""}
            onChange={(v) => patch({ minCheck: v ? Number(v.replace(/[^0-9]/g, "")) : null })}
          />
        </Field>
        <Field label="Sweet spot">
          <Input
            prefix="$"
            value={draft.check.sweetSpot?.toString() ?? ""}
            onChange={(v) => patch({ sweetSpot: v ? Number(v.replace(/[^0-9]/g, "")) : null })}
          />
        </Field>
        <Field label="Max check" required error={errors.checkMax}>
          <Input
            prefix="$"
            value={draft.check.maxCheck?.toString() ?? ""}
            onChange={(v) => patch({ maxCheck: v ? Number(v.replace(/[^0-9]/g, "")) : null })}
          />
        </Field>
      </div>
      <Field label="Position">
        <div className="flex flex-wrap gap-2">
          {POSITIONS.map((opt) => {
            const on = draft.check.position === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => patch({ position: opt.key })}
                className={[
                  "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  on
                    ? "border-[color:var(--color-text-strong)] bg-[color:var(--color-text-strong)] text-white"
                    : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-text-strong)]",
                ].join(" ")}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Field>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Annual capacity (checks / yr)">
          <Input
            value={draft.check.annualCapacity?.toString() ?? ""}
            onChange={(v) => patch({ annualCapacity: v ? Number(v) : null })}
          />
        </Field>
        <Field label="Max valuation cap you'll write at">
          <Input
            prefix="$"
            value={draft.check.maxValuation?.toString() ?? ""}
            onChange={(v) => patch({ maxValuation: v ? Number(v.replace(/[^0-9]/g, "")) : null })}
          />
        </Field>
      </div>
    </div>
  );
}

function GeoStep({
  draft,
  patch,
}: {
  draft: InvestorUiDraft;
  patch: (p: Partial<InvestorUiDraft["geo"]>) => void;
}) {
  const selected = new Set(draft.geo.regions);
  function toggle(r: string) {
    if (selected.has(r)) {
      patch({ regions: draft.geo.regions.filter((x) => x !== r) });
    } else {
      patch({ regions: [...draft.geo.regions, r] });
    }
  }
  return (
    <div className="space-y-7">
      <div>
        <p className="mb-3 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-[color:var(--color-text-faint)]">
          Markets I invest in
        </p>
        <div className="flex flex-wrap gap-2">
          {REGION_OPTIONS.map((r) => {
            const on = selected.has(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => toggle(r)}
                className={[
                  "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  on
                    ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
                    : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-text-strong)]",
                ].join(" ")}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>
      <Field label="Remote-first founders welcome?">
        <div className="flex gap-2">
          {REMOTE_OPTIONS.map((opt) => {
            const on = draft.geo.remoteOk === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => patch({ remoteOk: opt.key })}
                className={[
                  "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  on
                    ? "border-[color:var(--color-text-strong)] bg-[color:var(--color-text-strong)] text-white"
                    : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-text-strong)]",
                ].join(" ")}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Office hours / in-person availability (will appear in your thesis)">
        <Input
          placeholder="e.g. NYC Wed/Thu, SF first week of every month"
          value={draft.geo.officeHours}
          onChange={(v) => patch({ officeHours: v })}
        />
      </Field>
    </div>
  );
}

function TrackStep({
  draft,
  patch,
}: {
  draft: InvestorUiDraft;
  patch: (p: Partial<InvestorUiDraft["track"]>) => void;
}) {
  function addRow() {
    patch({
      recent: [
        ...draft.track.recent,
        { company: "", round: "", year: null, checkSize: "" },
      ],
    });
  }
  function removeRow(i: number) {
    patch({ recent: draft.track.recent.filter((_, idx) => idx !== i) });
  }
  function updateRow(i: number, p: Partial<InvestorUiDraft["track"]["recent"][number]>) {
    patch({
      recent: draft.track.recent.map((r, idx) => (idx === i ? { ...r, ...p } : r)),
    });
  }
  return (
    <div className="space-y-7">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Field label="Total checks written">
          <Input
            value={draft.track.totalChecks?.toString() ?? ""}
            onChange={(v) => patch({ totalChecks: v ? Number(v) : null })}
          />
        </Field>
        <Field label="Years investing">
          <Input
            value={draft.track.yearsInvesting?.toString() ?? ""}
            onChange={(v) => patch({ yearsInvesting: v ? Number(v) : null })}
          />
        </Field>
        <Field label="Checks last 12 months">
          <Input
            value={draft.track.checksLast12mo?.toString() ?? ""}
            onChange={(v) => patch({ checksLast12mo: v ? Number(v) : null })}
          />
        </Field>
      </div>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-[color:var(--color-text-faint)]">
            Recent investments — public on your profile
          </p>
          <button
            type="button"
            onClick={addRow}
            className="text-[12.5px] font-medium text-[color:var(--color-text-strong)] hover:underline"
          >
            + Add
          </button>
        </div>
        <ul className="divide-y divide-[color:var(--color-border)] rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
          {draft.track.recent.length === 0 ? (
            <li className="px-4 py-6 text-center text-[13px] text-[color:var(--color-text-faint)]">
              No investments added yet. Click &ldquo;+ Add&rdquo; to add one.
            </li>
          ) : (
            draft.track.recent.map((r, i) => (
              <li key={i} className="grid grid-cols-1 items-center gap-2 px-4 py-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                <Input
                  placeholder="Company"
                  value={r.company}
                  onChange={(v) => updateRow(i, { company: v })}
                />
                <Input
                  placeholder="Round"
                  value={r.round ?? ""}
                  onChange={(v) => updateRow(i, { round: v })}
                />
                <Input
                  placeholder="Year"
                  value={r.year?.toString() ?? ""}
                  onChange={(v) => updateRow(i, { year: v ? Number(v) : null })}
                />
                <Input
                  placeholder="$1M"
                  value={r.checkSize ?? ""}
                  onChange={(v) => updateRow(i, { checkSize: v })}
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="grid h-8 w-8 place-items-center rounded-[8px] text-[color:var(--color-text-faint)] hover:bg-[color:var(--color-bg)] hover:text-[color:var(--color-danger)]"
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function ReviewStep({
  draft,
  fieldErrors,
}: {
  draft: InvestorUiDraft;
  fieldErrors: Record<string, string>;
}) {
  const hasErrors = Object.keys(fieldErrors).length > 0;
  const typeLabel = TYPES.find((t) => t.key === draft.type)?.label ?? "—";
  return (
    <div className="space-y-6">
      {hasErrors ? (
        <div className="rounded-[12px] border border-[color:var(--color-danger)] bg-[color:var(--color-bg)] p-4">
          <p className="text-[13px] font-medium text-[color:var(--color-danger)]">
            A few sections still need attention before you can publish:
          </p>
          <ul className="mt-2 list-inside list-disc text-[12.5px] text-[color:var(--color-text-muted)]">
            {Object.values(fieldErrors).slice(0, 6).map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="rounded-[16px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <p className="text-[18px] font-semibold leading-tight text-[color:var(--color-text-strong)]">
          {draft.identity.fullName || "Untitled investor"}
        </p>
        <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
          {draft.identity.role || "—"}
          {draft.identity.firmName ? ` · ${draft.identity.firmName}` : ""}
        </p>
        <p className="mt-3 max-w-[60ch] text-[14px] leading-[1.55] text-[color:var(--color-text)]">
          {draft.sectors.thesis || "Add your thesis in step 3."}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {draft.sectors.sectors.slice(0, 8).map((s) => <Tag key={s}>{s}</Tag>)}
          {draft.stages.map((s) => <Tag key={s}>{STAGE_LABEL[s]}</Tag>)}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SummaryRow label="Type" value={typeLabel} />
        <SummaryRow label="Stages" value={draft.stages.map((s) => STAGE_LABEL[s]).join(", ") || "—"} />
        <SummaryRow label="Check range" value={
          draft.check.minCheck && draft.check.maxCheck
            ? `$${formatCurrency(draft.check.minCheck)} – $${formatCurrency(draft.check.maxCheck)}`
            : "—"
        } />
        <SummaryRow label="Sweet spot" value={draft.check.sweetSpot ? `$${formatCurrency(draft.check.sweetSpot)}` : "—"} />
        <SummaryRow label="Sectors" value={draft.sectors.sectors.length ? `${draft.sectors.sectors.length}` : "—"} />
        <SummaryRow label="Regions" value={draft.geo.regions.length ? `${draft.geo.regions.length}` : "—"} />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Form primitives
// ──────────────────────────────────────────────────────────────────────────

function Field({
  label,
  children,
  required = false,
  full = false,
  error,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  full?: boolean;
  error?: string;
}) {
  return (
    <label className={["block", full ? "md:col-span-2" : ""].join(" ")}>
      <span className="mb-2 flex items-center gap-1 text-[12px] font-medium text-[color:var(--color-text-strong)]">
        {label}
        {required && <span className="text-[color:var(--color-brand)]">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-[12px] text-[color:var(--color-danger)]">{error}</span>
      ) : null}
    </label>
  );
}

function Input({
  placeholder,
  prefix,
  suffix,
  value,
  onChange,
}: {
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex h-11 items-center rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3.5 transition-colors focus-within:border-[color:var(--color-text-strong)] focus-within:ring-1 focus-within:ring-[color:var(--color-text-strong)]">
      {prefix ? (
        <span className="mr-1.5 font-mono text-[12.5px] text-[color:var(--color-text-faint)]">{prefix}</span>
      ) : null}
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full w-full bg-transparent text-[14px] text-[color:var(--color-text-strong)] placeholder:text-[color:var(--color-text-faint)] focus:outline-none"
      />
      {suffix ? (
        <span className="ml-1.5 font-mono text-[12.5px] text-[color:var(--color-text-faint)]">{suffix}</span>
      ) : null}
    </div>
  );
}

function Textarea({
  placeholder,
  value,
  onChange,
}: {
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={4}
      className="block w-full resize-none rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3.5 py-3 text-[14px] leading-relaxed text-[color:var(--color-text-strong)] placeholder:text-[color:var(--color-text-faint)] transition-colors focus:border-[color:var(--color-text-strong)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-text-strong)]"
    />
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2.5 py-0.5 text-[11.5px] font-medium text-[color:var(--color-text-muted)]">
      {children}
    </span>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[color:var(--color-text-faint)]">
        {label}
      </span>
      <span className="text-right text-[13.5px] font-medium text-[color:var(--color-text-strong)]">
        {value}
      </span>
    </div>
  );
}

function BuilderBanner({ accountLabel }: { accountLabel: AccountLabel }) {
  if (accountLabel === "verified" || accountLabel === "unverified") return null;

  const config: Record<
    Exclude<AccountLabel, "verified" | "unverified">,
    { title: string; body: string; tone: "info" | "warning" | "danger" }
  > = {
    in_review: {
      title: "In review",
      body: "Your last submission is being reviewed. Editing is locked until the result lands (usually under a minute).",
      tone: "info",
    },
    rejected: {
      title: "Resubmission needed",
      body: "Your previous submission was bounced back. Edit the flagged sections and submit again.",
      tone: "warning",
    },
    banned: {
      title: "Account suspended",
      body: "Editing is disabled while your account is suspended. Contact support if this is a mistake.",
      tone: "danger",
    },
  };

  const c = config[accountLabel];
  const accent =
    c.tone === "danger" ? "var(--color-danger)"
      : c.tone === "warning" ? "#d97706"
      : "var(--color-brand)";

  return (
    <div
      role="status"
      className="border-b px-5 py-3 md:px-8"
      style={{
        background: "var(--color-bg)",
        borderTop: `2px solid ${accent}`,
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div className="mx-auto flex max-w-[960px] items-baseline gap-3">
        <p className="text-[12.5px] font-semibold tracking-tight" style={{ color: accent }}>
          {c.title}
        </p>
        <p className="text-[12.5px] leading-[1.5] text-[color:var(--color-text-muted)]">
          {c.body}
        </p>
      </div>
    </div>
  );
}

function formatCurrency(n: number): string {
  return n.toLocaleString("en-US");
}
