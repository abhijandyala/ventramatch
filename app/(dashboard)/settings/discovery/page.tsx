import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import { DiscoveryStatusCard } from "@/components/settings/discovery-status-card";
import { SettingsPanel } from "@/components/settings/settings-panel";

export const dynamic = "force-dynamic";

type UserRow = {
  account_paused_at: Date | string | null;
  deletion_requested_at: Date | string | null;
};

export default async function DiscoveryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userId = session.user.id;
  const role = session.user.role;
  const profileEditHref: string = role === "investor" ? "/build/investor" : "/build";

  const user = await withUserRls<UserRow | null>(userId, async (sql) => {
    const rows = await sql<UserRow[]>`
      select account_paused_at, deletion_requested_at
      from public.users where id = ${userId} limit 1
    `;
    return rows[0] ?? null;
  });

  if (!user) redirect("/sign-in");

  const deletionRequestedAt = user.deletion_requested_at
    ? new Date(user.deletion_requested_at).toISOString()
    : null;

  return (
    <SettingsPanel
      title="Discovery & matching"
      description="Whether your profile appears in the feed and how match scores are calculated."
    >
      <div className="py-2">
        <DiscoveryStatusCard
          paused={Boolean(user.account_paused_at)}
          deletionRequestedAt={deletionRequestedAt}
          profileEditHref={profileEditHref}
        />
      </div>
    </SettingsPanel>
  );
}
