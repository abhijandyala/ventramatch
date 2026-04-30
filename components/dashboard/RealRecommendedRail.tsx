import type { Route } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FeedCard } from "@/components/feed/feed-card";
import type { FeedStartupCard, FeedInvestorCard } from "@/lib/feed/query";
import type { ProfileStats } from "@/lib/feed/query";

/**
 * Live "Top picks" rail on the dashboard. Renders the top-3 cards from the
 * real feed query (same source as /feed, just truncated). The mock-data
 * cards below this rail will get retired in Sprint 6 once we have real
 * activity data.
 */

type Props =
  | {
      kind: "investor";
      items: FeedStartupCard[];
      stats: ProfileStats;
    }
  | {
      kind: "founder";
      items: FeedInvestorCard[];
      stats: ProfileStats;
    };

export function RealRecommendedRail(props: Props) {
  const { kind, items, stats } = props;
  const empty = items.length === 0;

  return (
    <section className="mb-5" aria-labelledby="real-rec-title">
      <header className="mb-3 flex items-baseline justify-between gap-4">
        <div>
          <h2
            id="real-rec-title"
            className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]"
          >
            {kind === "investor" ? "New startups in your thesis" : "Investors who fit your raise"}
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--color-text-faint)]">
            Live data · ranked by match score
          </p>
        </div>
        <Link
          href={"/feed" as Route}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          View all
          <ArrowRight aria-hidden size={12} strokeWidth={1.75} />
        </Link>
      </header>

      <StatsStrip stats={stats} />

      {empty ? (
        <EmptyHint kind={kind} />
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {items.slice(0, 3).map((it) => (
            <li key={it.card.userId}>
              {kind === "investor" ? (
                <FeedCard
                  kind="startup"
                  data={(it as FeedStartupCard).card}
                  match={it.match}
                  viewerAction={it.viewerAction}
                />
              ) : (
                <FeedCard
                  kind="investor"
                  data={(it as FeedInvestorCard).card}
                  match={it.match}
                  viewerAction={it.viewerAction}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatsStrip({ stats }: { stats: ProfileStats }) {
  const cells = [
    { label: "Likes received", value: stats.likes },
    { label: "Saves received", value: stats.saves },
    { label: "Mutual matches", value: stats.matches },
  ];
  return (
    <ul className="grid grid-cols-3 border bg-[var(--color-surface)]" style={{ borderColor: "var(--color-border)" }}>
      {cells.map((c, i) => (
        <li
          key={c.label}
          className="px-4 py-3"
          style={{
            borderRight: i < cells.length - 1 ? "1px solid var(--color-border)" : undefined,
          }}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-faint)]">
            {c.label}
          </p>
          <p className="mt-1 font-mono text-[20px] font-semibold tabular-nums text-[var(--color-text-strong)]">
            {c.value.toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}

function EmptyHint({ kind }: { kind: "founder" | "investor" }) {
  return (
    <div
      className="mt-3 border border-dashed p-5 text-center"
      style={{ borderColor: "var(--color-border-strong, var(--color-border))" }}
    >
      <p className="text-[13px] text-[var(--color-text-muted)]">
        {kind === "investor"
          ? "No verified startups match your filters yet — your feed updates in real time as new founders are approved."
          : "No verified investors match your raise yet — your feed updates as new investors are approved."}
      </p>
    </div>
  );
}
