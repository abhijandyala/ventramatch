/**
 * VentureConnect — startup-to-investor matching pipeline.
 *
 * Quality-first: spam, incomplete, or suspicious profiles never reach the
 * investor feed. Valid startups are ranked by investor fit.
 *
 * Disclaimer: scores are informational heuristics, not investment advice.
 */

import type { Startup } from "@/types/startup";
import type { Investor } from "@/types/investor";

// ─── Result types ───────────────────────────────────────────────────────────

export type TrustTier = "unverified" | "basic_verified" | "strong_signals" | "fully_verified";
export type VisibilityTier = "hidden" | "limited" | "visible" | "review_required";

export interface TrustScoreResult {
  trustScore: number;
  trustTier: TrustTier;
  verificationSignals: string[];
  verificationWarnings: string[];
}

export interface ProfileQualityResult {
  profileQualityScore: number;
  missingFields: string[];
  qualityWarnings: string[];
}

export interface SpamDetectionResult {
  spamScore: number;
  spamFlags: string[];
  requiresManualReview: boolean;
}

export interface VisibilityResult {
  visibilityTier: VisibilityTier;
  visibilityReasons: string[];
}

export interface FilterResult {
  passes: boolean;
  failedReasons: string[];
}

export interface ScoreBreakdown {
  stageFit: number;
  sectorFit: number;
  checkSizeFit: number;
  geographyFit: number;
  tractionFit: number;
  profileQuality: number;
  trustBonus: number;
}

export interface MatchScoreResult {
  matchScore: number;
  scoreBreakdown: ScoreBreakdown;
}

export interface MatchExplanation {
  whyTheyMatch: string[];
  potentialRedFlags: string[];
  trustSummary: string;
}

export interface MatchedStartup {
  startupId: string;
  startupName: string;
  matchScore: number;
  trustScore: number;
  trustTier: TrustTier;
  profileQualityScore: number;
  spamScore: number;
  visibilityTier: VisibilityTier;
  scoreBreakdown: ScoreBreakdown;
  whyTheyMatch: string[];
  potentialRedFlags: string[];
  trustSummary: string;
}

// ─── 1. Startup trust scoring ───────────────────────────────────────────────

const TRUST_WEIGHTS = {
  founderIdentity: 0.2,
  startupExistence: 0.2,
  tractionProof: 0.25,
  socialSignals: 0.15,
  platformBehavior: 0.2,
} as const;

export function calculateStartupTrustScore(startup: Startup): TrustScoreResult {
  const signals: string[] = [];
  const warnings: string[] = [];

  // Founder identity (0–100 contribution before weight)
  const founderScore = scoreFounderIdentity(startup, signals, warnings);

  // Startup existence
  const existenceScore = scoreStartupExistence(startup, signals, warnings);

  // Traction proof
  const tractionScore = scoreTractionProof(startup, signals, warnings);

  // Social/network signals
  const socialScore = scoreSocialSignals(startup, signals, warnings);

  // Platform behavior
  const behaviorScore = scorePlatformBehavior(startup, signals, warnings);

  const trustScore = Math.round(
    founderScore * TRUST_WEIGHTS.founderIdentity +
      existenceScore * TRUST_WEIGHTS.startupExistence +
      tractionScore * TRUST_WEIGHTS.tractionProof +
      socialScore * TRUST_WEIGHTS.socialSignals +
      behaviorScore * TRUST_WEIGHTS.platformBehavior,
  );

  return {
    trustScore: clamp(trustScore, 0, 100),
    trustTier: trustTierFromScore(trustScore),
    verificationSignals: signals,
    verificationWarnings: warnings,
  };
}

function scoreFounderIdentity(startup: Startup, signals: string[], warnings: string[]): number {
  let score = 0;
  if (startup.founder.linkedinUrl) {
    score += 40;
    signals.push("LinkedIn profile provided");
  }
  if (startup.founder.name) {
    score += 30;
    signals.push("Founder name present");
  }
  if (startup.founder.email && isCompanyEmail(startup.founder.email)) {
    score += 30;
    signals.push("Company domain email");
  } else if (startup.founder.email) {
    score += 15;
    signals.push("Personal email provided");
  }
  if (!startup.founder.name && !startup.founder.linkedinUrl) {
    warnings.push("No founder identity information");
  }
  return clamp(score, 0, 100);
}

function scoreStartupExistence(startup: Startup, signals: string[], warnings: string[]): number {
  let score = 0;
  if (startup.links.website) {
    score += 35;
    signals.push("Website exists");
  }
  if (startup.links.demoUrl || startup.links.productUrl || startup.links.githubUrl) {
    score += 35;
    signals.push("Demo/product/GitHub link exists");
  }
  if (startup.pitch && startup.pitch.length >= 50) {
    score += 30;
    signals.push("Description present");
  } else if (startup.pitch) {
    score += 15;
  }
  if (!startup.links.website && !startup.links.demoUrl && !startup.links.githubUrl) {
    warnings.push("No web presence links");
  }
  return clamp(score, 0, 100);
}

function scoreTractionProof(startup: Startup, signals: string[], warnings: string[]): number {
  let score = 0;
  const t = startup.traction;

  if (t.revenue !== null || t.users !== null || t.mrr !== null) {
    score += 35;
    signals.push("Revenue/users/metrics provided");
  }
  if (t.proofUrl) {
    score += 35;
    signals.push("Proof upload exists");
  }
  if (metricsRealisticForStage(startup)) {
    score += 30;
    signals.push("Metrics appear realistic for stage");
  } else if (t.revenue !== null || t.users !== null) {
    warnings.push("Metrics may be unrealistic for stated stage");
    score += 10;
  }
  return clamp(score, 0, 100);
}

function scoreSocialSignals(startup: Startup, signals: string[], warnings: string[]): number {
  let score = 0;
  if (startup.team.length > 0) {
    score += 35;
    signals.push(`${startup.team.length} team member(s) listed`);
  }
  if (startup.endorsements > 0) {
    score += 35;
    signals.push(`${startup.endorsements} endorsement(s)`);
  }
  if (startup.publicPresenceScore > 50) {
    score += 30;
    signals.push("Notable public presence");
  } else if (startup.publicPresenceScore > 20) {
    score += 15;
  }
  if (startup.team.length === 0 && startup.endorsements === 0) {
    warnings.push("No team or endorsement info");
  }
  return clamp(score, 0, 100);
}

function scorePlatformBehavior(startup: Startup, signals: string[], warnings: string[]): number {
  let score = 0;
  const b = startup.platformBehavior;

  if (b.profileViews > 10) score += 20;
  if (b.investorLikes > 0) {
    score += 25;
    signals.push(`${b.investorLikes} investor like(s)`);
  }
  if (b.investorSaves > 0) {
    score += 15;
    signals.push(`${b.investorSaves} investor save(s)`);
  }
  if (b.responseRatePercent >= 70) {
    score += 25;
    signals.push("High founder responsiveness");
  } else if (b.responseRatePercent >= 40) {
    score += 10;
  }
  if (b.spamReports === 0) {
    score += 15;
  } else {
    warnings.push(`${b.spamReports} spam report(s) filed`);
  }
  return clamp(score, 0, 100);
}

// ─── 2. Profile quality scoring ─────────────────────────────────────────────

const REQUIRED_FIELDS: Array<{ key: string; getter: (s: Startup) => unknown }> = [
  { key: "name", getter: (s) => s.name },
  { key: "industry", getter: (s) => s.industry },
  { key: "stage", getter: (s) => s.stage },
  { key: "location", getter: (s) => s.location },
  { key: "raiseAmount", getter: (s) => s.raiseAmount },
  { key: "pitch", getter: (s) => s.pitch },
  { key: "teamBackground", getter: (s) => s.team.length > 0 },
  { key: "problemStatement", getter: (s) => s.problemStatement },
  { key: "solution", getter: (s) => s.solution },
];

export function calculateProfileQuality(startup: Startup): ProfileQualityResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Completeness (40%)
  let filledCount = 0;
  for (const field of REQUIRED_FIELDS) {
    const val = field.getter(startup);
    if (val && val !== false) {
      filledCount++;
    } else {
      missing.push(field.key);
    }
  }
  const completenessScore = (filledCount / REQUIRED_FIELDS.length) * 100;

  // Deck/demo (20%)
  const hasDeckOrDemo = !!(startup.links.deckUrl || startup.links.demoUrl || startup.links.productUrl);
  const deckScore = hasDeckOrDemo ? 100 : 0;
  if (!hasDeckOrDemo) warnings.push("No deck, demo, or product link");

  // Team credibility (15%)
  const teamScore = scoreTeamCredibility(startup);

  // Traction (15%)
  const tractionScore = scoreTractionForQuality(startup);

  // Pitch clarity (10%)
  const pitchScore = scorePitchClarity(startup);

  const profileQualityScore = Math.round(
    completenessScore * 0.4 +
      deckScore * 0.2 +
      teamScore * 0.15 +
      tractionScore * 0.15 +
      pitchScore * 0.1,
  );

  if (completenessScore < 60) warnings.push("Profile is significantly incomplete");
  if (pitchScore < 30) warnings.push("Pitch lacks clarity or substance");

  return {
    profileQualityScore: clamp(profileQualityScore, 0, 100),
    missingFields: missing,
    qualityWarnings: warnings,
  };
}

function scoreTeamCredibility(startup: Startup): number {
  let score = 0;
  if (startup.team.length >= 2) score += 40;
  else if (startup.team.length === 1) score += 20;

  const linkedinCount = startup.team.filter((m) => m.linkedinUrl).length;
  if (linkedinCount >= 2) score += 30;
  else if (linkedinCount === 1) score += 15;

  if (startup.founder.bio && startup.founder.bio.length >= 80) score += 30;
  else if (startup.founder.bio) score += 15;

  return clamp(score, 0, 100);
}

function scoreTractionForQuality(startup: Startup): number {
  let score = 0;
  const t = startup.traction;
  if (t.revenue !== null && t.revenue > 0) score += 40;
  if (t.users !== null && t.users > 0) score += 30;
  if (t.metricsDescription && t.metricsDescription.length > 30) score += 30;
  return clamp(score, 0, 100);
}

function scorePitchClarity(startup: Startup): number {
  const pitch = startup.pitch;
  if (!pitch) return 0;
  const len = pitch.trim().length;
  if (len >= 200) return 100;
  if (len >= 100) return 60;
  if (len >= 40) return 30;
  return 10;
}

// ─── 3. Spam detection ──────────────────────────────────────────────────────

const BUZZWORDS = [
  "revolutionary", "disruptive", "game-changer", "paradigm shift",
  "unprecedented", "world-class", "best-in-class", "next-gen",
  "blockchain", "web3", "metaverse", "synergy", "leverage",
];

const SUSPICIOUS_TLD_PATTERNS = [/\.xyz$/i, /\.tk$/i, /\.ml$/i, /\.ga$/i, /\.cf$/i];

export function detectSpamSignals(startup: Startup): SpamDetectionResult {
  const flags: string[] = [];
  let score = 0;

  // Short or vague pitch
  if (!startup.pitch || startup.pitch.trim().length < 30) {
    score += 15;
    flags.push("Pitch is missing or too short");
  }

  // No team info
  if (startup.team.length === 0 && !startup.founder.name) {
    score += 12;
    flags.push("No team information");
  }

  // No website/demo/deck
  if (!startup.links.website && !startup.links.demoUrl && !startup.links.deckUrl) {
    score += 10;
    flags.push("No website, demo, or deck");
  }

  // Too many industries selected (likely spam/unfocused)
  if (startup.industries.length > 5) {
    score += 12;
    flags.push(`${startup.industries.length} industries selected (max recommended: 3)`);
  }

  // Unrealistic raise amount
  if (startup.raiseAmount !== null) {
    if (startup.raiseAmount > 50_000_000 && startup.stage !== "series_b_plus") {
      score += 15;
      flags.push("Raise amount unrealistic for stage");
    }
    if (startup.raiseAmount < 1_000 && startup.stage !== "idea") {
      score += 8;
      flags.push("Raise amount suspiciously low for stage");
    }
  }

  // Suspicious links
  const allLinks = [
    startup.links.website,
    startup.links.demoUrl,
    startup.links.productUrl,
    startup.links.githubUrl,
  ].filter(Boolean) as string[];

  for (const link of allLinks) {
    if (SUSPICIOUS_TLD_PATTERNS.some((p) => p.test(link))) {
      score += 10;
      flags.push(`Suspicious link TLD: ${link}`);
    }
  }

  // Repeated text
  if (hasRepeatedText(startup.pitch ?? "")) {
    score += 12;
    flags.push("Pitch contains repeated text patterns");
  }

  // Buzzword-heavy with no specifics
  const buzzCount = countBuzzwords(startup.pitch ?? "");
  if (buzzCount >= 4) {
    score += 10;
    flags.push(`Pitch contains ${buzzCount} buzzwords with limited substance`);
  }

  // Spam reports
  if (startup.platformBehavior.spamReports >= 3) {
    score += 20;
    flags.push(`${startup.platformBehavior.spamReports} spam reports filed`);
  } else if (startup.platformBehavior.spamReports >= 1) {
    score += 8;
    flags.push(`${startup.platformBehavior.spamReports} spam report(s)`);
  }

  const requiresManualReview =
    score >= 50 ||
    startup.platformBehavior.spamReports >= 3 ||
    flags.some((f) => f.includes("Suspicious link"));

  return {
    spamScore: clamp(score, 0, 100),
    spamFlags: flags,
    requiresManualReview,
  };
}

// ─── 4. Visibility tier ─────────────────────────────────────────────────────

export function determineVisibilityTier(
  startup: Startup,
  profileQualityScore: number,
  trustScore: number,
  spamScore: number,
): VisibilityResult {
  const reasons: string[] = [];

  // Review required — check first, takes priority over hidden
  const suspiciousLinks = (startup.links.website && isSuspiciousUrl(startup.links.website)) ||
    (startup.links.demoUrl && isSuspiciousUrl(startup.links.demoUrl));
  const unrealisticClaims = startup.raiseAmount !== null &&
    startup.raiseAmount > 50_000_000 &&
    startup.stage !== "series_b_plus";
  const conflictingData = startup.traction.revenue !== null &&
    startup.traction.revenue > 10_000_000 &&
    startup.stage === "idea";

  if (suspiciousLinks || unrealisticClaims || conflictingData) {
    if (suspiciousLinks) reasons.push("Suspicious external links");
    if (unrealisticClaims) reasons.push("Unrealistic raise claims");
    if (conflictingData) reasons.push("Conflicting stage/traction data");
    return { visibilityTier: "review_required", visibilityReasons: reasons };
  }

  // Hidden
  if (profileQualityScore < 50) reasons.push(`Profile quality too low (${profileQualityScore})`);
  if (trustScore < 30) reasons.push(`Trust score too low (${trustScore})`);
  if (spamScore >= 70) reasons.push(`High spam score (${spamScore})`);
  if (profileQualityScore < 50 || trustScore < 30 || spamScore >= 70) {
    return { visibilityTier: "hidden", visibilityReasons: reasons };
  }

  // Limited
  if (profileQualityScore < 70) reasons.push(`Profile quality moderate (${profileQualityScore})`);
  if (trustScore < 50) reasons.push(`Trust score moderate (${trustScore})`);
  if (spamScore >= 40) reasons.push(`Elevated spam signals (${spamScore})`);
  if (profileQualityScore < 70 || trustScore < 50 || spamScore >= 40) {
    return { visibilityTier: "limited", visibilityReasons: reasons };
  }

  // Visible
  reasons.push("Meets all quality thresholds");
  return { visibilityTier: "visible", visibilityReasons: reasons };
}

// ─── 5. Investor preference filtering ───────────────────────────────────────

export function passesInvestorFilters(
  startup: Startup,
  investor: Investor,
  visibilityTier: VisibilityTier,
): FilterResult {
  const failed: string[] = [];

  if (!investor.isActive) {
    failed.push("Investor is inactive");
  }

  if (visibilityTier === "hidden" || visibilityTier === "review_required") {
    failed.push(`Startup visibility tier is "${visibilityTier}"`);
  }

  // Stage match
  if (startup.stage && investor.stages.length > 0 && !investor.stages.includes(startup.stage)) {
    failed.push(`Stage mismatch: startup is ${startup.stage}, investor wants ${investor.stages.join(", ")}`);
  }

  // Sector match
  if (startup.industry && investor.sectors.length > 0) {
    const norm = (s: string) => s.trim().toLowerCase();
    const match = investor.sectors.some((sec) => norm(sec) === norm(startup.industry!));
    if (!match) {
      failed.push(`Sector mismatch: startup is ${startup.industry}, investor wants ${investor.sectors.join(", ")}`);
    }
  }

  // Check size fit
  if (startup.raiseAmount !== null && investor.checkMax > 0) {
    if (startup.raiseAmount < investor.checkMin * 0.5 || startup.raiseAmount > investor.checkMax * 3) {
      failed.push(
        `Check size mismatch: raising ${startup.raiseAmount}, investor range ${investor.checkMin}–${investor.checkMax}`,
      );
    }
  }

  // Geography fit
  if (startup.location && investor.geographies.length > 0) {
    const loc = startup.location.toLowerCase();
    const geoMatch = investor.geographies.some((g) => loc.includes(g.toLowerCase()));
    if (!geoMatch) {
      failed.push(`Geography mismatch: startup in ${startup.location}`);
    }
  }

  // Traction requirement
  if (investor.tractionRequirement.requiresProof) {
    const hasTraction =
      (startup.traction.revenue !== null && startup.traction.revenue > 0) ||
      (startup.traction.users !== null && startup.traction.users > 0) ||
      startup.traction.proofUrl !== null;
    if (!hasTraction) {
      failed.push("Investor requires traction proof; none found");
    }
  }
  if (investor.tractionRequirement.minRevenue !== null) {
    if ((startup.traction.revenue ?? 0) < investor.tractionRequirement.minRevenue) {
      failed.push(
        `Revenue below investor minimum ($${investor.tractionRequirement.minRevenue})`,
      );
    }
  }
  if (investor.tractionRequirement.minUsers !== null) {
    if ((startup.traction.users ?? 0) < investor.tractionRequirement.minUsers) {
      failed.push(
        `Users below investor minimum (${investor.tractionRequirement.minUsers})`,
      );
    }
  }

  return { passes: failed.length === 0, failedReasons: failed };
}

// ─── 6. Match scoring ───────────────────────────────────────────────────────

const MATCH_WEIGHTS = {
  stageFit: 0.25,
  sectorFit: 0.25,
  checkSizeFit: 0.20,
  geographyFit: 0.10,
  tractionFit: 0.10,
  profileQuality: 0.05,
  trustBonus: 0.05,
} as const;

export function calculateMatchScore(
  startup: Startup,
  investor: Investor,
  profileQualityScore: number,
  trustScore: number,
): MatchScoreResult {
  const stageFit = computeStageFit(startup, investor);
  const sectorFit = computeSectorFit(startup, investor);
  const checkSizeFit = computeCheckSizeFit(startup, investor);
  const geographyFit = computeGeographyFit(startup, investor);
  const tractionFit = computeTractionFit(startup, investor);
  const profileQuality = profileQualityScore / 100;
  const trustBonus = trustScore / 100;

  const raw =
    stageFit * MATCH_WEIGHTS.stageFit +
    sectorFit * MATCH_WEIGHTS.sectorFit +
    checkSizeFit * MATCH_WEIGHTS.checkSizeFit +
    geographyFit * MATCH_WEIGHTS.geographyFit +
    tractionFit * MATCH_WEIGHTS.tractionFit +
    profileQuality * MATCH_WEIGHTS.profileQuality +
    trustBonus * MATCH_WEIGHTS.trustBonus;

  const matchScore = Math.round(raw * 100);

  return {
    matchScore: clamp(matchScore, 0, 100),
    scoreBreakdown: {
      stageFit: round2(stageFit),
      sectorFit: round2(sectorFit),
      checkSizeFit: round2(checkSizeFit),
      geographyFit: round2(geographyFit),
      tractionFit: round2(tractionFit),
      profileQuality: round2(profileQuality),
      trustBonus: round2(trustBonus),
    },
  };
}

function computeStageFit(startup: Startup, investor: Investor): number {
  if (!startup.stage || investor.stages.length === 0) return 0;
  if (investor.stages.includes(startup.stage)) return 1;

  // Partial credit for adjacent stages
  const stageOrder = ["idea", "pre_seed", "seed", "series_a", "series_b_plus"] as const;
  const startupIdx = stageOrder.indexOf(startup.stage);
  const distances = investor.stages.map((s) => Math.abs(stageOrder.indexOf(s) - startupIdx));
  const minDist = Math.min(...distances);
  if (minDist === 1) return 0.5;
  if (minDist === 2) return 0.2;
  return 0;
}

function computeSectorFit(startup: Startup, investor: Investor): number {
  if (!startup.industry || investor.sectors.length === 0) return 0;
  const norm = (s: string) => s.trim().toLowerCase();
  const target = norm(startup.industry);

  if (investor.sectors.some((s) => norm(s) === target)) return 1;

  // Partial credit if the startup has multiple industries and any match
  if (startup.industries.length > 0) {
    const anyMatch = startup.industries.some((ind) =>
      investor.sectors.some((s) => norm(s) === norm(ind)),
    );
    if (anyMatch) return 0.7;
  }
  return 0;
}

function computeCheckSizeFit(startup: Startup, investor: Investor): number {
  if (startup.raiseAmount === null || investor.checkMax <= 0) return 0;
  const raise = startup.raiseAmount;
  if (raise >= investor.checkMin && raise <= investor.checkMax) return 1;

  // Soft decay outside range
  if (raise < investor.checkMin) {
    const ratio = raise / investor.checkMin;
    return Math.max(0, ratio);
  }
  const ratio = investor.checkMax / raise;
  return Math.max(0, ratio);
}

function computeGeographyFit(startup: Startup, investor: Investor): number {
  if (!startup.location || investor.geographies.length === 0) return 0;
  const loc = startup.location.toLowerCase();
  if (investor.geographies.some((g) => loc.includes(g.toLowerCase()))) return 1;
  // "Remote" or "Global" is a soft match
  if (loc.includes("remote") || loc.includes("global")) return 0.6;
  return 0;
}

function computeTractionFit(startup: Startup, investor: Investor): number {
  const t = startup.traction;
  const req = investor.tractionRequirement;
  let score = 0;
  let checks = 0;

  if (req.minRevenue !== null) {
    checks++;
    if ((t.revenue ?? 0) >= req.minRevenue) score++;
    else if (t.revenue !== null) score += t.revenue / req.minRevenue;
  }
  if (req.minUsers !== null) {
    checks++;
    if ((t.users ?? 0) >= req.minUsers) score++;
    else if (t.users !== null) score += t.users / req.minUsers;
  }
  if (req.requiresProof) {
    checks++;
    if (t.proofUrl || (t.revenue !== null && t.revenue > 0)) score++;
  }

  if (checks === 0) {
    // No traction requirements — give partial credit for having any traction
    if (t.revenue !== null || t.users !== null) return 0.7;
    return 0.3;
  }
  return clamp(score / checks, 0, 1);
}

// ─── 7. Match explanation ───────────────────────────────────────────────────

export function generateMatchExplanation(
  startup: Startup,
  investor: Investor,
  scoreBreakdown: ScoreBreakdown,
  trustTier: TrustTier,
  visibilityTier: VisibilityTier,
): MatchExplanation {
  const whyTheyMatch: string[] = [];
  const potentialRedFlags: string[] = [];

  if (scoreBreakdown.stageFit >= 0.8) {
    whyTheyMatch.push(`Stage alignment: ${startup.stage} matches investor preference`);
  }
  if (scoreBreakdown.sectorFit >= 0.7) {
    whyTheyMatch.push(`Sector match: ${startup.industry} aligns with investor thesis`);
  }
  if (scoreBreakdown.checkSizeFit >= 0.8) {
    whyTheyMatch.push(
      `Check size compatible: raising $${formatAmount(startup.raiseAmount)} within ${investor.firm ?? "investor"}'s range`,
    );
  }
  if (scoreBreakdown.geographyFit >= 0.8) {
    whyTheyMatch.push(`Geography fit: ${startup.location} covered`);
  }
  if (scoreBreakdown.tractionFit >= 0.7) {
    whyTheyMatch.push("Traction meets or exceeds investor requirements");
  }
  if (scoreBreakdown.profileQuality >= 0.8) {
    whyTheyMatch.push("Strong, complete startup profile");
  }

  // Fallback if nothing scored high but overall still passed filters
  if (whyTheyMatch.length === 0) {
    whyTheyMatch.push("Moderate overall alignment across multiple criteria");
  }

  // Red flags
  if (scoreBreakdown.stageFit < 0.5 && scoreBreakdown.stageFit > 0) {
    potentialRedFlags.push("Stage is adjacent but not a direct match");
  }
  if (scoreBreakdown.checkSizeFit < 0.6 && scoreBreakdown.checkSizeFit > 0) {
    potentialRedFlags.push("Raise amount is outside investor's typical range");
  }
  if (trustTier === "basic_verified") {
    potentialRedFlags.push("Startup has limited verification signals");
  }
  if (trustTier === "unverified") {
    potentialRedFlags.push("Startup is unverified — proceed with caution");
  }
  if (visibilityTier === "limited") {
    potentialRedFlags.push("Profile has limited visibility due to incomplete data");
  }
  if (startup.platformBehavior.spamReports > 0) {
    potentialRedFlags.push(`${startup.platformBehavior.spamReports} spam report(s) on record`);
  }

  const trustSummary = buildTrustSummary(trustTier, startup);

  return { whyTheyMatch, potentialRedFlags, trustSummary };
}

function buildTrustSummary(trustTier: TrustTier, startup: Startup): string {
  switch (trustTier) {
    case "fully_verified":
      return `Fully verified startup with strong identity, traction, and platform activity.`;
    case "strong_signals":
      return `Strong verification signals. Founder identity confirmed, meaningful traction evidence present.`;
    case "basic_verified":
      return `Basic verification only. ${startup.name ?? "Startup"} has provided some identity signals but lacks depth.`;
    case "unverified":
      return `Unverified profile. Limited information available — exercise due diligence.`;
  }
}

// ─── 8. Main matching pipeline ──────────────────────────────────────────────

export function matchStartupsToInvestor(
  startups: Startup[],
  investor: Investor,
): MatchedStartup[] {
  const results: MatchedStartup[] = [];

  for (const startup of startups) {
    const trust = calculateStartupTrustScore(startup);
    const quality = calculateProfileQuality(startup);
    const spam = detectSpamSignals(startup);
    const visibility = determineVisibilityTier(
      startup,
      quality.profileQualityScore,
      trust.trustScore,
      spam.spamScore,
    );

    const filter = passesInvestorFilters(startup, investor, visibility.visibilityTier);
    if (!filter.passes) continue;

    const match = calculateMatchScore(startup, investor, quality.profileQualityScore, trust.trustScore);
    const explanation = generateMatchExplanation(
      startup,
      investor,
      match.scoreBreakdown,
      trust.trustTier,
      visibility.visibilityTier,
    );

    results.push({
      startupId: startup.id,
      startupName: startup.name ?? "Unnamed",
      matchScore: match.matchScore,
      trustScore: trust.trustScore,
      trustTier: trust.trustTier,
      profileQualityScore: quality.profileQualityScore,
      spamScore: spam.spamScore,
      visibilityTier: visibility.visibilityTier,
      scoreBreakdown: match.scoreBreakdown,
      whyTheyMatch: explanation.whyTheyMatch,
      potentialRedFlags: explanation.potentialRedFlags,
      trustSummary: explanation.trustSummary,
    });
  }

  // Sort: matchScore DESC, trustScore DESC, profileQuality DESC, recent activity DESC
  results.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    if (b.trustScore !== a.trustScore) return b.trustScore - a.trustScore;
    if (b.profileQualityScore !== a.profileQualityScore) return b.profileQualityScore - a.profileQualityScore;
    // Recent activity: find original startup by id for lastActiveAt comparison
    const startupA = startups.find((s) => s.id === a.startupId);
    const startupB = startups.find((s) => s.id === b.startupId);
    const dateA = startupA?.platformBehavior.lastActiveAt ?? "";
    const dateB = startupB?.platformBehavior.lastActiveAt ?? "";
    return dateB.localeCompare(dateA);
  });

  return results;
}

// ─── Utility helpers ────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function trustTierFromScore(score: number): TrustTier {
  if (score >= 85) return "fully_verified";
  if (score >= 65) return "strong_signals";
  if (score >= 40) return "basic_verified";
  return "unverified";
}

function isCompanyEmail(email: string): boolean {
  const freeProviders = [
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "protonmail.com", "icloud.com", "mail.com", "aol.com",
  ];
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return !freeProviders.includes(domain);
}

function isSuspiciousUrl(url: string): boolean {
  return SUSPICIOUS_TLD_PATTERNS.some((p) => p.test(url));
}

function metricsRealisticForStage(startup: Startup): boolean {
  const stage = startup.stage;
  const revenue = startup.traction.revenue ?? 0;
  const users = startup.traction.users ?? 0;

  switch (stage) {
    case "idea":
      return revenue <= 50_000 && users <= 5_000;
    case "pre_seed":
      return revenue <= 500_000 && users <= 50_000;
    case "seed":
      return revenue <= 3_000_000 && users <= 500_000;
    case "series_a":
      return revenue <= 20_000_000 && users <= 5_000_000;
    case "series_b_plus":
      return true;
    default:
      return true;
  }
}

function hasRepeatedText(text: string): boolean {
  if (!text || text.length < 40) return false;
  // Check if any 20+ char substring repeats
  const words = text.split(/\s+/);
  if (words.length < 6) return false;
  const trigrams = new Set<string>();
  for (let i = 0; i < words.length - 2; i++) {
    const tri = `${words[i]} ${words[i + 1]} ${words[i + 2]}`.toLowerCase();
    if (trigrams.has(tri)) return true;
    trigrams.add(tri);
  }
  return false;
}

function countBuzzwords(text: string): number {
  const lower = text.toLowerCase();
  return BUZZWORDS.filter((b) => lower.includes(b)).length;
}

function formatAmount(amount: number | null): string {
  if (amount === null) return "N/A";
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return String(amount);
}
