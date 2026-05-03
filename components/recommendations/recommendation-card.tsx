"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  InvestorRecommendation,
  RecommendationProfile,
  StartupRecommendation,
} from "@/lib/recommendations/types";

function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function CardLogo({ name }: { name: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const localLogo = `/mock-assets/${slugify(name)}/logo.png`;
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden rounded-[var(--radius-sm)]">
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={localLogo} alt={name} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span className="text-[12px] font-semibold text-[var(--color-text-faint)]">{initials}</span>
      )}
    </div>
  );
}

type Props = {
  profile: RecommendationProfile;
  onSelect: (profile: RecommendationProfile) => void;
  saved?: boolean;
  onToggleSave?: (profileId: string) => void;
};

/**
 * One card in the onboarding 3x4 recommendation grid.
 *
 * Renders the existing `Avatar` with deterministic initials + colour from
 * the stable mock id — no external image URLs, so nothing can break.
 *
 * Hover behaviour:
 *  - Border lifts to `--color-text-faint`.
 *  - Background brightens slightly.
 *  - Tagline gains weight.
 *
 * The card is fully clickable. Keyboard users get focus styles via the
 * default button focus ring.
 */
export function RecommendationCard({ profile, onSelect, saved = false, onToggleSave }: Props) {
  const meta = profileMeta(profile);

  return (
    <div
      className={cn(
        "group relative flex h-full flex-col gap-3 rounded-[var(--radius-md)]",
        "border bg-white p-5 text-left",
        "transition-all duration-150",
        saved
          ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)]/30"
          : "border-[color:var(--color-border)] hover:border-[color:var(--color-text-faint)] hover:bg-[color:var(--color-surface)]",
      )}
    >
      {onToggleSave && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave(profile.id);
          }}
          aria-label={saved ? "Remove from interested" : "Save to interested"}
          className={cn(
            "absolute right-3 top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full",
            "transition-colors duration-150",
            saved
              ? "bg-[color:var(--color-brand)] text-white"
              : "bg-white/80 text-[color:var(--color-text-faint)] hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-text)]",
          )}
        >
          <Bookmark className="h-3.5 w-3.5" strokeWidth={1.75} fill={saved ? "currentColor" : "none"} />
        </button>
      )}
      <button
        type="button"
        onClick={() => onSelect(profile)}
        className="flex flex-1 flex-col gap-3 text-left focus:outline-none"
      >
        <div className="flex items-center gap-3">
          <CardLogo name={profile.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-[color:var(--color-text)]">
              {profile.name}
            </p>
            <p className="truncate text-[11.5px] uppercase tracking-[0.05em] text-[color:var(--color-text-faint)]">
              {meta.eyebrow}
            </p>
          </div>
        </div>

        <p
          className={cn(
            "text-[13px] leading-snug text-[color:var(--color-text-muted)]",
            "transition-colors duration-150 group-hover:text-[color:var(--color-text)]",
            "line-clamp-3",
          )}
        >
          {profile.tagline}
        </p>

        <div className="mt-auto flex flex-wrap gap-1.5">
          {meta.chips.slice(0, 3).map((chip) => (
            <span
              key={chip}
              className={cn(
                "rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)]",
                "px-2 py-0.5 text-[11px] font-medium text-[color:var(--color-text-muted)]",
              )}
            >
              {chip}
            </span>
          ))}
        </div>
      </button>
    </div>
  );
}

function profileMeta(p: RecommendationProfile): {
  eyebrow: string;
  chips: string[];
} {
  if (p.kind === "startup") {
    return startupMeta(p);
  }
  return investorMeta(p);
}

function startupMeta(p: StartupRecommendation): { eyebrow: string; chips: string[] } {
  return {
    eyebrow: `${p.sector} · ${stageLabel(p.stage)}`,
    chips: [p.location, p.fundingAsk, p.customerType.toUpperCase()],
  };
}

function investorMeta(p: InvestorRecommendation): { eyebrow: string; chips: string[] } {
  const investorTypeLabel = p.investorType === "firm" ? "Firm" : "Angel";
  return {
    eyebrow: `${investorTypeLabel} · ${p.geography}`,
    chips: [p.checkRange, ...p.sectors.slice(0, 2)],
  };
}

const STAGE_LABEL: Record<string, string> = {
  idea: "Idea",
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  series_b_plus: "Series B+",
};

function stageLabel(stage: string): string {
  return STAGE_LABEL[stage] ?? stage;
}
