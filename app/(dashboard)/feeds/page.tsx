import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { FeedsClient } from "./_components/FeedsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Feeds",
};

export default async function FeedsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!session.user.onboardingCompleted) redirect("/onboarding");

  const role = session.user.role as "founder" | "investor" | null;
  const name = session.user.name ?? "";

  return <FeedsClient role={role} name={name} />;
}
