"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  profileInfoSchema,
  type Role,
  type InvestorType,
} from "@/lib/validation/onboarding";
import { cn } from "@/lib/utils";
import { saveOnboardingAction } from "../actions";
import { RoleStep } from "./role-step";
import { ProfileStep, type ProfileData } from "./profile-step";
import { ConnectStep } from "./connect-step";
import { ReadyInterstitial } from "./ready-interstitial";

type Step = 1 | 2 | 3;
type FieldErrors = Partial<Record<string, string>>;

const DRAFT_KEY = "vm:onboarding-draft";

const PROFILE_DEFAULTS: ProfileData = {
  companyName: "",
  investorType: "firm" as InvestorType,
  firmName: "",
  description: "",
};

type Draft = { role: Role | null; profile: ProfileData; step: Step };

function readDraft(): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Draft;
  } catch {
    return null;
  }
}

function writeDraft(d: Draft) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    // localStorage might be disabled (private mode) — fail silently
  }
}

function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

const STEP_LABELS = ["Your role", "About you", "Connect"] as const;

export function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const connectedProvider = searchParams.get("connected") ?? undefined;

  // Lazy initial state restores any draft saved before an OAuth bounce so
  // step state isn't lost when the user comes back from connecting LinkedIn.
  // If they're returning with ?connected=…, prefer step 3 (the connect screen).
  const [{ role: initialRole, profile: initialProfile, step: initialStep }] =
    useState<Draft>(() => {
      const draft = readDraft();
      if (draft) {
        return {
          role: draft.role,
          profile: draft.profile,
          step: connectedProvider ? 3 : draft.step,
        };
      }
      return {
        role: null,
        profile: PROFILE_DEFAULTS,
        step: connectedProvider ? 3 : 1,
      };
    });

  const [step, setStep] = useState<Step>(initialStep);
  const [direction, setDirection] = useState(1);
  const [role, setRole] = useState<Role | null>(initialRole);
  const [profile, setProfile] = useState<ProfileData>(initialProfile);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showInterstitial, setShowInterstitial] = useState(false);

  // Persist a draft on every change so an OAuth bounce mid-flow doesn't
  // wipe the user's progress.
  useEffect(() => {
    writeDraft({ role, profile, step });
  }, [role, profile, step]);

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
    setDirection(1);
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
    setDirection(1);
    setStep(3);
  }

  // Step 3 has two exits: "Finish" and "Skip for now". Both call the
  // server to mark onboarding complete; the difference is purely UX
  // signalling.
  function handleFinish() {
    setErrors({});
    setFormError(null);
    if (!role) return;

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
      });
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      clearDraft();
      setShowInterstitial(true);
    });
  }

  const questions: Record<Step, string> = {
    1: "What brings you to VentraMatch?",
    2: role === "founder" ? "Tell us about your startup." : "Tell us about your investing.",
    3: "Add verified signal in one click.",
  };

  const subtitles: Record<Step, string> = {
    1: "This takes about a minute. You can update everything later.",
    2: role === "founder"
      ? "Just the basics — name and a quick description."
      : "Are you with a firm or investing independently?",
    3: "Connect a profile so investors can trust the basics, or skip and add it later.",
  };

  if (showInterstitial) {
    return (
      <ReadyInterstitial
        onComplete={() => {
          window.location.href = "/homepage";
          router.refresh();
        }}
      />
    );
  }

  const isFinalStep = step === 3;

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
            <ConnectStep role={role} connected={connectedProvider} />
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

        <div className="flex items-center gap-3">
          {isFinalStep ? (
            <button
              type="button"
              onClick={handleFinish}
              disabled={isPending}
              className={cn(
                "inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius)] px-4",
                "text-[14px] font-medium text-[var(--color-text-muted)]",
                "transition-colors duration-150 hover:text-[var(--color-text-strong)]",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              Skip for now
            </button>
          ) : null}

          <button
            type="button"
            onClick={
              step === 1
                ? handleStep1Continue
                : step === 2
                  ? handleStep2Continue
                  : handleFinish
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
            {!isFinalStep ? "Continue" : connectedProvider ? "Finish" : "Finish setup"}
          </button>
        </div>
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
