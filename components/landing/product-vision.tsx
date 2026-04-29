import type { ReactNode } from "react";
import { Reveal } from "@/components/landing/reveal";
import { MediaSlot } from "@/components/landing/media-slot";

/**
 * ProductVision — asymmetric bento that maps the post-MVP roadmap.
 *
 * Layout intent (the opposite of "six identical icon cards"):
 *   - 12-column grid, three rows: 7+5, 4+8, 5+7
 *   - Mixed surfaces (white / surface-2) so neighbors never look the same
 *   - Index numbers appear on some cards, audience tags on others
 *   - Two cards host real media slots; three host bespoke in-card visuals;
 *     one is text-only and split internally — every card has its own logic
 *
 * Side-neutral copy throughout.
 */

export function ProductVision() {
  return (
    <section
      id="vision"
      className="border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]"
    >
      <div className="mx-auto max-w-[1280px] px-6 py-24 md:py-32">
        {/* ---------- Section head ---------- */}
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
          <div>
            <Reveal>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
                Where this is going
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h2
                className="mt-5 max-w-[15ch] text-balance font-semibold tracking-[-0.014em] text-[color:var(--color-text-strong)]"
                style={{ fontSize: "var(--type-h2)", lineHeight: 1.05 }}
              >
                The match is the start, not the product.
              </h2>
            </Reveal>
          </div>
          <Reveal delay={140}>
            <p className="max-w-[54ch] text-[15px] leading-[1.65] text-[color:var(--color-text-muted)] md:pt-2">
              Once founders and investors find each other, the work begins.
              VentraMatch is shipping the layer that traditional databases
              skip: readiness, deal memos, outreach, and the room itself.
            </p>
          </Reveal>
        </div>

        {/* ---------- Asymmetric bento ---------- */}
        <div className="mt-16 grid grid-cols-1 gap-4 md:mt-20 md:grid-cols-12">
          {/* Card 1 · Readiness score · 7-wide · media slot E */}
          <Reveal as="div" className="md:col-span-7">
            <article className="group relative flex h-full flex-col overflow-hidden rounded-[18px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 md:p-8">
              <CardIndex n="01" />
              <h3 className="mt-2 max-w-[22ch] text-[22px] font-semibold leading-[1.15] tracking-[-0.012em] text-[color:var(--color-text-strong)] md:text-[24px]">
                Fundraising readiness score
              </h3>
              <p className="mt-3 max-w-[44ch] text-[14px] leading-[1.6] text-[color:var(--color-text-muted)]">
                A pre-flight check before you waste an investor&apos;s time.
                Deck quality, traction signal, market timing, founder–market
                fit — surfaced before you click send.
              </p>
              <div className="mt-7 flex-1">
                <MediaSlot slot="visionReadiness" className="rounded-[12px]" />
              </div>
            </article>
          </Reveal>

          {/* Card 2 · AI deal memo · 5-wide · in-card mock */}
          <Reveal delay={60} as="div" className="md:col-span-5">
            <article className="relative flex h-full flex-col rounded-[18px] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-6 md:p-8">
              <CardIndex n="02" />
              <h3 className="mt-2 max-w-[18ch] text-[22px] font-semibold leading-[1.15] tracking-[-0.012em] text-[color:var(--color-text-strong)]">
                AI deal memo
              </h3>
              <p className="mt-3 text-[14px] leading-[1.6] text-[color:var(--color-text-muted)]">
                Every startup profile becomes a one-page memo: problem,
                solution, market, traction, risks, why now.
              </p>
              <div className="mt-7 flex-1">
                <DealMemoMock />
              </div>
            </article>
          </Reveal>

          {/* Card 3 · Investor pipeline · 4-wide · in-card mock */}
          <Reveal delay={120} as="div" className="md:col-span-4">
            <article className="relative flex h-full flex-col rounded-[18px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 md:p-8">
              <AudienceTag>founder side</AudienceTag>
              <h3 className="mt-3 text-[20px] font-semibold leading-[1.18] tracking-[-0.012em] text-[color:var(--color-text-strong)]">
                Investor pipeline
              </h3>
              <p className="mt-3 text-[14px] leading-[1.6] text-[color:var(--color-text-muted)]">
                Status tracking for every conversation. The spreadsheet, retired.
              </p>
              <div className="mt-6 flex-1">
                <PipelineMock />
              </div>
            </article>
          </Reveal>

          {/* Card 4 · Outreach · 8-wide · split layout w/ media slot F */}
          <Reveal delay={180} as="div" className="md:col-span-8">
            <article className="relative h-full overflow-hidden rounded-[18px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 md:p-8">
              <CardIndex n="04" />
              <div className="mt-2 grid gap-7 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-center md:gap-10">
                <div>
                  <h3 className="max-w-[22ch] text-[22px] font-semibold leading-[1.15] tracking-[-0.012em] text-[color:var(--color-text-strong)]">
                    Outreach grounded in their thesis.
                  </h3>
                  <p className="mt-3 text-[14px] leading-[1.6] text-[color:var(--color-text-muted)]">
                    Personalized intros built from each investor&apos;s stated
                    focus and recent checks. Specific — not &ldquo;Dear Sir or
                    Madam.&rdquo;
                  </p>
                </div>
                <MediaSlot slot="visionOutreach" className="rounded-[12px]" />
              </div>
            </article>
          </Reveal>

          {/* Card 5 · Data rooms · 5-wide · in-card mock */}
          <Reveal delay={240} as="div" className="md:col-span-5">
            <article className="relative flex h-full flex-col rounded-[18px] border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] p-6 md:p-8">
              <AudienceTag>both sides</AudienceTag>
              <h3 className="mt-3 max-w-[20ch] text-[20px] font-semibold leading-[1.18] tracking-[-0.012em] text-[color:var(--color-text-strong)]">
                Data rooms with a verifiable audit trail.
              </h3>
              <p className="mt-3 text-[14px] leading-[1.6] text-[color:var(--color-text-muted)]">
                Scoped uploads, time-bound access, and a log of every viewer.
              </p>
              <div className="mt-6 flex-1">
                <FilesMock />
              </div>
            </article>
          </Reveal>

          {/* Card 6 · Demo days + investor updates · 7-wide · text-only split */}
          <Reveal delay={300} as="div" className="md:col-span-7">
            <article className="relative flex h-full flex-col rounded-[18px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 md:p-8">
              <CardIndex n="06" />
              <div className="mt-2 grid gap-6 md:grid-cols-2 md:gap-8">
                <div>
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
                    Demo days
                  </p>
                  <h3 className="mt-2 text-[18px] font-semibold leading-[1.22] tracking-[-0.01em] text-[color:var(--color-text-strong)]">
                    Curated cohorts to scan in one session.
                  </h3>
                </div>
                <div className="md:border-l md:border-[color:var(--color-border)] md:pl-8">
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
                    Investor updates
                  </p>
                  <h3 className="mt-2 text-[18px] font-semibold leading-[1.22] tracking-[-0.01em] text-[color:var(--color-text-strong)]">
                    Ship monthly progress to the people watching.
                  </h3>
                </div>
              </div>
              <p className="mt-7 max-w-[60ch] text-[14px] leading-[1.6] text-[color:var(--color-text-muted)]">
                Many investors track founders for two or three quarters before
                they commit. We make that loop one click for both sides.
              </p>
            </article>
          </Reveal>
        </div>

        {/* ---------- Footnote ---------- */}
        <Reveal delay={120}>
          <p className="mt-12 max-w-[64ch] text-[13px] leading-[1.65] text-[color:var(--color-text-faint)]">
            Roadmap, not promises. Order and scope shift with what founders
            and investors actually use.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Internal primitives ---------------- */

function CardIndex({ n }: { n: string }) {
  return (
    <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[color:var(--color-text-faint)]">
      {n}
    </span>
  );
}

function AudienceTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
      <span className="h-1 w-1 rounded-full bg-[color:var(--color-brand)]" />
      {children}
    </span>
  );
}

/* ---------------- In-card visual mocks (no fake product UI) ---------------- */

function DealMemoMock() {
  // Three labeled sections of greyed text-line scaffolding. Reads as "structure
  // of a memo" without pretending to be a real screenshot.
  const sections: Array<{ label: string; widths: number[] }> = [
    { label: "Problem", widths: [100, 86, 64] },
    { label: "Market", widths: [100, 72] },
    { label: "Traction", widths: [92, 58] },
  ];
  return (
    <div className="rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3.5">
      {sections.map((s, i) => (
        <div
          key={s.label}
          className={
            i === 0
              ? ""
              : "mt-3 border-t border-[color:var(--color-border)] pt-3"
          }
        >
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[color:var(--color-text-faint)]">
            {s.label}
          </p>
          <div className="mt-1.5 space-y-1.5">
            {s.widths.map((w, j) => (
              <div
                key={j}
                className="h-1.5 rounded-sm bg-[color:var(--color-border)]"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PipelineMock() {
  const stages = [
    { label: "Saved", count: 24, on: true },
    { label: "Replied", count: 8, on: true },
    { label: "Meeting", count: 3, on: true },
    { label: "Term sheet", count: 1, on: true },
    { label: "Passed", count: 5, on: false },
  ];
  return (
    <ul className="space-y-1.5">
      {stages.map((s) => (
        <li
          key={s.label}
          className="flex items-center justify-between rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1.5"
        >
          <span className="flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                s.on
                  ? "bg-[color:var(--color-brand)]"
                  : "bg-[color:var(--color-border-strong)]"
              }`}
            />
            <span className="text-[12px] font-medium text-[color:var(--color-text-strong)]">
              {s.label}
            </span>
          </span>
          <span className="font-mono text-[11px] text-[color:var(--color-text-muted)]">
            {s.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

function FilesMock() {
  const files = [
    { name: "deck-q1.pdf", size: "2.4 MB", views: 7 },
    { name: "financials.xlsx", size: "184 KB", views: 4 },
    { name: "cap-table.pdf", size: "94 KB", views: 2 },
  ];
  return (
    <ul className="space-y-1.5">
      {files.map((f) => (
        <li
          key={f.name}
          className="flex items-center justify-between rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1.5"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="h-3.5 w-3.5 shrink-0 rounded-[2px] border border-[color:var(--color-border-strong)] bg-[color:var(--color-bg)]"
            />
            <span className="truncate font-mono text-[11px] text-[color:var(--color-text-strong)]">
              {f.name}
            </span>
          </span>
          <span className="ml-3 shrink-0 font-mono text-[10px] text-[color:var(--color-text-faint)]">
            {f.size} · {f.views} views
          </span>
        </li>
      ))}
    </ul>
  );
}
