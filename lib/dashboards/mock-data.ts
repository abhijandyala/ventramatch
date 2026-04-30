/**
 * Illustrative sample data for the dashboard build. Not real firms,
 * founders, startups, or metrics.
 *
 * TODO(handoff): replace with real DB queries from lib/db.ts (and lib/matching
 * for scores) once the teammate's profile-creation flow seeds users +
 * startups + investors. The exported shapes below are the contract the
 * page components depend on; preserve them when wiring real data.
 */

export type VerifiedBadge = {
  /** Source of verification, used to compose a truthful trust label per docs/legal.md. */
  source: "firm domain" | "company domain" | "linkedin" | "manual review";
  label: string;
};

export type SampleInvestor = {
  id: string;
  initials: string;
  name: string;
  firm: string;
  location: string;
  stages: string[];
  checkMin: number;
  checkMax: number;
  sectors: string[];
  geographies: string[];
  isActive: boolean;
  activityLabel: string;
  score: number;
  reason: string;
  description: string;
  whyMatchChips: string[];
  /** Optional truthful trust label. Only set when the verification source is real. */
  verified?: VerifiedBadge;
  /** Per-axis match breakdown (0–1). Mirrors the scoring spec in
   *  docs/matching-algorithm.md. Used by FounderMatchAnalysisCard. */
  breakdown?: {
    sector: number;
    stage: number;
    check: number;
    geography: number;
    traction: number;
  };
};

export type SampleStartup = {
  id: string;
  initials: string;
  name: string;
  oneLiner: string;
  /** Short narrative pitch (2 sentences). Shown on the hero card below the chips. */
  description?: string;
  location: string;
  stage: string;
  sectors: string[];
  ask: number | null;
  mrr: number | null;
  growthMoM: number | null;
  score: number;
  reason: string;
  breakdown: {
    sector: number;
    stage: number;
    check: number;
    geography: number;
    traction: number;
  };
  /** "Why it's a great match" chips surfaced on the hero card. */
  whyMatchChips: string[];
  /** Optional truthful trust label. Sources reflect docs/legal.md tiers. */
  verified?: VerifiedBadge;
};

export type ProfileChecklistItem = {
  id: string;
  label: string;
  href: string;
  done: boolean;
};

export type StatDelta = {
  value: number;
  trend: "up" | "down" | "flat";
  periodLabel: string;
};

export type Stat = {
  label: string;
  value: number;
  delta?: StatDelta;
};

export type SeriesPoint = { x: string; y: number };

export type ActionRequiredItem = {
  id: string;
  label: string;
  count: number;
  /** What to render as the action; href can be a stub. */
  action: { href: string; label: string };
  tone: "view" | "save" | "match";
};

export type ImproveMatchItem = {
  id: string;
  /** What the user can do to lift their score. */
  label: string;
  /** Estimated absolute uplift in match score percentage points. Truthful framing only. */
  estimatedDeltaPts: number;
  href: string;
};

export type InvestorActivityItem = {
  id: string;
  label: string;
  count: number;
  /** Number of "fresh" anonymous tokens to show in the avatar stack (placeholders, not real people). */
  recentCount: number;
  tone: "view" | "save" | "message";
};

export type FounderDashboard = {
  topMatches: SampleInvestor[];
  recommended: SampleInvestor[];
  /** "X new investors today" indicator near the hero card. */
  newInvestorsToday: number;
  profileStrength: {
    percent: number;
    band: "Weak" | "Improving" | "Strong" | "Excellent";
    /** Estimated uplift in matches if profile is completed; truthful framing required. */
    completionUpliftPct: number;
    checklist: ProfileChecklistItem[];
  };
  investorInterest: {
    interestedCount: Stat;
    profileViewsCount: Stat;
  };
  /** Right-panel "Action Required" items. */
  actionRequired: ActionRequiredItem[];
  profilePerformance: {
    stats: [Stat, Stat, Stat, Stat];
    series: SeriesPoint[];
  };
  /** Right-panel "How to improve your matches" items. */
  improveMatches: ImproveMatchItem[];
  /** Bottom-row "Investor activity" items. Counts only, no identities pre-mutual-match. */
  investorActivity: InvestorActivityItem[];
  /** Bottom-row "Why you're a great fit" deterministic bullets. */
  greatFitBullets: string[];
  reasoning: {
    body: string;
  };
};

export type Filters = {
  stages: string[];
  sectors: string[];
  checkMin?: number;
  checkMax?: number;
  geographies: string[];
};

export type InvestorFeed = {
  totalCount: number;
  startups: SampleStartup[];
  activity: [Stat, Stat, Stat, Stat];
  filters: Filters;
  /** "X new startups today" indicator near the hero card. */
  newStartupsToday: number;
  /** Right-panel "Action Required" items (investor-specific). */
  actionRequired: ActionRequiredItem[];
  /** Right-panel "How to improve your matches" items (investor-specific). */
  improveMatches: ImproveMatchItem[];
  /** Investor profile completion. */
  profileStrength: {
    percent: number;
    band: "Weak" | "Improving" | "Strong" | "Excellent";
    completionUpliftPct: number;
    checklist: ProfileChecklistItem[];
  };
  profilePerformance: {
    stats: [Stat, Stat, Stat, Stat];
    series: SeriesPoint[];
  };
  /** Bottom-row "Startup activity" items. Counts only, no identities pre-mutual-match. */
  startupActivity: InvestorActivityItem[];
  /** Bottom-row "Why you're a great fit" deterministic bullets (investor perspective). */
  greatFitBullets: string[];
};

const usd = (n: number | null): string => {
  if (n == null) return "—";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${Number.isInteger(m) ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (n >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${n}`;
};

export function formatUsd(n: number | null): string {
  return usd(n);
}

export function formatCheckRange(min: number, max: number): string {
  return `${usd(min)} to ${usd(max)}`;
}

const sharedInvestors: SampleInvestor[] = [
  {
    id: "inv-aperture",
    initials: "AL",
    name: "Aperture Labs Ventures",
    firm: "Pre-seed fund",
    location: "San Francisco, CA",
    stages: ["pre-seed"],
    checkMin: 250_000,
    checkMax: 1_000_000,
    sectors: ["dev tools", "AI infra"],
    geographies: ["SF Bay Area", "United States"],
    isActive: true,
    activityLabel: "Active this week",
    score: 92,
    reason: "Stage and sector match. Three portfolio companies in dev tools.",
    description:
      "Backs early infrastructure and developer-platform teams from first commit to first paid pilot.",
    whyMatchChips: [
      "Stage match",
      "Check size fits",
      "Invests in AI infra",
      "Strong portfolio overlap",
    ],
    verified: { source: "firm domain", label: "Firm verified" },
    breakdown: { sector: 1.0, stage: 1.0, check: 1.0, geography: 1.0, traction: 0.6 },
  },
  {
    id: "inv-northbound",
    initials: "NC",
    name: "Northbound Capital",
    firm: "Micro VC",
    location: "New York, NY",
    stages: ["pre-seed", "seed"],
    checkMin: 500_000,
    checkMax: 2_000_000,
    sectors: ["fintech", "infra"],
    geographies: ["United States"],
    isActive: true,
    activityLabel: "Active this month",
    score: 88,
    reason: "Check size fits and stage matches.",
    description:
      "Leads small rounds in B2B financial infrastructure with a hands-on operating partner.",
    whyMatchChips: ["Stage match", "Check size fits", "Sector overlap"],
    verified: { source: "firm domain", label: "Firm verified" },
    breakdown: { sector: 0.6, stage: 1.0, check: 1.0, geography: 0.4, traction: 0.6 },
  },
  {
    id: "inv-mreyes",
    initials: "MR",
    name: "Mara Reyes",
    firm: "Angel, ex-Stripe",
    location: "SF Bay Area",
    stages: ["pre-seed"],
    checkMin: 25_000,
    checkMax: 100_000,
    sectors: ["payments", "dev tools"],
    geographies: ["SF Bay Area"],
    isActive: true,
    activityLabel: "Active this month",
    score: 81,
    reason: "Solo angel investing in your sector.",
    description:
      "Writes small checks for technical founders shipping payments or developer tooling.",
    whyMatchChips: ["Stage match", "Geography match", "Sector overlap"],
    verified: { source: "linkedin", label: "Identity verified" },
    breakdown: { sector: 1.0, stage: 1.0, check: 0.4, geography: 1.0, traction: 0.6 },
  },
];

const recommended: SampleInvestor[] = [
  {
    id: "inv-quoin",
    initials: "QH",
    name: "Quoin Holdings",
    firm: "Seed fund",
    location: "Boston, MA",
    stages: ["seed"],
    checkMin: 1_000_000,
    checkMax: 3_000_000,
    sectors: ["infra", "developer platforms"],
    geographies: ["United States"],
    isActive: true,
    activityLabel: "Active this month",
    score: 87,
    reason: "Sector matches. Check above your current raise.",
    description:
      "Concentrated seed checks into infrastructure and developer-platform companies.",
    whyMatchChips: ["Sector match", "Active recently"],
  },
  {
    id: "inv-jtan",
    initials: "JT",
    name: "Jules Tan",
    firm: "Angel, founder Atlas Logs",
    location: "Remote",
    stages: ["pre-seed"],
    checkMin: 50_000,
    checkMax: 150_000,
    sectors: ["dev tools", "observability"],
    geographies: ["Remote"],
    isActive: true,
    activityLabel: "Joined this week",
    score: 82,
    reason: "Sector matches. Geography flexible.",
    description:
      "Backs technical founders building developer or observability tooling.",
    whyMatchChips: ["Sector match", "Stage match"],
  },
  {
    id: "inv-brackline",
    initials: "BR",
    name: "Brackline Partners",
    firm: "Seed fund",
    location: "Austin, TX",
    stages: ["seed", "series A"],
    checkMin: 1_500_000,
    checkMax: 4_000_000,
    sectors: ["infra", "data"],
    geographies: ["United States"],
    isActive: true,
    activityLabel: "Active this month",
    score: 78,
    reason: "Sector matches.",
    description:
      "Leads seed and follow-on rounds in infrastructure and data tooling.",
    whyMatchChips: ["Sector match"],
  },
  {
    id: "inv-hummock",
    initials: "HM",
    name: "Hummock Ventures",
    firm: "Pre-seed fund",
    location: "Toronto, ON",
    stages: ["pre-seed"],
    checkMin: 100_000,
    checkMax: 500_000,
    sectors: ["dev tools", "B2B"],
    geographies: ["Canada", "United States"],
    isActive: false,
    activityLabel: "Active last month",
    score: 76,
    reason: "Stage matches.",
    description:
      "Cross-border pre-seed fund focused on B2B and developer-facing tools.",
    whyMatchChips: ["Stage match"],
  },
];

export const founderDashboardMock: FounderDashboard = {
  topMatches: sharedInvestors,
  recommended,
  newInvestorsToday: 3,
  profileStrength: {
    percent: 72,
    band: "Improving",
    completionUpliftPct: 18,
    checklist: [
      { id: "deck", label: "Pitch deck uploaded", href: "/profile#deck", done: true },
      {
        id: "core",
        label: "Industry, stage, raise set",
        href: "/profile#core",
        done: true,
      },
      { id: "traction", label: "Traction added", href: "/profile#traction", done: true },
      { id: "location", label: "Location set", href: "/profile#location", done: false },
      { id: "linkedin", label: "Founder LinkedIn linked", href: "/profile#linkedin", done: false },
    ],
  },
  investorInterest: {
    interestedCount: {
      label: "Interested in you",
      value: 12,
      delta: { value: 20, trend: "up", periodLabel: "vs prior week" },
    },
    profileViewsCount: {
      label: "Profile views",
      value: 48,
      delta: { value: 15, trend: "up", periodLabel: "vs prior week" },
    },
  },
  actionRequired: [
    {
      id: "viewed",
      label: "investors viewed your profile",
      count: 2,
      action: { href: "/matches?filter=viewed", label: "View" },
      tone: "view",
    },
    {
      id: "saved",
      label: "investor saved your profile",
      count: 1,
      action: { href: "/matches?filter=saved", label: "View" },
      tone: "save",
    },
    {
      id: "matches",
      label: "new matches today",
      count: 3,
      action: { href: "/matches?filter=new", label: "See all" },
      tone: "match",
    },
  ],
  profilePerformance: {
    stats: [
      {
        label: "Profile views",
        value: 1248,
        delta: { value: 18, trend: "up", periodLabel: "this month" },
      },
      {
        label: "Saves",
        value: 312,
        delta: { value: 24, trend: "up", periodLabel: "this month" },
      },
      {
        label: "Messages",
        value: 48,
        delta: { value: 12, trend: "up", periodLabel: "this month" },
      },
      {
        label: "Meetings",
        value: 12,
        delta: { value: 33, trend: "up", periodLabel: "this month" },
      },
    ],
    series: [
      { x: "W1", y: 180 },
      { x: "W2", y: 215 },
      { x: "W3", y: 240 },
      { x: "W4", y: 235 },
      { x: "W5", y: 268 },
      { x: "W6", y: 290 },
      { x: "W7", y: 312 },
      { x: "W8", y: 328 },
    ],
  },
  improveMatches: [
    {
      id: "mrr",
      label: "Add monthly recurring revenue (MRR)",
      estimatedDeltaPts: 22,
      href: "/profile#traction",
    },
    {
      id: "geo",
      label: "Expand your target geography",
      estimatedDeltaPts: 12,
      href: "/profile#location",
    },
    {
      id: "traction",
      label: "Add more traction data points",
      estimatedDeltaPts: 9,
      href: "/profile#traction",
    },
  ],
  investorActivity: [
    { id: "viewed", label: "Investors viewed your profile", count: 12, recentCount: 5, tone: "view" },
    { id: "saved", label: "Investors saved your profile", count: 5, recentCount: 2, tone: "save" },
    { id: "messaged", label: "Message conversations started", count: 3, recentCount: 1, tone: "message" },
  ],
  greatFitBullets: [
    "Strong signal on dev-tools and AI infrastructure thesis",
    "Traction and growth metrics align with seed-stage expectations",
    "Stage and check size are a perfect match",
    "Located inside the target geographies",
  ],
  reasoning: {
    body:
      "Your top matches share a 1.0 on sector and stage. Geography is the variable axis. Adding a quantitative line to your traction (paying customers or MRR) will lift seed-stage scores most.",
  },
};

const startups: SampleStartup[] = [
  {
    id: "su-finova",
    initials: "FN",
    name: "Finova",
    oneLiner: "Financial operations platform for B2B teams.",
    description: "Finova is growing 11% MoM with $1.2M MRR and raising a $3M Series A. Three investors with similar theses backed comparable fintech infrastructure companies in the last 12 months.",
    location: "New York, NY",
    stage: "Series A",
    sectors: ["B2B SaaS", "Fintech"],
    ask: 3_000_000,
    mrr: 1_200_000,
    growthMoM: 11,
    score: 92,
    reason: "Sector and stage match. Check size fits.",
    breakdown: { sector: 1.0, stage: 1.0, check: 1.0, geography: 0.4, traction: 0.8 },
    whyMatchChips: ["Sector match", "Stage match", "Check size fits", "Strong traction"],
    verified: { source: "company domain", label: "Company verified" },
  },
  {
    id: "su-clearpath",
    initials: "CP",
    name: "ClearPath",
    oneLiner: "Supply-chain visibility for mid-market enterprises.",
    description: "ClearPath's platform saves mid-market ops teams 6–8 hours per week on tracking and exception management. Revenue is $800K MRR, growing 9% MoM, with two enterprise pilots closing this quarter.",
    location: "Austin, TX",
    stage: "Seed",
    sectors: ["B2B SaaS", "Logistics"],
    ask: 1_500_000,
    mrr: 800_000,
    growthMoM: 9,
    score: 89,
    reason: "Stage and check match.",
    breakdown: { sector: 0.6, stage: 1.0, check: 1.0, geography: 1.0, traction: 0.7 },
    whyMatchChips: ["Stage match", "Check size fits", "Geography match"],
    verified: { source: "company domain", label: "Company verified" },
  },
  {
    id: "su-greenlytic",
    initials: "GL",
    name: "Greenlytic",
    oneLiner: "ESG reporting and analytics for mid-market companies.",
    description: "Greenlytic helps mid-market companies turn ESG mandates into competitive advantage. $950K MRR, growing 7% MoM, with three enterprise contracts signed in Q1.",
    location: "Boston, MA",
    stage: "Series A",
    sectors: ["Climate Tech", "SaaS"],
    ask: 2_500_000,
    mrr: 950_000,
    growthMoM: 7,
    score: 87,
    reason: "Stage matches. Sector adjacent to thesis.",
    breakdown: { sector: 0.6, stage: 1.0, check: 1.0, geography: 0.4, traction: 0.7 },
    whyMatchChips: ["Stage match", "Check size fits", "Sector adjacent"],
    verified: { source: "linkedin", label: "Identity verified" },
  },
  {
    id: "su-stagecast",
    initials: "SC",
    name: "Stagecast",
    oneLiner: "Live operations console for product teams.",
    description: "Stagecast replaces spreadsheet-driven ops with a real-time dashboard used by 40+ product teams. 14% MoM growth on $420K MRR and strong expansion revenue from existing customers.",
    location: "Seattle, WA",
    stage: "Seed",
    sectors: ["Dev Tools", "B2B SaaS"],
    ask: 1_800_000,
    mrr: 420_000,
    growthMoM: 14,
    score: 84,
    reason: "Sector matches. Strong growth.",
    breakdown: { sector: 1.0, stage: 1.0, check: 0.7, geography: 0.4, traction: 0.9 },
    whyMatchChips: ["Sector match", "Stage match", "Strong growth"],
  },
  {
    id: "su-oremico",
    initials: "OM",
    name: "Oremico",
    oneLiner: "Analytics warehouse for non-technical operators.",
    description: "Oremico lets ops and finance teams query and visualize data without SQL or code. Pre-revenue but 3 paying pilots in progress; raising $800K to close the first enterprise contract.",
    location: "Remote",
    stage: "Pre-Seed",
    sectors: ["Data", "B2B SaaS"],
    ask: 800_000,
    mrr: null,
    growthMoM: null,
    score: 79,
    reason: "Stage matches.",
    breakdown: { sector: 0.6, stage: 1.0, check: 1.0, geography: 0.4, traction: 0.3 },
    whyMatchChips: ["Stage match", "Check size fits"],
  },
  {
    id: "su-holta",
    initials: "HL",
    name: "Holta",
    oneLiner: "Compliance automation for healthcare operators.",
    description: "Holta cuts HIPAA and CMS audit prep from weeks to hours for hospital groups and clinic networks. $310K MRR with 6% MoM growth and a pipeline of 8 enterprise conversations.",
    location: "Chicago, IL",
    stage: "Seed",
    sectors: ["Healthcare", "B2B SaaS"],
    ask: 2_000_000,
    mrr: 310_000,
    growthMoM: 6,
    score: 73,
    reason: "Stage matches.",
    breakdown: { sector: 0.3, stage: 1.0, check: 1.0, geography: 0.4, traction: 0.5 },
    whyMatchChips: ["Stage match", "Check size fits"],
  },
];

export const investorFeedMock: InvestorFeed = {
  totalCount: 1248,
  startups,
  newStartupsToday: 4,
  activity: [
    { label: "Startups viewed", value: 68, delta: { value: 15, trend: "up", periodLabel: "this month" } },
    { label: "Saved", value: 24, delta: { value: 20, trend: "up", periodLabel: "this month" } },
    { label: "Messages sent", value: 18, delta: { value: 8, trend: "up", periodLabel: "this month" } },
    { label: "Meetings booked", value: 7, delta: { value: 40, trend: "up", periodLabel: "this month" } },
  ],
  filters: {
    stages: ["Seed", "Series A"],
    sectors: ["B2B SaaS"],
    checkMin: 500_000,
    checkMax: 10_000_000,
    geographies: [],
  },
  actionRequired: [
    {
      id: "viewed",
      label: "startups viewed your thesis",
      count: 4,
      action: { href: "/matches?filter=viewed", label: "View" },
      tone: "view",
    },
    {
      id: "saved",
      label: "startups saved your profile",
      count: 2,
      action: { href: "/matches?filter=saved", label: "View" },
      tone: "save",
    },
    {
      id: "matches",
      label: "new matches today",
      count: 3,
      action: { href: "/matches?filter=new", label: "See all" },
      tone: "match",
    },
  ],
  improveMatches: [
    {
      id: "sectors",
      label: "Narrow your sector focus",
      estimatedDeltaPts: 15,
      href: "/profile#sectors",
    },
    {
      id: "thesis",
      label: "Update your investment thesis",
      estimatedDeltaPts: 12,
      href: "/profile#thesis",
    },
    {
      id: "geo",
      label: "Refine target geographies",
      estimatedDeltaPts: 8,
      href: "/profile#geography",
    },
  ],
  profileStrength: {
    percent: 85,
    band: "Strong",
    completionUpliftPct: 12,
    checklist: [
      { id: "firm", label: "Firm name and role set", href: "/profile#firm", done: true },
      { id: "thesis", label: "Investment thesis added", href: "/profile#thesis", done: true },
      { id: "check", label: "Check size range set", href: "/profile#check", done: true },
      { id: "sectors", label: "Sectors selected", href: "/profile#sectors", done: true },
      { id: "linkedin", label: "LinkedIn linked", href: "/profile#linkedin", done: false },
    ],
  },
  profilePerformance: {
    stats: [
      { label: "Startups viewed", value: 68, delta: { value: 15, trend: "up", periodLabel: "this month" } },
      { label: "Saved", value: 24, delta: { value: 20, trend: "up", periodLabel: "this month" } },
      { label: "Messages", value: 18, delta: { value: 8, trend: "up", periodLabel: "this month" } },
      { label: "Meetings", value: 7, delta: { value: 40, trend: "up", periodLabel: "this month" } },
    ],
    series: [
      { x: "W1", y: 42 },
      { x: "W2", y: 55 },
      { x: "W3", y: 48 },
      { x: "W4", y: 62 },
      { x: "W5", y: 58 },
      { x: "W6", y: 71 },
      { x: "W7", y: 65 },
      { x: "W8", y: 68 },
    ],
  },
  startupActivity: [
    { id: "viewed", label: "Startups viewed your thesis", count: 15, recentCount: 4, tone: "view" },
    { id: "saved", label: "Startups saved your profile", count: 6, recentCount: 2, tone: "save" },
    { id: "messaged", label: "Conversations started", count: 4, recentCount: 1, tone: "message" },
  ],
  greatFitBullets: [
    "Strong thesis alignment with high-scoring startups",
    "Active in stages where deal quality is highest",
    "Check size matches the majority of current raises",
    "Located in high-density founder geographies",
  ],
};

export function getSampleStartupById(id: string): SampleStartup | undefined {
  return investorFeedMock.startups.find((s) => s.id === id);
}
