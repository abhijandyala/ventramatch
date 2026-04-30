"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal } from "lucide-react";
import { blockUserAction } from "@/lib/safety/actions";
import { ReportDialog } from "./report-dialog";

/**
 * Three-dot menu rendered in the /p/[userId] header. Opens a popover with
 * Block + Report items; both spawn their own confirmation flow.
 *
 * Self-view should not render this — caller (the profile page) decides.
 */
export function ProfileMenu({
  targetUserId,
  targetName,
}: {
  targetUserId: string;
  targetName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement | null>(null);

  // Close menu when clicking outside.
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  function block() {
    setError(null);
    startTransition(async () => {
      const res = await blockUserAction({ targetUserId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Block makes the target invisible — bounce to the feed.
      router.push("/feed");
      router.refresh();
    });
  }

  return (
    <>
      <div ref={ref} className="relative">
        <button
          type="button"
          aria-label="More actions"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="grid h-8 w-8 place-items-center text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
        >
          <MoreHorizontal size={16} />
        </button>

        {open ? (
          <div
            role="menu"
            className="absolute right-0 top-9 z-50 flex w-[200px] flex-col border bg-[var(--color-bg)] py-1 shadow-md"
            style={{ borderColor: "var(--color-border)" }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setReportOpen(true);
              }}
              className="px-3 py-2 text-left text-[12.5px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface)]"
            >
              Report user…
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setConfirmingBlock(true);
              }}
              className="px-3 py-2 text-left text-[12.5px] text-[var(--color-danger)] transition-colors hover:bg-[var(--color-surface)]"
            >
              Block user
            </button>
          </div>
        ) : null}
      </div>

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetUserId={targetUserId}
        targetName={targetName}
      />

      {confirmingBlock ? (
        <BlockConfirmation
          name={targetName}
          isPending={isPending}
          error={error}
          onCancel={() => {
            setConfirmingBlock(false);
            setError(null);
          }}
          onConfirm={block}
        />
      ) : null}
    </>
  );
}

function BlockConfirmation({
  name,
  isPending,
  error,
  onCancel,
  onConfirm,
}: {
  name: string;
  isPending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="flex w-full max-w-[420px] flex-col gap-4 border bg-[var(--color-bg)] p-5"
        style={{ borderColor: "var(--color-border)" }}
      >
        <header>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--color-text-faint)]">
            Block user
          </p>
          <h2 className="mt-1 text-[16px] font-semibold tracking-tight text-[var(--color-text-strong)]">
            Block {name}?
          </h2>
          <p className="mt-1.5 text-[12.5px] leading-[1.55] text-[var(--color-text-muted)]">
            They&apos;ll disappear from your feed and matches. Any pending intro
            requests between you will be withdrawn. They won&apos;t be told.
            You can unblock from <span className="font-medium">Settings → Blocked</span>.
          </p>
        </header>
        {error ? (
          <p role="alert" className="border-l-2 border-[var(--color-danger)] pl-3 text-[12.5px] text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center px-4 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="inline-flex h-9 items-center gap-1.5 px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: "var(--color-danger)" }}
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Block
          </button>
        </div>
      </div>
    </div>
  );
}
