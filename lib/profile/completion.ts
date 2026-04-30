import type { Database } from "@/types/database";

/**
 * Profile completion calculator. Drives:
 *   - The dashboard prompt: "Profile 67% complete — finish 4 fields to publish"
 *   - The publish gate: ≥80% required to submit (server-side enforcement)
 *   - The completion ring on the build wizard
 *
 * Pure functions, no I/O. Operates on the canonical `public.startups` and
 * `public.investors` row shapes plus optional depth-table counts.
 * Weights are intentionally NOT equal — deck and check-size carry more
 * weight because they're the highest-signal fields for the matching
 * algorithm and for human reviewers.
 *
 * Tweak the weights table when re-balancing. Don't change the formula.
 */

type StartupRow = Database["public"]["Tables"]["startups"]["Row"];
type InvestorRow = Database["public"]["Tables"]["investors"]["Row"];

export type StartupDepthCounts = {
  teamMembers: number;
  tractionSignals: number;
  hasRoundDetails: boolean;
  // Sprint 9.5 extensions — additive, default to 0/false when not provided
  // so existing callers continue to compile and behave identically.
  hasCapTable?: boolean;
  hasMarketAnalysis?: boolean;
  competitors?: number;
  useOfFundsLines?: number;
};

export type InvestorDepthCounts = {
  teamMembers: number;
  checkBands: number;
  portfolioEntries: number;
  hasTrackRecord: boolean;
  // Sprint 9.5 extensions
  hasDecisionProcess?: boolean;
  valueAddEntries?: number;
  antiPatternEntries?: number;
};

export const MIN_PUBLISH_PCT = 80;

type ChecklistItem = {
  /** Stable id used as React key. */
  id: string;
  /** What the user sees ("Add your pitch deck"). */
  label: string;
  /** Where to send them ("/build#deck"). Anchor hooks into the wizard. */
  href: string;
  /** Did they complete this section? */
  done: boolean;
  /** Weight contribution toward completion %. */
  weight: number;
  /**
   * True for the original base wizard fields. The publish gate (80%) is
   * computed against base items only — depth items are bonus that climb
   * the ranking but never block publishing. Default true so any item that
   * forgets to set this is treated as base.
   */
  base?: boolean;
};

export type CompletionResult = {
  pct: number;
  done: ChecklistItem[];
  missing: ChecklistItem[];
  canPublish: boolean;
};

const filledStr = (v: string | null | undefined, min = 1) =>
  typeof v === "string" && v.trim().length >= min;
const filledNum = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) && v > 0;
const filledArr = (v: unknown[] | null | undefined, min = 1) =>
  Array.isArray(v) && v.length >= min;

// ──────────────────────────────────────────────────────────────────────────
//  Founder
// ──────────────────────────────────────────────────────────────────────────

export function founderCompletion(
  row: StartupRow | null,
  depth?: StartupDepthCounts,
): CompletionResult {
  // No startup row at all = 0%, everything missing.
  const items: ChecklistItem[] = [
    {
      id: "name",
      label: "Add your company name",
      href: "/build",
      done: row ? filledStr(row.name, 2) : false,
      weight: 8,
    },
    {
      id: "oneLiner",
      label: "Write a one-line description",
      href: "/build",
      done: row ? filledStr(row.one_liner, 20) : false,
      weight: 12,
    },
    {
      id: "website",
      label: "Add a website",
      href: "/build",
      done: row ? filledStr(row.website) : false,
      weight: 5,
    },
    {
      id: "industry",
      label: "Pick a primary sector",
      href: "/build",
      done: row ? filledStr(row.industry, 2) : false,
      weight: 8,
    },
    {
      id: "stage",
      label: "Select your stage",
      href: "/build",
      done: row ? Boolean(row.stage) : false,
      weight: 10,
    },
    {
      id: "raise",
      label: "Add your target raise",
      href: "/build",
      done: row ? filledNum(row.raise_amount) : false,
      weight: 10,
    },
    {
      id: "location",
      label: "Add HQ location",
      href: "/build",
      done: row ? filledStr(row.location) : false,
      weight: 5,
    },
    {
      id: "traction",
      label: "Add at least one traction signal",
      href: "/build",
      // Prefer structured traction signals; fall back to freeform string.
      done: depth
        ? depth.tractionSignals > 0
        : row
          ? filledStr(row.traction, 5)
          : false,
      weight: 15,
    },
    {
      id: "deck",
      label: "Link your pitch deck",
      href: "/build",
      done: row ? filledStr(row.deck_url) : false,
      weight: 20,
    },
    // Depth-table items (bonus — never gate publish; only climb completion %).
    {
      id: "team",
      label: "Add at least one team member",
      href: "/build#team",
      done: depth ? depth.teamMembers > 0 : false,
      weight: 5,
      base: false,
    },
    {
      id: "roundDetails",
      label: "Fill in round details",
      href: "/build#round",
      done: depth ? depth.hasRoundDetails : false,
      weight: 2,
      base: false,
    },
    {
      id: "capTable",
      label: "Add a cap-table summary",
      href: "/build#cap-table",
      done: depth?.hasCapTable === true,
      weight: 2,
      base: false,
    },
    {
      id: "useOfFunds",
      label: "Break down use of funds",
      href: "/build#round",
      done: depth ? (depth.useOfFundsLines ?? 0) > 0 : false,
      weight: 2,
      base: false,
    },
    {
      id: "market",
      label: "Add market analysis",
      href: "/build#market",
      done: depth?.hasMarketAnalysis === true,
      weight: 3,
      base: false,
    },
    {
      id: "competitors",
      label: "Name at least one competitor",
      href: "/build#competitors",
      done: depth ? (depth.competitors ?? 0) > 0 : false,
      weight: 3,
      base: false,
    },
  ];

  return summarize(items);
}

// ──────────────────────────────────────────────────────────────────────────
//  Investor
// ──────────────────────────────────────────────────────────────────────────

export function investorCompletion(
  row: InvestorRow | null,
  depth?: InvestorDepthCounts,
): CompletionResult {
  const items: ChecklistItem[] = [
    {
      id: "name",
      label: "Add your name",
      href: "/build/investor",
      done: row ? filledStr(row.name, 2) : false,
      weight: 8,
    },
    {
      id: "firm",
      label: "Add firm name (or mark as solo angel)",
      href: "/build/investor",
      done: row ? row.firm !== null : false,
      weight: 5,
    },
    {
      id: "checkSize",
      label: "Set your check size range",
      href: "/build/investor",
      // Prefer per-stage check bands; fall back to legacy scalar.
      done: depth
        ? depth.checkBands > 0
        : row
          ? filledNum(row.check_min) && filledNum(row.check_max)
          : false,
      weight: 18,
    },
    {
      id: "stages",
      label: "Pick at least one stage you back",
      href: "/build/investor",
      done: row ? filledArr(row.stages) : false,
      weight: 14,
    },
    {
      id: "sectors",
      label: "Pick at least one sector",
      href: "/build/investor",
      done: row ? filledArr(row.sectors) : false,
      weight: 14,
    },
    {
      id: "geographies",
      label: "Pick at least one region",
      href: "/build/investor",
      done: row ? filledArr(row.geographies) : false,
      weight: 10,
    },
    {
      id: "thesis",
      label: "Write your investment thesis",
      href: "/build/investor",
      done: row ? filledStr(row.thesis, 20) : false,
      weight: 15,
    },
    {
      id: "active",
      label: "Mark yourself as active",
      href: "/build/investor",
      done: row ? row.is_active === true : false,
      weight: 5,
    },
    {
      id: "trackRecord",
      label: "Add at least one portfolio entry",
      href: "/build/investor",
      // Now wired to the investor_portfolio child table.
      done: depth
        ? depth.portfolioEntries > 0
        : row
          ? filledStr(row.thesis, 80)
          : false,
      weight: 8,
    },
    // Depth-table bonus items.
    {
      id: "team",
      label: "Add at least one team member",
      href: "/build/investor#team",
      done: depth ? depth.teamMembers > 0 : false,
      weight: 3,
      base: false,
    },
    {
      id: "decisionProcess",
      label: "Document your decision process",
      href: "/build/investor#decision",
      done: depth?.hasDecisionProcess === true,
      weight: 3,
      base: false,
    },
    {
      id: "valueAdd",
      label: "List how you add value beyond capital",
      href: "/build/investor#value-add",
      done: depth ? (depth.valueAddEntries ?? 0) > 0 : false,
      weight: 3,
      base: false,
    },
    {
      id: "antiPatterns",
      label: "Name what you don't want to see (anti-patterns)",
      href: "/build/investor#anti-patterns",
      done: depth ? (depth.antiPatternEntries ?? 0) > 0 : false,
      weight: 2,
      base: false,
    },
  ];

  return summarize(items);
}

function summarize(items: ChecklistItem[]): CompletionResult {
  // Display % uses the FULL list (base + bonus depth items) — so the user
  // sees their profile climb as they fill more depth.
  const totalWeight = items.reduce((sum, x) => sum + x.weight, 0);
  const earned = items
    .filter((x) => x.done)
    .reduce((sum, x) => sum + x.weight, 0);
  const pct = totalWeight === 0 ? 0 : Math.round((earned / totalWeight) * 100);

  // Publish gate is computed against base items ONLY, so adding more depth
  // items (Sprint 9.5) doesn't accidentally lock out previously-publishable
  // partial profiles. base:true is the default — items must opt OUT to be
  // treated as bonus.
  const baseItems = items.filter((x) => x.base !== false);
  const baseTotal = baseItems.reduce((sum, x) => sum + x.weight, 0);
  const baseEarned = baseItems
    .filter((x) => x.done)
    .reduce((sum, x) => sum + x.weight, 0);
  const basePct = baseTotal === 0 ? 0 : Math.round((baseEarned / baseTotal) * 100);

  const done = items.filter((x) => x.done);
  const missing = items.filter((x) => !x.done);
  return {
    pct: Math.min(100, Math.max(0, pct)),
    done,
    missing,
    canPublish: basePct >= MIN_PUBLISH_PCT,
  };
}
