"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import type { MatchResult } from "@/lib/matching/score";
import type {
  StartupPublic,
  InvestorPublic,
} from "@/lib/profile/visibility";
import type { InteractionAction } from "@/types/database";
import { recordInteractionAction } from "@/app/(dashboard)/feed/actions";

/**
 * Unified feed card for both sides of the marketplace. Same shell, slot
 * differences for startup vs investor data. Handles its own optimistic
 * state for the Interested / Pass / Save buttons.
 *
 * Visually distinct from a Tinder card by design (per docs/legal.md):
 *   - Sector chips + match-score pill + 1-line reason on the left
 *   - Two text-button actions (Interested / Pass) at the bottom right,
 *     plus a Save (bookmark) micro-action top right
 *   - No full-bleed photo, no large circular X / heart / star buttons
 */

type Props =
  | {
      kind: "startup";
      data: StartupPublic;
      match: MatchResult;
      viewerAction: InteractionAction | null;
    }
  | {
      kind: "investor";
      data: InvestorPublic;
      match: MatchResult;
      viewerAction: InteractionAction | null;
    };

export function FeedCard(props: Props) {
  const { kind, data, match, viewerAction: initialAction } = props;
  const [viewerAction, setViewerAction] = useState<InteractionAction | null>(initialAction);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const targetUserId = data.userId;
  const profileHref = `/p/${targetUserId}` as Route;

  const liked = viewerAction === "like";
  const passed = viewerAction === "pass";
  const saved = viewerAction === "save";

  function act(action: InteractionAction) {
    setError(null);
    // Optimistic — flip immediately, revert on error.
    const prev = viewerAction;
    setViewerAction(action);
    startTransition(async () => {
      const res = await recordInteractionAction({ targetUserId, action });
      if (!res.ok) {
        setViewerAction(prev);
        setError(res.error);
      }
    });
  }

  return (
    <article
      className="group relative flex flex-col gap-4 border bg-[var(--color-surface)] p-5 transition-colors hover:border-[var(--color-text-faint)]"
      style={{ borderColor: "var(--color-border)" }}
    >
      {/* Top row: identity + score + save */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={profileHref}
            className="block truncate text-[16px] font-semibold tracking-tight text-[var(--color-text-strong)] hover:underline"
          >
            {kind === "startup" ? data.name : data.name}
          </Link>
          <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-muted)]">
            {kind === "startup" ? subtitleStartup(data) : subtitleInvestor(data)}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <MatchScorePill score={match.score} />
          <button
            type="button"
            onClick={() => act("save")}
            aria-label={saved ? "Saved" : "Save"}
            aria-pressed={saved}
            disabled={isPending}
            className="grid h-7 w-7 place-items-center transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            style={{ color: saved ? "var(--color-brand)" : "var(--color-text-faint)" }}
            title={saved ? "Saved to bookmarks" : "Save for later"}
          >
            {saved ? (
              <BookmarkCheck aria-hidden size={16} strokeWidth={1.75} />
            ) : (
              <Bookmark aria-hidden size={16} strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>

      {/* Description / one-liner */}
      <p className="text-[14px] leading-[1.55] text-[var(--color-text)]">
        {kind === "startup" ? data.oneLiner : data.thesisPreview ?? "No thesis on file yet."}
      </p>

      {/* Chips: sectors + stage + check / raise band */}
      <div className="flex flex-wrap gap-1.5">
        {kind === "startup" ? (
          <>
            <Chip>{data.industry}</Chip>
            <Chip variant="stage">{labelStage(data.stage)}</Chip>
            {data.raiseBucket ? <Chip variant="brand">{labelRaiseBucket(data.raiseBucket)}</Chip> : null}
            {data.location ? <Chip>{data.location}</Chip> : null}
          </>
        ) : (
          <>
            {data.sectors.slice(0, 3).map((s) => <Chip key={s}>{s}</Chip>)}
            {data.stages.slice(0, 2).map((s) => <Chip key={s} variant="stage">{labelStage(s)}</Chip>)}
            {data.checkBand ? <Chip variant="brand">{labelCheckBand(data.checkBand)}</Chip> : null}
          </>
        )}
      </div>

      {/* Match reason (1 line, plain English) */}
      <p className="text-[12.5px] leading-[1.5] text-[var(--color-text-muted)]">
        {match.reason}
      </p>

      {/* Bottom row: action buttons */}
      <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-4">
        <Link
          href={profileHref}
          className="text-[12.5px] font-medium text-[var(--color-text-muted)] underline-offset-4 transition-colors hover:text-[var(--color-text-strong)] hover:underline"
        >
          View profile →
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => act("pass")}
            disabled={isPending || liked}
            className="inline-flex h-9 items-center px-3 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {passed ? "Passed" : "Pass"}
          </button>
          <button
            type="button"
            onClick={() => act("like")}
            disabled={isPending}
            className="inline-flex h-9 items-center gap-1.5 px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: liked ? "var(--color-brand-strong)" : "var(--color-brand)" }}
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {liked ? "Interested ✓" : "Interested"}
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-[12px] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </article>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Subcomponents & helpers
// ──────────────────────────────────────────────────────────────────────────

function MatchScorePill({ score }: { score: number }) {
  const tone =
    score >= 80 ? "high" :
    score >= 60 ? "med" :
    "low";

  // High scores get a clean filled pill (no border). Mid/low keep the
  // border for definition against the calmer surface background.
  const styles: Record<typeof tone, { bg: string; color: string; border: string | undefined }> = {
    high: { bg: "var(--color-brand)", color: "#ffffff", border: undefined },
    med: { bg: "var(--color-surface)", color: "var(--color-text-strong)", border: "var(--color-border)" },
    low: { bg: "var(--color-surface)", color: "var(--color-text-muted)", border: "var(--color-border)" },
  };
  const s = styles[tone];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 font-mono text-[12px] font-semibold tabular-nums"
      style={{
        background: s.bg,
        color: s.color,
        border: s.border ? `1px solid ${s.border}` : undefined,
      }}
      title={`${score}% match score — heuristic, informational only.`}
    >
      {score}%
    </span>
  );
}

type ChipVariant = "neutral" | "stage" | "brand";

function Chip({
  children,
  variant = "neutral",
}: {
  children: React.ReactNode;
  variant?: ChipVariant;
}) {
  const styles: Record<ChipVariant, { bg: string; color: string; border: string }> = {
    // Sectors / location: low-emphasis bordered chip.
    neutral: {
      bg: "var(--color-surface)",
      color: "var(--color-text-muted)",
      border: "var(--color-border)",
    },
    // Stage: tinted neutral so the funding lifecycle reads at a glance
    // without competing with the brand-tinted raise/check chip.
    stage: {
      bg: "var(--color-surface-2)",
      color: "var(--color-text-strong)",
      border: "var(--color-border)",
    },
    // Raise/check size: brand-tinted, strongest visual weight.
    brand: {
      bg: "var(--color-brand-tint)",
      color: "var(--color-brand-strong)",
      border: "var(--color-brand)",
    },
  };
  const s = styles[variant];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {children}
    </span>
  );
}

function subtitleStartup(s: StartupPublic): string {
  const parts: string[] = [];
  if (s.location) parts.push(s.location);
  if (s.website) parts.push(stripScheme(s.website));
  return parts.join(" · ") || "Startup";
}

function subtitleInvestor(i: InvestorPublic): string {
  const parts: string[] = [];
  if (i.firm) parts.push(i.firm);
  if (i.geographies.length > 0) parts.push(i.geographies.slice(0, 2).join(", "));
  return parts.join(" · ") || "Investor";
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

const STAGE_LABEL = {
  idea: "Idea",
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  series_b_plus: "Series B+",
} as const;

function labelStage(stage: keyof typeof STAGE_LABEL): string {
  return STAGE_LABEL[stage];
}

function labelRaiseBucket(b: "small" | "medium" | "large"): string {
  return b === "small" ? "Raising <$1M" : b === "medium" ? "Raising $1–5M" : "Raising $5M+";
}

function labelCheckBand(b: "angel" | "small" | "mid" | "large"): string {
  return b === "angel"
    ? "Checks <$50K"
    : b === "small"
      ? "$50–250K checks"
      : b === "mid"
        ? "$250K–1M checks"
        : "$1M+ checks";
}
