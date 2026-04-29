"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/landing/wordmark";

/**
 * /build — Startup profile builder (visual only).
 *
 * Self-contained, stateless wizard for recording feature demos. There is
 * NO backend wiring, NO validation, NO persistence — every input is purely
 * visual. The whole route can be deleted once the videos are captured.
 *
 * Layout (desktop and mobile both):
 *   - 56px sticky top bar (logo + breadcrumb + Save & exit)
 *   - Horizontal progress stepper (centered, max-w 960)
 *   - Centered content column (max-w 760)
 *   - Sticky footer with Back / Continue / Publish
 *
 * No sidebar — keeps the page from sprawling at any viewport width.
 */

const STEPS = [
  { key: "company", title: "Company" },
  { key: "sector", title: "Sector" },
  { key: "stage", title: "Stage" },
  { key: "round", title: "Round" },
  { key: "traction", title: "Traction" },
  { key: "deck", title: "Deck" },
  { key: "founder", title: "Founder" },
  { key: "review", title: "Review" },
];

const STEP_HEADERS = [
  {
    title: "Tell us about your company.",
    sub: "These details are public on your profile. Investors see this first.",
  },
  {
    title: "What sectors are you in?",
    sub: "Pick up to three. Sector is the largest single signal in the match score.",
  },
  {
    title: "What stage are you raising at?",
    sub: "We only show you investors who explicitly back your stage.",
  },
  {
    title: "Tell us about the round.",
    sub: "Visible only to investors after both sides opt in.",
  },
  {
    title: "What's your traction?",
    sub: "Be specific. Self-reported numbers are clearly labeled until verified.",
  },
  {
    title: "Upload your deck.",
    sub: "PDF only. Stays private until mutual interest unlocks.",
  },
  {
    title: "Verify it's really you.",
    sub: "We verify identity before any startup profile activates.",
  },
  {
    title: "Looking good. Review and publish.",
    sub: "Final pass before your profile goes live.",
  },
];

export default function BuildPage() {
  const [step, setStep] = useState(0);
  const total = STEPS.length;
  const t = STEP_HEADERS[step];

  return (
    <main className="min-h-screen bg-[color:var(--color-surface)] text-[color:var(--color-text)]">
      {/* ---------- Top bar ---------- */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]/90 px-5 backdrop-blur md:px-8">
        <div className="flex items-center gap-4">
          <Wordmark size="sm" />
          <span aria-hidden className="hidden h-4 w-px bg-[color:var(--color-border)] sm:block" />
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)] sm:inline">
            Build profile · Startup
          </span>
        </div>
        <div className="flex items-center gap-5">
          <button
            type="button"
            className="text-[12.5px] text-[color:var(--color-text-faint)] transition-colors hover:text-[color:var(--color-text-strong)]"
          >
            Save draft
          </button>
          <Link
            href="/"
            className="text-[12.5px] text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-strong)]"
          >
            Save &amp; exit
          </Link>
        </div>
      </header>

      {/* ---------- Stepper ---------- */}
      <div className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
        <div className="mx-auto max-w-[960px] px-5 py-7 md:px-8 md:py-8">
          <Stepper step={step} setStep={setStep} />
        </div>
      </div>

      {/* ---------- Content ---------- */}
      <section className="mx-auto w-full max-w-[760px] px-5 py-12 md:px-8 md:py-16">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
          Step {String(step + 1).padStart(2, "0")} of {String(total).padStart(2, "0")}
          <span aria-hidden className="mx-2 text-[color:var(--color-border-strong)]">·</span>
          {STEPS[step].title}
        </p>
        <h1
          className="mt-3 text-balance font-semibold tracking-[-0.014em] text-[color:var(--color-text-strong)]"
          style={{ fontSize: "clamp(26px, 3vw, 34px)", lineHeight: 1.12 }}
        >
          {t.title}
        </h1>
        <p className="mt-3 max-w-[58ch] text-[14.5px] leading-[1.6] text-[color:var(--color-text-muted)]">
          {t.sub}
        </p>

        <div className="mt-10">
          <StepBody step={step} />
        </div>
      </section>

      {/* ---------- Footer nav ---------- */}
      <footer className="sticky bottom-0 border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[760px] items-center justify-between px-5 py-4 md:px-8 md:py-5">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-strong)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Back
          </button>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--color-text-faint)] sm:inline">
            {step + 1} / {total}
          </span>
          {step < total - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
              className="rounded-[10px] bg-[color:var(--color-text-strong)] px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[color:var(--color-text)]"
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              className="rounded-[10px] bg-[color:var(--color-brand)] px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[color:var(--color-brand-strong)]"
            >
              Publish profile
            </button>
          )}
        </div>
      </footer>
    </main>
  );
}

/* ---------------- Horizontal stepper ---------------- */

function Stepper({
  step,
  setStep,
}: {
  step: number;
  setStep: (i: number) => void;
}) {
  return (
    <ol className="flex items-start">
      {STEPS.map((s, i) => {
        const isActive = i === step;
        const isComplete = i < step;
        const isLast = i === STEPS.length - 1;
        return (
          <li key={s.key} className="flex min-w-0 flex-1 flex-col items-center">
            {/* Dot row with connector half-lines on either side */}
            <div className="flex w-full items-center">
              <span
                aria-hidden
                className={[
                  "h-[2px] flex-1 transition-colors",
                  i === 0
                    ? "bg-transparent"
                    : i <= step
                      ? "bg-[color:var(--color-brand)]"
                      : "bg-[color:var(--color-border)]",
                ].join(" ")}
              />
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-current={isActive ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${s.title}`}
                className={[
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-[11px] font-semibold tabular-nums transition-all",
                  isComplete
                    ? "bg-[color:var(--color-brand)] text-white"
                    : isActive
                      ? "bg-[color:var(--color-text-strong)] text-white ring-[3px] ring-[color:var(--color-text-strong)]/15"
                      : "border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] text-[color:var(--color-text-faint)] hover:border-[color:var(--color-text-strong)] hover:text-[color:var(--color-text-strong)]",
                ].join(" ")}
              >
                {isComplete ? "✓" : i + 1}
              </button>
              <span
                aria-hidden
                className={[
                  "h-[2px] flex-1 transition-colors",
                  isLast
                    ? "bg-transparent"
                    : i < step
                      ? "bg-[color:var(--color-brand)]"
                      : "bg-[color:var(--color-border)]",
                ].join(" ")}
              />
            </div>

            {/* Step name */}
            <button
              type="button"
              onClick={() => setStep(i)}
              className={[
                "mt-2.5 max-w-full truncate px-1 text-[11.5px] font-medium transition-colors",
                isActive
                  ? "text-[color:var(--color-text-strong)]"
                  : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-strong)]",
              ].join(" ")}
            >
              {s.title}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------- Step body switch ---------------- */

function StepBody({ step }: { step: number }) {
  switch (step) {
    case 0:
      return <CompanyStep />;
    case 1:
      return <SectorStep />;
    case 2:
      return <StageStep />;
    case 3:
      return <RoundStep />;
    case 4:
      return <TractionStep />;
    case 5:
      return <DeckStep />;
    case 6:
      return <FounderStep />;
    case 7:
      return <ReviewStep />;
    default:
      return null;
  }
}

/* ---------------- 01 · Company ---------------- */

function CompanyStep() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="Company name" required>
        <Input placeholder="VentraMatch, Inc." defaultValue="VentraMatch, Inc." />
      </Field>
      <Field label="Website">
        <Input placeholder="https://..." defaultValue="https://ventramatch.com" />
      </Field>
      <Field label="One-line description" full>
        <Input
          placeholder="What you do, in one sentence."
          defaultValue="We match founders with investors that score on real fit, then unlock contact only on mutual interest."
        />
      </Field>
      <Field label="HQ city">
        <Input placeholder="City, State / Country" defaultValue="San Francisco, CA" />
      </Field>
      <Field label="Founded">
        <Input placeholder="YYYY" defaultValue="2025" />
      </Field>
      <Field label="Logo" full>
        <Dropzone>
          <p className="text-[13px] font-medium text-[color:var(--color-text-strong)]">
            Drop logo here or browse
          </p>
          <p className="mt-1 text-[11.5px] text-[color:var(--color-text-faint)]">
            PNG or SVG · 512px+ on the long side · &lt; 2 MB
          </p>
        </Dropzone>
      </Field>
    </div>
  );
}

/* ---------------- 02 · Sector ---------------- */

const SECTORS = [
  "AI / ML",
  "SaaS",
  "Fintech",
  "Healthtech",
  "Climate",
  "DevTools",
  "Consumer",
  "Marketplace",
  "Hardware",
  "Bio",
  "Defense",
  "Robotics",
  "Web3",
  "EdTech",
  "Real estate",
  "Industrial",
  "Logistics",
  "Cybersecurity",
  "Data infra",
  "Govtech",
];

function SectorStep() {
  const selected = new Set(["AI / ML", "SaaS"]);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {SECTORS.map((s) => {
          const on = selected.has(s);
          return (
            <button
              key={s}
              type="button"
              className={[
                "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                on
                  ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
                  : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-text-strong)] hover:text-[color:var(--color-text-strong)]",
              ].join(" ")}
            >
              {s}
            </button>
          );
        })}
      </div>
      <div className="mt-7 flex items-center justify-between border-t border-[color:var(--color-border)] pt-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--color-text-faint)]">
          {selected.size} of 3 selected
        </p>
        <button
          type="button"
          className="text-[12.5px] font-medium text-[color:var(--color-text-strong)] hover:underline"
        >
          + Add custom sector
        </button>
      </div>
    </div>
  );
}

/* ---------------- 03 · Stage ---------------- */

const STAGES = [
  { key: "preseed", label: "Pre-seed", note: "$0 – $2M raise" },
  { key: "seed", label: "Seed", note: "$2M – $5M raise" },
  { key: "a", label: "Series A", note: "$5M – $20M raise" },
  { key: "b", label: "Series B+", note: "$20M+ raise" },
];

function StageStep() {
  const activeIndex = 1;
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STAGES.map((s, i) => {
          const on = i === activeIndex;
          return (
            <button
              key={s.key}
              type="button"
              className={[
                "flex flex-col items-start rounded-[14px] border p-5 text-left transition-colors",
                on
                  ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] ring-1 ring-[color:var(--color-brand)]"
                  : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-text-strong)]",
              ].join(" ")}
            >
              <span
                className={[
                  "text-[16px] font-semibold",
                  on
                    ? "text-[color:var(--color-brand-strong)]"
                    : "text-[color:var(--color-text-strong)]",
                ].join(" ")}
              >
                {s.label}
              </span>
              <span className="mt-2 font-mono text-[11px] tabular-nums text-[color:var(--color-text-muted)]">
                {s.note}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-6 rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-4 py-3">
        <p className="text-[12.5px] leading-snug text-[color:var(--color-text-muted)]">
          Stage drives a hard filter. Investors who don&apos;t back your stage
          will not see your profile, even if every other input matches.
        </p>
      </div>
    </div>
  );
}

/* ---------------- 04 · Round ---------------- */

function RoundStep() {
  return (
    <div className="space-y-7">
      <Field label="Target raise" required>
        <Input prefix="$" placeholder="0" defaultValue="2,000,000" />
      </Field>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Min check">
          <Input prefix="$" placeholder="50,000" defaultValue="50,000" />
        </Field>
        <Field label="Max check">
          <Input prefix="$" placeholder="500,000" defaultValue="500,000" />
        </Field>
      </div>

      <Field label="Lead status">
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Looking for lead", on: true },
            { label: "Lead committed", on: false },
            { label: "Filling allocation", on: false },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              className={[
                "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                opt.on
                  ? "border-[color:var(--color-text-strong)] bg-[color:var(--color-text-strong)] text-white"
                  : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-text-strong)] hover:text-[color:var(--color-text-strong)]",
              ].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Round close target">
          <Input placeholder="May 30, 2026" defaultValue="May 30, 2026" />
        </Field>
        <Field label="Valuation cap (optional)">
          <Input prefix="$" placeholder="0" defaultValue="18,000,000" />
        </Field>
      </div>

      <Field label="Use of funds">
        <Textarea
          placeholder="What this round buys you in three short bullets."
          defaultValue="Hire two engineers, ship matching v2, and reach $200K MRR by Q4."
        />
      </Field>
    </div>
  );
}

/* ---------------- 05 · Traction ---------------- */

function TractionStep() {
  return (
    <div className="space-y-7">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Field label="MRR">
          <Input prefix="$" placeholder="0" defaultValue="48,000" />
        </Field>
        <Field label="Paying customers">
          <Input placeholder="0" defaultValue="42" />
        </Field>
        <Field label="3-month growth">
          <Input suffix="%" placeholder="0" defaultValue="22" />
        </Field>
      </div>

      <Field label="Notable signals">
        <Textarea
          placeholder="Pilots, design partners, enterprise interest, key hires."
          defaultValue="Two enterprise pilots in flight. Top-of-funnel growing 30% MoM. Three design partners across logistics and fintech."
        />
      </Field>

      <Field label="Anything else investors should know">
        <Textarea
          placeholder="Optional context — recent press, partnerships, awards."
          defaultValue=""
        />
      </Field>

      <div className="rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-4 py-3">
        <p className="text-[12.5px] leading-snug text-[color:var(--color-text-muted)]">
          Traction is the lowest-weighted input on purpose — it&apos;s the
          easiest one to inflate on a profile. Be honest; investors notice.
        </p>
      </div>
    </div>
  );
}

/* ---------------- 06 · Deck ---------------- */

function DeckStep() {
  return (
    <div className="space-y-6">
      <Dropzone tall>
        <p className="text-[15px] font-semibold text-[color:var(--color-text-strong)]">
          Drag your deck here
        </p>
        <p className="mt-1.5 text-[12.5px] text-[color:var(--color-text-faint)]">
          PDF · &lt; 25 MB · stays private until mutual interest
        </p>
        <button
          type="button"
          className="mt-5 rounded-[10px] border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-4 py-2 text-[13px] font-medium text-[color:var(--color-text-strong)] transition-colors hover:border-[color:var(--color-text-strong)]"
        >
          Browse files
        </button>
      </Dropzone>

      <div className="flex items-center justify-between rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-[8px] bg-[color:var(--color-bg)] font-mono text-[10px] font-semibold uppercase text-[color:var(--color-text-strong)]">
            PDF
          </div>
          <div>
            <p className="text-[13px] font-medium text-[color:var(--color-text-strong)]">
              ventramatch_q2_2026.pdf
            </p>
            <p className="text-[11.5px] text-[color:var(--color-text-faint)]">
              2.4 MB · 12 pages · uploaded just now
            </p>
          </div>
        </div>
        <button
          type="button"
          className="text-[12.5px] font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-strong)]"
        >
          Replace
        </button>
      </div>

      <div className="rounded-[14px] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--color-text-faint)]">
          Optional · gated by mutual unlock
        </p>
        <ul className="mt-3 divide-y divide-[color:var(--color-border)]">
          <OptionalRow label="Financial model" hint="XLSX or Sheets URL" />
          <OptionalRow label="Cap table" hint="Carta or Pulley link" />
          <OptionalRow
            label="Customer references"
            hint="Names, role, and email"
          />
        </ul>
      </div>
    </div>
  );
}

function OptionalRow({ label, hint }: { label: string; hint: string }) {
  return (
    <li className="flex items-center justify-between py-3">
      <div>
        <p className="text-[13.5px] font-medium text-[color:var(--color-text-strong)]">
          {label}
        </p>
        <p className="text-[11.5px] text-[color:var(--color-text-faint)]">
          {hint}
        </p>
      </div>
      <button
        type="button"
        className="rounded-[8px] border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-3 py-1 text-[12px] font-medium text-[color:var(--color-text-strong)] transition-colors hover:border-[color:var(--color-text-strong)]"
      >
        + Add
      </button>
    </li>
  );
}

/* ---------------- 07 · Founder ---------------- */

function FounderStep() {
  return (
    <div className="space-y-7">
      <div className="rounded-[14px] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand)] font-mono text-[10px] font-bold text-white"
          >
            i
          </span>
          <p className="text-[13px] leading-[1.6] text-[color:var(--color-text-muted)]">
            We verify identity before any startup profile activates. This
            protects investors from impersonators and protects you from
            catfish accounts. Verification status is private.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Full name" required>
          <Input placeholder="Your full name" defaultValue="Abhi Jandyala" />
        </Field>
        <Field label="Role" required>
          <Input
            placeholder="CEO &amp; Co-founder"
            defaultValue="CEO & Co-founder"
          />
        </Field>
        <Field label="Work email" required>
          <Input
            placeholder="you@company.com"
            defaultValue="abhi@ventramatch.com"
          />
        </Field>
        <Field label="LinkedIn URL">
          <Input
            placeholder="linkedin.com/in/..."
            defaultValue="linkedin.com/in/abhi-jandyala"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-[10px] bg-[color:var(--color-text-strong)] px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[color:var(--color-text)]"
        >
          Send verification email
        </button>
        <span className="text-[12px] text-[color:var(--color-text-faint)]">
          One-tap link from no-reply@ventramatch.com.
        </span>
      </div>
    </div>
  );
}

/* ---------------- 08 · Review ---------------- */

function ReviewStep() {
  return (
    <div className="space-y-6">
      <div className="rounded-[16px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[10px] bg-[color:var(--color-brand-tint)] font-semibold text-[color:var(--color-brand-strong)] ring-1 ring-[color:var(--color-brand)]">
            V/
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-semibold leading-tight text-[color:var(--color-text-strong)]">
              VentraMatch, Inc.
            </p>
            <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
              San Francisco, CA · Founded 2025
            </p>
            <p className="mt-3 max-w-[60ch] text-[14px] leading-[1.55] text-[color:var(--color-text)]">
              We match founders with investors that score on real fit, then
              unlock contact only on mutual interest.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Tag>AI / ML</Tag>
          <Tag>SaaS</Tag>
          <Tag>Seed</Tag>
          <Tag green>Raising $2M</Tag>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SummaryRow label="Stage" value="Seed · $2M target" />
        <SummaryRow label="Check range" value="$50K – $500K" />
        <SummaryRow label="Sectors" value="AI / ML, SaaS" />
        <SummaryRow label="Geography" value="San Francisco, CA" />
        <SummaryRow label="MRR" value="$48,000" />
        <SummaryRow label="Customers" value="42 · +22% / 3mo" />
        <SummaryRow label="Deck" value="ventramatch_q2_2026.pdf" />
        <SummaryRow label="Founder" value="Abhi Jandyala (verified)" />
      </div>

      <p className="text-[12px] leading-snug text-[color:var(--color-text-faint)]">
        Profile becomes visible only to investors that match your filters.
        You won&apos;t appear in any public list, and nothing outside the
        match score is sent until both sides opt in.
      </p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[color:var(--color-text-faint)]">
        {label}
      </span>
      <span className="text-right text-[13.5px] font-medium text-[color:var(--color-text-strong)]">
        {value}
      </span>
    </div>
  );
}

function Tag({
  children,
  green = false,
}: {
  children: ReactNode;
  green?: boolean;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium",
        green
          ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
          : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)]",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

/* ---------------- Form primitives ---------------- */

function Field({
  label,
  children,
  required = false,
  full = false,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  full?: boolean;
}) {
  return (
    <label className={["block", full ? "md:col-span-2" : ""].join(" ")}>
      <span className="mb-2 flex items-center gap-1 text-[12px] font-medium text-[color:var(--color-text-strong)]">
        {label}
        {required && (
          <span className="text-[color:var(--color-brand)]">*</span>
        )}
      </span>
      {children}
    </label>
  );
}

function Input({
  placeholder,
  prefix,
  suffix,
  defaultValue,
}: {
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  defaultValue?: string;
}) {
  return (
    <div className="flex h-11 items-center rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3.5 transition-colors focus-within:border-[color:var(--color-text-strong)] focus-within:ring-1 focus-within:ring-[color:var(--color-text-strong)]">
      {prefix && (
        <span className="mr-2 font-mono text-[13px] text-[color:var(--color-text-faint)]">
          {prefix}
        </span>
      )}
      <input
        type="text"
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="flex-1 bg-transparent text-[14px] text-[color:var(--color-text-strong)] placeholder:text-[color:var(--color-text-faint)] focus:outline-none"
      />
      {suffix && (
        <span className="ml-2 font-mono text-[13px] text-[color:var(--color-text-faint)]">
          {suffix}
        </span>
      )}
    </div>
  );
}

function Textarea({
  placeholder,
  defaultValue,
}: {
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <textarea
      rows={4}
      placeholder={placeholder}
      defaultValue={defaultValue}
      className="block w-full rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3.5 py-3 text-[14px] leading-[1.5] text-[color:var(--color-text-strong)] placeholder:text-[color:var(--color-text-faint)] transition-colors focus:border-[color:var(--color-text-strong)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-text-strong)]"
    />
  );
}

function Dropzone({
  children,
  tall = false,
}: {
  children: ReactNode;
  tall?: boolean;
}) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center rounded-[14px] border-2 border-dashed border-[color:var(--color-border-strong)] bg-[color:var(--color-bg)] text-center",
        tall ? "px-8 py-14" : "px-6 py-10",
      ].join(" ")}
    >
      {children}
    </div>
  );
}
