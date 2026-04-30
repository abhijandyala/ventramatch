import { redirect } from "next/navigation";
import Link from "next/link";
import { Wordmark } from "@/components/landing/wordmark";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ token?: string; identifier?: string }>;

/**
 * Intermediate page reached only after /api/auth/verify validated the link.
 * The verification token is consumed by the form POST below, not by inbox
 * security scanners that prefetch URLs in incoming mail.
 */
export default async function ConfirmVerifyPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { token = "", identifier = "" } = await searchParams;

  if (!token || !identifier) {
    redirect("/verify-email?error=invalid");
  }

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-6"
      style={{ background: "var(--color-bg)" }}
    >
      <div className="w-full max-w-[440px]">
        <div className="mb-10 flex justify-center">
          <Wordmark size="md" />
        </div>

        <div
          className="px-8 py-10"
          style={{
            background: "rgba(255,255,255,0.55)",
            backdropFilter: "blur(24px) saturate(140%)",
            WebkitBackdropFilter: "blur(24px) saturate(140%)",
            border: "1px solid rgba(255,255,255,0.45)",
          }}
        >
          <p className="text-[11px] font-medium tracking-[0.08em] uppercase text-[var(--color-brand)]">
            One more step
          </p>
          <h1
            className="mt-2 text-[24px] font-semibold tracking-tight text-[var(--color-text-strong)]"
            style={{ lineHeight: 1.15 }}
          >
            Verify your email
          </h1>

          <p className="mt-4 text-[14px] leading-[1.6] text-[var(--color-text-muted)]">
            Confirm to verify{" "}
            <span className="font-medium text-[var(--color-text-strong)]">{identifier}</span>{" "}
            and finish signing in.
          </p>

          <form method="POST" action="/api/auth/verify" className="mt-7 flex flex-col gap-3">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="identifier" value={identifier} />
            <button
              type="submit"
              className="h-11 w-full bg-[var(--color-brand)] px-5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ borderRadius: "var(--radius)" }}
            >
              Verify your email
            </button>
            <Link
              href="/sign-in"
              className="h-11 w-full inline-flex items-center justify-center px-5 text-[14px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
            >
              Cancel
            </Link>
          </form>

          <p className="mt-7 text-[12px] leading-[1.6] text-[var(--color-text-faint)]">
            This extra click stops corporate inbox scanners from burning your link before you get to it.
          </p>
        </div>
      </div>
    </div>
  );
}
