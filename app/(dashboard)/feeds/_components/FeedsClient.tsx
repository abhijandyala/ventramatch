"use client";

import { useState, useMemo } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/landing/wordmark";
import { Disclaimer } from "@/components/common/Disclaimer";
import { ProfilePerformanceCard } from "@/components/dashboard/ProfilePerformanceCard";
import { ImproveMatchesCard } from "@/components/dashboard/ImproveMatchesCard";
import { WhyYouAreAGreatFitCard } from "@/components/dashboard/WhyYouAreAGreatFitCard";
import { founderDashboardMock, investorFeedMock } from "@/lib/dashboards/mock-data";
import {
  FeedCard,
  MOCK_INVESTORS,
  MOCK_STARTUPS,
  type FeedItem,
} from "./FeedCard";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type Role = "founder" | "investor" | null;
type FeedTab = "recommended" | "recently-active" | "saved" | "passed";

const NAV_LINKS: Array<{ label: string; href: string }> = [
  { label: "Feed", href: "/feed" },
  { label: "Feeds", href: "/feeds" },
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

type FeedsClientProps = {
  role: Role;
  name: string;
};

export function FeedsClient({ role, name }: FeedsClientProps) {
  const [activeTab, setActiveTab] = useState<FeedTab>("recommended");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [passedIds, setPassedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [industryFilter, setIndustryFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState("All");
  const [locationFilter, setLocationFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Best match");

  const allItems: FeedItem[] = role === "investor" ? MOCK_STARTUPS : MOCK_INVESTORS;

  // Pick the right sidebar data from whichever mock matches the role
  const sidebarData = role === "investor" ? investorFeedMock : founderDashboardMock;

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

    if (activeTab === "recently-active") {
      items = [...items].reverse();
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter((item) => {
        const name = item.type === "investor" ? item.fundName : item.name;
        const sector = item.type === "investor" ? item.sector : item.industry;
        return (
          name.toLowerCase().includes(q) ||
          sector.toLowerCase().includes(q) ||
          item.stage.toLowerCase().includes(q)
        );
      });
    }

    if (industryFilter !== "All") {
      items = items.filter((item) => {
        const sector = item.type === "investor" ? item.sector : item.industry;
        return sector.toLowerCase().includes(industryFilter.toLowerCase());
      });
    }

    if (stageFilter !== "All") {
      items = items.filter((item) =>
        item.stage.toLowerCase().includes(stageFilter.toLowerCase()),
      );
    }

    if (locationFilter !== "All" && role === "investor") {
      items = items.filter((item) => {
        if (item.type !== "startup") return true;
        return item.location.toLowerCase().includes(locationFilter.toLowerCase());
      });
    }

    if (sortBy === "Best match") {
      items = [...items].sort((a, b) => b.matchScore - a.matchScore);
    }

    return items;
  }, [allItems, activeTab, savedIds, passedIds, searchQuery, industryFilter, stageFilter, locationFilter, sortBy, role]);

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <AppNav role={role} name={name} />

      {/* Page header */}
      <section className="border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-5 sm:py-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1
                className="text-[20px] leading-7 font-semibold tracking-[-0.015em]"
                style={{ color: "var(--color-text)" }}
              >
                Feeds
              </h1>
              <p className="mt-0.5 text-[13px] leading-5" style={{ color: "var(--color-text-muted)" }}>
                Matches curated around your goals on VentraMatch
              </p>
            </div>
            {role && (
              <span
                className="hidden rounded-full border px-3 py-1 text-[12px] font-medium capitalize sm:inline-flex"
                style={{
                  borderColor: "var(--color-border)",
                  background: "var(--color-surface)",
                  color: "var(--color-text-muted)",
                }}
              >
                {role}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Tab strip */}
      <div
        className="border-b"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6">
          <div
            role="tablist"
            aria-label="Feed sections"
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
                    "relative shrink-0 flex items-center gap-1.5 px-4 py-3.5 text-[14px] leading-5 font-medium border-b-2",
                    "transition-colors duration-[120ms] ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-brand-ink)]/30",
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
                        background: isActive ? "var(--color-brand-tint)" : "var(--color-surface-2)",
                        color: isActive ? "var(--color-brand-strong)" : "var(--color-text-faint)",
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
      </div>

      {/* Main content */}
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-6 lg:py-8"
      >
        {/* Profile improvement banner */}
        <ProfileBanner role={role} />

        {/* Filters row */}
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

        {/* Grid */}
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
          {/* Feed column */}
          <div className="lg:col-span-8">
            <FeedList
              items={filteredItems}
              role={role}
              savedIds={savedIds}
              passedIds={passedIds}
              onSave={handleSave}
              onPass={handlePass}
              activeTab={activeTab}
            />
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-4">
            <div
              className="flex flex-col gap-4 lg:sticky"
              style={{ top: "calc(64px + 1px)" }}
            >
              {/* Profile performance — same component as /feed */}
              <div className="border overflow-hidden" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
                <div className="px-5 pt-5 pb-1 border-b" style={{ borderColor: "var(--color-border)" }}>
                  <h2 className="text-[14px] font-semibold tracking-tight" style={{ color: "var(--color-text)" }}>
                    Profile performance
                    <span className="ml-2 text-[12px] font-normal" style={{ color: "var(--color-text-faint)" }}>
                      (this month)
                    </span>
                  </h2>
                </div>
                <div className="px-5 py-5">
                  <ProfilePerformanceCard
                    stats={sidebarData.profilePerformance.stats}
                    series={sidebarData.profilePerformance.series}
                    borderless
                  />
                </div>
              </div>

              {/* Improve matches — same component as /feed */}
              <div className="border overflow-hidden" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
                <div className="px-5 pt-5 pb-1 border-b" style={{ borderColor: "var(--color-border)" }}>
                  <h2 className="text-[14px] font-semibold tracking-tight" style={{ color: "var(--color-text)" }}>
                    How to improve your matches
                  </h2>
                </div>
                <div className="px-5 py-5">
                  <ImproveMatchesCard
                    items={sidebarData.improveMatches}
                    completionPct={sidebarData.profileStrength.percent}
                    completeHref="/profile"
                    borderless
                  />
                </div>
              </div>

              {/* Why you're a great fit — same component as dashboard */}
              {"greatFitBullets" in sidebarData && (
                <WhyYouAreAGreatFitCard bullets={sidebarData.greatFitBullets} />
              )}
            </div>
          </aside>
        </div>
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
// Profile banner
// ---------------------------------------------------------------------------

function ProfileBanner({ role }: { role: Role }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const text =
    role === "investor"
      ? "Complete your investor preferences to improve startup recommendations"
      : "Complete your startup profile to improve investor matches";

  const primaryLabel = role === "investor" ? "Update preferences" : "Complete profile";

  return (
    <div
      className="mb-5 flex flex-col gap-3 border p-4 sm:flex-row sm:items-center sm:justify-between"
      style={{
        borderColor: "var(--color-brand)",
        background: "var(--color-brand-tint)",
      }}
    >
      <p className="text-[13px] font-medium" style={{ color: "var(--color-brand-strong)" }}>
        {text}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/profile"
          className="inline-flex h-8 items-center gap-1.5 px-3 text-[13px] font-semibold text-white transition-opacity duration-[120ms] hover:opacity-90"
          style={{ background: "var(--color-brand-ink)", borderRadius: "var(--radius-sm)" }}
        >
          {primaryLabel}
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-[12px] font-medium transition-colors duration-[120ms] hover:text-[var(--color-brand-strong)]"
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
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
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
          className="h-9 w-full border pl-8 pr-3 text-[13px] placeholder:text-[var(--color-text-faint)] transition-colors duration-[120ms] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-ink)]/20 hover:border-[var(--color-text-faint)]"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-surface)",
            borderRadius: "var(--radius-sm)",
            color: "var(--color-text)",
          }}
        />
      </div>

      <FilterSelect
        id="industry-filter"
        label={role === "investor" ? "Industry" : "Sector"}
        value={industryFilter}
        onChange={onIndustryChange}
        options={INDUSTRIES}
      />
      <FilterSelect
        id="stage-filter"
        label="Stage"
        value={stageFilter}
        onChange={onStageChange}
        options={STAGES}
      />
      {role === "investor" && (
        <FilterSelect
          id="location-filter"
          label="Location"
          value={locationFilter}
          onChange={onLocationChange}
          options={LOCATIONS}
        />
      )}
      <FilterSelect
        id="sort-filter"
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
        className="h-9 appearance-none border pl-3 pr-8 text-[13px] font-medium transition-colors duration-[120ms] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-ink)]/20 hover:border-[var(--color-text-faint)]"
        style={{
          borderColor: isDefault || isSort ? "var(--color-border)" : "var(--color-brand)",
          background: isDefault || isSort ? "var(--color-surface)" : "var(--color-brand-tint)",
          borderRadius: "var(--radius-sm)",
          color: isDefault || isSort ? "var(--color-text-muted)" : "var(--color-brand-strong)",
          minWidth: 120,
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
        className="flex flex-col items-center justify-center border py-16 text-center"
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-surface)",
        }}
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
    <div className="flex flex-col gap-4">
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
      {/* Legally required on every surface that shows match scores */}
      <Disclaimer className="mt-1" />
    </div>
  );
}
