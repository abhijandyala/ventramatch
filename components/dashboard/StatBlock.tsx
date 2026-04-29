import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatDelta } from "@/lib/dashboards/mock-data";

type StatBlockProps = {
  label: string;
  value: number | string;
  delta?: StatDelta;
  size?: "sm" | "md";
  className?: string;
};

const numberFormatter = new Intl.NumberFormat("en-US");

function formatValue(value: number | string): string {
  return typeof value === "number" ? numberFormatter.format(value) : value;
}

export function StatBlock({
  label,
  value,
  delta,
  size = "md",
  className,
}: StatBlockProps) {
  const valueClass =
    size === "sm"
      ? "text-[20px] leading-7 font-semibold"
      : "text-[24px] leading-8 font-semibold";

  return (
    <div className={cn("flex flex-col", className)}>
      <span className="text-[12px] leading-4 font-medium tracking-[0.01em] text-[var(--color-text-faint)]">
        {label}
      </span>
      <span
        className={cn(
          valueClass,
          "tabular-nums tracking-tight text-[var(--color-text)] mt-1",
        )}
      >
        {formatValue(value)}
      </span>
      {delta && <DeltaLine delta={delta} />}
    </div>
  );
}

function DeltaLine({ delta }: { delta: StatDelta }) {
  const Icon = delta.trend === "up" ? ArrowUp : delta.trend === "down" ? ArrowDown : Minus;
  const color =
    delta.trend === "up"
      ? "text-[var(--color-success)]"
      : delta.trend === "down"
        ? "text-[var(--color-danger)]"
        : "text-[var(--color-text-muted)]";

  return (
    <span className="mt-1.5 inline-flex items-center gap-1 text-[12px] leading-4">
      <Icon aria-hidden size={12} strokeWidth={1.75} className={color} />
      <span className={cn("tabular-nums", color)}>{delta.value}%</span>
      <span className="text-[var(--color-text-faint)]">{delta.periodLabel}</span>
    </span>
  );
}
