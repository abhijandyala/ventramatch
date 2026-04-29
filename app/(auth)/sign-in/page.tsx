import type { Metadata } from "next";
import { AuthCard } from "../_components/auth-card";

export const metadata: Metadata = {
  title: "Sign in — VentraMatch",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return <AuthCard mode="sign-in" />;
}
