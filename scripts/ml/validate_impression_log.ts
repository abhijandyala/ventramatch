#!/usr/bin/env tsx
/**
 * scripts/ml/validate_impression_log.ts
 *
 * Phase 18 — Pass/fail harness for buildImpressionRows().
 *
 * Tests the pure row-builder extracted from lib/feed/impression-log.ts
 * for all 8 flag-matrix combinations and structural correctness.
 * No DB, no network.
 *
 * Run with: npm run validate-impressions:production
 * Exit 0 = PASS, exit 1 = FAIL.
 *
 * ─── NOTICE ──────────────────────────────────────────────────────────────────
 * Offline test harness. Not investment advice.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { buildImpressionRows } from "../../lib/feed/impression-log";
import type { ImpressionRow } from "../../lib/feed/impression-log";

// ── Helpers ────────────────────────────────────────────────────────────────

type Result = { name: string; ok: boolean; details?: string };
const results: Result[] = [];

function assert(name: string, cond: boolean, details?: string) {
  results.push({ name, ok: cond, details: cond ? undefined : (details ?? "failed") });
}

function assertEq<T>(name: string, a: T, b: T) {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  results.push({ name, ok, details: ok ? undefined : `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}` });
}

// ── Fixtures ───────────────────────────────────────────────────────────────

const ACTOR = "actor-00000000-0000-0000-0000-000000000000";
const SESSION = "session-uuid-placeholder";

function items3() {
  return [
    { card: { userId: "user-a" }, match: { score: 90 } },
    { card: { userId: "user-b" }, match: { score: 70 } },
    { card: { userId: "user-c" }, match: { score: 50 } },
  ];
}

type ShadowEntry = { modelScore: number; modelVersion: string } | null;
function shadowMap(entries: Record<string, ShadowEntry>): Map<string, ShadowEntry> {
  return new Map(Object.entries(entries));
}

// ── Tests ──────────────────────────────────────────────────────────────────

function runTests() {
  console.log();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Phase 18 — Impression Log Row Builder Validation");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();

  // Test 1: basic row count
  {
    const rows = buildImpressionRows({
      actorUserId: ACTOR, items: items3(), surface: "feed_main",
      ranker: "scorematch", renderSessionId: SESSION,
    });
    assertEq("IL1: 3 items → 3 rows", rows.length, 3);
  }

  // Test 2: feed_position is 1-indexed
  {
    const rows = buildImpressionRows({
      actorUserId: ACTOR, items: items3(), surface: "feed_main",
      ranker: "scorematch", renderSessionId: SESSION,
    });
    assertEq("IL2: feed_position[0] = 1", rows[0].feed_position, 1);
    assertEq("IL2: feed_position[1] = 2", rows[1].feed_position, 2);
    assertEq("IL2: feed_position[2] = 3", rows[2].feed_position, 3);
  }

  // Test 3: no shadow scores → model_score null, model_version null
  {
    const rows = buildImpressionRows({
      actorUserId: ACTOR, items: items3(), surface: "feed_main",
      ranker: "scorematch",
    });
    for (const row of rows) {
      assert("IL3: model_score null when no shadows", row.model_score === null, `got ${row.model_score}`);
      assert("IL3: model_version null when no shadows", row.model_version === null, `got ${row.model_version}`);
      assert("IL3: scorematch_score = score", row.scorematch_score === row.score);
    }
  }

  // Test 4: all shadow scores populated
  {
    const scores = shadowMap({
      "user-a": { modelScore: 3.5, modelVersion: "v1" },
      "user-b": { modelScore: 2.0, modelVersion: "v1" },
      "user-c": { modelScore: 1.0, modelVersion: "v1" },
    });
    const rows = buildImpressionRows({
      actorUserId: ACTOR, items: items3(), surface: "feed_main",
      ranker: "learning_model_v1", shadowScores: scores,
    });
    assertEq("IL4: user-a model_score", rows[0].model_score, 3.5);
    assertEq("IL4: user-b model_score", rows[1].model_score, 2.0);
    assertEq("IL4: user-c model_score", rows[2].model_score, 1.0);
    assert("IL4: model_version set", rows[0].model_version === "v1");
  }

  // Test 5: mixed scored/unscored
  {
    const scores = shadowMap({
      "user-a": { modelScore: 3.5, modelVersion: "v1" },
      "user-b": null,
      // user-c absent from map
    });
    const rows = buildImpressionRows({
      actorUserId: ACTOR, items: items3(), surface: "feed_main",
      ranker: "learning_model_v1", shadowScores: scores,
    });
    assertEq("IL5: user-a model_score = 3.5", rows[0].model_score, 3.5);
    assert("IL5: user-b model_score null (null entry)", rows[1].model_score === null);
    assert("IL5: user-c model_score null (absent from map)", rows[2].model_score === null);
  }

  // Test 6: scorematch_score always = item.match.score
  {
    const rows = buildImpressionRows({
      actorUserId: ACTOR, items: items3(), surface: "feed_main",
      ranker: "personalized_v1",
    });
    assertEq("IL6: scorematch_score[0] = 90", rows[0].scorematch_score, 90);
    assertEq("IL6: scorematch_score[1] = 70", rows[1].scorematch_score, 70);
    assertEq("IL6: scorematch_score[2] = 50", rows[2].scorematch_score, 50);
  }

  // Test 7: all four ranker tags are accepted
  const rankerTags = ["scorematch", "learning_model_v1", "personalized_v1", "scorematch_fallback"] as const;
  for (const tag of rankerTags) {
    const rows = buildImpressionRows({
      actorUserId: ACTOR, items: items3(), surface: "feed_main", ranker: tag,
    });
    assert(`IL7: ranker="${tag}" stored correctly`, rows[0].ranker === tag);
  }

  // Test 8: surface values
  {
    const surfaces = ["feed_main", "dashboard_recommended"] as const;
    for (const surface of surfaces) {
      const rows = buildImpressionRows({
        actorUserId: ACTOR, items: items3(), surface, ranker: "scorematch",
      });
      assert(`IL8: surface="${surface}" stored`, rows[0].surface === surface);
    }
  }

  // Test 9: filter_context round-trips
  {
    const ctx = { q: "fintech", industries: ["saas"], sort: "score" };
    const rows = buildImpressionRows({
      actorUserId: ACTOR, items: items3(), surface: "feed_main",
      ranker: "scorematch", filterContext: ctx,
    });
    assertEq("IL9: filter_context round-trip", rows[0].filter_context, ctx);
  }

  // Test 10: experiment_cohort stored
  {
    const rows = buildImpressionRows({
      actorUserId: ACTOR, items: items3(), surface: "feed_main",
      ranker: "scorematch", experimentCohort: "treatment_a",
    });
    assert("IL10: experiment_cohort = treatment_a", rows[0].experiment_cohort === "treatment_a");
  }

  // Test 11: actor_user_id propagated to every row
  {
    const rows = buildImpressionRows({
      actorUserId: ACTOR, items: items3(), surface: "feed_main", ranker: "scorematch",
    });
    assert("IL11: actor_user_id on all rows",
      rows.every((r) => r.actor_user_id === ACTOR));
  }

  // Test 12: target_user_id matches item order
  {
    const rows = buildImpressionRows({
      actorUserId: ACTOR, items: items3(), surface: "feed_main", ranker: "scorematch",
    });
    assertEq("IL12: target_user_id[0]", rows[0].target_user_id, "user-a");
    assertEq("IL12: target_user_id[1]", rows[1].target_user_id, "user-b");
    assertEq("IL12: target_user_id[2]", rows[2].target_user_id, "user-c");
  }

  // Test 13: empty items → empty rows (degenerate case)
  {
    const rows = buildImpressionRows({
      actorUserId: ACTOR, items: [], surface: "feed_main", ranker: "scorematch",
    });
    assertEq("IL13: empty items → 0 rows", rows.length, 0);
  }

  // Test 14: flag-matrix case — flag off/off → scorematch, no model scores
  {
    const rows = buildImpressionRows({
      actorUserId: ACTOR, items: items3(), surface: "feed_main",
      ranker: "scorematch", shadowScores: null,
    });
    assert("IL14: flag-off case: ranker=scorematch", rows[0].ranker === "scorematch");
    assert("IL14: flag-off case: model_score=null", rows.every(r => r.model_score === null));
  }
}

// ── Output ─────────────────────────────────────────────────────────────────

runTests();

console.log();
console.log("─────────────────────────────────────────────────────────────");
console.log("  RESULTS");
console.log("─────────────────────────────────────────────────────────────");

let passed = 0, failed = 0;
for (const r of results) {
  if (r.ok) { console.log(`  ✓  ${r.name}`); passed++; }
  else { console.log(`  ✗  ${r.name}${r.details ? ` — ${r.details}` : ""}`); failed++; }
}

console.log("─────────────────────────────────────────────────────────────");
console.log(`  ${passed} passed / ${failed} failed / ${results.length} total`);
console.log("─────────────────────────────────────────────────────────────");

if (failed > 0) { console.log("\n  ✗  VALIDATION FAILED\n"); process.exit(1); }
else { console.log("\n  ✓  ALL CHECKS PASSED\n"); process.exit(0); }
