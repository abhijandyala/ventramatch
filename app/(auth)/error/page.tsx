"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Wordmark } from "@/components/landing/wordmark";

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "There's a problem with the server configuration. Check the server logs.",
  AccessDenied: "Access was denied. You may not have permission to sign in.",
  Verification: "The verification link has expired or has already been used.",
  OAuthSignin: "Could not start the sign-in flow. Try again.",
  OAuthCallback: "Could not complete the sign-in flow. Try again.",
  OAuthCreateAccount: "Could not create your account via this provider. Try a different method.",
  EmailCreateAccount: "Could not create your account via email. Try a different method.",
  Callback: "Something went wrong during sign-in. Try again.",
  OAuthAccountNotLinked: "This email is already associated with another sign-in method.",
  SessionRequired: "You need to be signed in to access this page.",
  Default: "Something went wrong. Please try again.",
};

export default function AuthErrorPage() {
  const params = useSearchParams();
  const errorCode = params.get("error") ?? "Default";
  const message = ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default;

  console.error(`[auth/error] code=${errorCode}`);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--color-bg)] px-6">
      <div className="w-full max-w-[400px] text-center">
        <Wordmark size="md" />

        <div className="mt-10 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
          <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-[var(--color-danger)]">
            Sign-in error
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-text)]">
            {message}
          </p>
          <p className="mt-2 text-[12px] text-[var(--color-text-faint)]">
            Error code: {errorCode}
          </p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4">
          <Link
            href="/sign-in"
            className="rounded-[var(--radius)] bg-[var(--color-brand)] px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[var(--color-brand-strong)]"
          >
            Try again
          </Link>
          <Link
            href="/"
            className="text-[14px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
