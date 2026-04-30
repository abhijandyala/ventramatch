"use client";

import { useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bug, Lightbulb, MessageSquare, CheckCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/landing/wordmark";
import { ProfileDropdown } from "@/components/layout/ProfileDropdown";

type Role = "founder" | "investor" | null;

type FeedbackType = "bug" | "feature" | "general";

const NAV_LINKS = [
  { label: "Feed", href: "/feed" },
  { label: "Matches", href: "/matches" },
  { label: "Profiles", href: "/profile" },
  { label: "Dashboard", href: "/dashboard" },
];

const FEEDBACK_TYPES: Array<{
  id: FeedbackType;
  icon: React.ElementType;
  label: string;
  desc: string;
}> = [
  {
    id: "bug",
    icon: Bug,
    label: "Bug report",
    desc: "Something is broken or not working as expected.",
  },
  {
    id: "feature",
    icon: Lightbulb,
    label: "Feature request",
    desc: "An idea for something new or an improvement.",
  },
  {
    id: "general",
    icon: MessageSquare,
    label: "General feedback",
    desc: "Thoughts on the product, experience, or anything else.",
  },
];

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function FeedbackClient({
  role,
  name,
  email,
  userId,
  avatarSrc,
}: {
  role: Role;
  name: string;
  email: string;
  userId?: string;
  avatarSrc?: string | null;
}) {
  const [type, setType] = useState<FeedbackType>("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);
    // Simulate async submit; swap for a real server action when ready.
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 600);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <AppNav role={role} name={name} userId={userId} avatarSrc={avatarSrc} />

      {/* Page header */}
      <section
        className="border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare
              size={16}
              strokeWidth={1.75}
              style={{ color: "var(--color-brand-ink)" }}
            />
            <span
              className="text-[12px] font-medium uppercase tracking-[0.06em]"
              style={{ color: "var(--color-brand-ink)" }}
            >
              Feedback
            </span>
          </div>
          <h1
            className="text-[24px] font-semibold tracking-[-0.015em]"
            style={{ color: "var(--color-text)" }}
          >
            Share your feedback
          </h1>
          <p
            className="mt-1.5 text-[14px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            Bug reports and feature requests go directly to the team building
            VentraMatch. We read every one.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-8 sm:py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
          {/* Form column */}
          <div>
            {submitted ? (
              <SuccessState
                type={type}
                onReset={() => {
                  setSubmitted(false);
                  setTitle("");
                  setBody("");
                  setType("general");
                }}
              />
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                {/* Type selector */}
                <div>
                  <label
                    className="mb-2 block text-[13px] font-medium"
                    style={{ color: "var(--color-text)" }}
                  >
                    Type
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {FEEDBACK_TYPES.map(({ id, icon: Icon, label, desc }) => (
                      <button
                        type="button"
                        key={id}
                        onClick={() => setType(id)}
                        className="flex flex-col items-start gap-1.5 rounded-[10px] px-4 py-3 text-left transition-colors duration-[120ms]"
                        style={{
                          border:
                            type === id
                              ? "1px solid var(--color-brand-ink)"
                              : "1px solid var(--color-border)",
                          background:
                            type === id
                              ? "var(--color-brand-tint)"
                              : "var(--color-surface)",
                        }}
                      >
                        <Icon
                          size={15}
                          strokeWidth={1.75}
                          style={{
                            color:
                              type === id
                                ? "var(--color-brand-ink)"
                                : "var(--color-text-muted)",
                          }}
                        />
                        <p
                          className="text-[13px] font-medium"
                          style={{
                            color:
                              type === id
                                ? "var(--color-brand-ink)"
                                : "var(--color-text)",
                          }}
                        >
                          {label}
                        </p>
                        <p
                          className="text-[11px] leading-snug"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          {desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label
                    htmlFor="feedback-title"
                    className="mb-1.5 block text-[13px] font-medium"
                    style={{ color: "var(--color-text)" }}
                  >
                    Title
                    <span
                      className="ml-1 text-[12px] font-normal"
                      style={{ color: "var(--color-text-faint)" }}
                    >
                      (optional)
                    </span>
                  </label>
                  <input
                    id="feedback-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      type === "bug"
                        ? "e.g. Match score not updating after profile edit"
                        : type === "feature"
                        ? "e.g. Filter feed by check size"
                        : "e.g. Onboarding felt confusing"
                    }
                    className="w-full rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none transition-shadow duration-[120ms]"
                    style={{
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      color: "var(--color-text)",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.boxShadow =
                        "0 0 0 2px var(--color-brand-ink)33";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </div>

                {/* Message */}
                <div>
                  <label
                    htmlFor="feedback-body"
                    className="mb-1.5 block text-[13px] font-medium"
                    style={{ color: "var(--color-text)" }}
                  >
                    Message
                  </label>
                  <textarea
                    id="feedback-body"
                    required
                    rows={6}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={
                      type === "bug"
                        ? "Describe what happened, what you expected, and the steps to reproduce."
                        : type === "feature"
                        ? "Describe the problem you're trying to solve, not just the solution."
                        : "Tell us what's on your mind."
                    }
                    className="w-full resize-none rounded-[10px] px-3.5 py-2.5 text-[14px] outline-none transition-shadow duration-[120ms]"
                    style={{
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      color: "var(--color-text)",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.boxShadow =
                        "0 0 0 2px var(--color-brand-ink)33";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                  <p
                    className="mt-1.5 text-[11px]"
                    style={{ color: "var(--color-text-faint)" }}
                  >
                    Submitting as{" "}
                    <span style={{ color: "var(--color-text-muted)" }}>
                      {email || name || "anonymous"}
                    </span>
                  </p>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading || !body.trim()}
                    className="inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-[13px] font-medium transition-opacity duration-[120ms] disabled:opacity-40"
                    style={{
                      background: "var(--color-brand-ink)",
                      color: "#fff",
                    }}
                  >
                    {loading ? "Sending…" : "Send feedback"}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Info sidebar */}
          <div className="flex flex-col gap-4">
            <div
              className="rounded-[14px] p-5"
              style={{
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
              }}
            >
              <p
                className="mb-3 text-[13px] font-semibold"
                style={{ color: "var(--color-text)" }}
              >
                What happens next
              </p>
              <ol className="flex flex-col gap-3">
                {[
                  {
                    step: "We read it.",
                    detail:
                      "Every submission is reviewed by a human, not filtered by a bot.",
                  },
                  {
                    step: "We triage it.",
                    detail:
                      "Bug reports get a priority tag. Feature requests go into the product backlog.",
                  },
                  {
                    step: "We may follow up.",
                    detail:
                      "For bugs or requests that need clarification, we'll email you directly.",
                  },
                ].map(({ step, detail }, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                      style={{
                        background: "var(--color-brand-tint)",
                        color: "var(--color-brand-ink)",
                      }}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p
                        className="text-[13px] font-medium"
                        style={{ color: "var(--color-text)" }}
                      >
                        {step}
                      </p>
                      <p
                        className="mt-0.5 text-[12px]"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div
              className="rounded-[14px] p-5"
              style={{
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
              }}
            >
              <p
                className="mb-1 text-[13px] font-semibold"
                style={{ color: "var(--color-text)" }}
              >
                Have a question instead?
              </p>
              <p
                className="mb-3 text-[12px]"
                style={{ color: "var(--color-text-muted)" }}
              >
                The help center has answers to common questions about matching,
                profiles, and privacy.
              </p>
              <Link
                href={"/help" as Route}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-opacity duration-[120ms] hover:opacity-70"
                style={{ color: "var(--color-brand-ink)" }}
              >
                Go to Help center
                <ChevronRight size={13} strokeWidth={2} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Success state
// ---------------------------------------------------------------------------

function SuccessState({
  type,
  onReset,
}: {
  type: FeedbackType;
  onReset: () => void;
}) {
  const label =
    type === "bug"
      ? "Bug report received"
      : type === "feature"
      ? "Feature request received"
      : "Feedback received";
  const detail =
    type === "bug"
      ? "We'll look into it and follow up if we need more detail."
      : type === "feature"
      ? "It's in the backlog. If it resonates with other users, you'll hear from us."
      : "Thank you. It goes directly to the team.";

  return (
    <div
      className="flex flex-col items-start gap-4 rounded-[14px] p-8"
      style={{
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      <CheckCircle
        size={28}
        strokeWidth={1.75}
        style={{ color: "var(--color-success)" }}
      />
      <div>
        <p
          className="text-[17px] font-semibold"
          style={{ color: "var(--color-text)" }}
        >
          {label}
        </p>
        <p
          className="mt-1 text-[14px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          {detail}
        </p>
      </div>
      <button
        onClick={onReset}
        className="text-[13px] font-medium transition-opacity duration-[120ms] hover:opacity-70"
        style={{ color: "var(--color-brand-ink)" }}
      >
        Submit another
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App nav
// ---------------------------------------------------------------------------

function AppNav({
  role,
  name,
  userId,
  avatarSrc,
}: {
  role: Role;
  name: string;
  userId?: string;
  avatarSrc?: string | null;
}) {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{ borderColor: "var(--color-border)", background: "var(--color-bg)" }}
    >
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Wordmark size="md" />
          <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href as Route}
                className={cn(
                  "text-[14px] transition-colors duration-[120ms]",
                  pathname === link.href || pathname.startsWith(`${link.href}/`)
                    ? "font-semibold text-[var(--color-text)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <ProfileDropdown role={role} name={name} userId={userId} avatarSrc={avatarSrc} />
      </div>
    </header>
  );
}
