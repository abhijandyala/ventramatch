import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import { DeletionPendingBanner } from "@/components/account/deletion-pending-banner";
import { VersionBumpModal } from "@/components/legal/version-bump-modal";
import { ProfileNudgeBanner } from "@/components/account/profile-nudge-banner";
import { LEGAL_TOS_VERSION, LEGAL_PRIVACY_VERSION } from "@/lib/legal/versions";
import type { ProfileState, UserRole } from "@/types/database";

/**
 * Layout for the (dashboard) route group. Three responsibilities:
 *   1. DeletionPendingBanner (Sprint 7)
 *   2. LegalVersionBumpModal (Sprint 10.E)
 *   3. ProfileNudgeBanner — sticky nudge funnelling users with an
 *      unbuilt / unreviewed profile back to /build.
 *
 * One DB query per page render fetches everything we need.
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
  let profileState: ProfileState =
    (session?.user?.profileState ?? "none") as ProfileState;
  const role: UserRole | null = (session?.user?.role ?? null) as UserRole | null;

  if (session?.user?.id) {
    try {
      type Row = {
        deletion_requested_at: Date | string | null;
        tos_version_accepted: string;
        privacy_version_accepted: string;
        profile_state: ProfileState | null;
      };
      const row = await withUserRls<Row | null>(
        session.user.id,
        async (sql) => {
          const rows = await sql<Row[]>`
            select deletion_requested_at,
                   tos_version_accepted,
                   privacy_version_accepted,
                   profile_state
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
        // Trust the DB over the JWT here — server actions might have moved
        // profile_state forward without a session refresh on the same tab.
        profileState = row.profile_state ?? profileState;
      }
    } catch (err) {
      console.warn("[layout:dashboard] could not load user state", err);
    }
  }

  return (
    <>
      <DeletionPendingBanner deletionRequestedAt={deletionRequestedAt} />
      <ProfileNudgeBanner profileState={profileState} role={role} />
      <VersionBumpModal tosOutdated={tosOutdated} privacyOutdated={privacyOutdated} />
      {children}
    </>
  );
}
