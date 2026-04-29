import { cn } from "@/lib/utils";

// Exact wording mandated by docs/legal.md and docs/matching-algorithm.md.
// Do not edit without updating both. Every surface that displays a match
// score must render this line.
export const DISCLAIMER_TEXT =
  "Informational only. Not investment advice. Match scores reflect publicly stated investor preferences and self-reported startup data.";

type DisclaimerProps = {
  className?: string;
};

export function Disclaimer({ className }: DisclaimerProps) {
  return (
    <p
      className={cn(
        "text-[12px] leading-4 font-medium tracking-[0.01em]",
        "text-[var(--color-text-faint)]",
        className,
      )}
    >
      {DISCLAIMER_TEXT}
    </p>
  );
}
