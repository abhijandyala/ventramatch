/**
 * Two-column settings row used inside the bordered panel on each subpage.
 * Left: label + description. Right: form control or action.
 * Stacks on mobile. Server component — pure layout.
 */
export function SettingsRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:gap-6">
      {/* Left column */}
      <div className="sm:w-44 sm:shrink-0">
        <p className="text-[13px] font-medium text-[var(--color-text-strong)]">{label}</p>
        {description && (
          <p className="mt-0.5 text-[12px] leading-[1.5] text-[var(--color-text-muted)]">
            {description}
          </p>
        )}
      </div>
      {/* Right column */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
