"use server";

import { signIn } from "@/auth";

/**
 * Start OAuth account-linking from inside the onboarding wizard.
 *
 * The user is already signed in (Credentials, Google, LinkedIn, etc.) and
 * wants to attach an additional provider so we can pull data from it later
 * (LinkedIn for work history, GitHub for repos). NextAuth's signIn handles
 * the OAuth dance; the adapter's linkAccount attaches the new provider
 * row to the existing user (allowDangerousEmailAccountLinking is on, so
 * matching email also works).
 *
 * After the redirect-back the user lands on /post-auth which routes them
 * forward through the rest of the onboarding flow.
 */
export async function connectProviderAction(provider: "linkedin" | "github") {
  console.log(`[connect] starting ${provider} link flow`);
  await signIn(provider, { redirectTo: "/onboarding?connected=" + provider });
}
