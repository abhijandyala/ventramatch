import type { Route } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { MobileFilterToggle } from "@/components/feed/mobile-filter-toggle";
import {
  fetchFeedForFounder,
  fetchFeedForInvestor,
  type FeedStartupCard,
  type FeedInvestorCard,
} from "@/lib/feed/query";
import { fetchIntroBadgeCounts, type IntroBadgeCounts } from "@/lib/intros/query";
import { parseFeedFilters, hasActiveFilters, type FeedFilters } from "@/lib/feed/filters";
import { AccountStatusBanner } from "@/components/account/account-status-banner";
import { IntroInboxBanner } from "@/components/intros/intro-inbox-banner";
import { FeedCard } from "@/components/feed/feed-card";
import { FilterPanel } from "@/components/feed/filter-panel";
import { ActiveFiltersStrip } from "@/components/feed/active-filters-strip";
import { SaveSearchButton } from "@/components/feed/save-search-button";
import { Disclaimer } from "@/components/common/Disclaimer";
import type { AccountLabel } from "@/types/database";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!session.user.onboardingCompleted) redirect("/onboarding");

  const userId = session.user.id;
  const role = session.user.role as "founder" | "investor" | null;
  const accountLabel = (session.user.accountLabel ?? "unverified") as AccountLabel;

  const params = await searchParams;
  const filters = parseFeedFilters(params);
  const isExploring = hasActiveFilters(filters);

  console.log(
    `[feed] userId=${userId} role=${role} q=${filters.q ?? ""} sort=${filters.sort} industries=${filters.industries.length}`,
  );

  const [introCounts, items] = await Promise.all([
    fetchIntroBadgeCounts(userId),
    role === "founder"
      ? fetchFeedForFounder(userId, { limit: 50, filters })
      : fetchFeedForInvestor(userId, { limit: 50, filters }),
  ]);

  return (
    <FeedShell
      role={role ?? "investor"}
      accountLabel={accountLabel}
      introCounts={introCounts}
      filters={filters}
      isExploring={isExploring}
    >
      {role === "founder" ? (
        <FounderFeedBody items={items as FeedInvestorCard[]} filters={filters} isExploring={isExploring} />
      ) : (
        <InvestorFeedBody items={items as FeedStartupCard[]} filters={filters} isExploring={isExploring} />
      )}
    </FeedShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Shared shell with sidebar
// ──────────────────────────────────────────────────────────────────────────

function FeedShell({
  role,
  accountLabel,
  introCounts,
  filters,
  isExploring,
  children,
}: {
  role: "founder" | "investor";
  accountLabel: AccountLabel;
  introCounts: IntroBadgeCounts;
  filters: FeedFilters;
  isExploring: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <FeedHeader
        eyebrow="Discovery"
        title={role === "founder" ? "Investors who back your stage" : "Startups in your thesis"}
        subtitle={
          isExploring
            ? filters.q
              ? `Searching: "${filters.q}"`
              : "Filtered results — use search and filters to refine your explore."
            : "Personalized matches based on your profile and marketplace fit."
        }
      />

      <main className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-6">
        <IntroInboxBanner counts={introCounts} />
        <AccountStatusBanner label={accountLabel} />
        <Disclaimer />

        {/* Mobile: show a toggle button that opens filters in a drawer */}
        <div className="mt-4 lg:hidden">
          <Suspense fallback={null}>
            <MobileFilterToggle role={role} />
          </Suspense>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          {/* Desktop sidebar — hidden on mobile (handled by drawer above) */}
          <div className="hidden lg:sticky lg:top-6 lg:block lg:self-start">
            <Suspense fallback={<FilterPanelFallback />}>
              <FilterPanel role={role} />
            </Suspense>
            <div className="mt-3">
              <Suspense fallback={null}>
                <SaveSearchButton />
              </Suspense>
            </div>
          </div>

          <section className="min-w-0">
            <Suspense fallback={null}>
              <ActiveFiltersStrip />
            </Suspense>
            {!isExploring && <SuggestedFeedIntro role={role} />}
            {children}
          </section>
        </div>

        <FeedFooter />
      </main>
    </>
  );
}

function FilterPanelFallback() {
  return (
    <div
      className="border bg-[var(--color-surface)] p-4"
      style={{ borderColor: "var(--color-border)" }}
    >
      <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
        Loading filters…
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Bodies
// ──────────────────────────────────────────────────────────────────────────

function InvestorFeedBody({
  items,
  filters,
  isExploring,
}: {
  items: FeedStartupCard[];
  filters: FeedFilters;
  isExploring: boolean;
}) {
  const mode = isExploring ? "explore" : "suggested";
  return (
    <>
      <ResultsHeader count={items.length} filters={filters} mode={mode} />
      {items.length === 0 ? (
        <FeedEmptyState
          title={mode === "suggested" ? "No suggestions yet" : "Nothing matches your filters"}
          hint={
            mode === "suggested"
              ? "Complete your profile details and verification so VentraMatch can rank better recommendations."
              : "Loosen your filters or try a different search query."
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {items.map((it) => (
            <li key={it.card.userId}>
              <FeedCard
                kind="startup"
                data={it.card}
                match={it.match}
                viewerAction={it.viewerAction}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function FounderFeedBody({
  items,
  filters,
  isExploring,
}: {
  items: FeedInvestorCard[];
  filters: FeedFilters;
  isExploring: boolean;
}) {
  const mode = isExploring ? "explore" : "suggested";
  return (
    <>
      <ResultsHeader count={items.length} filters={filters} mode={mode} />
      {items.length === 0 ? (
        <FeedEmptyState
          title={mode === "suggested" ? "No suggestions yet" : "Nothing matches your filters"}
          hint={
            mode === "suggested"
              ? "Complete your profile details and verification so VentraMatch can rank better recommendations."
              : "Loosen your filters or try a different search query."
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {items.map((it) => (
            <li key={it.card.userId}>
              <FeedCard
                kind="investor"
                data={it.card}
                match={it.match}
                viewerAction={it.viewerAction}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Misc presentation
// ──────────────────────────────────────────────────────────────────────────

function SuggestedFeedIntro({ role }: { role: "founder" | "investor" }) {
  const pills = ["Ranked by fit", "Verified profiles only", "Explore with filters"];
  return (
    <div
      className="mb-5 border bg-[var(--color-surface)] p-4"
      style={{ borderColor: "var(--color-border)" }}
    >
      <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-brand)]">
        Suggested for You
      </p>
      <p className="mt-1 text-[14px] font-semibold tracking-tight text-[var(--color-text-strong)]">
        {role === "founder"
          ? "Investors most aligned with your raise"
          : "Startups most aligned with your thesis"}
      </p>
      <p className="mt-1.5 text-[12.5px] leading-[1.55] text-[var(--color-text-muted)]">
        Recommendations ranked by fit across sectors, stage, location, check or raise size, profile
        depth, and marketplace activity. Use filters when you want to explore beyond your suggested
        feed.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {pills.map((label) => (
          <span
            key={label}
            className="inline-flex items-center px-2.5 py-1 text-[11.5px] font-medium"
            style={{
              background: "var(--color-brand-tint)",
              color: "var(--color-brand-strong)",
              border: "1px solid var(--color-brand)",
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function FeedHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
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
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.015em] text-[var(--color-text)]">
          {title}
        </h1>
        <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">{subtitle}</p>
      </div>
    </section>
  );
}

function ResultsHeader({
  count,
  filters,
  mode,
}: {
  count: number;
  filters: FeedFilters;
  mode: "suggested" | "explore";
}) {
  return (
    <header className="mb-3 flex items-baseline justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <p className="text-[13px] font-semibold text-[var(--color-text-strong)]">
          {mode === "suggested" ? "Suggested for You" : "Explore Results"}
        </p>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
          {mode === "suggested"
            ? `${count} suggested match${count === 1 ? "" : "es"}`
            : `${count} result${count === 1 ? "" : "s"} · sorted by ${filters.sort === "score" ? "best match" : "most recent"}`}
        </p>
      </div>
      <Link
        href={"/searches" as Route}
        className="text-[12px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
      >
        Saved searches →
      </Link>
    </header>
  );
}

function FeedEmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div
      className="border border-dashed p-8 text-center"
      style={{ borderColor: "var(--color-border-strong, var(--color-border))" }}
    >
      <p className="text-[14px] font-semibold text-[var(--color-text-strong)]">{title}</p>
      <p className="mt-2 text-[13px] leading-[1.5] text-[var(--color-text-muted)]">{hint}</p>
    </div>
  );
}

function FeedFooter() {
  return (
    <p className="mt-8 text-center text-[12px] leading-[1.6] text-[var(--color-text-faint)]">
      Match scores are heuristic and informational only — not investment
      advice. We never share your contact info until both sides express
      interest.
    </p>
  );
}
