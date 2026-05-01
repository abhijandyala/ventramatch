import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import type { StartupStage, AccountLabel, ProfileState, ProductStatus, CustomerType } from "@/types/database";
import { FounderBuilder, type FounderUiDraft, EMPTY_FOUNDER_DRAFT } from "./builder";
import { fetchStartupDepth, fetchOwnVerifications, fetchOwnReferences } from "@/lib/profile/depth";
import {
  projectStartupDepth,
  emptyStartupDepth,
  type StartupDepthView,
} from "@/lib/profile/visibility";
import type { OwnVerification, OwnReference } from "@/components/profile/verification-panel";
import { getLinkedInStatusAction } from "./connect-actions";

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
  // 0035 fields - may not exist until migration is applied
  founded_year?: number | null;
  product_status?: ProductStatus | null;
  customer_type?: CustomerType | null;
};

type UserRow = {
  company_name: string | null;
  bio: string | null;
  name: string | null;
  email: string | null;
  profile_state: ProfileState | null;
};

export default async function BuildPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userId = session.user.id;

  console.log(`[build:founder:page] userId=${userId}`);

  type Both = { startup: StartupRow | null; user: UserRow | null };
  const both = await withUserRls<Both>(userId, async (sql) => {
    // Base query without 0035 columns (founded_year, product_status, customer_type)
    // to gracefully handle the case where migration 0035 hasn't been applied yet.
    type BaseStartupRow = Omit<StartupRow, "founded_year" | "product_status" | "customer_type">;
    const [s, u] = await Promise.all([
      sql<BaseStartupRow[]>`
        select id, name, one_liner, industry, stage, raise_amount,
               traction, location, deck_url, deck_storage_key,
               deck_filename, deck_uploaded_at, website
        from public.startups
        where user_id = ${userId}
        limit 1
      `,
      sql<UserRow[]>`
        select company_name, bio, name, email, profile_state
        from public.users
        where id = ${userId}
        limit 1
      `,
    ]);

    // Try to fetch 0035 columns separately with graceful fallback.
    let startup: StartupRow | null = s[0] ? { ...s[0], founded_year: null, product_status: null, customer_type: null } : null;
    if (startup) {
      try {
        type ExtRow = { founded_year: number | null; product_status: ProductStatus | null; customer_type: CustomerType | null };
        const extRows = await sql<ExtRow[]>`
          select founded_year, product_status, customer_type
          from public.startups
          where user_id = ${userId}
          limit 1
        `;
        if (extRows[0]) {
          startup.founded_year = extRows[0].founded_year;
          startup.product_status = extRows[0].product_status;
          startup.customer_type = extRows[0].customer_type;
        }
      } catch {
        // Columns don't exist yet — gracefully degrade.
      }
    }

    return { startup, user: u[0] ?? null };
  });

  // Always provide a depth view so the editor scaffold renders from first
  // visit. With no startup row yet, save attempts inside any depth section
  // will return "Create your startup profile first." — but the user can see
  // the full surface area of the profile up front, instead of having
  // sections silently appear after the first wizard save.
  let depthView: StartupDepthView;
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
  } else {
    depthView = emptyStartupDepth();
  }

  // Load verifications + references for the panel (own-only reads).
  // Also fetch LinkedIn connection status for the "Fill with LinkedIn" feature.
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

  const initial: FounderUiDraft = {
    ...EMPTY_FOUNDER_DRAFT,
    company: {
      ...EMPTY_FOUNDER_DRAFT.company,
      name: both.startup?.name ?? both.user?.company_name ?? "",
      description: both.startup?.one_liner ?? both.user?.bio ?? "",
      website: both.startup?.website ?? "",
      city: both.startup?.location ?? "",
      foundedYear: both.startup?.founded_year ?? null,
      productStatus: both.startup?.product_status ?? null,
      customerType: both.startup?.customer_type ?? null,
    },
    sectors: both.startup?.industry ? [both.startup.industry] : [],
    stage: both.startup?.stage ?? null,
    round: {
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
  const profileState: ProfileState =
    both.user?.profile_state ?? session.user.profileState ?? "none";
  return (
    <FounderBuilder
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
