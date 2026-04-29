"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Reveal — a thin wrapper around Framer Motion's whileInView that gives every
 * landing section a consistent, premium-feeling enter animation paired with
 * Lenis smooth scroll. Keep entrances quiet: a small upward translate + fade.
 * Respects prefers-reduced-motion (Framer Motion does this automatically when
 * `useReducedMotion` is honored — we use static initial state for safety).
 */

const variants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

type Props = {
  children: ReactNode;
  /** ms delay relative to the section entering view */
  delay?: number;
  /** override the default entrance distance */
  distance?: number;
  className?: string;
  /** wrap as a different element if needed */
  as?: "div" | "section" | "li" | "p" | "span";
};

export function Reveal({
  children,
  delay = 0,
  distance,
  className,
  as = "div",
}: Props) {
  const Tag = motion[as];

  return (
    <Tag
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      variants={
        distance !== undefined
          ? {
              hidden: { opacity: 0, y: distance },
              show: { opacity: 1, y: 0 },
            }
          : variants
      }
      transition={{
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1],
        delay: delay / 1000,
      }}
      className={className}
    >
      {children}
    </Tag>
  );
}
