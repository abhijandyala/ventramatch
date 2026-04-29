import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, Bookmark, Eye, MessageSquare, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InvestorActivityItem } from "@/lib/dashboards/mock-data";

type InvestorActivityCardProps = {
  items: InvestorActivityItem[];
};

const ICON_BY_TONE: Record<InvestorActivityItem["tone"], LucideIcon> = {
  view: Eye,
  save: Bookmark,
  message: MessageSquare,
};

export function InvestorActivityCard({ items }: InvestorActivityCardProps) {
  return (
    <section
      aria-labelledby="investor-activity-title"
      className="rounded-none border border-[var(--color-border)] bg-[var(--color-surface)] p-6 flex flex-col h-full"
    >
      <header className="flex items-baseline justify-between">
        <h3
          id="investor-activity-title"
          className="text-[14px] leading-5 font-semibold tracking-tight text-[var(--color-text)]"
        >
          Investor activity
        </h3>
        <span className="text-[12px] leading-4 font-medium text-[var(--color-text-faint)]">
          (this week)
        </span>
      </header>

      <ul className="mt-4 flex flex-col gap-4 flex-1">
        {items.map((item) => (
          <li key={item.id}>
            <ActivityRow item={item} />
          </li>
        ))}
      </ul>

      <p className="mt-5 text-[12px] leading-4 text-[var(--color-text-faint)]">
        Identities reveal after mutual interest.
      </p>

      <Link
        href={"/matches" as Route}
        className={cn(
          "mt-3 inline-flex items-center gap-1",
          "text-[13px] font-medium text-[var(--color-brand-ink)]",
          "transition-colors duration-[120ms] ease-out",
          "hover:text-[var(--color-brand-ink-hov)]",
        )}
      >
        View all activity
        <ArrowRight aria-hidden size={12} strokeWidth={1.75} />
      </Link>
    </section>
  );
}

function ActivityRow({ item }: { item: InvestorActivityItem }) {
  const Icon = ICON_BY_TONE[item.tone];
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className={cn(
          "shrink-0 inline-flex items-center justify-center",
          "w-9 h-9 rounded-full",
          "bg-[var(--color-brand-tint)] text-[var(--color-brand-ink)]",
        )}
      >
        <Icon size={14} strokeWidth={1.75} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[18px] leading-6 font-semibold tabular-nums text-[var(--color-text)]">
          {item.count}
        </p>
        <p className="text-[12px] leading-4 text-[var(--color-text-muted)] truncate">
          {item.label}
        </p>
      </div>
      {item.recentCount > 0 && <AnonymousStack count={item.recentCount} />}
    </div>
  );
}

function AnonymousStack({ count }: { count: number }) {
  const dots = Math.min(count, 3);
  return (
    <div className="flex items-center" aria-label={`${count} new this week`}>
      <ul className="flex -space-x-1.5">
        {Array.from({ length: dots }).map((_, i) => (
          <li
            key={i}
            aria-hidden
            className={cn(
              "inline-block w-5 h-5 rounded-full",
              "bg-[var(--color-brand-tint)]",
              "ring-2 ring-[var(--color-surface)]",
            )}
          />
        ))}
      </ul>
      <span className="ml-1.5 font-mono text-[11px] leading-4 tabular-nums text-[var(--color-text-faint)]">
        +{count}
      </span>
    </div>
  );
}
