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
  | "intro.expired";

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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role: UserRole;
          email_verified?: boolean;
          account_label?: AccountLabel;
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
          website: string | null;
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
