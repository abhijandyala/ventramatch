"use client";

import { useCallback, useMemo, useState } from "react";
import type { Role } from "@/lib/validation/onboarding";
import { getRecommendedProfiles } from "@/lib/recommendations/get-recommended-profiles";
import { candidatesForRole } from "@/lib/recommendations/mock-profiles";
import type { RecommendationProfile } from "@/lib/recommendations/types";
import { RecommendationGrid } from "@/components/recommendations/recommendation-grid";
import { RecommendationProfileModal } from "@/components/recommendations/recommendation-profile-modal";

const SAVED_KEY = "vm:interested-profiles";

function readSaved(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeSaved(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage might be disabled — fail silently
  }
}

type Props = {
  role: Role;
  lookingFor: string;
  description: string;
};

/**
 * Onboarding step 3 — "You might be interested in" preview.
 *
 * Users can bookmark profiles into their "interested" list, which
 * persists in localStorage and shows up on the dashboard.
 */
export function RecommendationsStep({ role, lookingFor, description }: Props) {
  const profiles = useMemo(() => {
    const candidates = candidatesForRole(role);
    return getRecommendedProfiles({
      currentUserProfile: {
        role,
        lookingFor: lookingFor.trim() || undefined,
        bio: description.trim() || undefined,
      },
      candidateProfiles: [...candidates],
      context: "onboarding",
      limit: 12,
    });
  }, [role, lookingFor, description]);

  const [selected, setSelected] = useState<RecommendationProfile | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(readSaved);

  const toggleSave = useCallback((profileId: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) {
        next.delete(profileId);
      } else {
        next.add(profileId);
      }
      writeSaved(next);
      return next;
    });
  }, []);

  return (
    <>
      {savedIds.size > 0 && (
        <p className="mb-4 text-[13px] text-[color:var(--color-text-muted)]">
          {savedIds.size} saved — these will appear on your dashboard.
        </p>
      )}
      <RecommendationGrid
        profiles={profiles}
        onSelect={(p) => setSelected(p)}
        emptyLabel="We don't have any sample profiles to show yet."
        savedIds={savedIds}
        onToggleSave={toggleSave}
      />
      {selected ? (
        <RecommendationProfileModal
          profile={selected}
          onClose={() => setSelected(null)}
          saved={savedIds.has(selected.id)}
          onToggleSave={toggleSave}
        />
      ) : null}
    </>
  );
}
