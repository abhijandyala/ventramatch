"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { IntroRequestStatus } from "@/types/database";

const OPTIONS: { id: IntroRequestStatus | "all"; label: string }[] = [
  { id: "all", label: "Any status" },
  { id: "pending", label: "Pending" },
  { id: "accepted", label: "Accepted" },
  { id: "declined", label: "Declined" },
  { id: "expired", label: "Expired" },
];

/**
 * Tiny client island just to wire the status dropdown to a router push.
 * Keeps the inbox page itself a pure server component.
 */
export function InboxStatusFilter({
  current,
  view,
}: {
  current: IntroRequestStatus | "all";
  view: "all" | "incoming" | "outgoing";
}) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as IntroRequestStatus | "all";
    const search = new URLSearchParams();
    if (view !== "all") search.set("view", view);
    if (next !== "all") search.set("status", next);
    const q = search.toString();
    router.push((q ? `/inbox?${q}` : "/inbox") as Route);
  }

  return (
    <select
      aria-label="Status filter"
      value={current}
      onChange={handleChange}
      className="border bg-[var(--color-surface)] px-3 py-1.5 text-[12.5px] text-[var(--color-text)] outline-none"
      style={{ borderColor: "var(--color-border)" }}
    >
      {OPTIONS.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
