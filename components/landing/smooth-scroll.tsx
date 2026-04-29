"use client";

import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";

/**
 * SmoothScroll wraps the page in a Lenis instance so wheel/touch input is
 * eased into the document's scroll position with a small amount of inertia.
 * This is the "premium" buttery-scroll feel used on Linear, Apple, etc.
 *
 * Behavior:
 *   - lerp 0.1, smoothWheel true (Lenis's defaults are tuned for desktop)
 *   - touchscreen scroll uses native momentum; we don't fight the OS
 *   - prefers-reduced-motion users get native scroll (Lenis is destroyed
 *     so the document scrolls instantly)
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      // Default for touch is `false` so iOS keeps its native rubber-banding feel.
      syncTouch: false,
      wheelMultiplier: 1,
    });

    let raf = 0;
    function tick(time: number) {
      lenis.raf(time);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
