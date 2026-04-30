"use client";

import { useEffect, useState } from "react";

/**
 * Client-only breakpoint hook. Returns true when the viewport is at or
 * above the given pixel width. Uses matchMedia for efficiency (no resize
 * listener polling).
 *
 * SSR-safe: returns `fallback` on the first render (before hydration).
 * The default fallback is `true` (desktop-first) to match our Tailwind
 * convention where mobile styles are the exceptions, not the defaults.
 */
export function useBreakpoint(
  minWidth: number,
  fallback = true,
): boolean {
  const [matches, setMatches] = useState(fallback);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    setMatches(mq.matches);
    function handler(e: MediaQueryListEvent) {
      setMatches(e.matches);
    }
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [minWidth]);

  return matches;
}

/** Common breakpoints matching Tailwind defaults. */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;
