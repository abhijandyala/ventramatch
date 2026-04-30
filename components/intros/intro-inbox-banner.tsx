import type { Route } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { IntroBadgeCounts } from "@/lib/intros/query";

/**
 * One-line nudge banner. Renders only when the user has pending intros
 * that need their attention.
 *
 * Design choice: this is the closest thing to a "notifications" surface
 * we ship in v1. Rather than a global header bell, we surface it
 * contextually on dashboard, feed, and matches — the three places the
 * user is most likely to look.
 */
export function IntroInboxBanner({ counts }: { counts: IntroBadgeCounts }) {
  if (counts.needsResponse === 0 && counts.awaitingReply === 0) return null;

  const needsResponse = counts.needsResponse > 0;
  const headline = needsResponse
    ? `${counts.needsResponse} intro request${counts.needsResponse === 1 ? "" : "s"} need${counts.needsResponse === 1 ? "s" : ""} your reply`
    : `${counts.awaitingReply} intro request${counts.awaitingReply === 1 ? "" : "s"} awaiting reply`;

  const cta = needsResponse ? "Open inbox" : "View sent";
  const href = (needsResponse ? "/inbox?view=incoming" : "/inbox?view=outgoing") as Route;

  return (
    <Link
      href={href}
      className="mb-4 flex items-center justify-between gap-3 border bg-[var(--color-surface)] px-4 py-3 transition-colors hover:border-[var(--color-text-faint)]"
      style={{
        borderColor: needsResponse ? "var(--color-brand)" : "var(--color-border)",
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        {needsResponse ? (
          <span
            className="grid h-6 min-w-6 place-items-center px-1.5 font-mono text-[11px] font-bold leading-none text-white"
            style={{ background: "var(--color-brand)" }}
          >
            {counts.needsResponse}
          </span>
        ) : (
          <span
            aria-hidden
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]"
          >
            Inbox
          </span>
        )}
        <p className="min-w-0 truncate text-[13px] font-medium text-[var(--color-text-strong)]">
          {headline}
        </p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] font-medium text-[var(--color-text-muted)]">
        {cta}
        <ArrowRight aria-hidden size={12} strokeWidth={1.75} />
      </span>
    </Link>
  );
}
