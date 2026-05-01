import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import { ProductNav } from "@/components/layout/product-nav";
import { resolveAvatarUrl } from "@/lib/profile/avatar";
import type { ProfileState, UserRole } from "@/types/database";
import { NEEDS_BUILD_STATES } from "@/types/database";

/**
 * Layout for /build and /build/investor.
 *
 * First-time visitors (profile_state = none | basic) see a focused,
 * distraction-free builder — no top nav. Once they save & exit or
 * complete the builder (profile_state moves to partial or higher),
 * the ProductNav appears so they can navigate freely.
 */
export default async function BuildLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const role: UserRole | null = (session?.user?.role ?? null) as UserRole | null;
  const navRole: "founder" | "investor" | null =
    role === "founder" || role === "investor" ? role : null;

  // Determine profile state from session first, then trust DB if available.
  let profileState: ProfileState =
    (session?.user?.profileState ?? "none") as ProfileState;
  let avatarSrc: string | null = session?.user?.image ?? null;

  if (session?.user?.id) {
    try {
      type Row = {
        avatar_storage_key: string | null;
        avatar_url: string | null;
        avatar_updated_at: Date | string | null;
        image: string | null;
        profile_state: ProfileState | null;
      };
      const row = await withUserRls<Row | null>(
        session.user.id,
        async (sql) => {
          const rows = await sql<Row[]>`
            select avatar_storage_key, avatar_url, avatar_updated_at, image,
                   profile_state
            from public.users
            where id = ${session.user.id}
            limit 1
          `;
          return rows[0] ?? null;
        },
      );
      if (row) {
        profileState = row.profile_state ?? profileState;
        avatarSrc = await resolveAvatarUrl({
          storageKey: row.avatar_storage_key,
          cachedUrl: row.avatar_url,
          cachedAt: row.avatar_updated_at,
          oauthImage: row.image ?? session.user.image ?? null,
        });
      }
    } catch (err) {
      console.warn("[layout:build] could not resolve avatar", err);
    }
  }

  const isFirstVisit = NEEDS_BUILD_STATES.includes(profileState);

  return (
    <>
      {session?.user && !isFirstVisit && (
        <ProductNav
          role={navRole}
          name={session.user.name ?? ""}
          userId={session.user.id}
          avatarSrc={avatarSrc}
        />
      )}
      {children}
    </>
  );
}
