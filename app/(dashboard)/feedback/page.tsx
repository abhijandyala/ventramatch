import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { FeedbackClient } from "./_components/FeedbackClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Feedback",
};

export default async function FeedbackPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const role = session.user.role as "founder" | "investor" | null;
  const name = session.user.name ?? "";
  const email = session.user.email ?? "";
  const userId = session.user.id;
  const avatarSrc = session.user.image ?? null;

  return (
    <FeedbackClient
      role={role}
      name={name}
      email={email}
      userId={userId}
      avatarSrc={avatarSrc}
    />
  );
}
