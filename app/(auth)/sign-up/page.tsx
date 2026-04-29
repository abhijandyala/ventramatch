import type { Metadata } from "next";
import { AuthCard } from "../_components/auth-card";

export const metadata: Metadata = {
  title: "Create account — VentraMatch",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return <AuthCard mode="sign-up" />;
}
