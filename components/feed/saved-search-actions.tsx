"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  deleteSearchAction,
  renameSearchAction,
  setSearchNotifyAction,
} from "@/app/(dashboard)/searches/actions";

/**
 * Inline action set on each saved-search row: rename in place, toggle
 * notify, delete with one-tap confirm.
 */
export function SavedSearchActions({
  id,
  name,
  notifyEmail,
}: {
  id: string;
  name: string;
  notifyEmail: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function rename() {
    if (!draftName.trim() || draftName.trim() === name) {
      setEditing(false);
      setDraftName(name);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await renameSearchAction({ id, name: draftName.trim() });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function toggleNotify(next: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await setSearchNotifyAction({ id, notify: next });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await deleteSearchAction({ id });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            rename();
          }}
          className="flex items-center gap-1.5"
        >
          <input
            autoFocus
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={rename}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setEditing(false);
                setDraftName(name);
              }
            }}
            maxLength={80}
            className="h-7 border bg-[var(--color-bg)] px-2 text-[12px] text-[var(--color-text)] outline-none focus:border-[var(--color-text)]"
            style={{ borderColor: "var(--color-border)" }}
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraftName(name);
            setEditing(true);
          }}
          className="text-[12px] text-[var(--color-text-muted)] underline-offset-4 transition-colors hover:text-[var(--color-text-strong)] hover:underline"
        >
          Rename
        </button>
      )}

      <label className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)]">
        <input
          type="checkbox"
          checked={notifyEmail}
          onChange={(e) => toggleNotify(e.target.checked)}
          disabled={isPending}
          className="accent-[var(--color-brand)]"
        />
        Email me weekly
      </label>

      {confirming ? (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-[12px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={isPending}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-danger)] underline-offset-4 hover:underline disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Confirm delete
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-[12px] text-[var(--color-danger)] underline-offset-4 transition-colors hover:underline"
        >
          Delete
        </button>
      )}

      {error ? (
        <span role="alert" className="text-[11px] text-[var(--color-danger)]">
          {error}
        </span>
      ) : null}
    </div>
  );
}
