"use server";

/**
 * Server actions for the investor-depth child tables (0012, 0015).
 * Investor side: team members, check bands, portfolio, track record,
 * decision process, value-add, anti-patterns.
 *
 * Same auth + RLS pattern as app/build/depth-actions.ts (founder side).
 */

import { revalidatePath } from "next/cache";
import { withUserRls } from "@/lib/db";
import { requireWrite } from "@/lib/auth/access";
import {
  investorTeamMemberSchema,
  investorCheckBandSchema,
  investorPortfolioEntrySchema,
  investorTrackRecordSchema,
  investorDecisionProcessSchema,
  investorValueAddEntrySchema,
  investorAntiPatternEntrySchema,
  type InvestorTeamMemberInput,
  type InvestorCheckBandInput,
  type InvestorPortfolioEntryInput,
  type InvestorTrackRecordInput,
  type InvestorDecisionProcessInput,
  type InvestorValueAddEntryInput,
  type InvestorAntiPatternEntryInput,
} from "@/lib/validation/depth";

type DepthResult = { ok: true } | { ok: false; error: string };

async function loadInvestorId(userId: string): Promise<string | null> {
  return withUserRls(userId, async (sql) => {
    const rows = await sql<{ id: string }[]>`
      select id from public.investors where user_id = ${userId} limit 1
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

export async function saveInvestorTeamAction(
  members: InvestorTeamMemberInput[],
): Promise<DepthResult> {
  const access = await requireWrite();
  if (!access.ok) return { ok: false, error: access.message };
  const userId = access.userId;

  const parsed = members.map((m, i) => {
    const r = investorTeamMemberSchema.safeParse(m);
    if (!r.success) {
      return { ok: false as const, error: `Row ${i + 1}: ${r.error.issues[0]?.message ?? "Invalid."}` };
    }
    return { ok: true as const, data: r.data };
  });
  const failed = parsed.find((p) => !p.ok);
  if (failed && !failed.ok) return { ok: false, error: failed.error };
  const rows = parsed.filter((p): p is { ok: true; data: InvestorTeamMemberInput } => p.ok).map((p) => p.data);

  const investorId = await loadInvestorId(userId);
  if (!investorId) return { ok: false, error: "Create your investor profile first." };

  try {
    await withUserRls(userId, async (sql) => {
      await sql`delete from public.investor_team_members where investor_id = ${investorId}`;
      for (let i = 0; i < rows.length; i++) {
        const m = rows[i]!;
        await sql`
          insert into public.investor_team_members
            (investor_id, name, role, is_decision_maker, bio, linkedin_url, display_order)
          values (
            ${investorId}, ${m.name}, ${m.role},
            ${m.is_decision_maker ?? false},
            ${m.bio ?? null}, ${m.linkedin_url ?? null}, ${i}
          )
        `;
      }
    });
  } catch (e) {
    return { ok: false, error: parseError(e) };
  }

  revalidatePath("/build/investor");
  revalidatePath(`/p/${userId}`);
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
//  Check bands (1:N — unique by investor_id + stage + role)
// ──────────────────────────────────────────────────────────────────────────

export async function saveInvestorCheckBandsAction(
  bands: InvestorCheckBandInput[],
): Promise<DepthResult> {
  const access = await requireWrite();
  if (!access.ok) return { ok: false, error: access.message };
  const userId = access.userId;

  const parsed = bands.map((b, i) => {
    const r = investorCheckBandSchema.safeParse(b);
    if (!r.success) {
      return { ok: false as const, error: `Band ${i + 1}: ${r.error.issues[0]?.message ?? "Invalid."}` };
    }
    if (r.data.check_max_usd < r.data.check_min_usd) {
      return { ok: false as const, error: `Band ${i + 1}: Max must be ≥ min.` };
    }
    return { ok: true as const, data: r.data };
  });
  const failed = parsed.find((p) => !p.ok);
  if (failed && !failed.ok) return { ok: false, error: failed.error };
  const rows = parsed.filter((p): p is { ok: true; data: InvestorCheckBandInput } => p.ok).map((p) => p.data);

  const investorId = await loadInvestorId(userId);
  if (!investorId) return { ok: false, error: "Create your investor profile first." };

  try {
    await withUserRls(userId, async (sql) => {
      await sql`delete from public.investor_check_bands where investor_id = ${investorId}`;
      for (const b of rows) {
        await sql`
          insert into public.investor_check_bands
            (investor_id, stage, role, check_min_usd, check_max_usd, ownership_target_band)
          values (
            ${investorId},
            ${b.stage}::public.startup_stage,
            ${b.role}::public.investor_check_role,
            ${b.check_min_usd},
            ${b.check_max_usd},
            ${b.ownership_target_band ?? null}
          )
          on conflict (investor_id, stage, role) do update set
            check_min_usd        = excluded.check_min_usd,
            check_max_usd        = excluded.check_max_usd,
            ownership_target_band = excluded.ownership_target_band
        `;
      }
    });
  } catch (e) {
    return { ok: false, error: parseError(e) };
  }

  revalidatePath("/build/investor");
  revalidatePath(`/p/${userId}`);
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
//  Portfolio (1:N — delete-and-replace)
// ──────────────────────────────────────────────────────────────────────────

export async function saveInvestorPortfolioAction(
  entries: InvestorPortfolioEntryInput[],
): Promise<DepthResult> {
  const access = await requireWrite();
  if (!access.ok) return { ok: false, error: access.message };
  const userId = access.userId;

  if (entries.length > 100) {
    return { ok: false, error: "Maximum 100 portfolio entries." };
  }

  const parsed = entries.map((e, i) => {
    const r = investorPortfolioEntrySchema.safeParse(e);
    if (!r.success) {
      return { ok: false as const, error: `Entry ${i + 1}: ${r.error.issues[0]?.message ?? "Invalid."}` };
    }
    return { ok: true as const, data: r.data };
  });
  const failed = parsed.find((p) => !p.ok);
  if (failed && !failed.ok) return { ok: false, error: failed.error };
  const rows = parsed.filter((p): p is { ok: true; data: InvestorPortfolioEntryInput } => p.ok).map((p) => p.data);

  const investorId = await loadInvestorId(userId);
  if (!investorId) return { ok: false, error: "Create your investor profile first." };

  try {
    await withUserRls(userId, async (sql) => {
      await sql`delete from public.investor_portfolio where investor_id = ${investorId}`;
      for (let i = 0; i < rows.length; i++) {
        const e = rows[i]!;
        await sql`
          insert into public.investor_portfolio
            (investor_id, company_name, year, role, is_public_listing,
             sector, is_exited, exit_kind, notes, display_order)
          values (
            ${investorId}, ${e.company_name},
            ${e.year ?? null},
            ${e.role}::public.investor_role,
            ${e.is_public_listing ?? true},
            ${e.sector ?? null},
            ${e.is_exited ?? false},
            ${e.exit_kind ?? null}::public.investor_exit_kind,
            ${e.notes ?? null},
            ${i}
          )
        `;
      }
    });
  } catch (e) {
    return { ok: false, error: parseError(e) };
  }

  revalidatePath("/build/investor");
  revalidatePath(`/p/${userId}`);
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
//  Track record (1:1)
// ──────────────────────────────────────────────────────────────────────────

export async function saveInvestorTrackRecordAction(
  input: InvestorTrackRecordInput,
): Promise<DepthResult> {
  const access = await requireWrite();
  if (!access.ok) return { ok: false, error: access.message };
  const userId = access.userId;

  const parsed = investorTrackRecordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  const investorId = await loadInvestorId(userId);
  if (!investorId) return { ok: false, error: "Create your investor profile first." };

  try {
    await withUserRls(userId, async (sql) => {
      await sql`
        insert into public.investor_track_record
          (investor_id, total_deals_band, first_money_in_count_band,
           follow_on_rate_band, avg_ownership_band, fund_size_band,
           fund_vintage_year, dry_powder_band)
        values (
          ${investorId},
          ${d.total_deals_band ?? null},
          ${d.first_money_in_count_band ?? null},
          ${d.follow_on_rate_band ?? null},
          ${d.avg_ownership_band ?? null},
          ${d.fund_size_band ?? null},
          ${d.fund_vintage_year ?? null},
          ${d.dry_powder_band ?? null}
        )
        on conflict (investor_id) do update set
          total_deals_band          = excluded.total_deals_band,
          first_money_in_count_band = excluded.first_money_in_count_band,
          follow_on_rate_band       = excluded.follow_on_rate_band,
          avg_ownership_band        = excluded.avg_ownership_band,
          fund_size_band            = excluded.fund_size_band,
          fund_vintage_year         = excluded.fund_vintage_year,
          dry_powder_band           = excluded.dry_powder_band
      `;
    });
  } catch (e) {
    return { ok: false, error: parseError(e) };
  }

  revalidatePath("/build/investor");
  revalidatePath(`/p/${userId}`);
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
//  Decision process (1:1)
// ──────────────────────────────────────────────────────────────────────────

export async function saveInvestorDecisionProcessAction(
  input: InvestorDecisionProcessInput,
): Promise<DepthResult> {
  const access = await requireWrite();
  if (!access.ok) return { ok: false, error: access.message };
  const userId = access.userId;

  const parsed = investorDecisionProcessSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  const investorId = await loadInvestorId(userId);
  if (!investorId) return { ok: false, error: "Create your investor profile first." };

  try {
    await withUserRls(userId, async (sql) => {
      await sql`
        insert into public.investor_decision_process
          (investor_id, time_to_term_sheet_band, ic_required,
           references_required, data_room_required,
           partner_meeting_required, process_narrative)
        values (
          ${investorId},
          ${d.time_to_term_sheet_band ?? null},
          ${d.ic_required ?? true},
          ${d.references_required ?? false},
          ${d.data_room_required ?? false},
          ${d.partner_meeting_required ?? true},
          ${d.process_narrative ?? null}
        )
        on conflict (investor_id) do update set
          time_to_term_sheet_band  = excluded.time_to_term_sheet_band,
          ic_required              = excluded.ic_required,
          references_required      = excluded.references_required,
          data_room_required       = excluded.data_room_required,
          partner_meeting_required = excluded.partner_meeting_required,
          process_narrative        = excluded.process_narrative
      `;
    });
  } catch (e) {
    return { ok: false, error: parseError(e) };
  }

  revalidatePath("/build/investor");
  revalidatePath(`/p/${userId}`);
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
//  Value add (1:N — unique by investor_id + kind)
// ──────────────────────────────────────────────────────────────────────────

export async function saveInvestorValueAddAction(
  entries: InvestorValueAddEntryInput[],
): Promise<DepthResult> {
  const access = await requireWrite();
  if (!access.ok) return { ok: false, error: access.message };
  const userId = access.userId;

  const parsed = entries.map((e, i) => {
    const r = investorValueAddEntrySchema.safeParse(e);
    if (!r.success) {
      return { ok: false as const, error: `Entry ${i + 1}: ${r.error.issues[0]?.message ?? "Invalid."}` };
    }
    return { ok: true as const, data: r.data };
  });
  const failed = parsed.find((p) => !p.ok);
  if (failed && !failed.ok) return { ok: false, error: failed.error };
  const rows = parsed.filter((p): p is { ok: true; data: InvestorValueAddEntryInput } => p.ok).map((p) => p.data);

  const investorId = await loadInvestorId(userId);
  if (!investorId) return { ok: false, error: "Create your investor profile first." };

  try {
    await withUserRls(userId, async (sql) => {
      await sql`delete from public.investor_value_add where investor_id = ${investorId}`;
      for (let i = 0; i < rows.length; i++) {
        const e = rows[i]!;
        await sql`
          insert into public.investor_value_add
            (investor_id, kind, narrative, display_order)
          values (
            ${investorId},
            ${e.kind}::public.investor_value_add_kind,
            ${e.narrative ?? null},
            ${i}
          )
          on conflict (investor_id, kind) do update set
            narrative     = excluded.narrative,
            display_order = excluded.display_order
        `;
      }
    });
  } catch (e) {
    return { ok: false, error: parseError(e) };
  }

  revalidatePath("/build/investor");
  revalidatePath(`/p/${userId}`);
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
//  Anti-patterns (1:N — delete-and-replace)
// ──────────────────────────────────────────────────────────────────────────

export async function saveInvestorAntiPatternsAction(
  entries: InvestorAntiPatternEntryInput[],
): Promise<DepthResult> {
  const access = await requireWrite();
  if (!access.ok) return { ok: false, error: access.message };
  const userId = access.userId;

  const parsed = entries.map((e, i) => {
    const r = investorAntiPatternEntrySchema.safeParse(e);
    if (!r.success) {
      return { ok: false as const, error: `Entry ${i + 1}: ${r.error.issues[0]?.message ?? "Invalid."}` };
    }
    return { ok: true as const, data: r.data };
  });
  const failed = parsed.find((p) => !p.ok);
  if (failed && !failed.ok) return { ok: false, error: failed.error };
  const rows = parsed.filter((p): p is { ok: true; data: InvestorAntiPatternEntryInput } => p.ok).map((p) => p.data);

  if (rows.length > 20) {
    return { ok: false, error: "Maximum 20 anti-patterns." };
  }

  const investorId = await loadInvestorId(userId);
  if (!investorId) return { ok: false, error: "Create your investor profile first." };

  try {
    await withUserRls(userId, async (sql) => {
      await sql`delete from public.investor_anti_patterns where investor_id = ${investorId}`;
      for (let i = 0; i < rows.length; i++) {
        const e = rows[i]!;
        await sql`
          insert into public.investor_anti_patterns
            (investor_id, kind, narrative, display_order)
          values (
            ${investorId},
            ${e.kind}::public.investor_anti_pattern_kind,
            ${e.narrative},
            ${i}
          )
        `;
      }
    });
  } catch (e) {
    return { ok: false, error: parseError(e) };
  }

  revalidatePath("/build/investor");
  revalidatePath(`/p/${userId}`);
  return { ok: true };
}
