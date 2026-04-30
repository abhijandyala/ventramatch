"use client";

import {
  useCallback,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Wordmark } from "@/components/landing/wordmark";
import { FounderDepthEditor } from "@/components/profile/founder-depth-editor";
import { DeckUploader } from "@/components/profile/deck-uploader";
import { VerificationPanel, type OwnVerification, type OwnReference } from "@/components/profile/verification-panel";
import { BuilderNav } from "@/components/profile/builder-nav";
import { founderCompletion } from "@/lib/profile/completion";
import type { StartupStage, AccountLabel } from "@/types/database";
import type { StartupDepthView } from "@/lib/profile/visibility";
import type {
  SubmitFounderInput,
  DraftFounderInput,
} from "@/lib/validation/applications";
import { STARTUP_SECTORS } from "@/lib/profile/sectors";
import {
  saveFounderDraftAction,
  submitFounderApplicationAction,
} from "./actions";

const READ_ONLY_LABELS: AccountLabel[] = ["in_review"];

function isReadOnly(label: AccountLabel): boolean {
  return READ_ONLY_LABELS.includes(label);
}

// ──────────────────────────────────────────────────────────────────────────
//  UI draft shape (richer than the canonical schema; collapses at submit)
// ──────────────────────────────────────────────────────────────────────────

export type FounderUiDraft = {
  company: {
    name: string;
    website: string;
    description: string;
    city: string;
    foundedYear: number | null;
  };
  sectors: string[]; // up to 3 — first one becomes `industry` at submit
  stage: StartupStage | null;
  round: {
    targetRaise: number | null;
  };
  traction: {
    mrr: number | null;
    customers: number | null;
    growthPct: number | null;
    notableSignals: string;
    other: string;
  };
  /**
   * Deck has two coexisting representations:
   *   - `url`: external link (DocSend / Drive / Notion). Saved on Continue.
   *   - `fileName` + `uploadedAt`: present when a PDF was uploaded directly
   *     to our S3 bucket via /api/deck/upload. The upload route writes the
   *     storage key to the DB; `fileName` here is just for display.
   * The download route prefers the uploaded file when both are set.
   */
  deck: { url: string; fileName: string; uploadedAt: string | null };
  founder: {
    fullName: string;
    role: string;
    workEmail: string;
    linkedinUrl: string;
  };
};

export const EMPTY_FOUNDER_DRAFT: FounderUiDraft = {
  company: { name: "", website: "", description: "", city: "", foundedYear: null },
  sectors: [],
  stage: null,
  round: { targetRaise: null },
  traction: { mrr: null, customers: null, growthPct: null, notableSignals: "", other: "" },
  deck: { url: "", fileName: "", uploadedAt: null },
  founder: { fullName: "", role: "", workEmail: "", linkedinUrl: "" },
};

// ──────────────────────────────────────────────────────────────────────────
//  Mapping: rich UI draft → flat schema the server expects
// ──────────────────────────────────────────────────────────────────────────

/** Best-effort 1-line summary that preserves what we collected. */
function buildTractionString(t: FounderUiDraft["traction"]): string | undefined {
  const parts: string[] = [];
  if (t.mrr) parts.push(`MRR: $${t.mrr.toLocaleString()}`);
  if (t.customers) parts.push(`Customers: ${t.customers.toLocaleString()}`);
  if (t.growthPct) parts.push(`Growth: ${t.growthPct}%`);
  if (t.notableSignals.trim()) parts.push(t.notableSignals.trim());
  if (t.other.trim()) parts.push(t.other.trim());
  const result = parts.join(" · ");
  return result || undefined;
}

function urlOrUndef(v: string): string | undefined {
  const trimmed = v.trim();
  return trimmed ? trimmed : undefined;
}

function toSubmitInput(d: FounderUiDraft): SubmitFounderInput {
  return {
    companyName: d.company.name.trim(),
    oneLiner: d.company.description.trim(),
    industry: d.sectors[0] ?? "",
    startupSectors: d.sectors.length > 0 ? d.sectors : undefined,
    stage: (d.stage ?? "idea") as StartupStage,
    raiseAmount: d.round.targetRaise ?? undefined,
    traction: buildTractionString(d.traction),
    location: d.company.city.trim() || undefined,
    deckUrl: urlOrUndef(d.deck.url),
    website: urlOrUndef(d.company.website),
  };
}

function toDraftInput(d: FounderUiDraft): DraftFounderInput {
  return {
    companyName: d.company.name.trim() || undefined,
    oneLiner: d.company.description.trim() || undefined,
    industry: d.sectors[0]?.trim() || undefined,
    startupSectors: d.sectors.length > 0 ? d.sectors : undefined,
    stage: d.stage ?? undefined,
    raiseAmount: d.round.targetRaise ?? undefined,
    traction: buildTractionString(d.traction),
    location: d.company.city.trim() || undefined,
    deckUrl: urlOrUndef(d.deck.url),
    website: urlOrUndef(d.company.website),
  };
}

// ──────────────────────────────────────────────────────────────────────────
//  Steps & UI constants
// ──────────────────────────────────────────────────────────────────────────

const STEPS = [
  { key: "company", title: "Company" },
  { key: "sector", title: "Sector" },
  { key: "stage", title: "Stage" },
  { key: "round", title: "Round" },
  { key: "traction", title: "Traction" },
  { key: "deck", title: "Deck" },
  { key: "founder", title: "Founder" },
  { key: "review", title: "Review" },
] as const;

const STEP_HEADERS = [
  { title: "Tell us about your company.", sub: "These details are public on your profile. Investors see this first." },
  { title: "What sector are you in?", sub: "Pick one — it's the largest single signal in the match score." },
  { title: "What stage are you raising at?", sub: "We only show you investors who explicitly back your stage." },
  { title: "Tell us about the round.", sub: "Visible only to investors after both sides opt in." },
  { title: "What's your traction?", sub: "Be specific. Self-reported numbers are clearly labeled until verified." },
  { title: "Add your deck.", sub: "Paste a link for now. Stays private until mutual interest unlocks." },
  { title: "Verify it's really you.", sub: "We verify identity before any startup profile activates." },
  { title: "Looking good. Review and publish.", sub: "Final pass before your profile goes live." },
];

// Sector taxonomy is centralised in lib/profile/sectors.ts so founder,
// investor, onboarding, and matching all agree on names. See that file
// for the rationale + alias map.
const SECTOR_OPTIONS = STARTUP_SECTORS;

const STAGES_WITH_NOTES: { key: StartupStage; label: string; note: string }[] = [
  { key: "idea",          label: "Idea",          note: "Just an idea" },
  { key: "pre_seed",      label: "Pre-seed",      note: "$0 – $2M raise" },
  { key: "seed",          label: "Seed",          note: "$2M – $5M raise" },
  { key: "series_a",      label: "Series A",      note: "$5M – $20M raise" },
  { key: "series_b_plus", label: "Series B+",     note: "$20M+ raise" },
];

const STAGE_LABEL: Record<StartupStage, string> = {
  idea: "Idea",
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  series_b_plus: "Series B+",
};


// ──────────────────────────────────────────────────────────────────────────
//  Top-level component
// ──────────────────────────────────────────────────────────────────────────

export function FounderBuilder({
  initial,
  accountLabel,
  depthView,
  ownVerifications = [],
  ownReferences = [],
}: {
  initial: FounderUiDraft;
  accountLabel: AccountLabel;
  depthView?: StartupDepthView | null;
  ownVerifications?: OwnVerification[];
  ownReferences?: OwnReference[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<FounderUiDraft>(initial);
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
    (next?: FounderUiDraft) =>
      new Promise<boolean>((resolve) => {
        startSaving(async () => {
          const result = await saveFounderDraftAction(toDraftInput(next ?? draft));
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

  function patchCompany(p: Partial<FounderUiDraft["company"]>) {
    setDraft((d) => ({ ...d, company: { ...d.company, ...p } }));
  }
  function patchRound(p: Partial<FounderUiDraft["round"]>) {
    setDraft((d) => ({ ...d, round: { ...d.round, ...p } }));
  }
  function patchTraction(p: Partial<FounderUiDraft["traction"]>) {
    setDraft((d) => ({ ...d, traction: { ...d.traction, ...p } }));
  }
  function patchDeck(p: Partial<FounderUiDraft["deck"]>) {
    setDraft((d) => ({ ...d, deck: { ...d.deck, ...p } }));
  }
  function patchFounder(p: Partial<FounderUiDraft["founder"]>) {
    setDraft((d) => ({ ...d, founder: { ...d.founder, ...p } }));
  }

  async function handleContinue() {
    const ok = await save();
    if (ok) setStep((s) => Math.min(total - 1, s + 1));
  }

  function handlePublish() {
    setErrors({});
    setFormError(null);
    startPublishing(async () => {
      const result = await submitFounderApplicationAction(toSubmitInput(draft));
      if (!result.ok) {
        setFormError(result.error);
        if (result.field) setErrors({ [result.field]: result.error });
        return;
      }
      router.push("/dashboard?published=1");
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
            Build profile · Startup
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

      <BuilderNav
        completion={founderCompletion(
          // We derive a lightweight completion from the draft state so the
          // nav bar updates live as the user fills fields — no server trip.
          {
            id: "", user_id: "", name: draft.company.name, one_liner: draft.company.description,
            industry: draft.sectors[0] ?? "", stage: draft.stage ?? "idea",
            raise_amount: draft.round.targetRaise, traction: draft.traction.notableSignals || null,
            location: draft.company.city || null, deck_url: draft.deck.url || null,
            deck_storage_key: draft.deck.fileName ? "present" : null,
            deck_filename: draft.deck.fileName || null, deck_uploaded_at: null,
            website: draft.company.website || null, startup_sectors: draft.sectors,
            created_at: "", updated_at: "",
          },
        )}
        wizardStep={step}
        totalWizardSteps={total}
      />

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
          {step === 0 && <CompanyStep draft={draft} patch={patchCompany} errors={errors} />}
          {step === 1 && <SectorStep draft={draft} setSectors={(s) => setDraft((d) => ({ ...d, sectors: s }))} />}
          {step === 2 && <StageStep draft={draft} setStage={(s) => setDraft((d) => ({ ...d, stage: s }))} />}
          {step === 3 && <RoundStep draft={draft} patch={patchRound} errors={errors} />}
          {step === 4 && <TractionStep draft={draft} patch={patchTraction} />}
          {step === 5 && <DeckStep draft={draft} patch={patchDeck} errors={errors} />}
          {step === 6 && <FounderStep draft={draft} patch={patchFounder} errors={errors} />}
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

      {depthView ? (
        <section id="depth-editor" className="scroll-mt-16 mx-auto w-full max-w-[760px] border-t border-[color:var(--color-border)] px-5 py-10 md:px-8 md:py-12">
          <FounderDepthEditor depth={depthView} />
        </section>
      ) : null}

      <section id="verification-panel" className="scroll-mt-16 mx-auto w-full max-w-[760px] border-t border-[color:var(--color-border)] px-5 py-10 md:px-8 md:py-12">
        <VerificationPanel
          ownVerifications={ownVerifications}
          ownReferences={ownReferences}
        />
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
                aria-label={`Step ${i + 1}: ${s.title}`}
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

function CompanyStep({
  draft,
  patch,
  errors,
}: {
  draft: FounderUiDraft;
  patch: (p: Partial<FounderUiDraft["company"]>) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="Company name" required error={errors.companyName}>
        <Input
          placeholder="Acme Labs"
          value={draft.company.name}
          onChange={(v) => patch({ name: v })}
        />
      </Field>
      <Field label="Website" error={errors.website}>
        <Input
          placeholder="https://..."
          value={draft.company.website}
          onChange={(v) => patch({ website: v })}
        />
      </Field>
      <Field label="One-line description" full required error={errors.oneLiner}>
        <Input
          placeholder="What you do, in one sentence."
          value={draft.company.description}
          onChange={(v) => patch({ description: v })}
        />
      </Field>
      <Field label="HQ city" error={errors.location}>
        <Input
          placeholder="City, State / Country"
          value={draft.company.city}
          onChange={(v) => patch({ city: v })}
        />
      </Field>
      <Field label="Founded">
        <Input
          placeholder="YYYY"
          value={draft.company.foundedYear?.toString() ?? ""}
          onChange={(v) => patch({ foundedYear: v ? Number(v) : null })}
        />
      </Field>
    </div>
  );
}

function SectorStep({
  draft,
  setSectors,
}: {
  draft: FounderUiDraft;
  setSectors: (s: string[]) => void;
}) {
  const selected = new Set(draft.sectors);
  function toggle(s: string) {
    if (selected.has(s)) {
      setSectors(draft.sectors.filter((x) => x !== s));
    } else if (draft.sectors.length < 3) {
      setSectors([...draft.sectors, s]);
    }
  }
  const atMax = draft.sectors.length >= 3;
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {SECTOR_OPTIONS.map((s) => {
          const on = selected.has(s);
          const disabled = atMax && !on;
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              disabled={disabled}
              className={[
                "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                on
                  ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
                  : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-text-strong)] hover:text-[color:var(--color-text-strong)]",
                disabled ? "cursor-not-allowed opacity-40" : "",
              ].join(" ")}
            >
              {s}
            </button>
          );
        })}
      </div>
      <div className="mt-7 flex items-center justify-between border-t border-[color:var(--color-border)] pt-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--color-text-faint)]">
          {draft.sectors.length} of 3 selected
        </p>
        <p className="text-[12px] text-[color:var(--color-text-faint)]">
          The first one becomes your primary industry.
        </p>
      </div>
    </div>
  );
}

function StageStep({
  draft,
  setStage,
}: {
  draft: FounderUiDraft;
  setStage: (s: StartupStage) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {STAGES_WITH_NOTES.map((s) => {
          const on = draft.stage === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setStage(s.key)}
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
      <div className="mt-6 rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-4 py-3">
        <p className="text-[12.5px] leading-snug text-[color:var(--color-text-muted)]">
          Stage drives a hard filter. Investors who don&apos;t back your stage
          will not see your profile, even if every other input matches.
        </p>
      </div>
    </div>
  );
}

function RoundStep({
  draft,
  patch,
  errors,
}: {
  draft: FounderUiDraft;
  patch: (p: Partial<FounderUiDraft["round"]>) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-7">
      <Field label="Target raise" required error={errors.raiseAmount}>
        <Input
          prefix="$"
          placeholder="0"
          value={draft.round.targetRaise?.toString() ?? ""}
          onChange={(v) => patch({ targetRaise: v ? Number(v.replace(/[^0-9]/g, "")) : null })}
        />
      </Field>
      <div className="rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-4 py-3">
        <p className="text-[12.5px] leading-snug text-[color:var(--color-text-muted)]">
          <strong className="text-[color:var(--color-text-strong)]">Round mechanics</strong> — instrument,
          valuation band, lead status, close date, use of funds, and key terms live in the{" "}
          <span className="font-medium">Round details</span> section below the wizard.
          Fill them after you finish the basics; they&apos;re saved independently.
        </p>
      </div>
    </div>
  );
}

function TractionStep({
  draft,
  patch,
}: {
  draft: FounderUiDraft;
  patch: (p: Partial<FounderUiDraft["traction"]>) => void;
}) {
  return (
    <div className="space-y-7">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Field label="MRR">
          <Input
            prefix="$"
            placeholder="0"
            value={draft.traction.mrr?.toString() ?? ""}
            onChange={(v) => patch({ mrr: v ? Number(v.replace(/[^0-9]/g, "")) : null })}
          />
        </Field>
        <Field label="Paying customers">
          <Input
            placeholder="0"
            value={draft.traction.customers?.toString() ?? ""}
            onChange={(v) => patch({ customers: v ? Number(v.replace(/[^0-9]/g, "")) : null })}
          />
        </Field>
        <Field label="3-month growth">
          <Input
            suffix="%"
            placeholder="0"
            value={draft.traction.growthPct?.toString() ?? ""}
            onChange={(v) => patch({ growthPct: v ? Number(v) : null })}
          />
        </Field>
      </div>
      <Field label="Notable signals">
        <Textarea
          placeholder="Pilots, design partners, enterprise interest, key hires."
          value={draft.traction.notableSignals}
          onChange={(v) => patch({ notableSignals: v })}
        />
      </Field>
      <Field label="Anything else investors should know">
        <Textarea
          placeholder="Optional context — recent press, partnerships, awards."
          value={draft.traction.other}
          onChange={(v) => patch({ other: v })}
        />
      </Field>
      <div className="rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-4 py-3">
        <p className="text-[12.5px] leading-snug text-[color:var(--color-text-muted)]">
          Traction is the lowest-weighted input on purpose — it&apos;s the
          easiest one to inflate on a profile. Be honest; investors notice.
        </p>
      </div>
    </div>
  );
}

function DeckStep({
  draft,
  patch,
  errors,
}: {
  draft: FounderUiDraft;
  patch: (p: Partial<FounderUiDraft["deck"]>) => void;
  errors: Record<string, string>;
}) {
  // `errors.deckUrl` from server validation only applies to the external
  // URL field. Surface it via the field hint area below the uploader.
  return (
    <div className="space-y-6">
      <DeckUploader
        currentDeck={{
          filename: draft.deck.fileName || null,
          uploadedAt: draft.deck.uploadedAt,
        }}
        urlValue={draft.deck.url}
        onUrlChange={(v) => patch({ url: v })}
        onUploaded={(next) => {
          // next.filename === "" signals removal (see DeckUploader.RemoveButton)
          patch({
            fileName: next.filename,
            uploadedAt: next.filename ? next.uploadedAt : null,
          });
        }}
      />
      {errors.deckUrl ? (
        <p className="text-[12px] text-[color:var(--color-danger)]">{errors.deckUrl}</p>
      ) : null}
      <div className="rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-4 py-3">
        <p className="text-[12.5px] leading-snug text-[color:var(--color-text-muted)]">
          Your deck stays private. It&apos;s only revealed to investors who
          you&apos;ve mutually matched with.
        </p>
      </div>
    </div>
  );
}

function FounderStep({
  draft,
  patch,
  errors,
}: {
  draft: FounderUiDraft;
  patch: (p: Partial<FounderUiDraft["founder"]>) => void;
  errors: Record<string, string>;
}) {
  // These fields are collected for verification UX but the canonical schema
  // doesn't store them on `startups` — they live on `users`. They're shown
  // here so the founder can still review them.
  return (
    <div className="space-y-7">
      <div className="rounded-[14px] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand)] font-mono text-[10px] font-bold text-white"
          >
            i
          </span>
          <p className="text-[13px] leading-[1.6] text-[color:var(--color-text-muted)]">
            We verify identity before any startup profile activates. This
            protects investors from impersonators and protects you from
            catfish accounts. Verification status is private.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Full name" required>
          <Input
            placeholder="Your full name"
            value={draft.founder.fullName}
            onChange={(v) => patch({ fullName: v })}
          />
        </Field>
        <Field label="Role" required>
          <Input
            placeholder="CEO & Co-founder"
            value={draft.founder.role}
            onChange={(v) => patch({ role: v })}
          />
        </Field>
        <Field label="Work email" required>
          <Input
            placeholder="you@company.com"
            value={draft.founder.workEmail}
            onChange={(v) => patch({ workEmail: v })}
          />
        </Field>
        <Field label="LinkedIn URL">
          <Input
            placeholder="linkedin.com/in/..."
            value={draft.founder.linkedinUrl}
            onChange={(v) => patch({ linkedinUrl: v })}
          />
        </Field>
      </div>
      {errors[""] ? (
        <p className="text-[12px] text-[color:var(--color-danger)]">{errors[""]}</p>
      ) : null}
    </div>
  );
}

function ReviewStep({
  draft,
  fieldErrors,
}: {
  draft: FounderUiDraft;
  fieldErrors: Record<string, string>;
}) {
  const hasErrors = Object.keys(fieldErrors).length > 0;
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
          {draft.company.name || "Untitled startup"}
        </p>
        <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
          {draft.company.city || "—"}
          {draft.company.foundedYear ? ` · Founded ${draft.company.foundedYear}` : ""}
        </p>
        <p className="mt-3 max-w-[60ch] text-[14px] leading-[1.55] text-[color:var(--color-text)]">
          {draft.company.description || "Add a one-line description in step 1."}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {draft.sectors.map((s) => <Tag key={s}>{s}</Tag>)}
          {draft.stage ? <Tag>{STAGE_LABEL[draft.stage]}</Tag> : null}
          {draft.round.targetRaise ? <Tag green>Raising ${formatCurrency(draft.round.targetRaise)}</Tag> : null}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SummaryRow label="Stage" value={draft.stage ? STAGE_LABEL[draft.stage] : "—"} />
        <SummaryRow label="Target raise" value={draft.round.targetRaise ? `$${formatCurrency(draft.round.targetRaise)}` : "—"} />
        <SummaryRow label="MRR" value={draft.traction.mrr ? `$${formatCurrency(draft.traction.mrr)}` : "—"} />
        <SummaryRow label="Customers" value={draft.traction.customers ? draft.traction.customers.toString() : "—"} />
        <SummaryRow label="Deck" value={draft.deck.url ? (draft.deck.fileName || "Linked") : "Not yet"} />
        <SummaryRow label="Founder" value={draft.founder.fullName || "—"} />
      </div>
      <p className="text-[12px] leading-snug text-[color:var(--color-text-faint)]">
        Profile becomes visible only to investors that match your filters.
        You won&apos;t appear in any public list, and nothing outside the
        match score is sent until both sides opt in.
      </p>
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

function Tag({ children, green = false }: { children: ReactNode; green?: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium",
        green
          ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
          : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)]",
      ].join(" ")}
    >
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

// Inline banner shown above the step content. Mirrors the global
// AccountStatusBanner but tuned for the dark builder shell — neutral fill,
// title + body row, no CTA so it stays out of the user's way.
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
