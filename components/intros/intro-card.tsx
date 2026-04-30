import type { Route } from "next";
import Link from "next/link";
import type { IntroSummary } from "@/lib/intros/query";
import type { IntroRequestStatus } from "@/types/database";

/**
 * Compact card used in the /inbox list view. One per intro request, showing
 * the relevant snippets at a glance + status pill + relative timestamp.
 *
 * The full conversation view lives at /inbox/[introId].
 */

const STATUS_LABEL: Record<IntroRequestStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

const STATUS_COLORS: Record<
  IntroRequestStatus,
  { bg: string; fg: string; border: string }
> = {
  pending: {
    bg: "var(--color-surface)",
    fg: "var(--color-text-strong)",
    border: "var(--color-text-strong)",
  },
  accepted: {
    bg: "var(--color-brand-tint)",
    fg: "var(--color-brand-strong)",
    border: "var(--color-brand)",
  },
  declined: {
    bg: "var(--color-surface)",
    fg: "var(--color-text-muted)",
    border: "var(--color-border)",
  },
  withdrawn: {
    bg: "var(--color-surface)",
    fg: "var(--color-text-faint)",
    border: "var(--color-border)",
  },
  expired: {
    bg: "var(--color-surface)",
    fg: "var(--color-text-faint)",
    border: "var(--color-border)",
  },
};

export function IntroCard({ intro }: { intro: IntroSummary }) {
  const href = `/inbox/${intro.id}` as Route;
  const isIncoming = intro.direction === "incoming";
  const status = intro.status;
  const colors = STATUS_COLORS[status];
  const otherLabel =
    intro.otherStartupName ??
    intro.otherFirm ??
    (intro.otherRole === "founder" ? "Founder" : "Investor");

  return (
    <Link
      href={href}
      className="flex flex-col gap-3 border bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-text-faint)]"
      style={{ borderColor: "var(--color-border)" }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
            >
              {isIncoming ? "← Incoming" : "→ Outgoing"}
            </span>
            <span
              className="inline-flex items-center px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em]"
              style={{
                background: colors.bg,
                color: colors.fg,
                border: `1px solid ${colors.border}`,
              }}
            >
              {STATUS_LABEL[status]}
            </span>
          </div>
          <p className="mt-1 truncate text-[15px] font-semibold tracking-tight text-[var(--color-text-strong)]">
            {isIncoming ? intro.otherName : `Sent to ${intro.otherName}`}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-muted)]">
            {otherLabel}
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-[var(--color-text-faint)]">
          {relativeTime(intro.createdAt)}
        </span>
      </header>

      <p className="line-clamp-2 text-[13px] leading-[1.55] text-[var(--color-text)]">
        {intro.message}
      </p>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3 text-[11px] text-[var(--color-text-faint)]">
        <span>
          {intro.proposedTimes.length} time{intro.proposedTimes.length === 1 ? "" : "s"} proposed
          {intro.acceptedTime ? ` · ${formatDate(new Date(intro.acceptedTime))} confirmed` : ""}
        </span>
        {status === "pending" && isIncoming ? (
          <span className="font-mono uppercase tracking-[0.08em] text-[var(--color-text-strong)]">
            Needs response
          </span>
        ) : status === "pending" && !isIncoming ? (
          <span>Expires {relativeTime(intro.expiresAt)}</span>
        ) : null}
      </footer>
    </Link>
  );
}

function relativeTime(d: Date): string {
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const min = Math.floor(abs / 60_000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const future = diff > 0;

  if (abs < 60_000) return future ? "in a moment" : "just now";
  if (min < 60) return future ? `in ${min}m` : `${min}m ago`;
  if (hr < 24) return future ? `in ${hr}h` : `${hr}h ago`;
  if (day < 7) return future ? `in ${day}d` : `${day}d ago`;
  return d.toLocaleDateString();
}

function formatDate(d: Date): string {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
