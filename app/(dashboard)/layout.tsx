import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import { DeletionPendingBanner } from "@/components/account/deletion-pending-banner";
import { VersionBumpModal } from "@/components/legal/version-bump-modal";
import { LEGAL_TOS_VERSION, LEGAL_PRIVACY_VERSION } from "@/lib/legal/versions";

/**
 * Layout for the (dashboard) route group. Two responsibilities:
 *   1. DeletionPendingBanner (Sprint 7)
 *   2. LegalVersionBumpModal (Sprint 10.E)
 *
 * One DB query per page render fetches both columns.
 */
export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  let deletionRequestedAt: Date | string | null = null;
  let tosOutdated = false;
  let privacyOutdated = false;

  if (session?.user?.id) {
    try {
      type Row = {
        deletion_requested_at: Date | string | null;
        tos_version_accepted: string;
        privacy_version_accepted: string;
      };
      const row = await withUserRls<Row | null>(
        session.user.id,
        async (sql) => {
          const rows = await sql<Row[]>`
            select deletion_requested_at,
                   tos_version_accepted,
                   privacy_version_accepted
            from public.users
            where id = ${session.user.id}
            limit 1
          `;
          return rows[0] ?? null;
        },
      );
      if (row) {
        deletionRequestedAt = row.deletion_requested_at;
        tosOutdated = row.tos_version_accepted !== LEGAL_TOS_VERSION;
        privacyOutdated = row.privacy_version_accepted !== LEGAL_PRIVACY_VERSION;
      }
    } catch (err) {
      console.warn("[layout:dashboard] could not load user state", err);
    }
  }

  return (
    <>
      <DeletionPendingBanner deletionRequestedAt={deletionRequestedAt} />
      <VersionBumpModal tosOutdated={tosOutdated} privacyOutdated={privacyOutdated} />
      {children}
    </>
  );
}
