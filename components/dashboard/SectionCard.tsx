import { cn } from "@/lib/utils";

type SectionCardProps = {
  title: string;
  aside?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  padding?: "comfortable" | "compact";
  className?: string;
};

export function SectionCard({
  title,
  aside,
  action,
  children,
  padding = "comfortable",
  className,
}: SectionCardProps) {
  const padX = padding === "compact" ? "px-4" : "px-5";
  const padY = padding === "compact" ? "py-4" : "py-5";

  return (
    <section
      className={cn(
        "rounded-none border border-[var(--color-border)] bg-[var(--color-surface)]",
        className,
      )}
    >
      <header className={cn("flex items-baseline justify-between gap-4", padX, padY, "pb-0")}>
        <div className="flex items-baseline gap-2">
          <h3 className="text-[14px] leading-5 font-semibold tracking-tight text-[var(--color-text)]">
            {title}
          </h3>
          {aside && (
            <span className="text-[12px] leading-4 text-[var(--color-text-faint)]">
              {aside}
            </span>
          )}
        </div>
        {action}
      </header>
      <div className={cn(padX, padY, "pt-3")}>{children}</div>
    </section>
  );
}
