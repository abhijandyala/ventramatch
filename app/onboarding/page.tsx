import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { OnboardingWizard } from "./_components/onboarding-wizard";

export const metadata: Metadata = {
  title: "Welcome — VentraMatch",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.onboardingCompleted) {
    redirect("/dashboard");
  }

  return <OnboardingWizard />;
}
