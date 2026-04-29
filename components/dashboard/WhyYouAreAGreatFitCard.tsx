import { Check } from "lucide-react";
import { Disclaimer } from "@/components/common/Disclaimer";

type WhyYouAreAGreatFitCardProps = {
  bullets: string[];
};

export function WhyYouAreAGreatFitCard({ bullets }: WhyYouAreAGreatFitCardProps) {
  return (
    <section
      aria-labelledby="why-fit-title"
      className="rounded-none border border-[var(--color-border)] bg-[var(--color-surface)] p-6 flex flex-col h-full"
    >
      <header className="flex items-baseline justify-between">
        <h3
          id="why-fit-title"
          className="text-[14px] leading-5 font-semibold tracking-tight text-[var(--color-text)]"
        >
          Why you&apos;re a great fit
        </h3>
      </header>

      <ul className="mt-4 flex flex-col gap-3 flex-1">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2.5 text-[13px] leading-5">
            <Check
              aria-hidden
              size={14}
              strokeWidth={2}
              className="mt-0.5 shrink-0 text-[var(--color-success)]"
            />
            <span className="text-[var(--color-text)]">{bullet}</span>
          </li>
        ))}
      </ul>

      <Disclaimer className="mt-5" />
    </section>
  );
}
