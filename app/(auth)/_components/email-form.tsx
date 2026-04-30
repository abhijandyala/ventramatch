"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { Loader2 } from "lucide-react";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";
import { cn } from "@/lib/utils";
import { signInAction } from "../sign-in/actions";
import { signUpAction } from "../sign-up/actions";

type FieldErrors = Partial<Record<string, string>>;

type Props = { mode: "sign-in" | "sign-up" };

export function EmailForm({ mode }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);

    const data = new FormData(event.currentTarget);

    if (mode === "sign-in") {
      const parsed = signInSchema.safeParse({
        email: data.get("email"),
        password: data.get("password"),
      });
      if (!parsed.success) {
        setErrors(toFieldErrors(parsed.error.issues));
        return;
      }
      const callbackUrl = params.get("from") ?? "/post-auth";
      startTransition(async () => {
        const result = await signInAction(parsed.data);
        if (!result.ok) {
          setFormError(result.error);
          return;
        }
        router.push(callbackUrl as Route);
        router.refresh();
      });
      return;
    }

    const parsed = signUpSchema.safeParse({
      name: data.get("name"),
      email: data.get("email"),
      password: data.get("password"),
      confirmPassword: data.get("confirmPassword"),
      termsAccepted: data.get("termsAccepted") === "on",
      marketingOptIn: data.get("marketingOptIn") === "on",
    });
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error.issues));
      return;
    }

    startTransition(async () => {
      const result = await signUpAction(parsed.data);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      const target = `/verify-email?email=${encodeURIComponent(result.email)}` as Route;
      router.push(target);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      {mode === "sign-up" ? (
        <Field
          id="name"
          name="name"
          label="Full name"
          type="text"
          autoComplete="name"
          error={errors.name}
          required
        />
      ) : null}

      <Field
        id="email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email}
        required
      />

      <Field
        id="password"
        name="password"
        label="Password"
        type="password"
        autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
        error={errors.password}
        required
        minLength={mode === "sign-up" ? 8 : undefined}
        labelAside={
          mode === "sign-in" ? (
            // TODO: build /forgot-password flow.
            <a
              href="#"
              className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              Forgot password?
            </a>
          ) : null
        }
      />

      {mode === "sign-up" ? (
        <Field
          id="confirmPassword"
          name="confirmPassword"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword}
          required
          minLength={8}
        />
      ) : null}

      {mode === "sign-up" ? (
        <div className="mt-2 flex flex-col gap-2.5">
          <Checkbox
            id="termsAccepted"
            name="termsAccepted"
            error={errors.termsAccepted}
            required
          >
            I agree to the{" "}
            <Link
              href="/legal/tos"
              target="_blank"
              className="font-medium text-[var(--color-text)] underline-offset-4 hover:underline"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/legal/privacy"
              target="_blank"
              className="font-medium text-[var(--color-text)] underline-offset-4 hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </Checkbox>
          <Checkbox id="marketingOptIn" name="marketingOptIn">
            Send me product updates and matching tips. (Optional, unsubscribe anytime.)
          </Checkbox>
        </div>
      ) : null}

      {formError ? (
        <p
          role="alert"
          className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-danger)]"
        >
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className={cn(
          "inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius)]",
          "bg-[var(--color-brand-ink)] px-4 text-[15px] font-medium text-white",
          "transition-colors duration-150 hover:bg-[var(--color-brand-ink-hov)]",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : null}
        {mode === "sign-in" ? "Sign in" : "Create account"}
      </button>
    </form>
  );
}

type CheckboxProps = {
  id: string;
  name: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
};

function Checkbox({ id, name, required, error, children }: CheckboxProps) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-[1.5] text-[var(--color-text-muted)]"
      >
        <input
          id={id}
          name={name}
          type="checkbox"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-ink)]/30",
          )}
          style={{ accentColor: "var(--color-brand-ink)" }}
        />
        <span>{children}</span>
      </label>
      {error ? (
        <p id={`${id}-error`} className="ml-[26px] text-[12px] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function toFieldErrors(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) {
      out[key] = issue.message;
    }
  }
  return out;
}

type FieldProps = {
  id: string;
  name: string;
  label: string;
  type: string;
  autoComplete?: string;
  error?: string;
  required?: boolean;
  minLength?: number;
  labelAside?: React.ReactNode;
};

function Field({
  id,
  name,
  label,
  type,
  autoComplete,
  error,
  required,
  minLength,
  labelAside,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[13px] font-medium text-[var(--color-text)]">
          {label}
        </label>
        {labelAside}
      </div>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          "h-11 w-full rounded-[var(--radius)] border px-3 text-[15px] text-[var(--color-text)]",
          "bg-[var(--color-surface)] placeholder:text-[var(--color-text-faint)]",
          "transition-colors duration-150",
          error
            ? "border-[var(--color-danger)]"
            : "border-[var(--color-border)] hover:border-[var(--color-text-faint)]",
        )}
      />
      {error ? (
        <p id={`${id}-error`} className="text-[13px] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
