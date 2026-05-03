import type { Route } from "next";
import Link from "next/link";
import type { ActionRequiredItem } from "@/lib/dashboards/mock-data";
import { cn } from "@/lib/utils";

type ActionRequiredCardProps = {
  items: ActionRequiredItem[];
  borderless?: boolean;
};

export function ActionRequiredCard({ items, borderless = false }: ActionRequiredCardProps) {
  const inner = (
    <ul className="flex flex-col divide-y divide-[var(--color-border)]">
      {items.map((item) => (
        <li key={item.id} className="py-3 first:pt-0 last:pb-0">
          <ActionRow item={item} />
        </li>
      ))}
    </ul>
  );

  if (borderless) {
    return <div>{inner}</div>;
  }

  return (
    <section
      aria-labelledby="action-required-title"
      className="rounded-none border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
    >
      <header className="flex items-baseline justify-between mb-4">
        <h3
          id="action-required-title"
          className="text-[14px] leading-5 font-semibold tracking-tight text-[var(--color-text)]"
        >
          Action required
        </h3>
        <span className="text-[12px] leading-4 font-medium text-[var(--color-text-faint)]">
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
      </header>
      {inner}
    </section>
  );
}

function ActionRow({ item }: { item: ActionRequiredItem }) {
  return (
    <div className="flex items-center gap-3">
      <p className="flex-1 min-w-0 truncate text-[13px] leading-5 text-[var(--color-text)]">
        <span className="font-mono tabular-nums font-semibold">{item.count}</span>{" "}
        <span className="text-[var(--color-text-muted)]">{item.label}</span>
      </p>
      <Link
        href={item.action.href as Route}
        className={cn(
          "shrink-0 text-[13px] leading-5 font-medium",
          "transition-colors duration-[120ms] ease-out",
        )}
        style={{ color: "var(--color-brand)" }}
      >
        {item.action.label}
      </Link>
    </div>
  );
}
