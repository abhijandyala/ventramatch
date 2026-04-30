/**
 * Anchored section shell used by every block on /settings.
 * Server component — pure layout, no interactivity.
 */
export function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-b border-[var(--color-border)] py-10 first:pt-0 last:border-none last:pb-0">
      <header className="mb-5 flex flex-col gap-1.5 md:max-w-[60ch]">
        <h2 className="text-[20px] font-semibold tracking-tight text-[var(--color-text-strong)]">
          {title}
        </h2>
        {description ? (
          <p className="text-[13.5px] leading-[1.55] text-[var(--color-text-muted)]">
            {description}
          </p>
        ) : null}
      </header>
      <div className="max-w-[60ch]">{children}</div>
    </section>
  );
}
