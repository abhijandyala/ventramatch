import type { AccountLabel } from "@/types/database";

/**
 * Honest verification badges. Each badge represents a SPECIFIC signal we
 * actually checked — never broader claims. Per docs/legal.md: "We never
 * label data as 'verified' if we haven't actually verified it."
 *
 * Layered: small chips that compose. Show the highest-trust badge most
 * prominently, others as supporting micro-pills.
 */

type Signal = {
  /** Internal id used as React key. */
  id: string;
  /** Short label shown on the chip. */
  label: string;
  /** What we actually checked, plain language for tooltip. */
  description: string;
  /** Tone — `verified` is brand-color; others are neutral. */
  tone: "verified" | "social" | "neutral";
};

export type VerificationInputs = {
  accountLabel: AccountLabel;
  emailVerified: boolean;
  linkedinUrl: string | null;
  githubUrl: string | null;
  websiteUrl: string | null;
  /** Optional: derived from the user.firm + email domain match. */
  firmDomainMatches?: boolean;
};

function buildSignals(inputs: VerificationInputs): Signal[] {
  const signals: Signal[] = [];

  // Reviewed by VentraMatch — the highest-trust signal. Only granted by
  // human reviewer per the application_review pipeline.
  if (inputs.accountLabel === "verified") {
    signals.push({
      id: "reviewed",
      label: "Reviewed by VentraMatch",
      description: "A human reviewer confirmed this profile meets our admission criteria.",
      tone: "verified",
    });
  }

  if (inputs.emailVerified) {
    signals.push({
      id: "email",
      label: "Email verified",
      description: "Owner clicked a one-time link sent to this email address.",
      tone: "neutral",
    });
  }

  if (inputs.linkedinUrl) {
    signals.push({
      id: "linkedin",
      label: "LinkedIn linked",
      description: "Account is connected to a LinkedIn profile via OAuth.",
      tone: "social",
    });
  }

  if (inputs.githubUrl) {
    signals.push({
      id: "github",
      label: "GitHub linked",
      description: "Account is connected to a GitHub profile via OAuth.",
      tone: "social",
    });
  }

  if (inputs.firmDomainMatches) {
    signals.push({
      id: "domain",
      label: "Firm domain verified",
      description: "Email domain matches the listed firm's domain.",
      tone: "verified",
    });
  }

  return signals;
}

const TONE_STYLES: Record<Signal["tone"], { bg: string; text: string; border: string }> = {
  verified: {
    bg: "var(--color-brand-tint)",
    text: "var(--color-brand-strong)",
    border: "var(--color-brand)",
  },
  social: {
    bg: "var(--color-surface)",
    text: "var(--color-text-strong)",
    border: "var(--color-border-strong, var(--color-border))",
  },
  neutral: {
    bg: "var(--color-surface)",
    text: "var(--color-text-muted)",
    border: "var(--color-border)",
  },
};

export function VerificationBadges({
  inputs,
  size = "sm",
  max,
}: {
  inputs: VerificationInputs;
  /** sm = pill chips for cards. md = larger pills for profile pages. */
  size?: "sm" | "md";
  /** Cap on number of badges shown — extras render as "+N". */
  max?: number;
}) {
  const signals = buildSignals(inputs);
  if (signals.length === 0) return null;

  const visible = max ? signals.slice(0, max) : signals;
  const overflow = max ? Math.max(0, signals.length - max) : 0;
  const padding = size === "md" ? "px-2.5 py-1" : "px-2 py-0.5";
  const fontSize = size === "md" ? "text-[12px]" : "text-[11px]";

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((s) => {
        const style = TONE_STYLES[s.tone];
        return (
          <span
            key={s.id}
            title={s.description}
            className={`inline-flex items-center gap-1 ${padding} ${fontSize} font-medium`}
            style={{
              background: style.bg,
              color: style.text,
              border: `1px solid ${style.border}`,
            }}
          >
            {s.tone === "verified" ? (
              <span aria-hidden className="font-bold">✓</span>
            ) : null}
            {s.label}
          </span>
        );
      })}
      {overflow > 0 ? (
        <span
          className={`inline-flex items-center ${padding} ${fontSize} font-medium`}
          style={{
            background: "var(--color-surface)",
            color: "var(--color-text-faint)",
            border: "1px solid var(--color-border)",
          }}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Single-badge variant for very tight slots (avatar corner, table row).
 * Returns the highest-trust signal only.
 */
export function VerificationBadgePrimary({ inputs }: { inputs: VerificationInputs }) {
  const signals = buildSignals(inputs);
  const top = signals[0];
  if (!top) return null;
  const style = TONE_STYLES[top.tone];
  return (
    <span
      title={top.description}
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium"
      style={{
        background: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
      }}
    >
      {top.tone === "verified" ? <span aria-hidden className="font-bold">✓</span> : null}
      {top.label}
    </span>
  );
}
