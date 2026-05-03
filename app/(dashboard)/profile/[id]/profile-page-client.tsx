"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Bookmark } from "lucide-react";
import { Avatar } from "@/components/profile/avatar";
import { cn } from "@/lib/utils";
import type {
  InvestorRecommendation,
  RecommendationProfile,
  StartupRecommendation,
} from "@/lib/recommendations/types";

const KNOWN_COMPANIES: Record<string, string> = {
  notion: "/logos/notion.svg",
  linear: "/logos/linear.svg",
  stripe: "/logos/stripe.svg",
  figma: "/logos/figma.svg",
  vercel: "/logos/vercel.svg",
  supabase: "/logos/supabase.svg",
  github: "/logos/github.svg",
  openai: "/logos/openai.svg",
  anthropic: "/logos/anthropic.svg",
  slack: "/logos/slack.svg",
  discord: "/logos/discord.svg",
  replit: "/logos/replit.svg",
  airtable: "/logos/airtable.svg",
  cursor: "/logos/cursor.svg",
  perplexity: "/logos/perplexity.svg",
  "y combinator": "/logos/ycombinator.svg",
  ycombinator: "/logos/ycombinator.svg",
  sequoia: "/logos/sequoia.svg",
  a16z: "/logos/a16z.svg",
  "andreessen horowitz": "/logos/a16z.svg",
  khosla: "/logos/khosla.svg",
  "founders fund": "/logos/foundersfund.svg",
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const SAVED_KEY = "vm:interested-profiles";

function readSaved(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]") as string[]; }
  catch { return []; }
}
function writeSaved(ids: string[]) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(ids)); } catch { /* */ }
}

const SL: Record<string, string> = {
  idea: "Idea", pre_seed: "Pre-seed", seed: "Seed",
  series_a: "Series A", series_b_plus: "Series B+",
};

function prettyEnum(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ProfilePageClient({ profile }: { profile: RecommendationProfile }) {
  const [savedIds, setSavedIds] = useState<string[]>(() => readSaved());

  const toggleSave = useCallback((id: string) => {
    setSavedIds((prev) => {
      const has = prev.includes(id);
      const next = has ? prev.filter((x) => x !== id) : [...prev, id];
      writeSaved(next);
      return next;
    });
  }, []);

  const isSaved = savedIds.includes(profile.id);

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10">
      {/* Back link */}
      <Link
        href="/matches"
        className="mb-6 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
        Back to matches
      </Link>

      <div className="border border-[var(--color-border)] bg-white">
        {profile.kind === "startup" ? (
          <StartupView profile={profile} saved={isSaved} onToggleSave={toggleSave} />
        ) : (
          <InvestorView profile={profile} saved={isSaved} onToggleSave={toggleSave} />
        )}
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Startup view — 9 tabs
// ─────────────────────────────────────────────────────────────────────────────

const STARTUP_TABS = [
  "Overview", "Team", "Problem & Solution", "Market",
  "Business & GTM", "Traction", "Fundraise", "Risks", "Media",
] as const;
type StartupTab = (typeof STARTUP_TABS)[number];

function StartupView({ profile, saved, onToggleSave }: {
  profile: StartupRecommendation; saved: boolean; onToggleSave: (id: string) => void;
}) {
  const [tab, setTab] = useState<StartupTab>("Overview");

  const founder = profile.founder ?? (profile.teamMembers?.[0]
    ? { fullName: profile.teamMembers[0].name, role: profile.teamMembers[0].role, linkedinUrl: profile.teamMembers[0].linkedinUrl }
    : undefined);

  return (
    <>
      {/* Header */}
      <div className="px-10 pt-10 pb-0 lg:px-14">
        <div className="flex items-start gap-6">
          {/* Large logo */}
          <ProfileLogo name={profile.name} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">Startup</span>
              {profile.productStatus && (
                <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-green-700">
                  {prettyEnum(profile.productStatus)}
                </span>
              )}
            </div>
            <h1 className="mt-2 text-[32px] font-bold tracking-tight text-[var(--color-text-strong)]">
              {profile.name}
            </h1>
            <p className="mt-1.5 max-w-[52ch] text-[16px] leading-[1.5] text-[var(--color-text-muted)]">{profile.tagline}</p>

            {/* Meta row */}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-[var(--color-text-muted)]">
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 opacity-40" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a5 5 0 100 10A5 5 0 008 1zM2 8a6 6 0 1112 0A6 6 0 012 8z"/><path d="M8 4.5A3.5 3.5 0 118 11.5 3.5 3.5 0 018 4.5z" opacity="0"/></svg>
                <span className="font-medium text-[var(--color-text)]">{profile.sector}</span>
              </span>
              <span className="text-[var(--color-text-faint)]">·</span>
              <span>{SL[profile.stage] ?? profile.stage}</span>
              <span className="text-[var(--color-text-faint)]">·</span>
              <span>{profile.location}</span>
              <span className="text-[var(--color-text-faint)]">·</span>
              <span>Est. {profile.foundingYear}</span>
            </div>

            {/* Links */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--color-brand)] hover:underline">
                  <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75}><circle cx="8" cy="8" r="6.5"/><path d="M5.5 8c0-2.5 1-4.5 2.5-4.5S10.5 5.5 10.5 8s-1 4.5-2.5 4.5S5.5 10.5 5.5 8z"/><path d="M2 8h12"/></svg>
                  {profile.websitePlaceholder}
                </a>
              )}
              {founder?.linkedinUrl && (
                <a href={founder.linkedinUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--color-brand)] hover:underline">
                  <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor"><path d="M2.5 1A1.5 1.5 0 001 2.5v11A1.5 1.5 0 002.5 15h11a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0013.5 1h-11zM5 6v7H3V6h2zm-1-3a1 1 0 110 2 1 1 0 010-2zm4 3h2v1c.3-.5.9-1.1 2-1.1 1.8 0 2.5 1.1 2.5 3.1V13h-2V9.2c0-.9-.4-1.5-1.2-1.5-.8 0-1.3.6-1.3 1.5V13H8V6z"/></svg>
                  {founder.fullName}
                </a>
              )}
            </div>
          </div>
          <SaveButton saved={saved} onClick={() => onToggleSave(profile.id)} />
        </div>
      </div>

      {/* Tabs */}
      <TabBar tabs={STARTUP_TABS} active={tab} onChange={setTab} />

      {/* Tab content */}
      <div className="px-10 pt-8 pb-10 lg:px-14">
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
    </>
  );
}

// ── Startup tab content ──

function TabOverview({ profile, founder }: { profile: StartupRecommendation; founder?: { fullName: string; role: string } }) {
  return (
    <div className="flex flex-col gap-8">
      {/* Description */}
      <p className="text-[15px] leading-[1.7] text-[var(--color-text)] max-w-[72ch]">{profile.description}</p>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-px sm:grid-cols-4 bg-[var(--color-border)]">
        {[
          { label: "Sector", value: profile.sector },
          { label: "Stage", value: SL[profile.stage] ?? profile.stage },
          { label: "Location", value: profile.location },
          { label: "Founded", value: String(profile.foundingYear) },
        ].map((item) => (
          <div key={item.label} className="flex flex-col gap-1 bg-[var(--color-surface)] px-5 py-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">{item.label}</span>
            <span className="text-[15px] font-semibold text-[var(--color-text-strong)]">{item.value}</span>
          </div>
        ))}
      </div>

      {/* Team preview — large photos */}
      {profile.teamMembers && profile.teamMembers.length > 0 && (
        <div>
          <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">Team</h3>
          <div className="flex gap-4">
            {profile.teamMembers.slice(0, 4).map((m) => (
              <div key={m.name} className="flex flex-col items-center gap-2 text-center">
                <div className="h-20 w-20 overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)]">
                  {m.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photoUrl} alt={m.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[14px] font-semibold text-[var(--color-text-faint)]">
                      {m.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-[12.5px] font-semibold text-[var(--color-text-strong)]">{m.name}</p>
                  <p className="text-[11px] text-[var(--color-text-faint)]">{m.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {profile.tags.length > 0 && (
        <div>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">Tags</h3>
          <div className="flex flex-wrap gap-1.5">{profile.tags.map((t) => <Chip key={t}>{t}</Chip>)}</div>
        </div>
      )}
    </div>
  );
}

function TabTeam({ profile }: { profile: StartupRecommendation }) {
  return (
    <div className="flex flex-col gap-6">
      <Section title="Team summary">
        <p className="text-[14px] leading-relaxed text-[var(--color-text)]">{profile.founderSummary}</p>
      </Section>

      {profile.teamMembers && profile.teamMembers.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profile.teamMembers.map((m) => {
            const prevCompanies = extractCompanyLogos(m.background ?? "");
            return (
              <div key={m.name} className="flex flex-col border border-[var(--color-border)] bg-white overflow-hidden">
                {/* Photo header */}
                <div className="flex items-center gap-4 p-4 border-b border-[var(--color-border)]">
                  <div className="h-16 w-16 shrink-0 overflow-hidden bg-[var(--color-surface)]">
                    {m.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photoUrl} alt={m.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[15px] font-semibold text-[var(--color-text-faint)]">
                        {m.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[var(--color-text-strong)]">{m.name}</p>
                    <p className="text-[12px] text-[var(--color-text-faint)]">{m.role}</p>
                    {m.linkedinUrl && (
                      <a href={m.linkedinUrl} target="_blank" rel="noopener noreferrer"
                        className="mt-1 inline-block text-[11.5px] font-medium text-[var(--color-brand)] hover:underline">
                        LinkedIn →
                      </a>
                    )}
                  </div>
                </div>
                {/* Background */}
                <p className="px-4 py-3 text-[13px] leading-[1.55] text-[var(--color-text-muted)] flex-1">{m.background}</p>
                {/* Previously at logos */}
                {prevCompanies.length > 0 && (
                  <div className="px-4 pb-3 flex flex-wrap gap-2">
                    {prevCompanies.map((c) => (
                      <div key={c.logo} className="flex items-center gap-1.5 border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 rounded-[4px]">
                        <Image src={c.logo} alt={c.name} width={14} height={14} className="h-3.5 w-3.5 object-contain" />
                        <span className="text-[11px] font-medium text-[var(--color-text-muted)]">{c.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {profile.advisors && profile.advisors.length > 0 && (
        <Section title="Advisors">
          <BulletList items={profile.advisors} />
        </Section>
      )}

      {profile.keyHiresNeeded && (
        <Section title="Key hires needed">
          <p className="text-[14px] leading-relaxed text-[var(--color-text)]">{profile.keyHiresNeeded}</p>
        </Section>
      )}
    </div>
  );
}

function TabProblemSolution({ profile }: { profile: StartupRecommendation }) {
  return (
    <div className="flex flex-col gap-6">
      <FieldOrEmpty label="Problem statement" value={profile.problemStatement} />
      <FieldOrEmpty label="Target customer" value={profile.targetCustomer} />
      <FieldOrEmpty label="Current alternatives" value={profile.currentAlternatives} />
      <FieldOrEmpty label="Why alternatives fail" value={profile.whyAlternativesFail} />
      <Divider />
      <Section title="Product">
        <p className="text-[14px] leading-relaxed text-[var(--color-text)]">{profile.product}</p>
      </Section>
      <FieldOrEmpty label="Key features" value={profile.keyFeatures} />
      <FieldOrEmpty label="Technical moat" value={profile.technicalMoat} />
      <FieldOrEmpty label="Roadmap" value={profile.roadmap} />
    </div>
  );
}

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

function TabBusinessGtm({ profile }: { profile: StartupRecommendation }) {
  return (
    <div className="flex flex-col gap-6">
      <FieldOrEmpty label="Business model" value={profile.businessModel} />
      <FieldOrEmpty label="Revenue model" value={profile.revenueModel} />
      <FieldOrEmpty label="Pricing" value={profile.pricing} />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {profile.grossMargin && <KV label="Gross margin" value={profile.grossMargin} />}
        {profile.salesCycle && <KV label="Sales cycle" value={profile.salesCycle} />}
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

function TabTraction({ profile }: { profile: StartupRecommendation }) {
  const kpis = [
    profile.mrr && { label: "MRR", value: profile.mrr },
    profile.growthPct && { label: "Growth", value: profile.growthPct },
    profile.customers && { label: "Customers", value: profile.customers.split(",")[0] },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="flex flex-col gap-6">
      {/* KPI strip */}
      {kpis.length > 0 && (
        <div
          className="grid overflow-hidden rounded-[6px]"
          style={{ gridTemplateColumns: `repeat(${kpis.length}, 1fr)`, background: "#DCFCE7" }}
        >
          {kpis.map((k, i) => (
            <div
              key={k.label}
              className="flex flex-col gap-1 px-6 py-5"
              style={i > 0 ? { borderLeft: "1px solid rgba(0,0,0,0.07)" } : undefined}
            >
              <span className="font-mono text-[22px] font-bold tabular-nums leading-none text-[#064E3B]">{k.value}</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#065F46]">{k.label}</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[14px] leading-relaxed text-[var(--color-text)]">{profile.traction}</p>
      <CompanyLogos text={[profile.traction, profile.notableSignals, profile.notableCustomers].filter(Boolean).join(" ")} />

      {profile.notableSignals && <FieldOrEmpty label="Notable signals" value={profile.notableSignals} />}
      <Divider />
      <FieldOrEmpty label="Notable customers" value={profile.notableCustomers} />
      <FieldOrEmpty label="Customer proof" value={profile.customerProof} />
      <FieldOrEmpty label="Retention & engagement" value={profile.retentionEngagement} />
    </div>
  );
}

const STAGE_ORDER_LABELS = ["Idea", "Pre-seed", "Seed", "Series A", "Series B+"] as const;

function TabFundraise({ profile }: { profile: StartupRecommendation }) {
  const stageLabel = SL[profile.stage] ?? profile.stage;
  const stageIdx = STAGE_ORDER_LABELS.indexOf(stageLabel as typeof STAGE_ORDER_LABELS[number]);

  return (
    <div className="flex flex-col gap-7">
      {/* Raise banner */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[6px] bg-[var(--color-border)] sm:grid-cols-4">
        {[
          { label: "Raising", value: profile.fundingAsk },
          profile.instrument && { label: "Instrument", value: profile.instrument },
          profile.valuationCap && { label: "Valuation cap", value: profile.valuationCap },
          profile.minCheckSize && { label: "Min check", value: profile.minCheckSize },
        ].filter(Boolean).map((item, i) => (
          <div key={(item as {label:string}).label} className="flex flex-col gap-1 bg-[var(--color-surface)] px-5 py-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">{(item as {label:string}).label}</span>
            <span className="text-[18px] font-bold text-[var(--color-text-strong)]">{(item as {value:string}).value}</span>
          </div>
        ))}
      </div>

      {/* Stage progress */}
      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">Stage</p>
        <div className="flex gap-2">
          {STAGE_ORDER_LABELS.map((s, i) => {
            const active = i === stageIdx;
            const past = i < stageIdx;
            return (
              <div key={s} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="h-2 w-full rounded-full transition-all"
                  style={{ background: active ? "var(--color-brand)" : past ? "#BBF7D0" : "var(--color-border)" }}
                />
                <span
                  className="text-[10px] font-semibold text-center"
                  style={{ color: active ? "var(--color-brand-ink)" : "var(--color-text-faint)" }}
                >
                  {s}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <FieldOrEmpty label="Use of funds" value={profile.useOfFunds} />

      {profile.milestonesAfterRaise && profile.milestonesAfterRaise.length > 0 && (
        <Section title="Milestones after raise">
          <BulletList items={profile.milestonesAfterRaise} />
        </Section>
      )}

      {profile.capTable && (
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[6px] bg-[var(--color-border)] sm:grid-cols-3">
          {[
            profile.capTable.totalRaised && { label: "Total raised", value: profile.capTable.totalRaised },
            profile.capTable.founderEquity && { label: "Founder equity", value: profile.capTable.founderEquity },
            profile.capTable.optionPool && { label: "Option pool", value: profile.capTable.optionPool },
          ].filter(Boolean).map((item) => (
            <div key={(item as {label:string}).label} className="flex flex-col gap-1 bg-[var(--color-surface)] px-5 py-4">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">{(item as {label:string}).label}</span>
              <span className="text-[16px] font-bold text-[var(--color-text-strong)]">{(item as {value:string}).value}</span>
            </div>
          ))}
        </div>
      )}

      <FieldOrEmpty label="Ideal investor" value={profile.idealInvestor} />
    </div>
  );
}

function TabRisks({ profile }: { profile: StartupRecommendation }) {
  const hasContent = profile.risks?.length || profile.biggestUnknown || profile.failureScenario;
  if (!hasContent) return <EmptyTab message="No risk information provided yet." />;
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

function TabMedia({ profile }: { profile: StartupRecommendation }) {
  const hasDeck = !!profile.pitchDeckUrl;
  const hasVideo = !!profile.videoUrl;
  const hasPhotos = profile.photos && profile.photos.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <Section title="Pitch deck">
        {hasDeck ? (
          <a href={profile.pitchDeckUrl!} target="_blank" rel="noopener noreferrer"
            className="text-[14px] font-medium underline underline-offset-4 text-[var(--color-brand)]">View pitch deck</a>
        ) : (
          <MediaPlaceholder label="Pitch deck" hint="No pitch deck uploaded yet" />
        )}
      </Section>

      <Section title="Video">
        {hasVideo ? (
          <a href={profile.videoUrl!} target="_blank" rel="noopener noreferrer"
            className="text-[14px] font-medium underline underline-offset-4 text-[var(--color-brand)]">Watch video</a>
        ) : (
          <MediaPlaceholder label="Video" hint="No video uploaded yet" />
        )}
      </Section>

      <Section title="Product photos">
        {hasPhotos ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {profile.photos!.map((url, i) => (
              <div key={url} className="aspect-[4/3] overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)]">
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
//  Investor view — 3 tabs
// ─────────────────────────────────────────────────────────────────────────────

const INVESTOR_TABS = ["Overview", "Portfolio", "Criteria"] as const;
type InvestorTab = (typeof INVESTOR_TABS)[number];

function InvestorView({ profile, saved, onToggleSave }: {
  profile: InvestorRecommendation; saved: boolean; onToggleSave: (id: string) => void;
}) {
  const [tab, setTab] = useState<InvestorTab>("Overview");

  return (
    <>
      <div className="px-10 pt-10 pb-0 lg:px-14">
        <div className="flex items-start gap-5">
          <Avatar id={profile.id} name={profile.name} size="xl" />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">Investor</span>
            <h1 className="mt-1 font-serif text-[28px] font-semibold leading-tight text-[var(--color-text-strong)]">
              {profile.name}
            </h1>
            <p className="mt-1 text-[15px] leading-snug text-[var(--color-text-muted)]">{profile.tagline}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Chip>{profile.investorType === "firm" ? "Firm" : "Angel"}</Chip>
              <Chip>{profile.geography}</Chip>
              <Chip>{profile.checkRange}</Chip>
              {profile.stages.map((s) => <Chip key={s}>{SL[s] ?? s}</Chip>)}
            </div>
          </div>
          <SaveButton saved={saved} onClick={() => onToggleSave(profile.id)} />
        </div>
      </div>

      <TabBar tabs={INVESTOR_TABS} active={tab} onChange={setTab} />

      <div className="px-10 pt-8 pb-10 lg:px-14">
        {tab === "Overview" && <InvestorOverview profile={profile} />}
        {tab === "Portfolio" && <InvestorPortfolio profile={profile} />}
        {tab === "Criteria" && <InvestorCriteria profile={profile} />}
      </div>
    </>
  );
}

function InvestorOverview({ profile }: { profile: InvestorRecommendation }) {
  return (
    <div className="flex flex-col gap-6">
      <Section title="Investment thesis">
        <p className="text-[14px] leading-relaxed text-[var(--color-text)]">{profile.thesis}</p>
      </Section>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <KV label="Check size" value={profile.checkRange} />
        <KV label="Stage preference" value={profile.stages.map((s) => SL[s] ?? s).join(", ")} />
        <KV label="Sector preference" value={profile.sectors.join(", ")} />
        <KV label="Geography" value={profile.geography} />
        <KV label="Equity preference" value={profile.equityPreference} />
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
            <div key={p} className="flex gap-2 border-b border-[var(--color-border)] pb-3 last:border-0 last:pb-0">
              <span className="text-[var(--color-text-faint)]">·</span>
              <span className="text-[14px] text-[var(--color-text)]">{p}</span>
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
        <KV label="Stage preference" value={profile.stages.map((s) => SL[s] ?? s).join(", ")} />
        <KV label="Sector focus" value={profile.sectors.join(", ")} />
        <KV label="Geography" value={profile.geography} />
        <KV label="Equity preference" value={profile.equityPreference} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

function SaveButton({ saved, onClick }: { saved: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 px-4 text-[13px] font-medium transition-colors duration-150",
        saved
          ? "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-ink)]"
          : "border border-[var(--color-border)] bg-white text-[var(--color-text)] hover:border-[var(--color-text-faint)]",
      )}
    >
      <Bookmark className="h-3.5 w-3.5" strokeWidth={1.75} fill={saved ? "currentColor" : "none"} />
      {saved ? "Saved" : "I\u2019m interested"}
    </button>
  );
}

function TabBar<T extends string>({ tabs, active, onChange }: {
  tabs: readonly T[]; active: T; onChange: (tab: T) => void;
}) {
  return (
    <nav className="flex gap-0 overflow-x-auto border-b border-[var(--color-border)] px-10 lg:px-14 mt-6 scrollbar-none">
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={cn(
            "relative whitespace-nowrap px-4 pb-3 pt-1 text-[13px] font-medium transition-colors duration-150",
            active === t
              ? "text-[var(--color-text-strong)]"
              : "text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]",
          )}
        >
          {t}
          {active === t && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--color-text-strong)]" />
          )}
        </button>
      ))}
    </nav>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-faint)]">{title}</h3>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-faint)]">{label}</span>
      <span className="text-[14px] leading-[1.5] text-[var(--color-text)]">{value}</span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[12px] font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text-faint)] hover:text-[var(--color-text)]">
      {children}
    </span>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-[14px] text-[var(--color-text)]">
          <span className="text-[var(--color-text-faint)]">·</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function extractCompanyLogos(text: string): { name: string; logo: string }[] {
  const found: { name: string; logo: string }[] = [];
  const lowerText = text.toLowerCase();
  for (const [key, logo] of Object.entries(KNOWN_COMPANIES)) {
    if (lowerText.includes(key) && !found.some((f) => f.logo === logo)) {
      const displayName = key.charAt(0).toUpperCase() + key.slice(1);
      found.push({ name: displayName, logo });
    }
  }
  return found;
}

// Brand bg for logos that are white/invisible on light backgrounds
const LOGO_BG: Record<string, string> = {
  "/logos/github.svg": "#24292e",
  "/logos/vercel.svg": "#000000",
  "/logos/openai.svg": "#000000",
  "/logos/notion.svg": "#000000",
  "/logos/cursor.svg": "#000000",
  "/logos/discord.svg": "#5865F2",
  "/logos/slack.svg": "#4A154B",
  "/logos/linear.svg": "#5E6AD2",
  "/logos/stripe.svg": "#635BFF",
  "/logos/anthropic.svg": "#d4a574",
};

function CompanyLogos({ text }: { text: string }) {
  const companies = extractCompanyLogos(text);
  if (companies.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      {companies.map((c) => {
        const bg = LOGO_BG[c.logo];
        return (
          <div
            key={c.logo}
            className="flex items-center gap-2.5 rounded-[7px] border border-[var(--color-border)] overflow-hidden"
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center"
              style={{ background: bg ?? "var(--color-surface)" }}
            >
              <Image
                src={c.logo}
                alt={c.name}
                width={20}
                height={20}
                className="h-5 w-5 object-contain"
                style={bg ? { filter: "brightness(0) invert(1)" } : undefined}
              />
            </div>
            <span className="pr-3 text-[13px] font-medium text-[var(--color-text)]">{c.name}</span>
          </div>
        );
      })}
    </div>
  );
}

function FieldOrEmpty({ label, value }: { label: string; value?: string | null }) {
  if (!value) {
    return (
      <Section title={label}>
        <p className="text-[13px] italic text-[var(--color-text-faint)]">Not provided yet</p>
      </Section>
    );
  }
  const logos = extractCompanyLogos(value);
  return (
    <Section title={label}>
      <p className="text-[14px] leading-relaxed text-[var(--color-text)]">{value}</p>
      {logos.length > 0 && <CompanyLogos text={value} />}
    </Section>
  );
}

function Divider() {
  return <hr className="border-[var(--color-border)]" />;
}

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <p className="text-[13px] text-[var(--color-text-faint)]">{message}</p>
    </div>
  );
}

function ProfileLogo({ name }: { name: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const localLogo = `/mock-assets/${slugify(name)}/logo.png`;

  return (
    <div className="flex h-24 w-24 shrink-0 items-center justify-center bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden p-1">
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={localLogo} alt={name} className="h-full w-full object-contain" onError={() => setFailed(true)} />
      ) : (
        <span className="text-[18px] font-semibold text-[var(--color-text-faint)]">{initials}</span>
      )}
    </div>
  );
}

function MediaPlaceholder({ label, hint, aspect }: { label: string; hint: string; aspect?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-10 text-center"
      style={aspect ? { aspectRatio: aspect } : undefined}
    >
      <span className="text-[12px] font-medium text-[var(--color-text-faint)]">{label}</span>
      <span className="text-[11px] text-[var(--color-text-faint)]">{hint}</span>
    </div>
  );
}
