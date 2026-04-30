"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Slide-in drawer from the bottom on mobile. Used by the FilterPanel on
 * /feed when the viewport is below 1024px. On desktop it renders nothing
 * (the filter sidebar is always visible).
 *
 * Uses a native <dialog> for focus trap + Esc-to-close.
 */
export function MobileDrawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-0 h-full w-full max-h-[85dvh] max-w-full rounded-t-2xl border-0 bg-[var(--color-bg)] p-0 backdrop:bg-black/40"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        top: "auto",
      }}
    >
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)] px-5 py-3">
        <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-strong)]">
          {title}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-8 w-8 place-items-center text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
        >
          <X size={16} />
        </button>
      </header>
      <div className="overflow-y-auto p-5">{children}</div>
    </dialog>
  );
}
