"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
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
  const [direction, setDirection] = useState(1);
  const [role, setRole] = useState<Role | null>(null);
  const [founderInfo, setFounderInfo] = useState<FounderInfoInput>(FOUNDER_DEFAULTS);
  const [investorInfo, setInvestorInfo] = useState<InvestorInfoInput>(INVESTOR_DEFAULTS);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleContinue() {
    setFormError(null);
    if (!role) {
      setFormError("Pick a role to continue.");
      return;
    }
    setDirection(1);
    setStep(2);
  }

  function handleBack() {
    setFormError(null);
    setErrors({});
    setDirection(-1);
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

  const question =
    step === 1
      ? "What brings you to VentraMatch?"
      : role === "investor"
        ? "Tell us what you invest in."
        : "Tell us about your raise.";

  const subtitle =
    step === 1
      ? "This takes about a minute. You can complete your full profile later."
      : "Just the essentials. Refine everything else from your profile.";

  return (
    <div className="w-full max-w-[580px]">
      {/* Step progress nodes */}
      <StepProgress step={step} />

      {/* Question headline */}
      <div className="mt-10 mb-8">
        <h1
          className="font-serif font-semibold leading-[1.08] tracking-tight text-[var(--color-text)]"
          style={{ fontSize: "clamp(28px, 4.5vw, 40px)" }}
        >
          {question}
        </h1>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[var(--color-text-muted)]">
          {subtitle}
        </p>
      </div>

      {/* Step content — animated */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, y: direction > 0 ? 14 : -14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: direction > 0 ? -14 : 14 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {step === 1 ? (
            <RoleStep value={role} onChange={setRole} />
          ) : role === "founder" ? (
            <FounderStep value={founderInfo} onChange={setFounderInfo} errors={errors} />
          ) : role === "investor" ? (
            <InvestorStep value={investorInfo} onChange={setInvestorInfo} errors={errors} />
          ) : null}
        </motion.div>
      </AnimatePresence>

      {/* Form-level error */}
      {formError ? (
        <p role="alert" className="mt-5 text-[13px] text-[var(--color-danger)]">
          {formError}
        </p>
      ) : null}

      {/* Navigation */}
      <div className="mt-10 flex items-center justify-between gap-4">
        {step === 2 ? (
          <button
            type="button"
            onClick={handleBack}
            disabled={isPending}
            className={cn(
              "inline-flex h-11 items-center gap-1.5 rounded-[var(--radius)] px-3",
              "text-[14px] font-medium text-[var(--color-text-muted)]",
              "transition-colors duration-150 hover:text-[var(--color-text)]",
              "disabled:cursor-not-allowed disabled:opacity-50",
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
            "inline-flex h-11 min-w-[148px] items-center justify-center gap-2 rounded-[var(--radius)]",
            "bg-[var(--color-brand-ink)] px-6 text-[15px] font-medium text-white",
            "transition-colors duration-150 hover:bg-[var(--color-brand-ink-hov)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : null}
          {step === 1 ? "Continue" : "Finish setup"}
        </button>
      </div>

      {/* Legal */}
      <p className="mt-10 text-center text-[11px] leading-5 text-[var(--color-text-faint)]">
        Informational only — not investment advice. You can refine your profile at any time.
      </p>
    </div>
  );
}

function StepProgress({ step }: { step: Step }) {
  return (
    <div
      className="flex items-start gap-3"
      aria-label={`Step ${step} of 2`}
    >
      <StepNode index={1} active={step >= 1} done={step > 1} label="Your role" />
      <div
        aria-hidden="true"
        className="mt-4 h-px flex-1 bg-[var(--color-border)] transition-colors duration-300"
        style={{
          background: step > 1 ? "var(--color-brand-ink)" : "var(--color-border)",
        }}
      />
      <StepNode index={2} active={step >= 2} done={false} label="Your details" />
    </div>
  );
}

function StepNode({
  index,
  active,
  done,
  label,
}: {
  index: number;
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold",
          "border-2 transition-all duration-300",
          done
            ? "border-[var(--color-brand-ink)] bg-[var(--color-brand-ink)] text-white"
            : active
              ? "border-[var(--color-brand-ink)] bg-white text-[var(--color-brand-ink)]"
              : "border-[var(--color-border)] bg-white text-[var(--color-text-faint)]",
        )}
      >
        {index}
      </span>
      <span
        className={cn(
          "text-[11px] font-medium tracking-[0.04em] uppercase",
          active ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-faint)]",
        )}
      >
        {label}
      </span>
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
