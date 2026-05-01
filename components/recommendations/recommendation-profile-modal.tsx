"use client";

import { useEffect } from "react";
import { X, Bookmark } from "lucide-react";
import { Avatar } from "@/components/profile/avatar";
import { cn } from "@/lib/utils";
import type {
  InvestorRecommendation,
  RecommendationProfile,
  StartupRecommendation,
} from "@/lib/recommendations/types";

type Props = {
  profile: RecommendationProfile;
  onClose: () => void;
  saved?: boolean;
  onToggleSave?: (profileId: string) => void;
};

const STAGE_LABEL: Record<string, string> = {
  idea: "Idea",
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  series_b_plus: "Series B+",
};

/**
 * Profile detail view shown when a user clicks a recommendation card.
 *
 * Pure presentation. Closes on Esc or backdrop click. Mock data only —
 * never call this with a real DB row, the field set is intentionally
 * narrower than the production profile page at /p/[userId].
 */
export function RecommendationProfileModal({ profile, onClose, saved = false, onToggleSave }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]"
      onClick={(e) => {
        // Backdrop click closes; clicks inside the card don't bubble.
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${profile.name} preview`}
    >
      <div
        className={cn(
          "relative flex max-h-[88vh] w-full max-w-[720px] flex-col overflow-hidden",
          "rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-white",
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className={cn(
            "absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full",
            "text-[color:var(--color-text-muted)] transition-colors duration-150",
            "hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-text)]",
          )}
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <div className="flex-1 overflow-y-auto px-7 py-7">
          {profile.kind === "startup" ? (
            <StartupBody profile={profile} />
          ) : (
            <InvestorBody profile={profile} />
          )}
        </div>

        <footer
          className={cn(
            "flex items-center justify-between gap-3 border-t border-[color:var(--color-border)]",
            "bg-[color:var(--color-surface)] px-7 py-4",
          )}
        >
          <p className="text-[12px] text-[color:var(--color-text-faint)]">
            {profile.websitePlaceholder}
          </p>
          {onToggleSave && (
            <button
              type="button"
              onClick={() => onToggleSave(profile.id)}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-[var(--radius)] px-4",
                "text-[13px] font-medium transition-colors duration-150",
                saved
                  ? "bg-[color:var(--color-brand)] text-white hover:bg-[color:var(--color-brand-ink)]"
                  : "border border-[color:var(--color-border)] bg-white text-[color:var(--color-text)] hover:border-[color:var(--color-text-faint)]",
              )}
            >
              <Bookmark className="h-3.5 w-3.5" strokeWidth={1.75} fill={saved ? "currentColor" : "none"} />
              {saved ? "Saved" : "I\u2019m interested"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Startup body
// ─────────────────────────────────────────────────────────────────────────────

function StartupBody({ profile }: { profile: StartupRecommendation }) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start gap-4">
        <Avatar id={profile.id} name={profile.name} size="xl" />
        <div className="flex flex-1 flex-col gap-2">
          <h2 className="font-serif text-[26px] font-semibold leading-tight text-[color:var(--color-text-strong)]">
            {profile.name}
          </h2>
          <p className="text-[15px] leading-snug text-[color:var(--color-text-muted)]">
            {profile.tagline}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Chip>{profile.sector}</Chip>
            <Chip>{STAGE_LABEL[profile.stage] ?? profile.stage}</Chip>
            <Chip>{profile.location}</Chip>
            <Chip>Founded {profile.foundingYear}</Chip>
          </div>
        </div>
      </header>

      <Section title="About">
        <p className="text-[14px] leading-relaxed text-[color:var(--color-text)]">
          {profile.description}
        </p>
      </Section>

      <Section title="Product">
        <p className="text-[14px] leading-relaxed text-[color:var(--color-text)]">
          {profile.product}
        </p>
      </Section>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <KeyValue label="Funding ask" value={profile.fundingAsk} />
        <KeyValue label="Use of funds" value={profile.useOfFunds} />
        <KeyValue label="Traction" value={profile.traction} />
        <KeyValue label="Customer type" value={prettyEnum(profile.customerType)} />
      </div>

      <Section title="Team">
        <p className="text-[14px] leading-relaxed text-[color:var(--color-text)]">
          {profile.founderSummary}
        </p>
      </Section>

      <Section title="Ideal investor">
        <p className="text-[14px] leading-relaxed text-[color:var(--color-text)]">
          {profile.idealInvestor}
        </p>
      </Section>

      {profile.tags.length > 0 ? (
        <Section title="Tags">
          <div className="flex flex-wrap gap-1.5">
            {profile.tags.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Investor body
// ─────────────────────────────────────────────────────────────────────────────

function InvestorBody({ profile }: { profile: InvestorRecommendation }) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start gap-4">
        <Avatar id={profile.id} name={profile.name} size="xl" />
        <div className="flex flex-1 flex-col gap-2">
          <h2 className="font-serif text-[26px] font-semibold leading-tight text-[color:var(--color-text-strong)]">
            {profile.name}
          </h2>
          <p className="text-[15px] leading-snug text-[color:var(--color-text-muted)]">
            {profile.tagline}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Chip>{profile.investorType === "firm" ? "Firm" : "Angel"}</Chip>
            <Chip>{profile.geography}</Chip>
            <Chip>{profile.checkRange}</Chip>
          </div>
        </div>
      </header>

      <Section title="Investment thesis">
        <p className="text-[14px] leading-relaxed text-[color:var(--color-text)]">
          {profile.thesis}
        </p>
      </Section>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <KeyValue label="Check size" value={profile.checkRange} />
        <KeyValue label="Stage preference" value={profile.stages.map((s) => STAGE_LABEL[s] ?? s).join(", ")} />
        <KeyValue label="Sector preference" value={profile.sectors.join(", ")} />
        <KeyValue label="Geography" value={profile.geography} />
        <KeyValue label="Equity preference" value={profile.equityPreference} />
      </div>

      <Section title="Portfolio">
        <ul className="flex flex-col gap-1.5 text-[14px] leading-relaxed text-[color:var(--color-text)]">
          {profile.portfolio.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="text-[color:var(--color-text-faint)]">·</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="What they help with">
        <ul className="flex flex-col gap-1.5 text-[14px] leading-relaxed text-[color:var(--color-text)]">
          {profile.helpsWith.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="text-[color:var(--color-text-faint)]">·</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Founder qualities they look for">
        <ul className="flex flex-col gap-1.5 text-[14px] leading-relaxed text-[color:var(--color-text)]">
          {profile.founderQualities.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="text-[color:var(--color-text-faint)]">·</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </Section>

      {profile.tags.length > 0 ? (
        <Section title="Tags">
          <div className="flex flex-wrap gap-1.5">
            {profile.tags.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Bits
// ─────────────────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--color-text-faint)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--color-text-faint)]">
        {label}
      </span>
      <span className="text-[14px] text-[color:var(--color-text)]">{value}</span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2.5 py-0.5 text-[11.5px] font-medium text-[color:var(--color-text-muted)]">
      {children}
    </span>
  );
}

function prettyEnum(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
