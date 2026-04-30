import type { Route } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { withUserRls } from "@/lib/db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ScheduledIntro = {
  id: string;
  accepted_time: Date | string;
  meeting_cancelled_at: Date | string | null;
  other_name: string;
  other_role: string | null;
};

export default async function InboxCalendarPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userId = session.user.id;

  const intros = await withUserRls<ScheduledIntro[]>(userId, async (sql) => {
    return sql<ScheduledIntro[]>`
      select ir.id, ir.accepted_time, ir.meeting_cancelled_at,
             case when ir.sender_user_id = ${userId}
                  then ru.name else su.name end as other_name,
             case when ir.sender_user_id = ${userId}
                  then ru.role else su.role end as other_role
      from public.intro_requests ir
      join public.users su on su.id = ir.sender_user_id
      join public.users ru on ru.id = ir.recipient_user_id
      where ir.status = 'accepted'
        and ir.accepted_time is not null
        and (ir.sender_user_id = ${userId} or ir.recipient_user_id = ${userId})
      order by ir.accepted_time asc
    `;
  });

  const now = new Date();
  const upcoming = intros.filter(
    (i) => !i.meeting_cancelled_at && new Date(i.accepted_time) > now,
  );
  const past = intros.filter(
    (i) => !i.meeting_cancelled_at && new Date(i.accepted_time) <= now,
  );
  const cancelled = intros.filter((i) => Boolean(i.meeting_cancelled_at));

  return (
    <>
      <header className="relative overflow-hidden border-b border-[var(--color-border)]">
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 -z-10 h-[180px]",
            "bg-[radial-gradient(60%_60%_at_15%_0%,var(--color-brand-tint)_0%,transparent_70%)]",
            "opacity-70",
          )}
        />
        <div className="mx-auto w-full max-w-[1100px] px-4 sm:px-6 py-5 sm:py-6">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
                Calendar
              </p>
              <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.015em] text-[var(--color-text)]">
                Scheduled meetings
              </h1>
            </div>
            <Link
              href={"/inbox" as Route}
              className="text-[12.5px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
            >
              ← Back to inbox
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] px-4 sm:px-6 py-6">
        <Section title={`Upcoming (${upcoming.length})`} items={upcoming} variant="upcoming" />
        <Section title={`Past (${past.length})`} items={past} variant="past" />
        {cancelled.length > 0 ? (
          <Section title={`Cancelled (${cancelled.length})`} items={cancelled} variant="cancelled" />
        ) : null}

        {intros.length === 0 ? (
          <div
            className="border border-dashed p-8 text-center"
            style={{ borderColor: "var(--color-border-strong, var(--color-border))" }}
          >
            <p className="text-[14px] font-semibold text-[var(--color-text-strong)]">
              No scheduled meetings
            </p>
            <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">
              Accept an intro request with a time to see it here.
            </p>
          </div>
        ) : null}
      </main>
    </>
  );
}

function Section({
  title,
  items,
  variant,
}: {
  title: string;
  items: ScheduledIntro[];
  variant: "upcoming" | "past" | "cancelled";
}) {
  if (items.length === 0) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-3 font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
        {title}
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map((i) => (
          <li key={i.id}>
            <Link
              href={`/inbox/${i.id}` as Route}
              className="flex items-center justify-between gap-4 border bg-[var(--color-surface)] px-4 py-3 transition-colors hover:border-[var(--color-text-faint)]"
              style={{
                borderColor: "var(--color-border)",
                opacity: variant === "cancelled" ? 0.6 : variant === "past" ? 0.75 : 1,
              }}
            >
              <div className="min-w-0">
                <p className={cn(
                  "text-[14px] font-medium",
                  variant === "cancelled"
                    ? "text-[var(--color-text-faint)] line-through"
                    : "text-[var(--color-text-strong)]",
                )}>
                  {i.other_name ?? "Someone"}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                  {i.other_role === "founder" ? "Founder" : i.other_role === "investor" ? "Investor" : "—"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-[13px] tabular-nums text-[var(--color-text-strong)]">
                  {formatDate(new Date(i.accepted_time))}
                </p>
                <p className="text-[11px] text-[var(--color-text-faint)]">
                  {formatTime(new Date(i.accepted_time))}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
