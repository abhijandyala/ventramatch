/**
 * lib/quality/ruleset-version.ts
 *
 * Canonical version of the profile quality rules engine.
 *
 * Rules to bump version:
 *   PATCH (0.0.x) — Add a new rule or tighten a threshold without changing
 *                   any existing rule's verdict for previously-clean profiles.
 *   MINOR (0.x.0) — Add a new rule category (e.g. Phase 13b buzzword rules).
 *                   Existing profiles may receive new flags they did not have
 *                   before, but no previously-accepted profile is auto-declined.
 *   MAJOR (x.0.0) — A structural change that may flip existing verdicts
 *                   (e.g. a previously-warning rule becomes a block).
 *                   Requires re-running the bot pass on all live applications
 *                   in the `submitted` and `under_review` queue.
 *
 * This constant is recorded in `application_reviews.reviewer_id` as
 * `'rules:<RULESET_VERSION>'` (e.g. 'rules:0.1.0') so human reviewers
 * can trace which rules produced a given bot recommendation.
 *
 * Phase 13a ships: field-shape checks only.
 * Phase 13b will add: buzzword density, numeric realism, cross-field
 *   consistency, spam patterns, format safety.
 */

export const RULESET_VERSION = "0.1.0";
