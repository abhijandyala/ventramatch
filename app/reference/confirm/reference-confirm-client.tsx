"use client";

/**
 * Client shell for /reference/confirm — must stay inside a Suspense boundary
 * in page.tsx because useSearchParams() opts the route into CSR bailout during static generation.
 */

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Wordmark } from "@/components/landing/wordmark";
import { confirmReferenceAction, declineReferenceAction } from "./actions";

type Stage =
  | { kind: "form" }
  | { kind: "confirmed"; refereeName: string; requesterName: string | null }
  | { kind: "declined" }
  | { kind: "error"; message: string }
  | { kind: "invalid" };

export function ReferenceConfirmClient() {
  const searchParams = useSearchParams();
  const rawToken = searchParams.get("token") ?? "";

  const [endorsement, setEndorsement] = useState("");
  const [stage, setStage] = useState<Stage>(
    rawToken && rawToken.length === 64 ? { kind: "form" } : { kind: "invalid" },
  );
  const [confirming, startConfirming] = useTransition();
  const [declining, startDeclining] = useTransition();

  function handleConfirm() {
    startConfirming(async () => {
      const res = await confirmReferenceAction(rawToken, endorsement);
      if ("ok" in res && res.ok) {
        setStage({ kind: "confirmed", refereeName: res.refereeName, requesterName: res.requesterName });
      } else if ("kind" in res) {
        if (res.kind === "already_actioned") {
          setStage({ kind: "error", message: "This reference request has already been answered." });
        } else if (res.kind === "expired") {
          setStage({ kind: "error", message: "This reference link has expired. Ask them to resend." });
        } else if (res.kind === "not_found") {
          setStage({ kind: "invalid" });
        } else {
          setStage({ kind: "error", message: (res as { kind: "error"; message: string }).message });
        }
      }
    });
  }

  function handleDecline() {
    startDeclining(async () => {
      const res = await declineReferenceAction(rawToken);
      if ("ok" in res && res.ok) {
        setStage({ kind: "declined" });
      } else if ("kind" in res) {
        if (res.kind === "already_actioned") {
          setStage({ kind: "error", message: "This reference request has already been answered." });
        } else if (res.kind === "expired") {
          setStage({ kind: "error", message: "This reference link has expired." });
        } else if (res.kind === "not_found") {
          setStage({ kind: "invalid" });
        } else {
          setStage({ kind: "error", message: (res as { kind: "error"; message: string }).message });
        }
      }
    });
  }

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-6"
      style={{ background: "var(--color-bg)" }}
    >
      <div className="w-full max-w-[480px]">
        <div className="mb-10 flex justify-center">
          <Wordmark size="md" />
        </div>

        <div
          className="px-8 py-10"
          style={{
            background: "rgba(255,255,255,0.55)",
            backdropFilter: "blur(24px) saturate(140%)",
            WebkitBackdropFilter: "blur(24px) saturate(140%)",
            border: "1px solid rgba(255,255,255,0.45)",
          }}
        >
          {stage.kind === "form" && (
            <FormView
              endorsement={endorsement}
              onEndorsement={setEndorsement}
              onConfirm={handleConfirm}
              onDecline={handleDecline}
              confirming={confirming}
              declining={declining}
            />
          )}
          {stage.kind === "confirmed" && (
            <ConfirmedView
              refereeName={stage.refereeName}
              requesterName={stage.requesterName}
            />
          )}
          {stage.kind === "declined" && <DeclinedView />}
          {stage.kind === "error" && <ErrorView message={stage.message} />}
          {stage.kind === "invalid" && <InvalidView />}
        </div>
      </div>
    </div>
  );
}

function FormView({
  endorsement,
  onEndorsement,
  onConfirm,
  onDecline,
  confirming,
  declining,
}: {
  endorsement: string;
  onEndorsement: (v: string) => void;
  onConfirm: () => void;
  onDecline: () => void;
  confirming: boolean;
  declining: boolean;
}) {
  return (
    <>
      <p className="text-[11px] font-medium tracking-[0.08em] uppercase text-[var(--color-brand)]">
        Reference request
      </p>
      <h1
        className="mt-2 text-[24px] font-semibold tracking-tight text-[var(--color-text-strong)]"
        style={{ lineHeight: 1.15 }}
      >
        Someone asked you for a reference
      </h1>
      <p className="mt-4 text-[14px] leading-[1.6] text-[var(--color-text-muted)]">
        VentraMatch is a platform that matches founders and investors. A member listed you as a
        reference and asked you to vouch for them. Your response will appear as a trust signal on
        their profile.
      </p>

      <div className="mt-7">
        <label className="block text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
          Endorsement{" "}
          <span className="normal-case text-[var(--color-text-muted)]">(optional, max 500 chars)</span>
        </label>
        <textarea
          value={endorsement}
          onChange={(e) => onEndorsement(e.target.value.slice(0, 500))}
          rows={4}
          placeholder='A brief public endorsement — e.g. "Worked together for 3 years, exceptional operator."'
          className="mt-2 block w-full resize-none rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 text-[14px] leading-relaxed text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-text-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--color-text-strong)]"
        />
        <p className="mt-1 text-right text-[11.5px] text-[var(--color-text-faint)]">
          {endorsement.length}/500
        </p>
      </div>

      <div className="mt-7 flex flex-col gap-3">
        <button
          type="button"
          disabled={confirming || declining}
          onClick={onConfirm}
          className="h-11 w-full bg-[var(--color-brand)] px-5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ borderRadius: "var(--radius)" }}
        >
          {confirming ? "Confirming…" : "Confirm reference"}
        </button>
        <button
          type="button"
          disabled={confirming || declining}
          onClick={onDecline}
          className="h-11 w-full border border-[var(--color-border)] px-5 text-[14px] font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] disabled:opacity-50"
          style={{ borderRadius: "var(--radius)" }}
        >
          {declining ? "Declining…" : "Decline"}
        </button>
      </div>

      <p className="mt-7 text-[12px] leading-[1.6] text-[var(--color-text-faint)]">
        Your response is final and cannot be changed. Confirming makes your name, stated
        relationship, and optional endorsement visible to the person who requested it.
      </p>
    </>
  );
}

function ConfirmedView({
  refereeName,
  requesterName,
}: {
  refereeName: string;
  requesterName: string | null;
}) {
  return (
    <>
      <p className="text-[11px] font-medium tracking-[0.08em] uppercase text-[var(--color-brand)]">
        Reference confirmed
      </p>
      <h1
        className="mt-2 text-[24px] font-semibold tracking-tight text-[var(--color-text-strong)]"
        style={{ lineHeight: 1.15 }}
      >
        Thank you, {refereeName.split(" ")[0]}
      </h1>
      <p className="mt-4 text-[14px] leading-[1.6] text-[var(--color-text-muted)]">
        Your reference for{" "}
        <span className="font-medium text-[var(--color-text-strong)]">
          {requesterName ?? "this person"}
        </span>{" "}
        has been confirmed and will appear on their VentraMatch profile. You can close this tab.
      </p>
    </>
  );
}

function DeclinedView() {
  return (
    <>
      <p className="text-[11px] font-medium tracking-[0.08em] uppercase text-[var(--color-text-muted)]">
        Reference declined
      </p>
      <h1
        className="mt-2 text-[24px] font-semibold tracking-tight text-[var(--color-text-strong)]"
        style={{ lineHeight: 1.15 }}
      >
        Response recorded
      </h1>
      <p className="mt-4 text-[14px] leading-[1.6] text-[var(--color-text-muted)]">
        You've declined this reference request. You can close this tab.
      </p>
    </>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <>
      <p className="text-[11px] font-medium tracking-[0.08em] uppercase text-red-600">
        Unable to process
      </p>
      <h1
        className="mt-2 text-[24px] font-semibold tracking-tight text-[var(--color-text-strong)]"
        style={{ lineHeight: 1.15 }}
      >
        Something went wrong
      </h1>
      <p className="mt-4 text-[14px] leading-[1.6] text-[var(--color-text-muted)]">{message}</p>
    </>
  );
}

function InvalidView() {
  return (
    <>
      <p className="text-[11px] font-medium tracking-[0.08em] uppercase text-[var(--color-text-muted)]">
        Invalid link
      </p>
      <h1
        className="mt-2 text-[24px] font-semibold tracking-tight text-[var(--color-text-strong)]"
        style={{ lineHeight: 1.15 }}
      >
        Link not found
      </h1>
      <p className="mt-4 text-[14px] leading-[1.6] text-[var(--color-text-muted)]">
        This reference link is invalid or has already expired. If you were expecting a request, ask
        the sender to resend it.
      </p>
    </>
  );
}
