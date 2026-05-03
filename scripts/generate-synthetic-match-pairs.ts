/**
 * scripts/generate-synthetic-match-pairs.ts
 *
 * Synthetic founder–investor matching data pipeline.
 * Run with: npx tsx scripts/generate-synthetic-match-pairs.ts
 *
 * ─── NOTICE ──────────────────────────────────────────────────────────────────
 * This script generates a synthetic labeled dataset for algorithm development.
 *
 * - All startup and investor profiles are entirely fictional.
 * - The output (pairs.json) is NOT real user data.
 * - Labels and scores are NOT investment advice.
 * - Labels do NOT predict startup success or expected investment returns.
 * - Labels represent profile-fit and intro relevance between synthetic profiles
 *   only. A label of 4 (excellent fit) means the synthetic profiles align well
 *   on structure — not that any real investment should be made.
 * - Do not import pairs.json into any production system.
 * - Do not present this dataset as a sample of real VentraMatch users.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Thresholds are defined as named constants below and are tunable. If the
 * realized distribution drifts outside the target, adjust THRESHOLDS only —
 * do not change the feature weights, which are fixed by the sprint spec.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

import {
  computeMatchFeatures,
  type SyntheticStartup,
  type SyntheticInvestor,
  type MatchFeatures,
  type EmbeddingVector,
} from "../lib/matching/features";

import {
  evaluateEligibility,
  type HardFilterReason,
} from "../lib/matching/eligibility";

// ─── Label metadata ───────────────────────────────────────────────────────────

const LABEL_NAMES = [
  "poor fit",
  "weak fit",
  "possible fit",
  "strong fit",
  "excellent fit",
] as const;

type Label = 0 | 1 | 2 | 3 | 4;

// ─── Feature weights ──────────────────────────────────────────────────────────
// Positive weights sum to 1.00 exactly.
// semantic_similarity_score is excluded from the labeling formula in Phase 7 —
// labels remain derived from structured features only so the distribution stays
// calibrated. The training model uses it as a 12th feature for learning.
// The penalty for anti_thesis_conflict is applied separately.

const WEIGHTS = {
  sector_overlap_score: 0.20,
  stage_match_score: 0.18,
  check_size_score: 0.15,
  interest_overlap_score: 0.12,
  customer_type_overlap_score: 0.10,
  business_model_overlap_score: 0.08,
  geography_score: 0.07,
  lead_follow_score: 0.05,
  traction_strength_score: 0.05,
} as const;

const ANTI_THESIS_PENALTY_WEIGHT = 0.40;

// ─── Label thresholds ─────────────────────────────────────────────────────────
// Tunable. Adjust to keep distribution near target. Do not change WEIGHTS.
//
// Target: ~35–45% poor / ~20–30% weak / ~15–25% possible / ~8–15% strong / ~3–8% excellent
//
// Calibrated against the 35 × 17 = 595 synthetic pairs. The average weighted
// score across all pairs is ~0.46, which is higher than intuition suggests because
// structural features (stage, customer_type, business_model, geography) align
// across many pairs even when sectors differ. These thresholds account for that.
// Validated distribution: 39.5% poor / 23.2% weak / 22.4% possible / 8.9% strong / 6.1% excellent.
// (EXCELLENT_MIN raised from 0.76 to 0.79 and interest_min lowered to 0.25 after
//  pre-Phase-6 quality fixes removed 6 anti-thesis false positives from label 4.)

const THRESHOLDS = {
  WEAK_MIN: 0.44,      // raw < WEAK_MIN               → 0 (poor)
  POSSIBLE_MIN: 0.60,  // WEAK_MIN <= raw < POSSIBLE    → 1 (weak)
  STRONG_MIN: 0.72,    // POSSIBLE_MIN <= raw < STRONG  → 2 (possible)
  EXCELLENT_MIN: 0.79, // STRONG_MIN <= raw < EXCELLENT → 3 (strong)
                       // raw >= EXCELLENT_MIN + all conditions met → 4 (excellent)
} as const;

// ─── Cap thresholds ───────────────────────────────────────────────────────────
// These hard caps prevent clearly incompatible pairs from receiving high labels
// regardless of how other structural features align.

/** anti_thesis_conflict_score >= this → label capped at 1 (weak fit). */
const ANTI_THESIS_CAP = 0.5;

/** check_size_score < this → label capped at 2 (possible fit). */
const CHECK_SIZE_CAP = 0.25;

/** stage_match_score === 0 → label capped at 2 (possible fit). */
// (applied programmatically below — no numeric constant needed)

// ─── Excellent-fit conditions ─────────────────────────────────────────────────
// All conditions must be satisfied to reach label 4. If any fails, the pair
// is treated as strong fit (3) even if the weighted score is >= EXCELLENT_MIN.

const EXCELLENT_COND = {
  sector_min: 0.5,
  stage_exact: 1.0,     // must be an exact match, not just adjacent
  check_min: 0.7,
  customer_type_min: 0.5,
  interest_min: 0.25,   // lowered from 0.4: at least 1 synonym-matched token is sufficient
  anti_thesis_max: 0,   // zero conflict required
  geography_min: 0.5,   // added: regional investors must confirm geographic coverage
} as const;

// ─── Output type ─────────────────────────────────────────────────────────────

interface PairRecord {
  startup_id: string;
  investor_id: string;
  /**
   * Full MatchFeatures object.
   * semantic_similarity_score is a real number when compute_embeddings.py has run;
   * null otherwise. It is never used in the labeling formula (weight = 0).
   */
  features: MatchFeatures;
  label: Label;
  label_name: (typeof LABEL_NAMES)[Label];
  label_reason: string;
  // ── Phase 10: hard eligibility ─────────────────────────────────────────
  // These fields encode policy constraints for the future global ranking model.
  // They are NOT labels and NOT learned features. See lib/matching/eligibility.ts.
  /** True when no hard eligibility constraint is violated. */
  eligible_for_model_ranking: boolean;
  /** Zero or more reasons this pair is ineligible. Empty array when eligible. */
  hard_filter_reasons: HardFilterReason[];
}

// ─── Score computation ────────────────────────────────────────────────────────

function computeWeightedScore(f: MatchFeatures): number {
  // Positive contributions — semantic_similarity_score is excluded from labeling.
  // Labels are calibrated against the 11 structured features only (Phase 7).
  const pos =
    f.sector_overlap_score * WEIGHTS.sector_overlap_score +
    f.stage_match_score * WEIGHTS.stage_match_score +
    f.check_size_score * WEIGHTS.check_size_score +
    f.interest_overlap_score * WEIGHTS.interest_overlap_score +
    f.customer_type_overlap_score * WEIGHTS.customer_type_overlap_score +
    f.business_model_overlap_score * WEIGHTS.business_model_overlap_score +
    f.geography_score * WEIGHTS.geography_score +
    f.lead_follow_score * WEIGHTS.lead_follow_score +
    f.traction_strength_score * WEIGHTS.traction_strength_score;

  return pos - f.anti_thesis_conflict_score * ANTI_THESIS_PENALTY_WEIGHT;
}

function scoreToRawLabel(score: number): Label {
  if (score < THRESHOLDS.WEAK_MIN) return 0;
  if (score < THRESHOLDS.POSSIBLE_MIN) return 1;
  if (score < THRESHOLDS.STRONG_MIN) return 2;
  if (score < THRESHOLDS.EXCELLENT_MIN) return 3;
  return 4;
}

function meetsExcellentConditions(f: MatchFeatures): boolean {
  return (
    f.sector_overlap_score >= EXCELLENT_COND.sector_min &&
    f.stage_match_score === EXCELLENT_COND.stage_exact &&
    f.check_size_score >= EXCELLENT_COND.check_min &&
    f.customer_type_overlap_score >= EXCELLENT_COND.customer_type_min &&
    f.interest_overlap_score >= EXCELLENT_COND.interest_min &&
    f.anti_thesis_conflict_score <= EXCELLENT_COND.anti_thesis_max &&
    f.geography_score >= EXCELLENT_COND.geography_min
  );
}

/**
 * Apply label caps. Returns the final label and a list of cap descriptions.
 * Caps are applied in descending severity; the most restrictive wins.
 */
function applyLabelCaps(
  rawLabel: Label,
  f: MatchFeatures,
): { label: Label; caps: string[] } {
  let label = rawLabel;
  const caps: string[] = [];

  // Anti-thesis cap (most restrictive): significant conflict → label ≤ 1
  if (f.anti_thesis_conflict_score >= ANTI_THESIS_CAP && label > 1) {
    label = 1 as Label;
    caps.push(
      `anti-thesis conflict score ${f.anti_thesis_conflict_score.toFixed(2)} ≥ ${ANTI_THESIS_CAP}`,
    );
  }

  // Stage cap: no stage overlap at all → label ≤ 2
  if (f.stage_match_score === 0 && label > 2) {
    label = 2 as Label;
    caps.push("stage mismatch — no overlap between startup stage and investor stage list");
  }

  // Check size cap: raise amount is far outside investor range → label ≤ 2
  if (f.check_size_score < CHECK_SIZE_CAP && label > 2) {
    label = 2 as Label;
    caps.push(
      `check size score ${f.check_size_score.toFixed(3)} < ${CHECK_SIZE_CAP} — raise amount outside investor check range`,
    );
  }

  return { label, caps };
}

// ─── Label reason builder ─────────────────────────────────────────────────────

function formatMoney(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${amount}`;
}

/**
 * Build a concise, factual label reason. States profile-fit signals only —
 * no investment language, no success predictions.
 */
function buildLabelReason(
  startup: SyntheticStartup,
  investor: SyntheticInvestor,
  f: MatchFeatures,
  rawScore: number,
  rawLabel: Label,
  finalLabel: Label,
  caps: string[],
  excellentConditionsMissed: boolean,
): string {
  const parts: string[] = [];

  // Sector
  if (f.sector_overlap_score === 0) {
    parts.push(
      `No sector overlap (startup [${startup.sectors.join(", ")}] vs investor [${investor.sectors.join(", ")}])`,
    );
  } else if (f.sector_overlap_score >= 1.0) {
    parts.push(`Full sector match (${startup.sectors.join(", ")})`);
  } else {
    parts.push(
      `Partial sector overlap — ${Math.round(f.sector_overlap_score * startup.sectors.length)}/${startup.sectors.length} startup sectors matched`,
    );
  }

  // Stage
  if (f.stage_match_score === 1.0) {
    parts.push(`exact stage match (${startup.stage})`);
  } else if (f.stage_match_score >= 0.5) {
    parts.push(
      `adjacent stage (startup ${startup.stage}; investor [${investor.stages.join(", ")}])`,
    );
  } else if (f.stage_match_score > 0) {
    parts.push(
      `distant stage gap (startup ${startup.stage}; investor [${investor.stages.join(", ")}])`,
    );
  } else {
    parts.push(
      `stage mismatch (startup ${startup.stage}; investor [${investor.stages.join(", ")}])`,
    );
  }

  // Check size
  const raiseStr = formatMoney(startup.raise_amount);
  const rangeStr = `${formatMoney(investor.check_min)}–${formatMoney(investor.check_max)}`;
  if (f.check_size_score >= 0.9) {
    parts.push(`raise ${raiseStr} within check range ${rangeStr}`);
  } else if (f.check_size_score >= 0.5) {
    parts.push(`raise ${raiseStr} close to check range ${rangeStr}`);
  } else {
    const dir = startup.raise_amount > investor.check_max ? "above" : "below";
    parts.push(`raise ${raiseStr} ${dir} check range ${rangeStr}`);
  }

  // Anti-thesis (only if notable)
  if (f.anti_thesis_conflict_score >= ANTI_THESIS_CAP) {
    parts.push(
      `direct anti-thesis conflict (score ${f.anti_thesis_conflict_score.toFixed(2)}) — investor mandate excludes this startup profile`,
    );
  } else if (f.anti_thesis_conflict_score > 0) {
    parts.push(`minor anti-thesis signal (score ${f.anti_thesis_conflict_score.toFixed(2)})`);
  }

  // Traction (only when strong)
  if (f.traction_strength_score >= 0.8) {
    parts.push(`strong traction signal (${startup.traction})`);
  }

  // Label reductions: caps or excellent conditions not met
  if (caps.length > 0) {
    const fromLabel = LABEL_NAMES[rawLabel];
    const toLabel = LABEL_NAMES[finalLabel];
    parts.push(
      `Label capped from "${fromLabel}" to "${toLabel}" — ${caps.join("; ")}`,
    );
  } else if (excellentConditionsMissed && rawLabel === 3 && finalLabel === 3) {
    // Raw score qualified for excellent territory but conditions not met
    const missedConds: string[] = [];
    if (f.sector_overlap_score < EXCELLENT_COND.sector_min)
      missedConds.push(`sector overlap ${f.sector_overlap_score.toFixed(2)} < ${EXCELLENT_COND.sector_min}`);
    if (f.check_size_score < EXCELLENT_COND.check_min)
      missedConds.push(`check size ${f.check_size_score.toFixed(2)} < ${EXCELLENT_COND.check_min}`);
    if (f.interest_overlap_score < EXCELLENT_COND.interest_min)
      missedConds.push(`interest overlap ${f.interest_overlap_score.toFixed(2)} < ${EXCELLENT_COND.interest_min}`);
    if (f.customer_type_overlap_score < EXCELLENT_COND.customer_type_min)
      missedConds.push(`customer type ${f.customer_type_overlap_score.toFixed(2)} < ${EXCELLENT_COND.customer_type_min}`);
    if (f.anti_thesis_conflict_score > EXCELLENT_COND.anti_thesis_max)
      missedConds.push(`anti-thesis conflict ${f.anti_thesis_conflict_score.toFixed(2)} > 0`);
    if (f.geography_score < EXCELLENT_COND.geography_min)
      missedConds.push(`geography score ${f.geography_score.toFixed(2)} < ${EXCELLENT_COND.geography_min}`);
    if (missedConds.length > 0) {
      parts.push(`Near excellent — missed: ${missedConds.slice(0, 2).join(", ")}`);
    }
  }

  return (
    parts.slice(0, 5).join(". ") +
    `. Profile-fit score: ${rawScore.toFixed(3)}.`
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const DATA_DIR = "data/synthetic-matching";
  const EMBEDDINGS_DIR = `${DATA_DIR}/embeddings`;

  // Load synthetic profiles.
  // Assumes the script is run from the project root (npx tsx scripts/...).
  const startups: SyntheticStartup[] = JSON.parse(
    readFileSync(`${DATA_DIR}/startups.json`, "utf-8"),
  );
  const investors: SyntheticInvestor[] = JSON.parse(
    readFileSync(`${DATA_DIR}/investors.json`, "utf-8"),
  );

  // ─── Load pre-computed embeddings (optional) ─────────────────────────────
  // Embeddings are produced by scripts/ml/compute_embeddings.py. When they are
  // not yet available, semantic_similarity_score is null for all pairs. Labels
  // are not affected — the labeling formula does not use semantic similarity.

  let startupEmbeddings: Map<string, EmbeddingVector> = new Map();
  let investorEmbeddings: Map<string, EmbeddingVector> = new Map();
  let embeddingsLoaded = false;

  const embStartupPath = `${EMBEDDINGS_DIR}/startups.json`;
  const embInvestorPath = `${EMBEDDINGS_DIR}/investors.json`;

  if (existsSync(embStartupPath) && existsSync(embInvestorPath)) {
    const rawStartup: Record<string, EmbeddingVector> = JSON.parse(
      readFileSync(embStartupPath, "utf-8"),
    );
    const rawInvestor: Record<string, EmbeddingVector> = JSON.parse(
      readFileSync(embInvestorPath, "utf-8"),
    );
    startupEmbeddings = new Map(Object.entries(rawStartup));
    investorEmbeddings = new Map(Object.entries(rawInvestor));
    embeddingsLoaded = true;
    console.log(
      `Loaded embeddings: ${startupEmbeddings.size} startups, ${investorEmbeddings.size} investors.\n`,
    );
  } else {
    console.warn(
      `⚠  Embeddings not found in ${EMBEDDINGS_DIR}. semantic_similarity_score will be null.\n` +
      `   Run: npm run embeddings:synthetic-matches\n`,
    );
  }

  const totalPairs = startups.length * investors.length;
  console.log(
    `Loaded ${startups.length} startups × ${investors.length} investors = ${totalPairs} pairs.\n`,
  );

  // ─── Generate pairs ─────────────────────────────────────────────────────

  const pairs: PairRecord[] = [];

  // Track pairs where the label was reduced from raw, for reporting.
  const reducedPairs: Array<{
    record: PairRecord;
    rawLabel: Label;
    rawScore: number;
    reason: "excellent_conditions" | "cap";
  }> = [];

  for (const startup of startups) {
    for (const investor of investors) {
      const features = computeMatchFeatures(
        startup,
        investor,
        embeddingsLoaded ? (startupEmbeddings.get(startup.id) ?? null) : null,
        embeddingsLoaded ? (investorEmbeddings.get(investor.id) ?? null) : null,
      );
      const rawScore = computeWeightedScore(features);

      // Clamp score to 0 before label lookup (very negative scores → poor).
      const clampedScore = Math.max(0, rawScore);
      let rawLabel = scoreToRawLabel(clampedScore);

      // If the score qualifies for excellent territory (≥ EXCELLENT_MIN) but the
      // structural conditions are not met, downgrade to strong (3) before caps.
      let excellentConditionsMissed = false;
      if (rawLabel === 4 && !meetsExcellentConditions(features)) {
        rawLabel = 3 as Label;
        excellentConditionsMissed = true;
      }

      // Apply hard caps.
      const { label: finalLabel, caps } = applyLabelCaps(rawLabel, features);

      const labelReason = buildLabelReason(
        startup,
        investor,
        features,
        rawScore,
        rawLabel,
        finalLabel,
        caps,
        excellentConditionsMissed,
      );

      const { eligible_for_model_ranking, hard_filter_reasons } = evaluateEligibility(features);

      const record: PairRecord = {
        startup_id: startup.id,
        investor_id: investor.id,
        features,
        label: finalLabel,
        label_name: LABEL_NAMES[finalLabel],
        label_reason: labelReason,
        eligible_for_model_ranking,
        hard_filter_reasons,
      };

      pairs.push(record);

      if (finalLabel < rawLabel || (rawLabel === 3 && excellentConditionsMissed && rawScore >= THRESHOLDS.EXCELLENT_MIN)) {
        reducedPairs.push({
          record,
          rawLabel,
          rawScore,
          reason: caps.length > 0 ? "cap" : "excellent_conditions",
        });
      }
    }
  }

  // ─── Write output ────────────────────────────────────────────────────────

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(`${DATA_DIR}/pairs.json`, JSON.stringify(pairs, null, 2), "utf-8");
  console.log(`Wrote ${pairs.length} pairs to ${DATA_DIR}/pairs.json\n`);

  // ─── Distribution ────────────────────────────────────────────────────────

  const dist = [0, 0, 0, 0, 0] as [number, number, number, number, number];
  for (const p of pairs) dist[p.label]++;

  const TARGET = [
    "35–45%",
    "20–30%",
    "15–25%",
    " 8–15%",
    "  3–8%",
  ];

  console.log("─── Label distribution ───────────────────────────────────────────────────────");
  for (let i = 0 as Label; i < 5; i++) {
    const count = dist[i];
    const pct = (count / pairs.length) * 100;
    const bar = "█".repeat(Math.round(pct / 2));
    const flag = pct < parseFloat(TARGET[i]) || pct > parseFloat(TARGET[i].split("–")[1])
      ? " ⚠" : "  ";
    console.log(
      `  ${i}  ${LABEL_NAMES[i as Label].padEnd(14)}  ${String(count).padStart(3)} pairs  ${pct.toFixed(1).padStart(5)}%  (target ${TARGET[i]})${flag}  ${bar}`,
    );
  }
  console.log(`     Total              ${pairs.length} pairs\n`);

  // ─── Score statistics ────────────────────────────────────────────────────

  const scores = pairs.map((p) => computeWeightedScore(p.features));
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  console.log("─── Weighted score statistics ────────────────────────────────────────────────");
  console.log(
    `  Min: ${minScore.toFixed(3)}  Max: ${maxScore.toFixed(3)}  Avg: ${avgScore.toFixed(3)}\n`,
  );

  // ─── Semantic similarity statistics (when embeddings are available) ───────

  if (embeddingsLoaded) {
    const simScores = pairs
      .map((p) => p.features.semantic_similarity_score)
      .filter((v): v is number => v !== null);
    if (simScores.length > 0) {
      const simMin = Math.min(...simScores);
      const simMax = Math.max(...simScores);
      const simAvg = simScores.reduce((a, b) => a + b, 0) / simScores.length;
      console.log("─── Semantic similarity statistics ──────────────────────────────────────────");
      console.log(
        `  Min: ${simMin.toFixed(4)}  Max: ${simMax.toFixed(4)}  Avg: ${simAvg.toFixed(4)}  (${simScores.length} pairs with embeddings)\n`,
      );
    }
  }

  // ─── Top excellent pairs ─────────────────────────────────────────────────

  const excellentPairs = pairs.filter((p) => p.label === 4);
  console.log(
    `─── Excellent-fit pairs (${excellentPairs.length} total — showing up to 5) ─────────────────`,
  );
  for (const p of excellentPairs.slice(0, 5)) {
    const s = startups.find((x) => x.id === p.startup_id)!;
    const inv = investors.find((x) => x.id === p.investor_id)!;
    const score = computeWeightedScore(p.features).toFixed(3);
    console.log(`  ${s.name.padEnd(26)}  +  ${inv.name} (${inv.firm})`);
    console.log(`    score=${score}  ${truncate(p.label_reason, 110)}`);
  }
  console.log();

  // ─── Capped pairs ────────────────────────────────────────────────────────

  const cappedOnly = reducedPairs.filter((r) => r.reason === "cap");
  const excellentMissed = reducedPairs.filter((r) => r.reason === "excellent_conditions");

  console.log(
    `─── Capped pairs (${cappedOnly.length} total — showing up to 5) ──────────────────────────`,
  );
  for (const { record, rawLabel, rawScore } of cappedOnly.slice(0, 5)) {
    const s = startups.find((x) => x.id === record.startup_id)!;
    const inv = investors.find((x) => x.id === record.investor_id)!;
    console.log(
      `  ${s.name.padEnd(26)}  +  ${inv.name.padEnd(22)}  ` +
        `raw=${LABEL_NAMES[rawLabel]} (${rawScore.toFixed(3)}) → ${LABEL_NAMES[record.label]}`,
    );
    const capStart = record.label_reason.indexOf("Label capped");
    if (capStart >= 0) {
      console.log(`    ${truncate(record.label_reason.slice(capStart), 105)}`);
    }
  }
  console.log();

  console.log(
    `─── Near-excellent (score ≥ ${THRESHOLDS.EXCELLENT_MIN}, conditions not met — ${excellentMissed.length} total, showing up to 5) ─`,
  );
  for (const { record, rawScore } of excellentMissed.slice(0, 5)) {
    const s = startups.find((x) => x.id === record.startup_id)!;
    const inv = investors.find((x) => x.id === record.investor_id)!;
    console.log(
      `  ${s.name.padEnd(26)}  +  ${inv.name} (${inv.firm})  score=${rawScore.toFixed(3)}`,
    );
    const missStart = record.label_reason.indexOf("Near excellent");
    if (missStart >= 0) {
      console.log(`    ${truncate(record.label_reason.slice(missStart), 105)}`);
    }
  }
  console.log();

  // ─── Hard eligibility summary (Phase 10) ─────────────────────────────────

  const eligibleCount = pairs.filter((p) => p.eligible_for_model_ranking).length;
  const ineligiblePairs = pairs.filter((p) => !p.eligible_for_model_ranking);
  const n = pairs.length;

  const reasonCounts: Record<HardFilterReason, number> = {
    anti_thesis_conflict: 0,
    stage_mismatch: 0,
    check_size_mismatch: 0,
  };
  let multipleReasonCount = 0;
  for (const p of ineligiblePairs) {
    for (const r of p.hard_filter_reasons) reasonCounts[r]++;
    if (p.hard_filter_reasons.length > 1) multipleReasonCount++;
  }

  // Cross-tab: ineligible pairs broken down by label
  const ineligibleByLabel = [0, 0, 0, 0, 0] as [number, number, number, number, number];
  for (const p of ineligiblePairs) ineligibleByLabel[p.label]++;

  console.log("─── Hard eligibility (Phase 10) ──────────────────────────────────────────────");
  console.log(
    `  Eligible for model ranking : ${eligibleCount} / ${n} ` +
    `(${((eligibleCount / n) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  Ineligible                 : ${ineligiblePairs.length} / ${n} ` +
    `(${((ineligiblePairs.length / n) * 100).toFixed(1)}%)`,
  );
  console.log();
  console.log("  Hard filter reason counts (pairs may carry multiple reasons):");
  console.log(`    anti_thesis_conflict  : ${reasonCounts.anti_thesis_conflict}`);
  console.log(`    stage_mismatch        : ${reasonCounts.stage_mismatch}`);
  console.log(`    check_size_mismatch   : ${reasonCounts.check_size_mismatch}`);
  console.log(`    pairs with 2+ reasons : ${multipleReasonCount}`);
  console.log();
  console.log("  Ineligible pairs by label (cross-tab):");
  for (let i = 0 as Label; i < 5; i++) {
    const count = ineligibleByLabel[i];
    const flag = i >= 3 && count > 0 ? "  ⚠  FALSE-PROMOTION RISK" : "";
    console.log(
      `    ${i}  ${LABEL_NAMES[i as Label].padEnd(14)}  ${String(count).padStart(3)} pairs${flag}`,
    );
  }
  const falsePromotionRisk = ineligibleByLabel[3] + ineligibleByLabel[4];
  if (falsePromotionRisk > 0) {
    console.log(
      `\n  ⚠  ${falsePromotionRisk} ineligible pair(s) carry label ≥ 3. ` +
      `These would be false promotions if the eligibility gate were absent. ` +
      `Investigate label-cap logic.`,
    );
  } else {
    console.log(
      `\n  ✓  No ineligible pair has label ≥ 3. Eligibility gate and label caps are consistent.`,
    );
  }
  console.log();

  console.log("Done.");
}

function truncate(s: string, maxLen: number): string {
  return s.length <= maxLen ? s : s.slice(0, maxLen - 1) + "…";
}

main();
