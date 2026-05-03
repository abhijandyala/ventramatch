import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import { CalendarSection } from "@/components/settings/calendar-section";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsPanel } from "@/components/settings/settings-panel";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userId = session.user.id;

  const calendarConnected = await withUserRls<boolean>(userId, async (sql) => {
    const rows = await sql<{ exists: boolean }[]>`
      select exists(
        select 1 from public.calendar_connections
        where user_id = ${userId} and provider = 'google'
      ) as exists
    `;
    return rows[0]?.exists ?? false;
  });

  return (
    <SettingsPanel
      title="Integrations"
      description="Third-party connections that extend VentraMatch."
    >
      <div className="divide-y divide-[var(--color-border)]">
        <SettingsRow
          label="Google Calendar"
          description={
            calendarConnected
              ? "Connected. Calendar events are created automatically when intro requests are accepted."
              : "Connect to auto-create calendar events when intro requests are accepted."
          }
        >
          <CalendarSection connected={calendarConnected} />
        </SettingsRow>
      </div>
    </SettingsPanel>
  );
}
