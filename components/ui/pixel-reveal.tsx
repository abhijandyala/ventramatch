"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { gsap } from "gsap";

const GREEN_PALETTE = [
  "#16a34a", "#22c55e", "#15803d", "#4ade80", "#166534",
  "#86efac", "#bbf7d0", "#dcfce7", "#14532d", "#059669",
  "#34d399", "#10b981", "#047857", "#a7f3d0", "#6ee7b7",
];

const GRID_SIZE = 50;

type Pixel = {
  key: string;
  color: string;
  left: number;
  top: number;
  size: number;
};

function generatePixels(): Pixel[] {
  const out: Pixel[] = [];
  const size = 100 / GRID_SIZE;
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      out.push({
        key: `${row}-${col}`,
        color: GREEN_PALETTE[Math.floor(Math.random() * GREEN_PALETTE.length)],
        left: col * size,
        top: row * size,
        size: size + 0.2,
      });
    }
  }
  return out;
}

export function PixelReveal() {
  // Lazy init: synchronously read sessionStorage on first client render so
  // pixels paint on first frame before any useEffect runs. SSR returns false.
  const [shouldPlay] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const flag = sessionStorage.getItem("vm:pixel-reveal") === "1";
      if (flag) sessionStorage.removeItem("vm:pixel-reveal");
      return flag;
    } catch {
      return false;
    }
  });

  const [done, setDone] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate pixels once, only when we're going to play
  const pixels = useMemo(() => (shouldPlay ? generatePixels() : []), [shouldPlay]);

  useEffect(() => {
    if (!shouldPlay) return;
    const el = containerRef.current;
    if (!el) return;

    const pixelEls = el.querySelectorAll<HTMLDivElement>("[data-p]");
    if (!pixelEls.length) return;

    // Dissolve out, randomly staggered
    const dur = 0.9;
    const stagger = dur / pixelEls.length;

    // Brief hold so the homepage has time to paint underneath, then dissolve
    gsap.delayedCall(0.25, () => {
      gsap.to(pixelEls, {
        opacity: 0,
        duration: 0.14,
        stagger: { each: stagger, from: "random" },
        onComplete: () => setDone(true),
      });
    });
  }, [shouldPlay]);

  if (!shouldPlay || done) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      <div ref={containerRef} className="absolute inset-0">
        {pixels.map((p) => (
          <div
            key={p.key}
            data-p="1"
            style={{
              position: "absolute",
              background: p.color,
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.size}%`,
              height: `${p.size}%`,
              opacity: 1,
            }}
          />
        ))}
      </div>
    </div>
  );
}
