/**
 * Type definitions for the temporary recommendation layer.
 *
 * This layer powers the "You might be interested in" preview shown during
 * onboarding step 3. It is intentionally decoupled from the production
 * matching code (`lib/matching/score.ts`, `lib/feed/query.ts`) so that
 * future ML/LLM swaps can replace the implementation without touching the
 * UI components.
 *
 * The types here are deliberately narrow — they do NOT extend the database
 * Row types from `types/database.ts`. That keeps the recommendation layer
 * self-contained and replaceable.
 */

import type { CustomerType, StartupStage } from "@/types/database";

export type RecommendationKind = "startup" | "investor";

/**
 * Snapshot of the current user's preferences and basic profile data, used
 * to rank candidates. Today this comes from the onboarding wizard's local
 * draft; later it can come from the DB once a user is past onboarding.
 */
export type CurrentUserSnapshot = {
  role: "founder" | "investor";
  /**
   * The optional "what are you looking for?" text from onboarding step 2.
   * If non-empty this is the PRIMARY ranking signal (Tier 1).
   */
  lookingFor?: string;
  /**
   * Step 2's required short description. SECONDARY signal (Tier 2) when
   * lookingFor is blank — bio keywords match candidate fields.
   */
  bio?: string;
  /**
   * Optional list of sectors the user has already chosen (e.g. from a
   * startup builder draft). When present, used as a tag-overlap signal
   * even if lookingFor is blank.
   */
  sectors?: string[];
  /**
   * For investors only — declared check size range, when known.
   * Strings like "$250K-$750K". Used to soft-prioritise startups whose
   * funding ask falls in range.
   */
  checkRange?: string;
};

/**
 * Discriminated union of profiles the recommendation grid can show.
 * Founders see InvestorRecommendation[]; investors see StartupRecommendation[].
 */
export type RecommendationProfile =
  | StartupRecommendation
  | InvestorRecommendation;

export type StartupRecommendation = {
  kind: "startup";
  /** Stable id used as React key and for the future event log. */
  id: string;
  name: string;
  /** One-sentence hook shown on the card hover and modal header. */
  tagline: string;
  /** Longer paragraph describing the company. */
  description: string;
  sector: string;
  stage: StartupStage;
  location: string;
  foundingYear: number;
  /** Who built it — short founder summary. */
  founderSummary: string;
  /** What they shipped or are shipping. */
  product: string;
  /** Traction story (revenue, users, partnerships, etc.). */
  traction: string;
  /** Human-readable funding ask, e.g. "$1.5M seed". */
  fundingAsk: string;
  /** What the round will pay for. */
  useOfFunds: string;
  /** Description of the kind of investor they want on the cap table. */
  idealInvestor: string;
  /** Domain hint shown in the modal footer ("acmelabs.example"). */
  websitePlaceholder: string;
  /** Free-form keywords used by the placeholder ranking. */
  tags: string[];
  customerType: CustomerType;
};

export type InvestorRecommendation = {
  kind: "investor";
  id: string;
  name: string;
  tagline: string;
  investorType: "firm" | "angel";
  /** Display range, e.g. "$250K-$1M". */
  checkRange: string;
  stages: string[];
  sectors: string[];
  geography: string;
  /** "Open to lead" / "Lead-only" / etc. */
  equityPreference: string;
  thesis: string;
  /** 3-5 short blurbs ("Stripe (seed)", "Brex (Series B)", ...). */
  portfolio: string[];
  /** What the investor brings beyond capital. */
  helpsWith: string[];
  /** Founder qualities they explicitly look for. */
  founderQualities: string[];
  websitePlaceholder: string;
  tags: string[];
};

/**
 * Where a ranking call originated. Today only `onboarding` is wired, but
 * downstream callers (dashboard rail, full feed page, ML training event log)
 * can pass other contexts later for telemetry without changing the API.
 */
export type RecommendationContext = "onboarding" | "dashboard" | "feed";

export type GetRecommendedProfilesArgs = {
  currentUserProfile: CurrentUserSnapshot;
  candidateProfiles: RecommendationProfile[];
  context: RecommendationContext;
  /** Cap on returned results. Default 12 to fill the 3x4 onboarding grid. */
  limit?: number;
};
