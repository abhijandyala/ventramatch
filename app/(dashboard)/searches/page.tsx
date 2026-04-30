import type { Route } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { fetchSavedSearches, type SavedSearch } from "@/lib/saved-searches";
import { filtersToSearchParams, STAGE_LABELS } from "@/lib/feed/filters";
import { SavedSearchActions } from "@/components/feed/saved-search-actions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SearchesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  if (!session.user.onboardingCompleted) redirect("/onboarding");

  const searches = await fetchSavedSearches(session.user.id);
  console.log(`[searches] userId=${session.user.id} count=${searches.length}`);

  return (
    <>
      <header className="relative overflow-hidden border-b border-[var(--color-border)]">
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 -z-10 h-[180px]",
            "bg-[radial-gradient(60%_60%_at_15%_0%,var(--color-brand-tint)_0%,transparent_70%)]",
            "opacity-70",
          )}
        />
        <div className="mx-auto w-full max-w-[1100px] px-4 sm:px-6 py-5 sm:py-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
            Saved searches
          </p>
          <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.015em] text-[var(--color-text)]">
            Your filter snapshots
          </h1>
          <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
            One click to re-run any saved filter set. Toggle email notifications to get a weekly digest.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] px-4 sm:px-6 py-6">
        {searches.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid grid-cols-1 gap-3">
            {searches.map((s) => (
              <li key={s.id}>
                <SavedSearchRow search={s} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function SavedSearchRow({ search }: { search: SavedSearch }) {
  const sp = filtersToSearchParams(search.filters);
  const href = (sp.toString() ? `/feed?${sp.toString()}` : "/feed") as Route;
  const summary = summariseFilters(search);

  return (
    <article
      className="flex flex-col gap-3 border bg-[var(--color-surface)] p-4"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <Link
          href={href}
          className="text-[15px] font-semibold tracking-tight text-[var(--color-text-strong)] hover:underline"
        >
          {search.name}
        </Link>
        <span className="font-mono text-[10.5px] text-[var(--color-text-faint)]">
          Saved {search.createdAt.toLocaleDateString()}
        </span>
      </div>

      {summary.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {summary.map((s) => (
            <li
              key={s}
              className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-muted)]"
              style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)" }}
            >
              {s}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] italic text-[var(--color-text-faint)]">
          No filters applied — this saved search returns everything.
        </p>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
        <SavedSearchActions
          id={search.id}
          name={search.name}
          notifyEmail={search.notifyEmail}
        />
        <Link
          href={href}
          className="inline-flex h-8 items-center gap-1.5 px-3 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--color-brand)" }}
        >
          Run search →
        </Link>
      </footer>
    </article>
  );
}

function summariseFilters(s: SavedSearch): string[] {
  const out: string[] = [];
  if (s.filters.q) out.push(`"${s.filters.q}"`);
  for (const stage of s.filters.stages) out.push(STAGE_LABELS[stage]);
  for (const ind of s.filters.industries) out.push(ind);
  for (const geo of s.filters.geographies) out.push(geo);
  if (s.filters.amountMin != null) out.push(`≥ $${s.filters.amountMin.toLocaleString()}`);
  if (s.filters.amountMax != null) out.push(`≤ $${s.filters.amountMax.toLocaleString()}`);
  if (s.filters.sort !== "score") out.push(`sort: ${s.filters.sort}`);
  return out;
}

function EmptyState() {
  return (
    <div
      className="border border-dashed p-8 text-center"
      style={{ borderColor: "var(--color-border-strong, var(--color-border))" }}
    >
      <p className="text-[14px] font-semibold text-[var(--color-text-strong)]">
        No saved searches yet
      </p>
      <p className="mt-2 text-[13px] leading-[1.5] text-[var(--color-text-muted)]">
        Apply filters on the discovery feed and click <span className="font-medium">Save this search</span> to keep them.
      </p>
      <Link
        href={"/feed" as Route}
        className="mt-4 inline-flex h-9 items-center px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        style={{ background: "var(--color-text-strong)" }}
      >
        Open feed
      </Link>
    </div>
  );
}
