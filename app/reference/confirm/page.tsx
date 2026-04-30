import { Suspense } from "react";
import { Wordmark } from "@/components/landing/wordmark";
import { ReferenceConfirmClient } from "./reference-confirm-client";

export const dynamic = "force-dynamic";

function ReferenceConfirmFallback() {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-6"
      style={{ background: "var(--color-bg)" }}
    >
      <div className="w-full max-w-[480px]">
        <div className="mb-10 flex justify-center">
          <Wordmark size="md" />
        </div>
        <div
          className="px-8 py-12 text-center"
          style={{
            background: "rgba(255,255,255,0.55)",
            backdropFilter: "blur(24px) saturate(140%)",
            WebkitBackdropFilter: "blur(24px) saturate(140%)",
            border: "1px solid rgba(255,255,255,0.45)",
          }}
        >
          <p className="text-[14px] text-[var(--color-text-muted)]">Loading…</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Public referee landing page. Search params are read inside the client child,
 * which must be wrapped in Suspense for Next.js static generation (CSR bailout).
 */
export default function ReferenceConfirmPage() {
  return (
    <Suspense fallback={<ReferenceConfirmFallback />}>
      <ReferenceConfirmClient />
    </Suspense>
  );
}
