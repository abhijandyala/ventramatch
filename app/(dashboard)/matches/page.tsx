import type { Route } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { fetchMutualMatches, type MutualMatch } from "@/lib/feed/query";
import { fetchIntroBadgeCounts } from "@/lib/intros/query";
import { AccountStatusBanner } from "@/components/account/account-status-banner";
import { IntroInboxBanner } from "@/components/intros/intro-inbox-banner";
import { Avatar } from "@/components/profile/avatar";
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

function formatStage(stage: string | undefined): string | null {
  if (!stage) return null;
  return (STAGE_LABEL as Record<string, string>)[stage] ?? stage;
}

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

  const subtitle =
    matches.length === 0
      ? "No mutual matches yet. Keep discovering high-fit profiles."
      : matches.length === 1
        ? "1 mutual match. Contact details are available through the matched profile."
        : `${matches.length} mutual matches. Prioritize the ones worth a next step.`;

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
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
            Matches
          </p>
          <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.015em] text-[var(--color-text)]">
            Mutual interest
          </h1>
          <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">{subtitle}</p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 py-6">
        <IntroInboxBanner counts={introCounts} />
        <AccountStatusBanner label={accountLabel} />

        {matches.length > 0 && <MatchSummaryStrip matches={matches} />}

        {matches.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-3">
            {matches.map((m) => (
              <li key={m.matchId}>
                <MatchRow match={m} />
              </li>
            ))}
          </ul>
        )}

        <ComplianceNote />
      </main>
    </>
  );
}

// ── Summary strip ──────────────────────────────────────────────────────────

function MatchSummaryStrip({ matches }: { matches: MutualMatch[] }) {
  const contactCount = matches.filter((m) => m.contactUnlocked).length;
  // fetchMutualMatches orders by matched_at desc — first row is most recent
  const mostRecent = matches[0];

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <SummaryCell label="Total" value={String(matches.length)} />
      <SummaryCell label="Contact available" value={String(contactCount)} />
      {mostRecent && (
        <SummaryCell label="Most recent" value={relativeTime(mostRecent.matchedAt)} />
      )}
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col px-3 py-2"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
        {label}
      </span>
      <span className="mt-0.5 text-[13px] font-semibold tabular-nums text-[var(--color-text-strong)]">
        {value}
      </span>
    </div>
  );
}

// ── Match row ──────────────────────────────────────────────────────────────

function MatchRow({ match }: { match: MutualMatch }) {
  const profileHref = `/p/${match.otherUserId}` as Route;
  const isOtherFounder = match.otherRole === "founder";

  // Primary headline: strongest identifier for the other party.
  // Founder → startup name first (most recognisable unit); investor → investor name.
  const headline = isOtherFounder
    ? (match.startupName ?? match.otherName ?? "Founder")
    : (match.investorName ?? "Investor");

  // Secondary line: person context distinct from the headline.
  // Founder: the person's own name — but only when it differs from the headline
  // (avoids repeating the name if there's no startup name yet).
  // Investor: the firm, or a neutral fallback.
  const secondary = isOtherFounder
    ? (match.otherName !== headline ? match.otherName : null)
    : (match.firm ?? "Solo investor");

  // Context chips: industry + stage only for startups.
  // For investors, firm already appears in the secondary line — no need to repeat.
  const chips: string[] = [];
  if (isOtherFounder) {
    if (match.industry) chips.push(match.industry);
    const stageLabel = formatStage(match.stage);
    if (stageLabel) chips.push(stageLabel);
  }

  return (
    <article
      className="border bg-[var(--color-surface)] transition-colors hover:border-[var(--color-text-faint)]"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Left: avatar + identity */}
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Avatar
            id={match.otherUserId}
            name={match.otherName}
            src={match.otherAvatarSrc}
            size="md"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={profileHref}
                className="text-[15px] font-semibold tracking-tight text-[var(--color-text-strong)] hover:underline"
              >
                {headline}
              </Link>
              <RoleChip role={match.otherRole} />
            </div>
            {secondary && (
              <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{secondary}</p>
            )}
            {chips.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium"
                    style={{
                      background: "var(--color-brand-tint)",
                      color: "var(--color-brand-strong)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: time + contact state + action */}
        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <span className="text-[11.5px] text-[var(--color-text-faint)]">
            {relativeTime(match.matchedAt)}
          </span>
          <ContactStatePill unlocked={match.contactUnlocked} />
          <Link
            href={profileHref}
            className="inline-flex h-9 items-center px-4 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--color-brand)" }}
          >
            Open profile
          </Link>
        </div>
      </div>
    </article>
  );
}

function RoleChip({ role }: { role: "founder" | "investor" }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.05em]"
      style={{
        background: "var(--color-surface-2)",
        color: "var(--color-text-muted)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-sm)",
      }}
    >
      {role === "founder" ? "Founder" : "Investor"}
    </span>
  );
}

function ContactStatePill({ unlocked }: { unlocked: boolean }) {
  if (unlocked) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium"
        style={{
          background: "var(--color-brand-tint)",
          color: "var(--color-brand-strong)",
          border: "1px solid var(--color-brand)",
          borderRadius: "var(--radius-sm)",
        }}
      >
        Contact available
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium"
      style={{
        background: "var(--color-surface)",
        color: "var(--color-text-faint)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-sm)",
      }}
    >
      Mutual interest recorded
    </span>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

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
        When you and another user both express interest, they&apos;ll appear here with the next
        step available.
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

// ── Compliance note ────────────────────────────────────────────────────────

function ComplianceNote() {
  return (
    <p className="mt-8 text-center text-[12px] leading-[1.6] text-[var(--color-text-faint)]">
      VentraMatch surfaces mutual interest. It does not recommend investments or promise funding.
    </p>
  );
}
