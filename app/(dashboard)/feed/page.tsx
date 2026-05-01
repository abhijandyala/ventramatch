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
import { parseFeedFilters, type FeedFilters } from "@/lib/feed/filters";
import { AccountStatusBanner } from "@/components/account/account-status-banner";
import { IntroInboxBanner } from "@/components/intros/intro-inbox-banner";
import { FeedCard } from "@/components/feed/feed-card";
import { FilterPanel } from "@/components/feed/filter-panel";
import { ActiveFiltersStrip } from "@/components/feed/active-filters-strip";
import { SaveSearchButton } from "@/components/feed/save-search-button";
import { Disclaimer } from "@/components/common/Disclaimer";
import type { AccountLabel } from "@/types/database";
import { cn } from "@/lib/utils";
import {
  mockFeedForFounder,
  mockFeedForInvestor,
} from "@/lib/recommendations/mock-feed-adapter";

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

  console.log(
    `[feed] userId=${userId} role=${role} q=${filters.q ?? ""} sort=${filters.sort} industries=${filters.industries.length}`,
  );

  const [introCounts, realItems] = await Promise.all([
    fetchIntroBadgeCounts(userId),
    role === "founder"
      ? fetchFeedForFounder(userId, { limit: 50, filters })
      : fetchFeedForInvestor(userId, { limit: 50, filters }),
  ]);

  // When the real feed is empty (no verified users yet), backfill with
  // mock profiles so the product is demo-able. Once real users populate
  // the DB, mock items are never shown (real items take priority).
  const founderItems =
    role === "founder"
      ? (realItems as FeedInvestorCard[]).length > 0
        ? (realItems as FeedInvestorCard[])
        : mockFeedForFounder()
      : [];
  const investorItems =
    role !== "founder"
      ? (realItems as FeedStartupCard[]).length > 0
        ? (realItems as FeedStartupCard[])
        : mockFeedForInvestor()
      : [];

  return (
    <FeedShell
      role={role ?? "investor"}
      accountLabel={accountLabel}
      introCounts={introCounts}
      filters={filters}
    >
      {role === "founder" ? (
        <FounderFeedBody items={founderItems} filters={filters} />
      ) : (
        <InvestorFeedBody items={investorItems} filters={filters} />
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
  children,
}: {
  role: "founder" | "investor";
  accountLabel: AccountLabel;
  introCounts: IntroBadgeCounts;
  filters: FeedFilters;
  children: React.ReactNode;
}) {
  return (
    <>
      <FeedHeader
        eyebrow="Discovery"
        title={role === "founder" ? "Investors who back your stage" : "Startups in your thesis"}
        subtitle={
          filters.q
            ? `Searching: "${filters.q}"`
            : "Verified profiles only. Filters and search live in the URL — share or save them."
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
}: {
  items: FeedStartupCard[];
  filters: FeedFilters;
}) {
  return (
    <>
      <ResultsHeader count={items.length} filters={filters} />
      {items.length === 0 ? (
        <FeedEmptyState
          hint={
            filters.q || filters.industries.length || filters.stages.length
              ? "Loosen your filters or try a different search query."
              : "Check that your sectors, stages, and check size are filled out — those drive the filter."
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
}: {
  items: FeedInvestorCard[];
  filters: FeedFilters;
}) {
  return (
    <>
      <ResultsHeader count={items.length} filters={filters} />
      {items.length === 0 ? (
        <FeedEmptyState
          hint={
            filters.q || filters.industries.length || filters.stages.length
              ? "Loosen your filters or try a different search query."
              : "Make sure your stage and target raise are filled out — those drive the filter."
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

function ResultsHeader({ count, filters }: { count: number; filters: FeedFilters }) {
  return (
    <header className="mb-3 flex items-baseline justify-between gap-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
        {count} result{count === 1 ? "" : "s"} · sorted by {filters.sort === "score" ? "best match" : "most recent"}
      </p>
      <Link
        href={"/searches" as Route}
        className="text-[12px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
      >
        Saved searches →
      </Link>
    </header>
  );
}

function FeedEmptyState({ hint }: { hint: string }) {
  return (
    <div
      className="border border-dashed p-8 text-center"
      style={{ borderColor: "var(--color-border-strong, var(--color-border))" }}
    >
      <p className="text-[14px] font-semibold text-[var(--color-text-strong)]">
        Nothing matches your filters
      </p>
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
