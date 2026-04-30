"use client";

import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Wordmark } from "@/components/landing/wordmark";
import { resendVerificationAction } from "./actions";

const COOLDOWN_SECONDS = 60;

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Shell email="" />}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const params = useSearchParams();
  const email = (params.get("email") ?? "").trim();
  const errorParam = params.get("error");

  const initialErrorMessage =
    errorParam === "expired"
      ? "That link expired or was already used. Send a new one below."
      : errorParam === "invalid"
        ? "That link is invalid. Send a new one below."
        : null;

  return <Shell email={email} initialError={initialErrorMessage} />;
}

function Shell({
  email,
  initialError = null,
}: {
  email: string;
  initialError?: string | null;
}) {
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(
    initialError ? { kind: "error", text: initialError } : null,
  );
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Run a 60s countdown so the resend button starts disabled (matches the
  // server-side rate limit imposed during sign-up).
  useEffect(() => {
    if (cooldown <= 0) return;
    tickRef.current = setInterval(() => {
      setCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [cooldown]);

  function handleResend() {
    if (!email || cooldown > 0 || isPending) return;
    setMessage(null);
    startTransition(async () => {
      const result = await resendVerificationAction(email);
      if (!result.ok) {
        setMessage({ kind: "error", text: result.error });
        if (result.retryAfterSeconds) {
          setCooldown(result.retryAfterSeconds);
        }
        return;
      }
      setMessage({ kind: "info", text: "We sent a fresh verification link to your inbox." });
      setCooldown(COOLDOWN_SECONDS);
    });
  }

  const resendDisabled = !email || cooldown > 0 || isPending;
  const resendLabel = isPending
    ? "Sending…"
    : cooldown > 0
      ? `Resend in ${cooldown}s`
      : "Resend link";

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-6"
      style={{ background: "var(--color-bg)" }}
    >
      <div className="w-full max-w-[440px]">
        <div className="mb-10 flex justify-center">
          <Wordmark size="md" />
        </div>

        <div
          className="px-8 py-10"
          style={{
            background: "rgba(255,255,255,0.55)",
            backdropFilter: "blur(24px) saturate(140%)",
            WebkitBackdropFilter: "blur(24px) saturate(140%)",
            border: "1px solid rgba(255,255,255,0.45)",
          }}
        >
          <p className="text-[11px] font-medium tracking-[0.08em] uppercase text-[var(--color-brand)]">
            Check your inbox
          </p>
          <h1
            className="mt-2 text-[24px] font-semibold tracking-tight text-[var(--color-text-strong)]"
            style={{ lineHeight: 1.15 }}
          >
            Verify your email
          </h1>

          <p className="mt-4 text-[14px] leading-[1.6] text-[var(--color-text-muted)]">
            {email ? (
              <>
                We sent a verification link to{" "}
                <span className="font-medium text-[var(--color-text-strong)]">{email}</span>.
                Click it to activate your account and continue.
              </>
            ) : (
              <>We sent a verification link to your email. Click it to activate your account and continue.</>
            )}
          </p>

          {message && (
            <p
              role={message.kind === "error" ? "alert" : "status"}
              className="mt-5 text-[13px]"
              style={{
                color: message.kind === "error" ? "var(--color-danger)" : "var(--color-brand-strong)",
              }}
            >
              {message.text}
            </p>
          )}

          <div className="mt-7 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendDisabled}
              className="h-11 w-full bg-[var(--color-brand)] px-5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderRadius: "var(--radius)" }}
            >
              {resendLabel}
            </button>

            <Link
              href="/sign-up"
              className="h-11 w-full inline-flex items-center justify-center px-5 text-[14px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
            >
              Back to sign up
            </Link>
          </div>

          <p className="mt-7 text-[12px] leading-[1.6] text-[var(--color-text-faint)]">
            Don&apos;t see it? Check your spam folder. Links expire in 1 hour.
          </p>
        </div>

        <p className="mt-6 text-center text-[12px] text-[var(--color-text-faint)]">
          Already verified?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-[var(--color-text-muted)] underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
