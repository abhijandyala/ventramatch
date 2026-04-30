import type { Route } from "next";
import Link from "next/link";
import type { RecentViewer } from "@/lib/feed/query";
import { Avatar } from "@/components/profile/avatar";

/**
 * "Who viewed me" rail on the dashboard.
 *
 * Privacy stance:
 *   • Verified viewers → name + role + (firm OR startup) shown, link to profile.
 *   • Unverified viewers → anonymised ("Verified investor explored your profile" / "Founder explored your profile")
 *     so a viewer can't dox themselves before review.
 *
 * Lookback is 30 days; we cap at 8 unique viewers and aggregate repeats.
 */
export function RecentViewersRail({ viewers }: { viewers: RecentViewer[] }) {
  return (
    <section className="mb-5" aria-labelledby="recent-viewers-title">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2
            id="recent-viewers-title"
            className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]"
          >
            Recent profile views
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--color-text-faint)]">
            Last 30 days · unique viewers
          </p>
        </div>
        {viewers.length > 0 ? (
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
            {viewers.length} viewer{viewers.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </header>

      {viewers.length === 0 ? (
        <Empty />
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {viewers.map((v) => (
            <li key={v.viewerId}>
              <ViewerRow viewer={v} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ViewerRow({ viewer }: { viewer: RecentViewer }) {
  const isAnonymous = !viewer.verified || !viewer.name;
  const headline = isAnonymous
    ? viewer.role === "investor"
      ? "An investor"
      : viewer.role === "founder"
        ? "A founder"
        : "Someone"
    : viewer.name!;
  const subline =
    isAnonymous
      ? "Profile in review — name reveals after verification"
      : viewer.role === "investor"
        ? viewer.firm ?? "Investor"
        : viewer.startupName ?? "Founder";

  if (isAnonymous) {
    // For anonymous viewers we render a generic role-coloured avatar (no
    // photo even if the viewer uploaded one) — keeps their identity hidden
    // until they verify.
    return (
      <div
        className="flex items-center gap-3 border bg-[var(--color-surface)] px-3 py-2.5"
        style={{ borderColor: "var(--color-border)" }}
      >
        <Avatar id={viewer.viewerId} name={null} src={null} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-[var(--color-text-strong)]">
            {headline}
          </p>
          <p className="mt-0.5 truncate text-[11.5px] text-[var(--color-text-faint)]">
            {subline}
          </p>
        </div>
        <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
          {viewer.count > 1 ? `${viewer.count}× · ` : ""}
          {relativeTime(viewer.lastViewedAt)}
        </span>
      </div>
    );
  }

  return (
    <Link
      href={`/p/${viewer.viewerId}` as Route}
      className="flex items-center gap-3 border bg-[var(--color-surface)] px-3 py-2.5 transition-colors hover:border-[var(--color-text-faint)]"
      style={{ borderColor: "var(--color-border)" }}
    >
      <Avatar id={viewer.viewerId} name={viewer.name} src={viewer.avatarSrc} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[var(--color-text-strong)]">
          {headline}
        </p>
        <p className="mt-0.5 truncate text-[11.5px] text-[var(--color-text-muted)]">
          {subline}
        </p>
      </div>
      <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
        {viewer.count > 1 ? `${viewer.count}× · ` : ""}
        {relativeTime(viewer.lastViewedAt)}
      </span>
    </Link>
  );
}

function Empty() {
  return (
    <div
      className="border border-dashed p-5 text-center"
      style={{ borderColor: "var(--color-border-strong, var(--color-border))" }}
    >
      <p className="text-[13px] text-[var(--color-text-muted)]">
        No profile views yet — once someone in the feed clicks through, they&apos;ll
        show up here.
      </p>
    </div>
  );
}

function relativeTime(d: Date): string {
  const min = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
