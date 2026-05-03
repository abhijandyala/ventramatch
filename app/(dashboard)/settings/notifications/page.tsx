import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import { NotificationPrefsForm } from "@/components/settings/notification-prefs-form";
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from "@/types/database";
import { SettingsPanel } from "@/components/settings/settings-panel";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userId = session.user.id;

  const prefs = await withUserRls<NotificationPrefs>(userId, async (sql) => {
    const rows = await sql<{ notification_prefs: NotificationPrefs | null }[]>`
      select notification_prefs from public.users where id = ${userId} limit 1
    `;
    return rows[0]?.notification_prefs ?? DEFAULT_NOTIFICATION_PREFS;
  });

  return (
    <SettingsPanel
      title="Notifications"
      description="Transactional email only — no marketing. Toggle off anything you don't need."
    >
      <div className="py-4">
        <NotificationPrefsForm initial={prefs} />
      </div>
    </SettingsPanel>
  );
}
