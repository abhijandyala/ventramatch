"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/landing/wordmark";

/**
 * /build/investor — Investor profile builder (visual only).
 *
 * Mirror of /build but for the investor side: identity → type → sectors →
 * stages → check → geography → track record → review. Same layout, same
 * primitives, no backend wiring. Deletable in one move.
 */

const STEPS = [
  { key: "identity", title: "Identity" },
  { key: "type", title: "Type" },
  { key: "sectors", title: "Sectors" },
  { key: "stages", title: "Stages" },
  { key: "check", title: "Check" },
  { key: "geo", title: "Geography" },
  { key: "track", title: "Track record" },
  { key: "review", title: "Review" },
];

const STEP_HEADERS = [
  {
    title: "Tell us who's behind the check.",
    sub: "Founders see your name, role, and firm before anything else.",
  },
  {
    title: "What kind of investor are you?",
    sub: "Sets the tone of matches and routes you to the right verification track.",
  },
  {
    title: "What do you invest in?",
    sub: "Pick every sector you actively write checks into. Founders never see the ones you didn't pick.",
  },
  {
    title: "What stages do you back?",
    sub: "We only show you founders raising at one of your stages.",
  },
  {
    title: "What's your check size?",
    sub: "Founders are pre-filtered against this band before they ever see you.",
  },
  {
    title: "Where do you invest?",
    sub: "Geography is a soft signal — out-of-market still scores, just lower.",
  },
  {
    title: "Show your track record.",
    sub: "Recent checks build trust faster than a tagline. Founders see this.",
  },
  {
    title: "Looking good. Review and publish.",
    sub: "Final pass before founders can match with you.",
  },
];

export default function BuildInvestorPage() {
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
            Build profile · Investor
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
      return <IdentityStep />;
    case 1:
      return <TypeStep />;
    case 2:
      return <SectorsStep />;
    case 3:
      return <StagesStep />;
    case 4:
      return <CheckStep />;
    case 5:
      return <GeoStep />;
    case 6:
      return <TrackStep />;
    case 7:
      return <ReviewStep />;
    default:
      return null;
  }
}

/* ---------------- 01 · Identity ---------------- */

function IdentityStep() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Field label="Full name" required>
        <Input placeholder="Your name" defaultValue="Sarah Levin" />
      </Field>
      <Field label="Title / Role" required>
        <Input
          placeholder="Partner, Principal, Angel, etc."
          defaultValue="General Partner"
        />
      </Field>
      <Field label="Firm name">
        <Input
          placeholder='Leave blank if "Solo angel"'
          defaultValue="Northbound Capital"
        />
      </Field>
      <Field label="Work email" required>
        <Input
          placeholder="you@firm.com"
          defaultValue="sarah@northbound.vc"
        />
      </Field>
      <Field label="Website">
        <Input placeholder="https://..." defaultValue="https://northbound.vc" />
      </Field>
      <Field label="LinkedIn">
        <Input
          placeholder="linkedin.com/in/..."
          defaultValue="linkedin.com/in/sarah-levin"
        />
      </Field>
      <Field label="Headquarters">
        <Input placeholder="City, State / Country" defaultValue="New York, NY" />
      </Field>
      <Field label="Founded">
        <Input placeholder="YYYY" defaultValue="2018" />
      </Field>
      <Field label="Profile photo / firm logo" full>
        <Dropzone>
          <p className="text-[13px] font-medium text-[color:var(--color-text-strong)]">
            Drop image here or browse
          </p>
          <p className="mt-1 text-[11.5px] text-[color:var(--color-text-faint)]">
            PNG, JPG, or SVG · 512px+ on the long side · &lt; 2 MB
          </p>
        </Dropzone>
      </Field>
    </div>
  );
}

/* ---------------- 02 · Type ---------------- */

const TYPES = [
  {
    key: "angel",
    label: "Solo angel",
    note: "Personal capital, single-decision",
  },
  {
    key: "syndicate",
    label: "Syndicate lead",
    note: "AngelList / Sweater style",
  },
  {
    key: "early",
    label: "Early-stage VC",
    note: "Pre-seed through Series A",
  },
  {
    key: "growth",
    label: "Growth VC",
    note: "Series B+ and later",
  },
  {
    key: "family",
    label: "Family office",
    note: "Multi-asset, longer horizon",
  },
  {
    key: "cvc",
    label: "Corporate VC",
    note: "Strategic + financial returns",
  },
];

function TypeStep() {
  const activeIndex = 2; // visual demo: Early-stage VC
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
      {TYPES.map((t, i) => {
        const on = i === activeIndex;
        return (
          <button
            key={t.key}
            type="button"
            className={[
              "flex h-full flex-col items-start rounded-[14px] border p-5 text-left transition-colors",
              on
                ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] ring-1 ring-[color:var(--color-brand)]"
                : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-text-strong)]",
            ].join(" ")}
          >
            <span
              className={[
                "text-[15px] font-semibold leading-tight",
                on
                  ? "text-[color:var(--color-brand-strong)]"
                  : "text-[color:var(--color-text-strong)]",
              ].join(" ")}
            >
              {t.label}
            </span>
            <span className="mt-2 text-[12px] leading-snug text-[color:var(--color-text-muted)]">
              {t.note}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- 03 · Sectors ---------------- */

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

function SectorsStep() {
  const selected = new Set(["AI / ML", "DevTools", "Data infra", "Cybersecurity"]);
  return (
    <div className="space-y-7">
      <div>
        <p className="mb-3 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-[color:var(--color-text-faint)]">
          Sectors I write checks into
        </p>
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
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[color:var(--color-text-faint)]">
          {selected.size} selected
        </p>
      </div>

      <div className="border-t border-[color:var(--color-border)] pt-6">
        <Field label="Investment thesis (public)">
          <Textarea
            placeholder="One paragraph on what you back and why founders should care."
            defaultValue="We back technical founders building infrastructure for the AI-native enterprise — dev tools, data plumbing, and security primitives. We lead $1–2M pre-seed rounds in companies that look like research projects but ship like products."
          />
        </Field>
      </div>

      <div>
        <Field label="Anti-thesis (private — used to filter, not shown to founders)">
          <Input
            placeholder='e.g. "No consumer social, no crypto-only plays"'
            defaultValue="No consumer social. No crypto-only plays. No services businesses."
          />
        </Field>
      </div>
    </div>
  );
}

/* ---------------- 04 · Stages ---------------- */

const STAGES = [
  { key: "preseed", label: "Pre-seed", note: "$0 – $2M raise" },
  { key: "seed", label: "Seed", note: "$2M – $5M raise" },
  { key: "a", label: "Series A", note: "$5M – $20M raise" },
  { key: "b", label: "Series B+", note: "$20M+ raise" },
];

function StagesStep() {
  const selectedStages = new Set(["preseed", "seed"]);
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STAGES.map((s) => {
          const on = selectedStages.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              className={[
                "relative flex flex-col items-start rounded-[14px] border p-5 text-left transition-colors",
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
              {on && (
                <span
                  aria-hidden
                  className="absolute right-3 top-3 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[color:var(--color-brand)] text-[9px] font-bold text-white"
                >
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-6 rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-4 py-3">
        <p className="text-[12.5px] leading-snug text-[color:var(--color-text-muted)]">
          Stage is a hard filter on both sides. Founders raising outside the
          stages you back will not appear in your inbox, even if every other
          signal matches.
        </p>
      </div>
    </div>
  );
}

/* ---------------- 05 · Check ---------------- */

function CheckStep() {
  return (
    <div className="space-y-7">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Field label="Min check" required>
          <Input prefix="$" placeholder="50,000" defaultValue="250,000" />
        </Field>
        <Field label="Sweet spot">
          <Input prefix="$" placeholder="500,000" defaultValue="1,000,000" />
        </Field>
        <Field label="Max check" required>
          <Input prefix="$" placeholder="2,500,000" defaultValue="2,500,000" />
        </Field>
      </div>

      <Field label="Position">
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Lead only", on: true },
            { label: "Follow only", on: false },
            { label: "Either lead or follow", on: false },
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
        <Field label="Annual capacity (checks / yr)">
          <Input placeholder="0" defaultValue="8" />
        </Field>
        <Field label="Max valuation cap you'll write at">
          <Input prefix="$" placeholder="0" defaultValue="20,000,000" />
        </Field>
      </div>

      <div className="rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-4 py-3">
        <p className="text-[12.5px] leading-snug text-[color:var(--color-text-muted)]">
          Check size is the third-heaviest input. Founders inside your band
          score 1.0; outside falls off linearly toward 0 with no manual
          override.
        </p>
      </div>
    </div>
  );
}

/* ---------------- 06 · Geography ---------------- */

const REGIONS = [
  "USA — West",
  "USA — East",
  "USA — Other",
  "Canada",
  "UK",
  "Europe",
  "LATAM",
  "MENA",
  "Asia",
  "Australia",
  "Africa",
];

function GeoStep() {
  const selected = new Set(["USA — West", "USA — East", "Canada", "UK"]);
  return (
    <div className="space-y-7">
      <div>
        <p className="mb-3 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-[color:var(--color-text-faint)]">
          Markets I invest in
        </p>
        <div className="flex flex-wrap gap-2">
          {REGIONS.map((r) => {
            const on = selected.has(r);
            return (
              <button
                key={r}
                type="button"
                className={[
                  "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  on
                    ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
                    : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-text-strong)] hover:text-[color:var(--color-text-strong)]",
                ].join(" ")}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      <Field label="Remote-first founders welcome?">
        <div className="flex gap-2">
          {[
            { label: "Yes", on: true },
            { label: "Only for B2B", on: false },
            { label: "No", on: false },
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

      <Field label="Office hours / in-person availability">
        <Input
          placeholder="e.g. NYC Wed/Thu, SF first week of every month"
          defaultValue="NYC Wed/Thu · SF first week of every month"
        />
      </Field>
    </div>
  );
}

/* ---------------- 07 · Track record ---------------- */

const RECENT = [
  { co: "Modal Labs", round: "Seed", year: "2025", check: "$1.0M" },
  { co: "Brace", round: "Pre-seed", year: "2025", check: "$500K" },
  { co: "Nuon", round: "Seed", year: "2024", check: "$1.5M" },
  { co: "Resolve AI", round: "Pre-seed", year: "2024", check: "$750K" },
];

function TrackStep() {
  return (
    <div className="space-y-7">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Field label="Total checks written">
          <Input placeholder="0" defaultValue="42" />
        </Field>
        <Field label="Years investing">
          <Input placeholder="0" defaultValue="7" />
        </Field>
        <Field label="Checks last 12 months">
          <Input placeholder="0" defaultValue="9" />
        </Field>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-[color:var(--color-text-faint)]">
            Recent investments — public on your profile
          </p>
          <button
            type="button"
            className="text-[12.5px] font-medium text-[color:var(--color-text-strong)] hover:underline"
          >
            + Add
          </button>
        </div>

        <ul className="divide-y divide-[color:var(--color-border)] rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
          {RECENT.map((r) => (
            <li
              key={r.co}
              className="flex items-center gap-4 px-4 py-3"
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[color:var(--color-bg)] font-mono text-[10px] font-semibold uppercase text-[color:var(--color-text-strong)]">
                {r.co.slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium text-[color:var(--color-text-strong)]">
                  {r.co}
                </p>
                <p className="text-[11.5px] text-[color:var(--color-text-faint)]">
                  {r.round} · {r.year}
                </p>
              </div>
              <span className="font-mono text-[12px] tabular-nums text-[color:var(--color-text-muted)]">
                {r.check}
              </span>
              <button
                type="button"
                aria-label="Remove"
                className="text-[color:var(--color-text-faint)] hover:text-[color:var(--color-text-strong)]"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Field label="Notable exits or mark-ups (optional, private)">
        <Textarea
          placeholder="e.g. 2x exits at $50M+, two unicorns in last vintage."
          defaultValue="2024 vintage: 1 acquisition (Brace → Stripe, 7x), 2 series B mark-ups (3.4x and 5.1x)."
        />
      </Field>
    </div>
  );
}

/* ---------------- 08 · Review ---------------- */

function ReviewStep() {
  return (
    <div className="space-y-6">
      <div className="rounded-[16px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[color:var(--color-text-strong)] font-mono text-[12px] font-semibold text-white">
            SL
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-semibold leading-tight text-[color:var(--color-text-strong)]">
              Sarah Levin
            </p>
            <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
              General Partner · Northbound Capital · NYC
            </p>
            <p className="mt-3 max-w-[60ch] text-[14px] leading-[1.55] text-[color:var(--color-text)]">
              We back technical founders building infrastructure for the
              AI-native enterprise. Pre-seed and seed, $250K–$2.5M checks,
              lead position only.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Tag>AI / ML</Tag>
          <Tag>DevTools</Tag>
          <Tag>Data infra</Tag>
          <Tag>Cybersecurity</Tag>
          <Tag>Pre-seed</Tag>
          <Tag>Seed</Tag>
          <Tag green>Lead · $250K – $2.5M</Tag>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SummaryRow label="Type" value="Early-stage VC" />
        <SummaryRow label="Stages" value="Pre-seed, Seed" />
        <SummaryRow label="Sectors" value="AI / ML, DevTools, +2" />
        <SummaryRow label="Geography" value="USA W/E · CA · UK" />
        <SummaryRow label="Check range" value="$250K – $2.5M" />
        <SummaryRow label="Sweet spot" value="$1M (lead)" />
        <SummaryRow label="Capacity" value="8 checks / year" />
        <SummaryRow label="Track record" value="42 checks · 7 yrs" />
      </div>

      <p className="text-[12px] leading-snug text-[color:var(--color-text-faint)]">
        Profile is visible only to founders that match your filters. You
        won&apos;t appear in any public list. Pass is invisible — founders
        never see who passed on them.
      </p>
    </div>
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
