"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Loader2 } from "lucide-react";
import type { MatchResult } from "@/lib/matching/score";
import type { StartupPublic, InvestorPublic } from "@/lib/profile/visibility";
import type { InteractionAction } from "@/types/database";
import { recordInteractionAction } from "@/app/(dashboard)/feed/actions";
import { MOCK_STARTUPS, MOCK_INVESTORS } from "@/lib/recommendations/mock-profiles";
import type { RecommendationProfile } from "@/lib/recommendations/types";
import { cn } from "@/lib/utils";

const ALL_PROFILES: RecommendationProfile[] = [...MOCK_STARTUPS, ...MOCK_INVESTORS];

function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Tag({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium"
      style={{ background: "var(--color-surface)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
    >
      {label}
    </span>
  );
}

function ScoreBadge({ score, large }: { score: number; large: boolean }) {
  const fill = score >= 80;
  const mid = score >= 65;
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center justify-center rounded-[7px] text-center transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
        large ? "px-3.5 py-2" : "px-2.5 py-1",
      )}
      style={
        fill
          ? { background: "var(--color-brand-ink)", color: "#fff" }
          : mid
            ? { background: "var(--color-brand-tint)", color: "var(--color-brand-ink)", border: "1px solid var(--color-brand)" }
            : { background: "var(--color-surface)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }
      }
      title={`${score}% match — informational only.`}
    >
      <span className={cn("font-mono font-bold tabular-nums leading-none", large ? "text-[22px]" : "text-[15px]")}>{score}</span>
      <span className={cn("mt-0.5 font-semibold uppercase tracking-[0.07em] opacity-75", large ? "text-[9px]" : "text-[8px]")}>% match</span>
    </div>
  );
}

function LogoImg({ name, large }: { name: string; large: boolean }) {
  const [failed, setFailed] = useState(false);
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const src = `/mock-assets/${slugify(name)}/logo.png`;
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-[8px] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
        large ? "h-16 w-16" : "h-10 w-10",
      )}
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span className={cn("font-semibold text-[var(--color-text-faint)]", large ? "text-[16px]" : "text-[11px]")}>{initials}</span>
      )}
    </div>
  );
}

function TeamSection({ members }: { members: { name: string; role: string; photoUrl?: string | null }[] }) {
  if (members.length === 0) return null;
  const count = members.length;

  // ≤3: large square cards with photo, name, role
  // 4–8: medium squares with photo + name (no role, tighter)
  // 8+: overlapping circle avatars + "X+ people"
  if (count > 8) {
    const shown = members.slice(0, 5);
    const extra = count - 5;
    return (
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2.5">
          {shown.map((m) => (
            <MemberCircle key={m.name} m={m} size={36} />
          ))}
        </div>
        <span className="text-[12px] font-medium text-[var(--color-text-muted)]">
          +{extra} more
        </span>
      </div>
    );
  }

  if (count > 3) {
    return (
      <div className="grid grid-cols-4 gap-2">
        {members.slice(0, 8).map((m) => (
          <div key={m.name} className="flex flex-col items-center gap-1.5 text-center">
            <MemberSquare m={m} size={48} />
            <p className="truncate w-full text-[10.5px] font-medium text-[var(--color-text)]">{m.name.split(" ")[0]}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {members.slice(0, 3).map((m) => (
        <div key={m.name} className="flex flex-col items-center gap-2 text-center">
          <MemberSquare m={m} size={64} />
          <div className="min-w-0 w-full">
            <p className="truncate text-[12px] font-semibold text-[var(--color-text)]">{m.name}</p>
            <p className="truncate text-[10.5px] text-[var(--color-text-faint)]">{m.role}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function MemberSquare({ m, size }: { m: { name: string; photoUrl?: string | null }; size: number }) {
  const [failed, setFailed] = useState(false);
  const initials = m.name.split(" ").map((w) => w[0]).join("").slice(0, 2);
  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-[6px]"
      style={{ width: size, height: size, background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      {m.photoUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.photoUrl} alt={m.name} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span className="text-[11px] font-semibold text-[var(--color-text-faint)]">{initials}</span>
      )}
    </div>
  );
}

function MemberCircle({ m, size }: { m: { name: string; photoUrl?: string | null }; size: number }) {
  const [failed, setFailed] = useState(false);
  const initials = m.name.split(" ").map((w) => w[0]).join("").slice(0, 2);
  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-full border-2 border-white"
      style={{ width: size, height: size, background: "var(--color-surface)" }}
    >
      {m.photoUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.photoUrl} alt={m.name} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span className="text-[9px] font-semibold text-[var(--color-text-faint)]">{initials}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Card
// ─────────────────────────────────────────────────────────────────────────────

type Props =
  | { kind: "startup"; data: StartupPublic; match: MatchResult; viewerAction: InteractionAction | null; col?: number }
  | { kind: "investor"; data: InvestorPublic; match: MatchResult; viewerAction: InteractionAction | null; col?: number };

export function FeedCard({ kind, data, match, viewerAction: initialAction, col = 0 }: Props) {
  const [viewerAction, setViewerAction] = useState<InteractionAction | null>(initialAction);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const targetUserId = data.userId;
  const profileHref = `/p/${targetUserId}` as Route;
  const liked = viewerAction === "like";
  const passed = viewerAction === "pass";

  const videoUrl = data.videoUrl ?? null;
  const hasVideo = Boolean(videoUrl);

  // Look up team members from mock profile data
  const fullProfile = ALL_PROFILES.find((p) => p.id === targetUserId);
  const teamMembers = fullProfile?.kind === "startup" ? (fullProfile.teamMembers ?? []) : [];

  function act(action: InteractionAction, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    const prev = viewerAction;
    setViewerAction(action);
    startTransition(async () => {
      const res = await recordInteractionAction({ targetUserId, action });
      if (!res.ok) { setViewerAction(prev); setError(res.error); }
    });
  }

  const onEnter = useCallback(() => {
    setExpanded(true);
    if (hasVideo) {
      timerRef.current = setTimeout(() => setShowPreview(true), 3000);
    }
  }, [hasVideo]);

  const onLeave = useCallback(() => {
    setExpanded(false);
    setShowPreview(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, []);

  const stopPreview = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPreview(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  useEffect(() => {
    if (showPreview && videoRef.current) {
      videoRef.current.play().catch(() => setVideoError(true));
    }
  }, [showPreview]);

  const name = data.name;
  const subtitle = kind === "startup" ? subtitleStartup(data) : subtitleInvestor(data);
  const oneLiner = kind === "startup" ? data.oneLiner : (data.thesisPreview ?? "No thesis on file yet.");
  const matchReason = match.reason;

  const allTags: string[] = kind === "startup"
    ? [data.industry, labelStage(data.stage), ...(data.raiseBucket ? [labelRaiseBucket(data.raiseBucket)] : []), ...(data.location ? [data.location] : [])]
    : [...data.sectors.slice(0, 2), ...data.stages.slice(0, 2).map(labelStage), ...(data.checkBand ? [labelCheckBand(data.checkBand)] : [])];

  return (
    <article
      data-expanded={expanded || undefined}
      className="group flex flex-col bg-white"
      style={{
        position: "absolute",
        top: 0,
        // Right-column cards grow leftward; all others grow rightward
        ...(col === 2 ? { right: 0 } : { left: 0 }),
        width: expanded ? "200%" : "100%",
        height: "auto",
        zIndex: expanded ? 30 : 0,
        transition: "width 500ms cubic-bezier(0.16,1,0.3,1), box-shadow 300ms ease",
        border: expanded ? "1px solid var(--color-border)" : "none",
        boxShadow: expanded
          ? "0 16px 48px -8px oklch(22% 0.04 235 / 0.22), 0 4px 14px -4px oklch(22% 0.04 235 / 0.1)"
          : "none",
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {/* Full card link */}
      <Link
        href={profileHref}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 z-0"
        tabIndex={-1}
        aria-label={`View ${name} profile`}
      />

      {/* Video preview — only renders if the profile has a video */}
      {hasVideo && (
        <div
          className={cn(
            "absolute inset-0 z-20 flex flex-col bg-[var(--color-text-strong)] transition-opacity duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
            showPreview ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <div className="flex flex-1 items-center justify-center overflow-hidden">
            {videoError ? (
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-white/20 text-white/50">
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                </div>
                <p className="text-[15px] font-semibold text-white/90">{name}</p>
                <p className="mt-1 text-[12px] text-white/45">Video failed to load</p>
              </div>
            ) : (
              <video
                ref={videoRef}
                src={videoUrl!}
                muted
                playsInline
                className="h-full w-full object-cover"
                onError={() => setVideoError(true)}
              />
            )}
          </div>
          <button
            type="button"
            onClick={stopPreview}
            className="relative z-30 flex w-full items-center justify-center border-t border-white/10 py-3 text-[12px] font-medium text-white/60 transition-colors hover:text-white"
          >
            Stop preview
          </button>
        </div>
      )}

      {/* Card content */}
      <div className="relative z-10 flex flex-1 flex-col">

        {/* Header — logo + name grow on expand */}
        <div className={cn("flex items-start gap-3 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]", expanded ? "p-6 pb-5" : "p-5 pb-4")}>
          <LogoImg name={name} large={expanded} />
          <div className="min-w-0 flex-1">
            <p className={cn(
              "truncate font-semibold leading-tight tracking-[-0.01em] text-[var(--color-text-strong)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
              expanded ? "text-[18px]" : "text-[14.5px]",
            )}>
              {name}
            </p>
            {subtitle && (
              <p className={cn("mt-0.5 truncate text-[var(--color-text-faint)]", expanded ? "text-[12.5px]" : "text-[11px]")}>
                {subtitle}
              </p>
            )}
          </div>
          <ScoreBadge score={match.score} large={expanded} />
        </div>

        {/* Tagline + match reason */}
        <div className={cn("border-t border-[var(--color-border)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]", expanded ? "px-6 py-5" : "px-5 py-4")}>
          <p className={cn(
            "leading-[1.55] text-[var(--color-text-muted)]",
            expanded ? "text-[14px] line-clamp-4" : "text-[13px] line-clamp-2",
          )}>
            {oneLiner}
          </p>
          {expanded && matchReason && (
            <p className="mt-3 text-[12.5px] leading-[1.45] text-[var(--color-text-faint)] animate-[fadeIn_300ms_ease]">
              {matchReason}
            </p>
          )}
        </div>

        {/* Team — only visible when expanded */}
        {expanded && teamMembers.length > 0 && (
          <div className="border-t border-[var(--color-border)] px-6 py-5 animate-[fadeIn_300ms_ease]">
            <TeamSection members={teamMembers} />
          </div>
        )}

        {/* Tags */}
        <div className={cn("flex flex-wrap gap-1.5 border-t border-[var(--color-border)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]", expanded ? "px-6 py-4" : "px-5 py-3")}>
          {allTags.slice(0, expanded ? 6 : 4).map((t) => <Tag key={t} label={t} />)}
        </div>

        {/* Footer — View profile is a real link, actions slide in */}
        <div className={cn("flex items-center justify-between border-t border-[var(--color-border)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]", expanded ? "px-6 py-4" : "px-5 py-3")}>
          <Link
            href={profileHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "relative z-20 font-medium text-[var(--color-brand-ink)] transition-colors hover:text-[var(--color-text-strong)]",
              expanded ? "text-[13px]" : "text-[11.5px]",
            )}
          >
            View full profile →
          </Link>
          <div className={cn(
            "relative z-20 flex items-center gap-1 transition-all duration-200",
            expanded ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1",
          )}>
            <button
              type="button"
              onClick={(e) => act("pass", e)}
              disabled={isPending || liked}
              className={cn(
                "inline-flex items-center font-medium text-[var(--color-text-faint)] transition-colors hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50",
                expanded ? "h-8 px-3 text-[12px]" : "h-7 px-2.5 text-[11px]",
              )}
            >
              {passed ? "Passed" : "Pass"}
            </button>
            <button
              type="button"
              onClick={(e) => act("like", e)}
              disabled={isPending}
              className={cn(
                "inline-flex items-center gap-1 rounded-[6px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
                expanded ? "h-8 px-3 text-[12px]" : "h-7 px-2.5 text-[11px]",
              )}
              style={{ background: "var(--color-brand-ink)" }}
            >
              {isPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : null}
              {liked ? "Interested ✓" : "Interested"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="relative z-10 px-5 pb-2 text-[11px] text-[var(--color-danger)]">{error}</p>
      )}
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function subtitleStartup(s: StartupPublic): string {
  const parts: string[] = [];
  if (s.location) parts.push(s.location);
  if (s.website) parts.push(stripScheme(s.website));
  return parts.join(" · ");
}

function subtitleInvestor(i: InvestorPublic): string {
  const parts: string[] = [];
  if (i.firm) parts.push(i.firm);
  if (i.geographies.length > 0) parts.push(i.geographies.slice(0, 2).join(", "));
  return parts.join(" · ");
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

const STAGE_LABEL = { idea: "Idea", pre_seed: "Pre-seed", seed: "Seed", series_a: "Series A", series_b_plus: "Series B+" } as const;
function labelStage(stage: keyof typeof STAGE_LABEL): string { return STAGE_LABEL[stage]; }
function labelRaiseBucket(b: "small" | "medium" | "large"): string {
  return b === "small" ? "Raising <$1M" : b === "medium" ? "Raising $1–5M" : "Raising $5M+";
}
function labelCheckBand(b: "angel" | "small" | "mid" | "large"): string {
  return b === "angel" ? "Checks <$50K" : b === "small" ? "$50–250K checks" : b === "mid" ? "$250K–1M checks" : "$1M+ checks";
}
