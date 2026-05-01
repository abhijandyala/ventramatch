"use client";

import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/profile/avatar";
import { RecommendationProfileModal } from "@/components/recommendations/recommendation-profile-modal";
import { MOCK_STARTUPS, MOCK_INVESTORS } from "@/lib/recommendations/mock-profiles";
import type { RecommendationProfile } from "@/lib/recommendations/types";
import { cn } from "@/lib/utils";
import { Bookmark, X } from "lucide-react";

const SAVED_KEY = "vm:interested-profiles";
const ALL_PROFILES: RecommendationProfile[] = [...MOCK_STARTUPS, ...MOCK_INVESTORS];

function readSaved(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function writeSaved(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
  } catch {
    // fail silently
  }
}

/**
 * Dashboard rail showing profiles the user bookmarked during onboarding
 * step 3. Reads from the same localStorage key the recommendations step
 * writes to. Profiles can be removed from here or opened in the detail
 * modal.
 */
export function InterestedProfilesRail() {
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<RecommendationProfile | null>(null);

  useEffect(() => {
    setSavedIds(readSaved());
  }, []);

  const profiles = savedIds
    .map((id) => ALL_PROFILES.find((p) => p.id === id))
    .filter(Boolean) as RecommendationProfile[];

  const removeSaved = useCallback((id: string) => {
    setSavedIds((prev) => {
      const next = prev.filter((x) => x !== id);
      writeSaved(next);
      return next;
    });
    if (selected?.id === id) setSelected(null);
  }, [selected]);

  const toggleSave = useCallback((id: string) => {
    setSavedIds((prev) => {
      const has = prev.includes(id);
      const next = has ? prev.filter((x) => x !== id) : [...prev, id];
      writeSaved(next);
      return next;
    });
  }, []);

  if (profiles.length === 0) return null;

  return (
    <section className="mb-5">
      <div className="mb-3 flex items-center gap-2">
        <Bookmark className="h-4 w-4 text-[color:var(--color-brand)]" strokeWidth={1.75} fill="currentColor" />
        <h2 className="text-[14px] font-semibold text-[color:var(--color-text)]">
          You&apos;re interested in
        </h2>
        <span className="text-[12px] text-[color:var(--color-text-faint)]">
          {profiles.length} saved
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className={cn(
              "group relative flex items-center gap-3 rounded-[var(--radius-md)]",
              "border border-[color:var(--color-border)] bg-white p-4",
              "transition-colors duration-150 hover:border-[color:var(--color-text-faint)]",
            )}
          >
            <button
              type="button"
              onClick={() => removeSaved(profile.id)}
              aria-label="Remove"
              className={cn(
                "absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full",
                "text-[color:var(--color-text-faint)] opacity-0 transition-all duration-150",
                "group-hover:opacity-100 hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-danger)]",
              )}
            >
              <X className="h-3 w-3" strokeWidth={2} />
            </button>

            <button
              type="button"
              onClick={() => setSelected(profile)}
              className="flex flex-1 items-center gap-3 text-left focus:outline-none"
            >
              <Avatar id={profile.id} name={profile.name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[color:var(--color-text)]">
                  {profile.name}
                </p>
                <p className="truncate text-[12px] text-[color:var(--color-text-muted)]">
                  {profile.tagline}
                </p>
              </div>
            </button>
          </div>
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
