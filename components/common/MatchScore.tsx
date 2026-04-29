import { cn } from "@/lib/utils";

type MatchScoreProps = {
  score: number;
  reason: string;
  size?: "sm" | "md";
  className?: string;
};

export function MatchScore({ score, reason, size = "md", className }: MatchScoreProps) {
  const rounded = Math.round(score);
  const sizing =
    size === "sm"
      ? "px-1.5 py-0.5 text-[11px] leading-4"
      : "px-2 py-0.5 text-[13px] leading-5";

  return (
    <span
      role="img"
      aria-label={`${rounded} percent match. ${reason}`}
      className={cn(
        "inline-flex items-center justify-center",
        sizing,
        "rounded-none",
        "font-mono tabular-nums tracking-tight",
        "bg-[var(--color-brand-ink)] text-white",
        className,
      )}
    >
      {rounded}%
    </span>
  );
}
