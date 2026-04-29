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
      className="rounded-none border border-[var(--color-border)] bg-[var(--color-surface)] p-5 flex flex-col h-full"
    >
      <header className="flex items-baseline justify-between">
        <h3
          id="profile-completion-title"
          className="text-[14px] leading-5 font-semibold tracking-tight text-[var(--color-text)]"
        >
          Profile completion
        </h3>
        <span className="text-[12px] leading-4 font-medium text-[var(--color-text-faint)]">
          {band}
        </span>
      </header>

      <div className="mt-5 flex items-center gap-5">
        <CircularGauge percent={clamped} offset={offset} />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] leading-5 font-semibold text-[var(--color-text)]">
            Almost there.
          </p>
          <p className="mt-1 text-[12px] leading-4 text-[var(--color-text-muted)]">
            Complete your profile to unlock more matches.
          </p>
          <p className="mt-2 inline-flex items-center gap-1 font-mono text-[12px] leading-4 tabular-nums text-[var(--color-success)]">
            +{upliftPct}% more matches if completed
          </p>
        </div>
      </div>

      <ul className="mt-5 flex flex-col gap-2 flex-1">
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
                    ? "text-[var(--color-text-muted)]"
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
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href={"/profile" as Route}
        className={cn(
          "mt-6 inline-flex w-full items-center justify-center gap-1.5",
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
