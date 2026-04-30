import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ProfileTabs } from "./_components/ProfileTabs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profiles",
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!session.user.onboardingCompleted) redirect("/onboarding");

  const role = session.user.role as "founder" | "investor" | null;
  const name = session.user.name ?? "";
  const email = session.user.email ?? "";

  return <ProfileTabs role={role} name={name} email={email} />;
}
