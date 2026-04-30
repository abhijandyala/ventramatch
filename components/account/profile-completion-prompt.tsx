import Link from "next/link";
import type { Route } from "next";
import type { CompletionResult } from "@/lib/profile/completion";
import { MIN_PUBLISH_PCT } from "@/lib/profile/completion";
import type { AccountLabel } from "@/types/database";

/**
 * Prompt block shown on the dashboard (and anywhere we want to nudge a
 * user to finish their profile). Renders nothing for fully verified users
 * with a 100% profile — they don't need a nag.
 *
 * Server component — pass in the precomputed completion result + label.
 */

export function ProfileCompletionPrompt({
  completion,
  accountLabel,
  ctaHref,
}: {
  completion: CompletionResult;
  accountLabel: AccountLabel;
  ctaHref: string;
}) {
  // Already published & verified — nothing to nag about.
  if (accountLabel === "verified" && completion.pct === 100) return null;

  // Banned / rejected handled by AccountStatusBanner; don't double up.
  if (accountLabel === "banned" || accountLabel === "rejected") return null;

  const isInReview = accountLabel === "in_review";
  const canPublish = completion.canPublish;
  const remaining = completion.missing.slice(0, 5);

  const headline = isInReview
    ? "Your profile is in review"
    : canPublish
      ? "Ready to publish"
      : completion.pct >= 50
        ? "Almost there"
        : "Finish your profile";

  const body = isInReview
    ? "We'll email you when the review is done — usually under a minute."
    : canPublish
      ? "You meet the minimum bar. Hit Publish to enter the review queue."
      : `You're at ${completion.pct}% — need ${MIN_PUBLISH_PCT}% to publish. Knock these out:`;

  return (
    <section
      aria-labelledby="completion-prompt-title"
      className="mb-5"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[var(--color-text-faint)]">
            Profile · {completion.pct}% complete
          </p>
          <h3
            id="completion-prompt-title"
            className="mt-1 text-[16px] font-semibold tracking-tight text-[var(--color-text-strong)]"
          >
            {headline}
          </h3>
          <p className="mt-1 text-[13px] leading-[1.5] text-[var(--color-text-muted)]">
            {body}
          </p>
        </div>
        {!isInReview ? (
          <Link
            href={ctaHref as Route}
            className="inline-flex h-9 items-center px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: canPublish ? "var(--color-brand)" : "var(--color-text-strong)" }}
          >
            {canPublish ? "Review & publish" : "Continue building"}
          </Link>
        ) : null}
      </div>

      <ProgressBar pct={completion.pct} />

      {!isInReview && remaining.length > 0 ? (
        <ul className="divide-y divide-[var(--color-border)]">
          {remaining.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-5 py-2.5"
            >
              <span className="flex items-center gap-2 text-[13px] text-[var(--color-text)]">
                <span
                  aria-hidden
                  className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-[var(--color-border-strong,var(--color-border))] text-[10px] text-[var(--color-text-faint)]"
                >
                  ·
                </span>
                {item.label}
              </span>
              <Link
                href={item.href as Route}
                className="text-[12px] font-medium text-[var(--color-text-muted)] underline-offset-4 transition-colors hover:text-[var(--color-text-strong)] hover:underline"
              >
                Add
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Profile completion"
      className="h-1 w-full"
      style={{ background: "var(--color-border)" }}
    >
      <div
        className="h-full transition-all duration-500"
        style={{
          width: `${pct}%`,
          background: pct >= 80 ? "var(--color-brand)" : "var(--color-text-strong)",
        }}
      />
    </div>
  );
}
