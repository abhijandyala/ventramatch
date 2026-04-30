import type { Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { fetchIntroById, type IntroSummary } from "@/lib/intros/query";
import { RespondPanel } from "@/components/intros/respond-panel";
import { Wordmark } from "@/components/landing/wordmark";
import type { IntroRequestStatus } from "@/types/database";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<
  IntroRequestStatus,
  { label: string; tone: "live" | "good" | "neutral" | "bad" }
> = {
  pending: { label: "Pending", tone: "live" },
  accepted: { label: "Accepted", tone: "good" },
  declined: { label: "Declined", tone: "neutral" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
  expired: { label: "Expired", tone: "bad" },
};

export default async function IntroDetailPage({
  params,
}: {
  params: Promise<{ introId: string }>;
}) {
  const { introId } = await params;

  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!session.user.onboardingCompleted) redirect("/onboarding");

  const viewerId = session.user.id;
  const intro = await fetchIntroById(introId, viewerId);
  if (!intro) notFound();

  console.log(
    `[inbox:detail] introId=${introId} viewer=${viewerId} status=${intro.status} dir=${intro.direction}`,
  );

  const isIncoming = intro.direction === "incoming";
  const isPending = intro.status === "pending";
  const senderLabel = isIncoming ? intro.otherName : "You";
  const recipientLabel = isIncoming ? "You" : intro.otherName;

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-text)]">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 px-5 backdrop-blur md:px-8">
        <Wordmark size="sm" />
        <Link
          href={"/inbox" as Route}
          className="text-[12.5px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
        >
          ← Back to inbox
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[760px] px-5 py-12 md:py-16">
        {/* Status header */}
        <header className="mb-8 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-faint)]">
              Intro request · {isIncoming ? "Incoming" : "Outgoing"}
            </p>
            <StatusPill status={intro.status} />
          </div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--color-text-strong)]">
            {senderLabel} → {recipientLabel}
          </h1>
          <p className="text-[13px] text-[var(--color-text-muted)]">
            {intro.otherStartupName
              ? `Re: ${intro.otherStartupName}`
              : intro.otherFirm
                ? `Re: ${intro.otherFirm}`
                : null}
            {intro.otherStartupName || intro.otherFirm ? " · " : ""}
            {formatDate(intro.createdAt)}
          </p>
        </header>

        {/* The message */}
        <Section title="Message">
          <p className="whitespace-pre-wrap text-[14px] leading-[1.65] text-[var(--color-text)]">
            {intro.message}
          </p>
        </Section>

        {/* Proposed times */}
        {intro.proposedTimes.length > 0 ? (
          <Section title="Proposed times">
            <ul className="flex flex-col gap-1.5">
              {intro.proposedTimes.map((iso) => (
                <li
                  key={iso}
                  className="flex items-center justify-between gap-3 border bg-[var(--color-surface)] px-3 py-2 font-mono text-[12.5px] text-[var(--color-text)]"
                  style={{
                    borderColor:
                      intro.acceptedTime === iso
                        ? "var(--color-brand)"
                        : "var(--color-border)",
                  }}
                >
                  <span>{formatLongTime(new Date(iso))}</span>
                  {intro.acceptedTime === iso ? (
                    <span
                      className="inline-flex items-center px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em]"
                      style={{
                        background: "var(--color-brand-tint)",
                        color: "var(--color-brand-strong)",
                        border: "1px solid var(--color-brand)",
                      }}
                    >
                      Confirmed
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {/* Optional link */}
        {intro.linkUrl ? (
          <Section title="Linked resource">
            <a
              href={intro.linkUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--color-brand)" }}
            >
              Open link →
            </a>
          </Section>
        ) : null}

        {/* Response (if any) */}
        {intro.responseMessage ? (
          <Section title="Reply">
            <p className="whitespace-pre-wrap text-[14px] leading-[1.65] text-[var(--color-text)]">
              {intro.responseMessage}
            </p>
            {intro.respondedAt ? (
              <p className="mt-2 text-[11.5px] text-[var(--color-text-faint)]">
                {formatDate(intro.respondedAt)}
              </p>
            ) : null}
          </Section>
        ) : null}

        {/* Action panel */}
        <div className="mt-8">
          {renderAction(intro, isIncoming, isPending)}
        </div>

        <p className="mt-12 text-center text-[11.5px] leading-[1.6] text-[var(--color-text-faint)]">
          {intro.status === "pending" ? (
            <>
              This request expires {formatDate(intro.expiresAt)} if no one
              responds.
            </>
          ) : (
            <>
              VentraMatch never shares your contact info beyond the two
              parties on this intro.
            </>
          )}
        </p>
      </main>
    </div>
  );
}

function renderAction(intro: IntroSummary, isIncoming: boolean, isPending: boolean) {
  if (!isPending) {
    return (
      <p
        className="border-l-2 px-4 py-3 text-[13px] text-[var(--color-text-muted)]"
        style={{ borderColor: "var(--color-border)" }}
      >
        This intro is {intro.status}. {intro.acceptedTime ? "Look out for a calendar invite." : null}
      </p>
    );
  }
  if (isIncoming) {
    return <RespondPanel kind="respond" introId={intro.id} proposedTimes={intro.proposedTimes} />;
  }
  return <RespondPanel kind="withdraw" introId={intro.id} />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatusPill({ status }: { status: IntroRequestStatus }) {
  const copy = STATUS_COPY[status];
  const styles =
    copy.tone === "good"
      ? { bg: "var(--color-brand-tint)", fg: "var(--color-brand-strong)", border: "var(--color-brand)" }
      : copy.tone === "live"
        ? { bg: "var(--color-surface)", fg: "var(--color-text-strong)", border: "var(--color-text-strong)" }
        : copy.tone === "bad"
          ? { bg: "var(--color-surface)", fg: "var(--color-danger)", border: "var(--color-danger)" }
          : { bg: "var(--color-surface)", fg: "var(--color-text-muted)", border: "var(--color-border)" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em]"
      style={{ background: styles.bg, color: styles.fg, border: `1px solid ${styles.border}` }}
    >
      {copy.label}
    </span>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatLongTime(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
