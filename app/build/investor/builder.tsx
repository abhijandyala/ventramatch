"use client";

import {
  useCallback,
  useState,
  useTransition,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2, ChevronDown, Check, X } from "lucide-react";
import { Wordmark } from "@/components/landing/wordmark";
import { InvestorDepthEditor } from "@/components/profile/investor-depth-editor";
import { VerificationPanel, type OwnVerification, type OwnReference } from "@/components/profile/verification-panel";
import type { StartupStage, AccountLabel, ProfileState } from "@/types/database";
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
//  UI draft shape
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
//  Mapping helpers
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

const TYPES: { key: InvestorType; label: string; note: string }[] = [
  { key: "angel",     label: "Solo angel",       note: "Personal capital, single-decision" },
  { key: "syndicate", label: "Syndicate lead",   note: "AngelList / Sweater style" },
  { key: "early",     label: "Early-stage VC",   note: "Pre-seed through Series A" },
  { key: "growth",    label: "Growth VC",        note: "Series B+ and later" },
  { key: "family",    label: "Family office",    note: "Multi-asset, longer horizon" },
  { key: "cvc",       label: "Corporate VC",     note: "Strategic + financial returns" },
];

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

type TabId = "basics" | "depth" | "verifications";

const TABS: { id: TabId; label: string }[] = [
  { id: "basics", label: "Basics" },
  { id: "depth", label: "Depth" },
  { id: "verifications", label: "Verifications" },
];

// ──────────────────────────────────────────────────────────────────────────
//  Main component
// ──────────────────────────────────────────────────────────────────────────

export function InvestorBuilder({
  initial,
  accountLabel,
  profileState,
  depthView,
  ownVerifications = [],
  ownReferences = [],
}: {
  initial: InvestorUiDraft;
  accountLabel: AccountLabel;
  profileState: ProfileState;
  depthView?: InvestorDepthView | null;
  ownVerifications?: OwnVerification[];
  ownReferences?: OwnReference[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("basics");
  const [draft, setDraft] = useState<InvestorUiDraft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isPublishing, startPublishing] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const readOnly = isReadOnly(accountLabel);

  // Minimal completion calculation for investors
  const completion = {
    pct: calculateInvestorCompletion(draft),
    canPublish: calculateInvestorCompletion(draft) >= 80,
    missing: getInvestorMissingFields(draft),
  };

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
      router.push("/dashboard?published=1");
      router.refresh();
    });
  }

  async function handleSaveAndExit() {
    await save();
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-6">
          <div className="flex items-center gap-5">
            <Wordmark size="md" />
            <span className="hidden h-5 w-px bg-[var(--color-border)] sm:block" />
            <span className="hidden text-[13px] font-medium text-[var(--color-text-muted)] sm:block">
              Build your investor profile
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => save()}
              disabled={isSaving || readOnly}
              className="inline-flex items-center gap-2 text-[13px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)] disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {readOnly ? "Read-only" : isSaving ? "Saving..." : savedAt ? `Saved ${savedAt}` : "Save draft"}
            </button>
            <button
              type="button"
              onClick={handleSaveAndExit}
              disabled={isSaving || readOnly}
              className="text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)] disabled:opacity-50"
            >
              Save & exit
            </button>
          </div>
        </div>
      </header>

      {/* Status banner */}
      <BuilderBanner accountLabel={accountLabel} />

      {/* Tab bar */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-[1120px] px-6">
          <nav className="flex gap-1" aria-label="Profile sections">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "relative px-5 py-4 text-[14px] font-medium transition-colors",
                    isActive
                      ? "text-[var(--color-text)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                  ].join(" ")}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--color-text)]" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <main className="mx-auto max-w-[1120px] px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          {/* Left column: Tab content */}
          <div className="min-w-0">
            {activeTab === "basics" && (
              <BasicsTab
                draft={draft}
                errors={errors}
                patchIdentity={patchIdentity}
                patchSectors={patchSectors}
                patchCheck={patchCheck}
                patchGeo={patchGeo}
                patchTrack={patchTrack}
                setType={(t) => setDraft((d) => ({ ...d, type: t }))}
                setStages={(s) => setDraft((d) => ({ ...d, stages: s }))}
              />
            )}
            {activeTab === "depth" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-[22px] font-semibold tracking-tight text-[var(--color-text)]">
                    Add depth to your profile
                  </h2>
                  <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-text-muted)]">
                    Portfolio, decision process, value-add, and anti-patterns. These aren't required to publish, but they help founders understand your style.
                  </p>
                </div>
                {depthView ? (
                  <InvestorDepthEditor depth={depthView} />
                ) : (
                  <div className="rounded-[12px] border border-dashed border-[var(--color-border)] p-8 text-center">
                    <p className="text-[14px] text-[var(--color-text-muted)]">
                      Complete the basics first to unlock depth fields.
                    </p>
                  </div>
                )}
              </div>
            )}
            {activeTab === "verifications" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-[22px] font-semibold tracking-tight text-[var(--color-text)]">
                    Verifications
                  </h2>
                  <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-text-muted)]">
                    Self-attested claims and references. Founders trust verified investors more.
                  </p>
                </div>
                <VerificationPanel
                  ownVerifications={ownVerifications}
                  ownReferences={ownReferences}
                />
              </div>
            )}
          </div>

          {/* Right column: Summary + Publish */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <SummaryCard
              draft={draft}
              completion={completion}
              formError={formError}
              isPublishing={isPublishing}
              readOnly={readOnly}
              onPublish={handlePublish}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Completion helpers
// ──────────────────────────────────────────────────────────────────────────

function calculateInvestorCompletion(draft: InvestorUiDraft): number {
  let score = 0;
  const total = 100;
  
  if (draft.identity.fullName.trim()) score += 15;
  if (draft.identity.workEmail.trim()) score += 10;
  if (draft.type) score += 10;
  if (draft.sectors.sectors.length > 0) score += 15;
  if (draft.stages.length > 0) score += 15;
  if (draft.check.minCheck && draft.check.maxCheck) score += 20;
  if (draft.geo.regions.length > 0) score += 10;
  if (draft.identity.firmName || draft.identity.role) score += 5;
  
  return Math.min(score, total);
}

function getInvestorMissingFields(draft: InvestorUiDraft): { id: string; label: string }[] {
  const missing: { id: string; label: string }[] = [];
  
  if (!draft.identity.fullName.trim()) missing.push({ id: "name", label: "Add your name" });
  if (!draft.identity.workEmail.trim()) missing.push({ id: "email", label: "Add work email" });
  if (!draft.type) missing.push({ id: "type", label: "Select investor type" });
  if (draft.sectors.sectors.length === 0) missing.push({ id: "sectors", label: "Select sectors" });
  if (draft.stages.length === 0) missing.push({ id: "stages", label: "Select stages" });
  if (!draft.check.minCheck || !draft.check.maxCheck) missing.push({ id: "check", label: "Set check size" });
  if (draft.geo.regions.length === 0) missing.push({ id: "geo", label: "Select regions" });
  
  return missing;
}

// ──────────────────────────────────────────────────────────────────────────
//  Basics tab with collapsible sections
// ──────────────────────────────────────────────────────────────────────────

function BasicsTab({
  draft,
  errors,
  patchIdentity,
  patchSectors,
  patchCheck,
  patchGeo,
  patchTrack,
  setType,
  setStages,
}: {
  draft: InvestorUiDraft;
  errors: Record<string, string>;
  patchIdentity: (p: Partial<InvestorUiDraft["identity"]>) => void;
  patchSectors: (p: Partial<InvestorUiDraft["sectors"]>) => void;
  patchCheck: (p: Partial<InvestorUiDraft["check"]>) => void;
  patchGeo: (p: Partial<InvestorUiDraft["geo"]>) => void;
  patchTrack: (p: Partial<InvestorUiDraft["track"]>) => void;
  setType: (t: InvestorType) => void;
  setStages: (s: StartupStage[]) => void;
}) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["identity"]));

  function toggle(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const sections = [
    {
      id: "identity",
      title: "Identity",
      subtitle: "Name, role, and firm",
      complete: Boolean(draft.identity.fullName && draft.identity.workEmail),
      content: <IdentitySection draft={draft} patch={patchIdentity} errors={errors} />,
    },
    {
      id: "type",
      title: "Investor type",
      subtitle: "What kind of investor are you?",
      complete: Boolean(draft.type),
      content: <TypeSection draft={draft} setType={setType} />,
    },
    {
      id: "sectors",
      title: "Sectors & thesis",
      subtitle: "What you invest in",
      complete: draft.sectors.sectors.length > 0,
      content: <SectorsSection draft={draft} patch={patchSectors} />,
    },
    {
      id: "stages",
      title: "Stages",
      subtitle: "What stages you back",
      complete: draft.stages.length > 0,
      content: <StagesSection draft={draft} setStages={setStages} />,
    },
    {
      id: "check",
      title: "Check size",
      subtitle: "Your investment range",
      complete: Boolean(draft.check.minCheck && draft.check.maxCheck),
      content: <CheckSection draft={draft} patch={patchCheck} errors={errors} />,
    },
    {
      id: "geo",
      title: "Geography",
      subtitle: "Where you invest",
      complete: draft.geo.regions.length > 0,
      content: <GeoSection draft={draft} patch={patchGeo} />,
    },
    {
      id: "track",
      title: "Track record",
      subtitle: "Your investment history",
      complete: Boolean(draft.track.totalChecks || draft.track.recent.length > 0),
      content: <TrackSection draft={draft} patch={patchTrack} />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="mb-8">
        <h2 className="text-[22px] font-semibold tracking-tight text-[var(--color-text)]">
          The basics
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-text-muted)]">
          These details are required to publish your profile. Founders see this first.
        </p>
      </div>

      {sections.map((section) => (
        <CollapsibleSection
          key={section.id}
          id={section.id}
          title={section.title}
          subtitle={section.subtitle}
          complete={section.complete}
          isOpen={openSections.has(section.id)}
          onToggle={() => toggle(section.id)}
        >
          {section.content}
        </CollapsibleSection>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Collapsible section with animation
// ──────────────────────────────────────────────────────────────────────────

function CollapsibleSection({
  id,
  title,
  subtitle,
  complete,
  isOpen,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  complete: boolean;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [children]);

  return (
    <div className="overflow-hidden rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-[var(--color-surface-2)]"
        aria-expanded={isOpen}
        aria-controls={`section-${id}`}
      >
        <div className="flex items-center gap-4">
          <span
            className={[
              "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
              complete
                ? "bg-[var(--color-brand-tint)] text-[var(--color-brand-strong)]"
                : "bg-[var(--color-surface-2)] text-[var(--color-text-faint)]",
            ].join(" ")}
          >
            {complete ? <Check size={12} strokeWidth={2.5} /> : null}
          </span>
          <div>
            <p className="text-[15px] font-semibold text-[var(--color-text)]">{title}</p>
            <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">{subtitle}</p>
          </div>
        </div>
        <ChevronDown
          size={18}
          strokeWidth={2}
          className={[
            "shrink-0 text-[var(--color-text-faint)] transition-transform duration-200",
            isOpen ? "rotate-180" : "",
          ].join(" ")}
          style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </button>

      <div
        id={`section-${id}`}
        style={{
          height: isOpen ? height : 0,
          opacity: isOpen ? 1 : 0,
          transition: "height 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div ref={contentRef} className="border-t border-[var(--color-border)] px-6 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Section contents
// ──────────────────────────────────────────────────────────────────────────

function IdentitySection({
  draft,
  patch,
  errors,
}: {
  draft: InvestorUiDraft;
  patch: (p: Partial<InvestorUiDraft["identity"]>) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Field label="Full name" required error={errors.name}>
        <Input value={draft.identity.fullName} onChange={(v) => patch({ fullName: v })} placeholder="Your name" />
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
        <Input value={draft.identity.foundedYear?.toString() ?? ""} onChange={(v) => patch({ foundedYear: v ? Number(v) : null })} placeholder="YYYY" />
      </Field>
    </div>
  );
}

function TypeSection({
  draft,
  setType,
}: {
  draft: InvestorUiDraft;
  setType: (t: InvestorType) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {TYPES.map((t) => {
        const on = draft.type === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(t.key)}
            className={[
              "flex flex-col items-start rounded-[12px] border p-4 text-left transition-all duration-150",
              on
                ? "border-[var(--color-brand)] bg-[var(--color-brand-tint)] ring-1 ring-[var(--color-brand)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-text-faint)]",
            ].join(" ")}
          >
            <span className={["text-[14px] font-semibold", on ? "text-[var(--color-brand-strong)]" : "text-[var(--color-text)]"].join(" ")}>
              {t.label}
            </span>
            <span className="mt-1 text-[12px] text-[var(--color-text-muted)]">
              {t.note}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SectorsSection({
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
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-[13px] text-[var(--color-text-muted)]">
          Select all sectors you actively invest in.
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
                  "rounded-full border px-4 py-2 text-[13px] font-medium transition-all duration-150",
                  on
                    ? "border-[var(--color-brand)] bg-[var(--color-brand-tint)] text-[var(--color-brand-strong)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-text-faint)] hover:text-[var(--color-text)]",
                ].join(" ")}
              >
                {s}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[12px] text-[var(--color-text-faint)]">
          {draft.sectors.sectors.length} selected
        </p>
      </div>
      <Field label="Investment thesis (public)">
        <Textarea placeholder="One paragraph on what you back and why founders should care." value={draft.sectors.thesis} onChange={(v) => patch({ thesis: v })} />
      </Field>
      <Field label="Anti-thesis (private)">
        <Input placeholder='e.g. "No consumer social, no crypto-only plays"' value={draft.sectors.antiThesis} onChange={(v) => patch({ antiThesis: v })} />
      </Field>
    </div>
  );
}

function StagesSection({
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
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {STAGES_WITH_NOTES.map((s) => {
        const on = selected.has(s.key);
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => toggle(s.key)}
            className={[
              "flex flex-col items-start rounded-[12px] border p-4 text-left transition-all duration-150",
              on
                ? "border-[var(--color-brand)] bg-[var(--color-brand-tint)] ring-1 ring-[var(--color-brand)]"
                : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-text-faint)]",
            ].join(" ")}
          >
            <span className={["text-[14px] font-semibold", on ? "text-[var(--color-brand-strong)]" : "text-[var(--color-text)]"].join(" ")}>
              {s.label}
            </span>
            <span className="mt-1 font-mono text-[11px] text-[var(--color-text-muted)]">
              {s.note}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CheckSection({
  draft,
  patch,
  errors,
}: {
  draft: InvestorUiDraft;
  patch: (p: Partial<InvestorUiDraft["check"]>) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Field label="Min check" required error={errors.checkMin}>
          <Input prefix="$" value={draft.check.minCheck?.toString() ?? ""} onChange={(v) => patch({ minCheck: v ? Number(v.replace(/[^0-9]/g, "")) : null })} placeholder="25,000" />
        </Field>
        <Field label="Sweet spot">
          <Input prefix="$" value={draft.check.sweetSpot?.toString() ?? ""} onChange={(v) => patch({ sweetSpot: v ? Number(v.replace(/[^0-9]/g, "")) : null })} placeholder="100,000" />
        </Field>
        <Field label="Max check" required error={errors.checkMax}>
          <Input prefix="$" value={draft.check.maxCheck?.toString() ?? ""} onChange={(v) => patch({ maxCheck: v ? Number(v.replace(/[^0-9]/g, "")) : null })} placeholder="250,000" />
        </Field>
      </div>
      <Field label="Position preference">
        <div className="flex flex-wrap gap-2">
          {POSITIONS.map((opt) => {
            const on = draft.check.position === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => patch({ position: opt.key })}
                className={[
                  "rounded-full border px-4 py-2 text-[13px] font-medium transition-all duration-150",
                  on
                    ? "border-[var(--color-text)] bg-[var(--color-text)] text-white"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-text-faint)]",
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
          <Input value={draft.check.annualCapacity?.toString() ?? ""} onChange={(v) => patch({ annualCapacity: v ? Number(v) : null })} placeholder="10" />
        </Field>
        <Field label="Max valuation cap">
          <Input prefix="$" value={draft.check.maxValuation?.toString() ?? ""} onChange={(v) => patch({ maxValuation: v ? Number(v.replace(/[^0-9]/g, "")) : null })} placeholder="20,000,000" />
        </Field>
      </div>
    </div>
  );
}

function GeoSection({
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
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-[13px] text-[var(--color-text-muted)]">
          Select the markets you invest in.
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
                  "rounded-full border px-4 py-2 text-[13px] font-medium transition-all duration-150",
                  on
                    ? "border-[var(--color-brand)] bg-[var(--color-brand-tint)] text-[var(--color-brand-strong)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-text-faint)]",
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
                  "rounded-full border px-4 py-2 text-[13px] font-medium transition-all duration-150",
                  on
                    ? "border-[var(--color-text)] bg-[var(--color-text)] text-white"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-text-faint)]",
                ].join(" ")}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Office hours / availability">
        <Input placeholder="e.g. NYC Wed/Thu, SF first week of every month" value={draft.geo.officeHours} onChange={(v) => patch({ officeHours: v })} />
      </Field>
    </div>
  );
}

function TrackSection({
  draft,
  patch,
}: {
  draft: InvestorUiDraft;
  patch: (p: Partial<InvestorUiDraft["track"]>) => void;
}) {
  function addRow() {
    patch({
      recent: [...draft.track.recent, { company: "", round: "", year: null, checkSize: "" }],
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Field label="Total checks written">
          <Input value={draft.track.totalChecks?.toString() ?? ""} onChange={(v) => patch({ totalChecks: v ? Number(v) : null })} placeholder="50" />
        </Field>
        <Field label="Years investing">
          <Input value={draft.track.yearsInvesting?.toString() ?? ""} onChange={(v) => patch({ yearsInvesting: v ? Number(v) : null })} placeholder="5" />
        </Field>
        <Field label="Checks last 12 months">
          <Input value={draft.track.checksLast12mo?.toString() ?? ""} onChange={(v) => patch({ checksLast12mo: v ? Number(v) : null })} placeholder="8" />
        </Field>
      </div>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[13px] font-medium text-[var(--color-text)]">
            Recent investments (public)
          </p>
          <button type="button" onClick={addRow} className="text-[13px] font-medium text-[var(--color-brand)] hover:underline">
            + Add investment
          </button>
        </div>
        <div className="space-y-2">
          {draft.track.recent.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-[var(--color-border)] p-6 text-center">
              <p className="text-[13px] text-[var(--color-text-muted)]">
                No investments added yet. Click "+ Add investment" to add one.
              </p>
            </div>
          ) : (
            draft.track.recent.map((r, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                <Input placeholder="Company" value={r.company} onChange={(v) => updateRow(i, { company: v })} />
                <Input placeholder="Round" value={r.round ?? ""} onChange={(v) => updateRow(i, { round: v })} />
                <Input placeholder="Year" value={r.year?.toString() ?? ""} onChange={(v) => updateRow(i, { year: v ? Number(v) : null })} />
                <Input placeholder="$1M" value={r.checkSize ?? ""} onChange={(v) => updateRow(i, { checkSize: v })} />
                <button type="button" onClick={() => removeRow(i)} className="flex h-11 w-11 items-center justify-center rounded-[8px] text-[var(--color-text-faint)] transition-colors hover:bg-[var(--color-bg)] hover:text-[var(--color-danger)]" aria-label="Remove">
                  <X size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Summary card
// ──────────────────────────────────────────────────────────────────────────

function SummaryCard({
  draft,
  completion,
  formError,
  isPublishing,
  readOnly,
  onPublish,
}: {
  draft: InvestorUiDraft;
  completion: { pct: number; canPublish: boolean; missing: { id: string; label: string }[] };
  formError: string | null;
  isPublishing: boolean;
  readOnly: boolean;
  onPublish: () => void;
}) {
  const { canPublish } = completion;
  const typeLabel = TYPES.find((t) => t.key === draft.type)?.label ?? "";

  return (
    <div className="overflow-hidden rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Preview */}
      <div className="p-6">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
          Preview
        </p>
        <p className="mt-3 text-[17px] font-semibold text-[var(--color-text)]">
          {draft.identity.fullName || "Untitled investor"}
        </p>
        <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
          {[draft.identity.role, draft.identity.firmName].filter(Boolean).join(" · ") || "No role or firm"}
        </p>
        {(draft.sectors.sectors.length > 0 || typeLabel) && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {typeLabel && (
              <span className="rounded-full bg-[var(--color-brand-tint)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-brand-strong)]">
                {typeLabel}
              </span>
            )}
            {draft.sectors.sectors.slice(0, 3).map((s) => (
              <span key={s} className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-text-muted)]">
                {s}
              </span>
            ))}
            {draft.sectors.sectors.length > 3 && (
              <span className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-text-faint)]">
                +{draft.sectors.sectors.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Completion */}
      <div className="border-t border-[var(--color-border)] px-6 py-5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-[var(--color-text)]">Profile completion</span>
          <span className="font-mono text-[13px] font-semibold tabular-nums text-[var(--color-text)]">
            {completion.pct}%
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
          <div
            className="h-full rounded-full bg-[var(--color-brand)] transition-all duration-300"
            style={{ width: `${completion.pct}%`, transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
          />
        </div>
        {completion.missing.length > 0 && (
          <p className="mt-3 text-[12px] text-[var(--color-text-faint)]">
            Missing: {completion.missing.slice(0, 3).map((m) => m.label).join(", ")}
            {completion.missing.length > 3 && ` +${completion.missing.length - 3} more`}
          </p>
        )}
      </div>

      {/* Publish */}
      <div className="border-t border-[var(--color-border)] px-6 py-5">
        {formError && (
          <p className="mb-4 text-[12px] text-[var(--color-danger)]">{formError}</p>
        )}
        <button
          type="button"
          onClick={onPublish}
          disabled={!canPublish || isPublishing || readOnly}
          className={[
            "inline-flex w-full items-center justify-center gap-2 rounded-[10px] px-5 py-3 text-[14px] font-semibold transition-all duration-150",
            canPublish
              ? "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-strong)]"
              : "cursor-not-allowed bg-[var(--color-surface-2)] text-[var(--color-text-faint)]",
          ].join(" ")}
        >
          {isPublishing && <Loader2 className="h-4 w-4 animate-spin" />}
          {canPublish ? "Publish profile" : `${80 - completion.pct}% more to publish`}
        </button>
        <p className="mt-3 text-center text-[11px] text-[var(--color-text-faint)]">
          Visible only to founders who match your filters.
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Status banner
// ──────────────────────────────────────────────────────────────────────────

function BuilderBanner({ accountLabel }: { accountLabel: AccountLabel }) {
  if (accountLabel === "verified" || accountLabel === "unverified") return null;

  const config: Record<
    Exclude<AccountLabel, "verified" | "unverified">,
    { title: string; body: string; tone: "info" | "warning" | "danger" }
  > = {
    in_review: {
      title: "In review",
      body: "Your profile is being reviewed. Editing is locked until complete.",
      tone: "info",
    },
    rejected: {
      title: "Resubmission needed",
      body: "Your profile was returned. Edit and submit again.",
      tone: "warning",
    },
    banned: {
      title: "Account suspended",
      body: "Contact support if you believe this is a mistake.",
      tone: "danger",
    },
  };

  const c = config[accountLabel];
  const borderColor =
    c.tone === "danger" ? "var(--color-danger)"
      : c.tone === "warning" ? "#d97706"
      : "var(--color-brand)";

  return (
    <div
      className="border-b px-6 py-3"
      style={{
        background: "var(--color-surface)",
        borderTop: `2px solid ${borderColor}`,
        borderBottomColor: "var(--color-border)",
      }}
    >
      <div className="mx-auto flex max-w-[1120px] items-center gap-3">
        <span className="text-[13px] font-semibold" style={{ color: borderColor }}>
          {c.title}
        </span>
        <span className="text-[13px] text-[var(--color-text-muted)]">{c.body}</span>
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
      <span className="mb-2 flex items-center gap-1 text-[13px] font-medium text-[var(--color-text)]">
        {label}
        {required && <span className="text-[var(--color-brand)]">*</span>}
      </span>
      {children}
      {error && <span className="mt-1.5 block text-[12px] text-[var(--color-danger)]">{error}</span>}
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
    <div className="flex h-11 items-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 transition-all duration-150 focus-within:border-[var(--color-text)] focus-within:ring-1 focus-within:ring-[var(--color-text)]/20">
      {prefix && <span className="mr-2 font-mono text-[13px] text-[var(--color-text-faint)]">{prefix}</span>}
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full w-full bg-transparent text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:outline-none"
      />
      {suffix && <span className="ml-2 font-mono text-[13px] text-[var(--color-text-faint)]">{suffix}</span>}
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
      className="block w-full resize-none rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[14px] leading-relaxed text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] transition-all duration-150 focus:border-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-text)]/20"
    />
  );
}
