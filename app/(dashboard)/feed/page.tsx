import type { Route } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  founderDashboardMock,
  getSampleStartupById,
  investorFeedMock,
  type SampleStartup,
} from "@/lib/dashboards/mock-data";
import { TopStartupCard } from "@/components/dashboard/TopStartupCard";
import { TopMatchCard } from "@/components/dashboard/TopMatchCard";
import { RecommendedStartupCard } from "@/components/dashboard/RecommendedStartupCard";
import { RecommendedInvestorCard } from "@/components/dashboard/RecommendedInvestorCard";
import { ActionRequiredCard } from "@/components/dashboard/ActionRequiredCard";
import { ProfilePerformanceCard } from "@/components/dashboard/ProfilePerformanceCard";
import { ImproveMatchesCard } from "@/components/dashboard/ImproveMatchesCard";
import { ProfileCompletionCard } from "@/components/dashboard/ProfileCompletionCard";
import { CombinedActivityCard } from "@/components/dashboard/CombinedActivityCard";
import { MatchAnalysisCard } from "@/components/dashboard/MatchAnalysisCard";
import { WhyYouAreAGreatFitCard } from "@/components/dashboard/WhyYouAreAGreatFitCard";
import { Disclaimer } from "@/components/common/Disclaimer";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type FeedPageProps = {
  searchParams: Promise<{ focus?: string }>;
};

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!session.user.onboardingCompleted) redirect("/onboarding");

  const role = session.user.role as "founder" | "investor" | null;
  const firstName = session.user.name?.split(" ")[0] ?? "there";
  const params = await searchParams;

  if (role === "investor") {
    return <InvestorFeedView firstName={firstName} searchParams={params} />;
  }

  return <FounderFeedView firstName={firstName} />;
}

function FounderFeedView({ firstName }: { firstName: string }) {
  const data = founderDashboardMock;
  const profileComplete = data.profileStrength.percent >= 100;

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
            Founder feed
          </p>
          <h1 className="mt-1 text-[20px] leading-7 font-semibold tracking-[-0.015em] text-[var(--color-text)]">
            Welcome back, {firstName}.
          </h1>
          <p className="mt-0.5 text-[13px] leading-5 text-[var(--color-text-muted)]">
            Three investors fit your raise this week. Two are active.
          </p>
        </div>
      </section>

      <main className="dashboard mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-5 lg:py-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          <section className="lg:col-span-8 flex flex-col gap-5">
            <TopMatchCard matches={data.topMatches} newToday={data.newInvestorsToday} />
            <Disclaimer />

            <section aria-labelledby="feed-recommended-founders" className="flex flex-col">
              <header className="flex items-baseline justify-between gap-4">
                <h2
                  id="feed-recommended-founders"
                  className="text-[15px] leading-5 font-semibold tracking-tight text-[var(--color-text)]"
                >
                  Recommended for you
                </h2>
                <ViewAllLink href="/matches" label="View all" />
              </header>

              <ul className="mt-3 flex flex-col gap-3">
                {data.recommended.map((investor) => (
                  <li key={investor.id}>
                    <RecommendedInvestorCard investor={investor} />
                  </li>
                ))}
              </ul>
            </section>
          </section>

          <aside className="lg:col-span-4 flex flex-col">
            <div className="rounded-none border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
              <RailSection title="Action required" aside={`${data.actionRequired.length} items`}>
                <ActionRequiredCard items={data.actionRequired} borderless />
              </RailSection>
              <div className="h-[1px] w-full bg-[var(--color-text)]" style={{ opacity: 0.12 }} />
              <RailSection title="Profile performance" aside="(this month)">
                <ProfilePerformanceCard
                  stats={data.profilePerformance.stats}
                  series={data.profilePerformance.series}
                  borderless
                />
              </RailSection>
              <div className="h-[1px] w-full bg-[var(--color-text)]" style={{ opacity: 0.12 }} />
              <RailSection title="How to improve your matches" aside={undefined}>
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

        <section
          aria-label="Profile and activity overview"
          className={cn(
            "mt-5 grid grid-cols-1 gap-3",
            profileComplete ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3",
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

function InvestorFeedView({
  firstName,
  searchParams,
}: {
  firstName: string;
  searchParams: { focus?: string };
}) {
  const data = investorFeedMock;

  const defaultTop = data.startups[0];
  const focused: SampleStartup =
    (searchParams.focus && getSampleStartupById(searchParams.focus)) || defaultTop;

  const remainingStartups =
    searchParams.focus == null
      ? data.startups.filter((s) => s.id !== defaultTop.id)
      : data.startups.filter((s) => s.id !== focused.id);

  const profileComplete = data.profileStrength.percent >= 100;

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
            Investor feed
          </p>
          <h1 className="mt-1 text-[20px] leading-7 font-semibold tracking-[-0.015em] text-[var(--color-text)]">
            Welcome back, {firstName}.
          </h1>
          <p className="mt-0.5 text-[13px] leading-5 text-[var(--color-text-muted)]">
            Four new startups matched your thesis today.
          </p>
        </div>
      </section>

      <main className="dashboard mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-5 lg:py-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          <section className="lg:col-span-8 flex flex-col gap-5">
            <TopStartupCard
              startups={data.startups}
              focusedId={focused.id}
              newToday={data.newStartupsToday}
            />
            <Disclaimer />

            <section aria-labelledby="recommended-startups-title" className="flex flex-col">
              <header className="flex items-baseline justify-between gap-4">
                <h2
                  id="recommended-startups-title"
                  className="text-[15px] leading-5 font-semibold tracking-tight text-[var(--color-text)]"
                >
                  Recommended for you
                </h2>
                <ViewAllLink href="/matches" label="View all" />
              </header>

              <ul className="mt-3 flex flex-col gap-3">
                {remainingStartups.slice(0, 5).map((startup) => (
                  <li key={startup.id}>
                    <RecommendedStartupCard startup={startup} />
                  </li>
                ))}
              </ul>
            </section>
          </section>

          <aside className="lg:col-span-4 flex flex-col">
            <div className="rounded-none border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
              <RailSection title="Match analysis" aside={focused.name}>
                <MatchAnalysisCard startup={focused} borderless />
              </RailSection>
              <div className="h-[1px] w-full bg-[var(--color-text)]" style={{ opacity: 0.12 }} />
              <RailSection title="Profile performance" aside="(this month)">
                <ProfilePerformanceCard
                  stats={data.profilePerformance.stats}
                  series={data.profilePerformance.series}
                  borderless
                />
              </RailSection>
              <div className="h-[1px] w-full bg-[var(--color-text)]" style={{ opacity: 0.12 }} />
              <RailSection title="How to improve your matches" aside={undefined}>
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

        <section
          aria-label="Activity overview"
          className={cn(
            "mt-5 grid grid-cols-1 gap-3",
            profileComplete ? "md:grid-cols-1" : "md:grid-cols-2",
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
          <CombinedActivityCard
            actions={data.actionRequired}
            activity={data.startupActivity}
          />
        </section>
      </main>
    </>
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
      <header className="flex items-baseline justify-between gap-2 mb-4">
        <h3 className="text-[14px] leading-5 font-semibold tracking-tight text-[var(--color-text)]">
          {title}
        </h3>
        {aside && (
          <span className="text-[12px] leading-4 text-[var(--color-text-faint)]">
            {aside}
          </span>
        )}
      </header>
      {children}
    </div>
  );
}
