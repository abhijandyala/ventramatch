"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { GoogleMark, LinkedInMark, MicrosoftMark } from "./provider-marks";
import { cn } from "@/lib/utils";

type ProviderId = "google" | "linkedin" | "microsoft-entra-id";

const PROVIDERS: Array<{
  id: ProviderId;
  label: string;
  shortLabel: string;
  Mark: (p: { className?: string }) => React.ReactElement;
}> = [
  { id: "google",               label: "Continue with Google",    shortLabel: "Google",    Mark: GoogleMark    },
  { id: "linkedin",             label: "Continue with LinkedIn",  shortLabel: "LinkedIn",  Mark: LinkedInMark  },
  { id: "microsoft-entra-id",   label: "Continue with Microsoft", shortLabel: "Microsoft", Mark: MicrosoftMark },
];

const POST_AUTH_PATH = "/post-auth";

type Props = {
  /** compact — 3-column icon+name grid. Default: full-width vertical list. */
  compact?: boolean;
};

export function ProviderButtons({ compact = false }: Props) {
  const [pendingProvider, setPendingProvider] = useState<ProviderId | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick(id: ProviderId) {
    setPendingProvider(id);
    startTransition(async () => {
      await signIn(id, { callbackUrl: POST_AUTH_PATH });
    });
  }

  if (compact) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {PROVIDERS.map(({ id, label, shortLabel, Mark }) => {
          const busy = isPending && pendingProvider === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleClick(id)}
              disabled={isPending}
              aria-busy={busy}
              aria-label={busy ? "Redirecting…" : label}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-1.5 rounded-[var(--radius)]",
                "border border-[var(--color-border)] bg-[var(--color-surface)]",
                "px-2 text-[12px] font-medium text-[var(--color-text)]",
                "transition-colors duration-150",
                "hover:border-[var(--color-text-faint)] hover:shadow-sm",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {busy ? (
                <span className="text-[11px]">…</span>
              ) : (
                <>
                  <Mark className="h-[15px] w-[15px] shrink-0" />
                  <span className="truncate">{shortLabel}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {PROVIDERS.map(({ id, label, Mark }) => {
        const busy = isPending && pendingProvider === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => handleClick(id)}
            disabled={isPending}
            aria-busy={busy}
            className={cn(
              "inline-flex h-11 w-full items-center justify-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)]",
              "bg-[var(--color-surface)] px-4 text-[15px] font-medium text-[var(--color-text)]",
              "transition-colors duration-150",
              "hover:border-[var(--color-text-faint)] hover:shadow-sm",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            <Mark className="h-[18px] w-[18px]" />
            <span>{busy ? "Redirecting…" : label}</span>
          </button>
        );
      })}
    </div>
  );
}
