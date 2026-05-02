#!/usr/bin/env tsx
/**
 * scripts/ml/validate_production_features.ts
 *
 * Phase 15 validation harness.
 *
 * Builds synthetic production-shaped startup/investor fixtures, runs
 * computeProductionMatchFeatures, asserts all feature fields, then
 * scores with the Phase 11c LogReg champion and asserts the result.
 *
 * Run with:
 *   npm run validate-model:production
 *
 * Exit 0 = PASS, exit 1 = FAIL.
 */

// ── path alias resolution for tsx ─────────────────────────────────────────
// tsx does not automatically resolve @/ aliases from tsconfig.json.
// We use a relative import path here instead.  Both resolve to the same file.

import { computeProductionMatchFeatures, type ProductionStartupLike, type ProductionInvestorLike } from "../../lib/matching/production-features";
import { scoreWithLearningModel } from "../../lib/matching/learning-model/scorer";
import { COEFFICIENTS_VERSION, FEATURE_ORDER } from "../../lib/matching/learning-model/coefficients";

// ── Types ─────────────────────────────────────────────────────────────────

type TestResult = { name: string; ok: boolean; details?: string };
const results: TestResult[] = [];

// ── Helpers ───────────────────────────────────────────────────────────────

function assert(name: string, cond: boolean, details?: string) {
  results.push({ name, ok: cond, details });
}

function assertRange(name: string, v: number | null | undefined, lo: number, hi: number) {
  if (v == null || !Number.isFinite(v)) {
    results.push({ name, ok: false, details: `Expected finite ∈ [${lo},${hi}], got ${v}` });
    return;
  }
  const ok = v >= lo && v <= hi;
  results.push({ name, ok, details: ok ? undefined : `${v} not in [${lo},${hi}]` });
}

// ── Fixtures ──────────────────────────────────────────────────────────────

/** Well-formed production startup row (all fields present). */
const GOOD_STARTUP: ProductionStartupLike = {
  startup_sectors: ["fintech", "ai"],
  industry: "fintech",
  stage: "seed",
  raise_amount: 1_500_000,
  traction: "Signed 3 design partners, $15K MRR from pilot customers.",
  location: "San Francisco, CA",
  customer_type: "smb",
};

/** Well-formed production investor row (all fields present). */
const GOOD_INVESTOR: ProductionInvestorLike = {
  sectors: ["fintech", "saas"],
  stages: ["seed", "series_a"],
  check_min: 500_000,
  check_max: 2_000_000,
  geographies: ["United States"],
};

/** Startup with mostly null / empty fields (worst-case production row). */
const SPARSE_STARTUP: ProductionStartupLike = {
  startup_sectors: [],
  industry: null,
  stage: null,
  raise_amount: null,
  traction: null,
  location: null,
  customer_type: null,
};

/** Investor with no fields set. */
const SPARSE_INVESTOR: ProductionInvestorLike = {
  sectors: [],
  stages: [],
  check_min: 0,
  check_max: 0,
  geographies: [],
};

/** Startup with a matching sector and exact stage/check overlap. */
const STRONG_STARTUP: ProductionStartupLike = {
  startup_sectors: ["fintech"],
  industry: "fintech",
  stage: "seed",
  raise_amount: 1_000_000,
  traction: "200 paying customers · $50K MRR · 30% MoM growth for 6 months.",
  location: "New York, NY",
  customer_type: "enterprise",
};

/** Investor perfectly aligned with STRONG_STARTUP. */
const STRONG_INVESTOR: ProductionInvestorLike = {
  sectors: ["fintech"],
  stages: ["seed"],
  check_min: 500_000,
  check_max: 2_000_000,
  geographies: ["United States"],
};

/** Startup that's geo-remote and sector-mismatched. */
const WEAK_STARTUP: ProductionStartupLike = {
  startup_sectors: ["biotech"],
  industry: "biotech",
  stage: "series_b_plus",
  raise_amount: 50_000_000,
  traction: "No traction yet.",
  location: "remote",
  customer_type: "consumer",
};

/** Investor that won't match WEAK_STARTUP (different stage, check). */
const WEAK_INVESTOR: ProductionInvestorLike = {
  sectors: ["saas"],
  stages: ["pre_seed"],
  check_min: 50_000,
  check_max: 250_000,
  geographies: ["Southeast Asia"],
};

// ── Validation tests ──────────────────────────────────────────────────────

function runTests() {
  console.log();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Phase 15 — Production Feature Adapter Validation");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Model version: ${COEFFICIENTS_VERSION}`);
  console.log(`  Features (${FEATURE_ORDER.length}): ${FEATURE_ORDER.join(", ")}`);
  console.log();

  // ── 1. Feature field presence and ranges ───────────────────────────────

  console.log("1. Well-formed pair — all 12 features present and in [0,1]");
  const good = computeProductionMatchFeatures(GOOD_STARTUP, GOOD_INVESTOR);

  assert(
    "feature_order: 12 fields returned",
    Object.keys(good).length === 12,
    `got ${Object.keys(good).length}`,
  );
  for (const key of FEATURE_ORDER) {
    if (key === "semantic_similarity_score") continue; // null is expected
    assertRange(`field ${key} ∈ [0,1]`, (good as unknown as Record<string, number>)[key], 0, 1);
  }
  assert(
    "semantic_similarity_score is null (no embeddings in Phase 15)",
    good.semantic_similarity_score === null,
    `got ${good.semantic_similarity_score}`,
  );

  // ── 2. Sparse / null inputs don't throw and return safe defaults ────────

  console.log("2. Sparse pair — null inputs produce valid finite features");
  let sparseFeatures: ReturnType<typeof computeProductionMatchFeatures> | undefined;
  let sparseThrew = false;
  try {
    sparseFeatures = computeProductionMatchFeatures(SPARSE_STARTUP, SPARSE_INVESTOR);
  } catch (e) {
    sparseThrew = true;
    assert("sparse pair: did not throw", false, String(e));
  }
  if (!sparseThrew && sparseFeatures) {
    assert("sparse pair: did not throw", true);
    for (const key of FEATURE_ORDER) {
      if (key === "semantic_similarity_score") continue;
      const v = (sparseFeatures as unknown as Record<string, number | null>)[key];
      const ok = v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1);
      assert(`sparse field ${key} safe`, ok, `got ${v}`);
    }
  }

  // ── 3. Strong match vs weak match relative ordering ─────────────────────

  console.log("3. Strong vs weak pair — model ranks strong pair higher");
  const strongFeatures = computeProductionMatchFeatures(STRONG_STARTUP, STRONG_INVESTOR);
  const weakFeatures = computeProductionMatchFeatures(WEAK_STARTUP, WEAK_INVESTOR);

  const strongResult = scoreWithLearningModel(strongFeatures);
  const weakResult = scoreWithLearningModel(weakFeatures);

  assert("strong pair: result not null", strongResult !== null);
  assert("weak pair: result not null", weakResult !== null);

  if (strongResult && weakResult) {
    assertRange("strong pair score ∈ [0,4]", strongResult.score, 0, 4);
    assertRange("weak pair score ∈ [0,4]", weakResult.score, 0, 4);
    assert(
      "strong pair scores higher than weak pair",
      strongResult.score > weakResult.score,
      `strong=${strongResult.score.toFixed(4)}, weak=${weakResult.score.toFixed(4)}`,
    );
    assert(
      "strong pair model version matches COEFFICIENTS_VERSION",
      strongResult.version === COEFFICIENTS_VERSION,
    );
  }

  // ── 4. Well-formed pair: model output in [0,4] ──────────────────────────

  console.log("4. Well-formed pair — model score ∈ [0, 4] and is finite");
  const goodResult = scoreWithLearningModel(good);
  assert("good pair: result not null", goodResult !== null);
  if (goodResult) {
    assertRange("good pair score ∈ [0,4]", goodResult.score, 0, 4);
    assert("good pair classProbabilities has 5 entries", goodResult.classProbabilities.length === 5);
    const probSum = goodResult.classProbabilities.reduce((a, b) => a + b, 0);
    assert(
      "good pair class probs sum to ~1.0",
      Math.abs(probSum - 1.0) < 1e-6,
      `sum=${probSum}`,
    );
  }

  // ── 5. Sparse pair: model score is not null (defaults are scoreable) ────

  console.log("5. Sparse pair — model still returns a score from safe defaults");
  if (sparseFeatures) {
    const sparseResult = scoreWithLearningModel(sparseFeatures);
    assert("sparse pair: model returns non-null", sparseResult !== null);
    if (sparseResult) {
      assertRange("sparse pair score ∈ [0,4]", sparseResult.score, 0, 4);
    }
  }

  // ── 6. Malformed / edge-case inputs ─────────────────────────────────────

  console.log("6. Malformed inputs — no throw, safe values returned");

  const malformedCases: Array<[string, ProductionStartupLike, ProductionInvestorLike]> = [
    [
      "NaN raise_amount",
      { ...GOOD_STARTUP, raise_amount: NaN },
      GOOD_INVESTOR,
    ],
    [
      "Infinity raise_amount",
      { ...GOOD_STARTUP, raise_amount: Infinity },
      GOOD_INVESTOR,
    ],
    [
      "unknown stage",
      { ...GOOD_STARTUP, stage: "series_z" },
      GOOD_INVESTOR,
    ],
    [
      "negative check_min/check_max",
      GOOD_STARTUP,
      { ...GOOD_INVESTOR, check_min: -1000, check_max: -500 },
    ],
    [
      "empty sectors on both sides",
      { ...GOOD_STARTUP, startup_sectors: [], industry: null },
      { ...GOOD_INVESTOR, sectors: [] },
    ],
  ];

  for (const [label, startup, investor] of malformedCases) {
    let threw = false;
    let features: ReturnType<typeof computeProductionMatchFeatures> | undefined;
    try {
      features = computeProductionMatchFeatures(startup, investor);
    } catch (e) {
      threw = true;
      assert(`malformed "${label}": no throw`, false, String(e));
    }
    if (!threw) {
      assert(`malformed "${label}": no throw`, true);
      if (features) {
        const modelResult = scoreWithLearningModel(features);
        const safe = modelResult === null || (Number.isFinite(modelResult.score) && modelResult.score >= 0 && modelResult.score <= 4);
        assert(`malformed "${label}": safe model result`, safe, modelResult ? `score=${modelResult.score}` : "null");
      }
    }
  }

  // ── 7. FEATURE_ORDER length assertion ─────────────────────────────────

  console.log("7. FEATURE_ORDER has exactly 12 entries");
  assert("FEATURE_ORDER.length === 12", FEATURE_ORDER.length === 12, `got ${FEATURE_ORDER.length}`);
}

// ── Output ────────────────────────────────────────────────────────────────

runTests();

console.log();
console.log("─────────────────────────────────────────────────────────────");
console.log("  RESULTS");
console.log("─────────────────────────────────────────────────────────────");

let passed = 0;
let failed = 0;
for (const r of results) {
  if (r.ok) {
    console.log(`  ✓  ${r.name}`);
    passed++;
  } else {
    console.log(`  ✗  ${r.name}${r.details ? ` — ${r.details}` : ""}`);
    failed++;
  }
}

console.log("─────────────────────────────────────────────────────────────");
console.log(`  ${passed} passed / ${failed} failed / ${results.length} total`);
console.log("─────────────────────────────────────────────────────────────");

if (failed > 0) {
  console.log("\n  ✗  VALIDATION FAILED\n");
  process.exit(1);
} else {
  console.log("\n  ✓  ALL CHECKS PASSED\n");
  process.exit(0);
}
