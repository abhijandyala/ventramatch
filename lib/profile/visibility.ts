import { withUserRls } from "@/lib/db";
import type { Database, StartupStage } from "@/types/database";

/**
 * Profile visibility tiers — what fields are exposed to whom.
 *
 * Tier 1 (public-ish, post-onboarding): everything that lives in the
 *   feed card. Sector, stage, one-liner, geography, anonymized traction.
 *   This is what every authenticated user sees when they encounter the
 *   profile in a discovery surface.
 *
 * Tier 2 (post mutual-match): full deck URL, raw traction string, contact
 *   email. Surfaced only after both sides have expressed Interested AND
 *   the user has account_label='verified'. Anything that could let an
 *   investor cold-DM a founder lives here.
 *
 * Tier 3 (post first call, future): data room contents, financial model,
 *   cap table. Founder-controlled per-investor grants. Not implemented yet.
 *
 * Pure projection — no I/O. Caller decides which tier based on a
 * `hasMutualMatch(viewerId, targetUserId)` lookup and whether either
 * party is `verified`.
 */

type StartupRow = Database["public"]["Tables"]["startups"]["Row"];
type InvestorRow = Database["public"]["Tables"]["investors"]["Row"];

export type StartupPublic = {
  id: string;
  userId: string;
  name: string;
  oneLiner: string;
  industry: string;
  stage: StartupStage;
  /**
   * Raise amount bucketed for public display: small / med / large.
   * Exact dollar figure is Tier 2 only.
   */
  raiseBucket: "small" | "medium" | "large" | null;
  location: string | null;
  website: string | null;
  /** Tier 2 only: empty string for tier-1 readers. */
  deckUrl: "";
  /** Tier 2 only: empty for tier-1. */
  raiseAmount: null;
  traction: null;
};

export type StartupFull = Omit<StartupRow, "created_at" | "updated_at">;

export function projectStartupTier1(row: StartupRow): StartupPublic {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    oneLiner: row.one_liner,
    industry: row.industry,
    stage: row.stage,
    raiseBucket: bucketRaise(row.raise_amount),
    location: row.location,
    website: row.website,
    deckUrl: "",
    raiseAmount: null,
    traction: null,
  };
}

export function projectStartupTier2(row: StartupRow): StartupFull {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    one_liner: row.one_liner,
    industry: row.industry,
    stage: row.stage,
    raise_amount: row.raise_amount,
    traction: row.traction,
    location: row.location,
    deck_url: row.deck_url,
    website: row.website,
  };
}

function bucketRaise(amount: number | null): "small" | "medium" | "large" | null {
  if (amount == null || amount <= 0) return null;
  if (amount < 1_000_000) return "small";
  if (amount < 5_000_000) return "medium";
  return "large";
}

export type InvestorPublic = {
  id: string;
  userId: string;
  name: string;
  firm: string | null;
  /** Bucketed for public display. */
  checkBand: "angel" | "small" | "mid" | "large" | null;
  stages: StartupStage[];
  sectors: string[];
  geographies: string[];
  isActive: boolean;
  /** Truncated thesis preview — first 200 chars. */
  thesisPreview: string | null;
  /** Tier 2 only. */
  checkMin: 0;
  checkMax: 0;
  thesis: null;
};

export type InvestorFull = Omit<InvestorRow, "created_at" | "updated_at">;

export function projectInvestorTier1(row: InvestorRow): InvestorPublic {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    firm: row.firm,
    checkBand: bucketCheck(row.check_min, row.check_max),
    stages: row.stages,
    sectors: row.sectors,
    geographies: row.geographies,
    isActive: row.is_active,
    thesisPreview: row.thesis ? row.thesis.slice(0, 200) : null,
    checkMin: 0,
    checkMax: 0,
    thesis: null,
  };
}

export function projectInvestorTier2(row: InvestorRow): InvestorFull {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    firm: row.firm,
    check_min: row.check_min,
    check_max: row.check_max,
    stages: row.stages,
    sectors: row.sectors,
    geographies: row.geographies,
    is_active: row.is_active,
    thesis: row.thesis,
  };
}

function bucketCheck(min: number, max: number): "angel" | "small" | "mid" | "large" | null {
  if (!max) return null;
  const top = max;
  if (top < 50_000) return "angel";
  if (top < 250_000) return "small";
  if (top < 1_000_000) return "mid";
  return "large";
}

/**
 * Check whether viewer and target have a mutual match and contact is
 * unlocked. Used to gate Tier 2 access.
 */
export async function hasContactUnlocked(
  viewerUserId: string,
  targetUserId: string,
): Promise<boolean> {
  if (viewerUserId === targetUserId) return true;
  return withUserRls<boolean>(viewerUserId, async (sql) => {
    const rows = await sql<{ unlocked: boolean }[]>`
      select contact_unlocked as unlocked
      from public.matches
      where (founder_user_id = ${viewerUserId} and investor_user_id = ${targetUserId})
         or (founder_user_id = ${targetUserId} and investor_user_id = ${viewerUserId})
      limit 1
    `;
    return Boolean(rows[0]?.unlocked);
  });
}
