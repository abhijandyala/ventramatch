/**
 * lib/quality/buzzwords.ts
 *
 * Curated stoplist of startup-pitch buzzwords for the quality review system.
 *
 * ─── USAGE NOTE ──────────────────────────────────────────────────────────────
 * Phase 13a (field-shape rules) does NOT use this list — it only checks field
 * presence and basic structure.
 *
 * Phase 13b will add the buzzword-density rule category that consumes this
 * list.  The rule will compute:
 *
 *   buzzwordDensity = matchedBuzzwordTokens / totalContentWords
 *
 * Threshold guidance (Phase 13b, subject to tuning):
 *   density > 0.30  → warning:  buzzword_density_high
 *   density > 0.50  with no specific noun → warning + suspect:  vague_pitch
 *
 * Buzzword hits alone should NOT produce 'block' verdicts.  They contribute
 * to the warning count.  The goal is to flag profiles for human attention,
 * not to auto-decline stylistically bad (but otherwise real) pitches.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Editorial rules for this list:
 *   1. Include only terms that are genuinely content-free in the startup-pitch
 *      context ("scalable" says nothing about HOW it scales).
 *   2. Do not include technical nouns that have specific meanings in context
 *      ("machine learning" is a buzzword when unsupported; "transformer
 *      architecture" is not).
 *   3. Maintain in alphabetical order; version-bump RULESET_VERSION on changes.
 *   4. All entries are lowercase; matching is case-insensitive.
 */

export const BUZZWORDS: readonly string[] = [
  "actionable insights",
  "agile",
  "ai-powered",
  "best-in-class",
  "blockchain",
  "category creator",
  "cutting-edge",
  "data-driven",
  "decentralized",
  "democratize",
  "democratizing",
  "disrupt",
  "disrupting",
  "disruption",
  "disruptive",
  "ecosystem",
  "empower",
  "empowering",
  "end-to-end",
  "enterprise-grade",
  "first-mover advantage",
  "flywheel",
  "frictionless",
  "full-stack",
  "game-changer",
  "game-changing",
  "holistic",
  "hyperscale",
  "industry-defining",
  "innovative",
  "leverage",
  "mission-critical",
  "network effects",
  "next-gen",
  "next-generation",
  "omnichannel",
  "paradigm shift",
  "pivot",
  "plug-and-play",
  "proprietary technology",
  "revolutionary",
  "revolutionizing",
  "robust",
  "scalable",
  "scalability",
  "seamless",
  "solution-oriented",
  "state-of-the-art",
  "synergy",
  "synergistic",
  "transformative",
  "turnkey",
  "unicorn",
  "value-add",
  "web3",
  "world-class",
] as const;
