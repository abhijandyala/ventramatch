import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProfileChecklistItem } from "@/lib/dashboards/mock-data";

type ProfileStrengthCardProps = {
  percent: number;
  band: string;
  checklist: ProfileChecklistItem[];
};

export function ProfileStrengthCard({
  percent,
  band,
  checklist,
}: ProfileStrengthCardProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <section
      aria-labelledby="profile-strength-title"
      className="rounded-none border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
    >
      <header className="flex items-baseline justify-between">
        <h3
          id="profile-strength-title"
          className="text-[14px] leading-5 font-semibold tracking-tight text-[var(--color-text)]"
        >
          Profile strength
        </h3>
        <span className="text-[12px] leading-4 font-medium tracking-[0.01em] text-[var(--color-text-faint)]">
          {band}
        </span>
      </header>

      <div className="mt-3 flex items-center gap-3">
        <div
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Profile completion"
          className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-border)]"
        >
          <div
            className="h-full rounded-full bg-[var(--color-brand-ink)] transition-[width] duration-[360ms]"
            style={{ width: `${clamped}%` }}
          />
        </div>
        <span className="font-mono text-[13px] leading-5 tabular-nums text-[var(--color-text)]">
          {clamped}%
        </span>
      </div>

      <h4 className="mt-5 text-[12px] leading-4 font-medium tracking-[0.04em] uppercase text-[var(--color-text-faint)]">
        Complete your profile
      </h4>

      <ul className="mt-3 flex flex-col gap-2">
        {checklist.map((item) => {
          const Icon = item.done ? Check : Circle;
          return (
            <li key={item.id}>
              <Link
                href={item.href as Route}
                className={cn(
                  "group flex items-center gap-2.5",
                  "text-[13px] leading-5",
                  item.done
                    ? "text-[var(--color-text-muted)] line-through decoration-[var(--color-border)]"
                    : "text-[var(--color-text)]",
                )}
              >
                <Icon
                  aria-hidden
                  size={14}
                  strokeWidth={1.75}
                  className={
                    item.done
                      ? "text-[var(--color-success)]"
                      : "text-[var(--color-text-faint)]"
                  }
                />
                <span className="flex-1">{item.label}</span>
                {!item.done && (
                  <ArrowRight
                    aria-hidden
                    size={12}
                    strokeWidth={1.75}
                    className="text-[var(--color-text-faint)] opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-5">
        <Link
          href={"/profile" as Route}
          className={cn(
            "inline-flex items-center gap-1",
            "text-[13px] font-medium text-[var(--color-brand-ink)]",
            "transition-colors duration-[120ms] ease-out",
            "hover:text-[var(--color-brand-ink-hov)]",
          )}
        >
          Improve profile
          <ArrowRight aria-hidden size={12} strokeWidth={1.75} />
        </Link>
      </div>
    </section>
  );
}
