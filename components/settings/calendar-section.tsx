"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function CalendarSection({
  connected,
}: {
  connected: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function connect() {
    window.location.href = "/api/calendar/google/connect";
  }

  async function disconnectCal() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/calendar/google/disconnect", { method: "POST" });
      if (!res.ok) {
        setError("Could not disconnect.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="text-[14px] font-medium text-[var(--color-text-strong)]">
          Google Calendar
        </p>
        <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--color-text-muted)]">
          {connected
            ? "Connected. When you accept an intro, we'll create a calendar event for both parties automatically."
            : "Connect to auto-create calendar events when intro requests are accepted."}
        </p>
        {error ? (
          <p className="mt-2 text-[12px] text-[var(--color-danger)]">{error}</p>
        ) : null}
      </div>
      {connected ? (
        <button
          type="button"
          onClick={disconnectCal}
          disabled={isPending}
          className="inline-flex h-9 items-center gap-1.5 px-3 text-[12.5px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)] disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Disconnect
        </button>
      ) : (
        <button
          type="button"
          onClick={connect}
          className="inline-flex h-9 items-center px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--color-brand)" }}
        >
          Connect Google Calendar
        </button>
      )}
    </div>
  );
}
