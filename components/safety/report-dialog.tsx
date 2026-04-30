"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { reportUserAction } from "@/lib/safety/actions";
import {
  REPORT_REASON_LABELS,
  type ReportReason,
} from "@/types/database";

const REASONS: ReportReason[] = [
  "spam",
  "harassment",
  "misrepresentation",
  "fraud_or_scam",
  "inappropriate_content",
  "impersonation",
  "other",
];

/**
 * Modal dialog for filing an abuse report.
 *
 * Uses the native <dialog> element so we get focus trap and Esc-to-close
 * for free without pulling in a library. Caller controls open state.
 */
export function ReportDialog({
  open,
  onClose,
  targetUserId,
  targetName,
}: {
  open: boolean;
  onClose: () => void;
  targetUserId: string;
  targetName: string;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [submittedAt, setSubmittedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Sync `open` prop with the imperative <dialog> API.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // Reset state when re-opened so the next report doesn't carry over the
  // previous submission's confirmation screen.
  useEffect(() => {
    if (open) {
      setReason("");
      setDetails("");
      setSubmittedAt(null);
      setError(null);
    }
  }, [open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!reason) {
      setError("Pick a reason.");
      return;
    }
    if (details.trim().length < 10) {
      setError("Tell us a bit more — at least 10 characters.");
      return;
    }
    startTransition(async () => {
      const res = await reportUserAction({
        targetUserId,
        reason: reason as ReportReason,
        details: details.trim(),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSubmittedAt(new Date());
    });
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Click-outside dismiss — <dialog> backdrop swallows clicks but
        // returns the dialog as the target itself.
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-full max-w-[480px] border bg-[var(--color-bg)] p-0 backdrop:bg-black/40"
      style={{ borderColor: "var(--color-border)" }}
    >
      {submittedAt ? (
        <ConfirmationView onClose={onClose} />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4 p-5">
          <header className="flex flex-col gap-1">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--color-text-faint)]">
              Report user
            </p>
            <h2 className="text-[16px] font-semibold tracking-tight text-[var(--color-text-strong)]">
              Report {targetName}
            </h2>
            <p className="text-[12.5px] leading-[1.55] text-[var(--color-text-muted)]">
              Reports go to a human reviewer. We&apos;ll never tell the
              reported user who flagged them.
            </p>
          </header>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
              Reason
            </legend>
            <ul className="flex flex-col gap-1.5">
              {REASONS.map((r) => {
                const checked = reason === r;
                return (
                  <li key={r}>
                    <label
                      className="flex cursor-pointer items-center gap-2 border bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] transition-colors hover:border-[var(--color-text-faint)]"
                      style={{
                        borderColor: checked ? "var(--color-text-strong)" : "var(--color-border)",
                      }}
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        value={r}
                        checked={checked}
                        onChange={() => setReason(r)}
                        className="accent-[var(--color-brand)]"
                      />
                      <span>{REPORT_REASON_LABELS[r]}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
              Details ({details.trim().length} / 2000)
            </span>
            <textarea
              rows={5}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={2000}
              placeholder="What happened? Include dates and any specific text or behavior."
              className="resize-y border bg-[var(--color-surface)] px-3 py-2 font-sans text-[13px] leading-[1.55] text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text)]"
              style={{ borderColor: "var(--color-border)" }}
            />
          </label>

          {error ? (
            <p
              role="alert"
              className="border-l-2 border-[var(--color-danger)] pl-3 text-[12.5px] text-[var(--color-danger)]"
            >
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center px-4 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-9 items-center gap-1.5 px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: "var(--color-text-strong)" }}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              File report
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}

function ConfirmationView({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col gap-4 p-5">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--color-text-faint)]">
          Report submitted
        </p>
        <h2 className="text-[16px] font-semibold tracking-tight text-[var(--color-text-strong)]">
          Thanks — we&apos;re on it.
        </h2>
        <p className="text-[12.5px] leading-[1.55] text-[var(--color-text-muted)]">
          A human reviewer will look at this within 48 hours. If you also
          want them out of your feed and inbox right now, block them from the
          profile menu — that&apos;s instant.
        </p>
      </header>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 items-center px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--color-text-strong)" }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
