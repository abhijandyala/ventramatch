import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";

/**
 * Account status row inside the settings layout.
 * Flat — sits on the same white bg as everything else.
 * The border-b separating it from subpage content is handled by the layout wrapper.
 * Server component, pure display.
 */

const PROVIDER_SHORT: Record<string, string> = {
  google: "Google",
  linkedin: "LinkedIn",
  github: "GitHub",
  "microsoft-entra-id": "Microsoft",
};

function StatusChip({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: "active" | "neutral" | "warn" | "danger";
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--color-text-faint)]">
        {label}
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-[12.5px] font-medium",
          variant === "active"  && "text-[var(--color-brand-strong)]",
          variant === "neutral" && "text-[var(--color-text-muted)]",
          variant === "warn"    && "text-[#92400e]",
          variant === "danger"  && "text-[var(--color-danger)]",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "inline-block h-2 w-2 shrink-0 rounded-full",
            variant === "active"  && "bg-[var(--color-brand)]",
            variant === "neutral" && "bg-[var(--color-text-faint)]",
            variant === "warn"    && "bg-[var(--color-warn)]",
            variant === "danger"  && "bg-[var(--color-danger)]",
          )}
        />
        {value}
      </span>
    </div>
  );
}

export function SettingsStatusBar({
  name,
  email,
  role,
  avatarInitial,
  paused,
  deletionRequestedAt,
  hasPassword,
  providers,
  calendarConnected,
  tosAcceptedAt,
  privacyAcceptedAt,
}: {
  name: string | null;
  email: string;
  role: "founder" | "investor" | null;
  avatarInitial: string;
  paused: boolean;
  deletionRequestedAt: string | null;
  hasPassword: boolean;
  providers: string[];
  calendarConnected: boolean;
  tosAcceptedAt: string | null;
  privacyAcceptedAt: string | null;
}) {
  const isDeletionScheduled = Boolean(deletionRequestedAt);
  const isHidden = paused || isDeletionScheduled;

  const discoveryVariant: "active" | "neutral" | "warn" | "danger" =
    isDeletionScheduled ? "danger" : isHidden ? "warn" : "active";
  const discoveryValue = isDeletionScheduled
    ? "Deletion scheduled"
    : isHidden
      ? "Paused"
      : "Active";

  const signInMethods: string[] = [
    ...(hasPassword ? ["Password"] : []),
    ...providers.map((p) => PROVIDER_SHORT[p] ?? p),
  ];
  const signInVariant: "active" | "warn" =
    signInMethods.length > 0 ? "active" : "warn";
  const signInValue =
    signInMethods.length > 0 ? signInMethods.join(" · ") : "No method set";

  const legalMissing = !tosAcceptedAt || !privacyAcceptedAt;

  const graceEnd = deletionRequestedAt
    ? new Date(
        new Date(deletionRequestedAt).getTime() + 30 * 24 * 60 * 60 * 1000,
      ).toLocaleDateString()
    : null;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
      {/* Identity */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--color-surface-2)] text-[13px] font-semibold text-[var(--color-text-strong)]"
          style={{ borderRadius: "var(--radius-sm)" }}
        >
          {avatarInitial}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="truncate text-[13.5px] font-semibold text-[var(--color-text-strong)]">
              {name ?? email}
            </span>
            {name && (
              <span className="hidden truncate text-[12px] text-[var(--color-text-faint)] sm:inline">
                {email}
              </span>
            )}
            {role && (
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
                {role}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Thin vertical rule */}
      <div className="hidden sm:block h-8 w-px shrink-0 bg-[var(--color-border)]" aria-hidden />

      {/* Status chips — inline text with colored dots, no pill backgrounds */}
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <StatusChip label="Discovery" value={discoveryValue} variant={discoveryVariant} />
        <StatusChip label="Sign-in" value={signInValue} variant={signInVariant} />
        <StatusChip
          label="Calendar"
          value={calendarConnected ? "Connected" : "Not connected"}
          variant={calendarConnected ? "active" : "neutral"}
        />
        {legalMissing && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--color-text-faint)]">
              Legal
            </span>
            <Link
              href={"/settings/privacy" as Route}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#92400e] underline-offset-2 hover:underline"
            >
              <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--color-warn)]" />
              Acceptance missing
            </Link>
          </div>
        )}
      </div>

      {/* Deletion warning — appended inline when active */}
      {isDeletionScheduled && graceEnd && (
        <p className="text-[12px] text-[var(--color-danger)] sm:ml-auto">
          Deletes {graceEnd} ·{" "}
          <Link
            href={"/settings/danger" as Route}
            className="font-medium underline underline-offset-2"
          >
            Cancel
          </Link>
        </p>
      )}
    </div>
  );
}
