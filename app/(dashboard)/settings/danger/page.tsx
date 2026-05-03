import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import { PauseAndDelete } from "@/components/settings/pause-and-delete";
import { SettingsPanel } from "@/components/settings/settings-panel";

export const dynamic = "force-dynamic";

type UserRow = {
  email: string;
  account_paused_at: Date | string | null;
  deletion_requested_at: Date | string | null;
};

export default async function DangerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userId = session.user.id;

  const user = await withUserRls<UserRow | null>(userId, async (sql) => {
    const rows = await sql<UserRow[]>`
      select email, account_paused_at, deletion_requested_at
      from public.users where id = ${userId} limit 1
    `;
    return rows[0] ?? null;
  });

  if (!user) redirect("/sign-in");

  const pausedAt = user.account_paused_at
    ? new Date(user.account_paused_at).toISOString()
    : null;
  const deletionRequestedAt = user.deletion_requested_at
    ? new Date(user.deletion_requested_at).toISOString()
    : null;

  return (
    <SettingsPanel
      title="Danger zone"
      description="Pause removes you from discovery but keeps matches and inbox intact. Delete schedules permanent removal after a 30-day grace window."
      variant="danger"
    >
      <div className="py-4">
        <PauseAndDelete
          email={user.email}
          paused={Boolean(pausedAt)}
          deletionRequestedAt={deletionRequestedAt}
        />
      </div>
    </SettingsPanel>
  );
}
