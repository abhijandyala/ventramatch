import type { ReactNode } from "react";

// AuthCard is a full-bleed split-screen layout that owns its own
// background, nav branding, and shell. This layout is a passthrough.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
