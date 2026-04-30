"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { updateNotificationPrefsAction } from "@/lib/account/actions";
import type { NotificationPrefs } from "@/types/database";

const ROWS: {
  key: keyof NotificationPrefs;
  label: string;
  description: string;
  required?: boolean;
}[] = [
  {
    key: "matches",
    label: "Mutual matches",
    description: "We tell you when an investor or founder you liked likes you back.",
  },
  {
    key: "intros",
    label: "Intro requests",
    description: "Inbox activity — new requests, accepts, declines, withdrawals.",
  },
  {
    key: "reviewUpdates",
    label: "Profile review updates",
    description:
      "Status changes from our review team (accepted, needs changes, rejected). We strongly recommend leaving this on.",
  },
  {
    key: "weeklyDigest",
    label: "Weekly digest",
    description: "Optional Monday summary of new matches and inbox activity.",
  },
  {
    key: "productUpdates",
    label: "Product updates",
    description: "New features, important changes — at most monthly.",
  },
];

export function NotificationPrefsForm({ initial }: { initial: NotificationPrefs }) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty = (Object.keys(initial) as (keyof NotificationPrefs)[]).some(
    (k) => prefs[k] !== initial[k],
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateNotificationPrefsAction(prefs);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
    });
  }

  function toggle(key: keyof NotificationPrefs) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    setSaved(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y" style={{ borderColor: "var(--color-border)" }}>
        {ROWS.map((row) => (
          <li
            key={row.key}
            className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] py-4 last:border-none"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-[var(--color-text-strong)]">
                {row.label}
              </p>
              <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--color-text-muted)]">
                {row.description}
              </p>
            </div>
            <Toggle
              checked={prefs[row.key]}
              onToggle={() => toggle(row.key)}
              ariaLabel={`Toggle ${row.label}`}
            />
          </li>
        ))}
      </ul>

      {error ? (
        <p role="alert" className="border-l-2 border-[var(--color-danger)] pl-3 text-[12.5px] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!dirty || isPending}
          className="inline-flex h-9 items-center gap-1.5 px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: "var(--color-text-strong)" }}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save preferences
        </button>
        {saved ? (
          <span className="text-[12px] text-[var(--color-brand-strong)]">Saved.</span>
        ) : null}
      </div>
    </form>
  );
}

function Toggle({
  checked,
  onToggle,
  ariaLabel,
}: {
  checked: boolean;
  onToggle: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onToggle}
      className="relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center transition-colors"
      style={{
        background: checked ? "var(--color-brand)" : "var(--color-surface)",
        border: `1px solid ${checked ? "var(--color-brand)" : "var(--color-border)"}`,
      }}
    >
      <span
        aria-hidden
        className="block h-4 w-4 transform bg-white transition-transform"
        style={{ transform: checked ? "translateX(20px)" : "translateX(2px)" }}
      />
    </button>
  );
}
