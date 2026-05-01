import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import type { StartupStage, AccountLabel, ProfileState } from "@/types/database";
import { InvestorBuilder, type InvestorUiDraft, EMPTY_INVESTOR_DRAFT } from "./builder";
import { fetchInvestorDepth, fetchOwnVerifications, fetchOwnReferences } from "@/lib/profile/depth";
import {
  projectInvestorDepth,
  emptyInvestorDepth,
  type InvestorDepthView,
} from "@/lib/profile/visibility";
import type { OwnVerification, OwnReference } from "@/components/profile/verification-panel";
import { getLinkedInStatusAction } from "./connect-actions";

export const dynamic = "force-dynamic";

type InvestorRow = {
  id: string;
  name: string | null;
  firm: string | null;
  check_min: number | null;
  check_max: number | null;
  stages: StartupStage[] | null;
  sectors: string[] | null;
  geographies: string[] | null;
  is_active: boolean | null;
  thesis: string | null;
};

type UserRow = {
  company_name: string | null;
  bio: string | null;
  name: string | null;
  email: string | null;
  investor_type: string | null;
  profile_state: ProfileState | null;
};

export default async function InvestorBuildPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  if (session.user.role === "founder") redirect("/build");

  const userId = session.user.id;

  console.log(`[build:investor:page] userId=${userId}`);

  type Both = { investor: InvestorRow | null; user: UserRow | null };
  const both = await withUserRls<Both>(userId, async (sql) => {
    const [i, u] = await Promise.all([
      sql<InvestorRow[]>`
        select id, name, firm, check_min, check_max, stages, sectors,
               geographies, is_active, thesis
        from public.investors
        where user_id = ${userId}
        limit 1
      `,
      sql<UserRow[]>`
        select company_name, bio, name, email, investor_type, profile_state
        from public.users
        where id = ${userId}
        limit 1
      `,
    ]);
    return { investor: i[0] ?? null, user: u[0] ?? null };
  });

  // Always provide a depth view so the editor scaffold renders from first
  // visit (mirrors app/build/page.tsx). Save attempts before the wizard
  // creates an investors row return "Create your investor profile first."
  let depthView: InvestorDepthView;
  if (both.investor?.id) {
    const rawDepth = await fetchInvestorDepth(userId, both.investor.id);
    depthView = projectInvestorDepth(rawDepth, "match");
  } else {
    depthView = emptyInvestorDepth();
  }

  const [rawVerifications, rawReferences, linkedInStatus] = await Promise.all([
    fetchOwnVerifications(userId),
    fetchOwnReferences(userId),
    getLinkedInStatusAction(),
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

  const initialType: InvestorUiDraft["type"] =
    both.user?.investor_type === "angel" ? "angel" :
    both.user?.investor_type === "firm" ? "early" : null;

  const initial: InvestorUiDraft = {
    ...EMPTY_INVESTOR_DRAFT,
    identity: {
      ...EMPTY_INVESTOR_DRAFT.identity,
      fullName: both.investor?.name ?? both.user?.name ?? "",
      firmName: both.investor?.firm ?? both.user?.company_name ?? "",
      workEmail: both.user?.email ?? "",
    },
    type: initialType,
    sectors: {
      ...EMPTY_INVESTOR_DRAFT.sectors,
      sectors: both.investor?.sectors ?? [],
      thesis: both.investor?.thesis ?? both.user?.bio ?? "",
    },
    stages: both.investor?.stages ?? [],
    check: {
      ...EMPTY_INVESTOR_DRAFT.check,
      minCheck: both.investor?.check_min ?? null,
      maxCheck: both.investor?.check_max ?? null,
    },
    geo: {
      ...EMPTY_INVESTOR_DRAFT.geo,
      regions: both.investor?.geographies ?? [],
    },
  };

  const accountLabel = (session.user.accountLabel ?? "unverified") as AccountLabel;
  const profileState: ProfileState =
    both.user?.profile_state ?? session.user.profileState ?? "none";
  return (
    <InvestorBuilder
      initial={initial}
      accountLabel={accountLabel}
      profileState={profileState}
      depthView={depthView}
      ownVerifications={ownVerifications}
      ownReferences={ownReferences}
      linkedInStatus={linkedInStatus}
    />
  );
}
