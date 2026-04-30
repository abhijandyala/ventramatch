import { Suspense } from "react";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { FeedPageClient } from "./_components/FeedPageClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Feed",
};

export default async function FeedPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!session.user.onboardingCompleted) redirect("/onboarding");

  const role = session.user.role as "founder" | "investor" | null;
  const name = session.user.name ?? "";
  const firstName = session.user.name?.split(" ")[0] ?? "there";

  return (
    <Suspense fallback={<FeedSkeleton />}>
      <FeedPageClient role={role} name={name} firstName={firstName} />
    </Suspense>
  );
}

function FeedSkeleton() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: "var(--color-bg)" }}
    >
      <span className="text-[13px]" style={{ color: "var(--color-text-faint)" }}>
        Loading feed…
      </span>
    </div>
  );
}
