"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { dismissDuplicateAction } from "./actions";

export function DuplicateActions({
  candidateId,
}: {
  candidateId: string;
  adminId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function dismiss() {
    startTransition(async () => {
      await dismissDuplicateAction({ candidateId });
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={dismiss}
      disabled={isPending}
      className="inline-flex h-9 items-center gap-1.5 border px-3 text-[12.5px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)] disabled:opacity-50"
      style={{ borderColor: "var(--color-border)" }}
    >
      {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      Dismiss
    </button>
  );
}
