import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import type { StartupStage, AccountLabel } from "@/types/database";
import { InvestorBuilder, type InvestorUiDraft, EMPTY_INVESTOR_DRAFT } from "./builder";
import { fetchInvestorDepth } from "@/lib/profile/depth";
import {
  projectInvestorDepth,
  type InvestorDepthView,
} from "@/lib/profile/visibility";

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
};

export default async function InvestorBuildPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
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
        select company_name, bio, name, email, investor_type
        from public.users
        where id = ${userId}
        limit 1
      `,
    ]);
    return { investor: i[0] ?? null, user: u[0] ?? null };
  });

  let depthView: InvestorDepthView | null = null;
  if (both.investor?.id) {
    const rawDepth = await fetchInvestorDepth(userId, both.investor.id);
    depthView = projectInvestorDepth(rawDepth, "match");
  }

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
  return (
    <InvestorBuilder
      initial={initial}
      accountLabel={accountLabel}
      depthView={depthView}
    />
  );
}
