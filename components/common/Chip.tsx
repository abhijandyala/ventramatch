import { cn } from "@/lib/utils";

type ChipProps = {
  children: React.ReactNode;
  variant?: "tint" | "outline";
  className?: string;
};

export function Chip({ children, variant = "tint", className }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center",
        "px-2 py-0.5",
        "rounded-none",
        "text-[12px] leading-4 font-medium tracking-[0.01em]",
        variant === "tint"
          ? "bg-[var(--color-brand-tint)] text-[var(--color-brand-ink)]"
          : "border border-[var(--color-border)] text-[var(--color-text-muted)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
