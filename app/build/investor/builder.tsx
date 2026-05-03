"use client";

import {
  useCallback,
  useState,
  useTransition,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X, ArrowLeft, Linkedin } from "lucide-react";
import { InvestorDepthEditor } from "@/components/profile/investor-depth-editor";
import { VideoUploader } from "@/components/profile/video-uploader";
import { VerificationPanel, type OwnVerification, type OwnReference } from "@/components/profile/verification-panel";
import type { StartupStage, AccountLabel, ProfileState, Database } from "@/types/database";
import { investorCompletion, MIN_PUBLISH_PCT } from "@/lib/profile/completion";
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
import {
  connectLinkedInAction,
  applyLinkedInDataAction,
  type LinkedInConnectionStatus,
} from "./connect-actions";
import { LinkedInFillModal } from "@/components/profile/linkedin-fill-modal";
import { switchRoleAction } from "../switch-role-action";

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
  video: { fileName: string | null; uploadedAt: string | null };
};

export const EMPTY_INVESTOR_DRAFT: InvestorUiDraft = {
  identity: { fullName: "", role: "", firmName: "", workEmail: "", website: "", linkedinUrl: "", city: "", foundedYear: null },
  type: null,
  sectors: { sectors: [], thesis: "", antiThesis: "" },
  stages: [],
  check: { minCheck: null, sweetSpot: null, maxCheck: null, position: null, annualCapacity: null, maxValuation: null },
  geo: { regions: [], remoteOk: null, officeHours: "" },
  track: { totalChecks: null, yearsInvesting: null, checksLast12mo: null, recent: [] },
  video: { fileName: null, uploadedAt: null },
};

// ──────────────────────────────────────────────────────────────────────────
//  Mapping rich UI → canonical schema
// ──────────────────────────────────────────────────────────────────────────

function buildThesis(d: InvestorUiDraft): string | undefined {
  const parts: string[] = [];
  if (d.sectors?.thesis?.trim()) parts.push(d.sectors.thesis.trim());
  if (d.sectors?.antiThesis?.trim()) parts.push(`Anti-thesis: ${d.sectors.antiThesis.trim()}`);
  if (d.geo?.officeHours?.trim()) parts.push(`Office hours: ${d.geo.officeHours.trim()}`);
  const result = parts.join(" · ");
  return result || undefined;
}

function toSubmitInput(d: InvestorUiDraft): SubmitInvestorInput {
  const fullName = d.identity?.fullName?.trim() ?? "";
  const role = d.identity?.role?.trim() ?? "";
  return {
    name: [fullName, role].filter(Boolean).join(" — ") || fullName,
    firm: d.identity?.firmName?.trim() || undefined,
    checkMin: d.check?.minCheck ?? 0,
    checkMax: d.check?.maxCheck ?? 0,
    stages: d.stages ?? [],
    sectors: d.sectors?.sectors ?? [],
    geographies: d.geo?.regions ?? [],
    isActive: true,
    thesis: buildThesis(d),
  };
}

function toDraftInput(d: InvestorUiDraft): DraftInvestorInput {
  const draft: DraftInvestorInput = {};
  if (d.identity?.fullName?.trim()) draft.name = d.identity.fullName.trim();
  if (d.identity?.firmName?.trim()) draft.firm = d.identity.firmName.trim();
  if (d.check?.minCheck != null) draft.checkMin = d.check.minCheck;
  if (d.check?.maxCheck != null) draft.checkMax = d.check.maxCheck;
  if (d.stages?.length) draft.stages = d.stages;
  if (d.sectors?.sectors?.length) draft.sectors = d.sectors.sectors;
  if (d.geo?.regions?.length) draft.geographies = d.geo.regions;
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
  profileState,
  depthView,
  ownVerifications = [],
  ownReferences = [],
  linkedInStatus,
}: {
  initial: InvestorUiDraft;
  accountLabel: AccountLabel;
  profileState: ProfileState;
  depthView?: InvestorDepthView | null;
  ownVerifications?: OwnVerification[];
  ownReferences?: OwnReference[];
  linkedInStatus?: LinkedInConnectionStatus;
}) {
  const router = useRouter();
  type Page = "basics" | "depth" | "verifications";
  const [page, setPage] = useState<Page>("basics");
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<InvestorUiDraft>(initial);
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

  // Build a lightweight investor row for the completion calculator.
  const completion = investorCompletion({
    id: "",
    user_id: "",
    name: draft.identity?.fullName || "",
    firm: draft.identity?.firmName || null,
    check_min: draft.check?.minCheck ?? 0,
    check_max: draft.check?.maxCheck ?? 0,
    stages: (draft.stages ?? []) as StartupStage[],
    sectors: draft.sectors?.sectors ?? [],
    geographies: draft.geo?.regions ?? [],
    is_active: true,
    thesis: buildThesis(draft) ?? null,
    created_at: "",
    updated_at: "",
  });

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
        patchIdentity({ fullName: linkedInStatus.profile.name });
      }
      router.refresh();
    }
    return result;
  }

  return (
    <main className="min-h-screen bg-[color:var(--color-bg)]">
      {/* LinkedIn Fill Modal */}
      {showLinkedInModal && linkedInStatus && (
        <LinkedInFillModal
          status={linkedInStatus}
          onApply={handleApplyLinkedIn}
          onClose={() => setShowLinkedInModal(false)}
          currentValues={{
            name: draft.identity?.fullName ?? "",
            picture: "",
            email: draft.identity?.workEmail ?? "",
          }}
        />
      )}

      {/* Header */}
      <header className="border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]">
        <div className="flex h-14 items-center justify-between px-6">
          <button
            type="button"
            onClick={() => {
              startSaving(async () => {
                const res = await switchRoleAction("founder");
                if (res.ok) window.location.href = "/build";
              });
            }}
            className="text-[12px] text-[color:var(--color-text-faint)] transition-colors hover:text-[color:var(--color-text-muted)]"
          >
            Switch to Founder
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
                  {/* Step heading */}
                  <h1
                    className="font-serif font-semibold leading-[1.08] tracking-tight text-[color:var(--color-text)]"
                    style={{ fontSize: "clamp(28px, 4vw, 38px)" }}
                  >
                    {t.title}
                  </h1>
                  <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[color:var(--color-text-muted)]">
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
                </motion.div>
              </AnimatePresence>

              {formError ? (
                <p role="alert" className="mt-5 text-[13px] text-[color:var(--color-danger)]">
                  {formError}
                </p>
              ) : null}

              {/* Navigation */}
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
                ) : null}
              </div>

              <p className="mt-8 text-center text-[11px] leading-5 text-[color:var(--color-text-faint)]">
                Informational only — not investment advice. You can refine your profile at any time.
              </p>
            </div>
          )}

          {page === "depth" && (
            <div className="mx-auto w-full max-w-[720px] px-6 py-12 md:py-16 space-y-10">
              {depthView && <InvestorDepthEditor depth={depthView} />}
              <div>
                <h2 className="text-[16px] font-semibold text-[color:var(--color-text)]">Media</h2>
                <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
                  Add a short intro video. Founders are more likely to engage with profiles that have one.
                </p>
                <div className="mt-5">
                  <VideoUploader
                    currentVideo={{ filename: draft.video.fileName, uploadedAt: draft.video.uploadedAt }}
                    onUploaded={(next) => setDraft((d) => ({ ...d, video: { fileName: next.filename, uploadedAt: next.uploadedAt } }))}
                  />
                </div>
              </div>
            </div>
          )}

          {page === "verifications" && (
            <div className="mx-auto w-full max-w-[720px] px-6 py-12 md:py-16">
              <VerificationPanel
                ownVerifications={ownVerifications}
                ownReferences={ownReferences}
              />
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
