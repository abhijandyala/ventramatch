/**
 * lib/quality/runtime/profile-adapters.ts
 *
 * Converts production database rows into the plain-object input types that
 * lib/quality/review.ts expects.
 *
 * ─── DESIGN NOTES ────────────────────────────────────────────────────────────
 * • Pure functions: no I/O, no DB access, no network calls.
 * • Accepts only the row types already available at the call site; no extra
 *   queries are required in Phase 14a.
 * • Depth-table fields (problem, solution, founder_background,
 *   traction_signals_count, team_members_count, anti_thesis_texts, etc.) are
 *   typed as `undefined` so the rule engine skips those checks gracefully.
 *   They will be populated in a later phase once depth-table loading is wired.
 * • Does NOT import from @/lib/db — the adapter is a pure mapping layer.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This is NOT investment advice.  Quality labels describe profile completeness
 * and structural coherence only, never funding merit or startup success potential.
 */

import type { StartupQualityInput, InvestorQualityInput } from "@/lib/quality/types";
import type { Database } from "@/types/database";

type StartupRow = Database["public"]["Tables"]["startups"]["Row"];
type InvestorRow = Database["public"]["Tables"]["investors"]["Row"];

/**
 * Convert a production `startups` row into a StartupQualityInput.
 *
 * Phase 14a: maps only the base row fields. Depth-table pitch narrative fields
 * (problem, solution, founder_background) and depth-count signals
 * (traction_signals_count, team_members_count) are omitted — the rule engine
 * degrades gracefully when they are `undefined`.
 *
 * @param row   The startups table row for the user.
 * @param opts  Optional context available at the call site (user email for
 *              burner-domain check).  All fields are optional.
 */
export function toStartupQualityInput(
  row: StartupRow,
  opts: { email?: string | null } = {},
): StartupQualityInput {
  // startup_sectors was added in migration 0019.  Guard defensively so the
  // adapter doesn't throw if the column exists in the type but is unexpectedly
  // absent in a pre-migration snapshot.
  const sectors = Array.isArray(row.startup_sectors) ? (row.startup_sectors as string[]) : [];

  // founded_year and customer_type were added in migration 0035.  Cast via
  // Record so TypeScript doesn't complain if type-defs lag behind the schema.
  const extra = row as Record<string, unknown>;

  return {
    profile_kind:    "startup",
    name:            row.name     ?? null,
    one_liner:       row.one_liner ?? null,
    website:         row.website   ?? null,
    email:           opts.email    ?? null,
    industry:        row.industry  ?? null,
    startup_sectors: sectors,
    stage:           row.stage     ?? null,
    raise_amount:    typeof row.raise_amount === "number" ? row.raise_amount : null,
    location:        row.location  ?? null,
    customer_type:   typeof extra.customer_type === "string" ? extra.customer_type : null,
    // business_model is not a column on the production startups table.
    business_model:  null,
    traction:        row.traction  ?? null,
    deck_url:        row.deck_url  ?? null,
    founded_year:    typeof extra.founded_year === "number" ? extra.founded_year : null,

    // ── Depth-table fields — omitted in Phase 14a ─────────────────────────────
    // Rules that depend on these fields return no flags when the values are
    // undefined.  Populate in a later phase by loading startup_narrative,
    // startup_team_members, and startup_traction_signals rows.
    problem:             undefined,
    solution:            undefined,
    founder_background:  undefined,
    traction_signals_count: undefined,
    team_members_count:     undefined,
  };
}

/**
 * Convert a production `investors` row into an InvestorQualityInput.
 *
 * Phase 14a: maps only the base row fields.  Depth-table signals
 * (anti_thesis_texts, check_bands_count, portfolio_entries_count) and
 * lead_or_follow (not currently in the production schema) are omitted.
 *
 * @param row   The investors table row for the user.
 * @param opts  Optional context (user email for burner-domain check).
 */
export function toInvestorQualityInput(
  row: InvestorRow,
  opts: { email?: string | null } = {},
): InvestorQualityInput {
  // stages is startup_stage[] in the DB; coerce to string[] for the rule engine.
  const stages = Array.isArray(row.stages) ? (row.stages as string[]) : [];

  return {
    profile_kind:    "investor",
    name:            row.name   ?? null,
    firm:            row.firm   ?? null,
    thesis:          row.thesis ?? null,
    email:           opts.email ?? null,
    sectors:         Array.isArray(row.sectors)     ? (row.sectors as string[])     : [],
    stages,
    geographies:     Array.isArray(row.geographies) ? (row.geographies as string[]) : [],
    // lead_or_follow is not present on the production investors table in Phase 14.
    // Set to null so lead-follow rules produce no signal; add it in the future
    // if/when that column is added.
    lead_or_follow:  null,
    check_min:       typeof row.check_min === "number" ? row.check_min : null,
    check_max:       typeof row.check_max === "number" ? row.check_max : null,
    is_active:       row.is_active ?? null,

    // ── Depth-table fields — omitted in Phase 14a ─────────────────────────────
    anti_thesis_texts:       undefined,
    check_bands_count:       undefined,
    portfolio_entries_count: undefined,
  };
}
