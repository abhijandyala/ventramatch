"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { LinkedInMark } from "@/app/(auth)/_components/provider-marks";
import type { Role } from "@/lib/validation/onboarding";
import { cn } from "@/lib/utils";
import { connectProviderAction } from "../connect-actions";

type Props = {
  role: Role;
  /** Provider id from ?connected=… so we can show a "linked" state. */
  connected?: string;
};

export function ConnectStep({ role, connected }: Props) {
  const [pending, startTransition] = useTransition();

  function handleConnect(provider: "linkedin" | "github") {
    startTransition(async () => {
      await connectProviderAction(provider);
      // Redirect happens server-side; nothing to do client-side.
    });
  }

  const linkedInConnected = connected === "linkedin";
  const githubConnected = connected === "github";

  return (
    <div className="grid gap-3">
      <ConnectButton
        provider="linkedin"
        connected={linkedInConnected}
        disabled={pending}
        onClick={() => handleConnect("linkedin")}
      >
        <LinkedInMark className="h-5 w-5 shrink-0" />
        <span className="flex-1 text-left">
          <span className="block text-[14px] font-medium text-[var(--color-text)]">
            {linkedInConnected ? "LinkedIn connected" : "Connect LinkedIn"}
          </span>
          <span className="block text-[12px] text-[var(--color-text-muted)]">
            {role === "founder"
              ? "Pulls your work history and education to verify the team."
              : "Verifies your firm and role for founders to trust."}
          </span>
        </span>
      </ConnectButton>

      {role === "founder" ? (
        <ConnectButton
          provider="github"
          connected={githubConnected}
          disabled={pending}
          onClick={() => handleConnect("github")}
        >
          <GitHubMark className="h-5 w-5 shrink-0" />
          <span className="flex-1 text-left">
            <span className="block text-[14px] font-medium text-[var(--color-text)]">
              {githubConnected ? "GitHub connected" : "Connect GitHub"}
            </span>
            <span className="block text-[12px] text-[var(--color-text-muted)]">
              Adds technical signal: repos, contributors, history.
            </span>
          </span>
        </ConnectButton>
      ) : null}

      <p className="mt-3 text-[12px] leading-[1.5] text-[var(--color-text-faint)]">
        Both are optional. Skipping won&apos;t block your account — but
        connecting now adds verification badges to your profile and pre-fills
        sections of the full profile builder later.
      </p>
    </div>
  );
}

function ConnectButton({
  connected,
  disabled,
  onClick,
  children,
}: {
  provider: "linkedin" | "github";
  connected: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || connected}
      className={cn(
        "inline-flex items-center gap-3 rounded-[var(--radius)] border bg-white px-4 py-3 text-left",
        "transition-colors duration-150",
        "disabled:cursor-not-allowed",
        connected
          ? "border-[var(--color-brand)] bg-[var(--color-brand-tint)]"
          : "border-[var(--color-border)] hover:border-[var(--color-text-faint)] hover:shadow-sm",
      )}
    >
      {disabled && !connected ? (
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[var(--color-text-muted)]" />
      ) : (
        children
      )}
      {connected ? (
        <span className="ml-auto text-[12px] font-medium text-[var(--color-brand-strong)]">
          ✓ Linked
        </span>
      ) : null}
    </button>
  );
}

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="currentColor"
      aria-label="GitHub"
    >
      <path d="M12 .297a12 12 0 0 0-3.79 23.39c.6.111.82-.26.82-.578 0-.285-.011-1.04-.016-2.04-3.338.726-4.042-1.61-4.042-1.61-.546-1.388-1.333-1.756-1.333-1.756-1.089-.745.083-.73.083-.73 1.205.084 1.84 1.237 1.84 1.237 1.07 1.835 2.807 1.305 3.49.998.108-.776.42-1.305.762-1.605-2.665-.305-5.467-1.333-5.467-5.93 0-1.31.467-2.382 1.236-3.222-.124-.303-.535-1.527.117-3.18 0 0 1.008-.323 3.3 1.23a11.5 11.5 0 0 1 6.003 0c2.29-1.553 3.297-1.23 3.297-1.23.653 1.653.242 2.877.118 3.18.77.84 1.235 1.912 1.235 3.222 0 4.61-2.807 5.622-5.48 5.92.43.37.823 1.103.823 2.222 0 1.604-.014 2.896-.014 3.293 0 .32.218.694.825.576A12 12 0 0 0 12 .297" />
    </svg>
  );
}
