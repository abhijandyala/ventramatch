import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, Bookmark, Eye, MessageSquare, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionRequiredItem, InvestorActivityItem } from "@/lib/dashboards/mock-data";

type CombinedActivityCardProps = {
  actions: ActionRequiredItem[];
  activity: InvestorActivityItem[];
};

const ACTION_ICON: Record<ActionRequiredItem["tone"], LucideIcon> = {
  view: Eye,
  save: Bookmark,
  match: Users,
};

const ACTIVITY_ICON: Record<InvestorActivityItem["tone"], LucideIcon> = {
  view: Eye,
  save: Bookmark,
  message: MessageSquare,
};

export function CombinedActivityCard({ actions, activity }: CombinedActivityCardProps) {
  return (
    <section
      aria-labelledby="activity-title"
      className="rounded-none border border-[var(--color-border)] bg-[var(--color-surface)] p-5 flex flex-col h-full"
    >
      <header className="flex items-baseline justify-between">
        <h3
          id="activity-title"
          className="text-[14px] leading-5 font-semibold tracking-tight text-[var(--color-text)]"
        >
          Recent activity
        </h3>
        <span className="text-[12px] leading-4 font-medium text-[var(--color-text-faint)]">
          (this week)
        </span>
      </header>

      <ul className="mt-4 flex flex-col gap-3 flex-1">
        {actions.map((item) => {
          const Icon = ACTION_ICON[item.tone];
          const matchingActivity = activity.find((a) =>
            (item.tone === "view" && a.tone === "view") ||
            (item.tone === "save" && a.tone === "save") ||
            (item.tone === "match" && a.tone === "message")
          );

          return (
            <li key={item.id} className="flex items-center gap-3">
              <span
                aria-hidden
                className={cn(
                  "shrink-0 inline-flex items-center justify-center",
                  "w-8 h-8 rounded-none",
                  "bg-[var(--color-brand-tint)] text-[var(--color-brand-ink)]",
                )}
              >
                <Icon size={14} strokeWidth={1.75} />
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-[13px] leading-5 text-[var(--color-text)]">
                  <span className="font-mono tabular-nums font-semibold">{item.count}</span>{" "}
                  <span className="text-[var(--color-text-muted)]">{item.label}</span>
                </p>
              </div>

              {matchingActivity && matchingActivity.recentCount > 0 && (
                <AnonymousStack count={matchingActivity.recentCount} />
              )}

              <Link
                href={item.action.href as Route}
                className={cn(
                  "shrink-0 text-[13px] leading-5 font-medium",
                  "text-[var(--color-brand-ink)]",
                  "transition-colors duration-[120ms] ease-out",
                  "hover:text-[var(--color-brand-ink-hov)]",
                )}
              >
                {item.action.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-[12px] leading-4 text-[var(--color-text-faint)]">
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
