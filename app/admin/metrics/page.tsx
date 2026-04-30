import { requireAdmin } from "@/lib/auth/admin";
import { fetchMetrics, type DailyMetric, type MetricsSummary } from "@/lib/admin/metrics";

export const dynamic = "force-dynamic";

export default async function AdminMetricsPage() {
  await requireAdmin("reviewer");
  const m = await fetchMetrics();

  return (
    <main className="mx-auto w-full max-w-[1200px] px-5 py-8 md:px-8">
      <header className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
          Admin
        </p>
        <h1 className="mt-1 text-[20px] font-semibold tracking-tight text-[var(--color-text-strong)]">
          Platform metrics
        </h1>
      </header>

      {/* 7-day summary cards */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Signups (7d)" value={m.signups7d} />
        <StatCard label="Matches (7d)" value={m.matches7d} />
        <StatCard label="Intros sent (7d)" value={m.introsSent7d} />
        <StatCard label="Intros accepted (7d)" value={m.introsAccepted7d} />
      </div>

      {/* Funnel */}
      <section className="mb-8">
        <h2 className="mb-3 font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
          Verification funnel
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <FunnelCard label="Total users" value={m.funnel.totalUsers} />
          <FunnelCard label="Email verified" value={m.funnel.emailVerified} pct={pctOf(m.funnel.emailVerified, m.funnel.totalUsers)} />
          <FunnelCard label="Onboarded" value={m.funnel.onboarded} pct={pctOf(m.funnel.onboarded, m.funnel.totalUsers)} />
          <FunnelCard label="Profile verified" value={m.funnel.profileVerified} pct={pctOf(m.funnel.profileVerified, m.funnel.totalUsers)} />
          <FunnelCard label="Banned" value={m.funnel.banned} />
        </div>
      </section>

      {/* Sparkline charts (pure CSS bar charts — no dep) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <BarChart title="Daily signups (90d)" data={m.dailySignups} color="var(--color-brand)" />
        <BarChart title="Daily matches (90d)" data={m.dailyMatches} color="var(--color-text-strong)" />
        <BarChart title="Daily intros (90d)" data={m.dailyIntros} color="var(--color-brand-strong)" />
      </div>
    </main>
  );
}

function pctOf(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="border bg-[var(--color-surface)] px-4 py-3"
      style={{ borderColor: "var(--color-border)" }}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-faint)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-[24px] font-semibold tabular-nums text-[var(--color-text-strong)]">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function FunnelCard({
  label,
  value,
  pct,
}: {
  label: string;
  value: number;
  pct?: number;
}) {
  return (
    <div
      className="border bg-[var(--color-surface)] px-4 py-3"
      style={{ borderColor: "var(--color-border)" }}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-faint)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-[20px] font-semibold tabular-nums text-[var(--color-text-strong)]">
        {value.toLocaleString()}
        {pct != null ? (
          <span className="ml-1.5 text-[12px] font-normal text-[var(--color-text-muted)]">
            ({pct}%)
          </span>
        ) : null}
      </p>
    </div>
  );
}

function BarChart({
  title,
  data,
  color,
}: {
  title: string;
  data: DailyMetric[];
  color: string;
}) {
  const maxVal = Math.max(1, ...data.map((d) => d.value));

  return (
    <section
      className="border bg-[var(--color-surface)] p-4"
      style={{ borderColor: "var(--color-border)" }}
    >
      <h3 className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
        {title}
      </h3>
      {data.length === 0 ? (
        <p className="text-[13px] text-[var(--color-text-muted)]">No data yet.</p>
      ) : (
        <div className="flex h-[120px] items-end gap-px">
          {data.map((d) => {
            const h = Math.max(2, (d.value / maxVal) * 100);
            return (
              <div
                key={d.day}
                className="flex-1 transition-all"
                style={{
                  height: `${h}%`,
                  background: color,
                  minWidth: 2,
                }}
                title={`${d.day}: ${d.value}`}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
