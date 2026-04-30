import type { Route } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  fetchIntrosForUser,
  fetchIntroBadgeCounts,
  type IntroDirection,
} from "@/lib/intros/query";
import { AccountStatusBanner } from "@/components/account/account-status-banner";
import { IntroCard } from "@/components/intros/intro-card";
import { InboxStatusFilter } from "@/components/intros/inbox-status-filter";
import type { AccountLabel, IntroRequestStatus } from "@/types/database";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Filter = "all" | IntroDirection;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "incoming", label: "Incoming" },
  { id: "outgoing", label: "Sent" },
];

type SearchParams = {
  view?: string;
  status?: string;
};

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!session.user.onboardingCompleted) redirect("/onboarding");

  const userId = session.user.id;
  const accountLabel = (session.user.accountLabel ?? "unverified") as AccountLabel;

  const params = await searchParams;
  const view: Filter =
    params.view === "incoming" || params.view === "outgoing" ? params.view : "all";
  const validStatuses: (IntroRequestStatus | "all")[] = [
    "all", "pending", "accepted", "declined", "withdrawn", "expired",
  ];
  const status: IntroRequestStatus | "all" =
    validStatuses.includes((params.status ?? "all") as IntroRequestStatus | "all")
      ? ((params.status ?? "all") as IntroRequestStatus | "all")
      : "all";

  const [intros, counts] = await Promise.all([
    fetchIntrosForUser(userId, { direction: view, status, limit: 100 }),
    fetchIntroBadgeCounts(userId),
  ]);

  console.log(
    `[inbox] userId=${userId} view=${view} status=${status} count=${intros.length}`,
  );

  return (
    <>
      <section className="relative overflow-hidden border-b border-[var(--color-border)]">
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 -z-10 h-[180px]",
            "bg-[radial-gradient(60%_60%_at_15%_0%,var(--color-brand-tint)_0%,transparent_70%)]",
            "opacity-70",
          )}
        />
        <div className="mx-auto w-full max-w-[1100px] px-4 sm:px-6 py-5 sm:py-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
            Inbox
          </p>
          <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.015em] text-[var(--color-text)]">
            Intro requests
          </h1>
          <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
            {counts.needsResponse > 0
              ? `${counts.needsResponse} need${counts.needsResponse === 1 ? "s" : ""} a reply from you`
              : counts.awaitingReply > 0
                ? `${counts.awaitingReply} sent · awaiting reply`
                : "Nothing pending."}
          </p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-[1100px] px-4 sm:px-6 py-6">
        <AccountStatusBanner label={accountLabel} />

        {/* Filter rows */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
          <nav className="flex items-center gap-1" aria-label="Direction filter">
            {FILTERS.map((f) => {
              const active = f.id === view;
              const href = buildUrl({ view: f.id, status });
              const badge = f.id === "incoming" ? counts.needsResponse : null;
              return (
                <Link
                  key={f.id}
                  href={href as Route}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 px-3 text-[12.5px] font-medium transition-colors",
                    active
                      ? "border bg-[var(--color-text-strong)] text-white"
                      : "border border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]",
                  )}
                  style={active ? { borderColor: "var(--color-text-strong)" } : undefined}
                >
                  {f.label}
                  {badge ? (
                    <span
                      className="grid h-4 min-w-4 place-items-center px-1 font-mono text-[10px] font-bold leading-none"
                      style={{
                        background: active ? "white" : "var(--color-brand)",
                        color: active ? "var(--color-text-strong)" : "white",
                      }}
                    >
                      {badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <InboxStatusFilter current={status} view={view} />
        </div>

        {intros.length === 0 ? (
          <EmptyState view={view} status={status} />
        ) : (
          <ul className="grid grid-cols-1 gap-3">
            {intros.map((intro) => (
              <li key={intro.id}>
                <IntroCard intro={intro} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function buildUrl(params: { view: Filter; status: IntroRequestStatus | "all" }): string {
  const search = new URLSearchParams();
  if (params.view !== "all") search.set("view", params.view);
  if (params.status !== "all") search.set("status", params.status);
  const q = search.toString();
  return q ? `/inbox?${q}` : "/inbox";
}

function EmptyState({ view, status }: { view: Filter; status: IntroRequestStatus | "all" }) {
  const tailored =
    view === "outgoing"
      ? {
          headline: "You haven't sent any intros yet",
          body: "Open a match and request a call when you're ready.",
          cta: { label: "Go to matches", href: "/matches" },
        }
      : view === "incoming"
        ? {
            headline: "Nothing in your inbox",
            body: "When someone you've matched with requests a call, it'll show up here.",
            cta: { label: "Open feed", href: "/feed" },
          }
        : status !== "all"
          ? {
              headline: `No ${status} intros`,
              body: "Try clearing the status filter.",
              cta: { label: "Show all", href: "/inbox" },
            }
          : {
              headline: "Nothing here yet",
              body: "Match with someone first, then you can request a call from their profile.",
              cta: { label: "Find matches", href: "/feed" },
            };

  return (
    <div
      className="border border-dashed p-8 text-center"
      style={{ borderColor: "var(--color-border-strong, var(--color-border))" }}
    >
      <p className="text-[14px] font-semibold text-[var(--color-text-strong)]">
        {tailored.headline}
      </p>
      <p className="mt-2 text-[13px] leading-[1.5] text-[var(--color-text-muted)]">
        {tailored.body}
      </p>
      <Link
        href={tailored.cta.href as Route}
        className="mt-4 inline-flex h-9 items-center px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        style={{ background: "var(--color-text-strong)" }}
      >
        {tailored.cta.label}
      </Link>
    </div>
  );
}
