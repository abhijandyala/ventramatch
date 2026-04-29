// Hand-maintained to mirror `db/migrations/0001_initial_schema.sql` (Postgres on Railway, etc.).
// Regenerate or extend when the schema changes.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = "founder" | "investor";
export type StartupStage = "idea" | "pre_seed" | "seed" | "series_a" | "series_b_plus";
export type InteractionAction = "like" | "pass" | "save";
export type LeadFollowPreference = "lead" | "follow" | "either";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          role: UserRole;
          email_verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role: UserRole;
          email_verified?: boolean;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      startup_stage: StartupStage;
      interaction_action: InteractionAction;
      lead_follow_preference: LeadFollowPreference;
    };
  };
}
