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
    // First resolve the user's startup_id. Depth tables key off startup_id,
    // not user_id. If the user has no startup row yet, return all zeros.
    const startupRows = await sql<{ id: string }[]>`
      select id from public.startups where user_id = ${userId} limit 1
    `;
    const startupId = startupRows[0]?.id;

    if (!startupId) {
      return {
        teamMembers: 0,
        tractionSignals: 0,
        hasRoundDetails: false,
        hasCapTable: false,
        hasMarketAnalysis: false,
        competitors: 0,
        useOfFundsLines: 0,
        hasNarrative: false,
        narrativeFieldsFilled: 0,
      };
    }

    // Single query for base depth counts (pre-0035 tables) keyed by startup_id.
    type BaseRow = {
      team_count: number;
      traction_count: number;
      has_round: boolean;
      has_cap_table: boolean;
      has_market: boolean;
      competitor_count: number;
      use_of_funds_count: number;
    };
    const baseRows = await sql<BaseRow[]>`
      select
        (select count(*)::int from public.startup_team_members where startup_id = ${startupId}) as team_count,
        (select count(*)::int from public.startup_traction_signals where startup_id = ${startupId}) as traction_count,
        (select exists(select 1 from public.startup_round_details where startup_id = ${startupId})) as has_round,
        (select exists(select 1 from public.startup_cap_table_summary where startup_id = ${startupId})) as has_cap_table,
        (select exists(select 1 from public.startup_market_analysis where startup_id = ${startupId})) as has_market,
        (select count(*)::int from public.startup_competitive_landscape where startup_id = ${startupId}) as competitor_count,
        (select count(*)::int from public.startup_use_of_funds_lines where startup_id = ${startupId}) as use_of_funds_count
    `;
    const base = baseRows[0];

    // 0035: Narrative counts in a separate try/catch to gracefully handle
    // the case where the table doesn't exist yet (migration not applied).
    let hasNarrative = false;
    let narrativeFieldsFilled = 0;
    try {
      type NarrativeRow = { has_narrative: boolean; narrative_fields_filled: number };
      const narrativeRows = await sql<NarrativeRow[]>`
        select
          exists(
            select 1 from public.startup_narrative
            where startup_id = ${startupId}
          ) as has_narrative,
          coalesce((
            select (
              case when problem_statement is not null and length(problem_statement) > 10 then 1 else 0 end +
              case when target_customer is not null and length(target_customer) > 10 then 1 else 0 end +
              case when product_summary is not null and length(product_summary) > 10 then 1 else 0 end +
              case when technical_moat is not null and length(technical_moat) > 10 then 1 else 0 end +
              case when why_we_win is not null and length(why_we_win) > 10 then 1 else 0 end +
              case when founder_background is not null and length(founder_background) > 10 then 1 else 0 end
            )
            from public.startup_narrative
            where startup_id = ${startupId}
            limit 1
          ), 0)::int as narrative_fields_filled
      `;
      hasNarrative = narrativeRows[0]?.has_narrative ?? false;
      narrativeFieldsFilled = narrativeRows[0]?.narrative_fields_filled ?? 0;
    } catch {
      // Table doesn't exist or query failed — gracefully degrade.
    }

    return {
      teamMembers: base?.team_count ?? 0,
      tractionSignals: base?.traction_count ?? 0,
      hasRoundDetails: base?.has_round ?? false,
      hasCapTable: base?.has_cap_table ?? false,
      hasMarketAnalysis: base?.has_market ?? false,
      competitors: base?.competitor_count ?? 0,
      useOfFundsLines: base?.use_of_funds_count ?? 0,
      hasNarrative,
      narrativeFieldsFilled,
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
    // Resolve investor_id first — depth tables key off investor_id, not user_id.
    const investorRows = await sql<{ id: string }[]>`
      select id from public.investors where user_id = ${userId} limit 1
    `;
    const investorId = investorRows[0]?.id;

    if (!investorId) {
      return {
        teamMembers: 0,
        checkBands: 0,
        portfolioEntries: 0,
        hasTrackRecord: false,
        hasDecisionProcess: false,
        valueAddEntries: 0,
        antiPatternEntries: 0,
      };
    }

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
        (select count(*)::int from public.investor_team_members where investor_id = ${investorId}) as team_count,
        (select count(*)::int from public.investor_check_bands where investor_id = ${investorId}) as check_band_count,
        (select count(*)::int from public.investor_portfolio where investor_id = ${investorId}) as portfolio_count,
        (select exists(select 1 from public.investor_track_record where investor_id = ${investorId})) as has_track_record,
        (select exists(select 1 from public.investor_decision_process where investor_id = ${investorId})) as has_decision_process,
        (select count(*)::int from public.investor_value_add where investor_id = ${investorId}) as value_add_count,
        (select count(*)::int from public.investor_anti_patterns where investor_id = ${investorId}) as anti_pattern_count
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
