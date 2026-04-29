"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  profileInfoSchema,
  goalsSchema,
  type Role,
  type InvestorType,
} from "@/lib/validation/onboarding";
import { cn } from "@/lib/utils";
import { saveOnboardingAction } from "../actions";
import { RoleStep } from "./role-step";
import { ProfileStep, type ProfileData } from "./profile-step";
import { GoalsStep } from "./goals-step";
import { ReadyInterstitial } from "./ready-interstitial";

type Step = 1 | 2 | 3;
type FieldErrors = Partial<Record<string, string>>;

const PROFILE_DEFAULTS: ProfileData = {
  companyName: "",
  investorType: "firm" as InvestorType,
  firmName: "",
  description: "",
};

const STEP_LABELS = ["Your role", "About you", "Your goals"] as const;

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [direction, setDirection] = useState(1);
  const [role, setRole] = useState<Role | null>(null);
  const [profile, setProfile] = useState<ProfileData>(PROFILE_DEFAULTS);
  const [goals, setGoals] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showInterstitial, setShowInterstitial] = useState(false);

  function goForward() {
    setDirection(1);
  }

  function goBack() {
    setFormError(null);
    setErrors({});
    setDirection(-1);
    setStep((s) => Math.max(1, s - 1) as Step);
  }

  function handleStep1Continue() {
    setFormError(null);
    if (!role) {
      setFormError("Pick a role to continue.");
      return;
    }
    goForward();
    setStep(2);
  }

  function handleStep2Continue() {
    setErrors({});
    setFormError(null);
    if (!role) return;

    const profileInput =
      role === "founder"
        ? { role: "founder" as const, companyName: profile.companyName, description: profile.description }
        : {
            role: "investor" as const,
            investorType: profile.investorType,
            firmName: profile.investorType === "firm" ? profile.firmName : undefined,
            description: profile.description,
          };

    const parsed = profileInfoSchema.safeParse(profileInput);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error.issues));
      return;
    }
    goForward();
    setStep(3);
  }

  function handleSubmit() {
    setErrors({});
    setFormError(null);
    if (!role) return;

    const goalsParsed = goalsSchema.safeParse({ goals });
    if (!goalsParsed.success) {
      setErrors(toFieldErrors(goalsParsed.error.issues));
      return;
    }

    startTransition(async () => {
      const result = await saveOnboardingAction({
        role,
        profile:
          role === "founder"
            ? { role: "founder", companyName: profile.companyName, description: profile.description }
            : {
                role: "investor",
                investorType: profile.investorType,
                firmName: profile.investorType === "firm" ? profile.firmName : undefined,
                description: profile.description,
              },
        goals: { goals },
      });
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      setShowInterstitial(true);
    });
  }

  const questions: Record<Step, string> = {
    1: "What brings you to VentraMatch?",
    2: role === "founder" ? "Tell us about your startup." : "Tell us about your investing.",
    3: "One last thing.",
  };

  const subtitles: Record<Step, string> = {
    1: "This takes about a minute. You can update everything later.",
    2: role === "founder"
      ? "Just the basics — name and a quick description."
      : "Are you with a firm or investing independently?",
    3: "What are you hoping to get out of VentraMatch?",
  };

  if (showInterstitial) {
    return (
      <ReadyInterstitial
        onComplete={() => {
          window.location.href = "/homepage";
        }}
      />
    );
  }

  return (
    <div className="w-full max-w-[580px]">
      <StepProgress step={step} />

      <div className="mt-10 mb-8">
        <h1
          className="font-serif font-semibold leading-[1.08] tracking-tight text-[var(--color-text)]"
          style={{ fontSize: "clamp(28px, 4.5vw, 40px)" }}
        >
          {questions[step]}
        </h1>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[var(--color-text-muted)]">
          {subtitles[step]}
        </p>
      </div>

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
          ) : step === 2 && role ? (
            <ProfileStep role={role} value={profile} onChange={setProfile} errors={errors} />
          ) : step === 3 && role ? (
            <GoalsStep role={role} value={goals} onChange={setGoals} error={errors.goals} />
          ) : null}
        </motion.div>
      </AnimatePresence>

      {formError ? (
        <p role="alert" className="mt-5 text-[13px] text-[var(--color-danger)]">
          {formError}
        </p>
      ) : null}

      <div className="mt-10 flex items-center justify-between gap-4">
        {step > 1 ? (
          <button
            type="button"
            onClick={goBack}
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
          onClick={
            step === 1
              ? handleStep1Continue
              : step === 2
                ? handleStep2Continue
                : handleSubmit
          }
          disabled={isPending || (step === 1 && !role)}
          className={cn(
            "inline-flex h-11 min-w-[148px] items-center justify-center gap-2 rounded-[var(--radius)]",
            "bg-[var(--color-brand-ink)] px-6 text-[15px] font-medium text-white",
            "transition-colors duration-150 hover:bg-[var(--color-brand-ink-hov)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : null}
          {step < 3 ? "Continue" : "Finish setup"}
        </button>
      </div>

      <p className="mt-10 text-center text-[11px] leading-5 text-[var(--color-text-faint)]">
        Informational only — not investment advice. You can refine your profile at any time.
      </p>
    </div>
  );
}

function StepProgress({ step }: { step: Step }) {
  return (
    <div className="flex items-start gap-3" aria-label={`Step ${step} of 3`}>
      <StepNode index={1} active={step >= 1} done={step > 1} label={STEP_LABELS[0]} />
      <div
        aria-hidden="true"
        className="mt-4 h-px flex-1 transition-colors duration-300"
        style={{ background: step > 1 ? "var(--color-brand-ink)" : "var(--color-border)" }}
      />
      <StepNode index={2} active={step >= 2} done={step > 2} label={STEP_LABELS[1]} />
      <div
        aria-hidden="true"
        className="mt-4 h-px flex-1 transition-colors duration-300"
        style={{ background: step > 2 ? "var(--color-brand-ink)" : "var(--color-border)" }}
      />
      <StepNode index={3} active={step >= 3} done={false} label={STEP_LABELS[2]} />
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
