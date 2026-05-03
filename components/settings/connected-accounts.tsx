"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { disconnectProviderAction } from "@/lib/account/actions";

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  linkedin: "LinkedIn",
  github: "GitHub",
  "microsoft-entra-id": "Microsoft",
};

/**
 * NextAuth sign-in routes for each provider.
 * These trigger the OAuth flow and will link the provider to the existing session.
 */
const PROVIDER_SIGNIN_PATHS: Record<string, string> = {
  google: "/api/auth/signin/google",
  linkedin: "/api/auth/signin/linkedin",
  github: "/api/auth/signin/github",
  "microsoft-entra-id": "/api/auth/signin/microsoft-entra-id",
};

type Provider = "google" | "linkedin" | "github" | "microsoft-entra-id";

const ALL_PROVIDERS: Provider[] = ["google", "linkedin", "github", "microsoft-entra-id"];

export function ConnectedAccounts({
  connected,
  hasPassword,
}: {
  connected: Provider[];
  hasPassword: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busyProvider, setBusyProvider] = useState<Provider | null>(null);
  const [isPending, startTransition] = useTransition();

  const onlyMethodIsOAuth = !hasPassword && connected.length === 1;

  function disconnect(provider: Provider) {
    setError(null);
    setBusyProvider(provider);
    startTransition(async () => {
      const res = await disconnectProviderAction({ provider });
      setBusyProvider(null);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-[var(--color-border)]">
        {ALL_PROVIDERS.map((p) => {
          const isConnected = connected.includes(p);
          const otherConnected = connected.filter((x) => x !== p).length;
          const wouldLockOut = isConnected && !hasPassword && otherConnected === 0;

          return (
            <li key={p} className="flex items-center justify-between gap-4 py-3.5 first:pt-0">
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium text-[var(--color-text-strong)]">
                  {PROVIDER_LABELS[p]}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                  {isConnected ? "Connected" : "Not connected"}
                </p>
              </div>

              {isConnected ? (
                <button
                  type="button"
                  onClick={() => disconnect(p)}
                  disabled={isPending || wouldLockOut}
                  title={wouldLockOut ? "Set a password before disconnecting your only sign-in method." : undefined}
                  className="inline-flex h-8 items-center gap-1.5 px-3 text-[12.5px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busyProvider === p && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Disconnect
                </button>
              ) : (
                <a
                  href={`${PROVIDER_SIGNIN_PATHS[p]}?callbackUrl=/settings/security`}
                  className="inline-flex h-8 items-center px-3 text-[12.5px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
                >
                  Connect →
                </a>
              )}
            </li>
          );
        })}
      </ul>

      {onlyMethodIsOAuth && (
        <p className="border-l-2 border-[var(--color-warn)] pl-3 text-[12.5px] leading-[1.55] text-[var(--color-text-muted)]">
          Add a password before disconnecting your only sign-in method, or you
          won&apos;t be able to log back in.
        </p>
      )}

      {error && (
        <p role="alert" className="border-l-2 border-[var(--color-danger)] pl-3 text-[12.5px] text-[var(--color-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
