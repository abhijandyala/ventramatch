import type { Database } from "@/types/database";

/**
 * Profile completion calculator. Drives:
 *   - The dashboard prompt: "Profile 67% complete — finish 4 fields to publish"
 *   - The publish gate: ≥80% required to submit (server-side enforcement)
 *   - The completion ring on the build wizard
 *
 * Pure functions, no I/O. Operates on the canonical `public.startups` and
 * `public.investors` row shapes. Weights are intentionally NOT equal —
 * deck and check-size carry more weight because they're the highest-signal
 * fields for the matching algorithm and for human reviewers.
 *
 * Tweak the weights table when re-balancing. Don't change the formula.
 */

type StartupRow = Database["public"]["Tables"]["startups"]["Row"];
type InvestorRow = Database["public"]["Tables"]["investors"]["Row"];

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

export function founderCompletion(row: StartupRow | null): CompletionResult {
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
      weight: 12,
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
      done: row ? filledStr(row.traction, 5) : false,
      weight: 15,
    },
    {
      id: "deck",
      label: "Link your pitch deck",
      href: "/build",
      done: row ? filledStr(row.deck_url) : false,
      weight: 25,
    },
  ];

  return summarize(items);
}

// ──────────────────────────────────────────────────────────────────────────
//  Investor
// ──────────────────────────────────────────────────────────────────────────

export function investorCompletion(row: InvestorRow | null): CompletionResult {
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
      done: row ? filledNum(row.check_min) && filledNum(row.check_max) : false,
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
      weight: 18,
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
      label: "Add at least one recent investment",
      href: "/build/investor",
      // Recent investments aren't on the canonical investors row — this
      // is folded into thesis for now. Wired up properly when we add
      // a `portfolio` table.
      done: row ? filledStr(row.thesis, 80) : false,
      weight: 8,
    },
  ];

  return summarize(items);
}

function summarize(items: ChecklistItem[]): CompletionResult {
  const totalWeight = items.reduce((sum, x) => sum + x.weight, 0);
  const earned = items
    .filter((x) => x.done)
    .reduce((sum, x) => sum + x.weight, 0);
  const pct = totalWeight === 0 ? 0 : Math.round((earned / totalWeight) * 100);
  const done = items.filter((x) => x.done);
  const missing = items.filter((x) => !x.done);
  return {
    pct: Math.min(100, Math.max(0, pct)),
    done,
    missing,
    canPublish: pct >= MIN_PUBLISH_PCT,
  };
}
