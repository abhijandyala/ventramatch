"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Wordmark } from "@/components/landing/wordmark";
import {
  founderInfoSchema,
  investorInfoSchema,
  type FounderInfoInput,
  type InvestorInfoInput,
  type Role,
} from "@/lib/validation/onboarding";
import { cn } from "@/lib/utils";
import { saveOnboardingAction } from "../actions";
import { RoleStep } from "./role-step";
import { FounderStep } from "./founder-step";
import { InvestorStep } from "./investor-step";

type Step = 1 | 2;
type FieldErrors = Partial<Record<string, string>>;

const FOUNDER_DEFAULTS: FounderInfoInput = {
  industry: "",
  stage: "pre_seed",
  amountRaising: "",
  location: "",
};

const INVESTOR_DEFAULTS: InvestorInfoInput = {
  checkSize: "",
  preferredStage: "pre_seed",
  sectors: [],
  geography: "",
  leadFollow: "either",
};

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<Role | null>(null);
  const [founderInfo, setFounderInfo] = useState<FounderInfoInput>(FOUNDER_DEFAULTS);
  const [investorInfo, setInvestorInfo] = useState<InvestorInfoInput>(INVESTOR_DEFAULTS);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleContinue() {
    setFormError(null);
    if (step === 1) {
      if (!role) {
        setFormError("Pick a role to continue.");
        return;
      }
      setStep(2);
    }
  }

  function handleBack() {
    setFormError(null);
    setErrors({});
    setStep(1);
  }

  function handleSubmit() {
    setErrors({});
    setFormError(null);

    if (!role) {
      setFormError("Pick a role to continue.");
      return;
    }

    if (role === "founder") {
      const parsed = founderInfoSchema.safeParse(founderInfo);
      if (!parsed.success) {
        setErrors(toFieldErrors(parsed.error.issues));
        return;
      }
      startTransition(async () => {
        const result = await saveOnboardingAction({ role: "founder", info: parsed.data });
        if (!result.ok) {
          setFormError(result.error);
          return;
        }
        router.push("/dashboard");
        router.refresh();
      });
      return;
    }

    const parsed = investorInfoSchema.safeParse(investorInfo);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error.issues));
      return;
    }
    startTransition(async () => {
      const result = await saveOnboardingAction({ role: "investor", info: parsed.data });
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="w-full max-w-[520px]">
      <div className="mb-8 flex justify-center">
        <Wordmark size="md" asLink={false} />
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-7 sm:p-8">
        <ProgressIndicator step={step} />

        <div className="mt-6">
          <h1 className="text-[20px] font-semibold tracking-tight text-[var(--color-text)]">
            {step === 1 ? "Help us start matching you with the right people." : matchInfoTitle(role)}
          </h1>
          <p className="mt-1 text-[14px] leading-5 text-[var(--color-text-muted)]">
            {step === 1
              ? "This only takes about a minute. You can complete your full profile later."
              : "Just the essentials. You can refine the rest from your profile."}
          </p>
        </div>

        <div className="mt-6">
          {step === 1 ? (
            <RoleStep value={role} onChange={setRole} />
          ) : role === "founder" ? (
            <FounderStep value={founderInfo} onChange={setFounderInfo} errors={errors} />
          ) : role === "investor" ? (
            <InvestorStep value={investorInfo} onChange={setInvestorInfo} errors={errors} />
          ) : null}
        </div>

        {formError ? (
          <p
            role="alert"
            className="mt-5 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-danger)]"
          >
            {formError}
          </p>
        ) : null}

        <div className="mt-7 flex items-center justify-between gap-3">
          {step === 2 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={isPending}
              className={cn(
                "inline-flex h-11 items-center gap-1.5 rounded-[var(--radius)] px-3 text-[14px] font-medium",
                "text-[var(--color-text-muted)] transition-colors duration-150",
                "hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
              Back
            </button>
          ) : (
            <span aria-hidden="true" />
          )}

          <button
            type="button"
            onClick={step === 1 ? handleContinue : handleSubmit}
            disabled={isPending || (step === 1 && !role)}
            className={cn(
              "inline-flex h-11 min-w-[140px] items-center justify-center gap-2 rounded-[var(--radius)]",
              "bg-[var(--color-brand-ink)] px-5 text-[15px] font-medium text-white",
              "transition-colors duration-150 hover:bg-[var(--color-brand-ink-hov)]",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : null}
            {step === 1 ? "Continue" : "Finish"}
          </button>
        </div>
      </div>

      <p className="mt-8 px-6 text-center text-[12px] leading-5 text-[var(--color-text-faint)]">
        Informational only — not investment advice. You can refine your profile after onboarding.
      </p>
    </div>
  );
}

function matchInfoTitle(role: Role | null): string {
  if (role === "investor") return "Tell us what you invest in.";
  return "Tell us about your raise.";
}

function ProgressIndicator({ step }: { step: Step }) {
  return (
    <div aria-label={`Step ${step} of 2`} className="flex items-center gap-3">
      <div className="flex flex-1 items-center gap-1.5">
        <Bar active={step >= 1} />
        <Bar active={step >= 2} />
      </div>
      <span className="font-mono text-[12px] tracking-wide text-[var(--color-text-faint)] uppercase tabular-nums">
        Step {step} / 2
      </span>
    </div>
  );
}

function Bar({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "h-1 flex-1 rounded-full transition-colors duration-150",
        active ? "bg-[var(--color-brand-ink)]" : "bg-[var(--color-surface-2)]",
      )}
    />
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
