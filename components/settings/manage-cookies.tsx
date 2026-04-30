"use client";

const STORAGE_KEY = "vm:cookie-consent";

/**
 * Clears the stored consent so the global CookieBanner re-mounts on the
 * next page load. Quick and intentionally low-tech: we don't try to
 * imperatively re-open the banner, we just nuke the persisted decision
 * and reload, which triggers the banner.
 */
export function ManageCookies() {
  function reopen() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // private browsing — no-op
    }
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={reopen}
      className="inline-flex h-9 items-center px-4 text-[12.5px] font-medium text-[var(--color-text-strong)] underline-offset-4 transition-colors hover:underline"
    >
      Manage cookie preferences →
    </button>
  );
}
