import { z } from "zod";
import type { StartupStage } from "@/types/database";

/**
 * Discovery filter schema. URL-driven so filters are shareable, the back
 * button works, and saved searches are just a snapshot of these params.
 *
 * Both founder-side and investor-side feeds share the same shape — the
 * meaning of a field flips depending on who's looking:
 *   • investor viewer: industries = startup industries to include
 *   • founder viewer: industries = investor sectors to include
 *   …same for stages and geographies.
 *
 * Numeric ranges are in dollars (no cents) and are treated as inclusive.
 */

export const STARTUP_STAGES: StartupStage[] = [
  "idea",
  "pre_seed",
  "seed",
  "series_a",
  "series_b_plus",
];

export const STAGE_LABELS: Record<StartupStage, string> = {
  idea: "Idea",
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  series_b_plus: "Series B+",
};

export const SORT_OPTIONS = ["score", "recent"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<SortOption, string> = {
  score: "Best match",
  recent: "Most recent",
};

const csv = (s: string | undefined): string[] =>
  (s ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

const stagesCsv = (s: string | undefined): StartupStage[] =>
  csv(s).filter((v): v is StartupStage =>
    (STARTUP_STAGES as string[]).includes(v),
  );

const intOrUndef = (v: string | undefined): number | undefined => {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
};

export type FeedFilters = {
  /** Free-text search (FTS). */
  q?: string;
  /** Sectors / industries (case-insensitive equality). */
  industries: string[];
  /** Startup stages (enum match). */
  stages: StartupStage[];
  /** Geographies (substring match against location/geographies). */
  geographies: string[];
  /** Min check or raise size in USD. */
  amountMin?: number;
  /** Max check or raise size in USD. */
  amountMax?: number;
  /** Sort by best-match score (default) or most-recent. */
  sort: SortOption;
};

export const DEFAULT_FILTERS: FeedFilters = {
  q: undefined,
  industries: [],
  stages: [],
  geographies: [],
  amountMin: undefined,
  amountMax: undefined,
  sort: "score",
};

export const feedFiltersSchema = z.object({
  q: z.string().trim().max(200).optional(),
  industries: z.array(z.string().min(1).max(80)).max(20),
  stages: z.array(z.enum(STARTUP_STAGES as [StartupStage, ...StartupStage[]])).max(5),
  geographies: z.array(z.string().min(1).max(80)).max(20),
  amountMin: z.number().int().nonnegative().max(1_000_000_000).optional(),
  amountMax: z.number().int().nonnegative().max(1_000_000_000).optional(),
  sort: z.enum(SORT_OPTIONS),
});

/**
 * Parse URLSearchParams (or a Next searchParams object) into a typed
 * FeedFilters value. Tolerant — invalid values fall back to defaults
 * silently rather than throwing, because filters come from URL bars.
 */
export function parseFeedFilters(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): FeedFilters {
  const get = (k: string): string | undefined => {
    if (params instanceof URLSearchParams) return params.get(k) ?? undefined;
    const v = params[k];
    if (Array.isArray(v)) return v[0];
    return v ?? undefined;
  };

  const sort = SORT_OPTIONS.includes(get("sort") as SortOption)
    ? (get("sort") as SortOption)
    : "score";

  return {
    q: (get("q")?.trim() || undefined) ?? undefined,
    industries: csv(get("industries")),
    stages: stagesCsv(get("stages")),
    geographies: csv(get("geographies")),
    amountMin: intOrUndef(get("amountMin")),
    amountMax: intOrUndef(get("amountMax")),
    sort,
  };
}

/**
 * Inverse: filters → URLSearchParams. Skips defaults so the URL stays clean
 * (e.g. `?q=fintech` rather than `?q=fintech&industries=&stages=&sort=score`).
 */
export function filtersToSearchParams(filters: FeedFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (filters.q) sp.set("q", filters.q);
  if (filters.industries.length) sp.set("industries", filters.industries.join(","));
  if (filters.stages.length) sp.set("stages", filters.stages.join(","));
  if (filters.geographies.length) sp.set("geographies", filters.geographies.join(","));
  if (filters.amountMin != null) sp.set("amountMin", String(filters.amountMin));
  if (filters.amountMax != null) sp.set("amountMax", String(filters.amountMax));
  if (filters.sort !== "score") sp.set("sort", filters.sort);
  return sp;
}

/** True if any filter is non-default. Used to render the "Clear all" CTA. */
export function hasActiveFilters(filters: FeedFilters): boolean {
  return Boolean(
    filters.q ||
      filters.industries.length ||
      filters.stages.length ||
      filters.geographies.length ||
      filters.amountMin != null ||
      filters.amountMax != null ||
      filters.sort !== "score",
  );
}
