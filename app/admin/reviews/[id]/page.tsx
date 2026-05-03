import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { withUserRls } from "@/lib/db";
import { ReviewActionsForm } from "./review-actions-form";

export const dynamic = "force-dynamic";

type ApplicationDetail = {
  id: string;
  user_id: string;
  status: string;
  submitted_at: Date | string | null;
  resubmit_count: number;
  bot_recommendation: string | null;
  bot_confidence: number | null;
  ruleset_version: string | null;
  decision_reason_codes: string[] | null;
  decision_summary: string | null;
  decided_by: string | null;
  decided_at: Date | string | null;
  bot_recommended_at: Date | string | null;
  last_bot_review_at: Date | string | null;
  user_email: string;
  user_name: string | null;
  user_role: "founder" | "investor" | null;
  account_label: string;
};

type StartupProfile = {
  name: string;
  one_liner: string | null;
  industry: string | null;
  stage: string | null;
  raise_amount: number | null;
  traction: string | null;
  location: string | null;
  website: string | null;
  deck_url: string | null;
};

type InvestorProfile = {
  name: string;
  firm: string | null;
  thesis: string | null;
  check_min: number | null;
  check_max: number | null;
  stages: string[] | null;
  sectors: string[] | null;
  geographies: string[] | null;
  is_active: boolean | null;
};

type ReviewRow = {
  reviewer_kind: string;
  reviewer_id: string | null;
  verdict: string;
  confidence: number | null;
  flags: string[] | null;
  notes: string | null;
  created_at: Date | string;
};

export default async function AdminReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin("reviewer");
  const { id: applicationId } = await params;

  const app = await withUserRls<ApplicationDetail | null>(null, async (sql) => {
    const rows = await sql<ApplicationDetail[]>`
      select
        a.id, a.user_id, a.status, a.submitted_at, a.resubmit_count,
        a.bot_recommendation, a.bot_confidence, a.ruleset_version,
        a.decision_reason_codes, a.decision_summary,
        a.decided_by, a.decided_at,
        a.bot_recommended_at,
        (a.last_bot_review_at) as last_bot_review_at,
        u.email    as user_email,
        u.name     as user_name,
        u.role     as user_role,
        u.account_label
      from public.applications a
      join public.users u on u.id = a.user_id
      where a.id = ${applicationId}
      limit 1
    `;
    return rows[0] ?? null;
  });

  if (!app) notFound();

  const [startupProfile, investorProfile, reviewHistory] = await Promise.all([
    app.user_role === "founder"
      ? withUserRls<StartupProfile | null>(null, async (sql) => {
          const rows = await sql<StartupProfile[]>`
            select name, one_liner, industry, stage, raise_amount,
                   traction, location, website, deck_url
            from public.startups where user_id = ${app.user_id} limit 1
          `;
          return rows[0] ?? null;
        })
      : Promise.resolve(null),

    app.user_role === "investor"
      ? withUserRls<InvestorProfile | null>(null, async (sql) => {
          const rows = await sql<InvestorProfile[]>`
            select name, firm, thesis, check_min, check_max,
                   stages, sectors, geographies, is_active
            from public.investors where user_id = ${app.user_id} limit 1
          `;
          return rows[0] ?? null;
        })
      : Promise.resolve(null),

    withUserRls<ReviewRow[]>(null, async (sql) =>
      sql<ReviewRow[]>`
        select reviewer_kind, reviewer_id, verdict, confidence, flags, notes, created_at
        from public.application_reviews
        where application_id = ${applicationId}
        order by created_at desc
        limit 20
      `,
    ),
  ]);

  function fmtDate(ts: Date | string | null) {
    if (!ts) return "—";
    return new Date(ts).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function fmtUSD(n: number | null) {
    if (n == null) return "—";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`;
    return `$${n}`;
  }

  function Badge({
    label,
    color = "neutral",
  }: {
    label: string;
    color?: "red" | "orange" | "yellow" | "green" | "neutral";
  }) {
    const cls = {
      red:     "bg-red-600 text-white",
      orange:  "bg-orange-500 text-white",
      yellow:  "bg-yellow-500 text-black",
      green:   "bg-green-600 text-white",
      neutral: "bg-[var(--color-surface)] text-[var(--color-text-muted)]",
    }[color];
    return (
      <span
        className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${cls}`}
      >
        {label.replace(/_/g, " ")}
      </span>
    );
  }

  function recColor(rec: string | null): "red" | "orange" | "yellow" | "green" | "neutral" {
    if (rec === "ban" || rec === "decline") return "red";
    if (rec === "flag")          return "orange";
    if (rec === "needs_changes") return "yellow";
    if (rec === "accept")        return "green";
    return "neutral";
  }

  function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] uppercase tracking-wider text-[var(--color-text-faint)]">
          {label}
        </span>
        <span className="text-[13px] text-[var(--color-text-strong)]">{value ?? "—"}</span>
      </div>
    );
  }

  const canReview = ["submitted", "under_review", "needs_changes"].includes(app.status);
  const botReasonCodes = app.decision_reason_codes?.filter(Boolean) ?? [];

  return (
    <main className="mx-auto w-full max-w-[960px] px-5 py-8 md:px-8">
      <Link
        href={"/admin/reviews" as Route}
        className="text-[12px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
      >
        ← Back to queue
      </Link>

      {/* Application header */}
      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--color-text-strong)]">
            {startupProfile?.name ?? investorProfile?.name ?? app.user_name ?? "Unnamed"}
          </h1>
          <p className="mt-1 font-mono text-[13px] text-[var(--color-text-muted)]">
            {app.user_email}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-[var(--color-text-faint)]">
            application {app.id}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge label={app.status} />
          {app.bot_recommendation && (
            <Badge label={`Bot: ${app.bot_recommendation}`} color={recColor(app.bot_recommendation)} />
          )}
        </div>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Left column: application + profile */}
        <div className="flex flex-col gap-6">
          {/* Application metadata */}
          <section className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--color-text-faint)]">
              Application
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Status"    value={app.status} />
              <Field label="Role"      value={app.user_role ?? "—"} />
              <Field label="Submitted" value={fmtDate(app.submitted_at)} />
              <Field label="Resubmits" value={app.resubmit_count} />
              <Field label="Account"   value={app.account_label} />
            </div>
          </section>

          {/* Bot recommendation */}
          <section className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--color-text-faint)]">
              Bot recommendation
            </h2>
            {app.bot_recommendation ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Badge
                    label={app.bot_recommendation.replace(/_/g, " ")}
                    color={recColor(app.bot_recommendation)}
                  />
                  {app.bot_confidence != null && (
                    <span className="text-[13px] text-[var(--color-text-muted)]">
                      {Math.round(app.bot_confidence * 100)}% confidence
                    </span>
                  )}
                </div>
                {botReasonCodes.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[11px] uppercase tracking-wider text-[var(--color-text-faint)]">
                      Reason codes
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {botReasonCodes.map((code) => (
                        <span
                          key={code}
                          className="rounded bg-[var(--color-bg)] px-2 py-0.5 font-mono text-[11px] text-[var(--color-text-muted)]"
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-[var(--color-text-faint)]">
                  Ruleset: {app.ruleset_version ?? "—"} · Reviewed: {fmtDate(app.last_bot_review_at)}
                </p>
              </div>
            ) : (
              <p className="text-[13px] text-[var(--color-text-faint)]">
                No bot review yet — run{" "}
                <code className="font-mono text-[12px]">quality_review_bot_writes</code> flag to enable.
              </p>
            )}
          </section>

          {/* Profile data */}
          {startupProfile && (
            <section className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--color-text-faint)]">
                Startup profile
              </h2>
              <div className="flex flex-col gap-3">
                <Field label="Name" value={startupProfile.name} />
                <Field label="One-liner" value={startupProfile.one_liner} />
                <Field label="Industry" value={startupProfile.industry} />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Stage"  value={startupProfile.stage} />
                  <Field label="Raise"  value={fmtUSD(startupProfile.raise_amount)} />
                </div>
                <Field label="Location" value={startupProfile.location} />
                <Field label="Website"  value={startupProfile.website} />
                <Field label="Traction" value={startupProfile.traction} />
              </div>
            </section>
          )}

          {investorProfile && (
            <section className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--color-text-faint)]">
                Investor profile
              </h2>
              <div className="flex flex-col gap-3">
                <Field label="Name"   value={investorProfile.name} />
                <Field label="Firm"   value={investorProfile.firm} />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Check min" value={fmtUSD(investorProfile.check_min)} />
                  <Field label="Check max" value={fmtUSD(investorProfile.check_max)} />
                </div>
                <Field label="Stages"     value={investorProfile.stages?.join(", ")} />
                <Field label="Sectors"    value={investorProfile.sectors?.join(", ")} />
                <Field label="Geographies" value={investorProfile.geographies?.join(", ")} />
                <Field label="Is active"  value={investorProfile.is_active ? "Yes" : "No"} />
                {investorProfile.thesis && (
                  <div>
                    <p className="mb-1 text-[11px] uppercase tracking-wider text-[var(--color-text-faint)]">
                      Thesis
                    </p>
                    <p className="whitespace-pre-wrap text-[13px] text-[var(--color-text-strong)]">
                      {investorProfile.thesis}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Right column: review history + actions */}
        <div className="flex flex-col gap-6">
          {/* Review history */}
          {reviewHistory.length > 0 && (
            <section className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--color-text-faint)]">
                Review history
              </h2>
              <div className="flex flex-col gap-4">
                {reviewHistory.map((rev, i) => (
                  <div
                    key={i}
                    className="border-b border-[var(--color-border)] pb-4 last:border-none last:pb-0"
                  >
                    <div className="flex items-center gap-2">
                      <Badge label={rev.verdict} color={recColor(rev.verdict)} />
                      <span className="text-[11px] text-[var(--color-text-faint)]">
                        {rev.reviewer_kind === "human" ? "Human" : "Bot"} ·{" "}
                        {fmtDate(rev.created_at)}
                      </span>
                    </div>
                    {rev.confidence != null && (
                      <p className="mt-1 text-[11px] text-[var(--color-text-faint)]">
                        Confidence: {Math.round(rev.confidence * 100)}%
                      </p>
                    )}
                    {rev.flags && rev.flags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {rev.flags.map((f) => (
                          <span
                            key={f}
                            className="rounded bg-[var(--color-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text-faint)]"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                    {rev.notes && (
                      <p className="mt-1.5 text-[12px] italic text-[var(--color-text-muted)]">
                        "{rev.notes}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Human review actions */}
          {canReview ? (
            <section className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[var(--color-text-faint)]">
                Your decision
              </h2>
              <ReviewActionsForm
                applicationId={app.id}
                prefillReasonCodes={botReasonCodes}
              />
            </section>
          ) : (
            <section className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <p className="text-[13px] text-[var(--color-text-muted)]">
                This application status is{" "}
                <strong className="text-[var(--color-text-strong)]">{app.status}</strong> — no
                further action available here.
              </p>
              {app.decided_by && (
                <p className="mt-2 text-[12px] text-[var(--color-text-faint)]">
                  Decided by: {app.decided_by} · {fmtDate(app.decided_at)}
                </p>
              )}
              {app.decision_summary && (
                <p className="mt-1 text-[13px] italic text-[var(--color-text-muted)]">
                  "{app.decision_summary}"
                </p>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
