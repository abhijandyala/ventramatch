import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";

const DANGER_HREF = "/settings/danger";

/**
 * Discovery & matching section content.
 * Server component — reads props computed by the page, no client state.
 *
 * Shows:
 *   • Current discovery status (active / paused / deletion-scheduled)
 *   • Anchor-link to the Danger zone for the pause/resume control
 *   • Matching algorithm dimension breakdown (informational only)
 *   • Link to edit the matching profile in the build wizard
 */

const ALGO_DIMENSIONS = [
  {
    label: "Sector",
    note: "Sector overlap between startup and investor mandate",
    weight: "28%",
  },
  {
    label: "Stage",
    note: "Startup stage vs. investor's stage focus",
    weight: "23%",
  },
  {
    label: "Check size",
    note: "Raise amount vs. investor's check range",
    weight: "20%",
  },
  {
    label: "Geography",
    note: "Startup location vs. investor's geographic focus",
    weight: "14%",
  },
  {
    label: "Traction",
    note: "Structured or freeform traction signal strength",
    weight: "10%",
  },
  {
    label: "Process fit",
    note: "Lead slot availability vs. startup's lead preference",
    weight: "5%",
  },
] as const;

export function DiscoveryStatusCard({
  paused,
  deletionRequestedAt,
  profileEditHref,
}: {
  paused: boolean;
  deletionRequestedAt: string | null;
  profileEditHref: string;
}) {
  const isDeletionScheduled = Boolean(deletionRequestedAt);
  const isHidden = paused || isDeletionScheduled;

  return (
    <div className="flex flex-col gap-7">
      {/* Status banner */}
      <div
        className={cn(
          "border px-4 py-4",
          isDeletionScheduled
            ? "border-[var(--color-danger)] bg-[#fff5f5]"
            : "border-[var(--color-border)] bg-[var(--color-surface-2)]",
        )}
      >
        <div className="flex items-center gap-2.5 mb-1.5">
          <span
            className={cn(
              "inline-block h-2 w-2 shrink-0",
              isDeletionScheduled
                ? "bg-[var(--color-danger)]"
                : isHidden
                  ? "bg-[var(--color-text-faint)]"
                  : "bg-[var(--color-brand)]",
            )}
          />
          <p className="text-[13.5px] font-semibold text-[var(--color-text-strong)]">
            {isDeletionScheduled
              ? "Hidden from discovery — deletion scheduled"
              : isHidden
                ? "Paused — hidden from discovery"
                : "Active in discovery"}
          </p>
        </div>
        <p className="pl-[18px] text-[12.5px] leading-[1.6] text-[var(--color-text-muted)]">
          {isHidden
            ? "Your profile is not visible in the discovery feed. Existing matches and your inbox still work normally."
            : "Your profile may appear in the discovery feed when it fits another user's filters and match score."}
        </p>
        {!isDeletionScheduled ? (
          <Link
            href={DANGER_HREF as Route}
            className="mt-2.5 inline-block pl-[18px] text-[12px] font-medium text-[var(--color-text-muted)] underline-offset-4 transition-colors hover:text-[var(--color-text-strong)] hover:underline"
          >
            {isHidden
              ? "Resume discovery in Danger zone →"
              : "Pause discovery in Danger zone →"}
          </Link>
        ) : (
          <Link
            href={DANGER_HREF as Route}
            className="mt-2.5 inline-block pl-[18px] text-[12px] font-medium text-[var(--color-danger)] underline-offset-4 hover:underline"
          >
            Cancel deletion in Danger zone →
          </Link>
        )}
      </div>

      {/* Algorithm breakdown */}
      <div>
        <p className="mb-3 text-[13px] font-semibold text-[var(--color-text-strong)]">
          How match scores are calculated
        </p>
        <ul className="flex flex-col gap-2.5">
          {ALGO_DIMENSIONS.map((d) => (
            <li key={d.label} className="flex items-baseline gap-3 text-[12.5px]">
              <span className="w-[80px] shrink-0 font-medium text-[var(--color-text-strong)]">
                {d.label}
              </span>
              <span className="flex-1 text-[var(--color-text-muted)]">{d.note}</span>
              <span className="shrink-0 font-mono text-[11px] text-[var(--color-text-faint)]">
                {d.weight}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3.5 text-[11.5px] leading-[1.5] text-[var(--color-text-faint)]">
          Match scores are informational only and are never investment advice.
          Your profile details determine every dimension above.
        </p>
      </div>

      {/* Edit matching profile */}
      <Link
        href={profileEditHref as Route}
        className="inline-flex h-9 w-fit items-center border border-[var(--color-border)] px-4 text-[13px] font-medium text-[var(--color-text-strong)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]"
      >
        Edit matching profile →
      </Link>
    </div>
  );
}
