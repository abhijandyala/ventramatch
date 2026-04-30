"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { IntroRequestForm } from "./intro-request-form";

/**
 * Client surface that switches between three states for a matched profile:
 *
 *   1. No pending intro → "Request a call" button that expands the form.
 *   2. Pending intro by viewer → link to existing /inbox/[introId] thread.
 *   3. Pending intro from other party → link to inbox to respond.
 *
 * This component is rendered server-side with state already resolved; we
 * only need a tiny client island to handle the expand-form interaction.
 */

type Props =
  | {
      kind: "send";
      matchId: string;
      recipientName: string;
    }
  | {
      kind: "pending-outgoing";
      introId: string;
    }
  | {
      kind: "pending-incoming";
      introId: string;
    };

export function IntroCta(props: Props) {
  const [expanded, setExpanded] = useState(false);

  if (props.kind === "pending-outgoing") {
    return (
      <Link
        href={`/inbox/${props.introId}` as Route}
        className="inline-flex h-10 items-center px-4 text-[13px] font-medium text-[var(--color-text-strong)] underline-offset-4 transition-colors hover:underline"
      >
        You sent an intro · view thread →
      </Link>
    );
  }

  if (props.kind === "pending-incoming") {
    return (
      <Link
        href={`/inbox/${props.introId}` as Route}
        className="inline-flex h-10 items-center gap-1.5 px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        style={{ background: "var(--color-brand)" }}
      >
        Respond to intro request →
      </Link>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="inline-flex h-10 items-center px-5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: "var(--color-brand)" }}
      >
        Request a call →
      </button>
    );
  }

  return (
    <IntroRequestForm
      matchId={props.matchId}
      recipientName={props.recipientName}
      onCancel={() => setExpanded(false)}
    />
  );
}
