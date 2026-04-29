"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { gsap } from "gsap";

const GREEN_PALETTE = [
  "#16a34a", "#22c55e", "#15803d", "#4ade80", "#166534",
  "#86efac", "#bbf7d0", "#dcfce7", "#14532d", "#059669",
  "#34d399", "#10b981", "#047857", "#a7f3d0", "#6ee7b7",
];

type Props = {
  onComplete?: () => void;
};

export function ReadyInterstitial({ onComplete }: Props) {
  const [wordIndex, setWordIndex] = useState(-1);
  const pixelRef = useRef<HTMLDivElement>(null);
  const gridSize = 50;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => setWordIndex(0), 300));
    timers.push(setTimeout(() => setWordIndex(1), 800));
    timers.push(setTimeout(() => setWordIndex(2), 1300));

    // Start pixel transition at 2.5s
    timers.push(setTimeout(() => runPixelOut(), 2500));

    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runPixelOut = useCallback(() => {
    const el = pixelRef.current;
    if (!el) return;

    el.innerHTML = "";
    const size = 100 / gridSize;

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const pixel = document.createElement("div");
        pixel.style.cssText = `
          position:absolute;
          opacity:0;
          background:${GREEN_PALETTE[Math.floor(Math.random() * GREEN_PALETTE.length)]};
          width:${size + 0.15}%;
          height:${size + 0.15}%;
          left:${col * size}%;
          top:${row * size}%;
        `;
        pixel.dataset.p = "1";
        el.appendChild(pixel);
      }
    }

    const pixels = el.querySelectorAll<HTMLDivElement>("[data-p]");
    const dur = 0.8;
    const stagger = dur / pixels.length;

    // Fade pixels in — covers the "Ready to MATCH" text
    gsap.to(pixels, {
      opacity: 1,
      duration: 0.12,
      stagger: { each: stagger, from: "random" },
    });

    // Once fully covered, navigate immediately
    gsap.delayedCall(dur, () => {
      if (onComplete) {
        onComplete();
      } else {
        window.location.href = "/homepage";
      }
    });
  }, [onComplete]);

  const words = [
    { text: "Ready", color: "var(--color-text-strong)" },
    { text: "to", color: "var(--color-text-strong)" },
    { text: "MATCH", color: "var(--color-brand)" },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "var(--color-bg)" }}
    >
      <div className="flex items-baseline gap-4">
        {words.map((word, i) => (
          <span
            key={word.text}
            className="transition-all duration-500 ease-out"
            style={{
              fontSize: word.text === "MATCH" ? "clamp(56px, 8vw, 96px)" : "clamp(44px, 6vw, 72px)",
              fontWeight: word.text === "MATCH" ? 800 : 600,
              fontFamily: "var(--font-serif, Georgia, serif)",
              letterSpacing: word.text === "MATCH" ? "-0.02em" : "-0.015em",
              color: word.color,
              opacity: wordIndex >= i ? 1 : 0,
              transform: wordIndex >= i ? "translateY(0)" : "translateY(24px)",
            }}
          >
            {word.text}
          </span>
        ))}
      </div>

      {/* Pixel layer — fills in on top then navigates away */}
      <div ref={pixelRef} className="pointer-events-none absolute inset-0 z-10" />
    </div>
  );
}
