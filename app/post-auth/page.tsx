import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { NEEDS_BUILD_STATES } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function PostAuthPage() {
  const session = await auth();
  console.log(
    `[post-auth] session userId=${session?.user?.id ?? "none"} onboarded=${session?.user?.onboardingCompleted ?? "no-session"} state=${session?.user?.profileState ?? "?"}`,
  );

  if (!session?.user) {
    console.log("[post-auth] → redirect /sign-in (no session)");
    redirect("/sign-in");
  }

  if (!session.user.onboardingCompleted) {
    console.log("[post-auth] → redirect /onboarding (not onboarded)");
    redirect("/onboarding");
  }

  // Onboarding-completed but profile_state stuck at 'none'/'basic' means the
  // /build wizard hasn't been started yet. Send users there before the
  // marketing-style /homepage so they get pointed at the next step.
  if (NEEDS_BUILD_STATES.includes(session.user.profileState)) {
    const target =
      session.user.role === "investor" ? "/build/investor" : "/build";
    console.log(`[post-auth] → redirect ${target} (profile not built yet, state=${session.user.profileState})`);
    redirect(target);
  }

  console.log("[post-auth] → redirect /homepage (profile built)");
  redirect("/homepage");
}
