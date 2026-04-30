"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
  dismissNotificationAction,
} from "@/lib/notifications/actions";
import type { AppNotification } from "@/lib/notifications/query";

export function NotificationListClient({
  notifications,
}: {
  notifications: AppNotification[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const hasUnread = notifications.some((n) => !n.readAt);

  function markAllRead() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  }

  function markRead(id: string) {
    startTransition(async () => {
      await markNotificationReadAction({ id });
      router.refresh();
    });
  }

  function dismiss(id: string) {
    startTransition(async () => {
      await dismissNotificationAction({ id });
      router.refresh();
    });
  }

  return (
    <div>
      {hasUnread ? (
        <div className="mb-4 flex items-center justify-end">
          <button
            type="button"
            onClick={markAllRead}
            className="text-[12px] font-medium text-[var(--color-text-muted)] underline-offset-4 transition-colors hover:text-[var(--color-text-strong)] hover:underline"
          >
            Mark all as read
          </button>
        </div>
      ) : null}

      <ul className="flex flex-col gap-2">
        {notifications.map((n) => (
          <li
            key={n.id}
            className="flex items-start justify-between gap-3 border p-4 transition-colors"
            style={{
              borderColor: "var(--color-border)",
              background: n.readAt ? undefined : "var(--color-brand-tint)",
            }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-[1.55] text-[var(--color-text-strong)]">
                {notificationLabel(n.kind, n.payload)}
              </p>
              <p className="mt-1 text-[11.5px] text-[var(--color-text-faint)]">
                {relativeTime(n.createdAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {n.link ? (
                <Link
                  href={n.link as Route}
                  onClick={() => { if (!n.readAt) markRead(n.id); }}
                  className="text-[12px] font-medium text-[var(--color-brand-strong)] underline-offset-4 hover:underline"
                >
                  View →
                </Link>
              ) : null}
              {!n.readAt ? (
                <button
                  type="button"
                  onClick={() => markRead(n.id)}
                  className="text-[11px] text-[var(--color-text-faint)] hover:text-[var(--color-text-strong)]"
                >
                  Read
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => dismiss(n.id)}
                  className="text-[11px] text-[var(--color-text-faint)] hover:text-[var(--color-text-strong)]"
                >
                  Dismiss
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function notificationLabel(kind: string, payload: Record<string, unknown>): string {
  const name = (payload.counterpartyLabel ?? payload.senderName ?? payload.recipientName ?? "") as string;
  switch (kind) {
    case "match.created": return name ? `New match with ${name}` : "You have a new mutual match";
    case "intro.requested": return name ? `${name} wants to schedule a call` : "New intro request";
    case "intro.accepted": return name ? `${name} accepted your intro` : "Your intro was accepted";
    case "intro.declined": return name ? `${name} declined your intro` : "Your intro was declined";
    case "intro.withdrawn": return "An intro request was withdrawn";
    case "verification.confirmed": return "A verification was confirmed";
    case "system.announcement": return (payload.message as string) ?? "System announcement";
    default: return "Notification";
  }
}

function relativeTime(d: Date): string {
  const min = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
