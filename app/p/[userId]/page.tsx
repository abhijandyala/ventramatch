import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import {
  projectInvestorDepth,
  projectInvestorTier1,
  projectInvestorTier2,
  projectStartupDepth,
  projectStartupTier1,
  projectStartupTier2,
  projectVerifications,
  resolveTier,
  type InvestorDepthView,
  type StartupDepthView,
  type VerificationBadge,
  type ViewingTier,
} from "@/lib/profile/visibility";
import {
  fetchConfirmedVerifications,
  fetchInvestorDepth,
  fetchStartupDepth,
} from "@/lib/profile/depth";
import { scoreMatch } from "@/lib/matching/score";
import { fetchPendingIntroForMatch } from "@/lib/intros/query";
import { recordProfileView } from "@/lib/profile/views";
import { isBlockedEitherWay } from "@/lib/safety/query";
import { ProfileMenu } from "@/components/safety/profile-menu";
import { VerificationBadges } from "@/components/account/verification-badges";
import { DepthVerificationBadges } from "@/components/account/depth-verification-badges";
import {
  InvestorDepthSections,
  StartupDepthSections,
} from "@/components/profile/depth-sections";
import { IntroCta } from "@/components/intros/intro-cta";
import { Wordmark } from "@/components/landing/wordmark";
import type {
  AccountLabel,
  Database,
  StartupStage,
  UserRole,
} from "@/types/database";

export const dynamic = "force-dynamic";

type StartupRow = Database["public"]["Tables"]["startups"]["Row"];
type InvestorRow = Database["public"]["Tables"]["investors"]["Row"];

type TargetUser = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole | null;
  account_label: AccountLabel;
  email_verified_at: Date | string | null;
  linkedin_url: string | null;
  github_url: string | null;
};

export const metadata: Metadata = {
  title: "Profile — VentraMatch",
  robots: { index: false, follow: false },
};

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId: targetUserId } = await params;

  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const viewerId = session.user.id;
  const viewerRole = session.user.role as UserRole | null;
  const viewerLabel = (session.user.accountLabel ?? "unverified") as AccountLabel;

  // Load the target user + their canonical row + viewer's matching data.
  const data = await withUserRls(viewerId, async (sql) => {
    const [users, startups, investors] = await Promise.all([
      sql<TargetUser[]>`
        select id, name, email, role, account_label, email_verified_at,
               linkedin_url, github_url
        from public.users
        where id = ${targetUserId}
        limit 1
      `,
      sql<StartupRow[]>`
        select * from public.startups where user_id = ${targetUserId} limit 1
      `,
      sql<InvestorRow[]>`
        select * from public.investors where user_id = ${targetUserId} limit 1
      `,
    ]);

    return {
      user: users[0] ?? null,
      startup: startups[0] ?? null,
      investor: investors[0] ?? null,
    };
  });

  if (!data.user) {
    notFound();
  }

  // Hard rule: only verified profiles are publicly viewable. Self-view
  // bypasses this so users can preview their own profile.
  const isSelf = viewerId === targetUserId;
  if (!isSelf && data.user.account_label !== "verified") {
    notFound();
  }

  // Block check — looks like 404 to either side. We deliberately don't
  // distinguish "blocked" from "missing" in the UI to avoid leaking
  // signal back to the blocked party.
  if (!isSelf && (await isBlockedEitherWay(viewerId, targetUserId))) {
    notFound();
  }

  // Record the view (24h debounced inside the helper). Fire-and-forget — we
  // don't await the result before rendering so a slow analytics insert
  // never delays the page.
  if (!isSelf) {
    void recordProfileView(viewerId, targetUserId);
  }

  // Resolve viewing tier — public / verified / match. Self-view always
  // resolves to "match" so the user can preview their own full profile.
  const tier: ViewingTier = await resolveTier(
    viewerId,
    targetUserId,
    viewerLabel,
    data.user.account_label,
  );
  const tier2 = tier === "match";

  // Pull child rows + confirmed verifications. Each runs through `withUserRls`
  // independently so a stale read of one doesn't block the other.
  const [startupDepthRaw, investorDepthRaw, verificationRows] = await Promise.all([
    data.startup
      ? fetchStartupDepth(viewerId, data.startup.id)
      : Promise.resolve(null),
    data.investor
      ? fetchInvestorDepth(viewerId, data.investor.id)
      : Promise.resolve(null),
    fetchConfirmedVerifications(viewerId, targetUserId),
  ]);

  const startupDepth: StartupDepthView | null =
    data.startup && startupDepthRaw
      ? projectStartupDepth(
          {
            ...startupDepthRaw,
            parent: {
              deck_url: data.startup.deck_url,
              traction: data.startup.traction,
            },
          },
          tier,
        )
      : null;
  const investorDepth: InvestorDepthView | null =
    data.investor && investorDepthRaw
      ? projectInvestorDepth(investorDepthRaw, tier)
      : null;
  const verifications: VerificationBadge[] = projectVerifications(verificationRows);

  // If matched, also resolve the matchId + any pending intro so the CTA
  // can render the right state (send / view-pending / respond).
  let matchId: string | null = null;
  let pendingIntroId: string | null = null;
  let pendingIntroDirection: "incoming" | "outgoing" | null = null;
  if (!isSelf && tier2) {
    const matchRow = await withUserRls<{ id: string } | null>(viewerId, async (sql) => {
      const rows = await sql<{ id: string }[]>`
        select id from public.matches
        where (founder_user_id = ${viewerId} and investor_user_id = ${targetUserId})
           or (investor_user_id = ${viewerId} and founder_user_id = ${targetUserId})
        limit 1
      `;
      return rows[0] ?? null;
    });
    if (matchRow) {
      matchId = matchRow.id;
      const pending = await fetchPendingIntroForMatch(viewerId, matchRow.id);
      if (pending) {
        pendingIntroId = pending.id;
        pendingIntroDirection = pending.direction;
      }
    }
  }

  console.log(
    `[profile:view] viewer=${viewerId} target=${targetUserId} tier=${tier} self=${isSelf} matchId=${matchId} pending=${pendingIntroId} verifications=${verifications.length}`,
  );

  // Compute match score if cross-role and both rows exist
  let matchScore: { score: number; reason: string } | null = null;
  if (
    !isSelf &&
    viewerRole &&
    data.user.role &&
    viewerRole !== data.user.role
  ) {
    const viewerStartup = viewerRole === "founder" ? await loadOwnStartup(viewerId) : null;
    const viewerInvestor = viewerRole === "investor" ? await loadOwnInvestor(viewerId) : null;
    if (data.user.role === "founder" && data.startup && viewerInvestor) {
      const m = scoreMatch(data.startup, viewerInvestor);
      matchScore = { score: m.score, reason: m.reason };
    } else if (data.user.role === "investor" && data.investor && viewerStartup) {
      const m = scoreMatch(viewerStartup, data.investor);
      matchScore = { score: m.score, reason: m.reason };
    }
  }

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-text)]">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 px-5 backdrop-blur md:px-8">
        <Wordmark size="sm" />
        <div className="flex items-center gap-3">
          <Link
            href={"/feed" as Route}
            className="text-[12.5px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
          >
            ← Back to feed
          </Link>
          {!isSelf ? (
            <ProfileMenu targetUserId={targetUserId} targetName={data.user.name ?? "this user"} />
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[760px] px-5 py-12 md:py-16">
        {data.user.role === "founder" && data.startup ? (
          <FounderProfile
            user={data.user}
            row={data.startup}
            tier={tier}
            depth={startupDepth}
            verifications={verifications}
            isSelf={isSelf}
            matchScore={matchScore}
          />
        ) : data.user.role === "investor" && data.investor ? (
          <InvestorProfile
            user={data.user}
            row={data.investor}
            tier={tier}
            depth={investorDepth}
            verifications={verifications}
            isSelf={isSelf}
            matchScore={matchScore}
          />
        ) : (
          <p className="text-[14px] text-[var(--color-text-muted)]">
            This user hasn&apos;t finished their profile yet.
          </p>
        )}

        {!isSelf && tier2 && matchId ? (
          <section className="mt-10 border-t border-[var(--color-border)] pt-8">
            {pendingIntroId && pendingIntroDirection === "outgoing" ? (
              <IntroCta kind="pending-outgoing" introId={pendingIntroId} />
            ) : pendingIntroId && pendingIntroDirection === "incoming" ? (
              <IntroCta kind="pending-incoming" introId={pendingIntroId} />
            ) : (
              <IntroCta
                kind="send"
                matchId={matchId}
                recipientName={data.user.name ?? "your match"}
              />
            )}
          </section>
        ) : null}

        {!isSelf && tier !== "match" ? (
          <LockedFooter tier={tier} />
        ) : null}
      </main>
    </div>
  );
}

async function loadOwnStartup(userId: string): Promise<StartupRow | null> {
  return withUserRls<StartupRow | null>(userId, async (sql) => {
    const rows = await sql<StartupRow[]>`
      select * from public.startups where user_id = ${userId} limit 1
    `;
    return rows[0] ?? null;
  });
}

async function loadOwnInvestor(userId: string): Promise<InvestorRow | null> {
  return withUserRls<InvestorRow | null>(userId, async (sql) => {
    const rows = await sql<InvestorRow[]>`
      select * from public.investors where user_id = ${userId} limit 1
    `;
    return rows[0] ?? null;
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  Founder profile
// ──────────────────────────────────────────────────────────────────────────

function FounderProfile({
  user,
  row,
  tier,
  depth,
  verifications,
  isSelf,
  matchScore,
}: {
  user: TargetUser;
  row: StartupRow;
  tier: ViewingTier;
  depth: StartupDepthView | null;
  verifications: VerificationBadge[];
  isSelf: boolean;
  matchScore: { score: number; reason: string } | null;
}) {
  const tier2 = tier === "match";
  const tier1 = projectStartupTier1(row);
  const tier2Data = tier2 ? projectStartupTier2(row) : null;

  return (
    <article className="space-y-8">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-faint)]">
          Startup
        </p>
        <h1 className="mt-2 text-[32px] font-semibold tracking-tight text-[var(--color-text-strong)]">
          {tier1.name}
        </h1>
        <p className="mt-2 max-w-[60ch] text-[16px] leading-[1.55] text-[var(--color-text)]">
          {tier1.oneLiner}
        </p>

        <div className="mt-4 space-y-2">
          <VerificationBadges
            inputs={{
              accountLabel: user.account_label,
              emailVerified: Boolean(user.email_verified_at),
              linkedinUrl: user.linkedin_url,
              githubUrl: user.github_url,
              websiteUrl: tier1.website,
            }}
          />
          <DepthVerificationBadges badges={verifications} />
        </div>
      </header>

      {matchScore ? (
        <section className="border bg-[var(--color-surface)] p-5" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] font-semibold tracking-tight text-[var(--color-text-strong)]">
              Match score
            </p>
            <span
              className="inline-flex items-center px-2.5 py-1 font-mono text-[14px] font-bold tabular-nums"
              style={{
                background: "var(--color-brand-tint)",
                color: "var(--color-brand-strong)",
                border: "1px solid var(--color-brand)",
              }}
            >
              {matchScore.score}%
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-[1.55] text-[var(--color-text-muted)]">
            {matchScore.reason}
          </p>
        </section>
      ) : null}

      <Section title="Basics">
        <Field label="Industry" value={tier1.industry} />
        <Field label="Stage" value={STAGE_LABEL[tier1.stage]} />
        <Field label="Location" value={tier1.location ?? "—"} />
        <Field
          label="Website"
          value={tier1.website ?? "—"}
          link={tier1.website ?? undefined}
        />
      </Section>

      <Section title="Round">
        {tier2Data?.raise_amount ? (
          <Field label="Target raise" value={`$${tier2Data.raise_amount.toLocaleString()}`} />
        ) : (
          <Field
            label="Target raise"
            value={tier1.raiseBucket ? labelRaiseBucket(tier1.raiseBucket) : "—"}
            footnote={tier2 ? undefined : "Exact figure visible after mutual match."}
          />
        )}
      </Section>

      <Section title="Traction">
        {tier2Data?.traction ? (
          <p className="text-[14px] leading-[1.6] text-[var(--color-text)] whitespace-pre-wrap">
            {tier2Data.traction}
          </p>
        ) : (
          <p className="text-[13px] italic text-[var(--color-text-faint)]">
            Detailed traction visible after mutual match.
          </p>
        )}
      </Section>

      <Section title="Pitch deck">
        {tier2Data?.deck_url ? (
          <a
            href={tier2Data.deck_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--color-brand)" }}
          >
            Open deck →
          </a>
        ) : (
          <p className="text-[13px] italic text-[var(--color-text-faint)]">
            {tier2 ? "No deck linked yet." : "Deck visible after mutual match."}
          </p>
        )}
      </Section>

      {depth ? <StartupDepthSections depth={depth} tier={tier} /> : null}

      {isSelf ? <SelfFooter href={"/build" as Route} /> : null}
    </article>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Investor profile
// ──────────────────────────────────────────────────────────────────────────

function InvestorProfile({
  user,
  row,
  tier,
  depth,
  verifications,
  isSelf,
  matchScore,
}: {
  user: TargetUser;
  row: InvestorRow;
  tier: ViewingTier;
  depth: InvestorDepthView | null;
  verifications: VerificationBadge[];
  isSelf: boolean;
  matchScore: { score: number; reason: string } | null;
}) {
  const tier2 = tier === "match";
  const tier1 = projectInvestorTier1(row);
  const tier2Data = tier2 ? projectInvestorTier2(row) : null;

  return (
    <article className="space-y-8">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-faint)]">
          Investor
        </p>
        <h1 className="mt-2 text-[32px] font-semibold tracking-tight text-[var(--color-text-strong)]">
          {tier1.name}
        </h1>
        {tier1.firm ? (
          <p className="mt-1 text-[15px] text-[var(--color-text-muted)]">{tier1.firm}</p>
        ) : null}

        <div className="mt-4 space-y-2">
          <VerificationBadges
            inputs={{
              accountLabel: user.account_label,
              emailVerified: Boolean(user.email_verified_at),
              linkedinUrl: user.linkedin_url,
              githubUrl: user.github_url,
              websiteUrl: null,
            }}
          />
          <DepthVerificationBadges badges={verifications} />
        </div>
      </header>

      {matchScore ? (
        <section className="border bg-[var(--color-surface)] p-5" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] font-semibold tracking-tight text-[var(--color-text-strong)]">
              Match score
            </p>
            <span
              className="inline-flex items-center px-2.5 py-1 font-mono text-[14px] font-bold tabular-nums"
              style={{
                background: "var(--color-brand-tint)",
                color: "var(--color-brand-strong)",
                border: "1px solid var(--color-brand)",
              }}
            >
              {matchScore.score}%
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-[1.55] text-[var(--color-text-muted)]">
            {matchScore.reason}
          </p>
        </section>
      ) : null}

      <Section title="Thesis">
        {tier2Data?.thesis ? (
          <p className="text-[14px] leading-[1.6] text-[var(--color-text)] whitespace-pre-wrap">
            {tier2Data.thesis}
          </p>
        ) : tier1.thesisPreview ? (
          <p className="text-[14px] leading-[1.6] text-[var(--color-text)]">
            {tier1.thesisPreview}
            {!tier2 ? "…" : ""}
          </p>
        ) : (
          <p className="text-[13px] italic text-[var(--color-text-faint)]">No thesis yet.</p>
        )}
      </Section>

      <Section title="Mandate">
        <Field label="Sectors" value={tier1.sectors.join(", ") || "—"} />
        <Field label="Stages" value={tier1.stages.map((s) => STAGE_LABEL[s]).join(", ") || "—"} />
        <Field label="Geographies" value={tier1.geographies.join(", ") || "—"} />
        <Field label="Active" value={tier1.isActive ? "Active" : "Inactive"} />
      </Section>

      <Section title="Check size">
        {tier2Data ? (
          <Field
            label="Range"
            value={`$${tier2Data.check_min.toLocaleString()} – $${tier2Data.check_max.toLocaleString()}`}
          />
        ) : (
          <Field
            label="Range"
            value={tier1.checkBand ? labelCheckBand(tier1.checkBand) : "—"}
            footnote="Exact range visible after mutual match."
          />
        )}
      </Section>

      {depth ? <InvestorDepthSections depth={depth} tier={tier} /> : null}

      {isSelf ? <SelfFooter href={"/build/investor" as Route} /> : null}
    </article>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Shared layout
// ──────────────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
        {title}
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  link,
  footnote,
}: {
  label: string;
  value: string;
  link?: string;
  footnote?: string;
}) {
  return (
    <div className="border bg-[var(--color-surface)] px-4 py-3" style={{ borderColor: "var(--color-border)" }}>
      <p className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-faint)]">
        {label}
      </p>
      <p className="mt-1 text-[14px] font-medium text-[var(--color-text-strong)]">
        {link ? (
          <a
            href={link.startsWith("http") ? link : `https://${link}`}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-[var(--color-brand-strong)]"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </p>
      {footnote ? (
        <p className="mt-1 text-[11px] italic text-[var(--color-text-faint)]">{footnote}</p>
      ) : null}
    </div>
  );
}

function LockedFooter({ tier }: { tier: ViewingTier }) {
  const copy =
    tier === "verified"
      ? "Some details — deck, traction evidence URLs, dry-powder band, private portfolio — unlock only when both sides express interest. No contact information is shared until then."
      : "Sign up and complete review to see depth: team, structured round details, traction signals, investor track record, decision process. Verified investors get a real diligence kit before contact unlocks.";
  return (
    <p className="mt-10 border-t border-[var(--color-border)] pt-5 text-center text-[12px] leading-[1.6] text-[var(--color-text-faint)]">
      {copy}
    </p>
  );
}

function SelfFooter({ href }: { href: Route }) {
  return (
    <p className="mt-10 border-t border-[var(--color-border)] pt-5 text-center text-[12.5px] text-[var(--color-text-muted)]">
      Looking at your own profile — visitors see what they would see at
      Tier 1 visibility.{" "}
      <Link href={href} className="font-medium text-[var(--color-text-strong)] underline underline-offset-4">
        Edit profile
      </Link>
    </p>
  );
}

const STAGE_LABEL: Record<StartupStage, string> = {
  idea: "Idea",
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  series_b_plus: "Series B+",
};

function labelRaiseBucket(b: "small" | "medium" | "large"): string {
  return b === "small" ? "Under $1M" : b === "medium" ? "$1M–$5M" : "$5M+";
}

function labelCheckBand(b: "angel" | "small" | "mid" | "large"): string {
  return b === "angel"
    ? "Under $50K"
    : b === "small"
      ? "$50K–$250K"
      : b === "mid"
        ? "$250K–$1M"
        : "$1M+";
}
