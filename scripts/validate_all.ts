#!/usr/bin/env tsx
/**
 * scripts/validate_all.ts
 *
 * Phase 18 meta-runner.
 *
 * Runs all six validation harnesses in sequence, aggregates results,
 * and exits non-zero if any harness failed.  All harnesses run to
 * completion even if one fails (no fail-fast).
 *
 * Run with: npm run validate:all
 *
 * ─── NOTICE ──────────────────────────────────────────────────────────────────
 * Offline only. All harnesses are synthetic. Not investment advice.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { spawnSync } from "child_process";
import { resolve } from "path";

// ── Harness definitions ────────────────────────────────────────────────────

type HarnessResult = {
  name: string;
  script: string;
  ok: boolean;
  durationMs: number;
  lastLines: string;
};

const REPO_ROOT = resolve(__dirname, "..");

const HARNESSES: Array<{ name: string; script: string }> = [
  { name: "Phase 15 — Model features",         script: "scripts/ml/validate_production_features.ts" },
  { name: "Phase 16 — ML ranker",               script: "scripts/ml/validate_ml_ranker.ts" },
  { name: "Phase 17 — Personalization runtime", script: "scripts/ml/validate_personalization_runtime.ts" },
  { name: "Phase 18 — Quality runtime",         script: "scripts/ml/validate_quality_runtime.ts" },
  { name: "Phase 18 — Impression log rows",     script: "scripts/ml/validate_impression_log.ts" },
  { name: "Phase 18 — Integration",             script: "scripts/ml/validate_integration.ts" },
];

// ── Runner ────────────────────────────────────────────────────────────────

function run(harness: { name: string; script: string }): HarnessResult {
  const start = Date.now();
  const result = spawnSync(
    "npx",
    ["tsx", harness.script],
    { cwd: REPO_ROOT, encoding: "utf-8", timeout: 60_000 },
  );
  const durationMs = Date.now() - start;
  const combined = ((result.stdout ?? "") + (result.stderr ?? "")).trim();
  const lines = combined.split("\n");
  const lastLines = lines.slice(-6).join("\n");

  return {
    name:        harness.name,
    script:      harness.script,
    ok:          result.status === 0,
    durationMs,
    lastLines,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────

function main() {
  console.log();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  VentraMatch — Full Validation Suite (Phase 18)");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Running all 6 harnesses (no fail-fast)...\n");

  const harnessResults: HarnessResult[] = [];

  for (const harness of HARNESSES) {
    process.stdout.write(`  ▶  ${harness.name} ...`);
    const result = run(harness);
    harnessResults.push(result);
    const tag = result.ok ? "✓" : "✗";
    const ms  = `${result.durationMs}ms`;
    process.stdout.write(`  ${tag}  (${ms})\n`);
  }

  // ── Summary table ──────────────────────────────────────────────────────

  console.log();
  console.log("─────────────────────────────────────────────────────────────");
  console.log("  SUMMARY");
  console.log("─────────────────────────────────────────────────────────────");
  console.log();

  for (const r of harnessResults) {
    const tag  = r.ok ? "✓  PASS" : "✗  FAIL";
    const dur  = `${r.durationMs}ms`.padStart(7);
    const name = r.name.padEnd(38);
    console.log(`  ${tag}  │  ${dur}  │  ${name}`);
    if (!r.ok) {
      // Print the tail of the failing harness for quick diagnosis.
      const indented = r.lastLines.split("\n").map((l) => "          " + l).join("\n");
      console.log(indented);
    }
  }

  const passed = harnessResults.filter((r) => r.ok).length;
  const failed = harnessResults.filter((r) => !r.ok).length;

  console.log();
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`  ${passed} passed / ${failed} failed / ${harnessResults.length} total`);
  console.log("─────────────────────────────────────────────────────────────");

  if (failed > 0) {
    console.log("\n  ✗  SOME VALIDATORS FAILED — do not ship\n");
    process.exit(1);
  } else {
    console.log("\n  ✓  ALL VALIDATORS PASSED — prototype ready for human testing\n");
    process.exit(0);
  }
}

main();
