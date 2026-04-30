"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "vm:cookie-consent";

type Categories = {
  essential: true; // always on, can't be disabled
  preferences: boolean;
  analytics: boolean;
};

type Consent = {
  version: 1;
  decidedAt: string; // ISO
  categories: Categories;
};

const DEFAULTS: Categories = {
  essential: true,
  preferences: false,
  analytics: false,
};

function read(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Consent;
  } catch {
    return null;
  }
}

function write(categories: Categories) {
  const value: Consent = {
    version: 1,
    decidedAt: new Date().toISOString(),
    categories,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Private browsing — silently no-op
  }
}

/**
 * Minimal GDPR/CPRA-compliant cookie consent banner.
 *
 * Mount this on public pages only; once a user is authenticated we treat
 * acceptance as covered by the ToS checkbox. Users can change their mind
 * later from /legal/privacy or by clearing localStorage.
 */
export function CookieBanner() {
  const [hasMounted, setHasMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [categories, setCategories] = useState<Categories>(DEFAULTS);

  useEffect(() => {
    setHasMounted(true);
    if (!read()) setOpen(true);
  }, []);

  function acceptAll() {
    const all: Categories = { essential: true, preferences: true, analytics: true };
    write(all);
    setOpen(false);
  }

  function rejectAll() {
    write(DEFAULTS);
    setOpen(false);
  }

  function saveCustom() {
    write(categories);
    setOpen(false);
  }

  if (!hasMounted || !open) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-banner-title"
      className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-[640px]"
    >
      <div
        className="border bg-[color:var(--color-bg)] shadow-[0_8px_32px_rgba(15,23,42,0.12)]"
        style={{ borderColor: "var(--color-border-strong, var(--color-border))" }}
      >
        {!showCustomize ? (
          <div className="p-5">
            <h2
              id="cookie-banner-title"
              className="text-[15px] font-semibold tracking-tight text-[color:var(--color-text-strong)]"
            >
              We use cookies
            </h2>
            <p className="mt-2 text-[13px] leading-[1.55] text-[color:var(--color-text-muted)]">
              Essential cookies keep you signed in. Optional ones help us
              improve the product. You&apos;re in control — see our{" "}
              <Link
                href="/legal/privacy"
                className="font-medium text-[color:var(--color-text)] underline underline-offset-4 hover:text-[color:var(--color-brand-strong)]"
              >
                Privacy Policy
              </Link>
              .
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={acceptAll}
                className={cn(
                  "h-9 rounded-[var(--radius)] bg-[color:var(--color-brand)] px-4",
                  "text-[13px] font-medium text-white",
                  "transition-colors duration-150 hover:bg-[color:var(--color-brand-strong)]",
                )}
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={rejectAll}
                className={cn(
                  "h-9 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-white px-4",
                  "text-[13px] font-medium text-[color:var(--color-text-strong)]",
                  "transition-colors duration-150 hover:border-[color:var(--color-text-faint)]",
                )}
              >
                Reject non-essential
              </button>
              <button
                type="button"
                onClick={() => setShowCustomize(true)}
                className={cn(
                  "h-9 rounded-[var(--radius)] px-3",
                  "text-[13px] font-medium text-[color:var(--color-text-muted)]",
                  "transition-colors duration-150 hover:text-[color:var(--color-text-strong)]",
                )}
              >
                Customize
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5">
            <h2
              id="cookie-banner-title"
              className="text-[15px] font-semibold tracking-tight text-[color:var(--color-text-strong)]"
            >
              Cookie preferences
            </h2>
            <p className="mt-2 text-[13px] leading-[1.55] text-[color:var(--color-text-muted)]">
              Choose which cookies you allow. You can change this later from
              the Privacy section of your account.
            </p>

            <div className="mt-4 flex flex-col gap-2.5">
              <CategoryRow
                title="Essential"
                description="Authentication, security, and load balancing. Always on."
                checked
                disabled
              />
              <CategoryRow
                title="Preferences"
                description="Remember your theme, language, and small UI choices."
                checked={categories.preferences}
                onChange={(v) => setCategories((c) => ({ ...c, preferences: v }))}
              />
              <CategoryRow
                title="Analytics"
                description="Anonymous usage stats so we can improve the product."
                checked={categories.analytics}
                onChange={(v) => setCategories((c) => ({ ...c, analytics: v }))}
              />
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowCustomize(false)}
                className="text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-strong)]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={saveCustom}
                className={cn(
                  "h-9 rounded-[var(--radius)] bg-[color:var(--color-brand)] px-4",
                  "text-[13px] font-medium text-white",
                  "transition-colors duration-150 hover:bg-[color:var(--color-brand-strong)]",
                )}
              >
                Save preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-3 border border-[color:var(--color-border)] p-3",
        disabled ? "bg-[color:var(--color-surface)]" : "bg-white cursor-pointer",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-0.5 h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
        style={{ accentColor: "var(--color-brand-ink)" }}
      />
      <span className="flex-1">
        <span className="block text-[13px] font-medium text-[color:var(--color-text-strong)]">
          {title}
        </span>
        <span className="block text-[12px] text-[color:var(--color-text-muted)]">
          {description}
        </span>
      </span>
    </label>
  );
}
