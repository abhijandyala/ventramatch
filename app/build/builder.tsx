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
import { Loader2, ChevronDown, Check } from "lucide-react";
import { Wordmark } from "@/components/landing/wordmark";
import { FounderDepthEditor } from "@/components/profile/founder-depth-editor";
import { DeckUploader } from "@/components/profile/deck-uploader";
import { VerificationPanel, type OwnVerification, type OwnReference } from "@/components/profile/verification-panel";
import { founderCompletion, MIN_PUBLISH_PCT } from "@/lib/profile/completion";
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

const READ_ONLY_LABELS: AccountLabel[] = ["in_review"];

function isReadOnly(label: AccountLabel): boolean {
  return READ_ONLY_LABELS.includes(label);
}

// ──────────────────────────────────────────────────────────────────────────
//  UI draft shape
// ──────────────────────────────────────────────────────────────────────────

export type FounderUiDraft = {
  company: {
    name: string;
    website: string;
    description: string;
    city: string;
    foundedYear: number | null;
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
  company: { name: "", website: "", description: "", city: "", foundedYear: null },
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
//  Constants
// ──────────────────────────────────────────────────────────────────────────

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

type TabId = "basics" | "depth" | "verifications";

const TABS: { id: TabId; label: string }[] = [
  { id: "basics", label: "Basics" },
  { id: "depth", label: "Depth" },
  { id: "verifications", label: "Verifications" },
];

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
}: {
  initial: FounderUiDraft;
  accountLabel: AccountLabel;
  profileState: ProfileState;
  depthView?: StartupDepthView | null;
  ownVerifications?: OwnVerification[];
  ownReferences?: OwnReference[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("basics");
  const [draft, setDraft] = useState<FounderUiDraft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isPublishing, startPublishing] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const readOnly = isReadOnly(accountLabel);

  const completion = founderCompletion({
    id: "", user_id: "", name: draft.company.name, one_liner: draft.company.description,
    industry: draft.sectors[0] ?? "", stage: draft.stage ?? "idea",
    raise_amount: draft.round.targetRaise, traction: draft.traction.notableSignals || null,
    location: draft.company.city || null, deck_url: draft.deck.url || null,
    deck_storage_key: draft.deck.fileName ? "present" : null,
    deck_filename: draft.deck.fileName || null, deck_uploaded_at: null,
    website: draft.company.website || null, startup_sectors: draft.sectors,
    created_at: "", updated_at: "",
  });

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

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-6">
          <div className="flex items-center gap-5">
            <Wordmark size="md" />
            <span className="hidden h-5 w-px bg-[var(--color-border)] sm:block" />
            <span className="hidden text-[13px] font-medium text-[var(--color-text-muted)] sm:block">
              Build your profile
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
                patchCompany={patchCompany}
                patchRound={patchRound}
                patchTraction={patchTraction}
                patchDeck={patchDeck}
                patchFounder={patchFounder}
                setSectors={(s) => setDraft((d) => ({ ...d, sectors: s }))}
                setStage={(s) => setDraft((d) => ({ ...d, stage: s }))}
              />
            )}
            {activeTab === "depth" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-[22px] font-semibold tracking-tight text-[var(--color-text)]">
                    Add depth to your profile
                  </h2>
                  <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-text-muted)]">
                    Team, round mechanics, traction details, and market context. These aren't required to publish, but they climb your match score.
                  </p>
                </div>
                {depthView ? (
                  <FounderDepthEditor depth={depthView} />
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
                    Self-attested claims and references. Pure trust signal that investors look for.
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
//  Basics tab with collapsible sections
// ──────────────────────────────────────────────────────────────────────────

function BasicsTab({
  draft,
  errors,
  patchCompany,
  patchRound,
  patchTraction,
  patchDeck,
  patchFounder,
  setSectors,
  setStage,
}: {
  draft: FounderUiDraft;
  errors: Record<string, string>;
  patchCompany: (p: Partial<FounderUiDraft["company"]>) => void;
  patchRound: (p: Partial<FounderUiDraft["round"]>) => void;
  patchTraction: (p: Partial<FounderUiDraft["traction"]>) => void;
  patchDeck: (p: Partial<FounderUiDraft["deck"]>) => void;
  patchFounder: (p: Partial<FounderUiDraft["founder"]>) => void;
  setSectors: (s: string[]) => void;
  setStage: (s: StartupStage) => void;
}) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["company"]));

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
      id: "company",
      title: "Company",
      subtitle: "Name, website, and what you do",
      complete: Boolean(draft.company.name && draft.company.description),
      content: <CompanySection draft={draft} patch={patchCompany} errors={errors} />,
    },
    {
      id: "sector",
      title: "Sector",
      subtitle: "Up to 3 industries",
      complete: draft.sectors.length > 0,
      content: <SectorSection draft={draft} setSectors={setSectors} />,
    },
    {
      id: "stage",
      title: "Stage",
      subtitle: "Your current fundraising stage",
      complete: Boolean(draft.stage),
      content: <StageSection draft={draft} setStage={setStage} />,
    },
    {
      id: "round",
      title: "Round",
      subtitle: "How much you're raising",
      complete: Boolean(draft.round.targetRaise),
      content: <RoundSection draft={draft} patch={patchRound} errors={errors} />,
    },
    {
      id: "traction",
      title: "Traction",
      subtitle: "Revenue, customers, growth",
      complete: Boolean(draft.traction.mrr || draft.traction.customers || draft.traction.notableSignals),
      content: <TractionSection draft={draft} patch={patchTraction} />,
    },
    {
      id: "deck",
      title: "Pitch deck",
      subtitle: "Upload or link your deck",
      complete: Boolean(draft.deck.url || draft.deck.fileName),
      content: <DeckSection draft={draft} patch={patchDeck} errors={errors} />,
    },
    {
      id: "founder",
      title: "Founder",
      subtitle: "Your identity for verification",
      complete: Boolean(draft.founder.fullName && draft.founder.workEmail),
      content: <FounderSection draft={draft} patch={patchFounder} errors={errors} />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="mb-8">
        <h2 className="text-[22px] font-semibold tracking-tight text-[var(--color-text)]">
          The basics
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-text-muted)]">
          These details are required to publish your profile. Investors see this first.
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

function CompanySection({
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
    </div>
  );
}

function SectorSection({
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
      <p className="mb-4 text-[13px] text-[var(--color-text-muted)]">
        Select up to 3 sectors. The first one becomes your primary industry.
      </p>
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
                "rounded-full border px-4 py-2 text-[13px] font-medium transition-all duration-150",
                on
                  ? "border-[var(--color-brand)] bg-[var(--color-brand-tint)] text-[var(--color-brand-strong)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-text-faint)] hover:text-[var(--color-text)]",
                disabled ? "cursor-not-allowed opacity-40" : "",
              ].join(" ")}
            >
              {s}
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-[12px] text-[var(--color-text-faint)]">
        {draft.sectors.length} of 3 selected
      </p>
    </div>
  );
}

function StageSection({
  draft,
  setStage,
}: {
  draft: FounderUiDraft;
  setStage: (s: StartupStage) => void;
}) {
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

function RoundSection({
  draft,
  patch,
  errors,
}: {
  draft: FounderUiDraft;
  patch: (p: Partial<FounderUiDraft["round"]>) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="max-w-sm">
      <Field label="Target raise" required error={errors.raiseAmount}>
        <Input
          prefix="$"
          placeholder="500,000"
          value={draft.round.targetRaise?.toString() ?? ""}
          onChange={(v) => patch({ targetRaise: v ? Number(v.replace(/[^0-9]/g, "")) : null })}
        />
      </Field>
      <p className="mt-4 text-[12px] leading-relaxed text-[var(--color-text-faint)]">
        Round mechanics like valuation, instrument, and terms can be added in the Depth tab.
      </p>
    </div>
  );
}

function TractionSection({
  draft,
  patch,
}: {
  draft: FounderUiDraft;
  patch: (p: Partial<FounderUiDraft["traction"]>) => void;
}) {
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
        <Textarea placeholder="Pilots, design partners, enterprise interest, key hires." value={draft.traction.notableSignals} onChange={(v) => patch({ notableSignals: v })} />
      </Field>
    </div>
  );
}

function DeckSection({
  draft,
  patch,
  errors,
}: {
  draft: FounderUiDraft;
  patch: (p: Partial<FounderUiDraft["deck"]>) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-4">
      <DeckUploader
        currentDeck={{
          filename: draft.deck.fileName || null,
          uploadedAt: draft.deck.uploadedAt,
        }}
        urlValue={draft.deck.url}
        onUrlChange={(v) => patch({ url: v })}
        onUploaded={(next) => {
          patch({
            fileName: next.filename,
            uploadedAt: next.filename ? next.uploadedAt : null,
          });
        }}
      />
      {errors.deckUrl && (
        <p className="text-[12px] text-[var(--color-danger)]">{errors.deckUrl}</p>
      )}
      <p className="text-[12px] text-[var(--color-text-faint)]">
        Your deck stays private until mutual interest is established.
      </p>
    </div>
  );
}

function FounderSection({
  draft,
  patch,
  errors,
}: {
  draft: FounderUiDraft;
  patch: (p: Partial<FounderUiDraft["founder"]>) => void;
  errors: Record<string, string>;
}) {
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
      {errors[""] && (
        <p className="col-span-full text-[12px] text-[var(--color-danger)]">{errors[""]}</p>
      )}
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
  draft: FounderUiDraft;
  completion: { pct: number; missing: { id: string; label: string }[]; canPublish: boolean };
  formError: string | null;
  isPublishing: boolean;
  readOnly: boolean;
  onPublish: () => void;
}) {
  const { canPublish } = completion;

  return (
    <div className="overflow-hidden rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Preview */}
      <div className="p-6">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
          Preview
        </p>
        <p className="mt-3 text-[17px] font-semibold text-[var(--color-text)]">
          {draft.company.name || "Untitled startup"}
        </p>
        <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
          {draft.company.description || "No description yet"}
        </p>
        {(draft.sectors.length > 0 || draft.stage) && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {draft.sectors.map((s) => (
              <span key={s} className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-text-muted)]">
                {s}
              </span>
            ))}
            {draft.stage && (
              <span className="rounded-full bg-[var(--color-brand-tint)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-brand-strong)]">
                {STAGE_LABEL[draft.stage]}
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
          {canPublish ? "Publish profile" : `${MIN_PUBLISH_PCT - completion.pct}% more to publish`}
        </button>
        <p className="mt-3 text-center text-[11px] text-[var(--color-text-faint)]">
          Visible only to investors who match your filters.
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
