import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { fetchBlockedUsers } from "@/lib/safety/query";
import { BlockedUsersList } from "@/components/settings/blocked-users-list";
import { SettingsPanel } from "@/components/settings/settings-panel";

export const dynamic = "force-dynamic";

export default async function SafetyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userId = session.user.id;

  const blocked = await fetchBlockedUsers(userId);

  return (
    <SettingsPanel
      title="Safety"
      description="Users you've blocked cannot see your profile, appear in your feed or matches, or contact you."
    >
      <div className="py-4">
        <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[var(--color-text-faint)]">
          Blocked users
        </p>
        <BlockedUsersList initial={blocked} />
        <p className="mt-6 text-[12px] leading-[1.55] text-[var(--color-text-faint)]">
          To block a user, open their profile and use the action menu. Blocking is permanent until you unblock here.
        </p>
      </div>
    </SettingsPanel>
  );
}
