#!/usr/bin/env tsx
/**
 * scripts/ml/validate_ml_ranker.ts
 *
 * Phase 16 ML ranker validation harness.
 *
 * Tests rankFeedForViewer via the _scoringFn injection parameter so no
 * real DB or model inference runs.  All assertions exercise the ranking,
 * fallback, and safety contracts.
 *
 * Run with: npm run validate-ranker:production
 * Exit 0 = PASS, exit 1 = FAIL.
 *
 * ─── NOTICE ──────────────────────────────────────────────────────────────────
 * Offline test harness. Not investment advice.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { rankFeedForViewer } from "../../lib/feed/ml-ranker";
import type { ShadowScoreMap, ShadowScoreEntry } from "../../lib/feed/shadow-score";
import type { EligibilityResult } from "../../lib/matching/eligibility";

// ── Helpers ────────────────────────────────────────────────────────────────

type TestResult = { name: string; ok: boolean; details?: string };
const results: TestResult[] = [];

function assert(name: string, cond: boolean, details?: string) {
  results.push({ name, ok: cond, details: details ?? (cond ? undefined : "assertion failed") });
}

function assertEq<T>(name: string, actual: T, expected: T) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({
    name,
    ok,
    details: ok ? undefined : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  });
}

// ── Fixture factories ──────────────────────────────────────────────────────

type FakeItem = { card: { userId: string }; match: { score: number } };

function item(userId: string, scoreMatchScore: number): FakeItem {
  return { card: { userId }, match: { score: scoreMatchScore } };
}

function eligResult(elig: boolean): EligibilityResult {
  return elig
    ? { eligible_for_model_ranking: true, hard_filter_reasons: [] }
    : { eligible_for_model_ranking: false, hard_filter_reasons: ["anti_thesis_conflict"] };
}

function scoreEntry(modelScore: number, elig: boolean): ShadowScoreEntry {
  return { modelScore, modelVersion: "test-v1", eligibility: eligResult(elig) };
}

function makeMap(record: Record<string, ShadowScoreEntry>): ShadowScoreMap {
  return new Map(Object.entries(record));
}

// ── Scoring function stubs ─────────────────────────────────────────────────

type ScoringFn = (p: {
  actorUserId: string;
  actorRole: "investor" | "founder";
  targetUserIds: string[];
}) => Promise<ShadowScoreMap>;

/** Returns a fixed ShadowScoreMap immediately. */
function fixedScores(scores: ShadowScoreMap): ScoringFn {
  return async () => scores;
}

/** Resolves after `delayMs` — used to test timeout. */
function slowScores(delayMs: number): ScoringFn {
  return async () => {
    await new Promise((r) => setTimeout(r, delayMs));
    return new Map();
  };
}

/** Never resolves — ensures the ranker's timeout fires. */
function hangingScores(): ScoringFn {
  return () => new Promise<ShadowScoreMap>(() => {});
}

/** Always throws. */
function throwingScores(msg = "mock error"): ScoringFn {
  return async () => { throw new Error(msg); };
}

// ── Tests ──────────────────────────────────────────────────────────────────

const ACTOR = "actor-000";
const ROLE = "investor" as const;

async function runTests() {
  console.log();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Phase 16 — ML Ranker Validation Harness");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();

  // ── Test 1: flag off — same order, ranker=scorematch ─────────────────────
  console.log("1. Flag off returns same order and ranker=scorematch");
  {
    const items = [item("a", 90), item("b", 70), item("c", 50)];
    const result = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items, flagEnabled: false,
    });
    assertEq("flag-off: ranker is scorematch", result.ranker, "scorematch");
    assert("flag-off: shadowScores is null", result.shadowScores === null);
    assertEq("flag-off: item order unchanged", result.items.map((i) => i.card.userId), ["a", "b", "c"]);
    assertEq("flag-off: length preserved", result.items.length, 3);
  }

  // ── Test 2: flag on — same set, same length ───────────────────────────────
  console.log("2. Flag on returns same set and same length");
  {
    const items = [item("a", 90), item("b", 70), item("c", 50)];
    const scores = makeMap({
      a: scoreEntry(3.5, true),
      b: scoreEntry(2.0, true),
      c: scoreEntry(1.0, true),
    });
    const result = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items, flagEnabled: true,
      _scoringFn: fixedScores(scores),
    });
    const inputIds = new Set(items.map((i) => i.card.userId));
    const outputIds = new Set(result.items.map((i) => i.card.userId));
    assert("flag-on: same set of items", [...inputIds].every((id) => outputIds.has(id)));
    assertEq("flag-on: length preserved", result.items.length, items.length);
  }

  // ── Test 3: eligible/scored items sorted by modelScore desc ──────────────
  console.log("3. Eligible+scored items sorted by modelScore desc");
  {
    const items = [item("a", 90), item("b", 70), item("c", 80)];
    const scores = makeMap({
      a: scoreEntry(1.5, true),
      b: scoreEntry(3.5, true),
      c: scoreEntry(2.5, true),
    });
    const result = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items, flagEnabled: true,
      _scoringFn: fixedScores(scores),
    });
    assertEq("ranked: ranker is learning_model_v1", result.ranker, "learning_model_v1");
    assertEq("ranked: order b(3.5) c(2.5) a(1.5)", result.items.map((i) => i.card.userId), ["b", "c", "a"]);
  }

  // ── Test 4: ineligible items placed after eligible items ─────────────────
  console.log("4. Ineligible items placed after eligible items");
  {
    const items = [item("inel1", 99), item("elig1", 50), item("inel2", 80)];
    const scores = makeMap({
      inel1: scoreEntry(4.0, false), // high model score but ineligible
      elig1: scoreEntry(2.0, true),
      inel2: scoreEntry(3.5, false), // also ineligible
    });
    const result = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items, flagEnabled: true,
      _scoringFn: fixedScores(scores),
    });
    const outputIds = result.items.map((i) => i.card.userId);
    assert("ineligible: elig1 before inel1", outputIds.indexOf("elig1") < outputIds.indexOf("inel1"));
    assert("ineligible: elig1 before inel2", outputIds.indexOf("elig1") < outputIds.indexOf("inel2"));
    assertEq("ineligible: length preserved", result.items.length, items.length);
    assertEq("ineligible: ranker", result.ranker, "learning_model_v1");
  }

  // ── Test 5: null-scored items don't crash; placed after scored items ───────
  console.log("5. Null-scored items placed after scored items, no crash");
  {
    const items = [item("scored", 70), item("nulled", 90)];
    const scores = makeMap({
      scored: scoreEntry(3.0, true),
      nulled: null,
    });
    let threw = false;
    let result: Awaited<ReturnType<typeof rankFeedForViewer>> | undefined;
    try {
      result = await rankFeedForViewer({
        actorUserId: ACTOR, actorRole: ROLE, items, flagEnabled: true,
        _scoringFn: fixedScores(scores),
      });
    } catch {
      threw = true;
    }
    assert("null-score: no throw", !threw);
    if (result) {
      const outputIds = result.items.map((i) => i.card.userId);
      assert("null-score: scored before null", outputIds.indexOf("scored") < outputIds.indexOf("nulled"));
      assertEq("null-score: length preserved", result.items.length, items.length);
    }
  }

  // ── Test 6: bulk null rate >= 50% triggers scorematch_fallback ────────────
  console.log("6. Bulk null rate ≥ 50% triggers scorematch_fallback");
  {
    // 3 out of 5 items have null entry → 60% null rate → fallback
    const items = [item("a", 90), item("b", 70), item("c", 60), item("d", 50), item("e", 40)];
    const scores = makeMap({
      a: scoreEntry(3.0, true),
      b: scoreEntry(2.0, true),
      // c, d, e → not in map → null entry from Map.get
    });
    const result = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items, flagEnabled: true,
      _scoringFn: fixedScores(scores),
    });
    assertEq("bulk-null: ranker is scorematch_fallback", result.ranker, "scorematch_fallback");
    assertEq("bulk-null: original order preserved", result.items.map((i) => i.card.userId), ["a", "b", "c", "d", "e"]);
    assertEq("bulk-null: length preserved", result.items.length, items.length);
  }

  // ── Test 7: timeout triggers scorematch_fallback ───────────────────────────
  console.log("7. Timeout triggers scorematch_fallback");
  {
    const items = [item("a", 90), item("b", 70)];
    const result = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items, flagEnabled: true,
      timeoutMs: 20,
      _scoringFn: hangingScores(),
    });
    assertEq("timeout: ranker is scorematch_fallback", result.ranker, "scorematch_fallback");
    assertEq("timeout: original order preserved", result.items.map((i) => i.card.userId), ["a", "b"]);
    assertEq("timeout: length preserved", result.items.length, items.length);
  }

  // ── Test 8: throw inside scoring triggers scorematch_fallback ─────────────
  console.log("8. Throw inside scoring triggers scorematch_fallback");
  {
    const items = [item("a", 90), item("b", 70)];
    const result = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items, flagEnabled: true,
      _scoringFn: throwingScores("mock scoring error"),
    });
    assertEq("throw: ranker is scorematch_fallback", result.ranker, "scorematch_fallback");
    assertEq("throw: original order preserved", result.items.map((i) => i.card.userId), ["a", "b"]);
    assert("throw: has fallbackReason", typeof result.fallbackReason === "string");
  }

  // ── Test 9: sort is deterministic across repeated calls ───────────────────
  console.log("9. Sort is deterministic across repeated calls");
  {
    // All items tied on modelScore and scoreMatch → userId asc breaks tie
    const items = [item("z", 70), item("a", 70), item("m", 70)];
    const scores = makeMap({
      z: scoreEntry(2.5, true),
      a: scoreEntry(2.5, true),
      m: scoreEntry(2.5, true),
    });

    const runs: string[][] = [];
    for (let i = 0; i < 3; i++) {
      const result = await rankFeedForViewer({
        actorUserId: ACTOR, actorRole: ROLE, items, flagEnabled: true,
        _scoringFn: fixedScores(scores),
      });
      runs.push(result.items.map((it) => it.card.userId));
    }
    assert(
      "deterministic: all runs produce same order",
      runs.every((run) => JSON.stringify(run) === JSON.stringify(runs[0])),
      runs.map((r) => r.join(",")).join(" | "),
    );
  }

  // ── Test 10: all non-null model scores finite and in [0,4] ────────────────
  console.log("10. All non-null model scores finite and in [0,4]");
  {
    const items = [item("a", 90), item("b", 70), item("c", 50)];
    const scores = makeMap({
      a: scoreEntry(3.9, true),
      b: scoreEntry(0.1, true),
      c: scoreEntry(2.0, true),
    });
    const result = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items, flagEnabled: true,
      _scoringFn: fixedScores(scores),
    });
    if (result.shadowScores) {
      let allValid = true;
      for (const [, entry] of result.shadowScores) {
        if (entry !== null) {
          if (!Number.isFinite(entry.modelScore) || entry.modelScore < 0 || entry.modelScore > 4) {
            allValid = false;
          }
        }
      }
      assert("scores-in-range: all entries valid", allValid);
    } else {
      assert("scores-in-range: shadowScores present", false, "shadowScores was null");
    }
  }

  // ── Test 11: scoreMatch tie-breaker + userId stable sort ─────────────────
  console.log("11. scoreMatch tie-breaker + userId stable sort");
  {
    // Same modelScore, same scoreMatch → userId asc
    const items = [item("charlie", 50), item("alice", 50), item("bob", 50)];
    const scores = makeMap({
      charlie: scoreEntry(2.0, true),
      alice:   scoreEntry(2.0, true),
      bob:     scoreEntry(2.0, true),
    });
    const result = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items, flagEnabled: true,
      _scoringFn: fixedScores(scores),
    });
    assertEq(
      "tie-breaker: alice bob charlie",
      result.items.map((i) => i.card.userId),
      ["alice", "bob", "charlie"],
    );
  }

  // ── Test 12: no item dropped or duplicated under mixed scenario ───────────
  console.log("12. No item dropped or duplicated under mixed scenario");
  {
    const items = [
      item("e1", 90),  // eligible, scored
      item("e2", 80),  // eligible, null entry
      item("i1", 70),  // ineligible, scored
      item("i2", 60),  // no entry at all
    ];
    const scores = makeMap({
      e1: scoreEntry(3.5, true),
      e2: null,
      i1: scoreEntry(4.0, false),
      // i2 absent
    });
    const result = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items, flagEnabled: true,
      _scoringFn: fixedScores(scores),
    });
    const inputIds = items.map((i) => i.card.userId).sort();
    const outputIds = result.items.map((i) => i.card.userId).sort();
    assertEq("no-drop: same sorted IDs", outputIds, inputIds);
    assertEq("no-drop: length preserved", result.items.length, items.length);

    const out = result.items.map((i) => i.card.userId);
    assert("no-drop: e1 before i1 (ineligible)", out.indexOf("e1") < out.indexOf("i1"));
    assert("no-drop: e1 before i2 (absent)", out.indexOf("e1") < out.indexOf("i2"));
  }
}

// ── Output ─────────────────────────────────────────────────────────────────

runTests().then(() => {
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
}).catch((err) => {
  console.error("\nFATAL ERROR in validation harness:", err);
  process.exit(1);
});
