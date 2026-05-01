"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar } from "@/components/profile/avatar";
import { cn } from "@/lib/utils";

const SAVED_KEY = "vm:interested-profiles";

function readSaved(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function writeSaved(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
  } catch {}
}

export type MatchCard = {
  id: string;
  userId: string;
  name: string;
  firm: string | null;
  oneLiner: string | null;
  chips: string[];
  score: number;
  avatarSrc: string | null;
  otherRole: "founder" | "investor";
};

type Props = {
  cards: MatchCard[];
};

export function MatchCardDeck({ cards }: Props) {
  const [index, setIndex] = useState(0);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [showMatchAnim, setShowMatchAnim] = useState(false);
  const [exitDir, setExitDir] = useState<"left" | "right" | null>(null);

  useEffect(() => {
    setSavedIds(readSaved());
  }, []);

  const current = cards[index] ?? null;
  const done = index >= cards.length;

  const advanceAfterDelay = useCallback(
    (dir: "left" | "right", delay = 300) => {
      setExitDir(dir);
      setTimeout(() => {
        setIndex((i) => i + 1);
        setExitDir(null);
      }, delay);
    },
    [],
  );

  function handleMatch() {
    if (!current) return;

    setSavedIds((prev) => {
      if (prev.includes(current.userId)) return prev;
      const next = [...prev, current.userId];
      writeSaved(next);
      return next;
    });

    setShowMatchAnim(true);
    setTimeout(() => {
      setShowMatchAnim(false);
      advanceAfterDelay("left", 100);
    }, 1400);
  }

  function handlePass() {
    if (!current) return;
    advanceAfterDelay("right");
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-[540px] flex-col items-center gap-4 py-20 text-center">
        <p className="text-[18px] font-semibold text-[color:var(--color-text)]">
          All caught up
        </p>
        <p className="text-[14px] leading-relaxed text-[color:var(--color-text-muted)]">
          You&apos;ve reviewed all {cards.length} profiles.
          Matched profiles appear in your &ldquo;Interested&rdquo; section on the dashboard.
        </p>
      </div>
    );
  }

  const roleLabel = current.otherRole === "founder" ? "Startup" : "Investor";

  return (
    <div className="relative flex flex-col items-center">
      <p className="mb-4 text-[12px] font-medium tracking-wide text-[color:var(--color-text-faint)]">
        {index + 1} / {cards.length}
      </p>

      <AnimatePresence mode="wait">
        {!showMatchAnim && (
          <motion.article
            key={current.id}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              x: exitDir === "left" ? -120 : exitDir === "right" ? 120 : 0,
              scale: 0.95,
              transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
            }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[560px] border border-[color:var(--color-border)] bg-white"
          >
            <div className="flex flex-col items-center gap-5 px-8 pb-6 pt-10">
              <Avatar
                id={current.userId}
                name={current.name}
                src={current.avatarSrc}
                size="xl"
              />

              <div className="flex flex-col items-center gap-1.5 text-center">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text-faint)]">
                  {roleLabel}
                </span>
                <h2 className="text-[22px] font-semibold tracking-tight text-[color:var(--color-text)]">
                  {current.name}
                </h2>
                {current.firm && (
                  <p className="text-[14px] text-[color:var(--color-text-muted)]">
                    {current.firm}
                  </p>
                )}
                {current.oneLiner && (
                  <p className="mt-1 max-w-[44ch] text-[13px] leading-relaxed text-[color:var(--color-text-muted)]">
                    {current.oneLiner}
                  </p>
                )}
              </div>

              {current.chips.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {current.chips.slice(0, 5).map((chip) => (
                    <span
                      key={chip}
                      className="inline-flex items-center px-2.5 py-1 text-[11px] font-medium"
                      style={{
                        background: "var(--color-brand-tint)",
                        color: "var(--color-brand-strong)",
                      }}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              )}

              {current.score > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-[color:var(--color-text-faint)]">
                    Match
                  </span>
                  <div
                    className="h-1.5 w-28 overflow-hidden bg-[color:var(--color-border)]"
                    style={{ borderRadius: 1 }}
                  >
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${current.score}%`,
                        background: "var(--color-brand)",
                      }}
                    />
                  </div>
                  <span className="text-[12px] font-semibold tabular-nums text-[color:var(--color-text)]">
                    {current.score}%
                  </span>
                </div>
              )}
            </div>

            <div className="flex border-t border-[color:var(--color-border)]">
              <button
                type="button"
                onClick={handleMatch}
                className={cn(
                  "flex-1 py-4 text-center text-[15px] font-bold uppercase tracking-[0.06em]",
                  "transition-colors duration-150",
                  "bg-[color:var(--color-brand-ink)] text-white hover:bg-[color:var(--color-brand-ink-hov)]",
                )}
              >
                MATCH
              </button>
              <span className="w-px bg-[color:var(--color-border)]" />
              <button
                type="button"
                onClick={handlePass}
                className={cn(
                  "flex-1 py-4 text-center text-[15px] font-bold uppercase tracking-[0.06em]",
                  "text-[color:var(--color-text-muted)] transition-colors duration-150",
                  "hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-text)]",
                )}
              >
                PASS
              </button>
            </div>
          </motion.article>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMatchAnim && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-full max-w-[560px] flex-col items-center justify-center gap-3 py-16"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 20 }}
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: "var(--color-brand)" }}
            >
              <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-[20px] font-semibold tracking-tight text-[color:var(--color-text)]"
            >
              It&apos;s a match
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="text-[13px] text-[color:var(--color-text-muted)]"
            >
              Saved to your dashboard
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
