"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  pauseAccountAction,
  resumeAccountAction,
  requestDeletionAction,
  cancelDeletionAction,
} from "@/lib/account/actions";

/**
 * Two related controls grouped together so the user sees the lighter option
 * (pause) before the irreversible one (delete).
 */
export function PauseAndDelete({
  email,
  paused,
  deletionRequestedAt,
}: {
  email: string;
  paused: boolean;
  deletionRequestedAt: string | null;
}) {
  return (
    <div className="flex flex-col gap-8">
      <PauseControl paused={paused || Boolean(deletionRequestedAt)} disabled={Boolean(deletionRequestedAt)} />
      <DeleteControl email={email} deletionRequestedAt={deletionRequestedAt} />
    </div>
  );
}

function PauseControl({ paused, disabled }: { paused: boolean; disabled: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    startTransition(async () => {
      const res = paused ? await resumeAccountAction() : await pauseAccountAction();
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="text-[14px] font-medium text-[var(--color-text-strong)]">
          {paused ? "Account paused" : "Pause discovery"}
        </p>
        <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--color-text-muted)]">
          {paused
            ? "Your profile is hidden from the discovery feed. Existing matches and the inbox keep working. Resume any time."
            : "Hide your profile from the discovery feed. Existing matches and the inbox keep working."}
        </p>
        {error ? (
          <p role="alert" className="mt-2 border-l-2 border-[var(--color-danger)] pl-3 text-[12px] text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={isPending || disabled}
        title={disabled ? "Cancel deletion first." : undefined}
        className="inline-flex h-9 items-center gap-1.5 px-4 text-[12.5px] font-medium text-[var(--color-text-strong)] transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {paused ? "Resume" : "Pause"}
      </button>
    </div>
  );
}

function DeleteControl({
  email,
  deletionRequestedAt,
}: {
  email: string;
  deletionRequestedAt: string | null;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (deletionRequestedAt) {
    const reqDate = new Date(deletionRequestedAt);
    const grace = new Date(reqDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    return (
      <div className="border bg-[var(--color-surface)] p-4" style={{ borderColor: "var(--color-danger)" }}>
        <p className="text-[13px] font-semibold text-[var(--color-danger)]">
          Account deletion scheduled
        </p>
        <p className="mt-1.5 text-[12.5px] leading-[1.55] text-[var(--color-text-muted)]">
          Requested {reqDate.toLocaleDateString()} · Hard-deletes {grace.toLocaleDateString()}.
          Your profile is hidden from the feed in the meantime. Cancel any time before the grace
          window ends.
        </p>
        {error ? (
          <p role="alert" className="mt-2 text-[12px] text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await cancelDeletionAction();
              if (!res.ok) setError(res.error);
            });
          }}
          disabled={isPending}
          className="mt-3 inline-flex h-9 items-center gap-1.5 px-4 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: "var(--color-text-strong)" }}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Cancel deletion
        </button>
      </div>
    );
  }

  if (!confirming) {
    return (
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-[14px] font-medium text-[var(--color-text-strong)]">
            Delete account
          </p>
          <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--color-text-muted)]">
            Removes your profile, matches, intros, and personal data after a 30-day grace
            window. You can cancel during the grace window.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex h-9 items-center px-4 text-[12.5px] font-medium text-[var(--color-danger)] transition-opacity hover:underline"
        >
          Delete…
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border p-4" style={{ borderColor: "var(--color-danger)" }}>
      <p className="text-[13px] font-semibold text-[var(--color-text-strong)]">
        Confirm deletion
      </p>
      <p className="text-[12.5px] leading-[1.55] text-[var(--color-text-muted)]">
        Type your email <span className="font-mono text-[var(--color-text-strong)]">{email}</span> to confirm.
        After 30 days, this is irreversible.
      </p>
      <input
        type="email"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        placeholder={email}
        className="border bg-[var(--color-bg)] px-3 py-2 font-mono text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-text)]"
        style={{ borderColor: "var(--color-border)" }}
      />
      {error ? (
        <p role="alert" className="text-[12px] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await requestDeletionAction({ confirmation });
              if (!res.ok) setError(res.error);
            });
          }}
          disabled={isPending || confirmation.trim().toLowerCase() !== email.toLowerCase()}
          className="inline-flex h-9 items-center gap-1.5 px-4 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: "var(--color-danger)" }}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Confirm deletion
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setConfirmation("");
            setError(null);
          }}
          className="inline-flex h-9 items-center px-4 text-[12.5px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
