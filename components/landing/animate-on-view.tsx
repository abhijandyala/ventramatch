"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
  /** ms delay before the enter animation starts */
  delay?: number;
  /** how the element enters */
  variant?: "fade-up" | "fade" | "slide-left" | "slide-right";
  /** intersection ratio that triggers the animation */
  threshold?: number;
};

const variantClasses: Record<NonNullable<Props["variant"]>, string> = {
  "fade-up": "opacity-0 translate-y-3",
  fade: "opacity-0",
  "slide-left": "opacity-0 -translate-x-5",
  "slide-right": "opacity-0 translate-x-5",
};

/**
 * Wraps any element with a one-shot enter animation triggered when the element
 * scrolls into view. Respects prefers-reduced-motion.
 */
export function AnimateOnView({
  children,
  className,
  delay = 0,
  variant = "fade-up",
  threshold = 0.2,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [threshold]);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: shown ? `${delay}ms` : undefined }}
      className={cn(
        "transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
        shown ? "opacity-100 translate-x-0 translate-y-0" : variantClasses[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
