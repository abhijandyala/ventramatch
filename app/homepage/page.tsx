import { redirect } from "next/navigation";
import { auth } from "@/auth";
import HomePageClient from "./client";

export const dynamic = "force-dynamic";

export default async function PostAuthHomePage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const role = (session.user.role as "founder" | "investor") ?? "founder";

  return <HomePageClient role={role} />;
}
