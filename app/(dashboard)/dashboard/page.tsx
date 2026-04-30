import type { Route } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { withUserRls } from "@/lib/db";
import {
  founderDashboardMock,
  investorFeedMock,
  type InvestorFeed,
  type ProfileChecklistItem,
} from "@/lib/dashboards/mock-data";
import { StatBlock } from "@/components/dashboard/StatBlock";
import { ActionRequiredCard } from "@/components/dashboard/ActionRequiredCard";
import { ProfilePerformanceCard } from "@/components/dashboard/ProfilePerformanceCard";
import { ImproveMatchesCard } from "@/components/dashboard/ImproveMatchesCard";
import { ProfileCompletionCard } from "@/components/dashboard/ProfileCompletionCard";
import { CombinedActivityCard } from "@/components/dashboard/CombinedActivityCard";
import { WhyYouAreAGreatFitCard } from "@/components/dashboard/WhyYouAreAGreatFitCard";
import { Disclaimer } from "@/components/common/Disclaimer";
import { AccountStatusBanner } from "@/components/account/account-status-banner";
import { ProfileCompletionPrompt } from "@/components/account/profile-completion-prompt";
import { RealRecommendedRail } from "@/components/dashboard/RealRecommendedRail";
import { RecentViewersRail } from "@/components/dashboard/RecentViewersRail";
import {
  founderCompletion,
  investorCompletion,
  type CompletionResult,
} from "@/lib/profile/completion";
import {
  fetchFeedForFounder,
  fetchFeedForInvestor,
  fetchProfileStats,
  fetchRecentViewers,
  type FeedStartupCard,
  type FeedInvestorCard,
  type ProfileStats,
  type RecentViewer,
} from "@/lib/feed/query";
import {
  fetchIntroBadgeCounts,
  type IntroBadgeCounts,
} from "@/lib/intros/query";
import { IntroInboxBanner } from "@/components/intros/intro-inbox-banner";
import type { AccountLabel, Database } from "@/types/database";
import { cn } from "@/lib/utils";

type StartupRow = Database["public"]["Tables"]["startups"]["Row"];
type InvestorRow = Database["public"]["Tables"]["investors"]["Row"];

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!session.user.onboardingCompleted) redirect("/onboarding");

  const userId = session.user.id;
  const role = session.user.role as "founder" | "investor" | null;
  const firstName = session.user.name?.split(" ")[0] ?? "there";
  const accountLabel = (session.user.accountLabel ?? "unverified") as AccountLabel;

  console.log(`[dashboard] userId=${userId} role=${role} label=${accountLabel}`);

  const [completion, stats, feedItems, introCounts, recentViewers] = await Promise.all([
    withUserRls<CompletionResult>(userId, async (sql) => {
      if (role === "investor") {
        const rows = await sql<InvestorRow[]>`
          select * from public.investors where user_id = ${userId} limit 1
        `;
        return investorCompletion(rows[0] ?? null);
      }
      const rows = await sql<StartupRow[]>`
        select * from public.startups where user_id = ${userId} limit 1
      `;
      return founderCompletion(rows[0] ?? null);
    }),
    fetchProfileStats(userId),
    role === "investor"
      ? fetchFeedForInvestor(userId, { limit: 3 })
      : fetchFeedForFounder(userId, { limit: 3 }),
    fetchIntroBadgeCounts(userId),
    fetchRecentViewers(userId, { limit: 8 }),
  ]);

  if (role === "investor") {
    return (
      <InvestorDashboard
        firstName={firstName}
        accountLabel={accountLabel}
        completion={completion}
        stats={stats}
        feedItems={feedItems as FeedStartupCard[]}
        introCounts={introCounts}
        recentViewers={recentViewers}
      />
    );
  }

  return (
    <FounderDashboard
      firstName={firstName}
      accountLabel={accountLabel}
      completion={completion}
      stats={stats}
      feedItems={feedItems as FeedInvestorCard[]}
      introCounts={introCounts}
      recentViewers={recentViewers}
    />
  );
}

function FounderDashboard({
  firstName,
  accountLabel,
  completion,
  stats,
  feedItems,
  introCounts,
  recentViewers,
}: {
  firstName: string;
  accountLabel: AccountLabel;
  completion: CompletionResult;
  stats: ProfileStats;
  feedItems: FeedInvestorCard[];
  introCounts: IntroBadgeCounts;
  recentViewers: RecentViewer[];
}) {
  const data = founderDashboardMock;
  const profileComplete = completion.pct >= 100;
  const checklist = completionToChecklist(completion);

  return (
    <>
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
            Founder dashboard
          </p>
          <h1 className="mt-1 text-[20px] leading-7 font-semibold tracking-[-0.015em] text-[var(--color-text)]">
            Welcome back, {firstName}.
          </h1>
          <p className="mt-0.5 text-[13px] leading-5 text-[var(--color-text-muted)]">
            {stats.likes} likes · {stats.saves} saves received · {recentViewers.length} unique profile viewers
            (30 days).
          </p>
        </div>
      </section>

      <main className="dashboard mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-5 lg:py-6">
        <IntroInboxBanner counts={introCounts} />
        <AccountStatusBanner label={accountLabel} />
        <ProfileCompletionPrompt
          completion={completion}
          accountLabel={accountLabel}
          ctaHref="/build"
        />
        <RealRecommendedRail kind="founder" items={feedItems} stats={stats} />
        <RecentViewersRail viewers={recentViewers} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          <section className="lg:col-span-8 flex flex-col gap-5">
            <Disclaimer />
            <FeedCtaStrip
              href="/feed"
              message="Open the full investor discovery feed"
              sub="Filters, saved searches, and URL-shareable results"
            />
          </section>

          <aside className="lg:col-span-4 flex flex-col">
            <div className="rounded-none border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
              <RailSection title="Action required" aside={`${data.actionRequired.length} items`}>
                <ActionRequiredCard items={data.actionRequired} borderless />
              </RailSection>
              <SectionDivider />
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
                  completionPct={completion.pct}
                  completeHref="/build"
                  borderless
                />
              </RailSection>
            </div>
          </aside>
        </div>

        <section
          aria-label="Profile and activity overview"
          className={cn(
            "mt-5 grid grid-cols-1 gap-3",
            profileComplete ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3",
          )}
        >
          {!profileComplete && (
            <ProfileCompletionCard
              percent={completion.pct}
              band={bandFromPct(completion.pct)}
              upliftPct={completionUpliftEstimate(completion)}
              checklist={checklist}
            />
          )}
          <CombinedActivityCard
            actions={data.actionRequired}
            activity={data.investorActivity}
          />
          <WhyYouAreAGreatFitCard bullets={data.greatFitBullets} />
        </section>
      </main>
    </>
  );
}

function InvestorDashboard({
  firstName,
  accountLabel,
  completion,
  stats,
  feedItems,
  introCounts,
  recentViewers,
}: {
  firstName: string;
  accountLabel: AccountLabel;
  completion: CompletionResult;
  stats: ProfileStats;
  feedItems: FeedStartupCard[];
  introCounts: IntroBadgeCounts;
  recentViewers: RecentViewer[];
}) {
  const data = investorFeedMock;
  const profileComplete = completion.pct >= 100;
  const checklist = completionToChecklist(completion);

  return (
    <>
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
            Investor dashboard
          </p>
          <h1 className="mt-1 text-[20px] leading-7 font-semibold tracking-[-0.015em] text-[var(--color-text)]">
            Welcome back, {firstName}.
          </h1>
          <p className="mt-0.5 text-[13px] leading-5 text-[var(--color-text-muted)]">
            {feedItems.length} startups in your live top picks · {stats.matches} mutual matches ·{" "}
            {recentViewers.length} thesis profile views (30 days).
          </p>
        </div>
      </section>

      <main className="dashboard mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-5 lg:py-6">
        <IntroInboxBanner counts={introCounts} />
        <AccountStatusBanner label={accountLabel} />
        <ProfileCompletionPrompt
          completion={completion}
          accountLabel={accountLabel}
          ctaHref="/build/investor"
        />
        <RealRecommendedRail kind="investor" items={feedItems} stats={stats} />
        <RecentViewersRail viewers={recentViewers} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          <section className="lg:col-span-8 flex flex-col gap-5">
            <PipelineFunnelSection activity={data.activity} />
            <Disclaimer />
            <FeedCtaStrip
              href="/feed"
              message="Open the full startup discovery feed"
              sub="Filters, saved searches, and URL-shareable results"
            />
          </section>

          <aside className="lg:col-span-4 flex flex-col">
            <div className="rounded-none border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
              <RailSection title="Action required" aside={`${data.actionRequired.length} items`}>
                <ActionRequiredCard items={data.actionRequired} borderless />
              </RailSection>
              <SectionDivider />
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
                  completionPct={completion.pct}
                  completeHref="/build/investor"
                  borderless
                />
              </RailSection>
            </div>
          </aside>
        </div>

        <section
          aria-label="Pipeline and activity overview"
          className={cn(
            "mt-5 grid grid-cols-1 gap-3",
            profileComplete ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3",
          )}
        >
          {!profileComplete && (
            <ProfileCompletionCard
              percent={completion.pct}
              band={bandFromPct(completion.pct)}
              upliftPct={completionUpliftEstimate(completion)}
              checklist={checklist}
            />
          )}
          <CombinedActivityCard
            actions={data.actionRequired}
            activity={data.startupActivity}
          />
          <WhyYouAreAGreatFitCard bullets={data.greatFitBullets} />
        </section>
      </main>
    </>
  );
}

function completionToChecklist(completion: CompletionResult): ProfileChecklistItem[] {
  return [...completion.done, ...completion.missing].map((c) => ({
    id: c.id,
    label: c.label,
    href: c.href,
    done: c.done,
  }));
}

function bandFromPct(pct: number): "Weak" | "Improving" | "Strong" | "Excellent" {
  if (pct >= 95) return "Excellent";
  if (pct >= 75) return "Strong";
  if (pct >= 45) return "Improving";
  return "Weak";
}

/** Rough signal from remaining checklist weight; capped for honest framing. */
function completionUpliftEstimate(completion: CompletionResult): number {
  const raw = completion.missing.reduce((s, m) => s + m.weight, 0);
  return Math.min(35, Math.max(6, Math.round(raw * 0.25)));
}

function PipelineFunnelSection({
  activity,
}: {
  activity: InvestorFeed["activity"];
}) {
  const [viewed, saved, messages, meetings] = activity;
  const saveRate = viewed.value > 0 ? Math.round((saved.value / viewed.value) * 100) : 0;
  const msgRate = saved.value > 0 ? Math.round((messages.value / saved.value) * 100) : 0;
  const meetRate = messages.value > 0 ? Math.round((meetings.value / messages.value) * 100) : 0;

  const stages = [
    { stat: viewed, rate: null },
    { stat: saved, rate: saveRate },
    { stat: messages, rate: msgRate },
    { stat: meetings, rate: meetRate },
  ];

  return (
    <section aria-labelledby="funnel-title">
      <header className="flex items-baseline justify-between gap-4 mb-3">
        <h2
          id="funnel-title"
          className="text-[15px] leading-5 font-semibold tracking-tight text-[var(--color-text)]"
        >
          Deal flow this month
        </h2>
        <ViewAllLink href="/feed" label="Open feed" />
      </header>
      <div className="border border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto">
        <div className="flex min-w-max items-stretch">
          {stages.map(({ stat, rate }, i) => (
            <div key={stat.label} className="flex items-stretch">
              {i > 0 && (
                <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 border-l border-[var(--color-border)] px-3">
                  <ArrowRight
                    aria-hidden
                    size={13}
                    strokeWidth={1.5}
                    className="text-[var(--color-text-faint)]"
                  />
                  <span className="text-[11px] font-medium tabular-nums text-[var(--color-text-faint)]">
                    {rate}%
                  </span>
                </div>
              )}
              <div className="flex min-w-[120px] flex-col gap-0.5 p-5">
                <StatBlock label={stat.label} value={stat.value} delta={stat.delta} size="sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeedCtaStrip({
  href,
  message,
  sub,
}: {
  href: string;
  message: string;
  sub: string;
}) {
  return (
    <Link
      href={href as Route}
      className={cn(
        "group flex items-center justify-between gap-4",
        "border border-[var(--color-border)] bg-[var(--color-surface)]",
        "px-5 py-4",
        "transition-colors duration-[120ms] ease-out",
        "hover:border-[var(--color-text-faint)] hover:bg-[var(--color-surface-2)]",
      )}
    >
      <div>
        <p className="text-[14px] font-semibold tracking-tight text-[var(--color-text)]">
          {message}
        </p>
        <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">{sub}</p>
      </div>
      <ArrowRight
        aria-hidden
        size={16}
        strokeWidth={1.75}
        className={cn(
          "shrink-0 text-[var(--color-text-faint)]",
          "transition-transform duration-[120ms] ease-out",
          "group-hover:translate-x-0.5 group-hover:text-[var(--color-text-muted)]",
        )}
      />
    </Link>
  );
}

function ViewAllLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href as Route}
      className={cn(
        "inline-flex items-center gap-1",
        "text-[12px] font-medium text-[var(--color-text-muted)]",
        "transition-colors duration-[120ms] ease-out",
        "hover:text-[var(--color-text)]",
      )}
    >
      {label}
      <ArrowRight aria-hidden size={12} strokeWidth={1.75} />
    </Link>
  );
}

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
      <header className="mb-4 flex items-baseline justify-between gap-2">
        <h3 className="text-[14px] font-semibold leading-5 tracking-tight text-[var(--color-text)]">
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
  return <div className="h-[1px] w-full bg-[var(--color-text)]" style={{ opacity: 0.12 }} />;
}
