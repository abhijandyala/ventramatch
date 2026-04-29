import { Reveal } from "@/components/landing/reveal";

/**
 * ComplianceStrip — short factual band stating the legal posture.
 *
 * Four lines, two-up grid on desktop. No motion. No icons besides a single
 * brand-green dot before each line.
 */

const ITEMS = [
  {
    title: "Not investment advice.",
    body:
      "Match scores are a fit signal derived from publicly stated investor preferences and self-reported startup data. We don't rank investors as recommendations.",
  },
  {
    title: "No success fees.",
    body:
      "We charge for software access only. We are not a broker-dealer and we never sit between any transaction.",
  },
  {
    title: "Both sides verified.",
    body:
      "Email and identity checks before mutual unlock. Trust labels distinguish identity-verified from metrics-self-reported.",
  },
  {
    title: "SOC 2 Type II in flight.",
    body:
      "Encryption at rest and in transit by default. Privacy stack covers GDPR, UK GDPR, CCPA / CPRA, LGPD, DPDP, PDPA, and Australia's Privacy Act.",
  },
];

export function ComplianceStrip() {
  return (
    <section
      id="compliance"
      className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
    >
      <div className="mx-auto max-w-[1280px] px-6 py-20 md:py-24">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
          <div>
            <Reveal>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
                Compliance posture
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h2
                className="mt-5 max-w-[18ch] text-balance font-semibold tracking-[-0.012em] text-[color:var(--color-text-strong)]"
                style={{ fontSize: "var(--type-h2)", lineHeight: 1.1 }}
              >
                Built so the SEC isn't a question.
              </h2>
            </Reveal>
            <Reveal delay={140}>
              <p className="mt-5 max-w-[44ch] text-[15px] leading-[1.65] text-[color:var(--color-text-muted)]">
                The product is a venue, not a broker. Every match surface
                carries an informational-only disclaimer.
              </p>
            </Reveal>
          </div>

          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            {ITEMS.map((item, i) => (
              <Reveal key={item.title} delay={i * 60} as="li">
                <div className="rounded-[14px] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] p-6">
                  <div className="flex items-start gap-3">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--color-brand)]" />
                    <p className="text-[16px] font-semibold leading-snug text-[color:var(--color-text-strong)]">
                      {item.title}
                    </p>
                  </div>
                  <p className="mt-3 pl-[18px] text-[14px] leading-[1.6] text-[color:var(--color-text-muted)]">
                    {item.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
