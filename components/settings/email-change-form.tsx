"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  cancelEmailChangeAction,
  requestEmailChangeAction,
} from "@/lib/account/actions";

/**
 * Email change UI that replaces the previous read-only field on /settings.
 *
 * Three states:
 *   • idle    — show current email and a "Change email" button.
 *   • editing — input + Send link / Cancel.
 *   • pending — there's an unconsumed request in the DB. Show "We sent a link
 *     to <newEmail>." + Cancel + Resend (re-uses the same flow).
 *
 * Status messages are also shown when the route handler bounces back here
 * with ?error=...&changed=...
 */

const ERROR_COPY: Record<string, string> = {
  expired: "That link expired. Send yourself a new one.",
  consumed: "That link was already used.",
  taken: "Someone else has claimed that email since you requested the change.",
  invalid_token: "That link is invalid.",
  missing_token: "That link is invalid.",
  server_error: "Something broke on our side. Try again.",
};

export function EmailChangeForm({
  currentEmail,
  pendingNewEmail,
}: {
  currentEmail: string;
  pendingNewEmail: string | null;
}) {
  const searchParams = useSearchParams();
  const flashError = searchParams.get("error");
  const flashChanged = searchParams.get("changed");

  const [stage, setStage] = useState<"idle" | "editing">(
    pendingNewEmail ? "idle" : "idle",
  );
  const [draft, setDraft] = useState("");
  const [serverError, setServerError] = useState<string | null>(
    flashError && ERROR_COPY[flashError] ? ERROR_COPY[flashError] : null,
  );
  const [pendingEmail, setPendingEmail] = useState<string | null>(pendingNewEmail);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    startTransition(async () => {
      const res = await requestEmailChangeAction({ newEmail: draft });
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      setPendingEmail(res.pendingEmail);
      setDraft("");
      setStage("idle");
    });
  }

  function cancelPending() {
    setServerError(null);
    startTransition(async () => {
      const res = await cancelEmailChangeAction();
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      setPendingEmail(null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Current email">
        <div className="flex items-center justify-between gap-3 border bg-[var(--color-surface)] px-3 py-2" style={{ borderColor: "var(--color-border)" }}>
          <span className="font-mono text-[13px] text-[var(--color-text-strong)]">
            {currentEmail}
          </span>
          {flashChanged ? (
            <span className="text-[11.5px] font-medium text-[var(--color-brand-strong)]">
              Updated.
            </span>
          ) : null}
        </div>
      </Field>

      {pendingEmail ? (
        <div
          className="flex flex-col gap-2 border p-3"
          style={{ borderColor: "var(--color-text-strong)" }}
        >
          <p className="text-[12.5px] text-[var(--color-text-strong)]">
            <strong>Pending change.</strong> We sent a confirmation link to{" "}
            <span className="font-mono">{pendingEmail}</span>. The change happens
            when you click it (link expires in 1 hour).
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(pendingEmail);
                setStage("editing");
              }}
              disabled={isPending}
              className="text-[12px] font-medium text-[var(--color-text-muted)] underline-offset-4 transition-colors hover:text-[var(--color-text-strong)] hover:underline disabled:opacity-50"
            >
              Resend
            </button>
            <button
              type="button"
              onClick={cancelPending}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-danger)] underline-offset-4 transition-colors hover:underline disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Cancel pending change
            </button>
          </div>
        </div>
      ) : null}

      {stage === "editing" ? (
        <form onSubmit={submit} className="flex flex-col gap-3 border bg-[var(--color-surface)] p-3" style={{ borderColor: "var(--color-border)" }}>
          <Field
            label="New email"
            hint="We'll send a link to this address. Your email won't change until you click it."
          >
            <input
              type="email"
              autoFocus
              required
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="you@new-domain.com"
              className="w-full border bg-[var(--color-bg)] px-3 py-2 font-mono text-[13px] text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text)]"
              style={{ borderColor: "var(--color-border)" }}
            />
          </Field>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isPending || !draft}
              className="inline-flex h-9 items-center gap-1.5 px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: "var(--color-text-strong)" }}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Send confirmation link
            </button>
            <button
              type="button"
              onClick={() => {
                setStage("idle");
                setServerError(null);
              }}
              className="inline-flex h-9 items-center px-4 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        !pendingEmail && (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              setStage("editing");
              setServerError(null);
            }}
            className="inline-flex h-9 w-fit items-center px-4 text-[13px] font-medium text-[var(--color-text-strong)] underline-offset-4 transition-colors hover:underline"
          >
            Change email →
          </button>
        )
      )}

      {serverError ? (
        <p role="alert" className="border-l-2 border-[var(--color-danger)] pl-3 text-[12.5px] text-[var(--color-danger)]">
          {serverError}
        </p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
        {label}
      </span>
      {children}
      {hint ? <span className="text-[11.5px] text-[var(--color-text-faint)]">{hint}</span> : null}
    </label>
  );
}
