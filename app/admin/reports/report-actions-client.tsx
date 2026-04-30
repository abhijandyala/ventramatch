"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { setReportStatusAction } from "./actions";
import type { ReportStatus } from "@/types/database";

export function ReportActions({
  reportId,
  currentStatus,
}: {
  reportId: string;
  currentStatus: ReportStatus;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function act(status: ReportStatus) {
    setError(null);
    startTransition(async () => {
      const res = await setReportStatusAction({
        reportId,
        status,
        notes: notes.trim(),
      });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Resolution notes (optional)"
        className="h-9 border bg-[var(--color-bg)] px-3 text-[12.5px] outline-none focus:border-[var(--color-text)]"
        style={{ borderColor: "var(--color-border)" }}
      />
      <div className="flex flex-wrap gap-2">
        {currentStatus === "open" ? (
          <ActionBtn label="Mark reviewing" pending={isPending} onClick={() => act("reviewing")} />
        ) : null}
        <ActionBtn label="Action taken" pending={isPending} onClick={() => act("actioned")} />
        <ActionBtn label="Dismiss" pending={isPending} onClick={() => act("dismissed")} />
      </div>
      {error ? <p className="text-[12px] text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  pending,
}: {
  label: string;
  onClick: () => void;
  pending: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex h-9 items-center gap-1.5 border px-3 text-[12.5px] font-medium text-[var(--color-text-strong)] transition-colors hover:bg-[var(--color-surface)] disabled:opacity-50"
      style={{ borderColor: "var(--color-border)" }}
    >
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      {label}
    </button>
  );
}
