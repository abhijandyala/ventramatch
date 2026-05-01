import { cn } from "@/lib/utils";

/**
 * At-a-glance account status banner rendered at the top of /settings.
 * Server component — pure display, all data already loaded by the page.
 *
 * Shows: discovery status · sign-in coverage · calendar connection.
 * When deletion is scheduled the grace-period end date is shown inline.
 */

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  linkedin: "LinkedIn",
  github: "GitHub",
  "microsoft-entra-id": "Microsoft",
};

function Pill({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11.5px] font-medium",
        active
          ? "bg-[var(--color-brand-tint)] text-[var(--color-brand-strong)]"
          : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
      )}
    >
      {children}
    </span>
  );
}

function StatusGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-faint)]">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function AccountStatusCard({
  name,
  email,
  paused,
  deletionRequestedAt,
  hasPassword,
  providers,
  calendarConnected,
}: {
  name: string | null;
  email: string;
  paused: boolean;
  deletionRequestedAt: string | null;
  hasPassword: boolean;
  providers: string[];
  calendarConnected: boolean;
}) {
  const isDeletionScheduled = Boolean(deletionRequestedAt);
  const isHidden = paused || isDeletionScheduled;

  const discoveryLabel = isDeletionScheduled
    ? "Deletion scheduled"
    : isHidden
      ? "Paused"
      : "Active";

  const graceEnd = deletionRequestedAt
    ? new Date(
        new Date(deletionRequestedAt).getTime() + 30 * 24 * 60 * 60 * 1000,
      ).toLocaleDateString()
    : null;

  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      {/* Identity row */}
      <div className="mb-4 flex items-baseline gap-2 min-w-0">
        <p className="truncate text-[14px] font-semibold text-[var(--color-text-strong)]">
          {name ?? email}
        </p>
        {name ? (
          <p className="truncate text-[12.5px] text-[var(--color-text-muted)]">{email}</p>
        ) : null}
      </div>

      {/* Status groups */}
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <StatusGroup label="Discovery">
          <Pill active={!isHidden}>{discoveryLabel}</Pill>
        </StatusGroup>

        <StatusGroup label="Sign-in">
          {hasPassword ? <Pill active>Password</Pill> : null}
          {providers.map((p) => (
            <Pill key={p} active>
              {PROVIDER_LABELS[p] ?? p}
            </Pill>
          ))}
          {!hasPassword && providers.length === 0 ? (
            <Pill active={false}>No method set</Pill>
          ) : null}
        </StatusGroup>

        <StatusGroup label="Calendar">
          <Pill active={calendarConnected}>
            {calendarConnected ? "Google connected" : "Not connected"}
          </Pill>
        </StatusGroup>
      </div>

      {/* Deletion warning */}
      {isDeletionScheduled && graceEnd ? (
        <p className="mt-4 border-t border-[var(--color-border)] pt-3 text-[12px] text-[var(--color-danger)]">
          Deletion scheduled · profile hidden · hard-deletes {graceEnd}. Cancel
          in the Danger zone below to reverse.
        </p>
      ) : null}
    </div>
  );
}
