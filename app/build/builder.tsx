"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, ArrowLeft, Linkedin } from "lucide-react";
import { founderCompletion, MIN_PUBLISH_PCT } from "@/lib/profile/completion";
import { FounderDepthEditor } from "@/components/profile/founder-depth-editor";
import { DeckUploader } from "@/components/profile/deck-uploader";
import { VerificationPanel, type OwnVerification, type OwnReference } from "@/components/profile/verification-panel";
import type { StartupStage, AccountLabel, ProfileState } from "@/types/database";
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
import {
  connectLinkedInAction,
  applyLinkedInDataAction,
  type LinkedInConnectionStatus,
} from "./connect-actions";
import { LinkedInFillModal } from "@/components/profile/linkedin-fill-modal";
import { switchRoleAction } from "./switch-role-action";

const READ_ONLY_LABELS: AccountLabel[] = ["in_review"];

function isReadOnly(label: AccountLabel): boolean {
  return READ_ONLY_LABELS.includes(label);
}

// ──────────────────────────────────────────────────────────────────────────
//  UI draft shape
// ──────────────────────────────────────────────────────────────────────────

import type { ProductStatus, CustomerType } from "@/types/database";
import { PRODUCT_STATUS_LABELS, CUSTOMER_TYPE_LABELS } from "@/types/database";

export type FounderUiDraft = {
  company: {
    name: string;
    website: string;
    description: string;
    city: string;
    foundedYear: number | null;
    productStatus: ProductStatus | null;
    customerType: CustomerType | null;
  };
  sectors: string[];
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
  deck: { url: string; fileName: string; uploadedAt: string | null };
  founder: {
    fullName: string;
    role: string;
    workEmail: string;
    linkedinUrl: string;
  };
};

export const EMPTY_FOUNDER_DRAFT: FounderUiDraft = {
  company: { name: "", website: "", description: "", city: "", foundedYear: null, productStatus: null, customerType: null },
  sectors: [],
  stage: null,
  round: { targetRaise: null },
  traction: { mrr: null, customers: null, growthPct: null, notableSignals: "", other: "" },
  deck: { url: "", fileName: "", uploadedAt: null },
  founder: { fullName: "", role: "", workEmail: "", linkedinUrl: "" },
};

// ──────────────────────────────────────────────────────────────────────────
//  Mapping helpers
// ──────────────────────────────────────────────────────────────────────────

function buildTractionString(t: FounderUiDraft["traction"]): string | undefined {
  if (!t) return undefined;
  const parts: string[] = [];
  if (t.mrr) parts.push(`MRR: $${t.mrr.toLocaleString()}`);
  if (t.customers) parts.push(`Customers: ${t.customers.toLocaleString()}`);
  if (t.growthPct) parts.push(`Growth: ${t.growthPct}%`);
  if (t.notableSignals?.trim()) parts.push(t.notableSignals.trim());
  if (t.other?.trim()) parts.push(t.other.trim());
  const result = parts.join(" · ");
  return result || undefined;
}

function urlOrUndef(v: string | undefined | null): string | undefined {
  const trimmed = (v ?? "").trim();
  return trimmed || undefined;
}

function toSubmitInput(d: FounderUiDraft): SubmitFounderInput {
  return {
    companyName: d.company?.name?.trim() ?? "",
    oneLiner: d.company?.description?.trim() ?? "",
    industry: d.sectors?.[0] ?? "",
    startupSectors: d.sectors?.length ? d.sectors : undefined,
    stage: (d.stage ?? "idea") as StartupStage,
    raiseAmount: d.round?.targetRaise ?? undefined,
    traction: buildTractionString(d.traction),
    location: d.company?.city?.trim() || undefined,
    deckUrl: urlOrUndef(d.deck?.url),
    website: urlOrUndef(d.company?.website),
    foundedYear: d.company?.foundedYear ?? undefined,
    productStatus: d.company?.productStatus ?? undefined,
    customerType: d.company?.customerType ?? undefined,
  };
}

function toDraftInput(d: FounderUiDraft): DraftFounderInput {
  return {
    companyName: d.company?.name?.trim() || undefined,
    oneLiner: d.company?.description?.trim() || undefined,
    industry: d.sectors?.[0]?.trim() || undefined,
    startupSectors: d.sectors?.length ? d.sectors : undefined,
    stage: d.stage ?? undefined,
    raiseAmount: d.round?.targetRaise ?? undefined,
    traction: buildTractionString(d.traction),
    location: d.company?.city?.trim() || undefined,
    deckUrl: urlOrUndef(d.deck?.url),
    website: urlOrUndef(d.company?.website),
    foundedYear: d.company?.foundedYear ?? undefined,
    productStatus: d.company?.productStatus ?? undefined,
    customerType: d.company?.customerType ?? undefined,
  };
}

// ──────────────────────────────────────────────────────────────────────────
//  Steps & constants
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
  { title: "What sector are you in?", sub: "Pick up to three. The first becomes your primary industry in the match score." },
  { title: "What stage are you raising at?", sub: "We only show you investors who explicitly back your stage." },
  { title: "Tell us about the round.", sub: "Visible only to investors after both sides opt in." },
  { title: "What's your traction?", sub: "Be specific. Self-reported numbers are clearly labeled until verified." },
  { title: "Add your deck.", sub: "Paste a link for now. Stays private until mutual interest unlocks." },
  { title: "Verify it's really you.", sub: "We verify identity before any startup profile activates." },
  { title: "Looking good. Review and publish.", sub: "Final pass before your profile goes live." },
];

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

type Page = "basics" | "depth" | "verifications";

// ──────────────────────────────────────────────────────────────────────────
//  Main component
// ──────────────────────────────────────────────────────────────────────────

export function FounderBuilder({
  initial,
  accountLabel,
  profileState,
  depthView,
  ownVerifications = [],
  ownReferences = [],
  linkedInStatus,
}: {
  initial: FounderUiDraft;
  accountLabel: AccountLabel;
  profileState: ProfileState;
  depthView?: StartupDepthView | null;
  ownVerifications?: OwnVerification[];
  ownReferences?: OwnReference[];
  linkedInStatus?: LinkedInConnectionStatus;
}) {
  const router = useRouter();
  const [page, setPage] = useState<Page>("basics");
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<FounderUiDraft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isPublishing, startPublishing] = useTransition();
  const [isConnecting, startConnecting] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showLinkedInModal, setShowLinkedInModal] = useState(false);

  useEffect(() => {
    if (savedAt) {
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSavedAt(null), 5000);
    }
    return () => { if (savedTimer.current) clearTimeout(savedTimer.current); };
  }, [savedAt]);

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

  async function handleSaveAndExit() {
    await save();
    router.push("/dashboard");
  }

  function handleFillLinkedIn() {
    if (linkedInStatus?.connected) {
      setShowLinkedInModal(true);
    } else {
      startConnecting(async () => {
        await connectLinkedInAction();
      });
    }
  }

  async function handleApplyLinkedIn(selectedFields: {
    name: boolean;
    picture: boolean;
    email: boolean;
  }) {
    const result = await applyLinkedInDataAction(selectedFields);
    if (result.ok && result.appliedFields && result.appliedFields.length > 0) {
      if (result.appliedFields.includes("name") && linkedInStatus?.profile?.name) {
        patchFounder({ fullName: linkedInStatus.profile.name });
      }
      router.refresh();
    }
    return result;
  }

  const completion = founderCompletion({
    id: "", user_id: "",
    name: draft.company?.name ?? "",
    one_liner: draft.company?.description ?? "",
    industry: draft.sectors?.[0] ?? "",
    stage: draft.stage ?? "idea",
    raise_amount: draft.round?.targetRaise ?? null,
    traction: draft.traction?.notableSignals || null,
    location: draft.company?.city || null,
    deck_url: draft.deck?.url || null,
    deck_storage_key: draft.deck?.fileName ? "present" : null,
    deck_filename: draft.deck?.fileName || null,
    deck_uploaded_at: null,
    website: draft.company?.website || null,
    startup_sectors: draft.sectors ?? [],
    founded_year: null, product_status: null, customer_type: null,
    created_at: "", updated_at: "",
  });

  return (
    <main className="min-h-screen bg-[color:var(--color-bg)] pb-16">
      {/* LinkedIn Fill Modal */}
      {showLinkedInModal && linkedInStatus && (
        <LinkedInFillModal
          status={linkedInStatus}
          onApply={handleApplyLinkedIn}
          onClose={() => setShowLinkedInModal(false)}
          currentValues={{
            name: draft.founder?.fullName ?? "",
            picture: "",
            email: draft.founder?.workEmail ?? "",
          }}
        />
      )}

      {/* Header — sits below the shared ProductNav from app/build/layout.tsx. */}
      <header className="border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]">
        <div className="flex h-14 items-center justify-between px-6">
          <button
            type="button"
            onClick={() => {
              startSaving(async () => {
                const res = await switchRoleAction("investor");
                if (res.ok) window.location.href = "/build/investor";
              });
            }}
            className="text-[12px] text-[color:var(--color-text-faint)] transition-colors hover:text-[color:var(--color-text-muted)]"
          >
            Switch to Investor
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleFillLinkedIn}
              disabled={isConnecting}
              className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-[color:var(--color-border)] bg-white px-3.5 text-[13px] font-medium text-[color:var(--color-text)] transition-colors hover:border-[color:var(--color-text-faint)] hover:shadow-sm disabled:opacity-50"
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              ) : (
                <Linkedin className="h-4 w-4 text-[#0A66C2]" strokeWidth={0} fill="#0A66C2" />
              )}
              {linkedInStatus?.connected ? "Fill with LinkedIn" : "Connect LinkedIn"}
            </button>

            <span className="h-5 w-px bg-[color:var(--color-border)]" />

            <button
              type="button"
              onClick={() => save()}
              disabled={isSaving || readOnly}
              className="text-[13px] text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text)] disabled:opacity-50"
            >
              {isSaving ? "Saving..." : savedAt ? `Saved ${savedAt}` : "Save draft"}
            </button>
            <button
              type="button"
              onClick={handleSaveAndExit}
              disabled={isSaving || readOnly}
              className="text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text)] disabled:opacity-50"
            >
              Save & exit
            </button>
          </div>
        </div>
      </header>

      {/* Page tabs */}
      <nav className="border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]">
        <div className="flex px-6">
          {(["basics", "depth", "verifications"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { if (page !== p) { save(); setPage(p); } }}
              className={[
                "relative px-5 py-3.5 text-[14px] font-medium capitalize transition-colors",
                page === p
                  ? "text-[color:var(--color-text)]"
                  : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]",
              ].join(" ")}
            >
              {p}
              {page === p && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[color:var(--color-text)]" />
              )}
            </button>
          ))}
        </div>
      </nav>

      <BuilderBanner accountLabel={accountLabel} />

      {/* Page content */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={page}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          {page === "basics" && (
            <div className="mx-auto w-full max-w-[720px] px-6 py-12 md:py-16">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                >
                  <h1
                    className="font-serif font-semibold leading-[1.08] tracking-tight text-[color:var(--color-text)]"
                    style={{ fontSize: "clamp(28px, 4vw, 38px)" }}
                  >
                    {t.title}
                  </h1>
                  <p className="mt-3 max-w-[56ch] text-[15px] leading-relaxed text-[color:var(--color-text-muted)]">
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
                </motion.div>
              </AnimatePresence>

              {formError ? (
                <p role="alert" className="mt-5 text-[13px] text-[color:var(--color-danger)]">
                  {formError}
                </p>
              ) : null}

              <div className="mt-10 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0 || isSaving || isPublishing}
                  className="inline-flex h-11 items-center gap-1.5 rounded-[10px] px-3 text-[14px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
                  Back
                </button>

                {!isReview ? (
                  <button
                    type="button"
                    onClick={handleContinue}
                    disabled={isSaving || readOnly}
                    className="inline-flex h-11 min-w-[140px] items-center justify-center gap-2 rounded-[10px] bg-[color:var(--color-brand)] px-6 text-[15px] font-medium text-white transition-colors hover:bg-[color:var(--color-brand-strong)] disabled:opacity-60"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : null}
                    Continue
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={isPublishing || readOnly}
                    className="inline-flex h-11 min-w-[140px] items-center justify-center gap-2 rounded-[10px] bg-[color:var(--color-brand)] px-6 text-[15px] font-medium text-white transition-colors hover:bg-[color:var(--color-brand-strong)] disabled:opacity-60"
                  >
                    {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : null}
                    Publish profile
                  </button>
                )}
              </div>
            </div>
          )}

          {page === "depth" && (
            <div className="mx-auto w-full max-w-[720px] px-6 py-12 md:py-16">
              <h1
                className="font-serif font-semibold leading-[1.08] tracking-tight text-[color:var(--color-text)]"
                style={{ fontSize: "clamp(28px, 4vw, 38px)" }}
              >
                Add depth to your profile.
              </h1>
              <p className="mt-3 max-w-[56ch] text-[15px] leading-relaxed text-[color:var(--color-text-muted)]">
                Team, round mechanics, traction details, and market context. Not required to publish, but they improve your match score.
              </p>
              <div className="mt-10">
                {depthView ? (
                  <FounderDepthEditor depth={depthView} />
                ) : (
                  <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-border)] px-6 py-12 text-center">
                    <p className="text-[15px] text-[color:var(--color-text-muted)]">
                      Complete the basics first to unlock depth fields.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {page === "verifications" && (
            <div className="mx-auto w-full max-w-[720px] px-6 py-12 md:py-16">
              <h1
                className="font-serif font-semibold leading-[1.08] tracking-tight text-[color:var(--color-text)]"
                style={{ fontSize: "clamp(28px, 4vw, 38px)" }}
              >
                Verifications.
              </h1>
              <p className="mt-3 max-w-[56ch] text-[15px] leading-relaxed text-[color:var(--color-text-muted)]">
                Self-attested claims and references. Pure trust signal that investors look for.
              </p>
              <div className="mt-10">
                <VerificationPanel
                  ownVerifications={ownVerifications}
                  ownReferences={ownReferences}
                />
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Bottom completion bar */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        className="fixed inset-x-0 bottom-0 z-40"
      >
        <div
          className="border-t border-[color:var(--color-border)] bg-white px-6 py-3"
          style={{ boxShadow: "0 -4px 24px -8px rgba(15, 23, 42, 0.08)" }}
        >
          <div className="mx-auto flex max-w-[960px] items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-mono text-[13px] font-semibold tabular-nums text-[color:var(--color-text)]">
                {completion.pct}%
              </span>
              <div className="hidden h-[4px] w-40 overflow-hidden bg-[color:var(--color-border)] sm:block">
                <div
                  className="h-full bg-[color:var(--color-text)] transition-all duration-500"
                  style={{ width: `${completion.pct}%`, transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
                />
              </div>
              <span className="text-[13px] text-[color:var(--color-text-muted)]">
                {completion.missing.length > 0
                  ? `${completion.missing.length} field${completion.missing.length === 1 ? "" : "s"} remaining`
                  : "Ready to publish"}
              </span>
            </div>
            <button
              type="button"
              onClick={handlePublish}
              disabled={!completion.canPublish || isPublishing || readOnly}
              className={[
                "inline-flex h-10 items-center justify-center gap-2 px-6 text-[14px] font-semibold transition-all duration-150",
                completion.canPublish
                  ? "bg-[color:var(--color-text)] text-white hover:bg-[color:var(--color-text-strong)]"
                  : "bg-[color:var(--color-surface-2)] text-[color:var(--color-text-faint)] cursor-not-allowed",
              ].join(" ")}
            >
              {isPublishing && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />}
              Complete
            </button>
          </div>
        </div>
      </motion.div>
    </main>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Steps
// ──────────────────────────────────────────────────────────────────────────

const PRODUCT_STATUS_OPTIONS = (Object.keys(PRODUCT_STATUS_LABELS) as ProductStatus[]).map((k) => ({
  value: k,
  label: PRODUCT_STATUS_LABELS[k],
}));

const CUSTOMER_TYPE_OPTIONS = (Object.keys(CUSTOMER_TYPE_LABELS) as CustomerType[]).map((k) => ({
  value: k,
  label: CUSTOMER_TYPE_LABELS[k],
}));

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
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Field label="Company name" required error={errors.companyName}>
        <Input placeholder="Acme Labs" value={draft.company.name} onChange={(v) => patch({ name: v })} />
      </Field>
      <Field label="Website" error={errors.website}>
        <Input placeholder="https://..." value={draft.company.website} onChange={(v) => patch({ website: v })} />
      </Field>
      <Field label="One-line description" full required error={errors.oneLiner}>
        <Input placeholder="What you do, in one sentence." value={draft.company.description} onChange={(v) => patch({ description: v })} />
      </Field>
      <Field label="HQ city" error={errors.location}>
        <Input placeholder="City, State / Country" value={draft.company.city} onChange={(v) => patch({ city: v })} />
      </Field>
      <Field label="Founded">
        <Input placeholder="YYYY" value={draft.company.foundedYear?.toString() ?? ""} onChange={(v) => patch({ foundedYear: v ? Number(v) : null })} />
      </Field>
      <Field label="Product status">
        <select
          value={draft.company.productStatus ?? ""}
          onChange={(e) => patch({ productStatus: (e.target.value as ProductStatus) || null })}
          className="h-[42px] w-full border border-[color:var(--color-border)] bg-white px-4 text-[14px] text-[color:var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-brand)]"
        >
          <option value="">Select status</option>
          {PRODUCT_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Customer type">
        <select
          value={draft.company.customerType ?? ""}
          onChange={(e) => patch({ customerType: (e.target.value as CustomerType) || null })}
          className="h-[42px] w-full border border-[color:var(--color-border)] bg-white px-4 text-[14px] text-[color:var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-brand)]"
        >
          <option value="">Select type</option>
          {CUSTOMER_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function SectorStep({ draft, setSectors }: { draft: FounderUiDraft; setSectors: (s: string[]) => void }) {
  const selected = new Set(draft.sectors);
  function toggle(s: string) {
    if (selected.has(s)) setSectors(draft.sectors.filter((x) => x !== s));
    else if (draft.sectors.length < 3) setSectors([...draft.sectors, s]);
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
                "rounded-full border px-4 py-2 text-[13px] font-medium transition-colors",
                on
                  ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
                  : "border-[color:var(--color-border)] bg-white text-[color:var(--color-text-muted)] hover:border-[color:var(--color-text-faint)] hover:text-[color:var(--color-text)]",
                disabled ? "cursor-not-allowed opacity-40" : "",
              ].join(" ")}
            >
              {s}
            </button>
          );
        })}
      </div>
      <p className="mt-5 text-[13px] text-[color:var(--color-text-faint)]">
        {draft.sectors.length} of 3 selected. The first one becomes your primary industry.
      </p>
    </div>
  );
}

function StageStep({ draft, setStage }: { draft: FounderUiDraft; setStage: (s: StartupStage) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {STAGES_WITH_NOTES.map((s) => {
        const on = draft.stage === s.key;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => setStage(s.key)}
            className={[
              "flex flex-col items-start rounded-[var(--radius-md)] border p-5 text-left transition-colors",
              on
                ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] ring-1 ring-[color:var(--color-brand)]"
                : "border-[color:var(--color-border)] bg-white hover:border-[color:var(--color-text-faint)]",
            ].join(" ")}
          >
            <span className={["text-[15px] font-semibold", on ? "text-[color:var(--color-brand-strong)]" : "text-[color:var(--color-text)]"].join(" ")}>
              {s.label}
            </span>
            <span className="mt-2 font-mono text-[11px] tabular-nums text-[color:var(--color-text-muted)]">
              {s.note}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RoundStep({ draft, patch, errors }: { draft: FounderUiDraft; patch: (p: Partial<FounderUiDraft["round"]>) => void; errors: Record<string, string> }) {
  return (
    <div className="max-w-sm space-y-6">
      <Field label="Target raise" required error={errors.raiseAmount}>
        <Input prefix="$" placeholder="500,000" value={draft.round.targetRaise?.toString() ?? ""} onChange={(v) => patch({ targetRaise: v ? Number(v.replace(/[^0-9]/g, "")) : null })} />
      </Field>
      <p className="text-[13px] leading-relaxed text-[color:var(--color-text-faint)]">
        Round mechanics like valuation, instrument, and terms can be added in the Depth tab.
      </p>
    </div>
  );
}

function TractionStep({ draft, patch }: { draft: FounderUiDraft; patch: (p: Partial<FounderUiDraft["traction"]>) => void }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Field label="MRR">
          <Input prefix="$" placeholder="0" value={draft.traction.mrr?.toString() ?? ""} onChange={(v) => patch({ mrr: v ? Number(v.replace(/[^0-9]/g, "")) : null })} />
        </Field>
        <Field label="Paying customers">
          <Input placeholder="0" value={draft.traction.customers?.toString() ?? ""} onChange={(v) => patch({ customers: v ? Number(v.replace(/[^0-9]/g, "")) : null })} />
        </Field>
        <Field label="3-month growth">
          <Input suffix="%" placeholder="0" value={draft.traction.growthPct?.toString() ?? ""} onChange={(v) => patch({ growthPct: v ? Number(v) : null })} />
        </Field>
      </div>
      <Field label="Notable signals">
        <Textarea placeholder="Pilots, design partners, enterprise interest, key hires." value={draft.traction.notableSignals ?? ""} onChange={(v) => patch({ notableSignals: v })} />
      </Field>
    </div>
  );
}

function DeckStep({ draft, patch, errors }: { draft: FounderUiDraft; patch: (p: Partial<FounderUiDraft["deck"]>) => void; errors: Record<string, string> }) {
  return (
    <div className="space-y-5">
      <DeckUploader
        currentDeck={{ filename: draft.deck.fileName || null, uploadedAt: draft.deck.uploadedAt }}
        urlValue={draft.deck.url}
        onUrlChange={(v) => patch({ url: v })}
        onUploaded={(next) => patch({ fileName: next.filename, uploadedAt: next.filename ? next.uploadedAt : null })}
      />
      {errors.deckUrl && <p className="text-[12px] text-[color:var(--color-danger)]">{errors.deckUrl}</p>}
      <p className="text-[13px] text-[color:var(--color-text-faint)]">
        Your deck stays private until mutual interest is established.
      </p>
    </div>
  );
}

function FounderStep({ draft, patch, errors }: { draft: FounderUiDraft; patch: (p: Partial<FounderUiDraft["founder"]>) => void; errors: Record<string, string> }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Field label="Full name" required>
        <Input placeholder="Your full name" value={draft.founder.fullName} onChange={(v) => patch({ fullName: v })} />
      </Field>
      <Field label="Role" required>
        <Input placeholder="CEO & Co-founder" value={draft.founder.role} onChange={(v) => patch({ role: v })} />
      </Field>
      <Field label="Work email" required>
        <Input placeholder="you@company.com" value={draft.founder.workEmail} onChange={(v) => patch({ workEmail: v })} />
      </Field>
      <Field label="LinkedIn URL">
        <Input placeholder="linkedin.com/in/..." value={draft.founder.linkedinUrl} onChange={(v) => patch({ linkedinUrl: v })} />
      </Field>
      {errors[""] && <p className="col-span-full text-[12px] text-[color:var(--color-danger)]">{errors[""]}</p>}
    </div>
  );
}

function ReviewStep({ draft, fieldErrors }: { draft: FounderUiDraft; fieldErrors: Record<string, string> }) {
  const hasErrors = Object.keys(fieldErrors).length > 0;
  const hasDeck = draft.deck?.url || draft.deck?.fileName;
  const hasFounder = (draft.founder?.fullName?.trim()?.length ?? 0) > 0;
  
  return (
    <div className="space-y-6">
      {hasErrors && (
        <div className="rounded-[var(--radius)] border border-[color:var(--color-danger)] bg-white p-4">
          <p className="text-[13px] font-medium text-[color:var(--color-danger)]">
            A few sections still need attention:
          </p>
          <ul className="mt-2 list-inside list-disc text-[13px] text-[color:var(--color-text-muted)]">
            {Object.values(fieldErrors).slice(0, 6).map((msg, i) => <li key={i}>{msg}</li>)}
          </ul>
        </div>
      )}

      {/* Company summary */}
      <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white p-6">
        <p className="text-[18px] font-semibold text-[color:var(--color-text)]">
          {draft.company.name || "Untitled startup"}
        </p>
        <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
          {draft.company.city || "—"}{draft.company.foundedYear ? ` · Founded ${draft.company.foundedYear}` : ""}
        </p>
        <p className="mt-3 max-w-[60ch] text-[14px] leading-[1.55] text-[color:var(--color-text)]">
          {draft.company.description || "Add a one-line description in step 1."}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {draft.sectors.map((s) => <Tag key={s}>{s}</Tag>)}
          {draft.stage && <Tag>{STAGE_LABEL[draft.stage]}</Tag>}
          {draft.round.targetRaise ? <Tag green>Raising ${formatCurrency(draft.round.targetRaise)}</Tag> : null}
          {draft.company.productStatus && (
            <Tag>{PRODUCT_STATUS_LABELS[draft.company.productStatus]}</Tag>
          )}
          {draft.company.customerType && (
            <Tag>{CUSTOMER_TYPE_LABELS[draft.company.customerType]}</Tag>
          )}
        </div>
      </div>

      {/* Checklist */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className={["flex items-center gap-3 rounded-[var(--radius)] border p-4", hasDeck ? "border-[color:var(--color-border)] bg-white" : "border-dashed border-[color:var(--color-text-faint)] bg-[color:var(--color-surface)]"].join(" ")}>
          <span className={["flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold", hasDeck ? "bg-emerald-100 text-emerald-700" : "bg-[color:var(--color-surface-2)] text-[color:var(--color-text-faint)]"].join(" ")}>
            {hasDeck ? "✓" : "—"}
          </span>
          <span className={["text-[13px]", hasDeck ? "text-[color:var(--color-text)]" : "text-[color:var(--color-text-muted)]"].join(" ")}>
            {hasDeck ? (draft.deck.fileName || "Deck linked") : "No deck attached"}
          </span>
        </div>
        <div className={["flex items-center gap-3 rounded-[var(--radius)] border p-4", hasFounder ? "border-[color:var(--color-border)] bg-white" : "border-dashed border-[color:var(--color-text-faint)] bg-[color:var(--color-surface)]"].join(" ")}>
          <span className={["flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold", hasFounder ? "bg-emerald-100 text-emerald-700" : "bg-[color:var(--color-surface-2)] text-[color:var(--color-text-faint)]"].join(" ")}>
            {hasFounder ? "✓" : "—"}
          </span>
          <span className={["text-[13px]", hasFounder ? "text-[color:var(--color-text)]" : "text-[color:var(--color-text-muted)]"].join(" ")}>
            {hasFounder ? (draft.founder?.fullName ?? "") : "Founder details missing"}
          </span>
        </div>
      </div>

      <p className="text-[12px] leading-snug text-[color:var(--color-text-faint)]">
        Profile becomes visible only to investors that match your filters.
        You won&apos;t appear in any public list.
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Form primitives
// ──────────────────────────────────────────────────────────────────────────

function Field({ label, children, required = false, full = false, error }: { label: string; children: ReactNode; required?: boolean; full?: boolean; error?: string }) {
  return (
    <label className={["block", full ? "md:col-span-2" : ""].join(" ")}>
      <span className="mb-2 flex items-center gap-1 text-[13px] font-medium text-[color:var(--color-text)]">
        {label}
        {required && <span className="text-[color:var(--color-brand)]">*</span>}
      </span>
      {children}
      {error && <span className="mt-1.5 block text-[12px] text-[color:var(--color-danger)]">{error}</span>}
    </label>
  );
}

function Input({ placeholder, prefix, suffix, value, onChange }: { placeholder?: string; prefix?: string; suffix?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex h-12 items-center rounded-[var(--radius)] border border-[color:var(--color-border)] bg-white px-4 transition-colors focus-within:border-[color:var(--color-text)] focus-within:ring-1 focus-within:ring-[color:var(--color-text)]/10">
      {prefix && <span className="mr-2 font-mono text-[13px] text-[color:var(--color-text-faint)]">{prefix}</span>}
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full w-full bg-transparent text-[14px] text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-faint)] focus:outline-none"
      />
      {suffix && <span className="ml-2 font-mono text-[13px] text-[color:var(--color-text-faint)]">{suffix}</span>}
    </div>
  );
}

function Textarea({ placeholder, value, onChange }: { placeholder?: string; value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={4}
      className="block w-full resize-none rounded-[var(--radius)] border border-[color:var(--color-border)] bg-white px-4 py-3 text-[14px] leading-relaxed text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-faint)] transition-colors focus:border-[color:var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-text)]/10"
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
          : "border-[color:var(--color-border)] bg-white text-[color:var(--color-text-muted)]",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function BuilderBanner({ accountLabel }: { accountLabel: AccountLabel }) {
  if (accountLabel === "verified" || accountLabel === "unverified") return null;
  const config: Record<Exclude<AccountLabel, "verified" | "unverified">, { title: string; body: string; tone: "info" | "warning" | "danger" }> = {
    in_review: { title: "In review", body: "Your profile is being reviewed. Editing is locked.", tone: "info" },
    rejected: { title: "Resubmission needed", body: "Your profile was returned. Edit and submit again.", tone: "warning" },
    banned: { title: "Account suspended", body: "Contact support if you believe this is a mistake.", tone: "danger" },
  };
  const c = config[accountLabel];
  const borderColor = c.tone === "danger" ? "var(--color-danger)" : c.tone === "warning" ? "#d97706" : "var(--color-brand)";
  return (
    <div className="border-b px-6 py-3" style={{ borderTop: `2px solid ${borderColor}`, borderBottomColor: "var(--color-border)" }}>
      <div className="mx-auto flex max-w-[960px] items-center gap-3">
        <span className="text-[13px] font-semibold" style={{ color: borderColor }}>{c.title}</span>
        <span className="text-[13px] text-[color:var(--color-text-muted)]">{c.body}</span>
      </div>
    </div>
  );
}

function formatCurrency(n: number): string {
  return n.toLocaleString("en-US");
}
