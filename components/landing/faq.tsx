import { Reveal } from "@/components/landing/reveal";

/**
 * FAQ — editorial layout, not a generic accordion grid.
 *
 * Left column: a sticky anchor (label + headline) that holds the section in
 * place as the reader scans. Right column: two stacked Q/A lists grouped
 * by audience. Each Q/A is text-only (typography-led, no card chrome) so
 * the section reads like a magazine column rather than a SaaS FAQ.
 *
 * Side-neutral by construction: founders and investors see their own
 * questions, in their own column, on the same page.
 */

const FOUNDER_QA: Array<{ q: string; a: string }> = [
  {
    q: "How is this different from AngelList or OpenVC?",
    a: "Those are databases of investors. We score and gate. You only see investors who match your stage, sector, geography, and check size. They only see you back if it's mutual.",
  },
  {
    q: "Is my pitch deck visible to anyone?",
    a: "No. Profile and deck stay private until an investor saves you and you save them back. No public listing, no search-engine leaks, no \"discoverable by anyone with the link.\"",
  },
  {
    q: "Do you take a cut of my round?",
    a: "Never. We charge for software access only. We are not a broker-dealer and we are not in your cap table.",
  },
  {
    q: "What if I'm not actively raising right now?",
    a: "Profiles persist between rounds. Investors who back your stage can save you and watch monthly updates until you're ready to take meetings.",
  },
];

const INVESTOR_QA: Array<{ q: string; a: string }> = [
  {
    q: "How is the deal flow filtered?",
    a: "By the five things you'd filter on yourself: sector, stage, check size, geography, traction. The score weights them; you set the floor.",
  },
  {
    q: "Is the data on these startups verified?",
    a: "Identity, yes — every founder is verified before activation. Metrics are clearly labeled self-reported until you request a deeper review.",
  },
  {
    q: "Can I pass on a startup without anyone knowing?",
    a: "Yes. Pass is invisible. Founders never see who passed, who scrolled, or how many investors haven't replied.",
  },
  {
    q: "What's the time commitment?",
    a: "About five seconds per card in your inbox. Mutual unlock means you only spend real time on the founders who opted in to you.",
  },
];

export function FAQ() {
  return (
    <section
      id="faq"
      className="border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]"
    >
      <div className="mx-auto max-w-[1280px] px-6 py-24 md:py-32">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] md:gap-16">
          {/* Anchor column — sticky on desktop */}
          <div className="md:sticky md:top-24 md:self-start">
            <Reveal>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
                Common questions
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h2
                className="mt-5 max-w-[16ch] text-balance font-semibold tracking-[-0.014em] text-[color:var(--color-text-strong)]"
                style={{ fontSize: "var(--type-h2)", lineHeight: 1.05 }}
              >
                The same answer, both sides of the table.
              </h2>
            </Reveal>
            <Reveal delay={140}>
              <p className="mt-5 max-w-[44ch] text-[14px] leading-[1.65] text-[color:var(--color-text-muted)]">
                Plain answers. No legal copy, no marketing prose.
              </p>
            </Reveal>
          </div>

          {/* Q/A — two stacked columns by audience */}
          <div className="grid grid-cols-1 gap-x-10 gap-y-12 md:grid-cols-2">
            <QAColumn label="For founders" items={FOUNDER_QA} />
            <QAColumn label="For investors" items={INVESTOR_QA} delayBase={120} />
          </div>
        </div>
      </div>
    </section>
  );
}

function QAColumn({
  label,
  items,
  delayBase = 0,
}: {
  label: string;
  items: Array<{ q: string; a: string }>;
  delayBase?: number;
}) {
  return (
    <div>
      <Reveal delay={delayBase}>
        <p className="border-b border-[color:var(--color-border)] pb-3 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[color:var(--color-text-strong)]">
          {label}
        </p>
      </Reveal>
      <dl className="divide-y divide-[color:var(--color-border)]">
        {items.map((it, i) => (
          <Reveal key={it.q} delay={delayBase + 60 + i * 50} as="div">
            <div className="py-6">
              <dt className="text-[15px] font-semibold leading-[1.4] tracking-[-0.005em] text-[color:var(--color-text-strong)]">
                {it.q}
              </dt>
              <dd className="mt-2 text-[14px] leading-[1.65] text-[color:var(--color-text-muted)]">
                {it.a}
              </dd>
            </div>
          </Reveal>
        ))}
      </dl>
    </div>
  );
}
