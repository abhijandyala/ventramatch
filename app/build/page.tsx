import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import type { StartupStage, AccountLabel } from "@/types/database";
import { FounderBuilder, type FounderUiDraft, EMPTY_FOUNDER_DRAFT } from "./builder";
import { fetchStartupDepth, fetchOwnVerifications, fetchOwnReferences } from "@/lib/profile/depth";
import {
  projectStartupDepth,
  type StartupDepthView,
} from "@/lib/profile/visibility";
import type { OwnVerification, OwnReference } from "@/components/profile/verification-panel";

export const dynamic = "force-dynamic";

type StartupRow = {
  id: string;
  name: string | null;
  one_liner: string | null;
  industry: string | null;
  stage: StartupStage | null;
  raise_amount: number | null;
  traction: string | null;
  location: string | null;
  deck_url: string | null;
  deck_storage_key: string | null;
  deck_filename: string | null;
  deck_uploaded_at: string | null;
  website: string | null;
};

type UserRow = {
  company_name: string | null;
  bio: string | null;
  name: string | null;
  email: string | null;
};

export default async function BuildPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userId = session.user.id;

  console.log(`[build:founder:page] userId=${userId}`);

  type Both = { startup: StartupRow | null; user: UserRow | null };
  const both = await withUserRls<Both>(userId, async (sql) => {
    const [s, u] = await Promise.all([
      sql<StartupRow[]>`
        select id, name, one_liner, industry, stage, raise_amount,
               traction, location, deck_url, deck_storage_key,
               deck_filename, deck_uploaded_at, website
        from public.startups
        where user_id = ${userId}
        limit 1
      `,
      sql<UserRow[]>`
        select company_name, bio, name, email
        from public.users
        where id = ${userId}
        limit 1
      `,
    ]);
    return { startup: s[0] ?? null, user: u[0] ?? null };
  });

  // Load depth tables for the editor initial state (empty if not yet filled).
  let depthView: StartupDepthView | null = null;
  if (both.startup?.id) {
    const rawDepth = await fetchStartupDepth(userId, both.startup.id);
    depthView = projectStartupDepth(
      {
        ...rawDepth,
        parent: {
          id: both.startup.id,
          deck_url: both.startup.deck_url,
          deck_storage_key: both.startup.deck_storage_key,
          traction: both.startup.traction,
        },
      },
      "match",
    );
  }

  // Load verifications + references for the panel (own-only reads).
  const [rawVerifications, rawReferences] = await Promise.all([
    fetchOwnVerifications(userId),
    fetchOwnReferences(userId),
  ]);

  const ownVerifications: OwnVerification[] = rawVerifications.map((v) => ({
    id: v.id,
    kind: v.kind,
    status: v.status,
    claim_summary: v.claim_summary,
    evidence_url: v.evidence_url,
    created_at: v.created_at,
  }));

  const ownReferences: OwnReference[] = rawReferences.map((r) => ({
    id: r.id,
    referee_name: r.referee_name,
    referee_email: r.referee_email,
    relationship: r.relationship,
    status: r.status,
    endorsement: r.endorsement,
    expires_at: r.expires_at,
    created_at: r.created_at,
  }));

  const initial: FounderUiDraft = {
    ...EMPTY_FOUNDER_DRAFT,
    company: {
      ...EMPTY_FOUNDER_DRAFT.company,
      name: both.startup?.name ?? both.user?.company_name ?? "",
      description: both.startup?.one_liner ?? both.user?.bio ?? "",
      website: both.startup?.website ?? "",
      city: both.startup?.location ?? "",
    },
    sectors: both.startup?.industry ? [both.startup.industry] : [],
    stage: both.startup?.stage ?? null,
    round: {
      ...EMPTY_FOUNDER_DRAFT.round,
      targetRaise: both.startup?.raise_amount ?? null,
    },
    traction: {
      ...EMPTY_FOUNDER_DRAFT.traction,
      notableSignals: both.startup?.traction ?? "",
    },
    deck: {
      ...EMPTY_FOUNDER_DRAFT.deck,
      url: both.startup?.deck_url ?? "",
      fileName: both.startup?.deck_filename ?? "",
      uploadedAt: both.startup?.deck_uploaded_at ?? null,
    },
    founder: {
      ...EMPTY_FOUNDER_DRAFT.founder,
      fullName: both.user?.name ?? "",
      workEmail: both.user?.email ?? "",
    },
  };

  const accountLabel = (session.user.accountLabel ?? "unverified") as AccountLabel;
  return (
    <FounderBuilder
      initial={initial}
      accountLabel={accountLabel}
      depthView={depthView}
      ownVerifications={ownVerifications}
      ownReferences={ownReferences}
    />
  );
}
