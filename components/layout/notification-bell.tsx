"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { markNotificationReadAction } from "@/lib/notifications/actions";
import type { AppNotification } from "@/lib/notifications/query";

/**
 * Bell icon with badge + dropdown for the nav bar.
 *
 * Two data paths:
 *   1. SSR: server fetches unreadCount + recent (top 10) and passes as
 *      props. This avoids a loading flicker on initial render.
 *   2. Polling: every 60s, re-fetch via router.refresh() to pick up new
 *      notifications without a page reload. Full-blown SSE/WebSocket is
 *      Sprint 15+.
 */
export function NotificationBell({
  unreadCount: initialUnread,
  recent: initialRecent,
}: {
  unreadCount: number;
  recent: AppNotification[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const [, startTransition] = useTransition();

  // Poll for new notifications every 60s.
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 60_000);
    return () => clearInterval(interval);
  }, [router]);

  // Outside-click dismiss.
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  function markRead(id: string) {
    startTransition(async () => {
      await markNotificationReadAction({ id });
      router.refresh();
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Notifications${initialUnread > 0 ? ` (${initialUnread} unread)` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-9 w-9 place-items-center text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-text-strong)]"
      >
        <Bell size={18} strokeWidth={1.75} />
        {initialUnread > 0 ? (
          <span
            className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 font-mono text-[9px] font-bold leading-none text-white"
            style={{ background: "var(--color-brand)" }}
          >
            {initialUnread > 99 ? "99+" : initialUnread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-10 z-50 flex w-[320px] flex-col border bg-[color:var(--color-bg)] shadow-lg"
          style={{ borderColor: "var(--color-border)" }}
        >
          <header className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-2.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[color:var(--color-text-faint)]">
              Notifications
            </span>
            <Link
              href={"/notifications" as Route}
              onClick={() => setOpen(false)}
              className="text-[11.5px] font-medium text-[color:var(--color-text-muted)] underline-offset-4 hover:underline"
            >
              View all →
            </Link>
          </header>

          {initialRecent.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-[color:var(--color-text-muted)]">
              Nothing yet. We&apos;ll notify you here when something happens.
            </p>
          ) : (
            <ul className="max-h-[360px] overflow-y-auto">
              {initialRecent.map((n) => (
                <li
                  key={n.id}
                  className="flex items-start gap-3 border-b border-[color:var(--color-border)] px-4 py-3 last:border-none"
                  style={{
                    background: n.readAt ? undefined : "var(--color-brand-tint)",
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] leading-[1.5] text-[color:var(--color-text-strong)]">
                      {notificationCopy(n.kind, n.payload)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[color:var(--color-text-faint)]">
                      {relativeTime(n.createdAt)}
                    </p>
                  </div>
                  {n.link && !n.readAt ? (
                    <Link
                      href={n.link as Route}
                      onClick={() => {
                        markRead(n.id);
                        setOpen(false);
                      }}
                      className="shrink-0 text-[11px] font-medium text-[color:var(--color-brand-strong)] underline-offset-4 hover:underline"
                    >
                      View
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function notificationCopy(kind: string, payload: Record<string, unknown>): string {
  const name = (payload.counterpartyLabel ?? payload.senderName ?? payload.recipientName ?? "") as string;
  switch (kind) {
    case "match.created":
      return name ? `New match with ${name}` : "You have a new mutual match";
    case "intro.requested":
      return name ? `${name} wants to schedule a call` : "New intro request";
    case "intro.accepted":
      return name ? `${name} accepted your intro` : "Your intro was accepted";
    case "intro.declined":
      return name ? `${name} declined your intro` : "Your intro was declined";
    case "intro.withdrawn":
      return "An intro request was withdrawn";
    case "verification.confirmed":
      return "A verification was confirmed";
    case "system.announcement":
      return (payload.message as string) ?? "System announcement";
    default:
      return "New notification";
  }
}

function relativeTime(d: Date): string {
  const min = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
