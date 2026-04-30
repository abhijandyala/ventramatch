import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { HelpClient } from "./_components/HelpClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Help",
};

export default async function HelpPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const role = session.user.role as "founder" | "investor" | null;
  const name = session.user.name ?? "";

  return <HelpClient role={role} name={name} />;
}
