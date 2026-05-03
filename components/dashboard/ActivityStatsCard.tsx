import type { ProfileStats } from "@/lib/feed/query";

/**
 * Right-sidebar "Activity overview" card.
 *
 * Delta percentages are placeholder mock values until the backend
 * exposes rolling 30-day comparisons. Clearly annotated so they're
 * easy to wire up later.
 */

const MOCK_DELTAS = {
  viewers: 15,
  likes: 12,
  saves: 8,
  matches: 24,
} as const;

export function ActivityStatsCard({
  stats,
  viewerCount,
}: {
  stats: ProfileStats;
  viewerCount: number;
}) {
  const items = [
    { label: "Viewed your profile", value: viewerCount, delta: MOCK_DELTAS.viewers },
    { label: "Likes received", value: stats.likes, delta: MOCK_DELTAS.likes },
    { label: "Saves received", value: stats.saves, delta: MOCK_DELTAS.saves },
    { label: "Mutual matches", value: stats.matches, delta: MOCK_DELTAS.matches },
  ];

  return (
    <section
      aria-labelledby="activity-stats-title"
      className="border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden"
    >
      <div className="flex items-baseline justify-between gap-2 border-b border-[var(--color-border)] px-4 pt-4 pb-3">
        <h3
          id="activity-stats-title"
          className="text-[13px] font-semibold tracking-tight text-[var(--color-text)]"
        >
          Activity overview
        </h3>
        <span className="text-[11px] text-[var(--color-text-faint)]">This month</span>
      </div>

      <ul className="divide-y divide-[var(--color-border)]">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--color-text-muted)]">{item.label}</span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-[17px] font-semibold tabular-nums text-[var(--color-text-strong)]">
                {item.value.toLocaleString()}
              </span>
              <span
                className="inline-flex items-center px-1 py-0.5 font-mono text-[10px] font-bold tabular-nums"
                style={{
                  color: "var(--color-brand)",
                  background: "var(--color-brand-tint)",
                }}
              >
                +{item.delta}%
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
