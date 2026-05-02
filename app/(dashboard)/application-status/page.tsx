import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import type { UserRole } from "@/types/database";

export const dynamic = "force-dynamic";

// ── User-friendly copy for quality-rule reason codes ──────────────────────────
// Only safe, non-technical language is exposed to applicants.
// Raw bot internals (confidence scores, flag severities, metadata) are never shown.
const REASON_COPY: Record<string, string> = {
  name_missing:           "Your name or company name is required.",
  name_min_length:        "Your name is too short — please use your full name or company name.",
  name_test_data:         "Your name looks like placeholder text — please use the real name.",
  one_liner_missing:      "A one-line description of your startup is required.",
  one_liner_too_short:    "Your one-liner is too short — aim for at least 30 characters.",
  one_liner_too_long:     "Your one-liner is too long — please keep it under 240 characters.",
  sectors_empty:          "Please select at least one sector that describes your startup.",
  stages_empty:           "Please select at least one investment stage.",
  stage_missing:          "Please select your company's current stage.",
  raise_amount_negative:  "Your target raise amount must be a positive number.",
  thesis_missing:         "An investment thesis is required.",
  thesis_too_short:       "Your investment thesis needs more detail — aim for at least 50 characters.",
  geographies_empty:      "Please select at least one geography you invest in.",
  check_min_not_positive: "Your minimum check size must be greater than zero.",
  check_max_not_positive: "Your maximum check size must be greater than zero.",
  check_range_inverted:   "Your maximum check size must be larger than your minimum.",
  website_missing:        "Adding a website URL would strengthen your profile.",
  buzzword_density_high:  "Your pitch description uses a lot of generic phrases — try to be more specific about what you do.",
  buzzword_density_suspect:"Your pitch is quite generic — add specific numbers, products, or customers to clarify your story.",
  raise_above_stage_band: "Your target raise seems high for your stated stage — please double-check and update if needed.",
  raise_below_stage_band: "Your target raise seems low for your stated stage — please double-check and update if needed.",
  location_too_short:     "Please enter a full city, region, or country name for your location.",
  investor_not_active:    "Please mark yourself as active to appear in discovery.",
  problem_statement_too_short: "Your problem description needs more detail.",
  solution_overview_too_short: "Your solution description needs more detail.",
};

function friendlyReason(code: string): string {
  return REASON_COPY[code] ?? `Please review the "${code.replace(/_/g, " ")}" section of your profile.`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ApplicationRow = {
  id: string;
  status: string;
  submitted_at: Date | string | null;
  resubmit_count: number;
  decision_summary: string | null;
  decision_reason_codes: string[] | null;
  decided_at: Date | string | null;
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ApplicationStatusPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!session.user.onboardingCompleted) redirect("/onboarding");

  const userId = session.user.id;
  const role   = (session.user.role ?? null) as UserRole | null;
  const buildHref: Route = role === "investor" ? "/build/investor" : "/build";

  const [app, userName] = await Promise.all([
    withUserRls<ApplicationRow | null>(userId, async (sql) => {
      const rows = await sql<ApplicationRow[]>`
        select id, status, submitted_at, resubmit_count,
               decision_summary, decision_reason_codes, decided_at
        from public.applications
        where user_id = ${userId}
        limit 1
      `;
      return rows[0] ?? null;
    }),
    withUserRls<string | null>(userId, async (sql) => {
      const rows = await sql<{ name: string | null }[]>`
        select name from public.users where id = ${userId} limit 1
      `;
      return rows[0]?.name ?? null;
    }),
  ]);

  const status        = app?.status ?? "unverified";
  const reasonCodes   = (app?.decision_reason_codes ?? []).filter(Boolean);
  const summary       = app?.decision_summary?.trim() ?? null;
  const resubmits     = app?.resubmit_count ?? 0;
  const canResubmit   = resubmits < 1; // MAX_FREE_RESUBMITS = 1

  function fmtDate(ts: Date | string | null) {
    if (!ts) return null;
    return new Date(ts).toLocaleDateString("en-US", { dateStyle: "medium" });
  }

  // ── Per-status content ────────────────────────────────────────────────────

  type StatusContent = {
    icon: string;
    title: string;
    body: string;
    tone: "info" | "success" | "warning" | "danger" | "neutral";
    showReasons: boolean;
    showSummary: boolean;
    cta?: { label: string; href: string };
    ctaDanger?: boolean;
  };

  function contentFor(s: string): StatusContent {
    switch (s) {
      case "unverified":
      case "draft":
        return {
          icon: "○",
          title: "Profile not submitted",
          body: "Your profile hasn't been submitted for review yet. Complete your profile and publish it to start matching.",
          tone: "neutral",
          showReasons: false,
          showSummary: false,
          cta: { label: "Continue building →", href: buildHref },
        };

      case "submitted":
        return {
          icon: "◷",
          title: "Submitted — awaiting review",
          body: "Your profile is in the queue. Our team will review it and email you when it's approved. This usually takes less than a day.",
          tone: "info",
          showReasons: false,
          showSummary: false,
        };

      case "under_review":
        return {
          icon: "◷",
          title: "Under review",
          body: "A reviewer is currently looking at your profile. You'll get an email with the result shortly.",
          tone: "info",
          showReasons: false,
          showSummary: false,
        };

      case "needs_changes":
        return {
          icon: "⚑",
          title: "Updates needed",
          body: canResubmit
            ? "Your profile needs a few updates before it can be approved. Fix the issues below and resubmit — you have one free resubmission."
            : "Your profile needs updates. You've used your free resubmit. Contact support to request another review.",
          tone: "warning",
          showReasons: true,
          showSummary: true,
          cta: canResubmit ? { label: "Update and resubmit →", href: buildHref } : undefined,
        };

      case "accepted":
        return {
          icon: "✓",
          title: "Profile approved",
          body: "Your profile is verified and active. You can now appear in discovery and connect with counterparties.",
          tone: "success",
          showReasons: false,
          showSummary: false,
          cta: { label: "Go to dashboard →", href: "/dashboard" },
        };

      case "rejected":
        return {
          icon: "✗",
          title: "Application not approved",
          body: "We weren't able to approve your profile at this time. Review the details below. If you think this is a mistake, contact support.",
          tone: "danger",
          showReasons: true,
          showSummary: true,
          cta: { label: "Contact support", href: "mailto:support@ventramatch.com" },
        };

      case "banned":
        return {
          icon: "✗",
          title: "Account suspended",
          body: "Your account has been suspended for violating our Terms of Service. If you believe this is an error, please contact support.",
          tone: "danger",
          showReasons: false,
          showSummary: false,
          cta: { label: "Contact support", href: "mailto:support@ventramatch.com" },
        };

      default:
        return {
          icon: "○",
          title: "Status unknown",
          body: "We couldn't load your application status. Try refreshing the page.",
          tone: "neutral",
          showReasons: false,
          showSummary: false,
        };
    }
  }

  const content = contentFor(status);

  const toneStyles: Record<StatusContent["tone"], { border: string; icon: string }> = {
    info:    { border: "var(--color-brand)",            icon: "var(--color-brand-strong)" },
    success: { border: "var(--color-brand)",            icon: "var(--color-brand-strong)" },
    warning: { border: "var(--color-warning, #d97706)", icon: "var(--color-warning, #d97706)" },
    danger:  { border: "var(--color-danger)",           icon: "var(--color-danger)" },
    neutral: { border: "var(--color-border)",           icon: "var(--color-text-faint)" },
  };

  const ts = toneStyles[content.tone];

  return (
    <main className="mx-auto w-full max-w-[680px] px-5 py-12 md:px-8">
      <Link
        href={"/dashboard" as Route}
        className="text-[12px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
      >
        ← Dashboard
      </Link>

      {/* Status card */}
      <div
        className="mt-6 rounded-sm border p-6"
        style={{
          borderTop: `3px solid ${ts.border}`,
          borderLeft: `1px solid var(--color-border)`,
          borderRight: `1px solid var(--color-border)`,
          borderBottom: `1px solid var(--color-border)`,
          background: "var(--color-surface)",
        }}
      >
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 shrink-0 text-[18px] font-bold"
            style={{ color: ts.icon }}
            aria-hidden
          >
            {content.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[18px] font-semibold tracking-tight text-[var(--color-text-strong)]">
              {content.title}
            </h1>
            <p className="mt-1.5 text-[14px] leading-[1.6] text-[var(--color-text-muted)]">
              {content.body}
            </p>

            {/* Reviewer's summary — safe user-facing copy written by the human reviewer */}
            {content.showSummary && summary && (
              <div
                className="mt-4 rounded border-l-2 py-2 pl-4 pr-3"
                style={{
                  borderLeftColor: ts.border,
                  background: "var(--color-bg)",
                }}
              >
                <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
                  Reviewer note
                </p>
                <p className="mt-1 text-[13px] leading-[1.6] text-[var(--color-text-strong)]">
                  {summary}
                </p>
              </div>
            )}

            {/* Reason-code guidance — translated to user-friendly copy */}
            {content.showReasons && reasonCodes.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
                  What to update
                </p>
                <ul className="flex flex-col gap-1.5">
                  {reasonCodes.map((code) => (
                    <li
                      key={code}
                      className="flex items-start gap-2 text-[13px] leading-[1.5] text-[var(--color-text-strong)]"
                    >
                      <span
                        className="mt-1 shrink-0 text-[8px]"
                        style={{ color: ts.border }}
                        aria-hidden
                      >
                        ●
                      </span>
                      {friendlyReason(code)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* CTA */}
            {content.cta && (
              <div className="mt-5">
                <a
                  href={content.cta.href}
                  className="inline-flex h-9 items-center rounded-sm px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: content.tone === "danger" ? "var(--color-danger)" : "var(--color-brand)" }}
                >
                  {content.cta.label}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metadata */}
      {app?.submitted_at && (
        <p className="mt-3 text-[12px] text-[var(--color-text-faint)]">
          Submitted {fmtDate(app.submitted_at)}
          {app.decided_at ? ` · Decision ${fmtDate(app.decided_at)}` : null}
        </p>
      )}

      {/* Review timeline */}
      {!["accepted", "banned"].includes(status) && (
        <section className="mt-8">
          <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--color-text-faint)]">
            How review works
          </h2>
          <div className="flex flex-col gap-0">
            {[
              {
                step: 1,
                label: "Submit your profile",
                done: ["submitted","under_review","needs_changes","accepted","rejected"].includes(status),
              },
              {
                step: 2,
                label: "Our team reviews it",
                done: ["under_review","needs_changes","accepted","rejected"].includes(status),
                active: ["submitted","under_review"].includes(status),
              },
              {
                step: 3,
                label: "Approved or feedback sent",
                done: ["accepted"].includes(status),
                active: ["needs_changes","rejected"].includes(status),
              },
              {
                step: 4,
                label: "Update and resubmit if needed",
                done: false,
                active: status === "needs_changes" && canResubmit,
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{
                      background: item.done
                        ? "var(--color-brand)"
                        : item.active
                          ? "var(--color-brand-tint)"
                          : "var(--color-surface)",
                      border: `1.5px solid ${item.done || item.active ? "var(--color-brand)" : "var(--color-border)"}`,
                      color: item.done
                        ? "white"
                        : item.active
                          ? "var(--color-brand-strong)"
                          : "var(--color-text-faint)",
                    }}
                  >
                    {item.done ? "✓" : item.step}
                  </div>
                  {i < 3 && (
                    <div
                      className="mt-0.5 h-5 w-px"
                      style={{ background: item.done ? "var(--color-brand)" : "var(--color-border)" }}
                    />
                  )}
                </div>
                <p
                  className="pb-4 pt-0.5 text-[13px] leading-[1.5]"
                  style={{
                    color: item.done
                      ? "var(--color-text-strong)"
                      : item.active
                        ? "var(--color-brand-strong)"
                        : "var(--color-text-faint)",
                    fontWeight: item.active ? 500 : 400,
                  }}
                >
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
