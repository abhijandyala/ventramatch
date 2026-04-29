import { Reveal } from "@/components/landing/reveal";

/**
 * SourceTicker — small horizontal credibility strip directly under the hero.
 *
 * Static row of public data sources used in our research. NOT a marquee,
 * NOT auto-rotating — the anti-vibecoded spec is explicit that animated
 * carousels harm comprehension.
 */

const SOURCES = [
  "Crunchbase",
  "PitchBook",
  "AngelList",
  "OpenVC",
  "SEC EDGAR",
  "Carta",
];

export function SourceTicker() {
  return (
    <section className="border-y border-[color:var(--color-border)]/60 bg-[color:var(--color-bg)]">
      <div className="mx-auto max-w-[1280px] px-6 py-7">
        <Reveal>
          <div className="flex flex-col items-center gap-5 text-center md:flex-row md:items-center md:justify-between md:gap-8 md:text-left">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-text-faint)]">
              Built around the same five inputs every angel and micro-VC actually filters on
            </p>
            <ul className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 md:justify-end">
              {SOURCES.map((s) => (
                <li
                  key={s}
                  className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[color:var(--color-text-muted)]"
                >
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
