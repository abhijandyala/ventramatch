/**
 * Application status state machine. Pure functions, no DB access — keep it
 * trivially testable. The single source of truth for which transitions are
 * legal; both the founder and investor server actions defer to this.
 *
 * Founder-decided constraints baked in here:
 *   - 1 free auto-resubmit. After that, the user must use the (human) appeal
 *     flow. We track this on `applications.resubmit_count`.
 *   - Bot can never set a terminal status; that's enforced at the DB layer
 *     too (constraint `applications_terminal_requires_human` in 0005).
 *   - Editing an `accepted` profile in-place is deferred. For now, an
 *     accepted user must contact support to change their profile.
 */

import type { ApplicationStatus } from "@/types/database";

export const MAX_FREE_RESUBMITS = 1;

export type SubmitTransition =
  | {
      ok: true;
      nextStatus: ApplicationStatus;
      nextResubmitCount: number;
      resetDecision: boolean;
    }
  | { ok: false; reason: string };

export type DraftTransition =
  | { ok: true; nextStatus: ApplicationStatus }
  | { ok: false; reason: string };

export function nextSubmit(
  current: ApplicationStatus,
  resubmitCount: number,
): SubmitTransition {
  switch (current) {
    case "unverified":
    case "draft":
      return {
        ok: true,
        nextStatus: "submitted",
        nextResubmitCount: resubmitCount,
        resetDecision: true,
      };
    case "submitted":
      return {
        ok: false,
        reason: "Your application is already in the queue.",
      };
    case "under_review":
      return {
        ok: false,
        reason: "A reviewer is looking at your application now. Please wait for the email.",
      };
    case "needs_changes":
      if (resubmitCount < MAX_FREE_RESUBMITS) {
        return {
          ok: true,
          nextStatus: "submitted",
          nextResubmitCount: resubmitCount + 1,
          resetDecision: true,
        };
      }
      return {
        ok: false,
        reason: "You've used your free resubmission. Open an appeal to request another review.",
      };
    case "accepted":
      return {
        ok: false,
        reason: "Your profile is already verified. Contact support to edit it.",
      };
    case "rejected":
      if (resubmitCount < MAX_FREE_RESUBMITS) {
        return {
          ok: true,
          nextStatus: "submitted",
          nextResubmitCount: resubmitCount + 1,
          resetDecision: true,
        };
      }
      return {
        ok: false,
        reason: "You've used your free resubmission. Open an appeal to keep going.",
      };
    case "banned":
      return {
        ok: false,
        reason: "This account is suspended. Contact support if you think this is wrong.",
      };
  }
}

export function nextSaveDraft(current: ApplicationStatus): DraftTransition {
  switch (current) {
    case "unverified":
    case "draft":
      return { ok: true, nextStatus: "draft" };
    case "submitted":
      return {
        ok: false,
        reason: "Your application is already in the queue. You can edit again after the decision lands.",
      };
    case "under_review":
      return {
        ok: false,
        reason: "A reviewer is looking at your application. Please wait.",
      };
    case "needs_changes":
    case "rejected":
      // Keep the bounced-back status so the user (and the queue) remember
      // why they're here. Just persist the new field values.
      return { ok: true, nextStatus: current };
    case "accepted":
      return {
        ok: false,
        reason: "Your profile is verified. Contact support to edit it.",
      };
    case "banned":
      return {
        ok: false,
        reason: "This account is suspended.",
      };
  }
}
