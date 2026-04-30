"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { unblockUserAction } from "@/lib/safety/actions";
import type { BlockedUserSummary } from "@/lib/safety/query";

/**
 * Inline list of users the viewer has blocked, with one-click unblock.
 * Server-rendered list seeded from /settings; rerenders on success via
 * router.refresh().
 */
export function BlockedUsersList({ initial }: { initial: BlockedUserSummary[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function unblock(targetUserId: string) {
    setError(null);
    setBusyId(targetUserId);
    startTransition(async () => {
      const res = await unblockUserAction({ targetUserId });
      setBusyId(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  if (initial.length === 0) {
    return (
      <p className="text-[13px] text-[var(--color-text-muted)]">
        You haven&apos;t blocked anyone. Use the menu on a profile page if you
        need to.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col">
        {initial.map((b) => {
          const subline =
            b.role === "investor"
              ? b.firm ?? "Investor"
              : b.role === "founder"
                ? b.startupName ?? "Founder"
                : "—";
          return (
            <li
              key={b.userId}
              className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] py-3 last:border-none"
            >
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium text-[var(--color-text-strong)]">
                  {b.name ?? "Removed user"}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-muted)]">
                  {subline} · blocked {b.blockedAt.toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => unblock(b.userId)}
                disabled={isPending}
                className="inline-flex h-9 items-center gap-1.5 px-3 text-[12.5px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyId === b.userId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Unblock
              </button>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className="border-l-2 border-[var(--color-danger)] pl-3 text-[12.5px] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
