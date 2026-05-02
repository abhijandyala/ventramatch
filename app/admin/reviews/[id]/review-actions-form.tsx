"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  acceptApplicationAction,
  requestChangesAction,
  declineApplicationAction,
  flagApplicationAction,
  banApplicationAction,
} from "../actions";

type ActionType = "accept" | "request_changes" | "decline" | "flag" | "ban";

const ACTION_CONFIG: Record<
  ActionType,
  { label: string; description: string; danger?: boolean; requireEmail?: boolean }
> = {
  accept:          { label: "Accept",              description: "Profile is ready — admit to the platform.", requireEmail: true },
  request_changes: { label: "Request changes",     description: "Profile has fixable issues — bounce back for revision.", requireEmail: true },
  decline:         { label: "Decline",             description: "Profile cannot be admitted in its current state.", danger: true, requireEmail: true },
  flag:            { label: "Flag for senior review", description: "Keep in queue for a senior reviewer — no user notification.", danger: false },
  ban:             { label: "Ban account",         description: "Suspend this account — use only for clear abuse.", danger: true },
};

export function ReviewActionsForm({
  applicationId,
  prefillReasonCodes,
}: {
  applicationId: string;
  prefillReasonCodes: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected]   = useState<ActionType | null>(null);
  const [notes, setNotes]         = useState("");
  const [summary, setSummary]     = useState("");
  const [reasonInput, setReasonInput] = useState(prefillReasonCodes.join(", "));
  const [error, setError]         = useState<string | null>(null);

  function buildParams() {
    const reasonCodes = reasonInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return { applicationId, notes, summary, reasonCodes };
  }

  function run(actionFn: (p: ReturnType<typeof buildParams>) => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await actionFn(buildParams());
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
      } else {
        // Navigate back to the queue after a successful decision.
        // Cast required by the Next.js typed router.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push("/admin/reviews" as any);
        router.refresh();
      }
    });
  }

  function handleSubmit() {
    if (!selected) { setError("Select a decision."); return; }
    if (!summary.trim()) { setError("Decision summary is required."); return; }

    switch (selected) {
      case "accept":          return run(acceptApplicationAction);
      case "request_changes": return run(requestChangesAction);
      case "decline":         return run(declineApplicationAction);
      case "flag":            return run(flagApplicationAction);
      case "ban":             return run(banApplicationAction);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Action selector */}
      <div className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-faint)]">
          Decision
        </p>
        <div className="flex flex-col gap-1.5">
          {(Object.entries(ACTION_CONFIG) as [ActionType, typeof ACTION_CONFIG[ActionType]][]).map(
            ([key, cfg]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={[
                  "flex flex-col items-start rounded border px-3 py-2.5 text-left transition-colors",
                  selected === key
                    ? cfg.danger
                      ? "border-red-500 bg-red-50"
                      : "border-[var(--color-text-strong)] bg-[var(--color-bg)]"
                    : "border-[var(--color-border)] hover:border-[var(--color-text-faint)]",
                ].join(" ")}
              >
                <span
                  className={`text-[13px] font-medium ${cfg.danger && selected === key ? "text-red-700" : "text-[var(--color-text-strong)]"}`}
                >
                  {cfg.label}
                </span>
                <span className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                  {cfg.description}
                </span>
              </button>
            ),
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] uppercase tracking-wider text-[var(--color-text-faint)]">
          Internal reviewer notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Notes visible only to reviewers (not sent to applicant)."
          className="w-full resize-none rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[13px] text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--color-text-faint)]"
        />
      </div>

      {/* Decision summary — sent to applicant */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] uppercase tracking-wider text-[var(--color-text-faint)]">
          Decision summary <span className="text-red-500">*</span>
          {selected && ACTION_CONFIG[selected].requireEmail && (
            <span className="ml-1 text-[10px] normal-case text-orange-500">(sent to applicant)</span>
          )}
        </label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={2}
          placeholder="Short, plain-language summary for the applicant. No investment language."
          className="w-full resize-none rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[13px] text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--color-text-faint)]"
        />
      </div>

      {/* Reason codes */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] uppercase tracking-wider text-[var(--color-text-faint)]">
          Reason codes (comma-separated, prefilled from bot)
        </label>
        <input
          type="text"
          value={reasonInput}
          onChange={(e) => setReasonInput(e.target.value)}
          placeholder="e.g. website_missing, one_liner_too_short"
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono text-[12px] text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--color-text-faint)]"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || !selected}
        className={[
          "rounded px-4 py-2.5 text-[13px] font-semibold transition-colors",
          selected && ACTION_CONFIG[selected].danger
            ? "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300"
            : "bg-[var(--color-text-strong)] text-[var(--color-bg)] hover:opacity-80 disabled:opacity-40",
        ].join(" ")}
      >
        {isPending ? "Submitting…" : selected ? `Confirm: ${ACTION_CONFIG[selected].label}` : "Select a decision"}
      </button>

      <p className="text-[11px] text-[var(--color-text-faint)]">
        This decision is auditable and permanent for terminal statuses. Bot
        recommendation is advisory — your decision is final.
      </p>
    </div>
  );
}
