"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type NavSection = { id: string; label: string };

/**
 * Sticky horizontal nav for /settings on screens narrower than lg.
 * Hidden on desktop (the fixed left sidebar handles navigation there).
 *
 * Uses IntersectionObserver to highlight the section currently in view.
 * Clicking an item smooth-scrolls to the section anchor.
 */
export function SettingsMobileNav({ sections }: { sections: NavSection[] }) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");
  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  useEffect(() => {
    // Give the DOM a moment to render all section elements.
    const targets = sections.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (targets.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        // Pick the first entry whose section is intersecting (top-most wins).
        const hit = entries.find((e) => e.isIntersecting);
        if (hit) setActive(hit.target.id);
      },
      {
        rootMargin: "-15% 0px -75% 0px",
        threshold: 0,
      },
    );

    targets.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [sections]);

  // Scroll the active nav pill into view whenever it changes.
  useEffect(() => {
    const el = itemRefs.current.get(active);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [active]);

  return (
    <nav
      aria-label="Settings sections"
      className="sticky top-0 z-20 -mx-4 flex overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 scrollbar-none lg:hidden"
    >
      {sections.map((s) => {
        const isActive = active === s.id;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            ref={(el) => {
              if (el) itemRefs.current.set(s.id, el);
              else itemRefs.current.delete(s.id);
            }}
            onClick={() => setActive(s.id)}
            className={cn(
              "shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-[12.5px] font-medium transition-colors",
              isActive
                ? "border-[var(--color-text-strong)] text-[var(--color-text-strong)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]",
            )}
          >
            {s.label}
          </a>
        );
      })}
    </nav>
  );
}
