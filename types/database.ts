// Schema types — kept in sync by hand with db/migrations/0001_initial_schema.sql
// until the ORM lands and starts generating these. See AGENTS.md "Workflow for
// new dependencies" before swapping in a generator.

export type UserRole = "founder" | "investor";
export type StartupStage = "idea" | "pre_seed" | "seed" | "series_a" | "series_b_plus";
export type InteractionAction = "like" | "pass" | "save";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Startup {
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
}

export interface Investor {
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
}

export interface Interaction {
  id: string;
  actor_user_id: string;
  target_user_id: string;
  action: InteractionAction;
  created_at: string;
}

export interface Match {
  id: string;
  founder_user_id: string;
  investor_user_id: string;
  matched_at: string;
  contact_unlocked: boolean;
}
