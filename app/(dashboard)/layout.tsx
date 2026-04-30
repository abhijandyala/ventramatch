import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import { DeletionPendingBanner } from "@/components/account/deletion-pending-banner";

/**
 * Layout for the (dashboard) route group: dashboard, feed, matches, inbox,
 * settings, build pages.
 *
 * Single responsibility for now: read the viewer's deletion_requested_at
 * once and surface a sticky banner on EVERY authed page. We deliberately
 * mount this in the dashboard route-group rather than the root layout so
 * unauthenticated visitors never trigger a DB hit.
 */
export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  let deletionRequestedAt: Date | string | null = null;

  if (session?.user?.id) {
    try {
      deletionRequestedAt = await withUserRls<Date | string | null>(
        session.user.id,
        async (sql) => {
          const rows = await sql<{ deletion_requested_at: Date | string | null }[]>`
            select deletion_requested_at from public.users where id = ${session.user.id} limit 1
          `;
          return rows[0]?.deletion_requested_at ?? null;
        },
      );
    } catch (err) {
      console.warn("[layout:dashboard] could not load deletion state", err);
    }
  }

  return (
    <>
      <DeletionPendingBanner deletionRequestedAt={deletionRequestedAt} />
      {children}
    </>
  );
}
