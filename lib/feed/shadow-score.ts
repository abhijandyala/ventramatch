/**
 * lib/feed/shadow-score.ts
 *
 * Phase 15 shadow scorer — computes ML model scores for feed candidates
 * without affecting feed ordering or user-visible behaviour.
 *
 * ─── PURPOSE ─────────────────────────────────────────────────────────────────
 * Logs model_score to feed_impressions so future A/B analysis can compare
 * the Phase 11c LogReg champion against scoreMatch's heuristic on real traffic.
 * The model score never re-ranks or filters the feed.
 *
 * ─── NOTICE ──────────────────────────────────────────────────────────────────
 * • Offline experimental model.  Not investment advice.
 * • Does not predict startup success or investment returns.
 * • scoreMatch in lib/matching/score.ts is the active production ranker.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Architecture:
 *   1. Uses a service-role DB query (withUserRls(null, …)) to fetch the viewer's
 *      own row + the raw target rows (startup or investor, depending on role).
 *   2. Calls computeProductionMatchFeatures() for each pair.
 *   3. Calls scoreWithLearningModel() for each feature vector.
 *   4. Returns a Map<targetUserId, result|null>.
 *   5. All errors are caught internally — this function NEVER throws.
 *
 * The raw rows are fetched here because the feed pages receive projected
 * StartupPublic / InvestorPublic cards that omit fields needed for scoring
 * (raise_amount, startup_sectors, check_min/check_max, traction text, etc.).
 */

import { withUserRls } from "@/lib/db";
import { computeProductionMatchFeatures } from "@/lib/matching/production-features";
import { scoreWithLearningModel, COEFFICIENTS_VERSION } from "@/lib/matching/learning-model";
import { evaluateEligibility } from "@/lib/matching/eligibility";
import type { EligibilityResult } from "@/lib/matching/eligibility";
import { loadAntiThesisForInvestors } from "@/lib/matching/runtime/anti-pattern-adapter";
import type { SyntheticAntiThesis } from "@/lib/matching/features";

// ── Minimal row shapes (avoids importing @/types/database in this module) ────

type RawStartupRow = {
  user_id: string;
  startup_sectors: string[];
  industry: string;
  stage: string;
  raise_amount: number | null;
  traction: string | null;
  location: string | null;
  customer_type: string | null;
};

type RawInvestorRow = {
  user_id: string;
  sectors: string[];
  stages: string[];
  check_min: number;
  check_max: number;
  geographies: string[];
};

// ── Result types ─────────────────────────────────────────────────────────────

export type ShadowScoreEntry = {
  modelScore: number;
  modelVersion: string;
  /** Phase 16: hard eligibility result computed alongside model scoring. */
  eligibility: EligibilityResult;
} | null;

/** Map from target user ID to model score result (null = failed to score). */
export type ShadowScoreMap = Map<string, ShadowScoreEntry>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreStartupForInvestor(
  startup: RawStartupRow,
  investor: RawInvestorRow,
  antiThesis?: SyntheticAntiThesis | null,
): ShadowScoreEntry {
  try {
    const features = computeProductionMatchFeatures(startup, investor, undefined, antiThesis);
    const eligibility = evaluateEligibility(features);
    const result = scoreWithLearningModel(features);
    if (!result) return null;
    return { modelScore: result.score, modelVersion: result.version, eligibility };
  } catch {
    return null;
  }
}

function scoreInvestorForFounder(
  startup: RawStartupRow,
  investor: RawInvestorRow,
  antiThesis?: SyntheticAntiThesis | null,
): ShadowScoreEntry {
  // For founder-views, the investor's anti-thesis is evaluated against the
  // founder's own startup — same computation, same column access.
  return scoreStartupForInvestor(startup, investor, antiThesis);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute shadow model scores for every target user in `targetUserIds`.
 *
 * @param actorUserId   The viewing user's ID.
 * @param actorRole     "investor" = actor views startups; "founder" = actor views investors.
 * @param targetUserIds Target user IDs as they appear in the ordered feed.
 *
 * @returns ShadowScoreMap — always resolves, never rejects.  Missing entries
 *          (null or absent) mean the pair could not be scored and should be
 *          logged with model_score = null.
 *
 * Safety guarantees:
 *   • This function never throws.
 *   • If the DB query fails, returns an empty Map (all pairs → null).
 *   • If individual pair scoring fails, the entry is null.
 *   • No feed ordering change.  No scoreMatch mutation.  No user-visible effect.
 */
export async function computeShadowScores(params: {
  actorUserId: string;
  actorRole: "investor" | "founder";
  targetUserIds: string[];
}): Promise<ShadowScoreMap> {
  const { actorUserId, actorRole, targetUserIds } = params;
  const result: ShadowScoreMap = new Map();

  if (targetUserIds.length === 0) return result;

  try {
    if (actorRole === "investor") {
      // Actor is an investor → targets are startups.
      await withUserRls(null, async (sql) => {
        const investorRows = await sql<RawInvestorRow[]>`
          select user_id, sectors, stages, check_min, check_max, geographies
          from public.investors
          where user_id = ${actorUserId}
          limit 1
        `;
        const investor = investorRows[0];
        if (!investor) return;

        // Phase 17: load anti-thesis for the acting investor in the same transaction.
        const antiThesisMap = await loadAntiThesisForInvestors(sql, [actorUserId]);
        const antiThesis = antiThesisMap.get(actorUserId) ?? null;

        const startupRows = await sql<RawStartupRow[]>`
          select user_id, startup_sectors, industry, stage, raise_amount, traction,
                 location, customer_type
          from public.startups
          where user_id = any(${targetUserIds})
        `;

        const startupMap = new Map(startupRows.map((r) => [r.user_id, r]));

        for (const targetId of targetUserIds) {
          const startup = startupMap.get(targetId);
          result.set(targetId, startup ? scoreStartupForInvestor(startup, investor, antiThesis) : null);
        }
      });
    } else {
      // Actor is a founder → targets are investors.
      await withUserRls(null, async (sql) => {
        const startupRows = await sql<RawStartupRow[]>`
          select user_id, startup_sectors, industry, stage, raise_amount, traction,
                 location, customer_type
          from public.startups
          where user_id = ${actorUserId}
          limit 1
        `;
        const startup = startupRows[0];
        if (!startup) return;

        const investorRows = await sql<RawInvestorRow[]>`
          select user_id, sectors, stages, check_min, check_max, geographies
          from public.investors
          where user_id = any(${targetUserIds})
        `;

        // Phase 17: load anti-thesis for each target investor in the same transaction.
        const antiThesisMap = await loadAntiThesisForInvestors(sql, targetUserIds);

        const investorMap = new Map(investorRows.map((r) => [r.user_id, r]));

        for (const targetId of targetUserIds) {
          const investor = investorMap.get(targetId);
          const antiThesis = antiThesisMap.get(targetId) ?? null;
          result.set(
            targetId,
            investor ? scoreInvestorForFounder(startup, investor, antiThesis) : null,
          );
        }
      });
    }
  } catch (err) {
    // DB failure — return empty map (all impressions logged with model_score = null).
    console.error(
      `[shadow-score] DB query failed actor=${actorUserId} role=${actorRole}:`,
      err instanceof Error ? err.message : "unknown error",
    );
  }

  return result;
}

/** Version string from the coefficient file — for use at call sites. */
export { COEFFICIENTS_VERSION as MODEL_VERSION };
