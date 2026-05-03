/**
 * lib/quality/rules/spam-patterns.ts
 *
 * Rule category: spam, test data, and garbage content in text fields.
 *
 * These checks look for patterns in the CONTENT of pitch and thesis text
 * (not just names — those are handled in field-shape.ts) that suggest
 * filler, placeholder, or automated spam.
 *
 * Phase 13b checks:
 *   • Lorem ipsum placeholder text
 *   • Repeated character sequences (keyboard mashing)
 *   • Sequential keyboard rows in text fields
 *   • Known test/placeholder phrase patterns in content fields
 *   • All-caps text (shouting / bot-generated content)
 *   • Name matching email local part (automated account signup)
 *
 * Severity guidance:
 *   block   — Clear filler/placeholder (lorem ipsum in a required field).
 *   suspect — Repeated characters, keyboard mash, all-caps name, email prefix
 *             match.  Needs human review.
 *   warning — (reserved; currently unused in this file)
 *
 * Design principle: these checks should not produce false positives on
 * normal short names, abbreviations, or tech jargon.  When in doubt,
 * use `suspect` over `block`.
 */

import type { QualityFlag, StartupQualityInput, InvestorQualityInput } from "../types";

// ── Patterns ──────────────────────────────────────────────────────────────────

/** Lorem ipsum in any form. */
const LOREM_IPSUM = /lorem\s+ipsum/i;

/** Same character repeated 5+ times: "aaaaa", "!!!!!". */
const REPEATED_CHAR = /(.)\1{4,}/;

/**
 * Literal keyboard-mash sequences unlikely to appear in legitimate text.
 *
 * Phase 13c finding: character-class patterns like [qwertyuiop]{6,} produced
 * severe false positives — common English words ("report", "prototype",
 * "property", "router") all have 6+ consecutive chars from the top keyboard
 * row.  Use only literal sequences a human would never type intentionally.
 */
const KEYBOARD_SEQUENCES: RegExp[] = [
  /qwerty/i,   // classic keyboard mash
  /asdfgh/i,   // home-row mash
  /zxcvbn/i,   // bottom-row mash
  /qazwsx/i,   // left-column zigzag
];

/** All-caps check: string with ≥ 6 alphabetic characters that are ALL uppercase. */
const ALL_CAPS_MIN_LETTERS = 6;

/**
 * Phrases that strongly suggest test/placeholder content in
 * pitch or thesis text (not names — field-shape handles names).
 * These patterns are checked on the lowercased text.
 */
const CONTENT_SPAM_PATTERNS: RegExp[] = [
  /^lorem\s+ipsum/i,
  /\btodo\b/i,
  /\bfill\s+in\b/i,
  /\binsert\s+(text|content|description)\b/i,
  /\bplace\s*holder\b/i,
  /\bcoming\s+soon\b/i,
  /^n\/?a$/i,                          // "N/A" as the entire field value
  /^tbd\.?$/i,                         // "TBD"
  /^see\s+(above|below|website)\.?$/i,
  /\btest\s+(company|startup|investor|profile)\b/i,
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function flag(
  code: string,
  severity: QualityFlag["severity"],
  message: string,
  field: string,
  metadata?: Record<string, unknown>,
): QualityFlag {
  return { code, severity, message, field, ...(metadata ? { metadata } : {}) };
}

function str(v: string | null | undefined): string {
  return v?.trim() ?? "";
}

/** True if the text is all-uppercase with enough letters to be meaningful. */
function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, "");
  return letters.length >= ALL_CAPS_MIN_LETTERS && letters === letters.toUpperCase();
}

/** True if the text contains obvious keyboard mashing. */
function hasKeyboardMash(text: string): boolean {
  if (REPEATED_CHAR.test(text)) return true;
  return KEYBOARD_SEQUENCES.some((p) => p.test(text));
}

/**
 * True if the text contains placeholder/filler phrases.
 * Checked on trimmed text — avoids false positives from embedded URLs
 * or technical jargon that happens to contain these short strings.
 */
function hasSpamPhrase(text: string): boolean {
  const trimmed = text.trim();
  return CONTENT_SPAM_PATTERNS.some((p) => p.test(trimmed));
}

/** Extract email local part (before @). */
function emailLocalPart(email: string): string {
  const atIdx = email.indexOf("@");
  return atIdx >= 0 ? email.slice(0, atIdx).toLowerCase().trim() : "";
}

/** Check a content text field for spam patterns. */
function checkContentField(
  text: string,
  fieldName: string,
  fieldLabel: string,
): QualityFlag[] {
  if (!text) return [];
  const flags: QualityFlag[] = [];

  if (LOREM_IPSUM.test(text)) {
    flags.push(flag(
      "lorem_ipsum_content",
      "block",
      `${fieldLabel} contains placeholder "lorem ipsum" text. Please replace it with real content.`,
      fieldName,
    ));
    return flags; // no need to run other checks if it's all placeholder
  }

  if (hasSpamPhrase(text)) {
    flags.push(flag(
      "spam_phrase_in_content",
      "suspect",
      `${fieldLabel} appears to contain placeholder or test content. Please provide a genuine description.`,
      fieldName,
    ));
  }

  if (hasKeyboardMash(text)) {
    flags.push(flag(
      "keyboard_mash_in_content",
      "suspect",
      `${fieldLabel} contains repeated or keyboard-mash character sequences. Please provide a meaningful description.`,
      fieldName,
    ));
  }

  return flags;
}

// ── Startup checks ────────────────────────────────────────────────────────────

export function checkStartupSpamPatterns(input: StartupQualityInput): QualityFlag[] {
  const flags: QualityFlag[] = [];

  // Content field spam checks
  flags.push(...checkContentField(str(input.one_liner), "one_liner", "One-liner"));
  flags.push(...checkContentField(str(input.problem), "problem", "Problem statement"));
  flags.push(...checkContentField(str(input.solution), "solution", "Solution description"));
  flags.push(...checkContentField(str(input.traction), "traction", "Traction description"));

  // All-caps name (already caught by field-shape if it's test data; here we catch SHOUTING)
  const name = str(input.name);
  if (isAllCaps(name)) {
    flags.push(flag(
      "name_all_caps",
      "suspect",
      `Company name "${name}" appears to be in all capital letters. Please use standard title case (e.g. "Acme Corp").`,
      "name",
    ));
  }

  // Name equals email local part
  if (input.email && name) {
    const localPart = emailLocalPart(input.email);
    if (localPart && localPart === name.toLowerCase().replace(/\s+/g, "")) {
      flags.push(flag(
        "name_matches_email_local",
        "suspect",
        "Company name matches the local part of the email address. This may indicate an automated or low-quality sign-up.",
        "name",
        { local_part: localPart },
      ));
    }
  }

  return flags;
}

// ── Investor checks ───────────────────────────────────────────────────────────

export function checkInvestorSpamPatterns(input: InvestorQualityInput): QualityFlag[] {
  const flags: QualityFlag[] = [];

  // Content field spam checks
  flags.push(...checkContentField(str(input.thesis), "thesis", "Investment thesis"));

  // All-caps investor name
  const name = str(input.name);
  if (isAllCaps(name)) {
    flags.push(flag(
      "name_all_caps",
      "suspect",
      `Investor name "${name}" appears to be in all capital letters. Please use standard capitalisation.`,
      "name",
    ));
  }

  // Name equals email local part
  if (input.email && name) {
    const localPart = emailLocalPart(input.email);
    if (localPart && localPart === name.toLowerCase().replace(/\s+/g, "")) {
      flags.push(flag(
        "name_matches_email_local",
        "suspect",
        "Investor name matches the local part of the email address. This may indicate an automated sign-up.",
        "name",
        { local_part: localPart },
      ));
    }
  }

  return flags;
}
