import type { Route } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { fetchRecent } from "@/lib/notifications/query";
import { NotificationListClient } from "@/components/layout/notification-list-client";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const notifications = await fetchRecent(session.user.id, { limit: 50 });

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
            Notifications
          </p>
          <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.015em] text-[var(--color-text)]">
            All notifications
          </h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] px-4 sm:px-6 py-6">
        {notifications.length === 0 ? (
          <div
            className="border border-dashed p-8 text-center"
            style={{ borderColor: "var(--color-border-strong, var(--color-border))" }}
          >
            <p className="text-[14px] font-semibold text-[var(--color-text-strong)]">
              No notifications yet
            </p>
            <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">
              When someone matches with you, responds to an intro, or confirms a
              verification, it&apos;ll show up here.
            </p>
          </div>
        ) : (
          <NotificationListClient notifications={notifications} />
        )}
      </main>
    </>
  );
}
