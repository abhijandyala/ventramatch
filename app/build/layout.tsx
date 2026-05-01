import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import { ProductNav } from "@/components/layout/product-nav";
import { resolveAvatarUrl } from "@/lib/profile/avatar";
import type { UserRole } from "@/types/database";

/**
 * Layout for /build and /build/investor. Renders the shared ProductNav
 * above each builder so users can navigate elsewhere mid-flow without
 * losing draft state (each builder auto-saves drafts).
 *
 * The builder pages keep their own action header (LinkedIn, Save draft,
 * Save & exit) below the nav.
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

  let avatarSrc: string | null = session?.user?.image ?? null;

  if (session?.user?.id) {
    try {
      type Row = {
        avatar_storage_key: string | null;
        avatar_url: string | null;
        avatar_updated_at: Date | string | null;
        image: string | null;
      };
      const row = await withUserRls<Row | null>(
        session.user.id,
        async (sql) => {
          const rows = await sql<Row[]>`
            select avatar_storage_key, avatar_url, avatar_updated_at, image
            from public.users
            where id = ${session.user.id}
            limit 1
          `;
          return rows[0] ?? null;
        },
      );
      if (row) {
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

  return (
    <>
      {session?.user && (
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
