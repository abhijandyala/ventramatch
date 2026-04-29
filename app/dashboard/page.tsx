import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Dashboard — VentraMatch",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireOnboardedUser();

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-6 py-16">
      <p className="font-mono text-xs tracking-wide text-[var(--color-text-faint)] uppercase">
        v0.0 — placeholder
      </p>
      <h1 className="font-serif text-4xl tracking-tight text-[var(--color-text)]">
        Welcome, {user.name ?? user.email}.
      </h1>
      <p className="max-w-prose text-[var(--color-text-muted)]">
        The real dashboard ships with the founder analytics surface. For now this is just
        a landing pad for authenticated users.
      </p>
    </main>
  );
}
