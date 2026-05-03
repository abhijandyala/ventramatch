"use client";

import { useEffect, useState } from "react";
import { X, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  InvestorRecommendation,
  RecommendationProfile,
  StartupRecommendation,
} from "@/lib/recommendations/types";

function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function ModalLogo({ name }: { name: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const localLogo = `/mock-assets/${slugify(name)}/logo.png`;
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={localLogo} alt={name} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span className="text-[18px] font-semibold text-[var(--color-text-faint)]">{initials}</span>
      )}
    </div>
  );
}

type Props = {
  profile: RecommendationProfile;
  onClose: () => void;
  saved?: boolean;
  onToggleSave?: (profileId: string) => void;
};

const STAGE_LABEL: Record<string, string> = {
  idea: "Idea",
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  series_b_plus: "Series B+",
};

export function RecommendationProfileModal({ profile, onClose, saved = false, onToggleSave }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`${profile.name} preview`}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-[820px] flex-col overflow-hidden border border-[color:var(--color-border)] bg-white">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--color-text-muted)] transition-colors duration-150 hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-text)]"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <div className="flex-1 overflow-y-auto">
          {profile.kind === "startup" ? (
            <StartupBody profile={profile} />
          ) : (
            <InvestorBody profile={profile} />
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-7 py-4">
          <p className="text-[12px] text-[color:var(--color-text-faint)]">
            {profile.websitePlaceholder}
          </p>
          {onToggleSave && (
            <button
              type="button"
              onClick={() => onToggleSave(profile.id)}
              className={cn(
                "inline-flex h-9 items-center gap-2 px-4 text-[13px] font-medium transition-colors duration-150",
                saved
                  ? "bg-[color:var(--color-brand)] text-white hover:bg-[color:var(--color-brand-ink)]"
                  : "border border-[color:var(--color-border)] bg-white text-[color:var(--color-text)] hover:border-[color:var(--color-text-faint)]",
              )}
            >
              <Bookmark className="h-3.5 w-3.5" strokeWidth={1.75} fill={saved ? "currentColor" : "none"} />
              {saved ? "Saved" : "I\u2019m interested"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Startup body — 9 tabs matching the profile builder
// ─────────────────────────────────────────────────────────────────────────────

const STARTUP_TABS = [
  "Overview",
  "Team",
  "Problem & Solution",
  "Market",
  "Business & GTM",
  "Traction",
  "Fundraise",
  "Risks",
  "Media",
] as const;
type StartupTab = (typeof STARTUP_TABS)[number];

function StartupBody({ profile }: { profile: StartupRecommendation }) {
  const [tab, setTab] = useState<StartupTab>("Overview");

  const founder = profile.founder ?? (profile.teamMembers?.[0]
    ? { fullName: profile.teamMembers[0].name, role: profile.teamMembers[0].role, linkedinUrl: profile.teamMembers[0].linkedinUrl }
    : undefined);

  return (
    <div>
      <div className="px-7 pt-7">
        <header className="flex items-start gap-4">
          <ModalLogo name={profile.name} />
          <div className="flex flex-1 flex-col gap-2">
            <h2 className="font-serif text-[26px] font-semibold leading-tight text-[color:var(--color-text-strong)]">
              {profile.name}
            </h2>
            <p className="text-[15px] leading-snug text-[color:var(--color-text-muted)]">
              {profile.tagline}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Chip>{profile.sector}</Chip>
              <Chip>{STAGE_LABEL[profile.stage] ?? profile.stage}</Chip>
              <Chip>{profile.location}</Chip>
              <Chip>Founded {profile.foundingYear}</Chip>
              {profile.productStatus && <Chip>{prettyEnum(profile.productStatus)}</Chip>}
              <Chip>{prettyEnum(profile.customerType)}</Chip>
            </div>
            {/* Quick links */}
            <div className="flex flex-wrap gap-3 mt-1">
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-[12px] font-medium text-[color:var(--color-brand)] underline underline-offset-4">{profile.websitePlaceholder}</a>
              )}
              {founder?.linkedinUrl && (
                <a href={founder.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] font-medium text-[color:var(--color-brand)] underline underline-offset-4">Founder LinkedIn</a>
              )}
            </div>
          </div>
        </header>
      </div>

      <TabBar tabs={STARTUP_TABS} active={tab} onChange={setTab} />

      <div className="px-7 pb-7">
        {tab === "Overview" && <TabOverview profile={profile} founder={founder} />}
        {tab === "Team" && <TabTeam profile={profile} />}
        {tab === "Problem & Solution" && <TabProblemSolution profile={profile} />}
        {tab === "Market" && <TabMarket profile={profile} />}
        {tab === "Business & GTM" && <TabBusinessGtm profile={profile} />}
        {tab === "Traction" && <TabTraction profile={profile} />}
        {tab === "Fundraise" && <TabFundraise profile={profile} />}
        {tab === "Risks" && <TabRisks profile={profile} />}
        {tab === "Media" && <TabMedia profile={profile} />}
      </div>
    </div>
  );
}

// ── Tab: Overview ──

function TabOverview({ profile, founder }: { profile: StartupRecommendation; founder?: { fullName: string; role: string } }) {
  return (
    <div className="flex flex-col gap-6">
      <Section title="About">
        <p className="text-[14px] leading-relaxed text-[color:var(--color-text)]">{profile.description}</p>
      </Section>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <KeyValue label="Sector" value={profile.sector} />
        <KeyValue label="Stage" value={STAGE_LABEL[profile.stage] ?? profile.stage} />
        <KeyValue label="Location" value={profile.location} />
        <KeyValue label="Founded" value={String(profile.foundingYear)} />
        <KeyValue label="Customer type" value={prettyEnum(profile.customerType)} />
        {profile.productStatus && <KeyValue label="Product status" value={prettyEnum(profile.productStatus)} />}
        {founder && <KeyValue label="Founder" value={`${founder.fullName}, ${founder.role}`} />}
      </div>
      {profile.tags.length > 0 && (
        <Section title="Tags">
          <div className="flex flex-wrap gap-1.5">{profile.tags.map((t) => <Chip key={t}>{t}</Chip>)}</div>
        </Section>
      )}
    </div>
  );
}

// ── Tab: Team ──

function TabTeam({ profile }: { profile: StartupRecommendation }) {
  return (
    <div className="flex flex-col gap-6">
      <Section title="Team summary">
        <p className="text-[14px] leading-relaxed text-[color:var(--color-text)]">{profile.founderSummary}</p>
      </Section>

      {profile.teamMembers && profile.teamMembers.length > 0 && (
        <Section title="Key people">
          <div className="flex flex-col gap-0">
            {profile.teamMembers.map((m) => (
              <div key={m.name} className="flex items-start gap-4 border-b border-[color:var(--color-border)] py-4 last:border-0 last:pb-0 first:pt-0">
                {/* Photo placeholder */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[10px] text-[color:var(--color-text-faint)]">
                  {m.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photoUrl} alt={m.name} className="h-full w-full object-cover" />
                  ) : (
                    m.name.split(" ").map(w => w[0]).join("").slice(0, 2)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[14px] font-semibold text-[color:var(--color-text)]">{m.name}</span>
                    <span className="text-[12px] text-[color:var(--color-text-faint)]">{m.role}</span>
                  </div>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-[color:var(--color-text-muted)]">{m.background}</p>
                  {m.linkedinUrl ? (
                    <a href={m.linkedinUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[12px] font-medium text-[color:var(--color-brand)] underline underline-offset-4">LinkedIn</a>
                  ) : (
                    <span className="mt-1 inline-block text-[11px] text-[color:var(--color-text-faint)]">LinkedIn not connected</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {profile.advisors && profile.advisors.length > 0 && (
        <Section title="Advisors">
          <BulletList items={profile.advisors} />
        </Section>
      )}

      {profile.keyHiresNeeded && (
        <Section title="Key hires needed">
          <p className="text-[14px] leading-relaxed text-[color:var(--color-text)]">{profile.keyHiresNeeded}</p>
        </Section>
      )}
    </div>
  );
}

// ── Tab: Problem & Solution ──

function TabProblemSolution({ profile }: { profile: StartupRecommendation }) {
  return (
    <div className="flex flex-col gap-6">
      <FieldOrEmpty label="Problem statement" value={profile.problemStatement} />
      <FieldOrEmpty label="Target customer" value={profile.targetCustomer} />
      <FieldOrEmpty label="Current alternatives" value={profile.currentAlternatives} />
      <FieldOrEmpty label="Why alternatives fail" value={profile.whyAlternativesFail} />
      <Divider />
      <Section title="Product">
        <p className="text-[14px] leading-relaxed text-[color:var(--color-text)]">{profile.product}</p>
      </Section>
      <FieldOrEmpty label="Key features" value={profile.keyFeatures} />
      <FieldOrEmpty label="Technical moat" value={profile.technicalMoat} />
      <FieldOrEmpty label="Roadmap" value={profile.roadmap} />
    </div>
  );
}

// ── Tab: Market ──

function TabMarket({ profile }: { profile: StartupRecommendation }) {
  return (
    <div className="flex flex-col gap-6">
      <FieldOrEmpty label="Target market" value={profile.targetMarket} />
      <FieldOrEmpty label="Market size" value={profile.marketSize} />
      <FieldOrEmpty label="Market trend" value={profile.marketTrend} />
      <FieldOrEmpty label="Beachhead market" value={profile.beachheadMarket} />
      <FieldOrEmpty label="Why now" value={profile.whyNow} />
      <Divider />
      {profile.competitors && profile.competitors.length > 0 && (
        <Section title="Competitors">
          <BulletList items={profile.competitors} />
        </Section>
      )}
      <FieldOrEmpty label="Differentiation" value={profile.differentiation} />
      <FieldOrEmpty label="Why we win" value={profile.whyWeWin} />
      <FieldOrEmpty label="Defensibility" value={profile.defensibility} />
    </div>
  );
}

// ── Tab: Business & GTM ──

function TabBusinessGtm({ profile }: { profile: StartupRecommendation }) {
  return (
    <div className="flex flex-col gap-6">
      <FieldOrEmpty label="Business model" value={profile.businessModel} />
      <FieldOrEmpty label="Revenue model" value={profile.revenueModel} />
      <FieldOrEmpty label="Pricing" value={profile.pricing} />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {profile.grossMargin && <KeyValue label="Gross margin" value={profile.grossMargin} />}
        {profile.salesCycle && <KeyValue label="Sales cycle" value={profile.salesCycle} />}
      </div>
      <Divider />
      <FieldOrEmpty label="Go-to-market strategy" value={profile.gtmStrategy} />
      <FieldOrEmpty label="Planned GTM" value={profile.plannedGtm} />
      {profile.acquisitionChannels && profile.acquisitionChannels.length > 0 && (
        <Section title="Acquisition channels">
          <BulletList items={profile.acquisitionChannels} />
        </Section>
      )}
    </div>
  );
}

// ── Tab: Traction ──

function TabTraction({ profile }: { profile: StartupRecommendation }) {
  return (
    <div className="flex flex-col gap-6">
      <Section title="Traction summary">
        <p className="text-[14px] leading-relaxed text-[color:var(--color-text)]">{profile.traction}</p>
      </Section>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {profile.mrr && <KeyValue label="MRR" value={profile.mrr} />}
        {profile.customers && <KeyValue label="Customers" value={profile.customers} />}
        {profile.growthPct && <KeyValue label="Growth" value={profile.growthPct} />}
      </div>
      <FieldOrEmpty label="Notable signals" value={profile.notableSignals} />
      <Divider />
      <FieldOrEmpty label="Notable customers" value={profile.notableCustomers} />
      <FieldOrEmpty label="Customer proof" value={profile.customerProof} />
      <FieldOrEmpty label="Retention & engagement" value={profile.retentionEngagement} />
    </div>
  );
}

// ── Tab: Fundraise ──

function TabFundraise({ profile }: { profile: StartupRecommendation }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <KeyValue label="Funding ask" value={profile.fundingAsk} />
        {profile.instrument && <KeyValue label="Instrument" value={profile.instrument} />}
        {profile.valuationCap && <KeyValue label="Valuation cap" value={profile.valuationCap} />}
        {profile.minCheckSize && <KeyValue label="Min check size" value={profile.minCheckSize} />}
      </div>

      <Section title="Use of funds">
        <p className="text-[14px] leading-relaxed text-[color:var(--color-text)]">{profile.useOfFunds}</p>
      </Section>

      {profile.milestonesAfterRaise && profile.milestonesAfterRaise.length > 0 && (
        <Section title="Milestones after raise">
          <BulletList items={profile.milestonesAfterRaise} />
        </Section>
      )}

      {profile.capTable && (
        <>
          <Divider />
          <Section title="Cap table summary">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {profile.capTable.totalRaised && <KeyValue label="Total raised" value={profile.capTable.totalRaised} />}
              {profile.capTable.founderEquity && <KeyValue label="Founder equity" value={profile.capTable.founderEquity} />}
              {profile.capTable.optionPool && <KeyValue label="Option pool" value={profile.capTable.optionPool} />}
            </div>
          </Section>
        </>
      )}

      <Section title="Ideal investor">
        <p className="text-[14px] leading-relaxed text-[color:var(--color-text)]">{profile.idealInvestor}</p>
      </Section>
    </div>
  );
}

// ── Tab: Risks ──

function TabRisks({ profile }: { profile: StartupRecommendation }) {
  const hasContent = profile.risks?.length || profile.biggestUnknown || profile.failureScenario;
  if (!hasContent) {
    return <EmptyTab message="No risk information provided yet." />;
  }
  return (
    <div className="flex flex-col gap-6">
      {profile.risks && profile.risks.length > 0 && (
        <Section title="Key risks">
          <BulletList items={profile.risks} />
        </Section>
      )}
      <FieldOrEmpty label="Biggest unknown" value={profile.biggestUnknown} />
      <FieldOrEmpty label="Failure scenario" value={profile.failureScenario} />
    </div>
  );
}

// ── Tab: Media ──

function TabMedia({ profile }: { profile: StartupRecommendation }) {
  const hasDeck = !!profile.pitchDeckUrl;
  const hasVideo = !!profile.videoUrl;
  const hasPhotos = profile.photos && profile.photos.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <Section title="Pitch deck">
        {hasDeck ? (
          <a href={profile.pitchDeckUrl!} target="_blank" rel="noopener noreferrer" className="text-[14px] font-medium underline underline-offset-4 text-[color:var(--color-brand)]">View pitch deck</a>
        ) : (
          <MediaPlaceholder label="Pitch deck" hint="No pitch deck uploaded yet" />
        )}
      </Section>

      <Section title="Video">
        {hasVideo ? (
          <a href={profile.videoUrl!} target="_blank" rel="noopener noreferrer" className="text-[14px] font-medium underline underline-offset-4 text-[color:var(--color-brand)]">Watch video</a>
        ) : (
          <MediaPlaceholder label="Video" hint="No video uploaded yet" />
        )}
      </Section>

      <Section title="Product photos">
        {hasPhotos ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {profile.photos!.map((url, i) => (
              <div key={url} className="aspect-[4/3] overflow-hidden border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`${profile.name} photo ${i + 1}`} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <MediaPlaceholder key={n} label={`Photo ${n}`} hint="No photo" aspect="4/3" />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Investor body — tabbed
// ─────────────────────────────────────────────────────────────────────────────

const INVESTOR_TABS = ["Overview", "Portfolio", "Criteria"] as const;
type InvestorTab = (typeof INVESTOR_TABS)[number];

function InvestorBody({ profile }: { profile: InvestorRecommendation }) {
  const [tab, setTab] = useState<InvestorTab>("Overview");

  return (
    <div>
      <div className="px-7 pt-7">
        <header className="flex items-start gap-4">
          <ModalLogo name={profile.name} />
          <div className="flex flex-1 flex-col gap-2">
            <h2 className="font-serif text-[26px] font-semibold leading-tight text-[color:var(--color-text-strong)]">
              {profile.name}
            </h2>
            <p className="text-[15px] leading-snug text-[color:var(--color-text-muted)]">
              {profile.tagline}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Chip>{profile.investorType === "firm" ? "Firm" : "Angel"}</Chip>
              <Chip>{profile.geography}</Chip>
              <Chip>{profile.checkRange}</Chip>
            </div>
          </div>
        </header>
      </div>

      <TabBar tabs={INVESTOR_TABS} active={tab} onChange={setTab} />

      <div className="px-7 pb-7">
        {tab === "Overview" && <InvestorOverview profile={profile} />}
        {tab === "Portfolio" && <InvestorPortfolio profile={profile} />}
        {tab === "Criteria" && <InvestorCriteria profile={profile} />}
      </div>
    </div>
  );
}

function InvestorOverview({ profile }: { profile: InvestorRecommendation }) {
  return (
    <div className="flex flex-col gap-6">
      <Section title="Investment thesis">
        <p className="text-[14px] leading-relaxed text-[color:var(--color-text)]">{profile.thesis}</p>
      </Section>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <KeyValue label="Check size" value={profile.checkRange} />
        <KeyValue label="Stage preference" value={profile.stages.map((s) => STAGE_LABEL[s] ?? s).join(", ")} />
        <KeyValue label="Sector preference" value={profile.sectors.join(", ")} />
        <KeyValue label="Geography" value={profile.geography} />
        <KeyValue label="Equity preference" value={profile.equityPreference} />
      </div>
      {profile.tags.length > 0 && (
        <Section title="Tags">
          <div className="flex flex-wrap gap-1.5">{profile.tags.map((t) => <Chip key={t}>{t}</Chip>)}</div>
        </Section>
      )}
    </div>
  );
}

function InvestorPortfolio({ profile }: { profile: InvestorRecommendation }) {
  return (
    <div className="flex flex-col gap-6">
      <Section title="Portfolio companies">
        <div className="flex flex-col gap-3">
          {profile.portfolio.map((p) => (
            <div key={p} className="flex gap-2 border-b border-[color:var(--color-border)] pb-3 last:border-0 last:pb-0">
              <span className="text-[color:var(--color-text-faint)]">·</span>
              <span className="text-[14px] text-[color:var(--color-text)]">{p}</span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="What they help with">
        <BulletList items={profile.helpsWith} />
      </Section>
    </div>
  );
}

function InvestorCriteria({ profile }: { profile: InvestorRecommendation }) {
  return (
    <div className="flex flex-col gap-6">
      <Section title="Founder qualities they look for">
        <BulletList items={profile.founderQualities} />
      </Section>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <KeyValue label="Stage preference" value={profile.stages.map((s) => STAGE_LABEL[s] ?? s).join(", ")} />
        <KeyValue label="Sector focus" value={profile.sectors.join(", ")} />
        <KeyValue label="Geography" value={profile.geography} />
        <KeyValue label="Equity preference" value={profile.equityPreference} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shared components
// ─────────────────────────────────────────────────────────────────────────────

function TabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly T[];
  active: T;
  onChange: (tab: T) => void;
}) {
  return (
    <nav className="flex gap-0 overflow-x-auto border-b border-[color:var(--color-border)] px-7 mt-5 scrollbar-none">
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={cn(
            "relative whitespace-nowrap px-3.5 pb-3 pt-1 text-[12.5px] font-medium transition-colors duration-150",
            active === t
              ? "text-[color:var(--color-text-strong)]"
              : "text-[color:var(--color-text-faint)] hover:text-[color:var(--color-text-muted)]",
          )}
        >
          {t}
          {active === t && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[color:var(--color-text-strong)]" />
          )}
        </button>
      ))}
    </nav>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--color-text-faint)]">{title}</h3>
      {children}
    </section>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--color-text-faint)]">{label}</span>
      <span className="text-[14px] text-[color:var(--color-text)]">{value}</span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2.5 py-0.5 text-[11.5px] font-medium text-[color:var(--color-text-muted)]">
      {children}
    </span>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-[14px] text-[color:var(--color-text)]">
          <span className="text-[color:var(--color-text-faint)]">·</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function FieldOrEmpty({ label, value }: { label: string; value?: string | null }) {
  if (!value) {
    return (
      <Section title={label}>
        <p className="text-[13px] italic text-[color:var(--color-text-faint)]">Not provided yet</p>
      </Section>
    );
  }
  return (
    <Section title={label}>
      <p className="text-[14px] leading-relaxed text-[color:var(--color-text)]">{value}</p>
    </Section>
  );
}

function Divider() {
  return <hr className="border-[color:var(--color-border)]" />;
}

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <p className="text-[13px] text-[color:var(--color-text-faint)]">{message}</p>
    </div>
  );
}

function MediaPlaceholder({ label, hint, aspect }: { label: string; hint: string; aspect?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-10 text-center"
      style={aspect ? { aspectRatio: aspect } : undefined}
    >
      <span className="text-[12px] font-medium text-[color:var(--color-text-faint)]">{label}</span>
      <span className="text-[11px] text-[color:var(--color-text-faint)]">{hint}</span>
    </div>
  );
}

function prettyEnum(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
