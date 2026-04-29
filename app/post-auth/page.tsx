import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function PostAuthPage() {
  const session = await auth();
  console.log(`[post-auth] session userId=${session?.user?.id ?? "none"} onboarded=${session?.user?.onboardingCompleted ?? "no-session"}`);

  if (!session?.user) {
    console.log("[post-auth] → redirect /sign-in (no session)");
    redirect("/sign-in");
  }

  if (!session.user.onboardingCompleted) {
    console.log("[post-auth] → redirect /onboarding (not onboarded)");
    redirect("/onboarding");
  }

  console.log("[post-auth] → redirect /homepage (onboarded)");
  redirect("/homepage");
}
