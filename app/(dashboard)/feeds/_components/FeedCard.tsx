"use client";

import { Bookmark, ExternalLink, MessageSquare, ThumbsDown, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InvestorFeedItem = {
  type: "investor";
  id: string;
  fundName: string;
  stage: string;
  sector: string;
  checkSize: string;
  geography: string;
  investingStatus: "actively investing" | "paused" | "selectively investing";
  matchScore: number;
  reasons: string[];
  flag?: string;
};

export type StartupFeedItem = {
  type: "startup";
  id: string;
  name: string;
  industry: string;
  stage: string;
  location: string;
  amountRaising: string;
  pitch: string;
  traction: string;
  matchScore: number;
  reasons: string[];
  flag?: string;
  trustBadge?: string;
};

export type FeedItem = InvestorFeedItem | StartupFeedItem;

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

export const MOCK_INVESTORS: InvestorFeedItem[] = [
  {
    type: "investor",
    id: "inv-1",
    fundName: "Emergent Capital",
    stage: "Pre-seed · Seed",
    sector: "AI / ML · SaaS",
    checkSize: "$100K–$750K",
    geography: "US · Europe",
    investingStatus: "actively investing",
    matchScore: 92,
    reasons: [
      "Actively writing checks at Pre-seed — your current stage",
      "AI/ML thesis aligns with your core product vertical",
      "Check size fits your $500K raise target",
    ],
    flag: "Responded to 4 founders this week",
  },
  {
    type: "investor",
    id: "inv-2",
    fundName: "Sequoia Scout Fund",
    stage: "Seed · Series A",
    sector: "AI / ML · Deeptech",
    checkSize: "$500K–$2M",
    geography: "US · Global",
    investingStatus: "selectively investing",
    matchScore: 85,
    reasons: [
      "Deep focus on AI infrastructure — relevant to your stack",
      "Portfolio includes two direct comparables",
      "Partner has backed B2B SaaS at your stage before",
    ],
    flag: "Active on VentraMatch this week",
  },
  {
    type: "investor",
    id: "inv-3",
    fundName: "Greenfield Angels",
    stage: "Pre-seed",
    sector: "Cleantech · Impact",
    checkSize: "$50K–$300K",
    geography: "Global",
    investingStatus: "actively investing",
    matchScore: 78,
    reasons: [
      "Impact-focused mandate matches your sustainability angle",
      "Has backed solo founders at pre-revenue stage",
      "Geographic flexibility — invests globally",
    ],
  },
  {
    type: "investor",
    id: "inv-4",
    fundName: "Horizon Ventures",
    stage: "Seed",
    sector: "Consumer · Marketplace",
    checkSize: "$250K–$1M",
    geography: "US",
    investingStatus: "actively investing",
    matchScore: 71,
    reasons: [
      "Consumer marketplace playbook matches your GTM",
      "Check size range covers your target raise",
      "US-based team — convenient for in-person meetings",
    ],
  },
  {
    type: "investor",
    id: "inv-5",
    fundName: "Atlas Capital Partners",
    stage: "Series A",
    sector: "Fintech · Deeptech",
    checkSize: "$1M–$5M",
    geography: "US",
    investingStatus: "paused",
    matchScore: 64,
    reasons: [
      "Sector overlap with your fintech components",
      "Strong value-add in regulatory navigation",
      "Currently paused — good to save for next round",
    ],
  },
];

export const MOCK_STARTUPS: StartupFeedItem[] = [
  {
    type: "startup",
    id: "sta-1",
    name: "Nimblex",
    industry: "AI / ML",
    stage: "Pre-seed",
    location: "San Francisco, CA",
    amountRaising: "$750K",
    pitch: "AI copilot for enterprise procurement teams that cuts sourcing time by 60%.",
    traction: "$12K MRR · +18% m/m",
    matchScore: 88,
    reasons: [
      "AI/ML thesis — direct product-market fit with your focus",
      "Traction above your typical pre-seed threshold",
      "Check size lands squarely in your $500K–$1M range",
    ],
    trustBadge: "Verified Founder",
    flag: "2 investors expressed interest this week",
  },
  {
    type: "startup",
    id: "sta-2",
    name: "Tidal Health",
    industry: "Healthtech",
    stage: "Seed",
    location: "New York, NY",
    amountRaising: "$2M",
    pitch: "Remote patient monitoring platform reducing hospital readmissions by 40% for post-surgical patients.",
    traction: "$45K MRR · 3 hospital pilots signed",
    matchScore: 82,
    reasons: [
      "Healthtech with proven clinical outcomes — rare at Seed",
      "Revenue quality and contract type reduce risk",
      "Founding team has deep domain + prior exit",
    ],
    trustBadge: "Verified Founder",
  },
  {
    type: "startup",
    id: "sta-3",
    name: "EduSync",
    industry: "Edtech",
    stage: "Pre-seed",
    location: "Remote",
    amountRaising: "$400K",
    pitch: "Adaptive learning paths for community college students, reducing drop-out rates by 35%.",
    traction: "2 college partnerships · 1,200 active students",
    matchScore: 74,
    reasons: [
      "Impact metrics are strong relative to raise size",
      "Early institutional validation de-risks the deal",
      "Fits your early-stage community-impact thesis",
    ],
  },
  {
    type: "startup",
    id: "sta-4",
    name: "Carbonless",
    industry: "Cleantech",
    stage: "Pre-seed",
    location: "Austin, TX",
    amountRaising: "$500K",
    pitch: "Carbon accounting API for mid-market manufacturing companies to automate Scope 3 reporting.",
    traction: "$8K MRR · LOI from Fortune 500 supplier",
    matchScore: 76,
    reasons: [
      "Regulatory tailwind makes this a timely bet",
      "API-first model creates high switching costs",
      "Check size fits your sweet spot",
    ],
    flag: "Featured in Climate Tech Weekly",
  },
  {
    type: "startup",
    id: "sta-5",
    name: "Payflo",
    industry: "Fintech",
    stage: "Seed",
    location: "Miami, FL",
    amountRaising: "$1.5M",
    pitch: "Earned wage access platform for hourly workers at restaurant chains — no employer integration required.",
    traction: "$28K MRR · 4 franchise groups · +22% m/m",
    matchScore: 69,
    reasons: [
      "Fintech vertical aligns with sector interest",
      "No-employer-integration moat is a strong differentiator",
      "Growth rate exceeds median for stage",
    ],
    trustBadge: "Verified Founder",
  },
];

// ---------------------------------------------------------------------------
// Card component
// ---------------------------------------------------------------------------

type FeedCardProps = {
  item: FeedItem;
  role: "founder" | "investor";
  onSave: (id: string) => void;
  onPass: (id: string) => void;
  saved: boolean;
  passed: boolean;
};

export function FeedCard({ item, role, onSave, onPass, saved, passed }: FeedCardProps) {
  const matchScore = item.matchScore;
  const matchColor =
    matchScore >= 80
      ? "var(--color-brand-strong)"
      : matchScore >= 65
        ? "var(--color-warn)"
        : "var(--color-text-muted)";
  const matchBg =
    matchScore >= 80
      ? "var(--color-brand-tint)"
      : matchScore >= 65
        ? "#fef3c7"
        : "var(--color-surface-2)";

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border transition-all duration-200",
        "hover:shadow-[0_4px_24px_rgba(0,0,0,0.07)]",
        passed && "opacity-50 saturate-50",
      )}
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      {/* Match badge */}
      <div
        className="absolute right-4 top-4 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums"
        style={{ background: matchBg, color: matchColor }}
      >
        {matchScore}% match
      </div>

      <div className="p-5 pr-28">
        {item.type === "investor" ? (
          <InvestorHeader item={item} />
        ) : (
          <StartupHeader item={item} />
        )}
      </div>

      {/* Why this matches */}
      <div
        className="mx-5 mb-5 rounded-xl p-4"
        style={{ background: "var(--color-surface-2)" }}
      >
        <p
          className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--color-text-faint)" }}
        >
          Why this matches
        </p>
        <ul className="flex flex-col gap-1.5">
          {item.reasons.map((reason, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-[13px] leading-5"
              style={{ color: "var(--color-text-muted)" }}
            >
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "var(--color-brand)" }}
              />
              {reason}
            </li>
          ))}
        </ul>
      </div>

      {/* Flag */}
      {item.flag && (
        <div
          className="mx-5 mb-4 flex items-center gap-1.5 text-[12px]"
          style={{ color: "var(--color-brand-strong)" }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--color-brand)" }}
          />
          {item.flag}
        </div>
      )}

      {/* Footer */}
      <div
        className="flex items-center justify-between gap-3 border-t px-5 py-3.5"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] border px-3",
              "text-[13px] font-medium transition-colors duration-[120ms]",
              "hover:border-[var(--color-text-faint)] hover:text-[var(--color-text)]",
            )}
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text-muted)",
              background: "var(--color-surface)",
            }}
          >
            <ExternalLink size={12} strokeWidth={1.75} aria-hidden />
            View Profile
          </button>

          {role === "investor" ? (
            <button
              type="button"
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] border px-3",
                "text-[13px] font-medium transition-colors duration-[120ms]",
                "hover:border-[var(--color-text-faint)] hover:text-[var(--color-text)]",
              )}
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-text-muted)",
                background: "var(--color-surface)",
              }}
            >
              <MessageSquare size={12} strokeWidth={1.75} aria-hidden />
              Message
            </button>
          ) : (
            <button
              type="button"
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] border px-3",
                "text-[13px] font-medium transition-colors duration-[120ms]",
                "hover:border-[var(--color-text-faint)] hover:text-[var(--color-text)]",
              )}
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-text-muted)",
                background: "var(--color-surface)",
              }}
            >
              <UserPlus size={12} strokeWidth={1.75} aria-hidden />
              Request Intro
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={saved ? "Unsave" : "Save"}
            onClick={() => onSave(item.id)}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] border transition-colors duration-[120ms]",
              saved
                ? "border-[var(--color-brand)] text-[var(--color-brand)]"
                : "border-[var(--color-border)] text-[var(--color-text-faint)] hover:border-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]",
            )}
            style={{ background: saved ? "var(--color-brand-tint)" : "var(--color-surface)" }}
          >
            <Bookmark size={13} strokeWidth={1.75} aria-hidden fill={saved ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            aria-label="Pass"
            onClick={() => onPass(item.id)}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] border transition-colors duration-[120ms]",
              passed
                ? "border-[var(--color-danger)] text-[var(--color-danger)]"
                : "border-[var(--color-border)] text-[var(--color-text-faint)] hover:border-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]",
            )}
            style={{ background: passed ? "#fef2f2" : "var(--color-surface)" }}
          >
            <ThumbsDown size={13} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Card sub-headers
// ---------------------------------------------------------------------------

function InvestorHeader({ item }: { item: InvestorFeedItem }) {
  const statusColor: Record<InvestorFeedItem["investingStatus"], string> = {
    "actively investing": "var(--color-brand)",
    "selectively investing": "var(--color-warn)",
    paused: "var(--color-text-faint)",
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3
            className="text-[16px] font-semibold leading-6 tracking-tight"
            style={{ color: "var(--color-text)" }}
          >
            {item.fundName}
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--color-text-faint)" }}>
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: statusColor[item.investingStatus] }}
            />
            <span className="capitalize">{item.investingStatus}</span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip label={item.stage} />
        <Chip label={item.sector} />
        <Chip label={item.checkSize} />
        <Chip label={item.geography} />
      </div>
    </div>
  );
}

function StartupHeader({ item }: { item: StartupFeedItem }) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className="text-[16px] font-semibold leading-6 tracking-tight"
              style={{ color: "var(--color-text)" }}
            >
              {item.name}
            </h3>
            {item.trustBadge && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  background: "var(--color-brand-tint)",
                  color: "var(--color-brand-strong)",
                }}
              >
                ✓ {item.trustBadge}
              </span>
            )}
          </div>
          <p
            className="mt-1.5 text-[13px] leading-5"
            style={{ color: "var(--color-text-muted)" }}
          >
            {item.pitch}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip label={item.industry} />
        <Chip label={item.stage} />
        <Chip label={item.location} />
        <Chip label={`Raising ${item.amountRaising}`} accent />
      </div>

      {item.traction && (
        <p
          className="mt-2.5 text-[12px] font-medium"
          style={{ color: "var(--color-text-muted)" }}
        >
          Traction: <span style={{ color: "var(--color-text)" }}>{item.traction}</span>
        </p>
      )}
    </div>
  );
}

function Chip({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium"
      style={{
        background: accent ? "var(--color-brand-tint)" : "var(--color-surface-2)",
        color: accent ? "var(--color-brand-strong)" : "var(--color-text-muted)",
      }}
    >
      {label}
    </span>
  );
}
