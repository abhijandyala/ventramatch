"use client";

import { useEffect, useRef, useTransition } from "react";
import { markCelebratedAction } from "@/lib/account/actions";

/**
 * One-time confetti burst when a user reaches 100% profile completion.
 *
 * Uses simple CSS keyframe animation (no external library) — 60 small
 * circles shoot upward from the center of the viewport and fade out.
 * Plays once, stamps `celebrated_completion_at` via server action so
 * a refresh never replays it.
 *
 * Props:
 *   - pct: current completion percentage (from the server query)
 *   - celebrated: whether `celebrated_completion_at IS NOT NULL`
 *
 * Renders nothing when pct < 100 or already celebrated.
 */
export function CompletionCelebration({
  pct,
  celebrated,
}: {
  pct: number;
  celebrated: boolean;
}) {
  const stamped = useRef(false);
  const [, startTransition] = useTransition();

  const shouldFire = pct >= 100 && !celebrated && !stamped.current;

  useEffect(() => {
    if (!shouldFire) return;
    stamped.current = true;
    startTransition(async () => {
      await markCelebratedAction();
    });
  }, [shouldFire, startTransition]);

  if (!shouldFire) return null;

  // CSS-only confetti: 40 particles with random positions, delays, colors.
  const particles = Array.from({ length: 40 }, (_, i) => {
    const left = 35 + Math.random() * 30;
    const delay = Math.random() * 0.4;
    const duration = 1.2 + Math.random() * 0.6;
    const size = 4 + Math.random() * 6;
    const hue = Math.floor(Math.random() * 360);
    return (
      <span
        key={i}
        aria-hidden
        className="absolute rounded-full"
        style={{
          left: `${left}%`,
          bottom: "40%",
          width: size,
          height: size,
          background: `hsl(${hue}, 80%, 60%)`,
          animation: `vm-confetti ${duration}s ease-out ${delay}s forwards`,
          opacity: 0,
        }}
      />
    );
  });

  return (
    <>
      <style>{`
        @keyframes vm-confetti {
          0% { opacity: 1; transform: translate(0, 0) scale(1); }
          50% { opacity: 1; }
          100% {
            opacity: 0;
            transform: translate(
              ${/* random X spread */""} calc((var(--i, 0) - 0.5) * 300px),
              calc(-200px - var(--j, 0) * 200px)
            ) scale(0.3);
          }
        }
      `}</style>
      <div
        className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
        role="presentation"
        aria-label="Congratulations! Profile complete."
      >
        {particles}
      </div>
    </>
  );
}
