import type { Route } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { fetchMutualMatches, type MutualMatch } from "@/lib/feed/query";
import { fetchIntroBadgeCounts } from "@/lib/intros/query";
import { AccountStatusBanner } from "@/components/account/account-status-banner";
import { IntroInboxBanner } from "@/components/intros/intro-inbox-banner";
import type { AccountLabel } from "@/types/database";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STAGE_LABEL = {
  idea: "Idea",
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  series_b_plus: "Series B+",
} as const;

export default async function MatchesPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!session.user.onboardingCompleted) redirect("/onboarding");

  const userId = session.user.id;
  const accountLabel = (session.user.accountLabel ?? "unverified") as AccountLabel;

  const [matches, introCounts] = await Promise.all([
    fetchMutualMatches(userId),
    fetchIntroBadgeCounts(userId),
  ]);
  console.log(`[matches] userId=${userId} count=${matches.length}`);

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
        <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 py-5 sm:py-6">
          <p className="text-[11px] font-medium tracking-[0.08em] uppercase text-[var(--color-text-faint)]">
            Matches
          </p>
          <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.015em] text-[var(--color-text)]">
            Mutual interest
          </h1>
          <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
            {matches.length === 0
              ? "No mutual matches yet — keep going on the feed."
              : `${matches.length} mutual match${matches.length === 1 ? "" : "es"}.`}
          </p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 py-6">
        <IntroInboxBanner counts={introCounts} />
        <AccountStatusBanner label={accountLabel} />

        {matches.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid grid-cols-1 gap-3">
            {matches.map((m) => (
              <li key={m.matchId}>
                <MatchRow match={m} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function MatchRow({ match }: { match: MutualMatch }) {
  const profileHref = `/p/${match.otherUserId}` as Route;
  const isInvestorViewer = match.otherRole === "founder";
  const headline = isInvestorViewer
    ? match.startupName ?? "Founder"
    : `${match.investorName ?? "Investor"}${match.firm ? ` · ${match.firm}` : ""}`;
  const subline = isInvestorViewer
    ? [match.industry, match.stage ? STAGE_LABEL[match.stage] : null]
        .filter(Boolean)
        .join(" · ")
    : match.firm ?? "Solo angel";

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-4 border bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-text-faint)]"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div className="min-w-0 flex-1">
        <Link
          href={profileHref}
          className="block truncate text-[15px] font-semibold tracking-tight text-[var(--color-text-strong)] hover:underline"
        >
          {headline}
        </Link>
        <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-muted)]">
          {subline || "—"}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3 text-[12px] text-[var(--color-text-faint)]">
        <span>{relativeTime(match.matchedAt)}</span>
        {match.contactUnlocked ? (
          <span
            className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium"
            style={{
              background: "var(--color-brand-tint)",
              color: "var(--color-brand-strong)",
              border: "1px solid var(--color-brand)",
            }}
          >
            Contact unlocked
          </span>
        ) : null}
        <Link
          href={profileHref}
          className="inline-flex h-9 items-center px-3 text-[12.5px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
        >
          View profile
        </Link>
        <Link
          href={profileHref}
          className="inline-flex h-9 items-center px-3 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--color-brand)" }}
        >
          Request a call →
        </Link>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="border border-dashed p-8 text-center"
      style={{ borderColor: "var(--color-border-strong, var(--color-border))" }}
    >
      <p className="text-[14px] font-semibold text-[var(--color-text-strong)]">
        No mutual matches yet
      </p>
      <p className="mt-2 text-[13px] leading-[1.5] text-[var(--color-text-muted)]">
        When you and another user both express interest, they&apos;ll show up
        here with contact details unlocked.
      </p>
      <Link
        href={"/feed" as Route}
        className="mt-4 inline-flex h-9 items-center px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        style={{ background: "var(--color-text-strong)" }}
      >
        Go to feed
      </Link>
    </div>
  );
}

function relativeTime(d: Date): string {
  const now = Date.now();
  const ms = now - d.getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 4) return `${wk}w ago`;
  return d.toLocaleDateString();
}
