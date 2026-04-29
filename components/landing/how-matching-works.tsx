import { Reveal } from "@/components/landing/reveal";
import { MediaSlot } from "@/components/landing/media-slot";

/**
 * HowMatchingWorks — three-step explainer.
 *
 * One big motion-graphic slot at the top (Slot D), three columns below.
 */

const STEPS = [
  {
    n: "01",
    title: "Build one structured profile.",
    body:
      "Founders describe their startup. Investors describe their thesis. Same five filters on both sides: sector, stage, check size, geography, traction.",
  },
  {
    n: "02",
    title: "We score the fit, openly.",
    body:
      "Every match shows the percentage and a one-line reason. The exact formula lives in the repo — not a black box.",
  },
  {
    n: "03",
    title: "Mutual interest unlocks contact.",
    body:
      "Either side can see the other; neither can message until both click interested. Founders never see who passed; investors never get unsolicited inbound.",
  },
];

export function HowMatchingWorks() {
  return (
    <section className="border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]">
      <div className="mx-auto max-w-[1280px] px-6 py-24 md:py-32">
        <div className="mx-auto max-w-[60ch] text-center">
          <Reveal>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
              The flow
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h2
              className="mt-5 text-balance font-semibold text-[color:var(--color-text-strong)]"
              style={{
                fontSize: "var(--type-h1)",
                letterSpacing: "var(--tracking-h1)",
                lineHeight: 1.05,
              }}
            >
              Three steps. No spreadsheets.
            </h2>
          </Reveal>
        </div>

        {/* Big media slot — wide aspect, 8:3 */}
        <Reveal delay={160}>
          <div className="mt-16 mx-auto w-full max-w-[1100px]">
            <MediaSlot slot="matchLoop" />
          </div>
        </Reveal>

        {/* Three steps */}
        <div className="mt-16 grid grid-cols-1 gap-12 md:mt-20 md:grid-cols-3 md:gap-10 lg:gap-14">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 100}>
              <div>
                <p className="font-mono text-[14px] font-semibold tabular-nums text-[color:var(--color-brand)]">
                  {step.n}
                </p>
                <h3
                  className="mt-3 font-semibold tracking-[-0.01em] text-[color:var(--color-text-strong)]"
                  style={{ fontSize: "var(--type-h3)", lineHeight: 1.2 }}
                >
                  {step.title}
                </h3>
                <p className="mt-3 text-[15px] leading-[1.6] text-[color:var(--color-text-muted)]">
                  {step.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
