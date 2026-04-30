import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { withUserRls } from "@/lib/db";
import {
  projectStartupTier1,
  projectInvestorTier1,
} from "@/lib/profile/visibility";
import { resolveAvatarUrl } from "@/lib/profile/avatar";
import { Avatar } from "@/components/profile/avatar";
import { VerificationBadges } from "@/components/account/verification-badges";
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

type UserRow = {
  id: string;
  name: string | null;
  role: UserRole | null;
  account_label: AccountLabel;
  email_verified_at: Date | string | null;
  linkedin_url: string | null;
  github_url: string | null;
  image: string | null;
  avatar_storage_key: string | null;
  avatar_url: string | null;
  avatar_updated_at: Date | string | null;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadBySlug(slug);
  if (!data) return { title: "Profile not found" };
  return {
    title: `${data.user.name ?? "User"} — VentraMatch`,
    description: `${data.user.name ?? "Someone"} on VentraMatch.`,
    robots: { index: true, follow: true },
  };
}

async function loadBySlug(slug: string) {
  return withUserRls<{
    user: UserRow;
    startup: StartupRow | null;
    investor: InvestorRow | null;
  } | null>(null, async (sql) => {
    const users = await sql<UserRow[]>`
      select id, name, role, account_label, email_verified_at,
             linkedin_url, github_url,
             image, avatar_storage_key, avatar_url, avatar_updated_at
      from public.users
      where public_profile_enabled = true
        and public_slug = ${slug}
        and account_label = 'verified'
      limit 1
    `;
    if (users.length === 0) return null;
    const user = users[0];
    const [startups, investors] = await Promise.all([
      sql<StartupRow[]>`select * from public.startups where user_id = ${user.id} limit 1`,
      sql<InvestorRow[]>`select * from public.investors where user_id = ${user.id} limit 1`,
    ]);
    return { user, startup: startups[0] ?? null, investor: investors[0] ?? null };
  });
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadBySlug(slug);
  if (!data) notFound();

  const { user } = data;
  const avatarSrc = await resolveAvatarUrl({
    storageKey: user.avatar_storage_key,
    cachedUrl: user.avatar_url,
    cachedAt: user.avatar_updated_at,
    oauthImage: user.image,
  });

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-text)]">
      <header className="flex h-14 items-center justify-between border-b border-[var(--color-border)] px-5 md:px-8">
        <Wordmark size="sm" />
        <Link
          href="/sign-up"
          className="inline-flex h-9 items-center px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--color-brand)" }}
        >
          Join VentraMatch
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[760px] px-5 py-12 md:py-16">
        <header className="flex flex-col items-start gap-5 sm:flex-row">
          <Avatar id={user.id} name={user.name} src={avatarSrc} size="xl" />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-faint)]">
              {user.role === "founder" ? "Startup" : user.role === "investor" ? "Investor" : "Profile"}
            </p>
            <h1 className="mt-2 text-[32px] font-semibold tracking-tight text-[var(--color-text-strong)]">
              {user.name ?? "VentraMatch user"}
            </h1>

            {user.role === "founder" && data.startup ? (
              <p className="mt-2 max-w-[60ch] text-[16px] leading-[1.55] text-[var(--color-text)]">
                {projectStartupTier1(data.startup).oneLiner}
              </p>
            ) : null}

            {user.role === "investor" && data.investor ? (
              <p className="mt-1 text-[15px] text-[var(--color-text-muted)]">
                {projectInvestorTier1(data.investor).firm ?? "Independent investor"}
              </p>
            ) : null}

            <div className="mt-4">
              <VerificationBadges
                inputs={{
                  accountLabel: user.account_label,
                  emailVerified: Boolean(user.email_verified_at),
                  linkedinUrl: user.linkedin_url,
                  githubUrl: user.github_url,
                  websiteUrl: null,
                }}
              />
            </div>
          </div>
        </header>

        {user.role === "founder" && data.startup ? (
          <FounderPublicFields startup={data.startup} />
        ) : user.role === "investor" && data.investor ? (
          <InvestorPublicFields investor={data.investor} />
        ) : null}

        <footer className="mt-12 border-t border-[var(--color-border)] pt-6 text-center text-[12.5px] text-[var(--color-text-faint)]">
          <p>
            This is a public profile on VentraMatch. To see the full profile
            and express interest,{" "}
            <Link href="/sign-up" className="font-medium text-[var(--color-brand-strong)] underline-offset-4 hover:underline">
              create an account
            </Link>
            .
          </p>
        </footer>
      </main>
    </div>
  );
}

const STAGE_LABEL: Record<StartupStage, string> = {
  idea: "Idea", pre_seed: "Pre-seed", seed: "Seed",
  series_a: "Series A", series_b_plus: "Series B+",
};

function FounderPublicFields({ startup }: { startup: StartupRow }) {
  const t1 = projectStartupTier1(startup);
  return (
    <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <InfoField label="Industry" value={t1.industry} />
      <InfoField label="Stage" value={STAGE_LABEL[t1.stage]} />
      <InfoField label="Location" value={t1.location ?? "—"} />
      <InfoField label="Website" value={t1.website ?? "—"} link={t1.website ?? undefined} />
    </section>
  );
}

function InvestorPublicFields({ investor }: { investor: InvestorRow }) {
  const t1 = projectInvestorTier1(investor);
  return (
    <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <InfoField label="Sectors" value={t1.sectors.join(", ") || "—"} />
      <InfoField label="Stages" value={t1.stages.map((s) => STAGE_LABEL[s]).join(", ") || "—"} />
      <InfoField label="Geographies" value={t1.geographies.join(", ") || "—"} />
      <InfoField label="Active" value={t1.isActive ? "Active" : "Inactive"} />
    </section>
  );
}

function InfoField({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div className="border bg-[var(--color-surface)] px-4 py-3" style={{ borderColor: "var(--color-border)" }}>
      <p className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-faint)]">{label}</p>
      <p className="mt-1 text-[14px] font-medium text-[var(--color-text-strong)]">
        {link ? (
          <a href={link.startsWith("http") ? link : `https://${link}`} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-[var(--color-brand-strong)]">
            {value}
          </a>
        ) : value}
      </p>
    </div>
  );
}
