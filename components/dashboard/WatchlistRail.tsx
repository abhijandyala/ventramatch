"use client";

import { useCallback, useEffect, useState } from "react";
import { RecommendationProfileModal } from "@/components/recommendations/recommendation-profile-modal";
import { MOCK_STARTUPS, MOCK_INVESTORS } from "@/lib/recommendations/mock-profiles";
import type { RecommendationProfile } from "@/lib/recommendations/types";
import { cn } from "@/lib/utils";
import { X, Eye } from "lucide-react";

function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function SmallLogo({ name }: { name: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const localLogo = `/mock-assets/${slugify(name)}/logo.png`;
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={localLogo} alt={name} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span className="text-[9px] font-semibold text-[var(--color-text-faint)]">{initials}</span>
      )}
    </div>
  );
}

const WATCHLIST_KEY = "vm:watchlist-profiles";
const ALL_PROFILES: RecommendationProfile[] = [...MOCK_STARTUPS, ...MOCK_INVESTORS];

function readWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}

function writeWatchlist(ids: string[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(ids)); } catch { /* */ }
}

export function WatchlistRail() {
  const [ids, setIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<RecommendationProfile | null>(null);

  useEffect(() => { setIds(readWatchlist()); }, []);

  const profiles = ids
    .map((id) => ALL_PROFILES.find((p) => p.id === id))
    .filter(Boolean) as RecommendationProfile[];

  const remove = useCallback((id: string) => {
    setIds((prev) => {
      const next = prev.filter((x) => x !== id);
      writeWatchlist(next);
      return next;
    });
    if (selected?.id === id) setSelected(null);
  }, [selected]);

  const toggleSave = useCallback((id: string) => {
    setIds((prev) => {
      const has = prev.includes(id);
      const next = has ? prev.filter((x) => x !== id) : [...prev, id];
      writeWatchlist(next);
      return next;
    });
  }, []);

  if (profiles.length === 0) return null;

  return (
    <section className="border-b border-[color:var(--color-border)] py-7">
      <div className="mb-4 flex items-baseline gap-2.5">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[color:var(--color-text-strong)]">
          Watchlist
        </h2>
        <span className="text-[12px] text-[color:var(--color-text-faint)]">
          {profiles.length} watching
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className={cn(
              "group relative flex shrink-0 items-center gap-3 w-[260px]",
              "border border-[color:var(--color-border)] bg-white p-3.5",
              "transition-colors duration-150 hover:border-[color:var(--color-text-faint)]",
            )}
          >
            <button
              type="button"
              onClick={() => remove(profile.id)}
              aria-label="Remove from watchlist"
              className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-[color:var(--color-text-faint)] opacity-0 transition-all duration-150 group-hover:opacity-100 hover:text-[color:var(--color-danger)]"
            >
              <X className="h-3 w-3" strokeWidth={2} />
            </button>

            <button
              type="button"
              onClick={() => setSelected(profile)}
              className="flex flex-1 min-w-0 items-center gap-3 text-left focus:outline-none"
            >
              <SmallLogo name={profile.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-[color:var(--color-text)]">
                  {profile.name}
                </p>
                <p className="truncate text-[11px] text-[color:var(--color-text-muted)]">
                  {profile.tagline}
                </p>
              </div>
              <Eye className="h-3.5 w-3.5 shrink-0 text-[color:var(--color-text-faint)]" strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </div>

      {selected && (
        <RecommendationProfileModal
          profile={selected}
          onClose={() => setSelected(null)}
          saved={ids.includes(selected.id)}
          onToggleSave={toggleSave}
        />
      )}
    </section>
  );
}
