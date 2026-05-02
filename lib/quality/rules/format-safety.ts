/**
 * lib/quality/rules/format-safety.ts
 *
 * Rule category: safe format / injection checks and URL validation.
 *
 * All checks are purely string-based — no network calls, no DNS, no HTTP.
 *
 * Severity guidance:
 *   block   — HTML/script injection patterns (security risk; must not publish).
 *   suspect — Burner email domain; unexpected encoding or obfuscation.
 *   warning — Malformed optional URL; excessive raw URLs in pitch text.
 *   info    — (reserved for future soft signals; none in Phase 13b)
 *
 * Phase 13b note: URL format is validated with the standard URL constructor
 * (available in all Node.js and browser environments).  No network is used.
 */

import type { QualityFlag, StartupQualityInput, InvestorQualityInput } from "../types";

// ── Known burner/disposable email domains ────────────────────────────────────
// Curated list of common disposable providers.  Not exhaustive — treat as
// `suspect`, not `block`.  Kept small and manually maintained to reduce
// false positives from legitimate domains.

const BURNER_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamail.info",
  "guerrillamailblock.com",
  "sharklasers.com",
  "grr.la",
  "tempmail.com",
  "throwaway.email",
  "10minutemail.com",
  "10minutemail.net",
  "fakeinbox.com",
  "yopmail.com",
  "spam4.me",
  "trashmail.com",
  "trashmail.at",
  "trashmail.io",
  "mailnull.com",
  "dispostable.com",
  "bugmenot.com",
]);

// ── Dangerous injection patterns ─────────────────────────────────────────────
// Patterns that suggest HTML/script injection in text fields.

const INJECTION_PATTERNS: RegExp[] = [
  /<script[\s>]/i,
  /<\/script>/i,
  /javascript\s*:/i,
  /data\s*:\s*text\/html/i,
  /on(?:click|load|error|mouseover|submit|focus|blur|keydown)\s*=/i,
  /<iframe[\s>]/i,
  /<object[\s>]/i,
  /<embed[\s>]/i,
  /<form[\s>]/i,
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function str(v: string | null | undefined): string {
  return v?.trim() ?? "";
}

function flag(
  code: string,
  severity: QualityFlag["severity"],
  message: string,
  field: string,
  metadata?: Record<string, unknown>,
): QualityFlag {
  return { code, severity, message, field, ...(metadata ? { metadata } : {}) };
}

/** True if the string contains any HTML/script injection pattern. */
function containsInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

/** True if the URL string is well-formed (http/https, no spaces). */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Extract the domain from an email address (lowercase). */
function emailDomain(email: string): string {
  const atIdx = email.lastIndexOf("@");
  return atIdx >= 0 ? email.slice(atIdx + 1).toLowerCase().trim() : "";
}

/** Count the number of URLs in a text string. */
function countUrls(text: string): number {
  const matches = text.match(/https?:\/\/\S+/gi);
  return matches ? matches.length : 0;
}

/** Check a set of text fields for injection patterns. */
function checkInjectionInFields(
  fields: Array<{ value: string; fieldName: string }>,
): QualityFlag[] {
  for (const { value, fieldName } of fields) {
    if (value && containsInjection(value)) {
      return [flag(
        "html_injection_detected",
        "block",
        `The "${fieldName}" field contains HTML or script content that is not allowed. Please remove all HTML tags.`,
        fieldName,
      )];
    }
  }
  return [];
}

// ── Startup checks ────────────────────────────────────────────────────────────

export function checkStartupFormatSafety(input: StartupQualityInput): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const oneLiner = str(input.one_liner);
  const problem = str(input.problem);
  const solution = str(input.solution);
  const website = str(input.website);
  const deckUrl = str(input.deck_url);

  // ── Injection checks in all text fields ───────────────────────────────────
  const injectionFlags = checkInjectionInFields([
    { value: str(input.name), fieldName: "name" },
    { value: oneLiner, fieldName: "one_liner" },
    { value: problem, fieldName: "problem" },
    { value: solution, fieldName: "solution" },
    { value: str(input.traction), fieldName: "traction" },
  ]);
  flags.push(...injectionFlags);

  // ── URL validation ─────────────────────────────────────────────────────────
  if (website && !isValidUrl(website)) {
    flags.push(flag(
      "website_url_malformed",
      "warning",
      `The website URL "${website.slice(0, 80)}" does not appear to be a valid URL. Please use the format https://yourcompany.com.`,
      "website",
    ));
  }

  if (deckUrl && !isValidUrl(deckUrl)) {
    flags.push(flag(
      "deck_url_malformed",
      "warning",
      `The deck URL does not appear to be a valid URL. Please link to a publicly accessible Notion, Docsend, or Google Drive URL.`,
      "deck_url",
    ));
  }

  // ── Excessive URLs in pitch text ──────────────────────────────────────────
  // A one-liner or problem statement that is mostly URLs is a quality signal.
  if (oneLiner) {
    const nUrls = countUrls(oneLiner);
    if (nUrls >= 3) {
      flags.push(flag(
        "pitch_text_excess_urls",
        "warning",
        `The one-liner contains ${nUrls} URLs. Pitch text should describe your startup in plain language, not list links.`,
        "one_liner",
        { url_count: nUrls },
      ));
    }
  }

  // ── Burner email domain ───────────────────────────────────────────────────
  if (input.email) {
    const domain = emailDomain(input.email);
    if (domain && BURNER_DOMAINS.has(domain)) {
      flags.push(flag(
        "email_burner_domain",
        "suspect",
        `The email domain "${domain}" is associated with disposable email services. Please use a company or personal email address.`,
        "email",
        { domain },
      ));
    }
  }

  return flags;
}

// ── Investor checks ───────────────────────────────────────────────────────────

export function checkInvestorFormatSafety(input: InvestorQualityInput): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const thesis = str(input.thesis);

  // ── Injection checks ──────────────────────────────────────────────────────
  const injectionFlags = checkInjectionInFields([
    { value: str(input.name), fieldName: "name" },
    { value: thesis, fieldName: "thesis" },
  ]);
  flags.push(...injectionFlags);

  // ── Excessive URLs in thesis ──────────────────────────────────────────────
  if (thesis) {
    const nUrls = countUrls(thesis);
    if (nUrls >= 3) {
      flags.push(flag(
        "thesis_excess_urls",
        "warning",
        `The investment thesis contains ${nUrls} URLs. A thesis should describe your investment philosophy, not list external resources.`,
        "thesis",
        { url_count: nUrls },
      ));
    }
  }

  // ── Burner email domain ───────────────────────────────────────────────────
  if (input.email) {
    const domain = emailDomain(input.email);
    if (domain && BURNER_DOMAINS.has(domain)) {
      flags.push(flag(
        "email_burner_domain",
        "suspect",
        `The email domain "${domain}" is associated with disposable email services. Please use a professional email address.`,
        "email",
        { domain },
      ));
    }
  }

  return flags;
}
