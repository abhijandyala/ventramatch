#!/usr/bin/env tsx
/**
 * scripts/ml/validate_integration.ts
 *
 * Phase 18 — Full-system integration validation.
 *
 * Exercises the connected pipeline from rankFeedForViewer → buildImpressionRows
 * across:
 *   • 8 meaningful feature-flag state combinations
 *   • 7 fallback-grid induced-failure cases
 *   • Eligibility invariant (ineligible items never above eligible)
 *   • Personalization invariant (only Bucket A re-ordered)
 *   • Determinism (same input → same output across two runs)
 *   • Item count and item set preservation
 *
 * No DB, no real network. Uses dependency-injection parameters.
 *
 * Run with: npm run validate-integration:production
 * Exit 0 = PASS, exit 1 = FAIL.
 *
 * ─── NOTICE ──────────────────────────────────────────────────────────────────
 * Offline test harness. All data is synthetic. Not investment advice.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { rankFeedForViewer } from "../../lib/feed/ml-ranker";
import { buildImpressionRows } from "../../lib/feed/impression-log";
import type { ShadowScoreMap, ShadowScoreEntry } from "../../lib/feed/shadow-score";
import type { BehaviorSet, BehaviorEvent } from "../../lib/personalization/runtime/behavior-loader";
import type { EligibilityResult } from "../../lib/matching/eligibility";
import type { RankerTag } from "../../lib/feed/ml-ranker";

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

// ── Feed item fixture factories ────────────────────────────────────────────

type FakeItem = { card: { userId: string }; match: { score: number } };

function item(id: string, smScore: number): FakeItem {
  return { card: { userId: id }, match: { score: smScore } };
}

function eligEntry(modelScore: number, eligible: boolean): ShadowScoreEntry {
  return {
    modelScore,
    modelVersion: "test-v1",
    eligibility: {
      eligible_for_model_ranking: eligible,
      hard_filter_reasons: eligible ? [] : ["anti_thesis_conflict"],
    } satisfies EligibilityResult,
  };
}

function makeMap(record: Record<string, ShadowScoreEntry>): ShadowScoreMap {
  return new Map(Object.entries(record));
}

// ── Scoring function stubs ─────────────────────────────────────────────────

type ScoringFn = (p: { actorUserId: string; actorRole: "investor" | "founder"; targetUserIds: string[] }) => Promise<ShadowScoreMap>;

function fixedScores(scores: ShadowScoreMap): ScoringFn {
  return async () => scores;
}

function throwingScores(): ScoringFn {
  return async () => { throw new Error("mock scoring error"); };
}

function hangingScores(): ScoringFn {
  return () => new Promise<ShadowScoreMap>(() => {});
}

// ── Behavior loader stubs ─────────────────────────────────────────────────

type BehaviorLoaderFn = (actorUserId: string) => Promise<BehaviorSet>;

function emptyBehavior(): BehaviorLoaderFn {
  return async () => ({ events: [], loadedAt: new Date() });
}

function richBehavior(events: BehaviorEvent[]): BehaviorLoaderFn {
  return async () => ({ events, loadedAt: new Date() });
}

function throwingBehavior(): BehaviorLoaderFn {
  return async () => { throw new Error("mock behavior error"); };
}

function hangingBehavior(): BehaviorLoaderFn {
  return () => new Promise<BehaviorSet>(() => {});
}

// ── Standard feed fixtures ─────────────────────────────────────────────────

const ACTOR = "actor-test";
const ROLE = "investor" as const;

/**
 * Standard 5-item feed:
 *   e1, e2, e3 — eligible + model-scored (descending modelScore)
 *   b1         — eligible but null score (Bucket B)
 *   c1         — ineligible (Bucket C, but has high modelScore)
 */
function standardFeed(): FakeItem[] {
  return [
    item("e1", 90),   // eligible, model 3.5
    item("e2", 80),   // eligible, model 2.5
    item("e3", 70),   // eligible, model 1.5
    item("b1", 95),   // eligible, null score → Bucket B (high SM score!)
    item("c1", 99),   // ineligible, model 4.0 → Bucket C (even higher SM score!)
  ];
}

function standardScores(): ShadowScoreMap {
  return makeMap({
    e1: eligEntry(3.5, true),
    e2: eligEntry(2.5, true),
    e3: eligEntry(1.5, true),
    b1: null,
    c1: eligEntry(4.0, false),
  });
}

/**
 * Build a "rich behavior" events array that creates non-cold-start confidence.
 * 20 × intro_request (weight 1.0) = n_weighted 20 → confidence ≈ 0.23 > 0.03.
 */
function richBehaviorEvents(): BehaviorEvent[] {
  return Array.from({ length: 20 }, () => ({
    targetUserId: "e1",
    action: "intro_request" as const,
    createdAt: new Date(),
  }));
}

// ── Utility checks ─────────────────────────────────────────────────────────

function sameSet(a: FakeItem[], b: FakeItem[]): boolean {
  const as = new Set(a.map(i => i.card.userId));
  const bs = new Set(b.map(i => i.card.userId));
  return as.size === bs.size && [...as].every(id => bs.has(id));
}

function ineligibleAfterEligible(items: FakeItem[], eligibleIds: Set<string>, ineligibleIds: Set<string>): boolean {
  let lastEligIdx = -1;
  let firstIneligIdx = Infinity;
  for (let i = 0; i < items.length; i++) {
    if (eligibleIds.has(items[i].card.userId)) lastEligIdx = i;
    if (ineligibleIds.has(items[i].card.userId)) firstIneligIdx = Math.min(firstIneligIdx, i);
  }
  if (ineligibleIds.size === 0) return true;
  if (eligibleIds.size === 0) return true;
  return firstIneligIdx > lastEligIdx;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: 8 Flag-matrix combinations
// ─────────────────────────────────────────────────────────────────────────────

async function testFlagMatrix() {
  console.log("\n── Flag matrix (8 combinations) ─────────────────────────────");
  const feed = standardFeed();
  const scores = standardScores();

  // 1a. All flags off → scorematch, original order
  {
    const r = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items: feed,
      flagEnabled: false, personalizationEnabled: false,
    });
    assertEq("FM1a: all-off ranker=scorematch", r.ranker as RankerTag, "scorematch");
    assertEq("FM1a: original order preserved", r.items.map(i => i.card.userId), feed.map(i => i.card.userId));
    assertEq("FM1a: length preserved", r.items.length, feed.length);
  }

  // 1b. Impression logging only (flag off for ML) → scorematch; build rows
  {
    const r = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items: feed,
      flagEnabled: false, personalizationEnabled: false,
    });
    const rows = buildImpressionRows({
      actorUserId: ACTOR, items: r.items, surface: "feed_main",
      ranker: r.ranker, shadowScores: null,
    });
    assertEq("FM1b: rows count matches items", rows.length, feed.length);
    assert("FM1b: ranker=scorematch in rows", rows[0].ranker === "scorematch");
    assert("FM1b: model_score null in rows", rows.every(row => row.model_score === null));
  }

  // 1c. Shadow scoring only (ML off) → scorematch, model_score rows populated
  {
    const r = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items: feed,
      flagEnabled: false, personalizationEnabled: false,
    });
    // When ML off, ranker stays scorematch; shadow scores can still be logged.
    const rows = buildImpressionRows({
      actorUserId: ACTOR, items: r.items, surface: "feed_main",
      ranker: r.ranker,
      shadowScores: new Map([
        ["e1", { modelScore: 3.5, modelVersion: "v1", eligibility: { eligible_for_model_ranking: true, hard_filter_reasons: [] } }],
      ]),
    });
    assertEq("FM1c: ranker still scorematch", r.ranker as RankerTag, "scorematch");
    assert("FM1c: e1 model_score populated in rows", rows.find(r => r.target_user_id === "e1")?.model_score === 3.5);
    assert("FM1c: others null", rows.filter(r => r.target_user_id !== "e1").every(r => r.model_score === null));
  }

  // 1d. ML ranking on, personalization off → learning_model_v1
  {
    const r = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items: feed,
      flagEnabled: true, personalizationEnabled: false,
      _scoringFn: fixedScores(scores),
    });
    assertEq("FM1d: ranker=learning_model_v1", r.ranker as RankerTag, "learning_model_v1");
    assert("FM1d: same set", sameSet(r.items, feed));
    assertEq("FM1d: length preserved", r.items.length, feed.length);

    // c1 (ineligible) must be after e1, e2, e3 (eligible+scored)
    assert("FM1d: ineligible after eligible",
      ineligibleAfterEligible(r.items, new Set(["e1","e2","e3","b1"]), new Set(["c1"])));
  }

  // 1e. ML ranking + shadow scoring → learning_model_v1
  {
    const r = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items: feed,
      flagEnabled: true, personalizationEnabled: false,
      _scoringFn: fixedScores(scores),
    });
    const rows = buildImpressionRows({
      actorUserId: ACTOR, items: r.items, surface: "feed_main",
      ranker: r.ranker, shadowScores: r.shadowScores,
    });
    assertEq("FM1e: ranker in rows", rows[0].ranker, "learning_model_v1");
    assert("FM1e: e1 has model_score", rows.find(r => r.target_user_id === "e1")?.model_score != null);
  }

  // 1f. ML ranking + personalization cold-start → learning_model_v1
  {
    const r = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items: feed,
      flagEnabled: true, personalizationEnabled: true,
      _scoringFn: fixedScores(scores),
      _behaviorLoaderFn: emptyBehavior(),
    });
    assertEq("FM1f: cold-start → learning_model_v1", r.ranker as RankerTag, "learning_model_v1");
    assert("FM1f: same set", sameSet(r.items, feed));
  }

  // 1g. ML ranking + personalization active → personalized_v1
  {
    const r = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items: feed,
      flagEnabled: true, personalizationEnabled: true,
      _scoringFn: fixedScores(scores),
      _behaviorLoaderFn: richBehavior(richBehaviorEvents()),
    });
    assertEq("FM1g: rich behavior → personalized_v1", r.ranker as RankerTag, "personalized_v1");
    assert("FM1g: same set", sameSet(r.items, feed));
    assertEq("FM1g: length preserved", r.items.length, feed.length);
  }

  // 1h. ML + personalization + shadow scoring → personalized_v1 + rows
  {
    const r = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items: feed,
      flagEnabled: true, personalizationEnabled: true,
      _scoringFn: fixedScores(scores),
      _behaviorLoaderFn: richBehavior(richBehaviorEvents()),
    });
    const rows = buildImpressionRows({
      actorUserId: ACTOR, items: r.items, surface: "feed_main",
      ranker: r.ranker, shadowScores: r.shadowScores,
    });
    assertEq("FM1h: ranker=personalized_v1 in rows", rows[0].ranker, "personalized_v1");
    assertEq("FM1h: row count = item count", rows.length, feed.length);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: Fallback grid (7 induced failures)
// ─────────────────────────────────────────────────────────────────────────────

async function testFallbackGrid() {
  console.log("\n── Fallback grid (7 induced failures) ───────────────────────");
  const feed = standardFeed();

  // 2a. Scoring throws → scorematch_fallback
  {
    const r = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items: feed,
      flagEnabled: true, _scoringFn: throwingScores(),
    });
    assertEq("FB2a: scoring throws → scorematch_fallback", r.ranker as RankerTag, "scorematch_fallback");
    assertEq("FB2a: original order kept", r.items.map(i => i.card.userId), feed.map(i => i.card.userId));
  }

  // 2b. Scoring timeout → scorematch_fallback
  {
    const r = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items: feed,
      flagEnabled: true, timeoutMs: 20,
      _scoringFn: hangingScores(),
    });
    assertEq("FB2b: scoring timeout → scorematch_fallback", r.ranker as RankerTag, "scorematch_fallback");
    assertEq("FB2b: original order kept", r.items.map(i => i.card.userId), feed.map(i => i.card.userId));
  }

  // 2c. 60% null scores → scorematch_fallback (3 of 5 items null)
  {
    const sparseScores = makeMap({
      e1: eligEntry(3.5, true),
      e2: eligEntry(2.5, true),
      // b1, e3, c1 absent → null
    });
    const r = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items: feed,
      flagEnabled: true, _scoringFn: fixedScores(sparseScores),
    });
    assertEq("FB2c: 60% null → scorematch_fallback", r.ranker as RankerTag, "scorematch_fallback");
    assertEq("FB2c: original order", r.items.map(i => i.card.userId), feed.map(i => i.card.userId));
  }

  // 2d. Behavior loader throws → learning_model_v1 (ML order preserved)
  {
    const r = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items: feed,
      flagEnabled: true, personalizationEnabled: true,
      _scoringFn: fixedScores(standardScores()),
      _behaviorLoaderFn: throwingBehavior(),
    });
    assertEq("FB2d: behavior throws → learning_model_v1", r.ranker as RankerTag, "learning_model_v1");
    assert("FB2d: same set", sameSet(r.items, feed));
  }

  // 2e. Behavior loader timeout → learning_model_v1
  {
    const r = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items: feed,
      flagEnabled: true, personalizationEnabled: true,
      personalizationTimeoutMs: 20,
      _scoringFn: fixedScores(standardScores()),
      _behaviorLoaderFn: hangingBehavior(),
    });
    assertEq("FB2e: behavior timeout → learning_model_v1", r.ranker as RankerTag, "learning_model_v1");
    assert("FB2e: same set", sameSet(r.items, feed));
  }

  // 2f. Behavior loader returns empty → cold-start → learning_model_v1
  {
    const r = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items: feed,
      flagEnabled: true, personalizationEnabled: true,
      _scoringFn: fixedScores(standardScores()),
      _behaviorLoaderFn: emptyBehavior(),
    });
    assertEq("FB2f: empty behavior → learning_model_v1", r.ranker as RankerTag, "learning_model_v1");
  }

  // 2g. All items ineligible → learning_model_v1 with scoreMatch ordering inside Bucket C
  {
    const allIneligFeed = [item("i1", 80), item("i2", 60), item("i3", 90)];
    const allIneligScores = makeMap({
      i1: eligEntry(3.5, false),
      i2: eligEntry(4.0, false),
      i3: eligEntry(1.0, false),
    });
    const r = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items: allIneligFeed,
      flagEnabled: true,
      _scoringFn: fixedScores(allIneligScores),
    });
    assertEq("FB2g: all ineligible → learning_model_v1", r.ranker as RankerTag, "learning_model_v1");
    assert("FB2g: same set", sameSet(r.items, allIneligFeed));
    // Bucket C is sorted by scoreMatch desc: i3(90) > i1(80) > i2(60)
    assertEq("FB2g: Bucket C scoreMatch ordering", r.items.map(i => i.card.userId), ["i3","i1","i2"]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: Eligibility invariant
// ─────────────────────────────────────────────────────────────────────────────

async function testEligibilityInvariant() {
  console.log("\n── Eligibility invariant ─────────────────────────────────────");

  // 10 random-ish permutations of eligible + ineligible items
  const testCases: Array<{ desc: string; feed: FakeItem[]; scoreMap: ShadowScoreMap }> = [
    {
      desc: "1 ineligible at top (highest SM score)",
      feed: [item("c", 99), item("a", 80), item("b", 60)],
      scoreMap: makeMap({ c: eligEntry(4.0, false), a: eligEntry(3.0, true), b: eligEntry(2.0, true) }),
    },
    {
      desc: "ineligible sandwiched",
      feed: [item("a", 90), item("c", 70), item("b", 50)],
      scoreMap: makeMap({ a: eligEntry(3.5, true), c: eligEntry(4.0, false), b: eligEntry(1.5, true) }),
    },
    {
      desc: "2 ineligible, 1 eligible",
      feed: [item("c1", 90), item("c2", 80), item("e", 10)],
      scoreMap: makeMap({ c1: eligEntry(4.0, false), c2: eligEntry(3.5, false), e: eligEntry(1.0, true) }),
    },
    {
      desc: "personalization active — still no ineligible above eligible",
      feed: [item("c", 99), item("a", 50), item("b", 40)],
      scoreMap: makeMap({ c: eligEntry(4.0, false), a: eligEntry(2.0, true), b: eligEntry(1.5, true) }),
    },
  ];

  for (const tc of testCases) {
    // ML only
    const rML = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items: tc.feed,
      flagEnabled: true, personalizationEnabled: false,
      _scoringFn: fixedScores(tc.scoreMap),
    });
    const eligIds  = new Set(tc.scoreMap ? [...tc.scoreMap].filter(([,e]) => e?.eligibility.eligible_for_model_ranking).map(([id]) => id) : []);
    const ineligIds = new Set(tc.scoreMap ? [...tc.scoreMap].filter(([,e]) => e && !e.eligibility.eligible_for_model_ranking).map(([id]) => id) : []);
    assert(
      `ELIG3 ML [${tc.desc}]: ineligible after eligible`,
      ineligibleAfterEligible(rML.items, eligIds, ineligIds),
      rML.items.map(i => i.card.userId).join(","),
    );

    // With personalization (rich behavior)
    const rPers = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items: tc.feed,
      flagEnabled: true, personalizationEnabled: true,
      _scoringFn: fixedScores(tc.scoreMap),
      _behaviorLoaderFn: richBehavior(richBehaviorEvents()),
    });
    assert(
      `ELIG3 Pers [${tc.desc}]: ineligible after eligible`,
      ineligibleAfterEligible(rPers.items, eligIds, ineligIds),
      rPers.items.map(i => i.card.userId).join(","),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: Personalization invariant
// ─────────────────────────────────────────────────────────────────────────────

async function testPersonalizationInvariant() {
  console.log("\n── Personalization invariant ─────────────────────────────────");
  const feed = standardFeed();
  const scores = standardScores();

  // 4a. Personalization only affects Bucket A — Bucket B (b1) stays after A
  {
    const rML = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items: feed,
      flagEnabled: true, personalizationEnabled: false,
      _scoringFn: fixedScores(scores),
    });
    const rPers = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items: feed,
      flagEnabled: true, personalizationEnabled: true,
      _scoringFn: fixedScores(scores),
      _behaviorLoaderFn: richBehavior(richBehaviorEvents()),
    });

    // b1 (null-scored) and c1 (ineligible) must ALWAYS be at the end, in that order
    const persIds = rPers.items.map(i => i.card.userId);
    const b1Idx = persIds.indexOf("b1");
    const c1Idx = persIds.indexOf("c1");
    const e1Idx = persIds.indexOf("e1");
    const e2Idx = persIds.indexOf("e2");
    const e3Idx = persIds.indexOf("e3");

    assert("PERS4a: b1 after all eligible+scored (Bucket B after A)", b1Idx > Math.max(e1Idx, e2Idx, e3Idx));
    assert("PERS4a: c1 (ineligible) at the very end", c1Idx > b1Idx || (c1Idx > e1Idx && c1Idx > e2Idx && c1Idx > e3Idx));
    assert("PERS4a: same set as ML run", sameSet(rPers.items, rML.items));
    assertEq("PERS4a: length preserved", rPers.items.length, feed.length);
  }

  // 4b. Cold-start = same result as ML-only
  {
    const rML = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items: feed,
      flagEnabled: true, personalizationEnabled: false,
      _scoringFn: fixedScores(scores),
    });
    const rCold = await rankFeedForViewer({
      actorUserId: ACTOR, actorRole: ROLE, items: feed,
      flagEnabled: true, personalizationEnabled: true,
      _scoringFn: fixedScores(scores),
      _behaviorLoaderFn: emptyBehavior(),
    });
    assertEq("PERS4b: cold-start order = ML order",
      rCold.items.map(i => i.card.userId),
      rML.items.map(i => i.card.userId));
    assertEq("PERS4b: cold-start ranker = learning_model_v1", rCold.ranker as RankerTag, "learning_model_v1");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: Determinism
// ─────────────────────────────────────────────────────────────────────────────

async function testDeterminism() {
  console.log("\n── Determinism ───────────────────────────────────────────────");
  const feed = standardFeed();
  const scores = standardScores();
  const events = richBehaviorEvents();

  // Run twice with identical inputs
  const run1 = await rankFeedForViewer({
    actorUserId: ACTOR, actorRole: ROLE, items: feed,
    flagEnabled: true, personalizationEnabled: true,
    _scoringFn: fixedScores(scores),
    _behaviorLoaderFn: richBehavior(events),
  });
  const run2 = await rankFeedForViewer({
    actorUserId: ACTOR, actorRole: ROLE, items: feed,
    flagEnabled: true, personalizationEnabled: true,
    _scoringFn: fixedScores(scores),
    _behaviorLoaderFn: richBehavior(events),
  });

  assertEq("DET5: identical output across two runs",
    run1.items.map(i => i.card.userId),
    run2.items.map(i => i.card.userId));
  assertEq("DET5: ranker tag deterministic", run1.ranker as RankerTag, run2.ranker as RankerTag);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: Item count and item set preservation (all scenarios)
// ─────────────────────────────────────────────────────────────────────────────

async function testItemPreservation() {
  console.log("\n── Item count/set preservation ──────────────────────────────");
  const feed = standardFeed();
  const scores = standardScores();

  const scenarios: Array<{ name: string; params: Parameters<typeof rankFeedForViewer>[0] }> = [
    { name: "flag-off", params: { actorUserId: ACTOR, actorRole: ROLE, items: feed, flagEnabled: false } },
    { name: "ML-only", params: { actorUserId: ACTOR, actorRole: ROLE, items: feed, flagEnabled: true, _scoringFn: fixedScores(scores) } },
    { name: "ML+pers-cold", params: { actorUserId: ACTOR, actorRole: ROLE, items: feed, flagEnabled: true, personalizationEnabled: true, _scoringFn: fixedScores(scores), _behaviorLoaderFn: emptyBehavior() } },
    { name: "ML+pers-rich", params: { actorUserId: ACTOR, actorRole: ROLE, items: feed, flagEnabled: true, personalizationEnabled: true, _scoringFn: fixedScores(scores), _behaviorLoaderFn: richBehavior(richBehaviorEvents()) } },
    { name: "throw-fallback", params: { actorUserId: ACTOR, actorRole: ROLE, items: feed, flagEnabled: true, _scoringFn: throwingScores() } },
    { name: "timeout-fallback", params: { actorUserId: ACTOR, actorRole: ROLE, items: feed, flagEnabled: true, timeoutMs: 20, _scoringFn: hangingScores() } },
    { name: "behavior-throw", params: { actorUserId: ACTOR, actorRole: ROLE, items: feed, flagEnabled: true, personalizationEnabled: true, _scoringFn: fixedScores(scores), _behaviorLoaderFn: throwingBehavior() } },
  ];

  for (const { name, params } of scenarios) {
    const r = await rankFeedForViewer(params);
    assertEq(`PRES6 [${name}]: length preserved`, r.items.length, feed.length);
    assert(`PRES6 [${name}]: same item set`, sameSet(r.items, feed));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: Impression rows tied to pipeline output
// ─────────────────────────────────────────────────────────────────────────────

async function testImpressionRowPipeline() {
  console.log("\n── Impression row pipeline ───────────────────────────────────");
  const feed = standardFeed();
  const scores = standardScores();

  const r = await rankFeedForViewer({
    actorUserId: ACTOR, actorRole: ROLE, items: feed,
    flagEnabled: true, personalizationEnabled: true,
    _scoringFn: fixedScores(scores),
    _behaviorLoaderFn: richBehavior(richBehaviorEvents()),
  });

  const rows = buildImpressionRows({
    actorUserId: ACTOR, items: r.items, surface: "feed_main",
    ranker: r.ranker, shadowScores: r.shadowScores,
  });

  assertEq("IMP7: row count = item count", rows.length, feed.length);
  assertEq("IMP7: ranker=personalized_v1 in rows", rows[0].ranker, "personalized_v1");
  assert("IMP7: feed_positions are 1-indexed sequential",
    rows.every((row, i) => row.feed_position === i + 1));
  // Ineligible item (c1) should appear at the end — its row should have the highest feed_position
  const c1Row = rows.find(row => row.target_user_id === "c1");
  const c1Pos = c1Row?.feed_position ?? -1;
  assert("IMP7: ineligible c1 row has highest feed_position", c1Pos === feed.length);
  // All actors should be set
  assert("IMP7: all rows have actor_user_id", rows.every(r => r.actor_user_id === ACTOR));
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Phase 18 — Full-System Integration Validation");
  console.log("═══════════════════════════════════════════════════════════════");

  await testFlagMatrix();
  await testFallbackGrid();
  await testEligibilityInvariant();
  await testPersonalizationInvariant();
  await testDeterminism();
  await testItemPreservation();
  await testImpressionRowPipeline();

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
}

main().catch((err) => {
  console.error("\nFATAL ERROR in validation harness:", err);
  process.exit(1);
});
