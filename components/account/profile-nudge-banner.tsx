import Link from "next/link";
import type { Route } from "next";
import type { ProfileState, UserRole } from "@/types/database";

/**
 * Sticky banner shown at the top of every (dashboard)-group page until the
 * user's profile is reviewed. Three states:
 *
 *   - none/basic/partial → "Finish your profile to start matching" + CTA to
 *     the role-appropriate /build wizard.
 *   - complete/pending_review → "Profile in review — usually under a minute"
 *     (informational; no CTA, banner is purely a status badge).
 *   - verified | rejected → null. Verified users don't need a nudge;
 *     rejected users are handled by AccountStatusBanner so we don't double up.
 *
 * Server component — pure projection from session state. Safe to render in
 * the (dashboard) layout without an extra DB hit.
 */

const HIDDEN_STATES: ProfileState[] = ["verified", "rejected"];

export function ProfileNudgeBanner({
  profileState,
  role,
}: {
  profileState: ProfileState;
  role: UserRole | null;
}) {
  if (HIDDEN_STATES.includes(profileState)) return null;

  const inReview =
    profileState === "complete" || profileState === "pending_review";

  const buildHref: Route =
    role === "investor" ? "/build/investor" : "/build";

  if (inReview) {
    return (
      <aside
        role="status"
        aria-live="polite"
        className="border-b"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-border)",
          borderTop: "2px solid var(--color-brand)",
        }}
      >
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3 px-4 sm:px-6 py-2.5">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: "var(--color-brand)" }}
          />
          <p className="text-[12.5px] font-medium leading-[1.5] text-[color:var(--color-text-strong)]">
            Profile in review
          </p>
          <p className="hidden text-[12.5px] leading-[1.5] text-[color:var(--color-text-muted)] sm:block">
            We&apos;ll email you when the result lands — usually under a minute.
          </p>
        </div>
      </aside>
    );
  }

  // none / basic / partial — funnel them back to /build.
  return (
    <aside
      role="region"
      aria-label="Finish profile prompt"
      className="border-b"
      style={{
        background: "var(--color-brand-tint)",
        borderColor: "var(--color-brand)",
      }}
    >
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-[color:var(--color-brand-strong)]"
          >
            Action required
          </span>
          <span aria-hidden className="text-[color:var(--color-brand-strong)] opacity-50">·</span>
          <p className="truncate text-[12.5px] font-medium leading-[1.5] text-[color:var(--color-text-strong)]">
            Finish your profile to start matching.
          </p>
        </div>
        <Link
          href={buildHref}
          className="inline-flex h-7 shrink-0 items-center px-3 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--color-brand)" }}
        >
          Continue building →
        </Link>
      </div>
    </aside>
  );
}
