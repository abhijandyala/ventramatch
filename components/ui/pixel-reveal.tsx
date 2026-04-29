"use client";

import { useRef, useEffect, useState } from "react";
import { gsap } from "gsap";

const GREEN_PALETTE = [
  "#16a34a", "#22c55e", "#15803d", "#4ade80", "#166534",
  "#86efac", "#bbf7d0", "#dcfce7", "#14532d", "#059669",
  "#34d399", "#10b981", "#047857", "#a7f3d0", "#6ee7b7",
];

export function PixelReveal() {
  const pixelRef = useRef<HTMLDivElement>(null);
  const [shouldPlay, setShouldPlay] = useState(false);
  const [done, setDone] = useState(false);
  const gridSize = 50;

  useEffect(() => {
    try {
      if (sessionStorage.getItem("vm:pixel-reveal") === "1") {
        sessionStorage.removeItem("vm:pixel-reveal");
        setShouldPlay(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!shouldPlay) return;
    const el = pixelRef.current;
    if (!el) return;

    el.innerHTML = "";
    const size = 100 / gridSize;

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const pixel = document.createElement("div");
        pixel.style.cssText = `
          position:absolute;
          opacity:1;
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
    const dur = 0.9;
    const stagger = dur / pixels.length;

    // Small delay so the homepage has time to paint underneath
    gsap.delayedCall(0.15, () => {
      gsap.to(pixels, {
        opacity: 0,
        duration: 0.12,
        stagger: { each: stagger, from: "random" },
        onComplete: () => setDone(true),
      });
    });
  }, [shouldPlay]);

  if (!shouldPlay || done) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      <div ref={pixelRef} className="absolute inset-0" />
    </div>
  );
}
