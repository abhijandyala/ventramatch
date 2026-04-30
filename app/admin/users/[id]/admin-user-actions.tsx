"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  banUserAction,
  unbanUserAction,
  pauseUserAction,
  resumeUserAction,
} from "../actions";
import type { AccountLabel } from "@/types/database";

export function AdminUserActions({
  userId,
  accountLabel,
  paused,
}: {
  userId: string;
  accountLabel: AccountLabel;
  paused: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [banReason, setBanReason] = useState("");
  const [confirmingBan, setConfirmingBan] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isBanned = accountLabel === "banned";

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok && "error" in res) setError(res.error ?? "Failed.");
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {isBanned ? (
          <ActionBtn
            label="Unban"
            pending={isPending}
            onClick={() => run(() => unbanUserAction({ userId }))}
          />
        ) : (
          <ActionBtn
            label="Ban…"
            danger
            pending={isPending}
            onClick={() => setConfirmingBan(true)}
          />
        )}
        {paused && !isBanned ? (
          <ActionBtn
            label="Resume"
            pending={isPending}
            onClick={() => run(() => resumeUserAction({ userId }))}
          />
        ) : !isBanned ? (
          <ActionBtn
            label="Pause"
            pending={isPending}
            onClick={() => run(() => pauseUserAction({ userId }))}
          />
        ) : null}
      </div>

      {confirmingBan ? (
        <div className="flex flex-col gap-2 border p-3" style={{ borderColor: "var(--color-danger)" }}>
          <input
            type="text"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            placeholder="Reason for ban"
            className="h-9 border bg-[var(--color-bg)] px-3 text-[13px] outline-none focus:border-[var(--color-text)]"
            style={{ borderColor: "var(--color-border)" }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirmingBan(false);
                setBanReason("");
              }}
              className="h-9 px-3 text-[12.5px] text-[var(--color-text-muted)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isPending || !banReason.trim()}
              onClick={() =>
                run(() => banUserAction({ userId, reason: banReason.trim() }))
              }
              className="inline-flex h-9 items-center gap-1.5 px-4 text-[12.5px] font-medium text-white disabled:opacity-50"
              style={{ background: "var(--color-danger)" }}
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Confirm ban
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="text-[12px] text-[var(--color-danger)]">{error}</p>
      ) : null}
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  pending,
  danger,
}: {
  label: string;
  onClick: () => void;
  pending: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex h-9 items-center gap-1.5 px-3 text-[12.5px] font-medium transition-colors disabled:opacity-50"
      style={{
        color: danger ? "var(--color-danger)" : "var(--color-text-strong)",
        border: `1px solid ${danger ? "var(--color-danger)" : "var(--color-border)"}`,
      }}
    >
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      {label}
    </button>
  );
}
