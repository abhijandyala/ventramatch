import type { Route } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ImproveMatchItem } from "@/lib/dashboards/mock-data";

type ImproveMatchesCardProps = {
  items: ImproveMatchItem[];
  completionPct: number;
  completeHref: string;
  borderless?: boolean;
};

export function ImproveMatchesCard({
  items,
  completionPct,
  completeHref,
  borderless = false,
}: ImproveMatchesCardProps) {
  const inner = (
    <>
      <p className="text-[12px] leading-4 text-[var(--color-text-faint)]">
        Estimated uplift in score, not a guarantee.
      </p>

      <ul className="mt-4 flex flex-col divide-y divide-[var(--color-border)]">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href as Route}
              className={cn(
                "flex items-center gap-3 py-3 first:pt-0 last:pb-0",
                "text-[13px] leading-5",
                "transition-colors duration-[120ms] ease-out",
              )}
            >
              <span className="flex-1 min-w-0 truncate text-[var(--color-text)]">
                {item.label}
              </span>
              <span className="shrink-0 font-mono text-[12px] leading-4 tabular-nums" style={{ color: "var(--color-brand)" }}>
                +{item.estimatedDeltaPts} pts
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href={completeHref as Route}
        className={cn(
          "mt-4 inline-flex w-full items-center justify-center gap-1.5",
          "h-9 px-4",
          "rounded-none",
          "text-[13px] font-semibold text-white",
          "transition-colors duration-[120ms] ease-out",
        )}
        style={{ backgroundColor: "var(--color-brand)" }}
      >
        Complete your profile ({Math.round(completionPct)}%)
      </Link>
    </>
  );

  if (borderless) {
    return <div>{inner}</div>;
  }

  return (
    <section
      aria-labelledby="improve-matches-title"
      className="rounded-none border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <h3
        id="improve-matches-title"
        className="text-[14px] leading-5 font-semibold tracking-tight text-[var(--color-text)] mb-1"
      >
        How to improve your matches
      </h3>
      {inner}
    </section>
  );
}
