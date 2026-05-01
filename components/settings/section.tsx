import { cn } from "@/lib/utils";

/**
 * Anchored section shell used by every block on /settings.
 * Server component — pure layout, no interactivity.
 *
 * variant="default" — white card on warm-beige page background (standard sections).
 * variant="danger"  — same card with a red border (Danger zone only).
 *
 * fullWidth — removes the 60ch content cap (used by the status card row).
 */
export function SettingsSection({
  id,
  title,
  description,
  children,
  variant = "default",
  fullWidth = false,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  variant?: "default" | "danger";
  fullWidth?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 border bg-[var(--color-surface)] p-6",
        variant === "danger"
          ? "border-[var(--color-danger)]"
          : "border-[var(--color-border)]",
      )}
    >
      <header className="mb-6 flex flex-col gap-1.5 md:max-w-[60ch]">
        <h2
          className={cn(
            "text-[18px] font-semibold tracking-tight",
            variant === "danger"
              ? "text-[var(--color-danger)]"
              : "text-[var(--color-text-strong)]",
          )}
        >
          {title}
        </h2>
        {description ? (
          <p className="text-[13.5px] leading-[1.55] text-[var(--color-text-muted)]">
            {description}
          </p>
        ) : null}
      </header>
      <div className={fullWidth ? undefined : "max-w-[60ch]"}>{children}</div>
    </section>
  );
}
