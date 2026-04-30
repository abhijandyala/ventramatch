import Image from "next/image";
import {
  avatarInitials,
  avatarPaletteFor,
} from "@/lib/profile/avatar";

/**
 * Server-renderable user avatar.
 *
 * Pure presentational. The caller is responsible for resolving `src` —
 * use `lib/profile/avatar.ts → resolveAvatarUrl()` upstream where you
 * fetch user data, then pass the URL in here.
 *
 * When src is null we render a deterministic-color initials circle.
 * Same userId always picks the same colour, so the same person looks
 * consistent across feed cards, intro cards, and the nav dropdown.
 *
 * Sizes (all square; pixel values match Next/Image sizes prop):
 *   xs = 24
 *   sm = 32
 *   md = 40
 *   lg = 64
 *   xl = 96
 */

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 64,
  xl: 96,
};

const FONT_PX: Record<AvatarSize, number> = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 22,
  xl: 32,
};

export function Avatar({
  id,
  name,
  src,
  size = "md",
  className,
}: {
  /** Stable id; used for deterministic initials-fallback colour. */
  id: string;
  /** Display name. First + last initial used in fallback. */
  name: string | null;
  /** Resolved image URL (uploaded or OAuth). null → initials. */
  src?: string | null;
  size?: AvatarSize;
  /** Extra classes applied to the outer wrapper, e.g. "ring-2". */
  className?: string;
}) {
  const px = SIZE_PX[size];
  const fontPx = FONT_PX[size];

  if (src) {
    // Real image. Wrap in a square so PNG/JPG/WebP all crop the same way.
    return (
      <span
        aria-label={name ? `${name}'s avatar` : "User avatar"}
        className={[
          "relative inline-block shrink-0 overflow-hidden rounded-full bg-[var(--color-surface)]",
          className ?? "",
        ].join(" ")}
        style={{ width: px, height: px }}
      >
        <Image
          src={src}
          alt={name ? `${name}'s avatar` : ""}
          width={px}
          height={px}
          className="h-full w-full object-cover"
          // Avatars are short URLs and we manage caching at the storage
          // layer (24h presigned + uuid in key). Disabling Next's image
          // optimisation here avoids spinning up the optimiser for what
          // is already a small, pre-sized asset.
          unoptimized
        />
      </span>
    );
  }

  // Initials fallback.
  const initials = avatarInitials(name);
  const palette = avatarPaletteFor(id || initials);
  return (
    <span
      role="img"
      aria-label={name ? `${name}'s avatar` : "User avatar"}
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none",
        className ?? "",
      ].join(" ")}
      style={{
        width: px,
        height: px,
        background: palette.bg,
        color: palette.fg,
        fontSize: fontPx,
        letterSpacing: "0.01em",
      }}
    >
      {initials}
    </span>
  );
}
