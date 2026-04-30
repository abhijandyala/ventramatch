import type { Route } from "next";
import Link from "next/link";

/**
 * Server component. Renders only when the viewer's account is in deletion
 * grace. The page that mounts this is responsible for passing the date
 * (typically from a single users-row read it already does).
 *
 * Sticky at the top so the user always knows their account is on the way
 * out — and one click away from the cancel control on /settings.
 */
export function DeletionPendingBanner({
  deletionRequestedAt,
}: {
  deletionRequestedAt: Date | string | null | undefined;
}) {
  if (!deletionRequestedAt) return null;
  const requested = new Date(deletionRequestedAt);
  const grace = new Date(requested.getTime() + 30 * 24 * 60 * 60 * 1000);
  const daysLeft = Math.max(0, Math.ceil((grace.getTime() - Date.now()) / 86_400_000));

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2 text-[12.5px]"
      style={{
        background: "var(--color-danger)",
        color: "white",
      }}
    >
      <p className="min-w-0 truncate">
        <strong className="font-semibold">Account deletion scheduled.</strong>{" "}
        Hard-deletes in {daysLeft} day{daysLeft === 1 ? "" : "s"}{" "}
        ({grace.toLocaleDateString()}). Discovery is paused.
      </p>
      <Link
        href={"/settings#danger" as Route}
        className="shrink-0 font-semibold underline-offset-4 hover:underline"
      >
        Cancel deletion →
      </Link>
    </div>
  );
}
