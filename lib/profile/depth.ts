import { withUserRls } from "@/lib/db";
import type { Database } from "@/types/database";

/**
 * Read paths for the profile-depth tables introduced in migrations 0012–0016.
 *
 * Pure fetch — every helper returns the raw rows for the requested parent.
 * Visibility tiers (public / verified / match) are applied separately by
 * `lib/profile/visibility.ts` so the same data can drive multiple surfaces
 * (the public page, the dashboard self-preview, future investor side rails)
 * without forcing each surface to know which fields are gated.
 *
 * RLS posture:
 *   - All depth tables use `select all` at the row-level. The app layer is
 *     responsible for enforcing `account_label='verified'` on the parent
 *     plus the paused / deletion / block checks (already done by the parent
 *     read in `lib/feed/query.ts` and `app/p/[userId]/page.tsx`).
 *   - `references_received` is `select own only` — never load it for a
 *     viewer who isn't the owner. We expose a separate `fetchOwnReferences`
 *     and refuse to load other users' references via this module.
 */

type StartupTeamMember =
  Database["public"]["Tables"]["startup_team_members"]["Row"];
type StartupRoundDetails =
  Database["public"]["Tables"]["startup_round_details"]["Row"];
type StartupCapTableSummary =
  Database["public"]["Tables"]["startup_cap_table_summary"]["Row"];
type StartupUseOfFundsLine =
  Database["public"]["Tables"]["startup_use_of_funds_lines"]["Row"];
type StartupTractionSignal =
  Database["public"]["Tables"]["startup_traction_signals"]["Row"];
type StartupMarketAnalysis =
  Database["public"]["Tables"]["startup_market_analysis"]["Row"];
type StartupCompetitor =
  Database["public"]["Tables"]["startup_competitive_landscape"]["Row"];
type StartupNarrative =
  Database["public"]["Tables"]["startup_narrative"]["Row"];

type InvestorTeamMember =
  Database["public"]["Tables"]["investor_team_members"]["Row"];
type InvestorCheckBand =
  Database["public"]["Tables"]["investor_check_bands"]["Row"];
type InvestorPortfolioRow =
  Database["public"]["Tables"]["investor_portfolio"]["Row"];
type InvestorTrackRecord =
  Database["public"]["Tables"]["investor_track_record"]["Row"];
type InvestorDecisionProcess =
  Database["public"]["Tables"]["investor_decision_process"]["Row"];
type InvestorValueAdd =
  Database["public"]["Tables"]["investor_value_add"]["Row"];
type InvestorAntiPattern =
  Database["public"]["Tables"]["investor_anti_patterns"]["Row"];

type Verification = Database["public"]["Tables"]["verifications"]["Row"];
type ReferenceReceived =
  Database["public"]["Tables"]["references_received"]["Row"];

export type StartupDepth = {
  team: StartupTeamMember[];
  round: StartupRoundDetails | null;
  capTable: StartupCapTableSummary | null;
  useOfFunds: StartupUseOfFundsLine[];
  traction: StartupTractionSignal[];
  market: StartupMarketAnalysis | null;
  competitors: StartupCompetitor[];
  /** 0035: Investor-grade narrative fields. */
  narrative: StartupNarrative | null;
};

export type InvestorDepth = {
  team: InvestorTeamMember[];
  checkBands: InvestorCheckBand[];
  portfolio: InvestorPortfolioRow[];
  trackRecord: InvestorTrackRecord | null;
  decisionProcess: InvestorDecisionProcess | null;
  valueAdd: InvestorValueAdd[];
  antiPatterns: InvestorAntiPattern[];
};

/**
 * Load every startup-depth child for a given startup row in one transaction.
 * The viewer's RLS context is set so the queries pass policy evaluation,
 * but the actual filter is `select all` at the row level — i.e. anyone
 * authenticated reads the rows. Verified-only / paused / blocked checks
 * happen on the parent in the calling page.
 */
export async function fetchStartupDepth(
  viewerId: string,
  startupId: string,
): Promise<StartupDepth> {
  return withUserRls<StartupDepth>(viewerId, async (sql) => {
    // Fetch pre-0035 depth tables.
    const [team, round, capTable, useOfFunds, traction, market, competitors] =
      await Promise.all([
        sql<StartupTeamMember[]>`
          select * from public.startup_team_members
          where startup_id = ${startupId}
          order by display_order asc, created_at asc
        `,
        sql<StartupRoundDetails[]>`
          select * from public.startup_round_details
          where startup_id = ${startupId}
          limit 1
        `,
        sql<StartupCapTableSummary[]>`
          select * from public.startup_cap_table_summary
          where startup_id = ${startupId}
          limit 1
        `,
        sql<StartupUseOfFundsLine[]>`
          select * from public.startup_use_of_funds_lines
          where startup_id = ${startupId}
          order by display_order asc, category asc
        `,
        sql<StartupTractionSignal[]>`
          select * from public.startup_traction_signals
          where startup_id = ${startupId}
          order by display_order asc, created_at asc
        `,
        sql<StartupMarketAnalysis[]>`
          select * from public.startup_market_analysis
          where startup_id = ${startupId}
          limit 1
        `,
        sql<StartupCompetitor[]>`
          select * from public.startup_competitive_landscape
          where startup_id = ${startupId}
          order by display_order asc, created_at asc
        `,
      ]);

    // 0035: Fetch narrative separately with graceful fallback.
    let narrative: StartupNarrative | null = null;
    try {
      const narrativeRows = await sql<StartupNarrative[]>`
        select * from public.startup_narrative
        where startup_id = ${startupId}
        limit 1
      `;
      narrative = narrativeRows[0] ?? null;
    } catch {
      // Table doesn't exist yet — gracefully degrade.
    }

    return {
      team,
      round: round[0] ?? null,
      capTable: capTable[0] ?? null,
      useOfFunds,
      traction,
      market: market[0] ?? null,
      competitors,
      narrative,
    };
  });
}

/**
 * Load every investor-depth child for a given investor row in one transaction.
 * Same RLS posture as `fetchStartupDepth`. The portfolio query returns ALL
 * rows (public and private); the visibility projection in
 * `lib/profile/visibility.ts` filters private rows out for non-match viewers.
 * Private rows still surface to the matching engine separately.
 */
export async function fetchInvestorDepth(
  viewerId: string,
  investorId: string,
): Promise<InvestorDepth> {
  return withUserRls<InvestorDepth>(viewerId, async (sql) => {
    const [
      team,
      checkBands,
      portfolio,
      trackRecord,
      decisionProcess,
      valueAdd,
      antiPatterns,
    ] = await Promise.all([
      sql<InvestorTeamMember[]>`
        select * from public.investor_team_members
        where investor_id = ${investorId}
        order by is_decision_maker desc, display_order asc, created_at asc
      `,
      sql<InvestorCheckBand[]>`
        select * from public.investor_check_bands
        where investor_id = ${investorId}
        order by stage asc, role asc
      `,
      sql<InvestorPortfolioRow[]>`
        select * from public.investor_portfolio
        where investor_id = ${investorId}
        order by year desc nulls last, display_order asc
      `,
      sql<InvestorTrackRecord[]>`
        select * from public.investor_track_record
        where investor_id = ${investorId}
        limit 1
      `,
      sql<InvestorDecisionProcess[]>`
        select * from public.investor_decision_process
        where investor_id = ${investorId}
        limit 1
      `,
      sql<InvestorValueAdd[]>`
        select * from public.investor_value_add
        where investor_id = ${investorId}
        order by display_order asc, kind asc
      `,
      sql<InvestorAntiPattern[]>`
        select * from public.investor_anti_patterns
        where investor_id = ${investorId}
        order by display_order asc, kind asc
      `,
    ]);

    return {
      team,
      checkBands,
      portfolio,
      trackRecord: trackRecord[0] ?? null,
      decisionProcess: decisionProcess[0] ?? null,
      valueAdd,
      antiPatterns,
    };
  });
}

/**
 * Owner-only: all verifications for the signed-in user (every status).
 * Used on /build to show pending claims and confirmed badges.
 */
export async function fetchOwnVerifications(
  userId: string,
): Promise<Verification[]> {
  return withUserRls<Verification[]>(userId, async (sql) => {
    return sql<Verification[]>`
      select * from public.verifications
      where user_id = ${userId}
      order by created_at desc
    `;
  });
}

/**
 * Confirmed verifications for a target user. RLS is `select all`, but the
 * caller decides whether to render the badges based on the resolved viewing
 * tier (badges are shown at every tier — they're a trust signal, not
 * sensitive content).
 */
export async function fetchConfirmedVerifications(
  viewerId: string,
  targetUserId: string,
): Promise<Verification[]> {
  return withUserRls<Verification[]>(viewerId, async (sql) => {
    return sql<Verification[]>`
      select * from public.verifications
      where user_id = ${targetUserId}
        and status = 'confirmed'
        and (expires_at is null or expires_at > now())
      order by verified_at desc nulls last, created_at desc
    `;
  });
}

/**
 * Confirmed references for a target user — name, relationship, endorsement
 * only. We deliberately strip referee_email and token_hash from the public
 * shape: that data is never appropriate to render to a non-owner viewer.
 *
 * For the owner's own dashboard (where they manage pending / declined
 * references), call `fetchOwnReferences` instead.
 */
export type ConfirmedReferenceSummary = {
  id: string;
  refereeName: string;
  relationship: string;
  endorsement: string | null;
  confirmedAt: Date;
};

export async function fetchConfirmedReferences(
  viewerId: string,
  targetUserId: string,
): Promise<ConfirmedReferenceSummary[]> {
  // RLS on references_received is select-OWN-only. Cross-user reads of
  // confirmed references are intentionally unsupported in v0 — surfacing
  // referee name + relationship to other viewers is a separate privacy
  // decision we haven't made. Until that lands, only return data for
  // self-view.
  if (viewerId !== targetUserId) return [];

  return withUserRls<ConfirmedReferenceSummary[]>(viewerId, async (sql) => {
    type Row = {
      id: string;
      referee_name: string;
      relationship: string;
      endorsement: string | null;
      confirmed_at: Date | string;
    };
    const rows = await sql<Row[]>`
      select id, referee_name, relationship, endorsement, confirmed_at
      from public.references_received
      where user_id = ${targetUserId}
        and status = 'confirmed'
      order by confirmed_at desc
    `;
    return rows.map((r) => ({
      id: r.id,
      refereeName: r.referee_name,
      relationship: r.relationship,
      endorsement: r.endorsement,
      confirmedAt: new Date(r.confirmed_at),
    }));
  });
}

/**
 * Owner-only: the user's own references_received rows in every state
 * (sent / confirmed / declined / expired). Used by the future settings
 * surface where users manage their reference requests.
 */
export async function fetchOwnReferences(
  userId: string,
): Promise<ReferenceReceived[]> {
  return withUserRls<ReferenceReceived[]>(userId, async (sql) => {
    return sql<ReferenceReceived[]>`
      select * from public.references_received
      where user_id = ${userId}
      order by created_at desc
    `;
  });
}
