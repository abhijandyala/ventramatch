import type { Route } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { fetchPendingDuplicates } from "@/lib/admin/duplicates";
import { DuplicateActions } from "./duplicate-actions-client";

export const dynamic = "force-dynamic";

export default async function AdminDuplicatesPage() {
  const { userId: adminId } = await requireAdmin("reviewer");
  const candidates = await fetchPendingDuplicates();

  return (
    <main className="mx-auto w-full max-w-[1200px] px-5 py-8 md:px-8">
      <header className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
          Admin
        </p>
        <h1 className="mt-1 text-[20px] font-semibold tracking-tight text-[var(--color-text-strong)]">
          Duplicate candidates ({candidates.length})
        </h1>
      </header>

      {candidates.length === 0 ? (
        <p className="text-[13px] text-[var(--color-text-muted)]">No pending duplicates.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {candidates.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-4 border bg-[var(--color-surface)] p-4"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={`/admin/users/${c.userA.id}` as Route}
                    className="text-[13px] font-medium text-[var(--color-text-strong)] hover:underline"
                  >
                    {c.userA.name ?? c.userA.email}
                  </Link>
                  <span className="text-[11px] text-[var(--color-text-faint)]">↔</span>
                  <Link
                    href={`/admin/users/${c.userB.id}` as Route}
                    className="text-[13px] font-medium text-[var(--color-text-strong)] hover:underline"
                  >
                    {c.userB.name ?? c.userB.email}
                  </Link>
                </div>
                <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                  {c.reason} · score {c.score.toFixed(1)} · {c.createdAt.toLocaleDateString()}
                </p>
              </div>
              <DuplicateActions candidateId={c.id} adminId={adminId} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
