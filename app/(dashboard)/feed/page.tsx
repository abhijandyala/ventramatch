import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { FeedToolbar } from "@/components/feed/feed-toolbar";
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
import { ActiveFiltersStrip } from "@/components/feed/active-filters-strip";
import type { AccountLabel } from "@/types/database";

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
        : mockFeedForFounder(filters)
      : [];
  const investorItems =
    role !== "founder"
      ? (realItems as FeedStartupCard[]).length > 0
        ? (realItems as FeedStartupCard[])
        : mockFeedForInvestor(filters)
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
      {/* Minimal header */}
      <section className="border-b border-[var(--color-border)]">
        <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-4 sm:py-5">
          <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-[var(--color-text)]">Feed</h1>
        </div>
      </section>

      <main className="w-full py-5">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6">
          <IntroInboxBanner counts={introCounts} />
          <AccountStatusBanner label={accountLabel} />

          {/* Toolbar: filter toggle + saved + active chips */}
          <div className="flex items-center gap-3 border-b border-[var(--color-border)] pb-3">
            <Suspense fallback={null}>
              <FeedToolbar role={role} />
            </Suspense>
          </div>

          {/* Active filter chips */}
          <div className="mt-3">
            <Suspense fallback={null}>
              <ActiveFiltersStrip />
            </Suspense>
          </div>
        </div>

        {/* Feed grid */}
        <section className="mx-auto mt-4 max-w-[1440px] px-4 sm:px-6">
          {children}
        </section>

        <div className="mx-auto max-w-[1440px] px-4 sm:px-6">
          <FeedFooter />
        </div>
      </main>
    </>
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
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ borderTop: "1.5px solid oklch(80% 0.015 235)", borderLeft: "1.5px solid oklch(80% 0.015 235)" }}>
          {items.map((it, i) => (
            <li
              key={it.card.userId}
              className="relative min-h-[220px] min-w-0 bg-white"
              style={{
                borderRight: "1.5px solid oklch(80% 0.015 235)",
                borderBottom: "3px solid oklch(78% 0.018 235)",
              }}
            >
              <FeedCard kind="startup" data={it.card} match={it.match} viewerAction={it.viewerAction} col={i % 3} />
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
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ borderTop: "1.5px solid oklch(80% 0.015 235)", borderLeft: "1.5px solid oklch(80% 0.015 235)" }}>
          {items.map((it, i) => (
            <li
              key={it.card.userId}
              className="relative min-h-[220px] min-w-0 bg-white"
              style={{
                borderRight: "1.5px solid oklch(80% 0.015 235)",
                borderBottom: "3px solid oklch(78% 0.018 235)",
              }}
            >
              <FeedCard kind="investor" data={it.card} match={it.match} viewerAction={it.viewerAction} col={i % 3} />
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


function ResultsHeader({ count, filters }: { count: number; filters: FeedFilters }) {
  return (
    <header className="mb-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
        {count} result{count === 1 ? "" : "s"} · sorted by {filters.sort === "score" ? "best match" : "most recent"}
      </p>
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
