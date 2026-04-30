import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AccountStatusBanner } from "@/components/account/account-status-banner";
import type { AccountLabel } from "@/types/database";
import HomePageClient from "./client";

export const dynamic = "force-dynamic";

export default async function PostAuthHomePage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const role = (session.user.role as "founder" | "investor") ?? "founder";
  const accountLabel = (session.user.accountLabel ?? "unverified") as AccountLabel;
  const name = session.user.name ?? "";

  return (
    <>
      <AccountStatusBanner label={accountLabel} />
      <HomePageClient role={role} name={name} />
    </>
  );
}
