"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  respondIntroAction,
  withdrawIntroAction,
} from "@/app/(dashboard)/inbox/actions";

/**
 * Action panel mounted at the bottom of /inbox/[introId].
 *
 * Two flavors:
 *   • Recipient + status='pending' → Accept (with optional time pick) | Decline
 *   • Sender + status='pending' → Withdraw
 *   • Anyone else / non-pending → null
 */

type Props =
  | {
      kind: "respond";
      introId: string;
      proposedTimes: string[];
    }
  | {
      kind: "withdraw";
      introId: string;
    };

export function RespondPanel(props: Props) {
  if (props.kind === "respond") {
    return <RespondView introId={props.introId} proposedTimes={props.proposedTimes} />;
  }
  return <WithdrawView introId={props.introId} />;
}

function RespondView({
  introId,
  proposedTimes,
}: {
  introId: string;
  proposedTimes: string[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "accepting" | "declining">("idle");
  const [pickedTime, setPickedTime] = useState<string | "">(proposedTimes[0] ?? "");
  const [responseMessage, setResponseMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(action: "accept" | "decline") {
    setError(null);
    startTransition(async () => {
      const res = await respondIntroAction({
        introId,
        action,
        acceptedTime: action === "accept" && pickedTime ? pickedTime : undefined,
        responseMessage: responseMessage.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  if (mode === "idle") {
    return (
      <div className="flex flex-col gap-3 border bg-[var(--color-surface)] p-5" style={{ borderColor: "var(--color-border)" }}>
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
          Respond
        </p>
        <p className="text-[13px] leading-[1.55] text-[var(--color-text-muted)]">
          Take the call, or decline cleanly. Either way they get notified.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("accepting")}
            className="inline-flex h-9 items-center px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--color-brand)" }}
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => setMode("declining")}
            className="inline-flex h-9 items-center px-4 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
          >
            Decline
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 border bg-[var(--color-surface)] p-5" style={{ borderColor: "var(--color-border)" }}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
        {mode === "accepting" ? "Accept this request" : "Decline this request"}
      </p>

      {mode === "accepting" && proposedTimes.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
            Pick a time
          </span>
          <div className="flex flex-col gap-2">
            {proposedTimes.map((iso) => {
              const d = new Date(iso);
              const checked = pickedTime === iso;
              return (
                <label
                  key={iso}
                  className="flex cursor-pointer items-center gap-3 border bg-[var(--color-bg)] px-3 py-2 text-[13px] text-[var(--color-text)] transition-colors hover:border-[var(--color-text-faint)]"
                  style={{
                    borderColor: checked ? "var(--color-text-strong)" : "var(--color-border)",
                  }}
                >
                  <input
                    type="radio"
                    name="picked-time"
                    value={iso}
                    checked={checked}
                    onChange={() => setPickedTime(iso)}
                    className="accent-[var(--color-brand)]"
                  />
                  <span className="font-mono">{formatTime(d)}</span>
                </label>
              );
            })}
            <label
              className="flex cursor-pointer items-center gap-3 border border-dashed bg-[var(--color-bg)] px-3 py-2 text-[12.5px] text-[var(--color-text-muted)]"
              style={{ borderColor: "var(--color-border)" }}
            >
              <input
                type="radio"
                name="picked-time"
                value=""
                checked={pickedTime === ""}
                onChange={() => setPickedTime("")}
                className="accent-[var(--color-brand)]"
              />
              <span>None — let&apos;s sort timing over email</span>
            </label>
          </div>
        </div>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
          Your reply (optional)
        </span>
        <textarea
          rows={3}
          value={responseMessage}
          maxLength={500}
          onChange={(e) => setResponseMessage(e.target.value)}
          placeholder={
            mode === "accepting"
              ? "Looking forward to it. I'll send a calendar invite to the email on file."
              : "Thanks for the intro. Not a fit for our current focus, but happy to revisit later."
          }
          className="resize-y border bg-[var(--color-bg)] px-3 py-2 font-sans text-[13px] leading-[1.55] text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text)]"
          style={{ borderColor: "var(--color-border)" }}
        />
      </label>

      {error ? (
        <p role="alert" className="border-l-2 border-[var(--color-danger)] pl-3 text-[12px] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] pt-4">
        <button
          type="button"
          onClick={() => setMode("idle")}
          className="inline-flex h-9 items-center px-4 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => submit(mode === "accepting" ? "accept" : "decline")}
          disabled={isPending}
          className="inline-flex h-9 items-center gap-1.5 px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background: mode === "accepting" ? "var(--color-brand)" : "var(--color-text-strong)",
          }}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {mode === "accepting" ? "Confirm accept" : "Confirm decline"}
        </button>
      </div>
    </div>
  );
}

function WithdrawView({ introId }: { introId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function withdraw() {
    setError(null);
    startTransition(async () => {
      const res = await withdrawIntroAction({ introId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 border bg-[var(--color-surface)] p-4" style={{ borderColor: "var(--color-border)" }}>
      <div className="flex flex-col gap-1">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
          Sent · Awaiting reply
        </p>
        <p className="text-[12.5px] text-[var(--color-text-muted)]">
          Change your mind? Withdraw it before they reply.
        </p>
        {error ? <p className="text-[12px] text-[var(--color-danger)]">{error}</p> : null}
      </div>
      {confirming ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="inline-flex h-9 items-center px-3 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={withdraw}
            disabled={isPending}
            className="inline-flex h-9 items-center gap-1.5 px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: "var(--color-text-strong)" }}
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Confirm withdraw
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex h-9 items-center px-4 text-[13px] font-medium text-[var(--color-text-muted)] underline-offset-4 transition-colors hover:text-[var(--color-text-strong)] hover:underline"
        >
          Withdraw
        </button>
      )}
    </div>
  );
}

function formatTime(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
