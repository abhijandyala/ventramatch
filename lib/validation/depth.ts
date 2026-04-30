/**
 * Zod schemas for the profile-depth tables (0012–0016).
 *
 * One schema per table (or sub-entity). Each follows the same shape as
 * the DB CHECK constraints to give a consistent error at the app layer
 * before we ever hit Postgres. "Save" variants are partial (all optional)
 * for incremental saves; "upsert" variants are stricter.
 *
 * Per-field constraints are derived directly from the SQL in
 * db/migrations/0012–0016_profile_depth_*.sql.
 */

import { z } from "zod";

// ──────────────────────────────────────────────────────────────────────────
//  Shared primitives
// ──────────────────────────────────────────────────────────────────────────

const optUrl = z
  .string()
  .trim()
  .url("Use a full URL starting with https://")
  .max(500, "URL too long.")
  .optional()
  .or(z.literal("").transform(() => undefined));

const optText = (max: number) =>
  z.string().trim().max(max, `Keep this under ${max} characters.`).optional()
    .or(z.literal("").transform(() => undefined));

const stageEnum = z.enum([
  "idea",
  "pre_seed",
  "seed",
  "series_a",
  "series_b_plus",
]);

// ──────────────────────────────────────────────────────────────────────────
//  0012 — Team
// ──────────────────────────────────────────────────────────────────────────

const equityBands = [
  "under_5",
  "5_15",
  "15_30",
  "30_50",
  "over_50",
] as const;

export const startupTeamMemberSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(120, "Name too long."),
  role: z
    .string()
    .trim()
    .min(2, "Role is required.")
    .max(80, "Role too long."),
  is_founder: z.boolean().default(false),
  is_full_time: z.boolean().default(true),
  bio: optText(600),
  prior_company: optText(120),
  prior_role: optText(80),
  linkedin_url: optUrl,
  github_url: optUrl,
  equity_pct_band: z.enum(equityBands).optional(),
  display_order: z.number().int().min(0).default(0),
});
export type StartupTeamMemberInput = z.infer<typeof startupTeamMemberSchema>;

export const investorTeamMemberSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(120, "Name too long."),
  role: z
    .string()
    .trim()
    .min(2, "Role is required.")
    .max(80, "Role too long."),
  is_decision_maker: z.boolean().default(false),
  bio: optText(600),
  linkedin_url: optUrl,
  display_order: z.number().int().min(0).default(0),
});
export type InvestorTeamMemberInput = z.infer<typeof investorTeamMemberSchema>;

// ──────────────────────────────────────────────────────────────────────────
//  0013 — Round details, cap table, use of funds
// ──────────────────────────────────────────────────────────────────────────

const roundInstruments = [
  "safe_post_money",
  "safe_pre_money",
  "priced_round",
  "convertible_note",
] as const;

const roundLeadStatuses = [
  "open",
  "soliciting_lead",
  "lead_committed",
  "oversubscribed",
] as const;

const valuationBands = [
  "under_3m",
  "3_5m",
  "5_10m",
  "10_20m",
  "20_50m",
  "50_100m",
  "over_100m",
] as const;

const useOfFundsCategories = [
  "engineering",
  "sales_and_marketing",
  "operations",
  "runway_extension",
  "hiring",
  "infrastructure",
  "research_and_dev",
  "other",
] as const;

const nonnegBigInt = z
  .number({ message: "Enter a whole number." })
  .int("Enter a whole number.")
  .min(0, "Cannot be negative.");

export const startupRoundDetailsSchema = z.object({
  instrument: z.enum(roundInstruments).optional(),
  valuation_band: z.enum(valuationBands).optional(),
  target_raise_usd: nonnegBigInt.optional(),
  min_check_usd: nonnegBigInt.optional(),
  lead_status: z.enum(roundLeadStatuses).default("open"),
  close_by_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  committed_amount_usd: nonnegBigInt.default(0),
  use_of_funds_summary: optText(500),
  instrument_terms_summary: optText(500),
});
export type StartupRoundDetailsInput = z.infer<typeof startupRoundDetailsSchema>;

const foundersPctBands = [
  "under_50",
  "50_70",
  "70_85",
  "85_95",
  "over_95",
] as const;

const employeePoolPctBands = [
  "none",
  "under_10",
  "10_15",
  "15_20",
  "over_20",
] as const;

const outsideInvestorsPctBands = [
  "none_yet",
  "under_15",
  "15_25",
  "25_35",
  "over_35",
] as const;

const lastRoundAmountBands = [
  "under_500k",
  "500k_1m",
  "1m_3m",
  "3m_10m",
  "10m_25m",
  "over_25m",
] as const;

export const startupCapTableSummarySchema = z.object({
  founders_pct_band: z.enum(foundersPctBands).optional(),
  employee_pool_pct_band: z.enum(employeePoolPctBands).optional(),
  outside_investors_pct_band: z.enum(outsideInvestorsPctBands).optional(),
  prior_raises_count: z
    .number()
    .int()
    .min(0)
    .max(20, "Maximum 20 prior raises.")
    .default(0),
  last_round_amount_band: z.enum(lastRoundAmountBands).optional(),
  last_round_year: z
    .number()
    .int()
    .min(2000)
    .max(2100)
    .optional(),
});
export type StartupCapTableSummaryInput = z.infer<
  typeof startupCapTableSummarySchema
>;

export const startupUseOfFundsLineSchema = z.object({
  id: z.string().uuid().optional(),
  category: z.enum(useOfFundsCategories),
  pct_of_raise: z
    .number()
    .int()
    .min(0, "Cannot be negative.")
    .max(100, "Cannot exceed 100%."),
  narrative: optText(500),
  display_order: z.number().int().min(0).default(0),
});
export type StartupUseOfFundsLineInput = z.infer<
  typeof startupUseOfFundsLineSchema
>;

export const startupUseOfFundsSchema = z.object({
  lines: z.array(startupUseOfFundsLineSchema).max(8, "Maximum 8 categories."),
});
export type StartupUseOfFundsInput = z.infer<typeof startupUseOfFundsSchema>;

// ──────────────────────────────────────────────────────────────────────────
//  0014 — Traction signals, market analysis, competitive landscape
// ──────────────────────────────────────────────────────────────────────────

const tractionKinds = [
  "mrr",
  "arr",
  "gross_revenue",
  "paying_customers",
  "design_partners",
  "signed_lois",
  "waitlist_size",
  "dau",
  "mau",
  "retention_day_30",
  "retention_day_90",
  "nps",
  "gross_margin_pct",
  "cac_usd",
  "ltv_usd",
  "contracted_revenue",
  "gmv",
] as const;

const tractionSourceKinds = [
  "stripe_dashboard",
  "bank_statement",
  "crm_export",
  "csv_upload",
  "self_attested",
  "other",
] as const;

const marketSizeBands = [
  "under_100m",
  "100m_500m",
  "500m_1b",
  "1b_10b",
  "10b_100b",
  "over_100b",
] as const;

export const startupTractionSignalSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(tractionKinds),
  value_numeric: z
    .number({ message: "Enter a number." })
    .finite("Enter a finite number."),
  period_start: z
    .string()
    .datetime({ message: "Use ISO datetime format." })
    .optional()
    .or(z.literal("").transform(() => undefined)),
  period_end: z
    .string()
    .datetime({ message: "Use ISO datetime format." })
    .optional()
    .or(z.literal("").transform(() => undefined)),
  evidence_url: optUrl,
  source_kind: z.enum(tractionSourceKinds).default("self_attested"),
  self_reported: z.boolean().default(true),
  notes: optText(300),
  display_order: z.number().int().min(0).default(0),
});
export type StartupTractionSignalInput = z.infer<
  typeof startupTractionSignalSchema
>;

export const startupMarketAnalysisSchema = z.object({
  tam_band: z.enum(marketSizeBands).optional(),
  sam_band: z.enum(marketSizeBands).optional(),
  som_band: z.enum(marketSizeBands).optional(),
  methodology_summary: optText(1000),
  source_links: z
    .array(
      z
        .string()
        .trim()
        .url("Use a full URL.")
        .max(500, "URL too long."),
    )
    .max(10, "Maximum 10 sources.")
    .default([]),
});
export type StartupMarketAnalysisInput = z.infer<
  typeof startupMarketAnalysisSchema
>;

export const startupCompetitorSchema = z.object({
  id: z.string().uuid().optional(),
  competitor_name: z
    .string()
    .trim()
    .min(1, "Name required.")
    .max(120, "Name too long."),
  differentiation: optText(500),
  link_url: optUrl,
  display_order: z.number().int().min(0).default(0),
});
export type StartupCompetitorInput = z.infer<typeof startupCompetitorSchema>;

// ──────────────────────────────────────────────────────────────────────────
//  0015 — Investor depth
// ──────────────────────────────────────────────────────────────────────────

const investorCheckRoles = ["lead", "follow"] as const;

const ownershipBands = [
  "under_5pct",
  "5_10",
  "10_20",
  "over_20",
] as const;

export const investorCheckBandSchema = z.object({
  id: z.string().uuid().optional(),
  stage: stageEnum,
  role: z.enum(investorCheckRoles),
  check_min_usd: nonnegBigInt,
  check_max_usd: nonnegBigInt,
  ownership_target_band: z.enum(ownershipBands).optional(),
});
export type InvestorCheckBandInput = z.infer<typeof investorCheckBandSchema>;

const investorRoles = ["lead", "co_lead", "follow", "participant"] as const;
const investorExitKinds = ["acquired", "ipo", "shutdown", "n_a"] as const;

export const investorPortfolioEntrySchema = z.object({
  id: z.string().uuid().optional(),
  company_name: z
    .string()
    .trim()
    .min(1, "Company name required.")
    .max(120, "Too long."),
  year: z
    .number()
    .int()
    .min(2000)
    .max(2100)
    .optional(),
  role: z.enum(investorRoles),
  is_public_listing: z.boolean().default(true),
  sector: z.string().trim().max(80, "Too long.").optional()
    .or(z.literal("").transform(() => undefined)),
  is_exited: z.boolean().default(false),
  exit_kind: z.enum(investorExitKinds).optional(),
  notes: optText(200),
  display_order: z.number().int().min(0).default(0),
});
export type InvestorPortfolioEntryInput = z.infer<
  typeof investorPortfolioEntrySchema
>;

const dealCountBands = [
  "under_10",
  "10_25",
  "25_50",
  "50_100",
  "over_100",
] as const;

const followOnRateBands = [
  "under_25",
  "25_50",
  "50_75",
  "over_75",
] as const;

const fundSizeBands = [
  "under_25m",
  "25_100m",
  "100_500m",
  "500m_1b",
  "over_1b",
] as const;

const dryPowderBands = [
  "depleted",
  "under_25m",
  "25_100m",
  "100_500m",
  "over_500m",
] as const;

export const investorTrackRecordSchema = z.object({
  total_deals_band: z.enum(dealCountBands).optional(),
  first_money_in_count_band: z.enum(dealCountBands).optional(),
  follow_on_rate_band: z.enum(followOnRateBands).optional(),
  avg_ownership_band: z.enum(ownershipBands).optional(),
  fund_size_band: z.enum(fundSizeBands).optional(),
  fund_vintage_year: z
    .number()
    .int()
    .min(1990)
    .max(2100)
    .optional(),
  dry_powder_band: z.enum(dryPowderBands).optional(),
});
export type InvestorTrackRecordInput = z.infer<typeof investorTrackRecordSchema>;

const timeToTermSheetBands = [
  "one_week",
  "two_weeks",
  "one_month",
  "two_months",
  "quarter_plus",
] as const;

export const investorDecisionProcessSchema = z.object({
  time_to_term_sheet_band: z.enum(timeToTermSheetBands).optional(),
  ic_required: z.boolean().default(true),
  references_required: z.boolean().default(false),
  data_room_required: z.boolean().default(false),
  partner_meeting_required: z.boolean().default(true),
  process_narrative: optText(400),
});
export type InvestorDecisionProcessInput = z.infer<
  typeof investorDecisionProcessSchema
>;

const valueAddKinds = [
  "recruiting",
  "gtm_intros",
  "sales_intros",
  "customer_intros",
  "board_governance",
  "regulatory",
  "technical_dd",
  "fundraising_strategy",
  "international_expansion",
] as const;

export const investorValueAddEntrySchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(valueAddKinds),
  narrative: optText(300),
  display_order: z.number().int().min(0).default(0),
});
export type InvestorValueAddEntryInput = z.infer<
  typeof investorValueAddEntrySchema
>;

const antiPatternKinds = [
  "sector",
  "stage",
  "geography",
  "founder_profile",
  "check_size",
  "other",
] as const;

export const investorAntiPatternEntrySchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(antiPatternKinds),
  narrative: z
    .string()
    .trim()
    .min(5, "Narrative required (min 5 characters).")
    .max(300, "Keep it under 300 characters."),
  display_order: z.number().int().min(0).default(0),
});
export type InvestorAntiPatternEntryInput = z.infer<
  typeof investorAntiPatternEntrySchema
>;

// ──────────────────────────────────────────────────────────────────────────
//  0016 — Verifications + references
// ──────────────────────────────────────────────────────────────────────────

const verificationKinds = [
  "linkedin_employment",
  "github_account",
  "domain_ownership",
  "sec_form_d",
  "crunchbase_listing",
  "self_attestation",
] as const;

export const submitVerificationSchema = z.object({
  kind: z.enum(verificationKinds),
  evidence_url: optUrl,
  claim_summary: optText(200),
});
export type SubmitVerificationInput = z.infer<typeof submitVerificationSchema>;

export const requestReferenceSchema = z.object({
  referee_email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .min(5)
    .max(254, "Email too long."),
  referee_name: z
    .string()
    .trim()
    .min(2, "Name required.")
    .max(120, "Name too long."),
  relationship: z
    .string()
    .trim()
    .min(2, "Describe the relationship.")
    .max(120, "Keep it under 120 characters."),
});
export type RequestReferenceInput = z.infer<typeof requestReferenceSchema>;
