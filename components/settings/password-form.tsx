"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { setPasswordAction } from "@/lib/account/actions";

/**
 * Two modes:
 *   • hasPassword=false (OAuth-only user): single field, no current-password.
 *   • hasPassword=true: standard change-password flow.
 */
export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await setPasswordAction({
        currentPassword: hasPassword ? currentPassword : undefined,
        newPassword,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      setCurrentPassword("");
      setNewPassword("");
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {hasPassword ? (
        <Field label="Current password">
          <input
            type="password"
            value={currentPassword}
            autoComplete="current-password"
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full border bg-[var(--color-bg)] px-3 py-2 font-mono text-[13px] text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text)]"
            style={{ borderColor: "var(--color-border)" }}
          />
        </Field>
      ) : (
        <p className="text-[13px] leading-[1.55] text-[var(--color-text-muted)]">
          You signed up with an OAuth provider. Adding a password lets you sign
          in with your email if you ever lose access to that provider.
        </p>
      )}

      <Field
        label={hasPassword ? "New password" : "Set a password"}
        hint="At least 10 characters, mix letters and numbers."
      >
        <input
          type="password"
          value={newPassword}
          autoComplete="new-password"
          minLength={10}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full border bg-[var(--color-bg)] px-3 py-2 font-mono text-[13px] text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text)]"
          style={{ borderColor: "var(--color-border)" }}
        />
      </Field>

      {error ? (
        <p role="alert" className="border-l-2 border-[var(--color-danger)] pl-3 text-[12.5px] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!newPassword || isPending}
          className="inline-flex h-9 items-center gap-1.5 px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: "var(--color-text-strong)" }}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {hasPassword ? "Update password" : "Set password"}
        </button>
        {saved ? (
          <span className="text-[12px] text-[var(--color-brand-strong)]">Saved.</span>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
        {label}
      </span>
      {children}
      {hint ? <span className="text-[11.5px] text-[var(--color-text-faint)]">{hint}</span> : null}
    </label>
  );
}
