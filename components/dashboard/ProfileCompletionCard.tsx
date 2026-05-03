import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProfileChecklistItem } from "@/lib/dashboards/mock-data";

type ProfileCompletionCardProps = {
  percent: number;
  band: string;
  upliftPct: number;
  checklist: ProfileChecklistItem[];
};

const RADIUS = 38;
const STROKE = 10;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ProfileCompletionCard({
  percent,
  band,
  upliftPct,
  checklist,
}: ProfileCompletionCardProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <section
      aria-labelledby="profile-completion-title"
      className="rounded-none border border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col"
    >
      {/* Header */}
      <header className="flex items-baseline justify-between px-6 pt-6 pb-5 border-b border-[var(--color-border)]">
        <h3
          id="profile-completion-title"
          className="text-[13px] font-semibold tracking-tight text-[var(--color-text)]"
        >
          Profile completion
        </h3>
        <span className="text-[11px] font-medium text-[var(--color-text-faint)]">
          {band}
        </span>
      </header>

      {/* Gauge + summary — stacked so it breathes in narrow sidebars */}
      <div className="flex flex-col items-center gap-4 px-6 py-7 border-b border-[var(--color-border)]">
        <CircularGauge percent={clamped} offset={offset} />
        <div className="w-full text-center">
          <p className="text-[14px] leading-5 font-semibold text-[var(--color-text)]">
            Almost there.
          </p>
          <p className="mt-1.5 text-[12px] leading-[1.5] text-[var(--color-text-muted)]">
            Complete your profile to unlock more matches.
          </p>
          <p className="mt-2 font-mono text-[11px] tabular-nums text-[var(--color-success)]">
            +{upliftPct}% more matches if completed
          </p>
        </div>
      </div>

      {/* Checklist */}
      <ul className="divide-y divide-[var(--color-border)] flex-1">
        {checklist.map((item) => {
          const Icon = item.done ? Check : Circle;
          return (
            <li key={item.id}>
              <Link
                href={item.href as Route}
                className={cn(
                  "group flex items-center gap-2.5 px-5 py-3",
                  "text-[12px] leading-[1.45]",
                  item.done
                    ? "text-[var(--color-text-muted)]"
                    : "text-[var(--color-text)]",
                )}
              >
                <Icon
                  aria-hidden
                  size={12}
                  strokeWidth={2}
                  className={cn(
                    "shrink-0",
                    item.done
                      ? "text-[var(--color-success)]"
                      : "text-[var(--color-text-faint)]",
                  )}
                />
                <span className="flex-1 truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* CTA */}
      <div className="px-6 py-5 border-t border-[var(--color-border)]">
        <Link
          href={"/build" as Route}
          className={cn(
            "inline-flex w-full items-center justify-center gap-1.5",
            "h-10 px-4",
            "rounded-none",
            "text-[13px] font-semibold text-white",
            "bg-[var(--color-brand-ink)]",
            "transition-colors duration-[120ms] ease-out",
            "hover:bg-[var(--color-brand-ink-hov)]",
          )}
        >
          Finish profile
          <ArrowRight aria-hidden size={14} strokeWidth={1.75} />
        </Link>
      </div>
    </section>
  );
}

function CircularGauge({ percent, offset }: { percent: number; offset: number }) {
  const size = 100;
  const center = size / 2;
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Profile completion ${clamped} percent`}
        className="block"
        style={{ width: size, height: size }}
      >
        <circle
          cx={center}
          cy={center}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          style={{ stroke: "var(--color-brand-tint)" }}
        />
        <circle
          cx={center}
          cy={center}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{
            stroke: "var(--color-brand)",
            transition: "stroke-dashoffset 360ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[20px] leading-6 font-bold tabular-nums text-[var(--color-text)]">
        {clamped}%
      </span>
    </div>
  );
}
