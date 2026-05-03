/**
 * scripts/quality/run_quality_review.ts
 *
 * Synthetic quality review harness (Phase 13c).
 *
 * ─── NOTICE ──────────────────────────────────────────────────────────────────
 * • All data is ENTIRELY SYNTHETIC.  No real users, founders, or investors.
 * • This is NOT investment advice.
 * • This does NOT predict startup success or investment returns.
 * • This is NEVER wired into production.  It runs offline against synthetic
 *   profiles to validate the rule engine before production wiring (Phase 14).
 * • `scoreMatch` in lib/matching/score.ts is the production baseline and is
 *   not touched by this script.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Usage (from repo root):
 *   npm run quality:synthetic-matches
 *
 * Outputs (gitignored):
 *   data/synthetic-matching/quality/quality_review_report.md
 *   data/synthetic-matching/quality/quality_review.csv
 *   data/synthetic-matching/quality/quality_review_summary.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

// Relative imports — use explicit paths so tsx resolves without tsconfig path aliases.
import { reviewStartup, reviewInvestor } from "../../lib/quality/review";
import { RULESET_VERSION } from "../../lib/quality/ruleset-version";
import type {
  StartupQualityInput,
  InvestorQualityInput,
  ReviewResult,
  ReviewVerdict,
} from "../../lib/quality/types";

// ── Paths ─────────────────────────────────────────────────────────────────────

const REPO_ROOT   = join(__dirname, "..", "..");
const DATA_DIR    = join(REPO_ROOT, "data", "synthetic-matching");
const QUALITY_DIR = join(DATA_DIR, "quality");

const STARTUPS_PATH  = join(DATA_DIR, "startups.json");
const INVESTORS_PATH = join(DATA_DIR, "investors.json");
const REPORT_PATH    = join(QUALITY_DIR, "quality_review_report.md");
const CSV_PATH       = join(QUALITY_DIR, "quality_review.csv");
const SUMMARY_PATH   = join(QUALITY_DIR, "quality_review_summary.json");

// ── Synthetic data types ───────────────────────────────────────────────────────

type SyntheticStartup = {
  id: string;
  name: string;
  one_liner: string;
  problem: string;
  solution: string;
  sectors: string[];
  stage: string;
  raise_amount: number;
  location: string;
  customer_type: string;
  business_model: string;
  traction: string;
  founder_background: string;
  technical_depth?: string;
  distribution_motion?: string;
  onboarding_interests?: string[];
  // Fields not present in synthetic data — handled gracefully
  website?: string | null;
  email?: string | null;
  founded_year?: number | null;
};

type SyntheticInvestor = {
  id: string;
  name: string;
  firm: string;
  investment_thesis: string;
  sectors: string[];
  anti_thesis?: {
    sectors?: string[];
    customer_types?: string[];
    business_models?: string[];
    founder_profiles?: string[];
  };
  stages: string[];
  check_min: number;
  check_max: number;
  geographies: string[];
  customer_type_preference?: string[];
  business_model_preference?: string[];
  lead_or_follow?: string;
  portfolio_style?: string;
  onboarding_interests?: string[];
  is_active?: boolean | null;
};

// ── Profile → QualityInput adapters ──────────────────────────────────────────

function toStartupInput(s: SyntheticStartup): StartupQualityInput {
  return {
    profile_kind:    "startup",
    name:            s.name ?? null,
    one_liner:       s.one_liner ?? null,
    website:         s.website ?? null,
    email:           s.email ?? null,
    problem:         s.problem ?? null,
    solution:        s.solution ?? null,
    founder_background: s.founder_background ?? null,
    founded_year:    s.founded_year ?? null,
    industry:        null,  // legacy field — synthetic data uses startup_sectors
    startup_sectors: Array.isArray(s.sectors) ? s.sectors : [],
    stage:           s.stage ?? null,
    raise_amount:    typeof s.raise_amount === "number" ? s.raise_amount : null,
    location:        s.location ?? null,
    customer_type:   s.customer_type ?? null,
    business_model:  s.business_model ?? null,
    // traction in synthetic data is a tier string ('no_traction', 'arr', etc.)
    // Pass through directly; the rules treat it as freeform text.
    traction:        s.traction ?? null,
    deck_url:        null,   // not in synthetic data
    traction_signals_count: undefined,  // not loaded in harness
    team_members_count:     undefined,
  };
}

function toInvestorInput(inv: SyntheticInvestor): InvestorQualityInput {
  // Extract text snippets from the structured anti_thesis object.
  const antiTexts: string[] = [
    ...(inv.anti_thesis?.founder_profiles ?? []),
    // Could also include sector/customer_type avoidance as text, but they are
    // canonical labels, not descriptive sentences.  Keep only prose entries.
  ].filter((t) => typeof t === "string" && t.trim().length > 0);

  return {
    profile_kind:    "investor",
    name:            inv.name ?? null,
    firm:            inv.firm ?? null,
    thesis:          inv.investment_thesis ?? null,
    email:           null,  // not in synthetic investor data
    sectors:         Array.isArray(inv.sectors)    ? inv.sectors    : [],
    stages:          Array.isArray(inv.stages)     ? inv.stages     : [],
    geographies:     Array.isArray(inv.geographies) ? inv.geographies : [],
    lead_or_follow:  inv.lead_or_follow ?? null,
    check_min:       typeof inv.check_min === "number" ? inv.check_min : null,
    check_max:       typeof inv.check_max === "number" ? inv.check_max : null,
    // Synthetic investors are all "active" by convention (they're crafted to be
    // fully formed; the is_active flag is not present in the data).
    is_active:       inv.is_active ?? true,
    anti_thesis_texts: antiTexts.length > 0 ? antiTexts : undefined,
    check_bands_count:     undefined,
    portfolio_entries_count: undefined,
  };
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

function csvEscape(value: string | number | boolean | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function csvRow(cells: Array<string | number | boolean | null | undefined>): string {
  return cells.map(csvEscape).join(",");
}

// ── Report generation ─────────────────────────────────────────────────────────

type ReviewedProfile = {
  id: string;
  kind: "startup" | "investor";
  name: string;
  result: ReviewResult;
  durationMs: number;
};

function buildCsv(profiles: ReviewedProfile[]): string {
  const header = csvRow([
    "profile_id", "profile_kind", "name",
    "bot_recommendation", "bot_confidence",
    "flag_count", "block_count", "suspect_count", "warning_count", "info_count",
    "decision_reason_codes", "top_flags", "user_visible_summary",
  ]);

  const rows = profiles.map(({ id, kind, name, result }) => {
    const blocks   = result.flags.filter((f) => f.severity === "block").length;
    const suspects = result.flags.filter((f) => f.severity === "suspect").length;
    const warnings = result.flags.filter((f) => f.severity === "warning").length;
    const infos    = result.flags.filter((f) => f.severity === "info").length;
    const topFlags = result.flags.slice(0, 3).map((f) => f.code).join(" | ");

    return csvRow([
      id, kind, name,
      result.bot_recommendation,
      result.bot_confidence,
      result.flags.length, blocks, suspects, warnings, infos,
      result.decision_reason_codes.join("; "),
      topFlags,
      result.user_visible_summary,
    ]);
  });

  return [header, ...rows].join("\n") + "\n";
}

function buildSummary(profiles: ReviewedProfile[], totalMs: number): object {
  const verdictCounts: Record<string, number> = {};
  const verdictByKind: Record<string, Record<string, number>> = {
    startup: {}, investor: {},
  };
  const flagCodeCounts: Record<string, number> = {};
  let maxMs = 0;

  for (const { kind, result, durationMs } of profiles) {
    const verdict = result.bot_recommendation;
    verdictCounts[verdict] = (verdictCounts[verdict] ?? 0) + 1;
    verdictByKind[kind][verdict] = (verdictByKind[kind][verdict] ?? 0) + 1;

    for (const flag of result.flags) {
      flagCodeCounts[flag.code] = (flagCodeCounts[flag.code] ?? 0) + 1;
    }

    if (durationMs > maxMs) maxMs = durationMs;
  }

  const nStartups  = profiles.filter((p) => p.kind === "startup").length;
  const nInvestors = profiles.filter((p) => p.kind === "investor").length;
  const avgMs = profiles.length > 0 ? totalMs / profiles.length : 0;

  const topFlagCodes = Object.entries(flagCodeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([code, count]) => ({ code, count }));

  return {
    generated_at:   new Date().toISOString(),
    ruleset_version: RULESET_VERSION,
    total_profiles:  profiles.length,
    startup_count:   nStartups,
    investor_count:  nInvestors,
    recommendation_distribution: verdictCounts,
    recommendation_by_kind: verdictByKind,
    top_flag_codes:  topFlagCodes,
    performance: {
      total_runtime_ms:   Math.round(totalMs * 10) / 10,
      avg_ms_per_profile: Math.round(avgMs * 100) / 100,
      max_ms_per_profile: Math.round(maxMs * 100) / 100,
    },
  };
}

function buildReport(profiles: ReviewedProfile[], summaryObj: ReturnType<typeof buildSummary>): string {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ") + " UTC";
  const summary = summaryObj as Record<string, unknown>;
  const verdicts = summary.recommendation_distribution as Record<string, number>;
  const byKind   = summary.recommendation_by_kind as Record<string, Record<string, number>>;
  const topFlags = (summary.top_flag_codes as Array<{ code: string; count: number }>);
  const perf     = summary.performance as Record<string, number>;

  const nDeclines    = verdicts["decline"]      ?? 0;
  const nFlags       = verdicts["flag"]         ?? 0;
  const nNeedsChange = verdicts["needs_changes"] ?? 0;
  const nAccepted    = verdicts["accept"]        ?? 0;
  const total        = profiles.length;

  // Strictness heuristic
  const declineRate = nDeclines / Math.max(1, total);
  const changeRate  = (nDeclines + nNeedsChange + nFlags) / Math.max(1, total);
  let strictnessNote: string;
  if (declineRate > 0.20) {
    strictnessNote =
      "⚠️  **Rules appear TOO STRICT**: more than 20% of synthetic profiles are auto-declined. " +
      "Since synthetic profiles are intentionally well-formed, this likely indicates a rule " +
      "threshold that needs loosening. Do not silently adjust — review the declined profiles " +
      "and update the relevant rule with a RULESET_VERSION bump.";
  } else if (declineRate > 0) {
    strictnessNote =
      "ℹ️  A small number of declines were found. Inspect those profiles — they may have " +
      "genuinely incomplete fields OR a rule threshold may need adjustment.";
  } else if (changeRate === 0) {
    strictnessNote =
      "ℹ️  **Rules appear permissive**: all profiles were accepted with no issues. " +
      "This is expected for well-formed synthetic data. If this is a first run, verify " +
      "that the rules are loading correctly by checking that some info/warning flags appear.";
  } else {
    strictnessNote =
      "✅  Rules appear appropriately calibrated for synthetic profiles: no auto-declines, " +
      "some warnings on real-world quality signals (raise size, buzzwords, etc.).";
  }

  const lines: string[] = [
    "# Synthetic Quality Review Report  (Phase 13c)",
    "",
    "> ## ⚠️ SYNTHETIC EXPERIMENTAL DATA — NOT FOR PRODUCTION",
    ">",
    "> - All profiles are **entirely synthetic**.  No real users, founders, or investors.",
    "> - This report is **NOT investment advice**.",
    "> - It does **NOT** predict startup success or investment returns.",
    "> - No results here affect the production feed or scoring system.",
    "> - `scoreMatch` in `lib/matching/score.ts` remains the production baseline.",
    "> - This harness exists to validate rule behavior before Phase 14 production wiring.",
    "",
    `Generated: ${now}`,
    `Ruleset version: ${RULESET_VERSION}`,
    "",
    "---",
    "",
    "## Summary",
    "",
    "| Property | Value |",
    "|---|---|",
    `| Total profiles | ${total} |`,
    `| Startups reviewed | ${summary.startup_count} |`,
    `| Investors reviewed | ${summary.investor_count} |`,
    `| Ruleset version | \`${RULESET_VERSION}\` |`,
    "",
    "## Recommendation Distribution",
    "",
    "| Verdict | Count | % |",
    "|---|---|---|",
    ...Object.entries(verdicts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .map(([v, n]) =>
        `| \`${v}\` | ${n} | ${Math.round(((n as number) / total) * 100)}% |`
      ),
    "",
    "### By Profile Kind",
    "",
    "| Verdict | Startups | Investors |",
    "|---|---|---|",
    ...Array.from(
      new Set([
        ...Object.keys(byKind.startup ?? {}),
        ...Object.keys(byKind.investor ?? {}),
      ])
    ).map((v) =>
      `| \`${v}\` | ${byKind.startup?.[v] ?? 0} | ${byKind.investor?.[v] ?? 0} |`
    ),
    "",
    "## Top Flag Codes",
    "",
    "| Flag code | Count | Notes |",
    "|---|---|---|",
    ...topFlags.slice(0, 10).map(({ code, count }) => {
      const note =
        code === "website_missing"          ? "info — no website in synthetic data"  :
        code === "raise_above_stage_band"   ? "warning — raise > typical band for stage" :
        code === "raise_below_stage_band"   ? "warning — raise < typical band for stage" :
        code === "traction_stage_mismatch"  ? "warning — traction tier vs stage mismatch" :
        code === "buzzword_density_high"    ? "warning — pitch uses generic language" :
        code === "one_liner_too_short"      ? "warning — one_liner < 30 chars" :
        code === "thesis_too_short"         ? "warning — thesis < 50 chars" :
        code === "broad_mandate_thin_thesis"? "warning — broad sectors + thin thesis" :
        "";
      return `| \`${code}\` | ${count} | ${note} |`;
    }),
    "",
    "## Profiles Requiring Attention",
    "",
  ];

  const attn = profiles.filter((p) =>
    ["decline", "flag", "needs_changes"].includes(p.result.bot_recommendation)
  );

  if (attn.length === 0) {
    lines.push("> ✅ No profiles require attention — all received `accept` verdict.");
  } else {
    lines.push(
      `${attn.length} profile(s) received a non-accept verdict:`,
      "",
      "| Profile | Kind | Verdict | Confidence | Top flag |",
      "|---|---|---|---|---|",
      ...attn.map((p) => {
        const topFlag = p.result.flags[0]?.code ?? "—";
        return `| \`${p.id}\` ${p.name} | ${p.kind} | \`${p.result.bot_recommendation}\` | ${p.result.bot_confidence} | \`${topFlag}\` |`;
      }),
    );
  }

  lines.push(
    "",
    "## Performance",
    "",
    "| Metric | Value |",
    "|---|---|",
    `| Total runtime | ${perf.total_runtime_ms} ms |`,
    `| Average per profile | ${perf.avg_ms_per_profile} ms |`,
    `| Max per profile | ${perf.max_ms_per_profile} ms |`,
    `| Budget | < 50 ms per profile |`,
    `| Budget passed | ${perf.max_ms_per_profile < 50 ? "✅ Yes" : "⚠️  No"} |`,
    "",
    "## Interpretation",
    "",
    strictnessNote,
    "",
    "> **Next step:** Once this report shows acceptable behavior (no unexpected declines,",
    "> warnings on plausible quality signals), Phase 14 will wire `lib/quality/review.ts`",
    "> into `app/build/actions.ts` so real submitted profiles write `bot_recommendation`",
    "> and `application_reviews` rows.  Human reviewers will still own terminal decisions.",
    "",
    "---",
    "",
    "*Synthetic experimental data only.  Not for production use.*",
  );

  return lines.join("\n") + "\n";
}

// ── Main ───────────────────────────────────────────────────────────────────────

function main(): void {
  console.log("\n" + "═".repeat(72));
  console.log("  SYNTHETIC QUALITY REVIEW HARNESS — PHASE 13c");
  console.log("═".repeat(72));
  console.log("  ⚠  All data is SYNTHETIC. Not real user data.");
  console.log("  ⚠  This is NOT investment advice.");
  console.log("═".repeat(72) + "\n");

  // ── Load synthetic data ─────────────────────────────────────────────────────
  if (!existsSync(STARTUPS_PATH) || !existsSync(INVESTORS_PATH)) {
    console.error("ERROR: Synthetic profile files not found.");
    console.error(`  Expected: ${STARTUPS_PATH}`);
    console.error(`  Expected: ${INVESTORS_PATH}`);
    process.exit(1);
  }

  const startups: SyntheticStartup[]  = JSON.parse(readFileSync(STARTUPS_PATH, "utf-8"));
  const investors: SyntheticInvestor[] = JSON.parse(readFileSync(INVESTORS_PATH, "utf-8"));
  console.log(`  Loaded ${startups.length} startups, ${investors.length} investors.\n`);

  // ── Run reviews ─────────────────────────────────────────────────────────────
  const reviewed: ReviewedProfile[] = [];
  const totalStart = performance.now();

  console.log("  Reviewing startups…");
  for (const s of startups) {
    const input = toStartupInput(s);
    const t0 = performance.now();
    const result = reviewStartup(input);
    const durationMs = performance.now() - t0;
    reviewed.push({ id: s.id, kind: "startup", name: s.name, result, durationMs });

    const icon =
      result.bot_recommendation === "accept"        ? "✓" :
      result.bot_recommendation === "needs_changes"  ? "~" :
      result.bot_recommendation === "decline"        ? "✗" :
      result.bot_recommendation === "flag"           ? "⚑" : "?";
    const flagSummary = result.flags.length > 0
      ? ` [${result.flags.map((f) => f.code).slice(0, 2).join(", ")}${result.flags.length > 2 ? "…" : ""}]`
      : "";
    console.log(
      `    ${icon} ${s.id.padEnd(14)} ${result.bot_recommendation.padEnd(14)} ` +
      `conf=${result.bot_confidence.toFixed(2)} ${durationMs.toFixed(1)}ms${flagSummary}`,
    );
  }

  console.log("\n  Reviewing investors…");
  for (const inv of investors) {
    const input = toInvestorInput(inv);
    const t0 = performance.now();
    const result = reviewInvestor(input);
    const durationMs = performance.now() - t0;
    reviewed.push({ id: inv.id, kind: "investor", name: inv.name, result, durationMs });

    const icon =
      result.bot_recommendation === "accept"        ? "✓" :
      result.bot_recommendation === "needs_changes"  ? "~" :
      result.bot_recommendation === "decline"        ? "✗" :
      result.bot_recommendation === "flag"           ? "⚑" : "?";
    const flagSummary = result.flags.length > 0
      ? ` [${result.flags.map((f) => f.code).slice(0, 2).join(", ")}${result.flags.length > 2 ? "…" : ""}]`
      : "";
    console.log(
      `    ${icon} ${inv.id.padEnd(14)} ${result.bot_recommendation.padEnd(14)} ` +
      `conf=${result.bot_confidence.toFixed(2)} ${durationMs.toFixed(1)}ms${flagSummary}`,
    );
  }

  const totalMs = performance.now() - totalStart;

  // ── Validate ────────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(72));
  console.log("VALIDATION");
  console.log("─".repeat(72));

  let validationPassed = true;

  // Expected counts
  if (reviewed.filter(p => p.kind === "startup").length !== startups.length) {
    console.log(`  ✗ Expected ${startups.length} startup reviews; got fewer.`);
    validationPassed = false;
  }
  if (reviewed.filter(p => p.kind === "investor").length !== investors.length) {
    console.log(`  ✗ Expected ${investors.length} investor reviews; got fewer.`);
    validationPassed = false;
  }

  // No auto-ban
  const bans = reviewed.filter(p => p.result.bot_recommendation === "ban");
  if (bans.length > 0) {
    console.log(`  ✗ ${bans.length} profiles received 'ban' — rules should never auto-ban.`);
    validationPassed = false;
  }

  // No NaN confidence
  const nanConf = reviewed.filter(p => isNaN(p.result.bot_confidence));
  if (nanConf.length > 0) {
    console.log(`  ✗ ${nanConf.length} profiles have NaN confidence.`);
    validationPassed = false;
  }

  // All have summaries and ruleset_version
  const noSummary = reviewed.filter(p => !p.result.user_visible_summary);
  const noVersion = reviewed.filter(p => !p.result.ruleset_version);
  if (noSummary.length > 0) {
    console.log(`  ✗ ${noSummary.length} profiles missing user_visible_summary.`);
    validationPassed = false;
  }
  if (noVersion.length > 0) {
    console.log(`  ✗ ${noVersion.length} profiles missing ruleset_version.`);
    validationPassed = false;
  }

  // Performance budget
  const maxMs = Math.max(...reviewed.map(p => p.durationMs));
  const avgMs = totalMs / reviewed.length;
  if (maxMs >= 50) {
    console.log(`  ⚠  Max per-profile runtime ${maxMs.toFixed(1)}ms ≥ 50ms budget.`);
  }

  // Declines warning
  const declines = reviewed.filter(p => p.result.bot_recommendation === "decline");
  if (declines.length > 0) {
    console.log(
      `  ⚠  ${declines.length} profile(s) auto-declined: ` +
      declines.map(p => p.id).join(", "),
    );
    console.log("     Inspect these profiles — this may indicate a rule that needs loosening.");
  }

  if (validationPassed && bans.length === 0) {
    console.log("  ✓  All validation checks passed.");
  }

  // ── Aggregate stats ─────────────────────────────────────────────────────────
  const verdictCounts: Partial<Record<ReviewVerdict, number>> = {};
  for (const { result } of reviewed) {
    const v = result.bot_recommendation;
    verdictCounts[v] = (verdictCounts[v] ?? 0) + 1;
  }

  console.log("\n" + "─".repeat(72));
  console.log("RESULTS");
  console.log("─".repeat(72));
  for (const [verdict, count] of Object.entries(verdictCounts)) {
    const bar = "█".repeat(Math.round(((count ?? 0) / reviewed.length) * 30));
    console.log(`  ${verdict.padEnd(16)} ${String(count).padStart(3)}  ${bar}`);
  }
  console.log(
    `\n  Total: ${reviewed.length}  |  avg ${avgMs.toFixed(1)}ms/profile  |  max ${maxMs.toFixed(1)}ms`,
  );

  // ── Save artifacts ───────────────────────────────────────────────────────────
  mkdirSync(QUALITY_DIR, { recursive: true });

  const summaryObj = buildSummary(reviewed, totalMs);
  writeFileSync(SUMMARY_PATH, JSON.stringify(summaryObj, null, 2), "utf-8");
  console.log(`\n  ✓  ${SUMMARY_PATH.replace(REPO_ROOT + "/", "")}`);

  writeFileSync(CSV_PATH, buildCsv(reviewed), "utf-8");
  console.log(`  ✓  ${CSV_PATH.replace(REPO_ROOT + "/", "")}`);

  writeFileSync(REPORT_PATH, buildReport(reviewed, summaryObj), "utf-8");
  console.log(`  ✓  ${REPORT_PATH.replace(REPO_ROOT + "/", "")}`);

  console.log("\n" + "═".repeat(72));
  console.log("  Done.  Quality review complete.");
  console.log("  ⚠  Offline experimental only.  Not for production use.");
  console.log("═".repeat(72) + "\n");
}

main();
