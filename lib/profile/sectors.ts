/**
 * Canonical sector taxonomy.
 *
 * Why this file exists: prior to Sprint 9.5 there were six different sector
 * lists scattered through the codebase (founder builder, investor builder,
 * onboarding, profile-tabs, dashboard filters, investor depth editor).
 * They disagreed on naming — "Healthcare" vs "Healthtech", "Bio" vs
 * "Biotech", "DevTools" vs "Dev Tools" — which silently broke
 * sector-score matching: a founder with industry="Healthtech" would not
 * match an investor who picked "Healthcare" in their thesis.
 *
 * This module is the single source of truth. Every UI surface that lets
 * a user choose a sector imports from here. The matching algorithm
 * normalises user-stored sector strings through {@link normaliseSector}
 * before comparison so legacy rows continue to match.
 *
 * Design rules:
 *   1. ONE list shared by founders and investors (matching needs equality).
 *   2. Aliases map historical / colloquial names to canonical labels.
 *      Existing rows in `startups.industry` and `investors.sectors[]` may
 *      contain alias values; never rewrite the DB without a real migration
 *      and matched data backfill.
 *   3. Canonical labels are short (<=24 chars) and Title Case for display.
 *   4. Append-only: never remove or rename a canonical label without an
 *      alias entry that preserves the old name.
 */

export const STARTUP_SECTORS = [
  "AI / ML",
  "Fintech",
  "SaaS",
  "Climate / Cleantech",
  "Healthtech",
  "Biotech",
  "DevTools",
  "Cybersecurity",
  "Consumer",
  "EdTech",
  "Marketplace",
  "E-commerce",
  "Hardware",
  "Robotics",
  "Defense",
  "Logistics",
  "Real estate / Proptech",
  "Gaming",
  "Industrial",
  "Data infra",
  "Web3 / Crypto",
  "Future of Work",
  "Govtech",
  "Media",
  "Space / Aerospace",
  "Mobility",
  "Deep Tech",
  "Other",
] as const;

export type Sector = (typeof STARTUP_SECTORS)[number];

/** Investor sectors are the same taxonomy. Re-exported for clarity. */
export const INVESTOR_SECTORS = STARTUP_SECTORS;

/**
 * Lowercased alias → canonical label.
 *
 * Keys are matched after lower-casing the user input. Anything not in this
 * map and not in {@link STARTUP_SECTORS} is treated as a custom value and
 * passes through unchanged (the matching score will still fall back to
 * exact string equality, which is the pre-existing behavior for free text).
 */
const SECTOR_ALIASES: Record<string, Sector> = {
  // Health
  "healthcare": "Healthtech",
  "health tech": "Healthtech",
  "medical": "Healthtech",
  "bio": "Biotech",
  "life sciences": "Biotech",

  // Dev tools / SaaS
  "dev tools": "DevTools",
  "developer tools": "DevTools",
  "infra tools": "DevTools",
  "enterprise saas": "SaaS",
  "b2b saas": "SaaS",
  "b2b": "SaaS",

  // Climate
  "climate": "Climate / Cleantech",
  "cleantech": "Climate / Cleantech",
  "clean tech": "Climate / Cleantech",
  "climate tech": "Climate / Cleantech",
  "energy": "Climate / Cleantech",

  // Crypto / Web3
  "crypto": "Web3 / Crypto",
  "web3": "Web3 / Crypto",
  "crypto / web3": "Web3 / Crypto",
  "blockchain": "Web3 / Crypto",

  // Deep tech
  "deeptech": "Deep Tech",

  // Education
  "edtech": "EdTech",
  "education": "EdTech",

  // Real estate
  "proptech": "Real estate / Proptech",
  "real estate": "Real estate / Proptech",

  // Aerospace
  "space": "Space / Aerospace",
  "aerospace": "Space / Aerospace",

  // Misc
  "ai": "AI / ML",
  "ml": "AI / ML",
  "machine learning": "AI / ML",
  "artificial intelligence": "AI / ML",
  "cyber": "Cybersecurity",
  "security": "Cybersecurity",
  "ecommerce": "E-commerce",
  "marketplaces": "Marketplace",
  "hardware tech": "Hardware",
  "data": "Data infra",
  "data infrastructure": "Data infra",
  "fin": "Fintech",
  "financial services": "Fintech",
  "media tech": "Media",
};

/**
 * Map a user-supplied sector string to its canonical form.
 *
 *   - "Healthcare" → "Healthtech"
 *   - "Web3" → "Web3 / Crypto"
 *   - "AI / ML" → "AI / ML"  (already canonical)
 *   - "Quantum widgets" → "Quantum widgets"  (unknown, passes through)
 *
 * Used by the matching algorithm and any read path that needs to compare
 * two sector strings for equality. UI inputs should write the canonical
 * label directly; this exists primarily for legacy DB rows.
 */
export function normaliseSector(input: string | null | undefined): string {
  if (!input) return "";
  const trimmed = input.trim();
  if (!trimmed) return "";

  // Exact canonical match
  if ((STARTUP_SECTORS as readonly string[]).includes(trimmed)) {
    return trimmed;
  }

  // Case-insensitive canonical match
  const lower = trimmed.toLowerCase();
  for (const canonical of STARTUP_SECTORS) {
    if (canonical.toLowerCase() === lower) return canonical;
  }

  // Alias map
  if (SECTOR_ALIASES[lower]) return SECTOR_ALIASES[lower];

  // Unknown — leave the user's text alone (better to display their phrase
  // than to silently rename it to "Other").
  return trimmed;
}

/** True if `s` is exactly one of the canonical labels. */
export function isCanonicalSector(s: string): s is Sector {
  return (STARTUP_SECTORS as readonly string[]).includes(s);
}

/** Equal-by-canonical-form. Used by sector-match scoring. */
export function sectorsEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  return normaliseSector(a) === normaliseSector(b);
}

/**
 * Test whether the founder's sector is in the investor's sector list,
 * using canonical normalisation on both sides. Used by lib/matching/score.ts.
 */
export function sectorMatches(
  startupIndustry: string | null | undefined,
  investorSectors: readonly string[],
): boolean {
  if (!startupIndustry || investorSectors.length === 0) return false;
  const target = normaliseSector(startupIndustry);
  return investorSectors.some((s) => normaliseSector(s) === target);
}
