import Link from "next/link";
import { ArrowRight, Check, Dot } from "lucide-react";
import { Wordmark } from "@/components/landing/wordmark";
import { MatchScene } from "@/components/landing/match-scene";
import { AnimateOnView } from "@/components/landing/animate-on-view";

export default function HomePage() {
  return (
    <main className="bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
      <Nav />
      <Hero />
      <FlowSection />
      <TwoSidedSection />
      <ProofBar />
      <ComplianceStrip />
      <FinalCta />
      <Footer />
    </main>
  );
}

/* ---------- 1. Nav ---------- */

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--color-bg)]/70">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
        <Wordmark size="md" />
        <Link
          href="#waitlist"
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-[color:var(--color-text-strong)] px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-black"
        >
          Join the waitlist
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
        </Link>
      </div>
    </header>
  );
}

/* ---------- 2. Hero ---------- */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Faint grid backdrop, masked top-down so it doesn't fight the headline */}
      <div className="pointer-events-none absolute inset-0 grid-faint [mask-image:linear-gradient(to_bottom,white_25%,transparent_85%)]" />

      <div className="relative mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-12 px-6 pt-20 pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 lg:pt-28 lg:pb-32">
        <AnimateOnView variant="fade-up" delay={0}>
          <h1 className="text-balance text-[44px] font-semibold leading-[1.02] tracking-[-0.025em] text-[color:var(--color-text-strong)] md:text-[60px] lg:text-[64px]">
            Fundraising should feel
            <br />
            like a <Match>match</Match>, not a lottery.
          </h1>
        </AnimateOnView>

        <AnimateOnView variant="fade-up" delay={120} className="lg:row-start-2">
          <p className="max-w-[58ch] text-pretty text-[17px] leading-[1.55] text-[color:var(--color-text-muted)] md:text-[19px]">
            VentraMatch scores every investor against your raise on the five things they actually filter on. Mutual interest unlocks contact. No cold-email lottery, no warm-intro gatekeeping.
          </p>
        </AnimateOnView>

        <AnimateOnView variant="fade-up" delay={240} className="lg:row-start-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="#waitlist"
              className="inline-flex items-center gap-2 rounded-[10px] bg-[color:var(--color-text-strong)] px-5 py-3 text-[15px] font-medium text-white transition-colors hover:bg-black"
            >
              Join the waitlist
              <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
            </Link>
            <Link
              href="#how"
              className="inline-flex items-center gap-2 rounded-[10px] border border-[color:var(--color-border-strong)] bg-white px-5 py-3 text-[15px] font-medium text-[color:var(--color-text-strong)] transition-colors hover:border-[color:var(--color-text-muted)]"
            >
              See how it works
            </Link>
          </div>
        </AnimateOnView>

        {/* Right column: the match scene */}
        <div className="lg:col-start-2 lg:row-span-3 lg:row-start-1 flex justify-center lg:justify-end">
          <MatchScene />
        </div>
      </div>
    </section>
  );
}

function Match({ children }: { children: React.ReactNode }) {
  return <span className="text-[color:var(--color-brand)]">{children}</span>;
}

/* ---------- 3. Flow ("how it works") — visual, not text-walls ---------- */

function FlowSection() {
  const steps = [
    {
      n: "01",
      title: "Build one structured profile",
      body:
        "Founders describe their startup, investors describe their thesis. Same five filters on both sides: sector, stage, check size, geography, traction.",
      visual: <FlowProfile />,
    },
    {
      n: "02",
      title: "We score the fit, openly",
      body:
        "Every match shows the percentage and a one-line reason. The exact formula lives in the repo — not a black box.",
      visual: <FlowScore />,
    },
    {
      n: "03",
      title: "Mutual interest unlocks contact",
      body:
        "Either side can see the other; neither can message until both click interested. Founders never see who passed; investors never get unsolicited inbound.",
      visual: <FlowUnlock />,
    },
  ];

  return (
    <section
      id="how"
      className="border-t border-[color:var(--color-border)] bg-white"
    >
      <div className="mx-auto max-w-[1200px] px-6 py-24 md:py-28">
        <AnimateOnView>
          <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--color-text-faint)]">
            How it works
          </p>
          <h2 className="mt-3 max-w-[20ch] text-[34px] font-semibold leading-[1.05] tracking-[-0.02em] text-[color:var(--color-text-strong)] md:text-[44px]">
            Three steps. No spreadsheets.
          </h2>
        </AnimateOnView>

        <div className="mt-14 grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8 lg:gap-12">
          {steps.map((s, i) => (
            <AnimateOnView key={s.n} delay={i * 120}>
              <div className="flex h-full flex-col">
                <div className="relative mb-6 aspect-[4/3] w-full overflow-hidden rounded-[14px] border border-[color:var(--color-border)] bg-[color:var(--color-bg)]">
                  <div className="absolute inset-0 flex items-center justify-center p-6">
                    {s.visual}
                  </div>
                </div>
                <p className="font-mono text-[12px] tabular-nums text-[color:var(--color-brand)]">
                  {s.n}
                </p>
                <h3 className="mt-1.5 text-[20px] font-semibold leading-[1.25] tracking-[-0.01em] text-[color:var(--color-text-strong)]">
                  {s.title}
                </h3>
                <p className="mt-2 text-[14px] leading-[1.55] text-[color:var(--color-text-muted)]">
                  {s.body}
                </p>
              </div>
            </AnimateOnView>
          ))}
        </div>
      </div>
    </section>
  );
}

/* The three flow visuals — small, hand-tuned, no synthetic charts. */

function FlowProfile() {
  const fields = [
    { k: "Sector", v: "AI infra" },
    { k: "Stage", v: "Pre-seed" },
    { k: "Check size", v: "$1M raise" },
    { k: "Geography", v: "San Francisco" },
    { k: "Traction", v: "30 design partners" },
  ];
  return (
    <div className="w-full max-w-[280px] rounded-[10px] border border-[color:var(--color-border)] bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[color:var(--color-text-faint)]">
        Profile
      </p>
      <ul className="mt-3 space-y-2.5">
        {fields.map((f) => (
          <li
            key={f.k}
            className="flex items-baseline justify-between gap-3 text-[12px]"
          >
            <span className="text-[color:var(--color-text-muted)]">{f.k}</span>
            <span className="font-medium text-[color:var(--color-text-strong)]">
              {f.v}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FlowScore() {
  return (
    <div className="flex w-full max-w-[280px] flex-col items-center gap-3">
      <div className="relative">
        <svg viewBox="0 0 120 120" className="h-[120px] w-[120px]">
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke="var(--color-surface-2)"
            strokeWidth="10"
          />
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke="var(--color-brand)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${Math.PI * 2 * 48}`}
            strokeDashoffset={`${Math.PI * 2 * 48 * (1 - 0.91)}`}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[26px] font-semibold tabular-nums text-[color:var(--color-text-strong)]">
            91
          </span>
          <span className="-mt-1 font-mono text-[10px] text-[color:var(--color-text-faint)]">
            % match
          </span>
        </div>
      </div>
      <p className="px-3 text-center text-[12px] leading-[1.4] text-[color:var(--color-text-muted)]">
        Invests in fintech, check size fits, covers SF.
      </p>
    </div>
  );
}

function FlowUnlock() {
  return (
    <div className="flex w-full max-w-[280px] flex-col items-center gap-3">
      <div className="flex items-center gap-2.5">
        <DotPair label="F" />
        <div className="h-px w-8 bg-[color:var(--color-brand)]" />
        <div className="rounded-full border border-[color:var(--color-brand)]/30 bg-white px-2.5 py-1 text-[10px] font-semibold tracking-tight">
          <span className="text-[color:var(--color-text-faint)]">Ventra</span>
          <span className="text-[color:var(--color-brand)]">match</span>
        </div>
        <div className="h-px w-8 bg-[color:var(--color-brand)]" />
        <DotPair label="I" />
      </div>
      <div className="rounded-md border border-[color:var(--color-border)] bg-white px-3 py-2 text-[11px] font-medium text-[color:var(--color-text-strong)]">
        Contact unlocked
      </div>
    </div>
  );
}

function DotPair({ label }: { label: string }) {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-white text-[12px] font-semibold text-[color:var(--color-text-strong)]">
      {label}
    </div>
  );
}

/* ---------- 4. Two-sided ---------- */

function TwoSidedSection() {
  return (
    <section className="border-t border-[color:var(--color-border)] bg-[color:var(--color-bg)]">
      <div className="mx-auto max-w-[1200px] px-6 py-24 md:py-28">
        <AnimateOnView>
          <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--color-text-faint)]">
            Two-sided by design
          </p>
          <h2 className="mt-3 max-w-[24ch] text-[34px] font-semibold leading-[1.05] tracking-[-0.02em] text-[color:var(--color-text-strong)] md:text-[44px]">
            Built for the side you&apos;re actually on.
          </h2>
        </AnimateOnView>

        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-[20px] border border-[color:var(--color-border)] bg-[color:var(--color-border)] md:grid-cols-2">
          <SidePanel
            tag="Founders"
            tagAccent="text-[color:var(--color-info)]"
            tagDot="bg-[color:var(--color-info)]"
            title="Find the eight investors who actually fit."
            points={[
              "Ranked queue of investors who back your stage and sector.",
              "Score and one-line reason on every row.",
              "Mutual interest unlocks contact — no cold replies.",
            ]}
            artwork={<FoundersArt />}
          />
          <SidePanel
            tag="Investors"
            tagAccent="text-[color:var(--color-brand-strong)]"
            tagDot="bg-[color:var(--color-brand)]"
            title="A feed where every card scans in five seconds."
            points={[
              "Filtered to your sectors, stages, and check band.",
              "Pass means hidden, not blocked — founders never see it.",
              "Anti-spam by construction: messaging only after match.",
            ]}
            artwork={<InvestorsArt />}
          />
        </div>
      </div>
    </section>
  );
}

function SidePanel({
  tag,
  tagAccent,
  tagDot,
  title,
  points,
  artwork,
}: {
  tag: string;
  tagAccent: string;
  tagDot: string;
  title: string;
  points: string[];
  artwork: React.ReactNode;
}) {
  return (
    <div className="flex flex-col bg-white p-8 md:p-10">
      <p className={`inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.1em] ${tagAccent}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${tagDot}`} />
        {tag}
      </p>
      <h3 className="mt-4 max-w-[26ch] text-[24px] font-semibold leading-[1.15] tracking-[-0.012em] text-[color:var(--color-text-strong)]">
        {title}
      </h3>
      <div className="my-7 h-px w-full bg-[color:var(--color-border)]" />
      <div className="flex-1">{artwork}</div>
      <ul className="mt-7 space-y-2.5">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2.5 text-[14px] leading-[1.55] text-[color:var(--color-text-strong)]">
            <Check className="mt-[3px] h-4 w-4 shrink-0 text-[color:var(--color-brand)]" strokeWidth={2.5} />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FoundersArt() {
  // Stylized: a column of investor rows, scored, filtered down.
  const rows = [
    { name: "Acme Capital", score: 94, sector: "AI infra · Pre-seed", state: "active" },
    { name: "Ridge Ventures", score: 87, sector: "Dev tools · Pre-seed", state: "active" },
    { name: "Northstar Angels", score: 81, sector: "AI · Pre-seed", state: "active" },
  ];
  return (
    <div className="rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] p-3">
      <p className="px-2 pb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-[color:var(--color-text-faint)]">
        Top matches for your raise
      </p>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div
            key={r.name}
            className="flex items-center justify-between gap-3 rounded-[8px] border border-[color:var(--color-border)] bg-white px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[color:var(--color-text-strong)]">
                {r.name}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-[color:var(--color-text-muted)]">
                {r.sector}
              </p>
            </div>
            <span className="shrink-0 rounded-[6px] bg-[color:var(--color-brand-tint)] px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-[color:var(--color-brand-strong)]">
              {r.score}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InvestorsArt() {
  // Stylized: a single startup card the investor would see in feed.
  return (
    <div className="rounded-[12px] border border-[color:var(--color-border)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[color:var(--color-text-strong)]">
            Anonymous · pre-seed AI
          </p>
          <p className="mt-0.5 text-[11px] text-[color:var(--color-text-muted)]">
            San Francisco · 2 founders
          </p>
        </div>
        <span className="shrink-0 rounded-[6px] bg-[color:var(--color-brand-tint)] px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-[color:var(--color-brand-strong)]">
          91%
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {["AI infra", "Pre-seed", "$1M raise"].map((c) => (
          <span
            key={c}
            className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--color-text-strong)]"
          >
            {c}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[12px] leading-[1.5] text-[color:var(--color-text-muted)]">
        Building autonomous QA agents for production webapps. ~30 design partners, 4 paying.
      </p>
      <div className="mt-4 flex items-center gap-2 border-t border-[color:var(--color-border)] pt-3">
        <span className="rounded-[6px] bg-[color:var(--color-text-strong)] px-2.5 py-1 text-[11px] font-medium text-white">
          Interested
        </span>
        <span className="px-2 py-1 text-[11px] font-medium text-[color:var(--color-text-muted)]">
          Pass
        </span>
      </div>
    </div>
  );
}

/* ---------- 5. Proof bar ---------- */

function ProofBar() {
  // Real numbers from research, embedded in prose so it doesn't read as a vanity-metric grid.
  return (
    <section className="border-t border-[color:var(--color-border)] bg-white">
      <div className="mx-auto max-w-[1200px] px-6 py-20">
        <AnimateOnView>
          <div className="grid grid-cols-1 items-end gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-12">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--color-text-faint)]">
                The market we&apos;re in
              </p>
              <h2 className="mt-3 text-[26px] font-semibold leading-[1.15] tracking-[-0.012em] text-[color:var(--color-text-strong)] md:text-[32px]">
                A search problem dressed up as a sales problem.
              </h2>
            </div>
            <p className="text-[16px] leading-[1.6] text-[color:var(--color-text-muted)] md:text-[17px]">
              50,316 SAFEs raised <Stat>$10.4B</Stat> in 2025. There are <Stat>300K+</Stat> active US angels and <Stat>2,500+</Stat> active VC funds — and most of them aren&apos;t the right fit for your raise. We compute fit, explain it, and only let mutually-interested sides talk.
            </p>
          </div>
        </AnimateOnView>
      </div>
    </section>
  );
}

function Stat({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[0.95em] font-semibold tabular-nums text-[color:var(--color-text-strong)]">
      {children}
    </span>
  );
}

/* ---------- 6. Compliance strip ---------- */

function ComplianceStrip() {
  const items = [
    "Not investment advice — match scores are a fit signal, not a recommendation.",
    "No success fees. We charge for software access only.",
    "Both sides verified before mutual unlock.",
    "SOC 2 Type II in flight. GDPR / CCPA compliant by default.",
  ];
  return (
    <section className="border-t border-[color:var(--color-border)] bg-[color:var(--color-bg)]">
      <div className="mx-auto max-w-[1200px] px-6 py-14">
        <AnimateOnView>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {items.map((it) => (
              <li
                key={it}
                className="flex items-start gap-2.5 text-[13px] leading-[1.55] text-[color:var(--color-text-muted)]"
              >
                <Dot
                  className="mt-[5px] h-3 w-3 shrink-0 text-[color:var(--color-brand)]"
                  strokeWidth={5}
                />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </AnimateOnView>
      </div>
    </section>
  );
}

/* ---------- 7. Final CTA ---------- */

function FinalCta() {
  return (
    <section
      id="waitlist"
      className="border-t border-[color:var(--color-border)] bg-white"
    >
      <div className="mx-auto max-w-[1200px] px-6 py-24 md:py-28">
        <AnimateOnView>
          <div className="grid grid-cols-1 items-end gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-14">
            <div>
              <h2 className="text-balance text-[34px] font-semibold leading-[1.05] tracking-[-0.02em] text-[color:var(--color-text-strong)] md:text-[48px]">
                Get on the waitlist before the first cohort opens.
              </h2>
              <p className="mt-5 max-w-[60ch] text-[16px] leading-[1.6] text-[color:var(--color-text-muted)]">
                We&apos;re seeding the first 50 startups and 50 investors by hand. Tell us which side you&apos;re on; we&apos;ll send the onboarding link when it&apos;s your turn.
              </p>
            </div>
            <form
              action="#"
              method="post"
              className="flex flex-col gap-3"
              aria-label="Waitlist signup"
            >
              <label className="text-[12px] font-medium text-[color:var(--color-text-strong)]">
                Email
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="you@startup.com"
                  className="mt-1.5 block w-full rounded-[10px] border border-[color:var(--color-border-strong)] bg-white px-3.5 py-2.5 text-[14px] text-[color:var(--color-text-strong)] placeholder:text-[color:var(--color-text-faint)] focus:border-[color:var(--color-brand)]"
                />
              </label>
              <fieldset className="grid grid-cols-2 gap-2">
                <legend className="sr-only">I am a</legend>
                <RadioPill name="role" value="founder" label="Founder" defaultChecked />
                <RadioPill name="role" value="investor" label="Investor" />
              </fieldset>
              <button
                type="submit"
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-[10px] bg-[color:var(--color-text-strong)] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-black"
              >
                Request early access
                <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
              </button>
              <p className="text-[12px] leading-[1.5] text-[color:var(--color-text-faint)]">
                We&apos;ll email you the onboarding link. No newsletter, no spam.
              </p>
            </form>
          </div>
        </AnimateOnView>
      </div>
    </section>
  );
}

function RadioPill({
  name,
  value,
  label,
  defaultChecked,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="relative flex cursor-pointer items-center justify-center rounded-[10px] border border-[color:var(--color-border-strong)] bg-white px-3 py-2 text-[13px] font-medium text-[color:var(--color-text-strong)] transition-colors has-[:checked]:border-[color:var(--color-brand)] has-[:checked]:bg-[color:var(--color-brand-tint)] has-[:checked]:text-[color:var(--color-brand-strong)]">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="sr-only"
      />
      {label}
    </label>
  );
}

/* ---------- 8. Footer ---------- */

function Footer() {
  return (
    <footer className="border-t border-[color:var(--color-border)] bg-[color:var(--color-bg)]">
      <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-6 px-6 py-12 md:flex-row md:items-center">
        <Wordmark size="sm" />
        <p className="text-[12px] text-[color:var(--color-text-faint)]">
          © {new Date().getFullYear()} VentraMatch. Informational only. Not investment advice.
        </p>
        <a
          href="https://github.com/abhijandyala/ventramatch"
          className="text-[13px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-strong)]"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}
