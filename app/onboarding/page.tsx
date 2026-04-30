import { Suspense } from "react";
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
  console.log(`[onboarding] userId=${user.id} onboarded=${user.onboardingCompleted}`);

  if (user.onboardingCompleted) {
    console.log("[onboarding] → redirect /homepage (already onboarded)");
    redirect("/homepage");
  }

  return (
    <Suspense fallback={null}>
      <OnboardingWizard />
    </Suspense>
  );
}
