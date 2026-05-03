"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { MOCK_STARTUPS, MOCK_INVESTORS } from "@/lib/recommendations/mock-profiles";
import type {
  RecommendationProfile,
  StartupRecommendation,
  InvestorRecommendation,
} from "@/lib/recommendations/types";
import { cn } from "@/lib/utils";

const KNOWN_LOGOS: Record<string, string> = {
  notion: "/logos/notion.svg",
  linear: "/logos/linear.svg",
  stripe: "/logos/stripe.svg",
  figma: "/logos/figma.svg",
  vercel: "/logos/vercel.svg",
  supabase: "/logos/supabase.svg",
  github: "/logos/github.svg",
  openai: "/logos/openai.svg",
  anthropic: "/logos/anthropic.svg",
  slack: "/logos/slack.svg",
  discord: "/logos/discord.svg",
  replit: "/logos/replit.svg",
  airtable: "/logos/airtable.svg",
  cursor: "/logos/cursor.svg",
  perplexity: "/logos/perplexity.svg",
};

const SAVED_KEY = "vm:interested-profiles";
const ALL_PROFILES: RecommendationProfile[] = [...MOCK_STARTUPS, ...MOCK_INVESTORS];

function readSaved(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]") as string[]; }
  catch { return []; }
}
function writeSaved(ids: string[]) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(ids)); } catch { /* */ }
}

export type MatchBreakdown = {
  sector: number;
  stage: number;
  check: number;
  geography: number;
  traction: number;
  process: number;
};

export type MatchCard = {
  id: string;
  userId: string;
  name: string;
  firm: string | null;
  oneLiner: string | null;
  chips: string[];
  score: number;
  breakdown?: MatchBreakdown;
  avatarSrc: string | null;
  otherRole: "founder" | "investor";
};

type Phase = "idle" | "match-exit" | "celebrate" | "pass-exit";
const SL: Record<string, string> = {
  idea: "Idea", pre_seed: "Pre-seed", seed: "Seed",
  series_a: "Series A", series_b_plus: "Series B+",
};

export function MatchCardDeck({ cards }: { cards: MatchCard[] }) {
  const [index, setIndex] = useState(0);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const matchedNameRef = useRef("");
  const exitTypeRef = useRef<"match" | "pass">("pass");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => { setSavedIds(readSaved()); }, []);

  const current = cards[index] ?? null;
  const done = index >= cards.length;
  const profile = current ? ALL_PROFILES.find((p) => p.id === current.userId) ?? null : null;

  function handleMatch() {
    if (!current || phase !== "idle") return;
    matchedNameRef.current = current.name;
    exitTypeRef.current = "match";
    setSavedIds((prev) => {
      if (prev.includes(current.userId)) return prev;
      const next = [...prev, current.userId];
      writeSaved(next);
      return next;
    });
    setPhase("match-exit");
  }

  function handlePass() {
    if (!current || phase !== "idle") return;
    exitTypeRef.current = "pass";
    setPhase("pass-exit");
  }

  function onExitDone() {
    if (phase === "match-exit") {
      setPhase("celebrate");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { setPhase("idle"); setIndex((i) => i + 1); }, 1200);
    } else if (phase === "pass-exit") {
      setPhase("idle");
      setIndex((i) => i + 1);
    }
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="text-[17px] font-semibold text-[var(--color-text)]">All caught up</p>
        <p className="text-[13px] text-[var(--color-text-muted)]">Check your dashboard for saved matches.</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col" style={{ minHeight: "calc(100dvh - 112px)", background: "#F2F4F7" }}>

      <AnimatePresence onExitComplete={onExitDone}>
        {phase === "idle" && current && profile && (
          <motion.div
            key={current.id}
            initial="enter" animate="show" exit="exit"
            variants={{
              enter: { opacity: 0, y: 14 },
              show: { opacity: 1, y: 0, x: 0, scale: 1 },
              exit: () => exitTypeRef.current === "match"
                ? { opacity: 0, scale: 0.97, y: -14, transition: { duration: 0.22 } }
                : { opacity: 0, x: 100, transition: { duration: 0.22 } },
            }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col bg-white"
          >
            {profile.kind === "startup" ? (
              <StartupCard card={current} profile={profile} onMatch={handleMatch} onPass={handlePass} />
            ) : (
              <InvestorCard card={current} profile={profile} onMatch={handleMatch} onPass={handlePass} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Celebration */}
      <AnimatePresence>
        {phase === "celebrate" && (
          <motion.div key="cel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-x-0 top-12 flex flex-col items-center gap-3 pt-24">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand)]">
              <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </motion.div>
            <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
              className="text-[18px] font-semibold text-[var(--color-text)]">It&apos;s a match</motion.p>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.14 }}
              className="text-[12px] text-[var(--color-text-muted)]">{matchedNameRef.current} saved to your dashboard.</motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Startup card — what investors see
// ─────────────────────────────────────────────────────────────────────────────

function StartupCard({ card, profile, onMatch, onPass }: {
  card: MatchCard; profile: StartupRecommendation;
  onMatch: () => void; onPass: () => void;
}) {
  const meta = [profile.sector, SL[profile.stage] ?? profile.stage, profile.location, profile.fundingAsk].filter(Boolean).join(" · ");
  const team = (profile.teamMembers ?? []).slice(0, 3);
  const matchSignals = buildStartupMatchSignals(profile);
  const founderExperience = extractFounderExperience(profile);

  return (
    <>
      {/* ── Header ── */}
      <div className="flex items-center gap-4 px-6 pt-6 pb-5">
        <CompanyLogo name={card.name} domain={profile.websitePlaceholder} />
        <div className="flex-1 min-w-0">
          <h2 className="text-[20px] font-semibold tracking-tight text-[var(--color-text)]">{card.name}</h2>
          <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{meta}</p>
          <p className="mt-1 text-[13px] leading-[1.45] text-[var(--color-text)]">{profile.tagline}</p>
        </div>
        {card.score > 0 && card.breakdown && (
          <MatchRadar score={card.score} breakdown={card.breakdown} />
        )}
      </div>

      {/* ── Row 1: Why matches (interactive) | Fundraise (light) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2">
        <WhyMatchesPanel signals={matchSignals} />
        <div className="flex flex-col overflow-hidden" style={{ background: "#F5F6F8" }}>
          <LightHeader>Fundraise</LightHeader>
          <FundraiseStrip profile={profile} />
          <div style={{ borderTop: "1px solid var(--color-border)" }}>
            <StageProgress stage={profile.stage} />
          </div>
        </div>
      </div>

      {/* ── Row 2: Traction (dark) | Team (green + beige) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2">
        <div className="flex flex-col overflow-hidden" style={{ background: "#F8F8F6" }}>
          <LightHeader>Traction</LightHeader>
          <KpiStrip profile={profile} />
          <CompanyShowcase
            text={[profile.traction, profile.notableSignals, profile.notableCustomers].filter(Boolean).join(" ")}
            caption={profile.notableSignals ?? undefined}
          />
        </div>
        <div className="flex min-h-0">
          <div className="flex flex-col justify-between px-4 py-5" style={{ background: "#ECFDF5" }}>
            <div className="flex gap-2">
              {team.map((m) => (
                <div key={m.name} className="flex flex-col items-center gap-1">
                  <div className="overflow-hidden" style={{ width: 104, height: 104 }}>
                    {m.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photoUrl} alt={m.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-[var(--color-surface)] text-[11px] font-semibold text-[var(--color-text-faint)]">
                        {m.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-semibold leading-none text-[var(--color-text-strong)]">{m.name.split(" ")[0]}</p>
                  <p className="text-[9.5px] leading-none text-[var(--color-text-muted)]">{m.role}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Team</p>
          </div>
          {founderExperience.length > 0 && (
            <div className="ml-0 flex flex-1 flex-col overflow-hidden border-l border-[var(--color-border)]" style={{ background: "#F7FFFE" }}>
              <div className="flex flex-1">
                {founderExperience.map(({ firstName, company }, idx) => (
                  <div key={firstName} className="group flex flex-1 flex-col">
                    <div
                      className="relative flex flex-1 items-center justify-center overflow-hidden cursor-default"
                      style={{ background: company.bg, borderLeft: idx > 0 ? "1px solid rgba(255,255,255,0.15)" : undefined }}
                    >
                      {/* Logo — fades out on hover */}
                      <Image
                        src={company.logo}
                        alt={company.name}
                        width={32}
                        height={32}
                        className="h-8 w-8 object-contain transition-opacity duration-200 group-hover:opacity-0"
                        style={company.invert ? { filter: "brightness(0) invert(1)" } : undefined}
                      />
                      {/* Company name — fades in on hover */}
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        {company.name}
                      </span>
                    </div>
                    <span className="py-1 text-center text-[10px] font-medium text-[var(--color-text-muted)]">{firstName}</span>
                  </div>
                ))}
              </div>
              <p className="px-3 pb-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Previously at</p>
            </div>
          )}
        </div>
      </div>

      {/* View full profile link */}
      <div className="flex-1 flex items-end">
        <div className="w-full px-5 py-3 bg-white" style={{ borderTop: "1px solid var(--color-border)" }}>
          <Link href={`/profile/${card.userId}`} onClick={(e) => e.stopPropagation()} className="text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            View full profile →
          </Link>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex" style={{ borderTop: "1px solid var(--color-border)" }}>
        <button type="button" onClick={onPass} className="flex-1 py-4 bg-white text-[12.5px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-surface)] hover:text-[var(--color-text)] active:scale-[0.98]" style={{ borderRight: "1px solid var(--color-border)" }}>
          Pass
        </button>
        <button type="button" onClick={onMatch} className="flex-1 py-4 text-[12.5px] font-bold uppercase tracking-[0.06em] bg-[var(--color-brand)] text-white transition-all hover:brightness-110 active:scale-[0.98]">
          Match
        </button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Investor card — what founders see
// ─────────────────────────────────────────────────────────────────────────────

function InvestorCard({ card, profile, onMatch, onPass }: {
  card: MatchCard; profile: InvestorRecommendation;
  onMatch: () => void; onPass: () => void;
}) {
  const stageLabels = profile.stages.map((s) => SL[s] ?? s).join(", ");
  const meta = [profile.investorType === "firm" ? "Firm" : "Angel", stageLabels, profile.checkRange, profile.geography].filter(Boolean).join(" · ");
  const matchSignals = buildInvestorMatchSignals(profile);

  return (
    <>
      {/* ── Header with radar in place of percentage ── */}
      <div className="flex items-start gap-6 px-7 sm:px-8 pt-7 pb-6">
        <CompanyLogo name={card.name} domain={profile.websitePlaceholder} />
        <div className="flex-1 min-w-0">
          <h2 className="text-[24px] font-semibold tracking-tight text-[var(--color-text)]">{card.name}</h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{meta}</p>
          <p className="mt-2 text-[14px] leading-[1.55] text-[var(--color-text)]">{profile.tagline}</p>
        </div>
        {card.score > 0 && card.breakdown && (
          <MatchRadar score={card.score} breakdown={card.breakdown} />
        )}
      </div>

      {/* ── Two-column: Why matches + Investment focus ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2">
        <WhyMatchesPanel signals={matchSignals} />

        <div className="py-4 sm:pl-5">
          <SectionLabel>Investment focus</SectionLabel>
          <div className="mt-2 flex flex-col gap-1 text-[12.5px]">
            <KVLine label="Check" value={profile.checkRange} />
            <KVLine label="Stages" value={stageLabels} />
            <KVLine label="Sectors" value={profile.sectors.slice(0, 3).join(", ")} />
            <KVLine label="Equity" value={profile.equityPreference} />
          </div>
        </div>
      </div>

      {/* ── Two-column: Thesis + Portfolio ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2">
        <div className="py-4 pr-5">
          <SectionLabel>Thesis</SectionLabel>
          <p className="mt-2 text-[12.5px] leading-[1.5] text-[var(--color-text)]">{truncate(profile.thesis, 140)}</p>
        </div>

        <div className="py-4 sm:pl-5">
          <SectionLabel>Portfolio</SectionLabel>
          <ul className="mt-2 flex flex-col gap-1">
            {profile.portfolio.slice(0, 4).map((p) => (
              <li key={p} className="flex items-start gap-2 text-[12.5px] leading-[1.45] text-[var(--color-text)]">
                <span className="text-[var(--color-text-faint)]">·</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <CompanyLogoBadges text={profile.portfolio.join(" ")} />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex border-t border-[var(--color-border)]">
        <button type="button" onClick={onPass}
          className="flex-1 py-4 text-[13px] font-bold uppercase tracking-[0.06em] border-r border-[var(--color-border)] text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-surface)] hover:text-[var(--color-text)] active:scale-[0.98]">
          Pass
        </button>
        <button type="button" onClick={onMatch}
          className="flex-1 py-4 text-[13px] font-bold uppercase tracking-[0.06em] bg-[var(--color-brand-ink)] text-white transition-all hover:brightness-110 active:scale-[0.98]">
          Match
        </button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-faint)]">{children}</h3>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Why This Matches — interactive signal panel
// ─────────────────────────────────────────────────────────────────────────────

// Sector icon map — emoji stand-ins that are clean and non-AI-slop
const SECTOR_ICONS: Record<string, string> = {
  "developer tools": "⌨", "healthtech": "🩺", healthcare: "🩺", fintech: "📈",
  finance: "📈", climate: "🌿", edtech: "📚", education: "📚",
  consumer: "🛒", hardware: "⚙", biotech: "🧬", "b2b saas": "🏢",
  logistics: "📦", security: "🔐", ai: "◈", media: "▶",
};
function sectorIcon(sector: string): string {
  const key = sector.toLowerCase();
  for (const [k, v] of Object.entries(SECTOR_ICONS)) {
    if (key.includes(k)) return v;
  }
  return "◈";
}

// Tech keywords → label (no logo available) or logo path
const TECH_KEYWORDS: { key: string; label: string; logo?: string }[] = [
  { key: "github",      label: "GitHub",    logo: "/logos/github.svg" },
  { key: "github app",  label: "GitHub App", logo: "/logos/github.svg" },
  { key: "github actions", label: "GitHub Actions", logo: "/logos/github.svg" },
  { key: "slack",       label: "Slack",     logo: "/logos/slack.svg" },
  { key: "notion",      label: "Notion",    logo: "/logos/notion.svg" },
  { key: "linear",      label: "Linear",    logo: "/logos/linear.svg" },
  { key: "stripe",      label: "Stripe",    logo: "/logos/stripe.svg" },
  { key: "figma",       label: "Figma",     logo: "/logos/figma.svg" },
  { key: "vercel",      label: "Vercel",    logo: "/logos/vercel.svg" },
  { key: "openai",      label: "OpenAI",    logo: "/logos/openai.svg" },
  { key: "supabase",    label: "Supabase",  logo: "/logos/supabase.svg" },
  { key: "airtable",    label: "Airtable",  logo: "/logos/airtable.svg" },
  { key: "cli",         label: "CLI" },
  { key: "yaml",        label: "YAML" },
  { key: "api",         label: "REST API" },
  { key: "webhook",     label: "Webhooks" },
  { key: "graphql",     label: "GraphQL" },
  { key: "soc 2",       label: "SOC 2" },
  { key: "hipaa",       label: "HIPAA" },
  { key: "quickbooks",  label: "QuickBooks" },
  { key: "xero",        label: "Xero" },
];

// Brand backgrounds for logo-bearing tools
const TECH_BG: Record<string, string> = {
  "GitHub": "#24292e", "GitHub App": "#24292e", "GitHub Actions": "#24292e",
  "Slack": "#4A154B", "Notion": "#000000", "Linear": "#5E6AD2",
  "Stripe": "#635BFF", "Figma": "#1E1E1E", "Vercel": "#000000",
  "OpenAI": "#000000", "Supabase": "#1C1C1C", "Airtable": "#18BFFF",
};

function ProductIntegrations({ profile }: { profile: StartupRecommendation }) {
  const haystack = [
    profile.product,
    profile.keyFeatures,
    profile.technicalMoat,
    ...(profile.tags ?? []),
  ].filter(Boolean).join(" ").toLowerCase();

  const found: { label: string; logo?: string }[] = [];
  const seenLabels = new Set<string>();
  for (const t of TECH_KEYWORDS) {
    if (haystack.includes(t.key) && !seenLabels.has(t.label)) {
      found.push({ label: t.label, logo: t.logo });
      seenLabels.add(t.label);
    }
  }
  if (found.length === 0) return null;

  const withLogo = found.filter((i) => i.logo).slice(0, 3);
  const textOnly = found.filter((i) => !i.logo).slice(0, 3);

  return (
    <div className="px-5 pb-3 flex flex-col gap-2">
      {/* Logo tools — large brand-colored squares */}
      {withLogo.length > 0 && (
        <div className="flex gap-2">
          {withLogo.map((item) => {
            const bg = TECH_BG[item.label] ?? "#1a1a1a";
            return (
              <div key={item.label} className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className="flex w-full items-center justify-center py-3"
                  style={{ background: bg }}
                >
                  <Image
                    src={item.logo!}
                    alt={item.label}
                    width={28}
                    height={28}
                    className="h-7 w-7 object-contain"
                    style={{ filter: "brightness(0) invert(1)" }}
                  />
                </div>
                <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">{item.label}</span>
              </div>
            );
          })}
        </div>
      )}
      {/* Text-only tools — compact label chips */}
      {textOnly.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {textOnly.map((item) => (
            <span
              key={item.label}
              className="inline-flex items-center rounded-[4px] border px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-strong)] tracking-tight"
              style={{ background: "white", borderColor: "#BBF7D0" }}
            >
              {item.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SignalExpand({ origIdx, s }: { origIdx: number; s: MatchSignal }) {
  return (
    <div className="px-5 py-4">
      {origIdx === 0 && (
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Sector match</p>
                          <p className="text-[15px] font-bold text-[var(--color-text-strong)]">{s.value}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">In investor&apos;s mandate</p>
                        </div>
                      </div>
      )}
      {origIdx === 1 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)] mb-3">Funding stage</p>
          <div className="flex items-end gap-2">
            {["Idea", "Pre", "Seed", "A", "B+"].map((st, i) => {
              const active = s.value.toLowerCase().includes(st.toLowerCase());
              return (
                <div key={st} className="flex flex-1 flex-col items-center gap-1.5">
                  <motion.div
                    className="w-full rounded-[3px]"
                    initial={{ height: 6 }}
                    animate={{ height: active ? 36 : 10 }}
                    transition={{ delay: i * 0.04, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    style={{ background: active ? "var(--color-brand)" : "#C9D8CC" }}
                  />
                  <span className="text-[9px] font-semibold" style={{ color: active ? "var(--color-brand-ink)" : "#9CA3AF" }}>{st}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {origIdx === 2 && (
        <div className="flex items-center gap-5">
          <LocationGlobe />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Location</p>
            <p className="text-[15px] font-bold text-[var(--color-text-strong)]">{s.value}</p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">In preferred geography</p>
          </div>
        </div>
      )}
    </div>
  );
}

function WhyMatchesPanel({ signals }: { signals: MatchSignal[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="flex flex-col overflow-hidden">
      <LightHeader>Why this matches</LightHeader>
      <div className="flex flex-col">
        {signals.map((s, idx) => {
          const isExp = expanded === idx;
          const baseBg = ["#F0FDF4", "#F7FFFE", "#FFFFFF"][idx] ?? "#FFFFFF";

          return (
            <div
              key={idx}
              onMouseEnter={() => setExpanded(idx)}
              onMouseLeave={() => setExpanded(null)}
            >
              <div
                className="flex items-center px-5 py-4 cursor-default transition-colors duration-200"
                style={{ background: isExp ? "#DCFCE7" : baseBg }}
              >
                <span className="text-[13.5px] font-semibold text-[var(--color-text-strong)] leading-tight">
                  {s.value}
                </span>
              </div>
              <div
                className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  maxHeight: isExp ? 140 : 0,
                  opacity: isExp ? 1 : 0,
                  background: "#DCFCE7",
                }}
              >
                <SignalExpand origIdx={idx} s={s} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LocationGlobe() {
  return (
    <motion.svg
      width="52" height="52" viewBox="0 0 52 52" fill="none"
      initial={{ rotate: 0 }}
      animate={{ rotate: 360 }}
      transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
    >
      <circle cx="26" cy="26" r="22" stroke="var(--color-brand)" strokeWidth="1.5" fill="#F0FDF4" />
      <ellipse cx="26" cy="26" rx="22" ry="8" stroke="var(--color-brand)" strokeWidth="0.9" strokeDasharray="4 3" fill="none" />
      <ellipse cx="26" cy="26" rx="22" ry="15" stroke="var(--color-brand)" strokeWidth="0.7" strokeDasharray="4 3" fill="none" />
      <ellipse cx="26" cy="26" rx="9" ry="22" stroke="var(--color-brand)" strokeWidth="0.9" strokeDasharray="4 3" fill="none" />
      <circle cx="26" cy="19" r="3" fill="var(--color-brand)" />
      <line x1="26" y1="19" x2="26" y2="26" stroke="var(--color-brand)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="26" cy="26" r="1.5" fill="var(--color-brand)" opacity="0.5" />
    </motion.svg>
  );
}

function DarkHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center py-1.5" style={{ background: "var(--color-text-strong)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/80">{children}</h3>
    </div>
  );
}

function LightHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center py-1.5" style={{ background: "#E8E8EA", borderBottom: "1px solid var(--color-border)" }}>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-strong)]">{children}</h3>
    </div>
  );
}

function KVLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <span className="shrink-0 text-[var(--color-text-faint)]">{label}:</span>
      <span className="text-[var(--color-text)]">{value}</span>
    </div>
  );
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function CompanyLogo({ name, domain }: { name: string; domain?: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const localLogo = `/mock-assets/${slugify(name)}/logo.png`;

  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center bg-[var(--color-surface)] overflow-hidden border border-[var(--color-border)]">
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={localLogo} alt={name} className="h-full w-full object-contain p-1" onError={() => setFailed(true)} />
      ) : (
        <span className="text-[20px] font-semibold text-[var(--color-text-faint)]">{initials}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Data helpers — derive context from real profile fields
// ─────────────────────────────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/\s+\S*$/, "") + "...";
}

type MatchSignal = { label: string; value: string };

function buildStartupMatchSignals(p: StartupRecommendation): MatchSignal[] {
  const signals: MatchSignal[] = [];
  signals.push({ label: "Sector", value: p.sector });
  signals.push({ label: "Stage", value: `${SL[p.stage] ?? p.stage} · ${p.fundingAsk}` });
  if (p.location) signals.push({ label: "Location", value: p.location });
  if (p.tags.length > 1) signals.push({ label: "Tags", value: p.tags.slice(0, 3).join(", ") });
  return signals.slice(0, 3);
}

function buildInvestorMatchSignals(p: InvestorRecommendation): MatchSignal[] {
  return [
    { label: "Sectors", value: p.sectors.slice(0, 2).join(" & ") },
    { label: "Stages", value: p.stages.map((s) => SL[s] ?? s).join(", ") },
    { label: "Check", value: p.checkRange },
  ];
}

// Keep string versions for investor card which uses plain list
function buildStartupMatchReasons(p: StartupRecommendation): string[] {
  return buildStartupMatchSignals(p).map((s) => `${s.value}`);
}
function buildInvestorMatchReasons(p: InvestorRecommendation): string[] {
  return buildInvestorMatchSignals(p).map((s) => `${s.label}: ${s.value}`);
}

function extractLogos(text: string): { name: string; src: string }[] {
  const lower = text.toLowerCase();
  const found: { name: string; src: string }[] = [];
  for (const [key, src] of Object.entries(KNOWN_LOGOS)) {
    if (lower.includes(key) && !found.some((f) => f.src === src)) {
      found.push({ name: key.charAt(0).toUpperCase() + key.slice(1), src });
    }
  }
  return found;
}

function extractFounderLogos(p: StartupRecommendation): { name: string; src: string }[] {
  const backgrounds = (p.teamMembers ?? [])
    .map((m) => m.background ?? "")
    .filter(Boolean)
    .join(" ");
  return extractLogos(backgrounds);
}

function CompanyLogoBadges({ text }: { text: string }) {
  const logos = extractLogos(text);
  if (logos.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {logos.map((c) => (
        <span key={c.src} className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5">
          <Image src={c.src} alt={c.name} width={20} height={20} className="h-5 w-5 object-contain" />
          <span className="text-[12px] font-medium text-[var(--color-text)]">{c.name}</span>
        </span>
      ))}
    </div>
  );
}

// Brand colour + logo-invert config for known companies
type CompanyBoxConfig = { name: string; logo: string; bg: string; invert: boolean };
const COMPANY_BOX_MAP: Record<string, CompanyBoxConfig> = {
  notion:    { name: "Notion",    logo: "/logos/notion.svg",    bg: "#000000", invert: false },
  linear:    { name: "Linear",    logo: "/logos/linear.svg",    bg: "#5E6AD2", invert: true  },
  github:    { name: "Github",    logo: "/logos/github.svg",    bg: "#24292e", invert: true  },
  stripe:    { name: "Stripe",    logo: "/logos/stripe.svg",    bg: "#635BFF", invert: true  },
  figma:     { name: "Figma",     logo: "/logos/figma.svg",     bg: "#1E1E1E", invert: false },
  vercel:    { name: "Vercel",    logo: "/logos/vercel.svg",    bg: "#000000", invert: true  },
  openai:    { name: "OpenAI",    logo: "/logos/openai.svg",    bg: "#000000", invert: true  },
  anthropic: { name: "Anthropic", logo: "/logos/anthropic.svg", bg: "#CE9D7A", invert: false },
  slack:     { name: "Slack",     logo: "/logos/slack.svg",     bg: "#4A154B", invert: true  },
  discord:   { name: "Discord",   logo: "/logos/discord.svg",   bg: "#5865F2", invert: true  },
  supabase:  { name: "Supabase",  logo: "/logos/supabase.svg",  bg: "#1C1C1C", invert: false },
  replit:    { name: "Replit",    logo: "/logos/replit.svg",    bg: "#F26207", invert: true  },
  airtable:  { name: "Airtable",  logo: "/logos/airtable.svg",  bg: "#18BFFF", invert: false },
  cursor:    { name: "Cursor",    logo: "/logos/cursor.svg",    bg: "#000000", invert: true  },
  perplexity:{ name: "Perplexity",logo: "/logos/perplexity.svg",bg: "#1B1B1F", invert: true  },
  sequoia:   { name: "Sequoia",   logo: "/logos/sequoia.svg",   bg: "#0f2027", invert: true  },
  "y combinator": { name: "Y Combinator", logo: "/logos/ycombinator.svg", bg: "#FB651E", invert: false },
  ycombinator:    { name: "Y Combinator", logo: "/logos/ycombinator.svg", bg: "#FB651E", invert: false },
  khosla:    { name: "Khosla",    logo: "/logos/khosla.svg",    bg: "#1a0533", invert: true  },
  a16z:      { name: "a16z",      logo: "/logos/a16z.svg",      bg: "#000000", invert: true  },
  "andreessen horowitz": { name: "a16z", logo: "/logos/a16z.svg", bg: "#000000", invert: true },
  "founders fund": { name: "Founders Fund", logo: "/logos/foundersfund.svg", bg: "#0a0a14", invert: true },
};

function extractFounderExperience(profile: StartupRecommendation): { firstName: string; company: CompanyBoxConfig }[] {
  const result: { firstName: string; company: CompanyBoxConfig }[] = [];
  for (const member of (profile.teamMembers ?? [])) {
    const companies = extractCompanyBoxes(member.background ?? "").slice(0, 1);
    if (companies.length > 0) {
      result.push({ firstName: member.name.split(" ")[0], company: companies[0] });
    }
  }
  return result;
}

function extractCompanyBoxes(text: string): CompanyBoxConfig[] {
  const lower = text.toLowerCase();
  const found: CompanyBoxConfig[] = [];
  for (const [key, cfg] of Object.entries(COMPANY_BOX_MAP)) {
    if (lower.includes(key) && !found.some((f) => f.logo === cfg.logo)) {
      found.push(cfg);
    }
  }
  return found;
}

function CompanyShowcase({ text, caption }: { text: string; caption?: string }) {
  const companies = extractCompanyBoxes(text).slice(0, 3);
  if (companies.length === 0) return null;

  return (
    <div className="w-full">
      {/* Equal-thirds grid, edge-to-edge like the KPI strip */}
      <div
        className="grid w-full"
        style={{ gridTemplateColumns: `repeat(${companies.length}, minmax(0, 1fr))` }}
      >
        {companies.map((c, idx) => (
          <div
            key={c.name}
            className="group relative flex items-center justify-center py-5 cursor-default overflow-hidden"
            style={{
              background: c.bg,
              borderLeft: idx > 0 ? "1px solid rgba(255,255,255,0.18)" : undefined,
            }}
          >
            {/* Logo — fades out on hover */}
            <Image
              src={c.logo}
              alt={c.name}
              width={36}
              height={36}
              className="h-9 w-9 object-contain transition-opacity duration-200 group-hover:opacity-0"
              style={c.invert ? { filter: "brightness(0) invert(1)" } : undefined}
            />
            {/* Name — fades in on hover */}
            <span
              className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold tracking-tight text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            >
              {c.name}
            </span>
          </div>
        ))}
      </div>
      {caption && (
        <div
          className="flex w-full items-center justify-center px-4 py-2"
          style={{ background: "var(--color-text-strong)" }}
        >
          <p className="text-center text-[11px] font-medium leading-[1.45] text-white">
            {caption}
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Fundraise visual elements
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_ORDER = ["idea", "pre_seed", "seed", "series_a", "series_b_plus"] as const;
const STAGE_SHORT: Record<string, string> = {
  idea: "Idea", pre_seed: "Pre", seed: "Seed", series_a: "A", series_b_plus: "B+",
};

const INSTRUMENT_STYLES: Record<string, { bg: string; color: string }> = {
  "safe":           { bg: "#16a34a", color: "#fff" },
  "priced equity":  { bg: "#1d4ed8", color: "#fff" },
  "convertible note": { bg: "#b45309", color: "#fff" },
  "equity":         { bg: "#1d4ed8", color: "#fff" },
};

function FundraiseStrip({ profile }: { profile: StartupRecommendation }) {
  const instrumentKey = (profile.instrument ?? "").toLowerCase();
  const style = INSTRUMENT_STYLES[instrumentKey] ?? { bg: "var(--color-text-strong)", color: "#fff" };

  return (
    <div className="grid w-full" style={{ gridTemplateColumns: "1fr auto" }}>
      {/* Raise amount */}
      <div
        className="flex flex-col justify-center gap-0.5 px-5 py-4"
        style={{ background: "#F5F6F8", borderRight: "1px solid var(--color-border)" }}
      >
        <span className="font-mono text-[20px] font-bold tabular-nums leading-[1.1] text-[var(--color-text-strong)]">
          {profile.fundingAsk}
        </span>
        {profile.valuationCap && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
            Cap {profile.valuationCap}
          </span>
        )}
      </div>
      {/* Instrument badge */}
      {profile.instrument && (
        <div
          className="flex items-center justify-center px-5"
          style={{ background: style.bg }}
        >
          <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-white whitespace-nowrap">
            {profile.instrument}
          </span>
        </div>
      )}
    </div>
  );
}

function StageProgress({ stage }: { stage: string }) {
  const currentIdx = STAGE_ORDER.indexOf(stage as typeof STAGE_ORDER[number]);
  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-0">
        {STAGE_ORDER.map((s, i) => {
          const filled = i <= currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <div key={s} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className="h-[3px] w-full"
                style={{ background: filled ? "var(--color-brand)" : "var(--color-border)" }}
              />
              <span
                className="text-[9px] font-semibold uppercase tracking-[0.06em]"
                style={{ color: isCurrent ? "var(--color-brand-ink)" : "var(--color-text-faint)" }}
              >
                {STAGE_SHORT[s]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  New visual elements
// ─────────────────────────────────────────────────────────────────────────────

const BREAKDOWN_AXES: { key: keyof MatchBreakdown; label: string }[] = [
  { key: "sector",    label: "Sector" },
  { key: "stage",     label: "Stage" },
  { key: "check",     label: "Check" },
  { key: "geography", label: "Geo" },
  { key: "traction",  label: "Traction" },
  { key: "process",   label: "Process" },
];

function MatchRadar({ score, breakdown }: { score: number; breakdown: MatchBreakdown }) {
  const size = 168;
  const center = size / 2;
  const maxR = 52;

  function pt(i: number, value: number): [number, number] {
    const angle = (i / BREAKDOWN_AXES.length) * Math.PI * 2 - Math.PI / 2;
    return [center + Math.cos(angle) * maxR * value, center + Math.sin(angle) * maxR * value];
  }

  function labelPt(i: number): [number, number] {
    const angle = (i / BREAKDOWN_AXES.length) * Math.PI * 2 - Math.PI / 2;
    const r = maxR + 14;
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r];
  }

  const polygon = BREAKDOWN_AXES.map((a, i) => pt(i, breakdown[a.key]).join(",")).join(" ");
  const ringPolygon = (v: number) =>
    BREAKDOWN_AXES.map((_, i) => pt(i, v).join(",")).join(" ");

  return (
    <div className="hidden shrink-0 sm:block" aria-label={`Match score ${score}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background rings */}
        {[0.33, 0.66, 1].map((v) => (
          <polygon
            key={v}
            points={ringPolygon(v)}
            fill={v === 1 ? "var(--color-surface)" : "none"}
            stroke="var(--color-border)"
            strokeWidth={1}
          />
        ))}
        {/* Axis lines */}
        {BREAKDOWN_AXES.map((_, i) => {
          const [x, y] = pt(i, 1);
          return (
            <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="var(--color-border)" strokeWidth={1} />
          );
        })}
        {/* Data polygon */}
        <polygon
          points={polygon}
          fill="var(--color-brand)"
          fillOpacity={0.2}
          stroke="var(--color-brand)"
          strokeWidth={1.75}
          strokeLinejoin="round"
        />
        {/* Data points */}
        {BREAKDOWN_AXES.map((a, i) => {
          const [x, y] = pt(i, breakdown[a.key]);
          return <circle key={a.key} cx={x} cy={y} r={2.5} fill="var(--color-brand)" />;
        })}
        {/* Score disc in center */}
        <circle cx={center} cy={center} r={22} fill="white" stroke="var(--color-brand)" strokeWidth={1.5} />
        <text
          x={center}
          y={center - 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="15"
          fontWeight="700"
          className="font-mono tabular-nums"
          fill="var(--color-brand-ink)"
        >
          {score}
        </text>
        <text
          x={center}
          y={center + 10}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="7"
          fontWeight="600"
          letterSpacing="0.08em"
          fill="var(--color-text-faint)"
        >
          MATCH
        </text>
        {/* Axis labels */}
        {BREAKDOWN_AXES.map((a, i) => {
          const [x, y] = labelPt(i);
          const centered = Math.abs(x - center) < 4;
          const anchor = centered ? "middle" : x < center ? "end" : "start";
          return (
            <text
              key={a.key}
              x={x}
              y={y}
              textAnchor={anchor}
              dominantBaseline="central"
              fontSize="9"
              fontWeight="600"
              fill="var(--color-text-muted)"
            >
              {a.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function KpiStrip({ profile }: { profile: StartupRecommendation }) {
  const items: { label: string; value: string }[] = [];
  if (profile.mrr) items.push({ label: "MRR", value: profile.mrr });
  if (profile.growthPct) items.push({ label: "Growth", value: profile.growthPct });
  if (profile.customers) {
    const m = profile.customers.match(/^([\d,.]+\s*[A-Za-z%]*)/);
    const lead = m ? m[1].trim() : profile.customers.split(",")[0];
    items.push({ label: "Users", value: truncate(lead, 14) });
  }
  if (items.length === 0) return null;

  return (
    <div
      className="grid w-full"
      style={{
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        background: "#DCFCE7",
      }}
    >
      {items.map((it, idx) => (
        <div
          key={it.label}
          className="flex flex-col justify-center gap-0.5 px-5 py-4"
          style={
            idx > 0
              ? { borderLeft: "1px solid rgba(0,0,0,0.08)" }
              : undefined
          }
        >
          <span className="font-mono text-[19px] font-bold tabular-nums leading-[1.1] text-[var(--color-text-strong)]">
            {it.value}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
            {it.label}
          </span>
        </div>
      ))}
    </div>
  );
}
