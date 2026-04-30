import { withUserRls } from "@/lib/db";
import {
  founderCompletion,
  investorCompletion,
  type CompletionResult,
  type StartupDepthCounts,
  type InvestorDepthCounts,
} from "@/lib/profile/completion";
import type { Database } from "@/types/database";

/**
 * Depth-aware completion calculator.
 *
 * Adhvik's lib/profile/completion.ts already accepts depth counts, but no
 * caller was actually fetching them — so the displayed % under-counted
 * what users had filled in. This module pulls counts from every depth
 * table in one transaction and feeds them to the pure function.
 *
 * Use this from any read surface that displays the % to the user
 * (dashboard ProfileCompletionPrompt, /build header, /settings, etc.).
 *
 * Don't use this from the publish-gate server actions — those should
 * stay strict-base-only so depth doesn't gate publishing. The
 * `canPublish` field returned here is gated on base items only anyway,
 * but keeping the wizard's gate input-driven (not DB-driven) avoids
 * an extra query and keeps the action latency tight.
 */

type StartupRow = Database["public"]["Tables"]["startups"]["Row"];
type InvestorRow = Database["public"]["Tables"]["investors"]["Row"];

// ──────────────────────────────────────────────────────────────────────────
//  Founder side
// ──────────────────────────────────────────────────────────────────────────

export async function founderCompletionWithDepth(
  userId: string,
): Promise<CompletionResult> {
  return withUserRls<CompletionResult>(userId, async (sql) => {
    const [startupRows, depth] = await Promise.all([
      sql<StartupRow[]>`
        select * from public.startups where user_id = ${userId} limit 1
      `,
      fetchStartupDepthCounts(userId),
    ]);
    return founderCompletion(startupRows[0] ?? null, depth);
  });
}

/**
 * Fetch the depth-table counts for a founder. Public so callers that
 * already have a startup row in hand can avoid the extra `select *`.
 *
 * Returns a fully-populated StartupDepthCounts (with the Sprint 9.5
 * fields) — the underlying type defaults the new fields when absent,
 * so passing this to the pure function is always safe.
 */
export async function fetchStartupDepthCounts(
  userId: string,
): Promise<StartupDepthCounts> {
  return withUserRls<StartupDepthCounts>(userId, async (sql) => {
    // Single query, six aggregates. Cheaper than six separate roundtrips.
    type Row = {
      team_count: number;
      traction_count: number;
      has_round: boolean;
      has_cap_table: boolean;
      has_market: boolean;
      competitor_count: number;
      use_of_funds_count: number;
    };
    const rows = await sql<Row[]>`
      select
        (select count(*)::int from public.startup_team_members where user_id = ${userId}) as team_count,
        (select count(*)::int from public.startup_traction_signals where user_id = ${userId}) as traction_count,
        (select exists(select 1 from public.startup_round_details where user_id = ${userId})) as has_round,
        (select exists(select 1 from public.startup_cap_table_summary where user_id = ${userId})) as has_cap_table,
        (select exists(select 1 from public.startup_market_analysis where user_id = ${userId})) as has_market,
        (select count(*)::int from public.startup_competitive_landscape where user_id = ${userId}) as competitor_count,
        (select count(*)::int from public.startup_use_of_funds_lines where user_id = ${userId}) as use_of_funds_count
    `;
    const row = rows[0];
    return {
      teamMembers: row?.team_count ?? 0,
      tractionSignals: row?.traction_count ?? 0,
      hasRoundDetails: row?.has_round ?? false,
      hasCapTable: row?.has_cap_table ?? false,
      hasMarketAnalysis: row?.has_market ?? false,
      competitors: row?.competitor_count ?? 0,
      useOfFundsLines: row?.use_of_funds_count ?? 0,
    };
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  Investor side
// ──────────────────────────────────────────────────────────────────────────

export async function investorCompletionWithDepth(
  userId: string,
): Promise<CompletionResult> {
  return withUserRls<CompletionResult>(userId, async (sql) => {
    const [investorRows, depth] = await Promise.all([
      sql<InvestorRow[]>`
        select * from public.investors where user_id = ${userId} limit 1
      `,
      fetchInvestorDepthCounts(userId),
    ]);
    return investorCompletion(investorRows[0] ?? null, depth);
  });
}

export async function fetchInvestorDepthCounts(
  userId: string,
): Promise<InvestorDepthCounts> {
  return withUserRls<InvestorDepthCounts>(userId, async (sql) => {
    type Row = {
      team_count: number;
      check_band_count: number;
      portfolio_count: number;
      has_track_record: boolean;
      has_decision_process: boolean;
      value_add_count: number;
      anti_pattern_count: number;
    };
    const rows = await sql<Row[]>`
      select
        (select count(*)::int from public.investor_team_members where user_id = ${userId}) as team_count,
        (select count(*)::int from public.investor_check_bands where user_id = ${userId}) as check_band_count,
        (select count(*)::int from public.investor_portfolio where user_id = ${userId}) as portfolio_count,
        (select exists(select 1 from public.investor_track_record where user_id = ${userId})) as has_track_record,
        (select exists(select 1 from public.investor_decision_process where user_id = ${userId})) as has_decision_process,
        (select count(*)::int from public.investor_value_add where user_id = ${userId}) as value_add_count,
        (select count(*)::int from public.investor_anti_patterns where user_id = ${userId}) as anti_pattern_count
    `;
    const row = rows[0];
    return {
      teamMembers: row?.team_count ?? 0,
      checkBands: row?.check_band_count ?? 0,
      portfolioEntries: row?.portfolio_count ?? 0,
      hasTrackRecord: row?.has_track_record ?? false,
      hasDecisionProcess: row?.has_decision_process ?? false,
      valueAddEntries: row?.value_add_count ?? 0,
      antiPatternEntries: row?.anti_pattern_count ?? 0,
    };
  });
}
