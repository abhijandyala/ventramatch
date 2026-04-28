/**
 * Match score v1. Weighted compatibility between a startup and an investor.
 *
 * Spec lives in docs/matching-algorithm.md. Disclaimer: this is a heuristic.
 * It is informational and is never investment advice.
 */

import type { Investor, Startup, StartupStage } from "@/types/database";

const WEIGHTS = {
  sector: 0.3,
  stage: 0.25,
  check: 0.2,
  geography: 0.15,
  traction: 0.1,
} as const;

export interface MatchResult {
  /** 0–100 integer percent. */
  score: number;
  /** One-line, human-readable rationale. Plain English; no marketing words. */
  reason: string;
  /** Breakdown for debugging and dashboard display. Each sub is 0..1. */
  breakdown: {
    sector: number;
    stage: number;
    check: number;
    geography: number;
    traction: number;
  };
}

export function scoreMatch(startup: Startup, investor: Investor): MatchResult {
  const sector = sectorScore(startup.industry, investor.sectors);
  const stage = stageScore(startup.stage, investor.stages);
  const check = checkScore(startup.raise_amount, investor.check_min, investor.check_max);
  const geography = geographyScore(startup.location, investor.geographies);
  const traction = tractionScore(startup.traction);

  const raw =
    sector * WEIGHTS.sector +
    stage * WEIGHTS.stage +
    check * WEIGHTS.check +
    geography * WEIGHTS.geography +
    traction * WEIGHTS.traction;

  const score = Math.round(raw * 100);
  const reason = buildReason({ sector, stage, check, geography, traction }, investor);

  return {
    score,
    reason,
    breakdown: { sector, stage, check, geography, traction },
  };
}

function sectorScore(startupIndustry: string, investorSectors: string[]): number {
  if (investorSectors.length === 0) return 0;
  const norm = (s: string) => s.trim().toLowerCase();
  const target = norm(startupIndustry);
  return investorSectors.some((s) => norm(s) === target) ? 1 : 0;
}

function stageScore(startupStage: StartupStage, investorStages: StartupStage[]): number {
  if (investorStages.length === 0) return 0;
  return investorStages.includes(startupStage) ? 1 : 0;
}

function checkScore(
  raiseAmount: number | null,
  checkMin: number,
  checkMax: number,
): number {
  if (raiseAmount == null || checkMax <= 0) return 0;
  if (raiseAmount >= checkMin && raiseAmount <= checkMax) return 1;
  // Soft falloff if outside band
  const distance =
    raiseAmount < checkMin ? (checkMin - raiseAmount) / checkMin : (raiseAmount - checkMax) / checkMax;
  return Math.max(0, 1 - distance);
}

function geographyScore(startupLocation: string | null, investorGeos: string[]): number {
  if (!startupLocation || investorGeos.length === 0) return 0;
  const target = startupLocation.toLowerCase();
  return investorGeos.some((g) => target.includes(g.toLowerCase())) ? 1 : 0.4;
}

function tractionScore(traction: string | null): number {
  // v1 stub: presence + length signal. Replace with parsed metrics in v1.1.
  if (!traction) return 0;
  const len = traction.trim().length;
  if (len >= 240) return 1;
  if (len >= 80) return 0.6;
  if (len > 0) return 0.3;
  return 0;
}

function buildReason(parts: MatchResult["breakdown"], investor: Investor): string {
  const reasons: string[] = [];
  if (parts.sector === 1 && investor.sectors[0]) reasons.push(`invests in ${investor.sectors[0]}`);
  if (parts.stage === 1 && investor.stages[0]) reasons.push(`backs ${stageLabel(investor.stages[0])}`);
  if (parts.check === 1) reasons.push(`check size fits`);
  if (parts.geography >= 1) reasons.push(`covers your geography`);
  if (parts.traction === 1) reasons.push(`traction reads strong`);

  if (reasons.length === 0) return "Low overall fit. Improve profile or check filters.";
  return reasons.slice(0, 2).join(" and ").replace(/^\w/, (c) => c.toUpperCase()) + ".";
}

function stageLabel(stage: StartupStage): string {
  switch (stage) {
    case "idea":
      return "idea-stage";
    case "pre_seed":
      return "pre-seed";
    case "seed":
      return "seed";
    case "series_a":
      return "Series A";
    case "series_b_plus":
      return "Series B+";
  }
}
