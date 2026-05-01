"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut, Trash2 } from "lucide-react";

export function AccountActions() {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <section className="mt-8 border-t border-[color:var(--color-border)] pt-6 pb-10">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/" })}
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-white px-4 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:border-[color:var(--color-text-faint)] hover:text-[color:var(--color-text)]"
        >
          <LogOut size={15} strokeWidth={1.75} />
          Sign out
        </button>

        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius)] border border-transparent px-4 text-[13px] font-medium text-[color:var(--color-text-faint)] transition-colors hover:text-[color:var(--color-danger)]"
          >
            <Trash2 size={15} strokeWidth={1.75} />
            Delete account
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-[color:var(--color-danger)]">
              This will schedule your account for deletion.
            </span>
            <a
              href="/settings#danger"
              className="inline-flex h-10 items-center gap-2 rounded-[var(--radius)] border border-[color:var(--color-danger)] bg-white px-4 text-[13px] font-medium text-[color:var(--color-danger)] transition-colors hover:bg-red-50"
            >
              Go to Settings
            </a>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-[13px] text-[color:var(--color-text-faint)] hover:text-[color:var(--color-text)]"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
