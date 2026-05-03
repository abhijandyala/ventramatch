"use client";

import { useState, useCallback } from "react";
import { RecommendationProfileModal } from "@/components/recommendations/recommendation-profile-modal";
import { MOCK_STARTUPS, MOCK_INVESTORS } from "@/lib/recommendations/mock-profiles";
import type { RecommendationProfile } from "@/lib/recommendations/types";
import { cn } from "@/lib/utils";

function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function CompanyLogo({ name }: { name: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const localLogo = `/mock-assets/${slugify(name)}/logo.png`;
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={localLogo} alt={name} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span className="text-[12px] font-semibold text-[var(--color-text-faint)]">{initials}</span>
      )}
    </div>
  );
}

const SAVED_KEY = "vm:interested-profiles";

function readSaved(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}

function writeSaved(ids: string[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(ids)); } catch { /* */ }
}

/**
 * "Recommended for you" section showing 4 mock profiles
 * (startups for investors, investors for founders).
 */
export function RecommendedForYouRail({ role }: { role: "founder" | "investor" }) {
  const pool = role === "founder" ? MOCK_INVESTORS : MOCK_STARTUPS;
  const profiles = pool.slice(0, 4);
  const label = role === "founder" ? "Recommended investors" : "Recommended startups";

  const [selected, setSelected] = useState<RecommendationProfile | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>(() => readSaved());

  const toggleSave = useCallback((id: string) => {
    setSavedIds((prev) => {
      const has = prev.includes(id);
      const next = has ? prev.filter((x) => x !== id) : [...prev, id];
      writeSaved(next);
      return next;
    });
  }, []);

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[color:var(--color-text-strong)]">
            {label}
          </h2>
          <p className="mt-0.5 text-[12px] text-[color:var(--color-text-faint)]">
            Based on your profile · updated daily
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelected(p)}
            className={cn(
              "flex items-start gap-3 border border-[color:var(--color-border)] bg-white p-4 text-left",
              "transition-colors duration-150 hover:border-[color:var(--color-text-faint)]",
            )}
          >
            <CompanyLogo name={p.name} />
            <div className="flex-1 min-w-0">
              <p className="truncate text-[13px] font-semibold text-[color:var(--color-text)]">
                {p.name}
              </p>
              <p className="mt-0.5 text-[12px] leading-[1.4] text-[color:var(--color-text-muted)] line-clamp-2">
                {p.tagline}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {p.tags.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--color-text-faint)]"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <RecommendationProfileModal
          profile={selected}
          onClose={() => setSelected(null)}
          saved={savedIds.includes(selected.id)}
          onToggleSave={toggleSave}
        />
      )}
    </section>
  );
}
