import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type WordmarkProps = {
  size?: "sm" | "md" | "lg";
  /** When true, the wordmark is wrapped in a Link to "/". */
  asLink?: boolean;
  /** When false, the V/ logo image is hidden and only the text shows. */
  showMark?: boolean;
  className?: string;
};

const sizeMap = {
  sm: { mark: 22, text: "text-base", gap: "gap-2" },
  md: { mark: 28, text: "text-lg", gap: "gap-2.5" },
  lg: { mark: 36, text: "text-2xl", gap: "gap-3" },
} as const;

/**
 * VentraMatch wordmark with the V/ glyph (logo.png) on the left and the
 * lockup "Ventra" + "match" text on the right. The "match" half is rendered
 * in brand green to mirror the green V mark.
 */
export function Wordmark({
  size = "md",
  asLink = true,
  showMark = true,
  className,
}: WordmarkProps) {
  const s = sizeMap[size];
  const inner = (
    <span className={cn("inline-flex items-center", s.gap, className)}>
      {showMark && (
        // SVG keeps the wordmark crisp at any size and ships ~1KB instead
        // of the 600KB PNG. The /public/logo.png is still around as a
        // fallback for OG images and other contexts that need raster.
        <Image
          src="/logo.svg"
          alt=""
          width={s.mark}
          height={s.mark}
          priority
          className="object-contain"
          style={{ height: s.mark, width: "auto" }}
        />
      )}
      <span
        className={cn(
          "font-semibold tracking-tight leading-none",
          s.text,
          "text-[color:var(--color-text-strong)]",
        )}
      >
        Ventra<span className="text-[color:var(--color-brand)]">match</span>
      </span>
    </span>
  );

  if (!asLink) return inner;
  return (
    <Link href="/" aria-label="VentraMatch home" className="inline-flex items-center">
      {inner}
    </Link>
  );
}
