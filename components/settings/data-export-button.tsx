/**
 * Pure server component — anchor tag. Browser handles the download because
 * the route returns Content-Disposition: attachment.
 */
export function DataExportButton() {
  return (
    <a
      href="/api/account/export"
      download
      className="inline-flex h-9 items-center px-4 text-[12.5px] font-medium text-[var(--color-text-strong)] underline-offset-4 transition-colors hover:underline"
    >
      Download my data (JSON) →
    </a>
  );
}
