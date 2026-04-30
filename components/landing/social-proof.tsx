import { withUserRls } from "@/lib/db";

/**
 * Server component: live counts from the database. Renders on the
 * landing page with real numbers instead of hardcoded placeholders.
 *
 * Cached via Next's RSC cache — stale for ~60s in prod which is fine
 * for social proof counts.
 */

type Counts = {
  verifiedInvestors: number;
  verifiedFounders: number;
  matchesMade: number;
};

async function loadCounts(): Promise<Counts> {
  try {
    return await withUserRls<Counts>(null, async (sql) => {
      const rows = await sql<{
        verified_investors: number;
        verified_founders: number;
        matches_made: number;
      }[]>`
        select
          (select count(*)::int from public.users
           where role = 'investor' and account_label = 'verified') as verified_investors,
          (select count(*)::int from public.users
           where role = 'founder' and account_label = 'verified') as verified_founders,
          (select count(*)::int from public.matches) as matches_made
      `;
      return {
        verifiedInvestors: rows[0]?.verified_investors ?? 0,
        verifiedFounders: rows[0]?.verified_founders ?? 0,
        matchesMade: rows[0]?.matches_made ?? 0,
      };
    });
  } catch {
    return { verifiedInvestors: 0, verifiedFounders: 0, matchesMade: 0 };
  }
}

export async function SocialProof() {
  const counts = await loadCounts();
  const total = counts.verifiedInvestors + counts.verifiedFounders;

  if (total === 0) return null;

  const stats = [
    counts.verifiedInvestors > 0
      ? { label: "Verified investors", value: counts.verifiedInvestors }
      : null,
    counts.verifiedFounders > 0
      ? { label: "Verified founders", value: counts.verifiedFounders }
      : null,
    counts.matchesMade > 0
      ? { label: "Matches made", value: counts.matchesMade }
      : null,
  ].filter(Boolean) as { label: string; value: number }[];

  return (
    <section className="border-t border-[var(--color-border)] py-10">
      <div className="mx-auto flex max-w-[960px] flex-wrap items-center justify-center gap-8 px-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <p className="font-mono text-[28px] font-semibold tabular-nums text-[var(--color-text-strong)]">
              {s.value.toLocaleString()}
            </p>
            <p className="mt-1 text-[12px] uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
              {s.label}
            </p>
          </div>
        ))}
        <p className="w-full text-center text-[11.5px] text-[var(--color-text-faint)]">
          Live data · updates in real time
        </p>
      </div>
    </section>
  );
}
