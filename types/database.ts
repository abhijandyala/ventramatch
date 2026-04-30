// Hand-maintained to mirror `db/migrations/0001_initial_schema.sql` (Postgres on Railway, etc.).
// Regenerate or extend when the schema changes.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = "founder" | "investor";
export type StartupStage = "idea" | "pre_seed" | "seed" | "series_a" | "series_b_plus";
export type InteractionAction = "like" | "pass" | "save";
export type LeadFollowPreference = "lead" | "follow" | "either";

export type ApplicationStatus =
  | "unverified"
  | "draft"
  | "submitted"
  | "under_review"
  | "needs_changes"
  | "accepted"
  | "rejected"
  | "banned";

export type AccountLabel =
  | "unverified"
  | "in_review"
  | "verified"
  | "rejected"
  | "banned";

export type ReviewerKind = "rules" | "llm" | "human";

export type ReviewVerdict =
  | "accept"
  | "needs_changes"
  | "decline"
  | "flag"
  | "ban";

export type EmailTemplate =
  | "review.accepted"
  | "review.rejected"
  | "review.needs_changes"
  | "review.appeal_received"
  | "reminder.complete_profile"
  | "match.created"
  | "intro.requested"
  | "intro.accepted"
  | "intro.declined"
  | "intro.withdrawn"
  | "intro.expired"
  | "reference.requested";

export type IntroRequestStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "withdrawn"
  | "expired";

/**
 * Per-user opt in/out for transactional email families. Stored as JSONB on
 * users.notification_prefs. The DB function should_send_email() reads this.
 */
export type NotificationPrefs = {
  matches: boolean;
  intros: boolean;
  reviewUpdates: boolean;
  weeklyDigest: boolean;
  productUpdates: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  matches: true,
  intros: true,
  reviewUpdates: true,
  weeklyDigest: false,
  productUpdates: false,
};

export type ReportReason =
  | "spam"
  | "harassment"
  | "misrepresentation"
  | "fraud_or_scam"
  | "inappropriate_content"
  | "impersonation"
  | "other";

export type ReportStatus = "open" | "reviewing" | "actioned" | "dismissed";

/**
 * Equity ownership band for a startup team member. Bands rather than exact
 * percent: avoids stale numbers and aligns with the legal posture in
 * docs/legal.md (no investment advice, no exact-figure financial claims that
 * could be relied on). Schema-level CHECK in 0012_profile_depth_team.sql.
 */
export type EquityPctBand = "under_5" | "5_15" | "15_30" | "30_50" | "over_50";

export const EQUITY_PCT_BAND_LABELS: Record<EquityPctBand, string> = {
  under_5: "Under 5%",
  "5_15": "5–15%",
  "15_30": "15–30%",
  "30_50": "30–50%",
  over_50: "50% or more",
};

// ──────────────────────────────────────────────────────────────────────────
//  Round details (0013_profile_depth_round.sql)
// ──────────────────────────────────────────────────────────────────────────

export type RoundInstrument =
  | "safe_post_money"
  | "safe_pre_money"
  | "priced_round"
  | "convertible_note";

export type RoundLeadStatus =
  | "open"
  | "soliciting_lead"
  | "lead_committed"
  | "oversubscribed";

export type UseOfFundsCategory =
  | "engineering"
  | "sales_and_marketing"
  | "operations"
  | "runway_extension"
  | "hiring"
  | "infrastructure"
  | "research_and_dev"
  | "other";

/**
 * Valuation buckets are deliberately finer below $20M (where pre-seed and
 * seed live). Stored as text + CHECK; revising buckets is a follow-up
 * migration, not a forced enum-add.
 */
export type ValuationBand =
  | "under_3m"
  | "3_5m"
  | "5_10m"
  | "10_20m"
  | "20_50m"
  | "50_100m"
  | "over_100m";

export const VALUATION_BAND_LABELS: Record<ValuationBand, string> = {
  under_3m: "Under $3M",
  "3_5m": "$3–5M",
  "5_10m": "$5–10M",
  "10_20m": "$10–20M",
  "20_50m": "$20–50M",
  "50_100m": "$50–100M",
  over_100m: "Over $100M",
};

export type FoundersPctBand =
  | "under_50"
  | "50_70"
  | "70_85"
  | "85_95"
  | "over_95";

export type EmployeePoolPctBand =
  | "none"
  | "under_10"
  | "10_15"
  | "15_20"
  | "over_20";

export type OutsideInvestorsPctBand =
  | "none_yet"
  | "under_15"
  | "15_25"
  | "25_35"
  | "over_35";

export type LastRoundAmountBand =
  | "under_500k"
  | "500k_1m"
  | "1m_3m"
  | "3m_10m"
  | "10m_25m"
  | "over_25m";

// ──────────────────────────────────────────────────────────────────────────
//  Traction (0014_profile_depth_traction.sql)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Structured traction signal kinds. The kind enum implies the unit of
 * value_numeric (e.g., 'mrr' is USD, 'retention_day_30' is percent 0-100,
 * 'nps' is -100 to 100). Zod schemas in lib/validation enforce per-kind
 * unit semantics at submit time.
 */
export type TractionKind =
  | "mrr"
  | "arr"
  | "gross_revenue"
  | "paying_customers"
  | "design_partners"
  | "signed_lois"
  | "waitlist_size"
  | "dau"
  | "mau"
  | "retention_day_30"
  | "retention_day_90"
  | "nps"
  | "gross_margin_pct"
  | "cac_usd"
  | "ltv_usd"
  | "contracted_revenue"
  | "gmv";

export type TractionSourceKind =
  | "stripe_dashboard"
  | "bank_statement"
  | "crm_export"
  | "csv_upload"
  | "self_attested"
  | "other";

export type MarketSizeBand =
  | "under_100m"
  | "100m_500m"
  | "500m_1b"
  | "1b_10b"
  | "10b_100b"
  | "over_100b";

export const MARKET_SIZE_BAND_LABELS: Record<MarketSizeBand, string> = {
  under_100m: "Under $100M",
  "100m_500m": "$100M–$500M",
  "500m_1b": "$500M–$1B",
  "1b_10b": "$1B–$10B",
  "10b_100b": "$10B–$100B",
  over_100b: "Over $100B",
};

// ──────────────────────────────────────────────────────────────────────────
//  Investor depth (0015_profile_depth_investor.sql)
// ──────────────────────────────────────────────────────────────────────────

export type InvestorRoleEnum = "lead" | "co_lead" | "follow" | "participant";
export type InvestorCheckRole = "lead" | "follow";
export type InvestorExitKind = "acquired" | "ipo" | "shutdown" | "n_a";

export type InvestorValueAddKind =
  | "recruiting"
  | "gtm_intros"
  | "sales_intros"
  | "customer_intros"
  | "board_governance"
  | "regulatory"
  | "technical_dd"
  | "fundraising_strategy"
  | "international_expansion";

export type InvestorAntiPatternKind =
  | "sector"
  | "stage"
  | "geography"
  | "founder_profile"
  | "check_size"
  | "other";

export type OwnershipBand = "under_5pct" | "5_10" | "10_20" | "over_20";

export type DealCountBand =
  | "under_10"
  | "10_25"
  | "25_50"
  | "50_100"
  | "over_100";

export type FollowOnRateBand = "under_25" | "25_50" | "50_75" | "over_75";

export type FundSizeBand =
  | "under_25m"
  | "25_100m"
  | "100_500m"
  | "500m_1b"
  | "over_1b";

export type DryPowderBand =
  | "depleted"
  | "under_25m"
  | "25_100m"
  | "100_500m"
  | "over_500m";

export type TimeToTermSheetBand =
  | "one_week"
  | "two_weeks"
  | "one_month"
  | "two_months"
  | "quarter_plus";

// ──────────────────────────────────────────────────────────────────────────
//  Verifications + references (0016_verifications.sql)
// ──────────────────────────────────────────────────────────────────────────

export type VerificationKind =
  | "linkedin_employment"
  | "github_account"
  | "domain_ownership"
  | "sec_form_d"
  | "crunchbase_listing"
  | "self_attestation";

export type VerificationStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "expired";

/**
 * How a verification was confirmed. `human_review` is reserved for a
 * future paid-tier migration (ALTER TYPE ... ADD VALUE) and is not in
 * the v0 enum — we don't ship verification claims we can't back without
 * paid infra.
 */
export type VerificationVerifiedBy =
  | "self"
  | "linkedin_oauth"
  | "email_token"
  | "sec_public";

export type ReferenceStatus = "sent" | "confirmed" | "declined" | "expired";

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam or unsolicited promotion",
  harassment: "Harassment or abusive behavior",
  misrepresentation: "Misrepresentation or false claims",
  fraud_or_scam: "Fraud or scam attempt",
  inappropriate_content: "Inappropriate content",
  impersonation: "Impersonation of someone else",
  other: "Other (please describe)",
};

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          role: UserRole;
          email_verified: boolean;
          account_label: AccountLabel;
          /** Display name. Set during sign-up or pulled from OAuth. */
          name: string | null;
          /** OAuth provider profile picture URL (Google/LinkedIn/GitHub). */
          image: string | null;
          // Sprint 9.5.C — user-uploaded avatar via /api/avatar/upload.
          // The read path prefers avatar_storage_key (presigned) over image.
          avatar_storage_key: string | null;
          avatar_url: string | null;
          avatar_updated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role: UserRole;
          email_verified?: boolean;
          account_label?: AccountLabel;
          name?: string | null;
          image?: string | null;
          avatar_storage_key?: string | null;
          avatar_url?: string | null;
          avatar_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      startups: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          one_liner: string;
          industry: string;
          stage: StartupStage;
          raise_amount: number | null;
          traction: string | null;
          location: string | null;
          deck_url: string | null;
          // Sprint 9.5.B — direct deck upload via /api/deck/upload.
          // The download path /api/deck/[startupId] prefers
          // deck_storage_key when present, falls back to deck_url.
          deck_storage_key: string | null;
          deck_filename: string | null;
          deck_uploaded_at: string | null;
          website: string | null;
          /** Sprint 9.5.D: all sectors the founder selected (up to 3). */
          startup_sectors: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["startups"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["startups"]["Insert"]>;
      };
      investors: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          firm: string | null;
          check_min: number;
          check_max: number;
          stages: StartupStage[];
          sectors: string[];
          geographies: string[];
          is_active: boolean;
          thesis: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["investors"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["investors"]["Insert"]>;
      };
      interactions: {
        Row: {
          id: string;
          actor_user_id: string;
          target_user_id: string;
          action: InteractionAction;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["interactions"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["interactions"]["Insert"]>;
      };
      matches: {
        Row: {
          id: string;
          founder_user_id: string;
          investor_user_id: string;
          matched_at: string;
          contact_unlocked: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["matches"]["Row"], "id" | "matched_at"> & {
          id?: string;
          matched_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["matches"]["Insert"]>;
      };
      saved_searches: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          /** Filter snapshot, see lib/feed/filters.ts. */
          filters: Json;
          notify_email: boolean;
          last_notified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["saved_searches"]["Row"],
          "id" | "created_at" | "updated_at" | "last_notified_at" | "notify_email"
        > & {
          id?: string;
          notify_email?: boolean;
          last_notified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["saved_searches"]["Insert"]>;
      };
      profile_views: {
        Row: {
          id: string;
          viewer_user_id: string;
          target_user_id: string;
          viewed_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profile_views"]["Row"], "id" | "viewed_at"> & {
          id?: string;
          viewed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profile_views"]["Insert"]>;
      };
      blocks: {
        Row: {
          id: string;
          blocker_user_id: string;
          blocked_user_id: string;
          reason: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["blocks"]["Row"], "id" | "created_at" | "reason"> & {
          id?: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["blocks"]["Insert"]>;
      };
      reports: {
        Row: {
          id: string;
          reporter_user_id: string;
          reported_user_id: string;
          reason: ReportReason;
          details: string;
          status: ReportStatus;
          resolved_by: string | null;
          resolved_at: string | null;
          resolution_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["reports"]["Row"],
          "id" | "created_at" | "updated_at" | "status" | "resolved_by" | "resolved_at" | "resolution_notes"
        > & {
          id?: string;
          status?: ReportStatus;
          resolved_by?: string | null;
          resolved_at?: string | null;
          resolution_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
      };
      email_change_requests: {
        Row: {
          id: string;
          user_id: string;
          new_email: string;
          token_hash: string;
          expires_at: string;
          consumed_at: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["email_change_requests"]["Row"],
          "id" | "created_at" | "consumed_at"
        > & {
          id?: string;
          consumed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_change_requests"]["Insert"]>;
      };
      intro_requests: {
        Row: {
          id: string;
          match_id: string;
          sender_user_id: string;
          recipient_user_id: string;
          status: IntroRequestStatus;
          message: string;
          /** ISO 8601 strings, UTC. */
          proposed_times: string[];
          link_url: string | null;
          accepted_time: string | null;
          response_message: string | null;
          responded_at: string | null;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["intro_requests"]["Row"],
          "id" | "created_at" | "updated_at" | "responded_at" | "accepted_time" | "response_message" | "status" | "expires_at"
        > & {
          id?: string;
          status?: IntroRequestStatus;
          accepted_time?: string | null;
          response_message?: string | null;
          responded_at?: string | null;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["intro_requests"]["Insert"]>;
      };
      founder_matching_preferences: {
        Row: {
          id: string;
          user_id: string;
          industry: string;
          stage: StartupStage;
          amount_raising: string;
          location: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["founder_matching_preferences"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["founder_matching_preferences"]["Insert"]>;
      };
      investor_matching_preferences: {
        Row: {
          id: string;
          user_id: string;
          check_size: string;
          preferred_stage: StartupStage;
          sectors: string[];
          geography: string;
          lead_follow_preference: LeadFollowPreference;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["investor_matching_preferences"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["investor_matching_preferences"]["Insert"]>;
      };
      applications: {
        Row: {
          id: string;
          user_id: string;
          status: ApplicationStatus;
          bot_recommendation: ReviewVerdict | null;
          bot_confidence: number | null;
          bot_recommended_at: string | null;
          decided_by: string | null;
          decided_at: string | null;
          decision_reason_codes: string[];
          decision_summary: string | null;
          submitted_at: string | null;
          resubmit_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["applications"]["Row"],
          "id" | "created_at" | "updated_at" | "decision_reason_codes" | "resubmit_count"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          decision_reason_codes?: string[];
          resubmit_count?: number;
        };
        Update: Partial<Database["public"]["Tables"]["applications"]["Insert"]>;
      };
      application_reviews: {
        Row: {
          id: string;
          application_id: string;
          user_id: string;
          pass_no: number;
          reviewer_kind: ReviewerKind;
          reviewer_id: string | null;
          verdict: ReviewVerdict;
          confidence: number | null;
          rule_results: Json | null;
          llm_raw: Json | null;
          flags: string[];
          notes: string | null;
          cost_usd: number;
          duration_ms: number | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["application_reviews"]["Row"],
          "id" | "created_at" | "flags" | "cost_usd"
        > & {
          id?: string;
          created_at?: string;
          flags?: string[];
          cost_usd?: number;
        };
        Update: Partial<Database["public"]["Tables"]["application_reviews"]["Insert"]>;
      };
      email_outbox: {
        Row: {
          id: string;
          user_id: string;
          template: EmailTemplate;
          payload: Json;
          send_after: string;
          cancelled_at: string | null;
          sent_at: string | null;
          resend_id: string | null;
          attempts: number;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["email_outbox"]["Row"],
          "id" | "created_at" | "updated_at" | "attempts" | "payload" | "send_after"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          attempts?: number;
          payload?: Json;
          send_after?: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_outbox"]["Insert"]>;
      };
      startup_team_members: {
        Row: {
          id: string;
          startup_id: string;
          name: string;
          role: string;
          is_founder: boolean;
          is_full_time: boolean;
          bio: string | null;
          prior_company: string | null;
          prior_role: string | null;
          linkedin_url: string | null;
          github_url: string | null;
          equity_pct_band: EquityPctBand | null;
          linked_user_id: string | null;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["startup_team_members"]["Row"],
          | "id"
          | "created_at"
          | "updated_at"
          | "is_founder"
          | "is_full_time"
          | "display_order"
        > & {
          id?: string;
          is_founder?: boolean;
          is_full_time?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["startup_team_members"]["Insert"]>;
      };
      investor_team_members: {
        Row: {
          id: string;
          investor_id: string;
          name: string;
          role: string;
          is_decision_maker: boolean;
          bio: string | null;
          linkedin_url: string | null;
          linked_user_id: string | null;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["investor_team_members"]["Row"],
          "id" | "created_at" | "updated_at" | "is_decision_maker" | "display_order"
        > & {
          id?: string;
          is_decision_maker?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["investor_team_members"]["Insert"]>;
      };
      startup_round_details: {
        Row: {
          id: string;
          startup_id: string;
          instrument: RoundInstrument | null;
          valuation_band: ValuationBand | null;
          target_raise_usd: number | null;
          min_check_usd: number | null;
          lead_status: RoundLeadStatus;
          close_by_date: string | null;
          committed_amount_usd: number;
          use_of_funds_summary: string | null;
          instrument_terms_summary: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["startup_round_details"]["Row"],
          "id" | "created_at" | "updated_at" | "lead_status" | "committed_amount_usd"
        > & {
          id?: string;
          lead_status?: RoundLeadStatus;
          committed_amount_usd?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["startup_round_details"]["Insert"]>;
      };
      startup_cap_table_summary: {
        Row: {
          id: string;
          startup_id: string;
          founders_pct_band: FoundersPctBand | null;
          employee_pool_pct_band: EmployeePoolPctBand | null;
          outside_investors_pct_band: OutsideInvestorsPctBand | null;
          prior_raises_count: number;
          last_round_amount_band: LastRoundAmountBand | null;
          last_round_year: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["startup_cap_table_summary"]["Row"],
          "id" | "created_at" | "updated_at" | "prior_raises_count"
        > & {
          id?: string;
          prior_raises_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["startup_cap_table_summary"]["Insert"]>;
      };
      startup_use_of_funds_lines: {
        Row: {
          id: string;
          startup_id: string;
          category: UseOfFundsCategory;
          pct_of_raise: number;
          narrative: string | null;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["startup_use_of_funds_lines"]["Row"],
          "id" | "created_at" | "updated_at" | "display_order"
        > & {
          id?: string;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["startup_use_of_funds_lines"]["Insert"]>;
      };
      startup_traction_signals: {
        Row: {
          id: string;
          startup_id: string;
          kind: TractionKind;
          value_numeric: number;
          period_start: string | null;
          period_end: string | null;
          evidence_url: string | null;
          source_kind: TractionSourceKind;
          self_reported: boolean;
          notes: string | null;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["startup_traction_signals"]["Row"],
          | "id"
          | "created_at"
          | "updated_at"
          | "source_kind"
          | "self_reported"
          | "display_order"
        > & {
          id?: string;
          source_kind?: TractionSourceKind;
          self_reported?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["startup_traction_signals"]["Insert"]>;
      };
      startup_market_analysis: {
        Row: {
          id: string;
          startup_id: string;
          tam_band: MarketSizeBand | null;
          sam_band: MarketSizeBand | null;
          som_band: MarketSizeBand | null;
          methodology_summary: string | null;
          source_links: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["startup_market_analysis"]["Row"],
          "id" | "created_at" | "updated_at" | "source_links"
        > & {
          id?: string;
          source_links?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["startup_market_analysis"]["Insert"]>;
      };
      startup_competitive_landscape: {
        Row: {
          id: string;
          startup_id: string;
          competitor_name: string;
          differentiation: string | null;
          link_url: string | null;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["startup_competitive_landscape"]["Row"],
          "id" | "created_at" | "updated_at" | "display_order"
        > & {
          id?: string;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["startup_competitive_landscape"]["Insert"]>;
      };
      investor_check_bands: {
        Row: {
          id: string;
          investor_id: string;
          stage: StartupStage;
          role: InvestorCheckRole;
          check_min_usd: number;
          check_max_usd: number;
          ownership_target_band: OwnershipBand | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["investor_check_bands"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["investor_check_bands"]["Insert"]>;
      };
      investor_portfolio: {
        Row: {
          id: string;
          investor_id: string;
          company_name: string;
          year: number | null;
          role: InvestorRoleEnum;
          is_public_listing: boolean;
          sector: string | null;
          is_exited: boolean;
          exit_kind: InvestorExitKind | null;
          notes: string | null;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["investor_portfolio"]["Row"],
          | "id"
          | "created_at"
          | "updated_at"
          | "is_public_listing"
          | "is_exited"
          | "display_order"
        > & {
          id?: string;
          is_public_listing?: boolean;
          is_exited?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["investor_portfolio"]["Insert"]>;
      };
      investor_track_record: {
        Row: {
          id: string;
          investor_id: string;
          total_deals_band: DealCountBand | null;
          first_money_in_count_band: DealCountBand | null;
          follow_on_rate_band: FollowOnRateBand | null;
          avg_ownership_band: OwnershipBand | null;
          fund_size_band: FundSizeBand | null;
          fund_vintage_year: number | null;
          dry_powder_band: DryPowderBand | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["investor_track_record"]["Row"],
          "id" | "created_at" | "updated_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["investor_track_record"]["Insert"]>;
      };
      investor_decision_process: {
        Row: {
          id: string;
          investor_id: string;
          time_to_term_sheet_band: TimeToTermSheetBand | null;
          ic_required: boolean;
          references_required: boolean;
          data_room_required: boolean;
          partner_meeting_required: boolean;
          process_narrative: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["investor_decision_process"]["Row"],
          | "id"
          | "created_at"
          | "updated_at"
          | "ic_required"
          | "references_required"
          | "data_room_required"
          | "partner_meeting_required"
        > & {
          id?: string;
          ic_required?: boolean;
          references_required?: boolean;
          data_room_required?: boolean;
          partner_meeting_required?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["investor_decision_process"]["Insert"]>;
      };
      investor_value_add: {
        Row: {
          id: string;
          investor_id: string;
          kind: InvestorValueAddKind;
          narrative: string | null;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["investor_value_add"]["Row"],
          "id" | "created_at" | "updated_at" | "display_order"
        > & {
          id?: string;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["investor_value_add"]["Insert"]>;
      };
      investor_anti_patterns: {
        Row: {
          id: string;
          investor_id: string;
          kind: InvestorAntiPatternKind;
          narrative: string;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["investor_anti_patterns"]["Row"],
          "id" | "created_at" | "updated_at" | "display_order"
        > & {
          id?: string;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["investor_anti_patterns"]["Insert"]>;
      };
      verifications: {
        Row: {
          id: string;
          user_id: string;
          kind: VerificationKind;
          evidence_url: string | null;
          evidence_hash: string | null;
          claim_summary: string | null;
          status: VerificationStatus;
          verified_by: VerificationVerifiedBy;
          verified_at: string | null;
          expires_at: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["verifications"]["Row"],
          "id" | "created_at" | "updated_at" | "status" | "verified_by"
        > & {
          id?: string;
          status?: VerificationStatus;
          verified_by?: VerificationVerifiedBy;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["verifications"]["Insert"]>;
      };
      references_received: {
        Row: {
          id: string;
          user_id: string;
          referee_email: string;
          referee_name: string;
          relationship: string;
          status: ReferenceStatus;
          token_hash: string;
          expires_at: string;
          confirmed_at: string | null;
          declined_at: string | null;
          endorsement: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["references_received"]["Row"],
          "id" | "created_at" | "updated_at" | "status" | "expires_at"
        > & {
          id?: string;
          status?: ReferenceStatus;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["references_received"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      startup_stage: StartupStage;
      interaction_action: InteractionAction;
      lead_follow_preference: LeadFollowPreference;
      application_status: ApplicationStatus;
      account_label: AccountLabel;
      reviewer_kind: ReviewerKind;
      review_verdict: ReviewVerdict;
    };
  };
}
