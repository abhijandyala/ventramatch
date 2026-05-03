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
import type { FeedFilters } from "@/lib/feed/filters";
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
    videoUrl: p.videoUrl ?? null,
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
    videoUrl: null,
  };
}

/**
 * Generate mock feed items for the /feed page. Returns items the same
 * shape as the real fetchFeedForFounder / fetchFeedForInvestor output.
 *
 * When filters are provided, applies sort + basic text/sector/stage/geo
 * filtering so the filter panel is functional on mock data.
 */
export function mockFeedForFounder(filters?: FeedFilters): FeedInvestorCard[] {
  let items: FeedInvestorCard[] = MOCK_INVESTORS.map((p, i) => ({
    card: toInvestorPublic(p),
    match: simMatchResult(i, MOCK_INVESTORS.length),
    viewerAction: null,
  }));

  if (filters) {
    const q = filters.q?.toLowerCase();
    items = items.filter(({ card }) => {
      const p = MOCK_INVESTORS.find((x) => x.id === card.userId)!;
      if (q && !p.name.toLowerCase().includes(q) && !p.thesis.toLowerCase().includes(q)) return false;
      if (filters.industries.length > 0 && !filters.industries.some((ind) => p.sectors.some((s) => s.toLowerCase() === ind.toLowerCase()))) return false;
      if (filters.stages.length > 0 && !filters.stages.some((st) => p.stages.map(mapStage).includes(st))) return false;
      if (filters.geographies.length > 0 && !filters.geographies.some((geo) => p.geography.toLowerCase().includes(geo.toLowerCase()))) return false;
      return true;
    });
  }

  // Always sort by score descending (default); preserve original order for "recent"
  // since mock profiles have no real created_at.
  if (!filters || filters.sort !== "recent") {
    items.sort((a, b) => b.match.score - a.match.score);
  }

  return items;
}

export function mockFeedForInvestor(filters?: FeedFilters): FeedStartupCard[] {
  let items: FeedStartupCard[] = MOCK_STARTUPS.map((p, i) => ({
    card: toStartupPublic(p),
    match: simMatchResult(i, MOCK_STARTUPS.length),
    viewerAction: null,
  }));

  if (filters) {
    const q = filters.q?.toLowerCase();
    items = items.filter(({ card }) => {
      const p = MOCK_STARTUPS.find((x) => x.id === card.userId)!;
      if (q && !p.name.toLowerCase().includes(q) && !p.tagline.toLowerCase().includes(q)) return false;
      if (filters.industries.length > 0 && !filters.industries.some((ind) => p.sector.toLowerCase() === ind.toLowerCase())) return false;
      if (filters.stages.length > 0 && !filters.stages.includes(mapStage(p.stage))) return false;
      if (filters.geographies.length > 0 && !filters.geographies.some((geo) => p.location.toLowerCase().includes(geo.toLowerCase()))) return false;
      return true;
    });
  }

  if (!filters || filters.sort !== "recent") {
    items.sort((a, b) => b.match.score - a.match.score);
  }

  return items;
}

/**
 * Generate simulated mutual matches for the /matches page.
 * Returns a subset (6 items) to simulate having some mutual interest.
 */
export type MatchBreakdown = {
  sector: number;
  stage: number;
  check: number;
  geography: number;
  traction: number;
  process: number;
};

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
  matchBreakdown: MatchBreakdown;
  matchedAt: Date;
  avatarSrc: string | null;
  hasIntro: boolean;
};

// Deterministic breakdown seeded off the total score so bars look coherent
// with the headline percentage but each dimension varies plausibly.
function simBreakdown(score: number, seed: number): MatchBreakdown {
  const s = score / 100;
  const j = (n: number) => Math.max(0, Math.min(1, s + ((seed * n * 13) % 17) / 100 - 0.08));
  return {
    sector: j(1),
    stage: j(2),
    check: j(3),
    geography: j(4),
    traction: j(5),
    process: j(6),
  };
}

export function mockMutualMatchesForFounder(): MockMutualMatch[] {
  return MOCK_INVESTORS.slice(0, 6).map((p, i) => {
    const score = 90 - i * 5;
    return {
      matchId: `mock-match-f-${i}`,
      targetUserId: p.id,
      targetName: p.name,
      targetFirm: p.investorType === "firm" ? p.name : null,
      targetOneLiner: p.tagline,
      targetIndustry: null,
      targetStage: null,
      targetSectors: p.sectors,
      matchScore: score,
      matchBreakdown: simBreakdown(score, i + 1),
      matchedAt: new Date(Date.now() - i * 86_400_000),
      avatarSrc: null,
      hasIntro: i === 0,
    };
  });
}

export function mockMutualMatchesForInvestor(): MockMutualMatch[] {
  return MOCK_STARTUPS.slice(0, 6).map((p, i) => {
    const score = 90 - i * 5;
    return {
      matchId: `mock-match-i-${i}`,
      targetUserId: p.id,
      targetName: p.name,
      targetFirm: null,
      targetOneLiner: p.tagline,
      targetIndustry: p.sector,
      targetStage: p.stage,
      targetSectors: [p.sector],
      matchScore: score,
      matchBreakdown: simBreakdown(score, i + 1),
      matchedAt: new Date(Date.now() - i * 86_400_000),
      avatarSrc: null,
      hasIntro: i === 0,
    };
  });
}
