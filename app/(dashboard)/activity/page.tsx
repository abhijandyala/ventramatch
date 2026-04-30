import type { Route } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { fetchActivityTimeline, type ActivityItem } from "@/lib/activity/query";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<ActivityItem["kind"], string> = {
  view: "Profile view",
  match: "Match",
  intro_sent: "Intro sent",
  intro_received: "Intro received",
  verification: "Verification",
  system: "System",
};

const KIND_COLOR: Record<ActivityItem["kind"], string> = {
  view: "var(--color-text-faint)",
  match: "var(--color-brand-strong)",
  intro_sent: "var(--color-text-strong)",
  intro_received: "var(--color-text-strong)",
  verification: "var(--color-brand)",
  system: "var(--color-text-muted)",
};

export default async function ActivityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const items = await fetchActivityTimeline(session.user.id, { limit: 50 });

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
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
            Activity
          </p>
          <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.015em] text-[var(--color-text)]">
            Your timeline
          </h1>
          <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
            Everything that happened on your account, chronologically.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] px-4 sm:px-6 py-6">
        {items.length === 0 ? (
          <div
            className="border border-dashed p-8 text-center"
            style={{ borderColor: "var(--color-border-strong, var(--color-border))" }}
          >
            <p className="text-[14px] font-semibold text-[var(--color-text-strong)]">
              No activity yet
            </p>
            <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">
              As you match with people, send intros, and get profile views, it&apos;ll
              show up here.
            </p>
            <Link
              href={"/feed" as Route}
              className="mt-4 inline-flex h-9 items-center px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--color-text-strong)" }}
            >
              Open feed
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col">
            {items.map((item, i) => (
              <li
                key={`${item.kind}-${i}`}
                className="flex items-start gap-4 border-b border-[var(--color-border)] py-4 last:border-none"
              >
                <span
                  className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full"
                  style={{ background: KIND_COLOR[item.kind] }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  {item.link ? (
                    <Link
                      href={item.link as Route}
                      className="text-[13.5px] leading-[1.55] text-[var(--color-text-strong)] hover:underline"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <p className="text-[13.5px] leading-[1.55] text-[var(--color-text-strong)]">
                      {item.label}
                    </p>
                  )}
                  <p className="mt-0.5 text-[11.5px] text-[var(--color-text-faint)]">
                    <span className="font-medium" style={{ color: KIND_COLOR[item.kind] }}>
                      {KIND_LABEL[item.kind]}
                    </span>
                    {" · "}
                    {relativeTime(item.ts)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function relativeTime(d: Date): string {
  const min = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString();
}
