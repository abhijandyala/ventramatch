/**
 * VentraMatch landing-page media registry.
 *
 * Single source of truth for every media slot on the landing page. Each entry
 * describes the asset spec; flip `ready: true` once the file lives at the
 * declared `src` (and `poster` for video). The MediaSlot component reads from
 * here and renders either the labeled placeholder or the real asset.
 *
 * Conventions:
 *   - All media lives under /public/media/...
 *   - Videos: H.264 MP4 + VP9 WebM, no audio, ≤ 4 MB each
 *   - Lottie: JSON ≤ 200 KB, 30 fps
 *   - Posters: JPG ≤ 200 KB, same aspect as the video
 *   - Aspect ratios are CSS values (e.g. "16/9", "1/1", "8/3")
 *
 * Brand: assets must use the locked palette
 *   #0F172A text · #111827 dark · #6B7280 muted · #E5E7EB borders
 *   #16A34A brand · #22C55E brand-soft · #3B82F6 info · #F9FAFB / #FFFFFF surfaces
 *   No purple, no gradient blobs, no pink.
 */

export type MediaSlotKind = "video" | "lottie" | "image";

export type MediaSlotSpec = {
  /** Stable, human-readable identifier shown on the placeholder card. */
  id: string;
  /** Section the slot lives in (purely informational). */
  section: string;
  /** Type of asset expected. */
  kind: MediaSlotKind;
  /** Where the asset will live in /public/. */
  src: string;
  /** Optional poster image (only for video). */
  poster?: string;
  /** Optional WebM source (only for video) for better compression. */
  srcWebm?: string;
  /** CSS aspect ratio, e.g. "16/9". */
  aspect: string;
  /** Loop length (in seconds), if applicable. */
  durationSec?: number;
  /** Short, designer-facing brief on what to make. */
  brief: string;
  /** Set to true once the asset is in place at the declared paths. */
  ready: boolean;
  /** Optional caption for accessibility (screen readers). */
  caption?: string;
};

export const mediaSlots = {
  /* ---------- Hero (Slot A) ---------- */
  hero: {
    id: "A",
    section: "Hero",
    kind: "video",
    src: "/media/hero.mp4",
    srcWebm: "/media/hero.webm",
    poster: "/media/hero-poster.jpg",
    aspect: "16/9",
    durationSec: 10,
    brief:
      "Brand-led ambient loop. Either the wordmark animating into being, or two abstract shapes drifting toward each other and clicking together with a green flash. No fake UI.",
    ready: false,
    caption: "VentraMatch brand identity loop.",
  },

  /* ---------- Five inputs (Slots B1–B5) ---------- */
  inputSector: {
    id: "B1",
    section: "Five inputs · Sector",
    kind: "lottie",
    src: "/media/inputs/sector.json",
    aspect: "1/1",
    durationSec: 5,
    brief:
      "Abstract sorting motif: shapes drifting then snapping into themed clusters. ~5s loop. Brand green as accent.",
    ready: false,
    caption: "Animated illustration of sector matching.",
  },
  inputStage: {
    id: "B2",
    section: "Five inputs · Stage",
    kind: "lottie",
    src: "/media/inputs/stage.json",
    aspect: "1/1",
    durationSec: 5,
    brief:
      "Stage progression: small shape grows through pre-seed → seed → A in cleanly stepped beats. Avoid arrow clichés.",
    ready: false,
    caption: "Animated illustration of stage progression.",
  },
  inputCheck: {
    id: "B3",
    section: "Five inputs · Check size",
    kind: "lottie",
    src: "/media/inputs/check.json",
    aspect: "1/1",
    durationSec: 5,
    brief:
      "A number ticking through values, snapping when it falls inside a labeled band. The band glows briefly green on snap.",
    ready: false,
    caption: "Animated illustration of check-size matching.",
  },
  inputGeography: {
    id: "B4",
    section: "Five inputs · Geography",
    kind: "lottie",
    src: "/media/inputs/geography.json",
    aspect: "1/1",
    durationSec: 5,
    brief:
      "A simple map outline tracing in, with a single point of green emphasis. Calm, no satellite art.",
    ready: false,
    caption: "Animated illustration of geographic match.",
  },
  inputTraction: {
    id: "B5",
    section: "Five inputs · Traction",
    kind: "lottie",
    src: "/media/inputs/traction.json",
    aspect: "1/1",
    durationSec: 5,
    brief:
      "Avoid bar charts. Try: stacked dots accumulating gently into a steady column, with a quiet rhythm.",
    ready: false,
    caption: "Animated illustration of traction signal.",
  },

  /* ---------- Numbers (Slot C, optional) ---------- */
  numbers: {
    id: "C",
    section: "Numbers",
    kind: "video",
    src: "/media/numbers.mp4",
    srcWebm: "/media/numbers.webm",
    poster: "/media/numbers-poster.jpg",
    aspect: "4/3",
    durationSec: 8,
    brief:
      "Optional. Funnel of dots flowing from a 'cold' column to a 'matched' column at different rates. Strictly conceptual.",
    ready: false,
    caption: "Animated funnel illustrating reply-rate gap.",
  },

  /* ---------- How matching works (Slot D) ---------- */
  matchLoop: {
    id: "D",
    section: "How matching works",
    kind: "video",
    src: "/media/match-loop.mp4",
    srcWebm: "/media/match-loop.webm",
    poster: "/media/match-loop-poster.jpg",
    aspect: "8/3",
    durationSec: 8,
    brief:
      "Two columns of small dots (founders left, investors right). Connection lines form on fit; one connection turns green and locks in. Loops cleanly.",
    ready: false,
    caption: "Animated visualization of mutual matching.",
  },

  /* ---------- Profile builder (Slots G, H) ---------- */
  profileBuilderStartup: {
    id: "G",
    section: "How matching works · Step 01 · Startup builder",
    kind: "video",
    src: "/media/profile-builder-startup.mp4",
    srcWebm: "/media/profile-builder-startup.webm",
    poster: "/media/profile-builder-startup-poster.jpg",
    aspect: "1280/832", // matches the source recording, ≈ 1.54
    durationSec: 36,
    brief:
      "Sped-up screen recording of a startup completing the 8-step profile builder at /build.",
    ready: true,
    caption: "Startup profile builder walkthrough.",
  },
  profileBuilderInvestor: {
    id: "H",
    section: "How matching works · Step 01 · Investor builder",
    kind: "video",
    src: "/media/profile-builder-investor.mp4",
    srcWebm: "/media/profile-builder-investor.webm",
    poster: "/media/profile-builder-investor-poster.jpg",
    aspect: "1280/832",
    durationSec: 35,
    brief:
      "Sped-up screen recording of an investor completing the 8-step profile builder at /build/investor.",
    ready: true,
    caption: "Investor profile builder walkthrough.",
  },

  /* ---------- Product vision bento (Slots E, F) ---------- */
  visionReadiness: {
    id: "E",
    section: "Vision · Readiness score",
    kind: "lottie",
    src: "/media/vision/readiness.json",
    aspect: "16/9",
    durationSec: 6,
    brief:
      "Radial dial slowly fills toward a labeled threshold while small chips (deck · traction · timing · fit) tick in around it. Cool restraint, no glow blobs.",
    ready: false,
    caption: "Animated readiness score dial.",
  },
  visionOutreach: {
    id: "F",
    section: "Vision · AI outreach",
    kind: "lottie",
    src: "/media/vision/outreach.json",
    aspect: "4/3",
    durationSec: 6,
    brief:
      "Fragments of investor thesis snap into a draft email outline. Words highlight then fade. No keyboard art, no envelope clichés.",
    ready: false,
    caption: "Animated investor outreach generator.",
  },
} satisfies Record<string, MediaSlotSpec>;

export type MediaSlotId = keyof typeof mediaSlots;
