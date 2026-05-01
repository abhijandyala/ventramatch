/**
 * Adapts mock recommendation profiles into the production FeedStartupCard
 * and FeedInvestorCard shapes so the /feed and /matches pages can render
 * them through the existing FeedCard component.
 *
 * TEMPORARY — this exists so the product can be demoed with realistic data
 * before real users are in the system. Remove once the database has enough
 * verified profiles to fill the feed organically.
 *
 * The simulated MatchResult scores are deterministic heuristics, not the
 * real scoreMatch() output. They look plausible on the card but are not
 * representative of the real matching algorithm.
 */

import type { FeedStartupCard, FeedInvestorCard } from "@/lib/feed/query";
import type { StartupPublic, InvestorPublic } from "@/lib/profile/visibility";
import type { MatchResult } from "@/lib/matching/score";
import type { StartupStage } from "@/types/database";
import { MOCK_STARTUPS, MOCK_INVESTORS } from "./mock-profiles";
import type {
  InvestorRecommendation,
  StartupRecommendation,
} from "./types";

const STAGE_MAP: Record<string, StartupStage> = {
  idea: "idea",
  pre_seed: "pre_seed",
  seed: "seed",
  series_a: "series_a",
  series_b_plus: "series_b_plus",
};

function mapStage(s: string): StartupStage {
  return STAGE_MAP[s] ?? "seed";
}

function simMatchResult(index: number, total: number): MatchResult {
  const base = 92 - Math.floor((index / total) * 40);
  const score = Math.max(48, Math.min(98, base + ((index * 7) % 11) - 5));
  return {
    score,
    reason: reasonForScore(score),
    breakdown: {
      sector: Math.min(1, 0.5 + (score - 50) / 100),
      stage: Math.min(1, 0.4 + (score - 50) / 100),
      check: Math.min(1, 0.3 + (score - 50) / 100),
      geography: 0.6,
      traction: Math.min(1, 0.5 + (score - 50) / 100),
      process: 0.5,
    },
  };
}

function reasonForScore(score: number): string {
  if (score >= 85) return "Strong alignment on sector, stage, and thesis.";
  if (score >= 75) return "Good overlap on most key signals.";
  if (score >= 65) return "Moderate alignment — worth exploring.";
  return "Some shared signals. Review the profile for fit.";
}

function toStartupPublic(p: StartupRecommendation): StartupPublic {
  const raise = parseFloat(p.fundingAsk.replace(/[^0-9.]/g, "")) || 0;
  const bucket = raise >= 10 ? "large" : raise >= 2 ? "medium" : "small";

  return {
    id: p.id,
    userId: p.id,
    name: p.name,
    oneLiner: p.tagline,
    industry: p.sector,
    stage: mapStage(p.stage),
    raiseBucket: bucket as "small" | "medium" | "large",
    location: p.location,
    website: p.websitePlaceholder,
    deckUrl: "",
    raiseAmount: null,
    traction: null,
  };
}

function checkBand(range: string): "angel" | "small" | "mid" | "large" {
  const num = parseFloat(range.replace(/[^0-9.]/g, "")) || 0;
  if (num < 0.1) return "angel";
  if (num < 1) return "small";
  if (num < 5) return "mid";
  return "large";
}

function toInvestorPublic(p: InvestorRecommendation): InvestorPublic {
  return {
    id: p.id,
    userId: p.id,
    name: p.name,
    firm: p.investorType === "firm" ? p.name : null,
    checkBand: checkBand(p.checkRange),
    stages: p.stages.map(mapStage),
    sectors: p.sectors,
    geographies: [p.geography],
    isActive: true,
    thesisPreview: p.thesis.slice(0, 200),
    checkMin: 0,
    checkMax: 0,
    thesis: null,
  };
}

/**
 * Generate mock feed items for the /feed page. Returns items the same
 * shape as the real fetchFeedForFounder / fetchFeedForInvestor output.
 */
export function mockFeedForFounder(): FeedInvestorCard[] {
  return MOCK_INVESTORS.map((p, i) => ({
    card: toInvestorPublic(p),
    match: simMatchResult(i, MOCK_INVESTORS.length),
    viewerAction: null,
  }));
}

export function mockFeedForInvestor(): FeedStartupCard[] {
  return MOCK_STARTUPS.map((p, i) => ({
    card: toStartupPublic(p),
    match: simMatchResult(i, MOCK_STARTUPS.length),
    viewerAction: null,
  }));
}

/**
 * Generate simulated mutual matches for the /matches page.
 * Returns a subset (6 items) to simulate having some mutual interest.
 */
export type MockMutualMatch = {
  matchId: string;
  targetUserId: string;
  targetName: string;
  targetFirm: string | null;
  targetOneLiner: string | null;
  targetIndustry: string | null;
  targetStage: string | null;
  targetSectors: string[];
  matchScore: number;
  matchedAt: Date;
  avatarSrc: string | null;
  hasIntro: boolean;
};

export function mockMutualMatchesForFounder(): MockMutualMatch[] {
  return MOCK_INVESTORS.slice(0, 6).map((p, i) => ({
    matchId: `mock-match-f-${i}`,
    targetUserId: p.id,
    targetName: p.name,
    targetFirm: p.investorType === "firm" ? p.name : null,
    targetOneLiner: p.tagline,
    targetIndustry: null,
    targetStage: null,
    targetSectors: p.sectors,
    matchScore: 90 - i * 5,
    matchedAt: new Date(Date.now() - i * 86_400_000),
    avatarSrc: null,
    hasIntro: i === 0,
  }));
}

export function mockMutualMatchesForInvestor(): MockMutualMatch[] {
  return MOCK_STARTUPS.slice(0, 6).map((p, i) => ({
    matchId: `mock-match-i-${i}`,
    targetUserId: p.id,
    targetName: p.name,
    targetFirm: null,
    targetOneLiner: p.tagline,
    targetIndustry: p.sector,
    targetStage: p.stage,
    targetSectors: [p.sector],
    matchScore: 90 - i * 5,
    matchedAt: new Date(Date.now() - i * 86_400_000),
    avatarSrc: null,
    hasIntro: i === 0,
  }));
}
