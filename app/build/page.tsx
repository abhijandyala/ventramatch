import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import type { StartupStage, AccountLabel } from "@/types/database";
import { FounderBuilder, type FounderUiDraft, EMPTY_FOUNDER_DRAFT } from "./builder";

export const dynamic = "force-dynamic";

type StartupRow = {
  name: string | null;
  one_liner: string | null;
  industry: string | null;
  stage: StartupStage | null;
  raise_amount: number | null;
  traction: string | null;
  location: string | null;
  deck_url: string | null;
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
        select name, one_liner, industry, stage, raise_amount,
               traction, location, deck_url, website
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
      // Round-trips poorly because we collapsed multiple fields into one
      // string at submit. We just dump it back into the freeform field so
      // nothing is lost on edit.
      notableSignals: both.startup?.traction ?? "",
    },
    deck: {
      ...EMPTY_FOUNDER_DRAFT.deck,
      url: both.startup?.deck_url ?? "",
    },
    founder: {
      ...EMPTY_FOUNDER_DRAFT.founder,
      fullName: both.user?.name ?? "",
      workEmail: both.user?.email ?? "",
    },
  };

  const accountLabel = (session.user.accountLabel ?? "unverified") as AccountLabel;
  return <FounderBuilder initial={initial} accountLabel={accountLabel} />;
}
