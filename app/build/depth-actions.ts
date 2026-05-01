"use server";

/**
 * Server actions for the profile-depth child tables (0012–0014).
 * Founder side: team members, round details, cap table summary,
 * use-of-funds lines, traction signals, market analysis, competitive
 * landscape.
 *
 * Auth pattern mirrors app/build/actions.ts:
 *   1. requireWrite() — must be signed in, email verified, onboarded.
 *   2. Zod parse.
 *   3. Load the caller's startup row to get startup_id (needed for all
 *      child inserts).
 *   4. withUserRls(userId, …) — RLS policies enforce ownership via the
 *      parent startup row.
 *
 * All upserts are "replace everything in this section" rather than
 * individual-row edits so the client can send the full new state and
 * the server writes it atomically. Team members and use-of-funds lines
 * (1:N tables) are deleted-then-reinserted inside one transaction.
 */

import { revalidatePath } from "next/cache";
import { withUserRls } from "@/lib/db";
import { requireWrite } from "@/lib/auth/access";
import {
  startupTeamMemberSchema,
  startupRoundDetailsSchema,
  startupCapTableSummarySchema,
  startupUseOfFundsSchema,
  startupTractionSignalSchema,
  startupMarketAnalysisSchema,
  startupCompetitorSchema,
  startupNarrativeSchema,
  type StartupTeamMemberInput,
  type StartupRoundDetailsInput,
  type StartupCapTableSummaryInput,
  type StartupUseOfFundsInput,
  type StartupTractionSignalInput,
  type StartupMarketAnalysisInput,
  type StartupCompetitorInput,
  type StartupNarrativeInput,
} from "@/lib/validation/depth";

type DepthResult = { ok: true } | { ok: false; error: string };

// ──────────────────────────────────────────────────────────────────────────
//  Helper: load caller's startup id
// ──────────────────────────────────────────────────────────────────────────

async function loadStartupId(userId: string): Promise<string | null> {
  return withUserRls(userId, async (sql) => {
    const rows = await sql<{ id: string }[]>`
      select id from public.startups where user_id = ${userId} limit 1
    `;
    return rows[0]?.id ?? null;
  });
}

function parseError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Unexpected error. Try again.";
}

// ──────────────────────────────────────────────────────────────────────────
//  Team members
// ──────────────────────────────────────────────────────────────────────────

/**
 * Replace the startup's team-member list. Caller sends the full ordered
 * array; we delete existing rows and re-insert in one transaction so
 * display_order stays consistent.
 */
export async function saveStartupTeamAction(
  members: StartupTeamMemberInput[],
): Promise<DepthResult> {
  const access = await requireWrite();
  if (!access.ok) return { ok: false, error: access.message };
  const userId = access.userId;

  const parsed = members.map((m, i) => {
    const r = startupTeamMemberSchema.safeParse(m);
    if (!r.success) {
      return { ok: false as const, error: `Row ${i + 1}: ${r.error.issues[0]?.message ?? "Invalid."}` };
    }
    return { ok: true as const, data: r.data };
  });
  const failed = parsed.find((p) => !p.ok);
  if (failed && !failed.ok) return { ok: false, error: failed.error };
  const rows = parsed.filter((p): p is { ok: true; data: StartupTeamMemberInput } => p.ok).map((p) => p.data);

  const startupId = await loadStartupId(userId);
  if (!startupId) return { ok: false, error: "Create your startup profile first." };

  try {
    await withUserRls(userId, async (sql) => {
      await sql`delete from public.startup_team_members where startup_id = ${startupId}`;
      for (let i = 0; i < rows.length; i++) {
        const m = rows[i]!;
        await sql`
          insert into public.startup_team_members
            (startup_id, name, role, is_founder, is_full_time, bio,
             prior_company, prior_role, linkedin_url, github_url,
             equity_pct_band, display_order)
          values (
            ${startupId}, ${m.name}, ${m.role},
            ${m.is_founder ?? false}, ${m.is_full_time ?? true},
            ${m.bio ?? null}, ${m.prior_company ?? null}, ${m.prior_role ?? null},
            ${m.linkedin_url ?? null}, ${m.github_url ?? null},
            ${m.equity_pct_band ?? null},
            ${i}
          )
        `;
      }
    });
  } catch (e) {
    return { ok: false, error: parseError(e) };
  }

  revalidatePath("/build");
  revalidatePath(`/p/${userId}`);
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
//  Round details (1:1)
// ──────────────────────────────────────────────────────────────────────────

export async function saveStartupRoundDetailsAction(
  input: StartupRoundDetailsInput,
): Promise<DepthResult> {
  const access = await requireWrite();
  if (!access.ok) return { ok: false, error: access.message };
  const userId = access.userId;

  const parsed = startupRoundDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  const startupId = await loadStartupId(userId);
  if (!startupId) return { ok: false, error: "Create your startup profile first." };

  try {
    await withUserRls(userId, async (sql) => {
      await sql`
        insert into public.startup_round_details
          (startup_id, instrument, valuation_band, target_raise_usd,
           min_check_usd, lead_status, close_by_date, committed_amount_usd,
           use_of_funds_summary, instrument_terms_summary,
           runway_months_after_raise, milestones_summary)
        values (
          ${startupId},
          ${d.instrument ?? null}::public.round_instrument,
          ${d.valuation_band ?? null},
          ${d.target_raise_usd ?? null},
          ${d.min_check_usd ?? null},
          ${d.lead_status}::public.round_lead_status,
          ${d.close_by_date ?? null},
          ${d.committed_amount_usd ?? 0},
          ${d.use_of_funds_summary ?? null},
          ${d.instrument_terms_summary ?? null},
          ${d.runway_months_after_raise ?? null},
          ${d.milestones_summary ?? null}
        )
        on conflict (startup_id) do update set
          instrument               = excluded.instrument,
          valuation_band           = excluded.valuation_band,
          target_raise_usd         = excluded.target_raise_usd,
          min_check_usd            = excluded.min_check_usd,
          lead_status              = excluded.lead_status,
          close_by_date            = excluded.close_by_date,
          committed_amount_usd     = excluded.committed_amount_usd,
          use_of_funds_summary     = excluded.use_of_funds_summary,
          instrument_terms_summary = excluded.instrument_terms_summary,
          runway_months_after_raise = excluded.runway_months_after_raise,
          milestones_summary        = excluded.milestones_summary
      `;
    });
  } catch (e) {
    return { ok: false, error: parseError(e) };
  }

  revalidatePath("/build");
  revalidatePath(`/p/${userId}`);
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
//  Cap table summary (1:1)
// ──────────────────────────────────────────────────────────────────────────

export async function saveStartupCapTableAction(
  input: StartupCapTableSummaryInput,
): Promise<DepthResult> {
  const access = await requireWrite();
  if (!access.ok) return { ok: false, error: access.message };
  const userId = access.userId;

  const parsed = startupCapTableSummarySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  const startupId = await loadStartupId(userId);
  if (!startupId) return { ok: false, error: "Create your startup profile first." };

  try {
    await withUserRls(userId, async (sql) => {
      await sql`
        insert into public.startup_cap_table_summary
          (startup_id, founders_pct_band, employee_pool_pct_band,
           outside_investors_pct_band, prior_raises_count,
           last_round_amount_band, last_round_year)
        values (
          ${startupId},
          ${d.founders_pct_band ?? null},
          ${d.employee_pool_pct_band ?? null},
          ${d.outside_investors_pct_band ?? null},
          ${d.prior_raises_count ?? 0},
          ${d.last_round_amount_band ?? null},
          ${d.last_round_year ?? null}
        )
        on conflict (startup_id) do update set
          founders_pct_band            = excluded.founders_pct_band,
          employee_pool_pct_band       = excluded.employee_pool_pct_band,
          outside_investors_pct_band   = excluded.outside_investors_pct_band,
          prior_raises_count           = excluded.prior_raises_count,
          last_round_amount_band       = excluded.last_round_amount_band,
          last_round_year              = excluded.last_round_year
      `;
    });
  } catch (e) {
    return { ok: false, error: parseError(e) };
  }

  revalidatePath("/build");
  revalidatePath(`/p/${userId}`);
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
//  Use of funds (1:N — unique by startup_id + category)
// ──────────────────────────────────────────────────────────────────────────

export async function saveStartupUseOfFundsAction(
  input: StartupUseOfFundsInput,
): Promise<DepthResult> {
  const access = await requireWrite();
  if (!access.ok) return { ok: false, error: access.message };
  const userId = access.userId;

  const parsed = startupUseOfFundsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { lines } = parsed.data;

  const totalPct = lines.reduce((sum, l) => sum + l.pct_of_raise, 0);
  if (totalPct > 100) {
    return { ok: false, error: `Percentages sum to ${totalPct}% — must be 100% or less.` };
  }

  const startupId = await loadStartupId(userId);
  if (!startupId) return { ok: false, error: "Create your startup profile first." };

  try {
    await withUserRls(userId, async (sql) => {
      await sql`delete from public.startup_use_of_funds_lines where startup_id = ${startupId}`;
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i]!;
        await sql`
          insert into public.startup_use_of_funds_lines
            (startup_id, category, pct_of_raise, narrative, display_order)
          values (
            ${startupId},
            ${l.category}::public.use_of_funds_category,
            ${l.pct_of_raise},
            ${l.narrative ?? null},
            ${i}
          )
        `;
      }
    });
  } catch (e) {
    return { ok: false, error: parseError(e) };
  }

  revalidatePath("/build");
  revalidatePath(`/p/${userId}`);
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
//  Traction signals (1:N — delete-and-replace)
// ──────────────────────────────────────────────────────────────────────────

export async function saveStartupTractionAction(
  signals: StartupTractionSignalInput[],
): Promise<DepthResult> {
  const access = await requireWrite();
  if (!access.ok) return { ok: false, error: access.message };
  const userId = access.userId;

  const parsed = signals.map((s, i) => {
    const r = startupTractionSignalSchema.safeParse(s);
    if (!r.success) {
      return { ok: false as const, error: `Signal ${i + 1}: ${r.error.issues[0]?.message ?? "Invalid."}` };
    }
    return { ok: true as const, data: r.data };
  });
  const failed = parsed.find((p) => !p.ok);
  if (failed && !failed.ok) return { ok: false, error: failed.error };
  const rows = parsed.filter((p): p is { ok: true; data: StartupTractionSignalInput } => p.ok).map((p) => p.data);

  const startupId = await loadStartupId(userId);
  if (!startupId) return { ok: false, error: "Create your startup profile first." };

  try {
    await withUserRls(userId, async (sql) => {
      await sql`delete from public.startup_traction_signals where startup_id = ${startupId}`;
      for (let i = 0; i < rows.length; i++) {
        const s = rows[i]!;
        await sql`
          insert into public.startup_traction_signals
            (startup_id, kind, value_numeric, period_start, period_end,
             evidence_url, source_kind, self_reported, notes, display_order)
          values (
            ${startupId},
            ${s.kind}::public.traction_kind,
            ${s.value_numeric},
            ${s.period_start ?? null},
            ${s.period_end ?? null},
            ${s.evidence_url ?? null},
            ${s.source_kind}::public.traction_source_kind,
            ${s.self_reported ?? true},
            ${s.notes ?? null},
            ${i}
          )
        `;
      }
    });
  } catch (e) {
    return { ok: false, error: parseError(e) };
  }

  revalidatePath("/build");
  revalidatePath(`/p/${userId}`);
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
//  Market analysis (1:1)
// ──────────────────────────────────────────────────────────────────────────

export async function saveStartupMarketAnalysisAction(
  input: StartupMarketAnalysisInput,
): Promise<DepthResult> {
  const access = await requireWrite();
  if (!access.ok) return { ok: false, error: access.message };
  const userId = access.userId;

  const parsed = startupMarketAnalysisSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  const startupId = await loadStartupId(userId);
  if (!startupId) return { ok: false, error: "Create your startup profile first." };

  try {
    await withUserRls(userId, async (sql) => {
      await sql`
        insert into public.startup_market_analysis
          (startup_id, tam_band, sam_band, som_band,
           methodology_summary, source_links)
        values (
          ${startupId},
          ${d.tam_band ?? null},
          ${d.sam_band ?? null},
          ${d.som_band ?? null},
          ${d.methodology_summary ?? null},
          ${JSON.stringify(d.source_links ?? [])}::jsonb
        )
        on conflict (startup_id) do update set
          tam_band             = excluded.tam_band,
          sam_band             = excluded.sam_band,
          som_band             = excluded.som_band,
          methodology_summary  = excluded.methodology_summary,
          source_links         = excluded.source_links
      `;
    });
  } catch (e) {
    return { ok: false, error: parseError(e) };
  }

  revalidatePath("/build");
  revalidatePath(`/p/${userId}`);
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
//  Competitive landscape (1:N — delete-and-replace)
// ──────────────────────────────────────────────────────────────────────────

export async function saveStartupCompetitorsAction(
  competitors: StartupCompetitorInput[],
): Promise<DepthResult> {
  const access = await requireWrite();
  if (!access.ok) return { ok: false, error: access.message };
  const userId = access.userId;

  const parsed = competitors.map((c, i) => {
    const r = startupCompetitorSchema.safeParse(c);
    if (!r.success) {
      return { ok: false as const, error: `Row ${i + 1}: ${r.error.issues[0]?.message ?? "Invalid."}` };
    }
    return { ok: true as const, data: r.data };
  });
  const failed = parsed.find((p) => !p.ok);
  if (failed && !failed.ok) return { ok: false, error: failed.error };
  const rows = parsed.filter((p): p is { ok: true; data: StartupCompetitorInput } => p.ok).map((p) => p.data);

  if (rows.length > 20) {
    return { ok: false, error: "Maximum 20 competitors." };
  }

  const startupId = await loadStartupId(userId);
  if (!startupId) return { ok: false, error: "Create your startup profile first." };

  try {
    await withUserRls(userId, async (sql) => {
      await sql`delete from public.startup_competitive_landscape where startup_id = ${startupId}`;
      for (let i = 0; i < rows.length; i++) {
        const c = rows[i]!;
        await sql`
          insert into public.startup_competitive_landscape
            (startup_id, competitor_name, differentiation, link_url, display_order)
          values (
            ${startupId}, ${c.competitor_name},
            ${c.differentiation ?? null}, ${c.link_url ?? null}, ${i}
          )
        `;
      }
    });
  } catch (e) {
    return { ok: false, error: parseError(e) };
  }

  revalidatePath("/build");
  revalidatePath(`/p/${userId}`);
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
//  Startup narrative (1:1) — 0035
// ──────────────────────────────────────────────────────────────────────────

export async function saveStartupNarrativeAction(
  input: StartupNarrativeInput,
): Promise<DepthResult> {
  const access = await requireWrite();
  if (!access.ok) return { ok: false, error: access.message };
  const userId = access.userId;

  const parsed = startupNarrativeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  const startupId = await loadStartupId(userId);
  if (!startupId) return { ok: false, error: "Create your startup profile first." };

  try {
    await withUserRls(userId, async (sql) => {
      await sql`
        insert into public.startup_narrative
          (startup_id,
           problem_statement, target_customer, current_alternatives, why_alternatives_fail,
           product_summary, key_features, technical_moat, roadmap,
           target_market, market_trend, beachhead_market, why_now,
           notable_customers, customer_proof, retention_engagement,
           revenue_model, pricing, average_contract_value_band, gross_margin_band, sales_cycle_band,
           acquisition_channels, current_gtm, planned_gtm, why_channels_work,
           why_we_win, defensibility, investor_misunderstanding,
           founder_background, founder_market_fit, technical_strengths, business_strengths, advisors, key_hires_needed,
           technical_risk, market_risk, execution_risk, biggest_unknown, failure_scenario)
        values (
          ${startupId},
          ${d.problem_statement ?? null}, ${d.target_customer ?? null}, ${d.current_alternatives ?? null}, ${d.why_alternatives_fail ?? null},
          ${d.product_summary ?? null}, ${d.key_features ?? null}, ${d.technical_moat ?? null}, ${d.roadmap ?? null},
          ${d.target_market ?? null}, ${d.market_trend ?? null}, ${d.beachhead_market ?? null}, ${d.why_now ?? null},
          ${d.notable_customers ?? null}, ${d.customer_proof ?? null}, ${d.retention_engagement ?? null},
          ${d.revenue_model ?? null}, ${d.pricing ?? null}, ${d.average_contract_value_band ?? null}, ${d.gross_margin_band ?? null}, ${d.sales_cycle_band ?? null},
          ${d.acquisition_channels ?? null}, ${d.current_gtm ?? null}, ${d.planned_gtm ?? null}, ${d.why_channels_work ?? null},
          ${d.why_we_win ?? null}, ${d.defensibility ?? null}, ${d.investor_misunderstanding ?? null},
          ${d.founder_background ?? null}, ${d.founder_market_fit ?? null}, ${d.technical_strengths ?? null}, ${d.business_strengths ?? null}, ${d.advisors ?? null}, ${d.key_hires_needed ?? null},
          ${d.technical_risk ?? null}, ${d.market_risk ?? null}, ${d.execution_risk ?? null}, ${d.biggest_unknown ?? null}, ${d.failure_scenario ?? null}
        )
        on conflict (startup_id) do update set
          problem_statement          = excluded.problem_statement,
          target_customer            = excluded.target_customer,
          current_alternatives       = excluded.current_alternatives,
          why_alternatives_fail      = excluded.why_alternatives_fail,
          product_summary            = excluded.product_summary,
          key_features               = excluded.key_features,
          technical_moat             = excluded.technical_moat,
          roadmap                    = excluded.roadmap,
          target_market              = excluded.target_market,
          market_trend               = excluded.market_trend,
          beachhead_market           = excluded.beachhead_market,
          why_now                    = excluded.why_now,
          notable_customers          = excluded.notable_customers,
          customer_proof             = excluded.customer_proof,
          retention_engagement       = excluded.retention_engagement,
          revenue_model              = excluded.revenue_model,
          pricing                    = excluded.pricing,
          average_contract_value_band = excluded.average_contract_value_band,
          gross_margin_band          = excluded.gross_margin_band,
          sales_cycle_band           = excluded.sales_cycle_band,
          acquisition_channels       = excluded.acquisition_channels,
          current_gtm                = excluded.current_gtm,
          planned_gtm                = excluded.planned_gtm,
          why_channels_work          = excluded.why_channels_work,
          why_we_win                 = excluded.why_we_win,
          defensibility              = excluded.defensibility,
          investor_misunderstanding  = excluded.investor_misunderstanding,
          founder_background         = excluded.founder_background,
          founder_market_fit         = excluded.founder_market_fit,
          technical_strengths        = excluded.technical_strengths,
          business_strengths         = excluded.business_strengths,
          advisors                   = excluded.advisors,
          key_hires_needed           = excluded.key_hires_needed,
          technical_risk             = excluded.technical_risk,
          market_risk                = excluded.market_risk,
          execution_risk             = excluded.execution_risk,
          biggest_unknown            = excluded.biggest_unknown,
          failure_scenario           = excluded.failure_scenario
      `;
    });
  } catch (e) {
    return { ok: false, error: parseError(e) };
  }

  revalidatePath("/build");
  revalidatePath(`/p/${userId}`);
  return { ok: true };
}
