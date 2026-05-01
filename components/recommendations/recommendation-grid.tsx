"use client";

import type { RecommendationProfile } from "@/lib/recommendations/types";
import { RecommendationCard } from "./recommendation-card";

type Props = {
  profiles: RecommendationProfile[];
  onSelect: (profile: RecommendationProfile) => void;
  emptyLabel?: string;
  savedIds?: Set<string>;
  onToggleSave?: (profileId: string) => void;
};

/**
 * 3x4 responsive grid of recommendation cards.
 *
 * Layout breakpoints (Tailwind):
 *   default (mobile):  1 column
 *   sm  (>=640px):     2 columns
 *   md  (>=768px):     3 columns
 *
 * The grid expects exactly 12 profiles for the desktop layout but renders
 * any count gracefully — the placeholder ranking caps results at 12, which
 * matches the 3x4 desktop target.
 */
export function RecommendationGrid({ profiles, onSelect, emptyLabel, savedIds, onToggleSave }: Props) {
  if (profiles.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-10 text-center">
        <p className="text-[14px] text-[color:var(--color-text-muted)]">
          {emptyLabel ?? "No recommendations yet — finish your profile to see matches."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
      {profiles.map((profile) => (
        <RecommendationCard
          key={profile.id}
          profile={profile}
          onSelect={onSelect}
          saved={savedIds?.has(profile.id)}
          onToggleSave={onToggleSave}
        />
      ))}
    </div>
  );
}
