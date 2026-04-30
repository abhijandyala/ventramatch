"use client";

import { Loader2 } from "lucide-react";

/**
 * Shared save-state UI used across the profile-building surface.
 *
 * Pre-Sprint 9.5 there were three different save patterns: the wizard's
 * top-right "Save draft / Saving… / Saved 12:34" inline indicator, the
 * depth editor's SaveBar (button + result toast), and the verification
 * panel's ActionBar. Same intent, different visuals. This component
 * collapses all three so a save action looks the same wherever it lives.
 *
 * Two variants:
 *   - "inline"  → compact, no toast. Use as the top-right of a builder
 *                 toolbar where saves happen frequently and the timestamp
 *                 is the main signal.
 *   - "bar"     → button on the left, result message to the right. Use
 *                 below an editable section (depth editor sections,
 *                 verification submissions).
 *
 * The component is presentational only. The caller owns the save call
 * (server action, transition, etc.) and feeds back status + result.
 *
 * Phase F of Sprint 9.5 swaps the existing call sites in for this. Until
 * then this file is unused — that's intentional, it's a Phase A primitive.
 */

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type SaveIndicatorProps = {
  status: SaveStatus;
  /** Stamp displayed when status="saved". Pass new Date() on each successful save. */
  savedAt?: Date | null;
  /** Required when status="error". Short, sentence-case. */
  errorMessage?: string | null;
  /** Click handler for the save button. Caller wires up the actual save. */
  onSave?: () => void;
  /**
   * Button label when idle. Default "Save".
   * Common values: "Save draft", "Save section", "Submit", "Send request".
   */
  label?: string;
  /**
   * Locks the control. Use for accountLabel='in_review' (read-only) and
   * any in-flight publish where we don't want the user to also save a draft.
   */
  disabled?: boolean;
  /** Tooltip for the disabled state, e.g. "Locked while in review". */
  disabledReason?: string;
  variant?: "inline" | "bar";
  /** Override button class for the rare custom case. */
  className?: string;
};

export function SaveIndicator({
  status,
  savedAt = null,
  errorMessage = null,
  onSave,
  label = "Save",
  disabled = false,
  disabledReason,
  variant = "bar",
  className,
}: SaveIndicatorProps) {
  const isSaving = status === "saving";
  const isError = status === "error";
  const isSaved = status === "saved";

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={onSave}
        disabled={disabled || isSaving || !onSave}
        title={disabled ? disabledReason : undefined}
        className={
          className ??
          "inline-flex items-center gap-1.5 text-[12.5px] text-[color:var(--color-text-faint)] transition-colors hover:text-[color:var(--color-text-strong)] disabled:opacity-60"
        }
      >
        {isSaving ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
        <span>
          {disabled
            ? (disabledReason ?? "Read-only")
            : isError
              ? "Couldn't save"
              : isSaving
                ? "Saving…"
                : isSaved && savedAt
                  ? `Saved ${formatTime(savedAt)}`
                  : label}
        </span>
      </button>
    );
  }

  // variant === "bar"
  return (
    <div className="mt-4 flex items-center gap-3">
      <button
        type="button"
        onClick={onSave}
        disabled={disabled || isSaving || !onSave}
        title={disabled ? disabledReason : undefined}
        className={
          className ??
          "h-9 px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        }
        style={{ background: "var(--color-brand)" }}
      >
        <span className="inline-flex items-center gap-1.5">
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          {isSaving ? "Saving…" : label}
        </span>
      </button>

      {isError && errorMessage ? (
        <p
          role="alert"
          className="text-[12.5px] text-[color:var(--color-danger,#dc2626)]"
        >
          {errorMessage}
        </p>
      ) : isSaved ? (
        <p className="text-[12.5px] text-[color:var(--color-text-muted)]">
          {savedAt ? `Saved ${formatTime(savedAt)}` : "Saved."}
        </p>
      ) : null}
    </div>
  );
}

function formatTime(d: Date): string {
  // toLocaleTimeString without seconds for a calmer indicator. The wizard's
  // existing version uses HH:MM:SS — losing seconds here is intentional.
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
