/**
 * Settings section panel — no bordered card.
 * Matches the dashboard design language: section title sits on the same
 * white surface, a border-b line separates the header from the rows,
 * and rows are divided with divide-y.
 *
 * variant="danger" renders the title in normal strong text; the danger
 * color is reserved for buttons inside PauseAndDelete.
 */
export function SettingsPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** @deprecated — danger styling now lives on the destructive buttons inside */
  variant?: "default" | "danger";
}) {
  return (
    <section>
      {/* Section header — border-b acts as the divider */}
      <div className="border-b border-[var(--color-border)] pb-4">
        <h2 className="text-[14px] font-semibold text-[var(--color-text-strong)]">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-[12.5px] leading-[1.5] text-[var(--color-text-muted)]">
            {description}
          </p>
        )}
      </div>

      {/* Rows — divide-y creates thin ruled lines between each SettingsRow */}
      <div className="divide-y divide-[var(--color-border)]">
        {children}
      </div>
    </section>
  );
}
