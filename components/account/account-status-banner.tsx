import type { AccountLabel } from "@/types/database";

/**
 * One-line status banner shown above the main content of authenticated
 * surfaces (dashboard, build, profile). Renders nothing for users in a
 * "good" state (verified or unverified-and-still-onboarding) — only fires
 * on states that require user attention.
 *
 * Server component — pass in the label from the session.
 *
 * Phase 14c: accepts an optional `detailHref` that replaces the banner CTA
 * with a link to the detailed application-status page, which shows
 * decision_summary and user-friendly reason-code guidance without exposing
 * any internal bot metadata.
 */

type Tone = "info" | "success" | "warning" | "danger";

type Banner = {
  tone: Tone;
  title: string;
  body: string;
  cta?: { label: string; href: string };
};

const STYLES: Record<Tone, { bg: string; border: string; text: string; titleText: string }> = {
  info: {
    bg: "var(--color-brand-tint)",
    border: "var(--color-brand)",
    text: "var(--color-text-muted)",
    titleText: "var(--color-brand-strong)",
  },
  success: {
    bg: "var(--color-brand-tint)",
    border: "var(--color-brand)",
    text: "var(--color-text-muted)",
    titleText: "var(--color-brand-strong)",
  },
  warning: {
    bg: "var(--color-surface)",
    border: "var(--color-warning, #d97706)",
    text: "var(--color-text-muted)",
    titleText: "var(--color-warning, #d97706)",
  },
  danger: {
    bg: "var(--color-surface)",
    border: "var(--color-danger)",
    text: "var(--color-text-muted)",
    titleText: "var(--color-danger)",
  },
};

function bannerFor(label: AccountLabel, detailHref?: string): Banner | null {
  switch (label) {
    case "in_review":
      return {
        tone: "info",
        title: "Profile in review",
        body: "We're checking your profile. You'll get an email when it's approved or if we need changes.",
        // Phase 14c: link to detailed status page when available
        cta: detailHref ? { label: "View status →", href: detailHref } : undefined,
      };
    case "rejected":
      return {
        tone: "warning",
        title: "Updates needed",
        body: "Your profile needs changes before it can be approved.",
        // Phase 14c: link to detailed status page for decision_summary + reason codes
        cta: { label: "View details →", href: detailHref ?? "/build" },
      };
    case "banned":
      return {
        tone: "danger",
        title: "Account suspended",
        body: "Your account has been suspended for violating our Terms. Contact support if you believe this is a mistake.",
        cta: { label: "Contact support", href: "mailto:support@ventramatch.com" },
      };
    case "verified":
    case "unverified":
    default:
      return null;
  }
}

export function AccountStatusBanner({
  label,
  detailHref,
}: {
  label: AccountLabel;
  /** Optional URL to the detailed application-status page (Phase 14c). */
  detailHref?: string;
}) {
  const banner = bannerFor(label, detailHref);
  if (!banner) return null;

  const s = STYLES[banner.tone];

  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-start justify-between gap-3 px-4 py-3"
      style={{
        background: s.bg,
        borderTop: `2px solid ${s.border}`,
        borderBottom: `1px solid ${s.border}`,
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold tracking-tight" style={{ color: s.titleText }}>
          {banner.title}
        </p>
        <p className="mt-0.5 text-[13px] leading-[1.55]" style={{ color: s.text }}>
          {banner.body}
        </p>
      </div>
      {banner.cta ? (
        <a
          href={banner.cta.href}
          className="inline-flex h-8 items-center px-3 text-[12.5px] font-medium transition-colors"
          style={{
            background: s.titleText,
            color: "white",
          }}
        >
          {banner.cta.label}
        </a>
      ) : null}
    </div>
  );
}
