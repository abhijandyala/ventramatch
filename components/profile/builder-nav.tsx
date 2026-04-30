"use client";

import type { CompletionResult } from "@/lib/profile/completion";

/**
 * Summary bar above the wizard on /build. Shows three sub-bars:
 *   1. Wizard basics (the 8-step flow)
 *   2. Depth (the collapsible sections below the wizard)
 *   3. Verifications
 *
 * Each has a % and a click-to-scroll. The overall % and the publish CTA
 * are derived from the parent's completion result.
 *
 * This component is the "bridge" between the wizard and the depth editor
 * that Sprint 9.5.D is about — users previously had no idea the depth
 * sections existed until they scrolled past the wizard.
 */

type Props = {
  completion: CompletionResult;
  wizardStep: number;
  totalWizardSteps: number;
};

export function BuilderNav({ completion, wizardStep, totalWizardSteps }: Props) {
  const baseItems = completion.done.filter((x) => x.base !== false).length
    + completion.missing.filter((x) => x.base !== false).length;
  const baseDone = completion.done.filter((x) => x.base !== false).length;

  const depthItems = completion.done.filter((x) => x.base === false).length
    + completion.missing.filter((x) => x.base === false).length;
  const depthDone = completion.done.filter((x) => x.base === false).length;

  const sections = [
    {
      id: "wizard",
      label: `Basics ${baseDone}/${baseItems}`,
      pct: baseItems > 0 ? Math.round((baseDone / baseItems) * 100) : 0,
      scrollTo: undefined,
    },
    {
      id: "depth",
      label: `Depth ${depthDone}/${depthItems}`,
      pct: depthItems > 0 ? Math.round((depthDone / depthItems) * 100) : 0,
      scrollTo: "depth-editor",
    },
    {
      id: "verifications",
      label: "Verifications",
      pct: null,
      scrollTo: "verification-panel",
    },
  ];

  function scrollToId(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div
      className="sticky top-14 z-20 flex flex-wrap items-center gap-4 border-b bg-[color:var(--color-surface)]/95 px-5 py-3 backdrop-blur md:px-8"
      style={{ borderColor: "var(--color-border)" }}
    >
      {/* Overall % */}
      <div className="flex items-center gap-2">
        <span
          className="inline-flex h-8 min-w-8 items-center justify-center px-2 font-mono text-[12px] font-bold tabular-nums"
          style={{
            background: completion.canPublish
              ? "var(--color-brand-tint)"
              : "var(--color-surface)",
            color: completion.canPublish
              ? "var(--color-brand-strong)"
              : "var(--color-text-strong)",
            border: `1px solid ${completion.canPublish ? "var(--color-brand)" : "var(--color-border)"}`,
          }}
        >
          {completion.pct}%
        </span>
        <span className="text-[12px] text-[color:var(--color-text-muted)]">
          {completion.canPublish ? "Ready to publish" : `${completion.missing.length} sections left`}
        </span>
      </div>

      <span aria-hidden className="hidden h-4 w-px bg-[color:var(--color-border)] md:block" />

      {/* Section pills */}
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => {
            if (s.scrollTo) scrollToId(s.scrollTo);
          }}
          className="inline-flex items-center gap-2 text-[12px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-strong)]"
        >
          {s.pct != null ? (
            <MiniBar pct={s.pct} />
          ) : null}
          {s.label}
        </button>
      ))}

      <span aria-hidden className="hidden h-4 w-px bg-[color:var(--color-border)] md:block" />

      {/* Wizard progress */}
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[color:var(--color-text-faint)]">
        Step {wizardStep + 1}/{totalWizardSteps}
      </span>
    </div>
  );
}

function MiniBar({ pct }: { pct: number }) {
  return (
    <span
      className="inline-block h-1.5 w-10 overflow-hidden"
      style={{ background: "var(--color-border)" }}
    >
      <span
        className="block h-full transition-[width] duration-300"
        style={{
          width: `${Math.min(100, Math.max(0, pct))}%`,
          background: pct >= 100 ? "var(--color-brand)" : "var(--color-text-strong)",
        }}
      />
    </span>
  );
}
