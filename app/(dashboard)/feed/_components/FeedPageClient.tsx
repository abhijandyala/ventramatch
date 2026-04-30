"use client";

import { useState, useMemo } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/landing/wordmark";
import { Disclaimer } from "@/components/common/Disclaimer";
import { TopMatchCard } from "@/components/dashboard/TopMatchCard";
import { TopStartupCard } from "@/components/dashboard/TopStartupCard";
import { ActionRequiredCard } from "@/components/dashboard/ActionRequiredCard";
import { MatchAnalysisCard } from "@/components/dashboard/MatchAnalysisCard";
import { ProfilePerformanceCard } from "@/components/dashboard/ProfilePerformanceCard";
import { ImproveMatchesCard } from "@/components/dashboard/ImproveMatchesCard";
import { ProfileCompletionCard } from "@/components/dashboard/ProfileCompletionCard";
import { CombinedActivityCard } from "@/components/dashboard/CombinedActivityCard";
import { WhyYouAreAGreatFitCard } from "@/components/dashboard/WhyYouAreAGreatFitCard";
import {
  founderDashboardMock,
  investorFeedMock,
  getSampleStartupById,
} from "@/lib/dashboards/mock-data";
import {
  FeedCard,
  MOCK_INVESTORS,
  MOCK_STARTUPS,
  type FeedItem,
} from "../../feeds/_components/FeedCard";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type Role = "founder" | "investor" | null;
type FeedTab = "recommended" | "recently-active" | "saved" | "passed";

const NAV_LINKS: Array<{ label: string; href: string }> = [
  { label: "Feed", href: "/feed" },
  { label: "Matches", href: "/matches" },
  { label: "Profiles", href: "/profile" },
  { label: "Dashboard", href: "/dashboard" },
];

const FEED_TABS: Array<{ id: FeedTab; label: string }> = [
  { id: "recommended", label: "Recommended" },
  { id: "recently-active", label: "Recently Active" },
  { id: "saved", label: "Saved" },
  { id: "passed", label: "Passed" },
];

const INDUSTRIES = ["All", "AI / ML", "Fintech", "Healthtech", "SaaS", "Cleantech", "Edtech", "Consumer"];
const STAGES = ["All", "Pre-seed", "Seed", "Series A", "Series B+"];
const LOCATIONS = ["All", "US", "Europe", "Global", "Remote"];
const SORT_OPTIONS = ["Best match", "Recently active", "Newest first"];

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export type FeedPageClientProps = {
  role: Role;
  name: string;
  firstName: string;
};

export function FeedPageClient({ role, name, firstName }: FeedPageClientProps) {
  const params = useSearchParams();

  // Feed list state
  const [activeTab, setActiveTab] = useState<FeedTab>("recommended");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [passedIds, setPassedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [industryFilter, setIndustryFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState("All");
  const [locationFilter, setLocationFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Best match");

  const isInvestor = role === "investor";
  const founderData = founderDashboardMock;
  const investorData = investorFeedMock;
  const data = isInvestor ? investorData : founderData;

  // Focused startup for MatchAnalysisCard (investor only) — stays in sync with
  // TopStartupCard which writes ?focus= to the URL.
  const focusId = params.get("focus");
  const focusedStartup =
    (focusId ? getSampleStartupById(focusId) : undefined) ?? investorData.startups[0];

  const allItems: FeedItem[] = isInvestor ? MOCK_STARTUPS : MOCK_INVESTORS;

  function handleSave(id: string) {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handlePass(id: string) {
    setPassedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredItems = useMemo(() => {
    let items = allItems;

    if (activeTab === "saved") return items.filter((i) => savedIds.has(i.id));
    if (activeTab === "passed") return items.filter((i) => passedIds.has(i.id));
    if (activeTab === "recently-active") items = [...items].reverse();

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter((item) => {
        const n = item.type === "investor" ? item.fundName : item.name;
        const s = item.type === "investor" ? item.sector : item.industry;
        return (
          n.toLowerCase().includes(q) ||
          s.toLowerCase().includes(q) ||
          item.stage.toLowerCase().includes(q)
        );
      });
    }

    if (industryFilter !== "All") {
      items = items.filter((item) => {
        const s = item.type === "investor" ? item.sector : item.industry;
        return s.toLowerCase().includes(industryFilter.toLowerCase());
      });
    }

    if (stageFilter !== "All") {
      items = items.filter((item) =>
        item.stage.toLowerCase().includes(stageFilter.toLowerCase()),
      );
    }

    if (locationFilter !== "All" && isInvestor) {
      items = items.filter(
        (item) =>
          item.type !== "startup" ||
          item.location.toLowerCase().includes(locationFilter.toLowerCase()),
      );
    }

    if (sortBy === "Best match") {
      items = [...items].sort((a, b) => b.matchScore - a.matchScore);
    }

    return items;
  }, [allItems, activeTab, savedIds, passedIds, searchQuery, industryFilter, stageFilter, locationFilter, sortBy, isInvestor]);

  const profileComplete = data.profileStrength.percent >= 100;

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <AppNav role={role} name={name} />

      {/* Welcome strip */}
      <section className="relative overflow-hidden border-b border-[var(--color-border)]">
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 -z-10 h-[180px]",
            "bg-[radial-gradient(60%_60%_at_15%_0%,var(--color-brand-tint)_0%,transparent_70%)]",
            "opacity-70",
          )}
        />
        <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-5 sm:py-6">
          <p className="text-[11px] leading-4 font-medium tracking-[0.08em] uppercase text-[var(--color-text-faint)]">
            {isInvestor ? "Investor feed" : "Founder feed"}
          </p>
          <h1 className="mt-1 text-[20px] leading-7 font-semibold tracking-[-0.015em] text-[var(--color-text)]">
            Welcome back, {firstName}.
          </h1>
          <p className="mt-0.5 text-[13px] leading-5 text-[var(--color-text-muted)]">
            {isInvestor
              ? `${investorData.newStartupsToday} new startups matched your thesis today.`
              : "Three investors fit your raise this week. Two are active."}
          </p>
        </div>
      </section>

      {/* Main grid */}
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-5 lg:py-6"
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          {/* Left column */}
          <div className="lg:col-span-8 flex flex-col gap-5">
            {/* Hero carousel */}
            {isInvestor ? (
              <TopStartupCard
                startups={investorData.startups}
                focusedId={focusedStartup.id}
                newToday={investorData.newStartupsToday}
              />
            ) : (
              <TopMatchCard
                matches={founderData.topMatches}
                newToday={founderData.newInvestorsToday}
              />
            )}

            <Disclaimer />

            {/* Your matches section */}
            <section aria-labelledby="feed-matches-title" className="flex flex-col">
              <header className="flex items-baseline justify-between gap-4">
                <h2
                  id="feed-matches-title"
                  className="text-[15px] leading-5 font-semibold tracking-tight text-[var(--color-text)]"
                >
                  Your matches
                </h2>
                {(savedIds.size > 0 || passedIds.size > 0) && (
                  <span className="text-[12px] text-[var(--color-text-faint)]">
                    {savedIds.size} saved · {passedIds.size} passed
                  </span>
                )}
              </header>

              {/* Tabs */}
              <div
                className="mt-3 border-b"
                style={{ borderColor: "var(--color-border)" }}
              >
                <div
                  role="tablist"
                  aria-label="Match sections"
                  className="flex items-center overflow-x-auto -mb-px"
                  style={{ scrollbarWidth: "none" }}
                >
                  {FEED_TABS.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const count =
                      tab.id === "saved"
                        ? savedIds.size
                        : tab.id === "passed"
                          ? passedIds.size
                          : null;
                    return (
                      <button
                        key={tab.id}
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          "shrink-0 flex items-center gap-1.5 px-4 py-3 text-[13px] leading-5 font-medium border-b-2",
                          "transition-colors duration-[120ms] ease-out",
                          "focus-visible:outline-none",
                          isActive
                            ? "border-[var(--color-brand-ink)] text-[var(--color-text)]"
                            : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                        )}
                      >
                        {tab.label}
                        {count !== null && count > 0 && (
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
                            style={{
                              background: isActive
                                ? "var(--color-brand-tint)"
                                : "var(--color-surface-2)",
                              color: isActive
                                ? "var(--color-brand-strong)"
                                : "var(--color-text-faint)",
                            }}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Profile improvement banner */}
              <ProfileBanner role={role} />

              {/* Filters */}
              {activeTab !== "saved" && activeTab !== "passed" && (
                <FiltersRow
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  industryFilter={industryFilter}
                  onIndustryChange={setIndustryFilter}
                  stageFilter={stageFilter}
                  onStageChange={setStageFilter}
                  locationFilter={locationFilter}
                  onLocationChange={setLocationFilter}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  role={role}
                />
              )}

              {/* Feed cards */}
              <FeedList
                items={filteredItems}
                role={role}
                savedIds={savedIds}
                passedIds={passedIds}
                onSave={handleSave}
                onPass={handlePass}
                activeTab={activeTab}
              />
            </section>
          </div>

          {/* Right sidebar */}
          <aside className="lg:col-span-4 flex flex-col">
            <div
              className="rounded-none border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden"
              style={{ top: "calc(64px + 24px)", position: "sticky" } as React.CSSProperties}
            >
              {isInvestor ? (
                <>
                  <RailSection title="Match analysis" aside={focusedStartup.name}>
                    <MatchAnalysisCard startup={focusedStartup} borderless />
                  </RailSection>
                  <SectionDivider />
                </>
              ) : (
                <>
                  <RailSection
                    title="Action required"
                    aside={`${founderData.actionRequired.length} items`}
                  >
                    <ActionRequiredCard items={founderData.actionRequired} borderless />
                  </RailSection>
                  <SectionDivider />
                </>
              )}
              <RailSection title="Profile performance" aside="(this month)">
                <ProfilePerformanceCard
                  stats={data.profilePerformance.stats}
                  series={data.profilePerformance.series}
                  borderless
                />
              </RailSection>
              <SectionDivider />
              <RailSection title="How to improve your matches">
                <ImproveMatchesCard
                  items={data.improveMatches}
                  completionPct={data.profileStrength.percent}
                  completeHref="/profile"
                  borderless
                />
              </RailSection>
            </div>
          </aside>
        </div>

        {/* Bottom row */}
        <section
          aria-label="Profile and activity overview"
          className={cn(
            "mt-5 grid grid-cols-1 gap-3",
            profileComplete
              ? "md:grid-cols-2"
              : "md:grid-cols-2 xl:grid-cols-3",
          )}
        >
          {!profileComplete && (
            <ProfileCompletionCard
              percent={data.profileStrength.percent}
              band={data.profileStrength.band}
              upliftPct={data.profileStrength.completionUpliftPct}
              checklist={data.profileStrength.checklist}
            />
          )}
          {isInvestor ? (
            <>
              <CombinedActivityCard
                actions={investorData.actionRequired}
                activity={investorData.startupActivity}
              />
              <WhyYouAreAGreatFitCard bullets={investorData.greatFitBullets} />
            </>
          ) : (
            <>
              <CombinedActivityCard
                actions={founderData.actionRequired}
                activity={founderData.investorActivity}
              />
              <WhyYouAreAGreatFitCard bullets={founderData.greatFitBullets} />
            </>
          )}
        </section>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App nav
// ---------------------------------------------------------------------------

function AppNav({ role, name }: { role: Role; name: string }) {
  const pathname = usePathname();
  const initials = name
    ? name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "VM";

  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{ borderColor: "var(--color-border)", background: "var(--color-bg)" }}
    >
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Wordmark size="md" />
          <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href as Route}
                className={cn(
                  "text-[14px] transition-colors duration-[120ms]",
                  pathname === link.href || pathname.startsWith(`${link.href}/`)
                    ? "font-semibold text-[var(--color-text)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {role && (
            <span
              className="hidden rounded-full border px-2.5 py-0.5 text-[12px] font-medium capitalize sm:inline-flex"
              style={{
                borderColor: "var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text-muted)",
              }}
            >
              {role}
            </span>
          )}
          <a
            href="/api/auth/signout"
            className="text-[12px] font-medium transition-colors duration-[120ms] hover:text-[var(--color-text-muted)]"
            style={{ color: "var(--color-text-faint)" }}
          >
            Sign out
          </a>
          <div
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center font-mono text-[11px] font-semibold uppercase tracking-tight"
            style={{
              background: "var(--color-brand-tint)",
              color: "var(--color-brand-strong)",
              borderRadius: "8px",
              boxShadow: "0 0 0 1px var(--color-border)",
            }}
          >
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Profile improvement banner
// ---------------------------------------------------------------------------

function ProfileBanner({ role }: { role: Role }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const text =
    role === "investor"
      ? "Complete your investor preferences to improve startup recommendations"
      : "Complete your startup profile to improve investor matches";
  const label = role === "investor" ? "Update preferences" : "Complete profile";

  return (
    <div
      className="mt-4 flex flex-col gap-3 border p-4 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: "var(--color-brand)", background: "var(--color-brand-tint)" }}
    >
      <p className="text-[13px] font-medium" style={{ color: "var(--color-brand-strong)" }}>
        {text}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/profile"
          className="inline-flex h-8 items-center gap-1.5 px-3 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--color-brand-ink)", borderRadius: "var(--radius-sm)" }}
        >
          {label}
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-[12px] font-medium transition-colors hover:text-[var(--color-brand-strong)]"
          style={{ color: "var(--color-brand)" }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filters row
// ---------------------------------------------------------------------------

type FiltersRowProps = {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  industryFilter: string;
  onIndustryChange: (v: string) => void;
  stageFilter: string;
  onStageChange: (v: string) => void;
  locationFilter: string;
  onLocationChange: (v: string) => void;
  sortBy: string;
  onSortChange: (v: string) => void;
  role: Role;
};

function FiltersRow({
  searchQuery,
  onSearchChange,
  industryFilter,
  onIndustryChange,
  stageFilter,
  onStageChange,
  locationFilter,
  onLocationChange,
  sortBy,
  onSortChange,
  role,
}: FiltersRowProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[180px] flex-1">
        <Search
          size={13}
          strokeWidth={1.75}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--color-text-faint)" }}
          aria-hidden
        />
        <input
          type="search"
          placeholder={role === "investor" ? "Search startups…" : "Search investors…"}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 w-full border pl-8 pr-3 text-[13px] placeholder:text-[var(--color-text-faint)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-ink)]/20 hover:border-[var(--color-text-faint)]"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-surface)",
            borderRadius: "var(--radius-sm)",
            color: "var(--color-text)",
          }}
        />
      </div>

      <FilterSelect
        id="feed-industry"
        label={role === "investor" ? "Industry" : "Sector"}
        value={industryFilter}
        onChange={onIndustryChange}
        options={INDUSTRIES}
      />
      <FilterSelect
        id="feed-stage"
        label="Stage"
        value={stageFilter}
        onChange={onStageChange}
        options={STAGES}
      />
      {role === "investor" && (
        <FilterSelect
          id="feed-location"
          label="Location"
          value={locationFilter}
          onChange={onLocationChange}
          options={LOCATIONS}
        />
      )}
      <FilterSelect
        id="feed-sort"
        label="Sort"
        value={sortBy}
        onChange={onSortChange}
        options={SORT_OPTIONS}
        isSort
      />
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  isSort = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  isSort?: boolean;
}) {
  const isDefault = options[0] === value;
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
        <ChevronDown size={12} strokeWidth={1.75} style={{ color: "var(--color-text-faint)" }} aria-hidden />
      </div>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 appearance-none border pl-3 pr-8 text-[13px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-ink)]/20 hover:border-[var(--color-text-faint)]"
        style={{
          borderColor: isDefault || isSort ? "var(--color-border)" : "var(--color-brand)",
          background: isDefault || isSort ? "var(--color-surface)" : "var(--color-brand-tint)",
          borderRadius: "var(--radius-sm)",
          color: isDefault || isSort ? "var(--color-text-muted)" : "var(--color-brand-strong)",
          minWidth: 110,
        }}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt === options[0] && !isSort ? `${label}: All` : opt}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feed list
// ---------------------------------------------------------------------------

type FeedListProps = {
  items: FeedItem[];
  role: Role;
  savedIds: Set<string>;
  passedIds: Set<string>;
  onSave: (id: string) => void;
  onPass: (id: string) => void;
  activeTab: FeedTab;
};

function FeedList({ items, role, savedIds, passedIds, onSave, onPass, activeTab }: FeedListProps) {
  const effectiveRole = role ?? "founder";

  if (items.length === 0) {
    return (
      <div
        className="mt-4 flex flex-col items-center justify-center border py-14 text-center"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        <p className="text-[14px] font-medium" style={{ color: "var(--color-text)" }}>
          {activeTab === "saved"
            ? "No saved matches yet."
            : activeTab === "passed"
              ? "No passed matches yet."
              : "No matches yet. Try adjusting filters or completing your profile."}
        </p>
        <p className="mt-1 text-[13px]" style={{ color: "var(--color-text-faint)" }}>
          {activeTab === "recommended"
            ? "Check back soon — new matches arrive daily."
            : activeTab === "saved"
              ? "Bookmark matches to find them here."
              : "Matches you pass will appear here."}
        </p>
        {activeTab === "recommended" && (
          <Link
            href="/profile"
            className="mt-4 inline-flex h-9 items-center gap-1.5 px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--color-brand-ink)", borderRadius: "var(--radius-sm)" }}
          >
            Complete your profile
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.id}>
            <FeedCard
              item={item}
              role={effectiveRole}
              onSave={onSave}
              onPass={onPass}
              saved={savedIds.has(item.id)}
              passed={passedIds.has(item.id)}
            />
          </li>
        ))}
      </ul>
      <Disclaimer className="mt-1" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar helpers
// ---------------------------------------------------------------------------

function RailSection({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-5">
      <header className="flex items-baseline justify-between gap-2 mb-4">
        <h3 className="text-[14px] leading-5 font-semibold tracking-tight text-[var(--color-text)]">
          {title}
        </h3>
        {aside && (
          <span className="text-[12px] leading-4 text-[var(--color-text-faint)]">{aside}</span>
        )}
      </header>
      {children}
    </div>
  );
}

function SectionDivider() {
  return (
    <div
      className="h-[1px] w-full"
      style={{ background: "var(--color-text)", opacity: 0.12 }}
    />
  );
}
