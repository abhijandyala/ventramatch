"use client";

import React, { useRef, useEffect, useState } from "react";
import { gsap } from "gsap";

const GREEN_PALETTE = [
  "#16a34a", "#22c55e", "#15803d", "#4ade80", "#166534",
  "#86efac", "#bbf7d0", "#dcfce7", "#14532d", "#059669",
  "#34d399", "#10b981", "#047857", "#a7f3d0", "#6ee7b7",
];

function randomGreen() {
  return GREEN_PALETTE[Math.floor(Math.random() * GREEN_PALETTE.length)];
}

type Props = {
  firstContent: React.ReactNode;
  secondContent: React.ReactNode;
  gridSize?: number;
  animationStepDuration?: number;
  trigger?: boolean;
  onTransitionComplete?: () => void;
};

export default function PixelTransition({
  firstContent,
  secondContent,
  gridSize = 50,
  animationStepDuration = 1.2,
  trigger = false,
  onTransitionComplete,
}: Props) {
  const pixelGridRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const [hasTransitioned, setHasTransitioned] = useState(false);

  useEffect(() => {
    const el = pixelGridRef.current;
    if (!el) return;
    el.innerHTML = "";

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const pixel = document.createElement("div");
        pixel.style.position = "absolute";
        pixel.style.opacity = "0";
        pixel.style.backgroundColor = randomGreen();
        const size = 100 / gridSize;
        pixel.style.width = `${size + 0.1}%`;
        pixel.style.height = `${size + 0.1}%`;
        pixel.style.left = `${col * size}%`;
        pixel.style.top = `${row * size}%`;
        pixel.dataset.pixel = "true";
        el.appendChild(pixel);
      }
    }
  }, [gridSize]);

  useEffect(() => {
    if (!trigger || hasTransitioned) return;

    const el = pixelGridRef.current;
    const activeEl = activeRef.current;
    if (!el || !activeEl) return;

    const pixels = el.querySelectorAll<HTMLDivElement>("[data-pixel]");
    if (!pixels.length) return;

    setHasTransitioned(true);

    pixels.forEach((p) => {
      p.style.backgroundColor = randomGreen();
    });

    const half = animationStepDuration * 0.5;

    // Phase 1: fade pixels IN over the first content
    gsap.to(pixels, {
      opacity: 1,
      duration: 0.15,
      stagger: { each: half / pixels.length, from: "random" },
    });

    // At midpoint: swap content behind the pixel layer
    gsap.delayedCall(half, () => {
      activeEl.style.opacity = "1";
    });

    // Phase 2: fade pixels OUT to reveal second content
    gsap.to(pixels, {
      opacity: 0,
      duration: 0.15,
      delay: half,
      stagger: { each: half / pixels.length, from: "random" },
      onComplete: () => {
        onTransitionComplete?.();
      },
    });
  }, [trigger, hasTransitioned, animationStepDuration, onTransitionComplete]);

  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0">{firstContent}</div>
      <div ref={activeRef} className="absolute inset-0 z-[2]" style={{ opacity: 0 }}>
        {secondContent}
      </div>
      <div ref={pixelGridRef} className="pointer-events-none absolute inset-0 z-[3]" />
    </div>
  );
}
