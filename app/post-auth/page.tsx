import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function PostAuthPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  if (!session.user.onboardingCompleted) {
    redirect("/onboarding");
  }

  redirect("/dashboard");
}
