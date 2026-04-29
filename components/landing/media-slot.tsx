"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { mediaSlots, type MediaSlotId, type MediaSlotSpec } from "@/lib/landing/media";
import { cn } from "@/lib/utils";

// Lottie player is heavy — load it on the client only.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

type Props = {
  /** Which entry from lib/landing/media.ts to render. */
  slot: MediaSlotId;
  /** Extra Tailwind classes applied to the outer wrapper. */
  className?: string;
};

/**
 * MediaSlot is the one place a piece of media is mounted on the landing page.
 *
 * - If the slot is marked `ready: true` in lib/landing/media.ts, MediaSlot
 *   renders the real asset (video / Lottie / image) with the correct chrome.
 * - If the slot is `ready: false`, it renders a labeled placeholder card so
 *   the layout is visibly intentional during build.
 *
 * Behavior contracts (locked):
 *   - Videos autoplay muted, loop forever, play inline, and cannot be paused.
 *   - prefers-reduced-motion: video falls back to its poster, Lottie is paused.
 *   - All slots respect their declared aspect ratio so layout never shifts.
 */
export function MediaSlot({ slot, className }: Props) {
  const spec = mediaSlots[slot];

  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-[var(--radius-md)]", className)}
      style={{ aspectRatio: spec.aspect }}
      role={spec.caption ? "img" : undefined}
      aria-label={spec.caption}
    >
      {spec.ready ? <ReadyAsset spec={spec} /> : <Placeholder spec={spec} />}
    </div>
  );
}

/* ---------- Real asset renderers ---------- */

function ReadyAsset({ spec }: { spec: MediaSlotSpec }) {
  if (spec.kind === "video") return <VideoAsset spec={spec} />;
  if (spec.kind === "lottie") return <LottieAsset spec={spec} />;
  return <ImageAsset spec={spec} />;
}

function VideoAsset({ spec }: { spec: MediaSlotSpec }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  // Locked behavior: cannot pause. If the user (or the OS) pauses, resume.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (reduced) {
      v.pause();
      return;
    }
    const onPause = () => {
      // Avoid recursion if the browser truly cannot resume (e.g. tab hidden).
      if (!document.hidden) {
        const p = v.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      }
    };
    v.addEventListener("pause", onPause);
    return () => v.removeEventListener("pause", onPause);
  }, [reduced]);

  if (reduced && spec.poster) {
    // Reduced-motion → static poster only.
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={spec.poster}
        alt={spec.caption ?? ""}
        className="absolute inset-0 h-full w-full object-cover"
        loading="eager"
        decoding="async"
      />
    );
  }

  return (
    <video
      ref={ref}
      className="absolute inset-0 h-full w-full object-cover"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster={spec.poster}
      disablePictureInPicture
      controlsList="nodownload nofullscreen noplaybackrate noremoteplayback"
    >
      {spec.srcWebm && <source src={spec.srcWebm} type="video/webm" />}
      <source src={spec.src} type="video/mp4" />
    </video>
  );
}

function LottieAsset({ spec }: { spec: MediaSlotSpec }) {
  const [data, setData] = useState<unknown | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    let active = true;
    fetch(spec.src)
      .then((r) => r.json())
      .then((json) => {
        if (active) setData(json);
      })
      .catch(() => {
        // Asset not found — leave data null so we render an unobtrusive blank.
      });
    return () => {
      active = false;
    };
  }, [spec.src]);

  if (!data) return null;

  return (
    <div className="absolute inset-0 h-full w-full">
      <Lottie
        animationData={data}
        autoplay={!reduced}
        loop
        rendererSettings={{ preserveAspectRatio: "xMidYMid slice" }}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}

function ImageAsset({ spec }: { spec: MediaSlotSpec }) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={spec.src}
      alt={spec.caption ?? ""}
      className="absolute inset-0 h-full w-full object-cover"
      loading="eager"
      decoding="async"
    />
  );
}

/* ---------- Placeholder ---------- */

function Placeholder({ spec }: { spec: MediaSlotSpec }) {
  return (
    <div className="slot-placeholder absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex items-center gap-2">
        <span className="rounded-[6px] bg-[color:var(--color-text-strong)] px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white">
          Slot {spec.id}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--color-text-faint)]">
          {spec.kind}
        </span>
      </div>
      <p className="text-[13px] font-medium text-[color:var(--color-text-strong)]">
        {spec.section}
      </p>
      <p className="max-w-[40ch] text-[11px] leading-[1.45] text-[color:var(--color-text-muted)]">
        {spec.brief}
      </p>
      <p className="font-mono text-[10px] text-[color:var(--color-text-faint)]">
        Drop file at <span className="text-[color:var(--color-text-strong)]">{spec.src}</span>
        {spec.poster ? (
          <>
            {" + poster "}
            <span className="text-[color:var(--color-text-strong)]">{spec.poster}</span>
          </>
        ) : null}
        {", then flip "}
        <span className="text-[color:var(--color-text-strong)]">ready: true</span>
        {" in lib/landing/media.ts"}
      </p>
    </div>
  );
}
