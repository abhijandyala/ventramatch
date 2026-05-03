"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Action control for the Google Calendar integration.
 * Description and label come from the parent SettingsRow.
 */
export function CalendarSection({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function connect() {
    window.location.href = "/api/calendar/google/connect";
  }

  function disconnect() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/calendar/google/disconnect", { method: "POST" });
      if (!res.ok) {
        setError("Could not disconnect. Try again.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        {connected ? (
          <button
            type="button"
            onClick={disconnect}
            disabled={isPending}
            className="inline-flex h-8 items-center gap-1.5 px-3 text-[12.5px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)] disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={connect}
            className="inline-flex h-9 items-center border border-[var(--color-brand)] px-4 text-[13px] font-medium text-[var(--color-brand-strong)] transition-colors hover:bg-[var(--color-brand-tint)]"
          >
            Connect Google Calendar
          </button>
        )}
      </div>
      {error && (
        <p className="text-[12px] text-[var(--color-danger)]">{error}</p>
      )}
    </div>
  );
}
