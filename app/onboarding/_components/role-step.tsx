"use client";

import * as React from "react";
import { Building2, Coins, Check } from "lucide-react";
import type { Role } from "@/lib/validation/onboarding";
import { cn } from "@/lib/utils";

type Props = {
  value: Role | null;
  onChange: (role: Role) => void;
};

const OPTIONS: Array<{
  role: Role;
  label: string;
  description: string;
  detail: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}> = [
  {
    role: "founder",
    label: "Founder",
    description: "I'm building a startup and looking to raise capital.",
    detail: "Get matched on sector, stage, and check size.",
    icon: Building2,
  },
  {
    role: "investor",
    label: "Investor",
    description: "I write checks into early-stage startups.",
    detail: "Filter deal flow by thesis, stage, and geography.",
    icon: Coins,
  },
];

export function RoleStep({ value, onChange }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Are you a founder or an investor?"
      className="grid gap-4 sm:grid-cols-2"
    >
      {OPTIONS.map((opt) => (
        <RoleCard
          key={opt.role}
          opt={opt}
          selected={value === opt.role}
          onSelect={() => onChange(opt.role)}
        />
      ))}
    </div>
  );
}

function RoleCard({
  opt,
  selected,
  onSelect,
}: {
  opt: (typeof OPTIONS)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = opt.icon;
  // Single glow element — moved via direct DOM writes, no React state, no re-renders
  const glowRef = React.useRef<HTMLSpanElement>(null);

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const glow = glowRef.current;
    if (!glow) return;
    const rect = e.currentTarget.getBoundingClientRect();
    glow.style.left = `${e.clientX - rect.left}px`;
    glow.style.top = `${e.clientY - rect.top}px`;
  }

  function handlePointerEnter() {
    if (glowRef.current) glowRef.current.style.opacity = "1";
  }

  function handlePointerLeave() {
    if (glowRef.current) glowRef.current.style.opacity = "0";
  }

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      style={{
        WebkitBackdropFilter: "blur(20px)",
        backdropFilter: "blur(20px)",
        background: selected
          ? "linear-gradient(135deg, rgba(236,253,245,0.60) 0%, rgba(187,247,208,0.38) 100%)"
          : "linear-gradient(135deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.22) 100%)",
        boxShadow: selected
          ? "0 8px 32px -8px rgba(22,163,74,0.22)"
          : "0 8px 32px -8px rgba(15,23,42,0.09)",
        border: selected
          ? "1.5px solid rgba(22,163,74,0.50)"
          : "1.5px solid transparent",
      }}
      className="relative isolate flex flex-col gap-5 overflow-hidden rounded-[var(--radius-lg)] p-6 text-left transition-[background,box-shadow,border-color] duration-200"
    >
      {/* Smooth glow — single element, position written directly to DOM */}
      <span
        ref={glowRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          width: 180,
          height: 180,
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          opacity: 0,
          transition: "opacity 400ms ease",
          pointerEvents: "none",
          zIndex: -1,
          background: selected
            ? "radial-gradient(circle, rgba(22,163,74,0.55) 0%, rgba(74,222,128,0.20) 60%, transparent 100%)"
            : "radial-gradient(circle, rgba(99,179,237,0.55) 0%, rgba(147,197,253,0.20) 60%, transparent 100%)",
          filter: "blur(16px)",
          left: 0,
          top: 0,
        }}
      />

      {/* Check badge */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand-ink)]",
          "transition-all duration-200",
          selected ? "scale-100 opacity-100" : "scale-75 opacity-0",
        )}
      >
        <Check className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
      </span>

      {/* Icon */}
      <span
        className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] transition-colors duration-200"
        style={{
          background: selected ? "rgba(22,163,74,1)" : "rgba(255,255,255,0.55)",
        }}
      >
        <Icon
          className={cn("h-5 w-5", selected ? "text-white" : "text-[var(--color-text-muted)]")}
          strokeWidth={1.75}
        />
      </span>

      {/* Copy */}
      <span className="flex flex-col gap-1.5">
        <span className="text-[17px] font-semibold tracking-tight text-[var(--color-text)]">
          {opt.label}
        </span>
        <span className="text-[13px] leading-[1.55] text-[var(--color-text-muted)]">
          {opt.description}
        </span>
        <span
          className="mt-1 text-[12px] font-medium transition-colors duration-200"
          style={{
            color: selected ? "var(--color-brand-ink)" : "var(--color-text-faint)",
          }}
        >
          {opt.detail}
        </span>
      </span>
    </button>
  );
}
