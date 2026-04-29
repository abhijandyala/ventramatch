import { Reveal } from "@/components/landing/reveal";
import { MediaSlot } from "@/components/landing/media-slot";
import type { MediaSlotId } from "@/lib/landing/media";

/**
 * FiveInputs — the algorithm, made readable.
 *
 * Five horizontal rows, each: index + field name + weight % + paragraph
 * + media slot (square Lottie / video). Sized by their actual weight in
 * the formula (lib/matching/score.ts). No card grid; no pseudo-chart.
 * Just five real things, intentionally heavy.
 */

type Input = {
  index: string;
  name: string;
  weight: string;
  weightPct: number;
  body: string;
  slot: MediaSlotId;
};

const INPUTS: Input[] = [
  {
    index: "01",
    name: "Sector",
    weight: "30%",
    weightPct: 30,
    body:
      "Investor sectors versus startup industry. Exact match scores 1.0; we add curated synonyms in v1.1. The biggest single signal — most early-stage investors will not write outside their declared categories.",
    slot: "inputSector",
  },
  {
    index: "02",
    name: "Stage",
    weight: "25%",
    weightPct: 25,
    body:
      "Pre-seed, seed, Series A, Series B+. The investor must explicitly back the stage; no fuzzy guessing. A pre-seed founder pitching a Series B fund is the most common kind of wasted email.",
    slot: "inputStage",
  },
  {
    index: "03",
    name: "Check size",
    weight: "20%",
    weightPct: 20,
    body:
      "Inside the investor's stated band scores 1.0. Outside the band falls off linearly toward 0. A $50K angel and a $5M lead are both wrong-fit for the wrong raise size, even if every other input lines up.",
    slot: "inputCheck",
  },
  {
    index: "04",
    name: "Geography",
    weight: "15%",
    weightPct: 15,
    body:
      "Soft signal. In-market scores 1.0; out-of-market still scores 0.4 because angels often go remote. Weighted lower than the harder filters because geography binds less than people think it does.",
    slot: "inputGeography",
  },
  {
    index: "05",
    name: "Traction",
    weight: "10%",
    weightPct: 10,
    body:
      "Self-reported text length is the v1 stub. v1.1 parses MRR, paying customers, and pilots into normalized signal. Lowest weight on purpose: traction is the easiest input to fake on a profile.",
    slot: "inputTraction",
  },
];

export function FiveInputs() {
  return (
    <section
      id="how"
      className="border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]"
    >
      <div className="mx-auto max-w-[1280px] px-6 py-24 md:py-32">
        {/* Section header */}
        <div className="mx-auto max-w-[60ch] text-center">
          <Reveal>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
              The algorithm
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
              Five inputs. One score. Always shown.
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p
              className="mt-5 text-pretty text-[color:var(--color-text-muted)]"
              style={{ fontSize: "var(--type-body-lg)", lineHeight: 1.55 }}
            >
              Match scores are a weighted sum, not a black-box ranking. The
              exact formula is open in the repo at{" "}
              <code className="rounded bg-[color:var(--color-surface)] px-1.5 py-0.5 font-mono text-[13px] font-medium text-[color:var(--color-text-strong)] border border-[color:var(--color-border)]">
                lib/matching/score.ts
              </code>
              .
            </p>
          </Reveal>
        </div>

        {/* Five rows */}
        <ul className="mt-20 divide-y divide-[color:var(--color-border)] border-y border-[color:var(--color-border)]">
          {INPUTS.map((input, i) => (
            <li key={input.index}>
              <Reveal delay={i * 80} className="block">
                <Row {...input} />
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Row({ index, name, weight, body, slot }: Input) {
  return (
    <div className="grid grid-cols-1 gap-8 px-1 py-12 md:grid-cols-[80px_minmax(0,1fr)_minmax(220px,300px)] md:gap-10 md:py-14 lg:gap-14 lg:py-16">
      {/* Number + weight column */}
      <div className="flex flex-row items-baseline justify-between md:flex-col md:items-start md:gap-3">
        <span className="font-mono text-[14px] font-semibold tabular-nums text-[color:var(--color-text-faint)]">
          {index}
        </span>
        <span className="font-mono text-[18px] font-semibold tabular-nums text-[color:var(--color-brand)] md:text-[22px]">
          {weight}
        </span>
      </div>

      {/* Name + body */}
      <div>
        <h3
          className="font-semibold tracking-[-0.012em] text-[color:var(--color-text-strong)]"
          style={{ fontSize: "var(--type-h2)", lineHeight: 1.05 }}
        >
          {name}
        </h3>
        <p className="mt-5 max-w-[60ch] text-[16px] leading-[1.65] text-[color:var(--color-text-muted)]">
          {body}
        </p>
      </div>

      {/* Media slot — square */}
      <div className="w-full md:max-w-[300px] md:justify-self-end">
        <MediaSlot slot={slot} />
      </div>
    </div>
  );
}
