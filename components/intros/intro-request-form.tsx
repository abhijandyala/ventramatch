"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Loader2, Plus, X } from "lucide-react";
import { sendIntroAction } from "@/app/(dashboard)/inbox/actions";

/**
 * Used in two places:
 *   • /matches list (compact version, expand-to-fill row)
 *   • /p/[userId] (full inline card under the profile when matched)
 *
 * Inputs:
 *   • Message: 5-800 chars, with live count
 *   • 1-3 proposed times: datetime-local pickers stored as ISO UTC strings
 *   • Optional link
 *
 * On success it routes to the new intro detail page so the user sees their
 * sent state immediately.
 */

type Props = {
  matchId: string;
  recipientName: string;
  /** Drop-in copy for the headline. Default: "Send intro request" */
  title?: string;
  onCancel?: () => void;
};

const MAX_MESSAGE = 800;
const MIN_MESSAGE = 5;

export function IntroRequestForm({ matchId, recipientName, title = "Send intro request", onCancel }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [times, setTimes] = useState<string[]>([""]);
  const [linkUrl, setLinkUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const messageLen = message.trim().length;
  const messageOk = messageLen >= MIN_MESSAGE && messageLen <= MAX_MESSAGE;
  const timesIso = times
    .filter((t) => t.trim().length > 0)
    .map((t) => new Date(t).toISOString());
  const timesValid = timesIso.length > 0 && timesIso.every((t) => new Date(t).getTime() > Date.now());
  const canSubmit = messageOk && timesValid && !isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;

    startTransition(async () => {
      const res = await sendIntroAction({
        matchId,
        message: message.trim(),
        proposedTimes: timesIso,
        linkUrl: linkUrl.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/inbox/${res.introId}` as Route);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 border bg-[var(--color-surface)] p-5"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[14px] font-semibold tracking-tight text-[var(--color-text-strong)]">
          {title}
        </h3>
        <span className="text-[11px] text-[var(--color-text-faint)]">
          To: <span className="text-[var(--color-text-muted)]">{recipientName}</span>
        </span>
      </div>

      {/* Message */}
      <label className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
          <span>Why this conversation?</span>
          <span
            className={messageLen > MAX_MESSAGE ? "text-[var(--color-danger)]" : ""}
          >
            {messageLen} / {MAX_MESSAGE}
          </span>
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="60-second pitch. What you want from this call. Why now."
          rows={5}
          maxLength={MAX_MESSAGE + 100}
          className="resize-y border bg-[var(--color-bg)] px-3 py-2 font-sans text-[13px] leading-[1.55] text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text)]"
          style={{ borderColor: "var(--color-border)" }}
        />
      </label>

      {/* Proposed times */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
          Times you&apos;re free (1–3)
        </span>
        {times.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={t}
              onChange={(e) => {
                const next = [...times];
                next[i] = e.target.value;
                setTimes(next);
              }}
              className="flex-1 border bg-[var(--color-bg)] px-3 py-2 font-mono text-[12.5px] text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text)]"
              style={{ borderColor: "var(--color-border)" }}
            />
            {times.length > 1 ? (
              <button
                type="button"
                onClick={() => setTimes(times.filter((_, j) => j !== i))}
                aria-label="Remove time"
                className="grid h-9 w-9 place-items-center text-[var(--color-text-faint)] transition-colors hover:text-[var(--color-text-strong)]"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        ))}
        {times.length < 3 ? (
          <button
            type="button"
            onClick={() => setTimes([...times, ""])}
            className="inline-flex w-fit items-center gap-1 text-[12px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
          >
            <Plus size={12} /> Add another time
          </button>
        ) : null}
        <p className="text-[11px] text-[var(--color-text-faint)]">
          We&apos;ll show your timezone to the recipient automatically.
        </p>
      </div>

      {/* Optional link */}
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
          One link (optional)
        </span>
        <input
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="https://… (deck, memo, demo)"
          className="border bg-[var(--color-bg)] px-3 py-2 font-mono text-[12.5px] text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text)]"
          style={{ borderColor: "var(--color-border)" }}
        />
      </label>

      {error ? (
        <p
          role="alert"
          className="border-l-2 border-[var(--color-danger)] pl-3 text-[12px] text-[var(--color-danger)]"
        >
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] pt-4">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center px-4 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-9 items-center gap-1.5 px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "var(--color-brand)" }}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {isPending ? "Sending…" : "Send request"}
        </button>
      </div>

      <p className="text-[11px] leading-[1.5] text-[var(--color-text-faint)]">
        Sending this expires in 14 days if {recipientName} doesn&apos;t reply.
        You can withdraw it any time before then.
      </p>
    </form>
  );
}
