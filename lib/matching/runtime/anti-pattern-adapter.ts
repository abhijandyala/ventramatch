/**
 * lib/matching/runtime/anti-pattern-adapter.ts
 *
 * Phase 17 — Pivots production investor_anti_patterns rows into the
 * SyntheticAntiThesis shape consumed by computeProductionMatchFeatures.
 *
 * ─── NOTICE ──────────────────────────────────────────────────────────────────
 * • Not investment advice.
 * • Does not predict startup success or investment returns.
 * • scoreMatch in lib/matching/score.ts is the active production ranker.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ─── MAPPING RULES ───────────────────────────────────────────────────────────
 * Production kind → SyntheticAntiThesis field:
 *
 *   sector          → sectors[]            (tokenised through normaliseSector)
 *   founder_profile → founder_profiles[]   (narrative text verbatim)
 *   other           → founder_profiles[]   (catch-all narrative)
 *   stage           → SKIP  (covered by STAGE_MIN eligibility gate)
 *   geography       → SKIP  (covered by investor.geographies[] filter)
 *   check_size      → SKIP  (covered by CHECK_SIZE_MIN eligibility gate)
 *
 * customer_types[] and business_models[] default to [] because the production
 * schema has no corresponding anti-pattern kind in Phase 17.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { normaliseSector } from "@/lib/profile/sectors";
import type { SyntheticAntiThesis } from "@/lib/matching/features";

// ── Production row shape ────────────────────────────────────────────────────

/** Minimal projection of public.investor_anti_patterns we need. */
export type AntiPatternRow = {
  investor_id: string;
  kind: string; // 'sector' | 'stage' | 'geography' | 'founder_profile' | 'check_size' | 'other'
  narrative: string;
};

// ── Pure pivot function ─────────────────────────────────────────────────────

/**
 * Convert an investor's anti_patterns rows into a SyntheticAntiThesis object.
 *
 * This is a pure function — no DB access, no side effects.
 * Returns an empty (no-conflict) SyntheticAntiThesis when `rows` is empty.
 *
 * @param rows  All anti_patterns rows for ONE investor.
 */
export function pivotAntiPatterns(rows: AntiPatternRow[]): SyntheticAntiThesis {
  const sectors: string[] = [];
  const founderProfiles: string[] = [];

  for (const row of rows) {
    const kind = row.kind;
    const narrative = row.narrative.trim();
    if (!narrative) continue;

    if (kind === "sector") {
      // Each sector anti-pattern narrative may be a single sector label,
      // a comma-separated list, or a short phrase.  We extract tokens that
      // canonicalise to a known sector label.
      const tokens = narrative.split(/[,;\/\n]+/).map((t) => t.trim()).filter(Boolean);
      for (const token of tokens) {
        const normalised = normaliseSector(token);
        if (normalised) sectors.push(normalised);
      }
    } else if (kind === "founder_profile" || kind === "other") {
      founderProfiles.push(narrative);
    }
    // stage, geography, check_size: deliberately skipped (structured gates cover them).
  }

  return {
    sectors,
    customer_types: [],    // no production kind maps here in Phase 17
    business_models: [],   // no production kind maps here in Phase 17
    founder_profiles: founderProfiles,
  };
}

// ── DB-bound loader ─────────────────────────────────────────────────────────

type SqlClient = Parameters<Parameters<typeof import("@/lib/db").withUserRls>[1]>[0];

/**
 * Load anti_patterns for a list of investor ids and pivot them per investor.
 *
 * Designed to be called inside an existing withUserRls callback so the DB
 * connection is shared and no extra round-trip is needed.
 *
 * Returns a Map<investor_id, SyntheticAntiThesis>.  Investors with no rows
 * get an empty SyntheticAntiThesis (no-conflict default).
 *
 * @param sql         The postgres.js sql tag from within a withUserRls block.
 * @param investorIds List of investor user_ids to load for.
 */
export async function loadAntiThesisForInvestors(
  sql: SqlClient,
  investorIds: string[],
): Promise<Map<string, SyntheticAntiThesis>> {
  const result = new Map<string, SyntheticAntiThesis>();

  if (investorIds.length === 0) return result;

  // Join through investors to resolve user_id → investor_id
  const rows = await sql<AntiPatternRow[]>`
    select i.user_id as investor_id,
           ap.kind,
           ap.narrative
    from public.investor_anti_patterns ap
    join public.investors i on i.id = ap.investor_id
    where i.user_id = any(${investorIds})
    order by i.user_id, ap.display_order, ap.created_at
  `;

  // Group by investor user_id
  const byInvestor = new Map<string, AntiPatternRow[]>();
  for (const row of rows) {
    const arr = byInvestor.get(row.investor_id) ?? [];
    arr.push(row);
    byInvestor.set(row.investor_id, arr);
  }

  // Pivot each group; fill in empty SyntheticAntiThesis for investors with no rows
  for (const investorId of investorIds) {
    const antiRows = byInvestor.get(investorId) ?? [];
    result.set(investorId, pivotAntiPatterns(antiRows));
  }

  return result;
}
