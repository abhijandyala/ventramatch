import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ProfileTabs } from "./_components/ProfileTabs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profiles",
};

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function ProfilePage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!session.user.onboardingCompleted) redirect("/onboarding");

  const role = session.user.role as "founder" | "investor" | null;
  const name = session.user.name ?? "";
  const email = session.user.email ?? "";

  const { tab } = await searchParams;
  const validTabs = ["personal", "founder", "investor", "settings"] as const;
  type TabId = (typeof validTabs)[number];
  const initialTab = validTabs.includes(tab as TabId) ? (tab as TabId) : undefined;

  return <ProfileTabs role={role} name={name} email={email} initialTab={initialTab} />;
}
