import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import { DataExportButton } from "@/components/settings/data-export-button";
import { ManageCookies } from "@/components/settings/manage-cookies";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsPanel } from "@/components/settings/settings-panel";

export const dynamic = "force-dynamic";

type UserRow = {
  tos_accepted_at: Date | string | null;
  privacy_accepted_at: Date | string | null;
  tos_version_accepted: string | null;
  privacy_version_accepted: string | null;
};

export default async function PrivacyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userId = session.user.id;

  const user = await withUserRls<UserRow | null>(userId, async (sql) => {
    const rows = await sql<UserRow[]>`
      select tos_accepted_at, privacy_accepted_at,
             tos_version_accepted, privacy_version_accepted
      from public.users where id = ${userId} limit 1
    `;
    return rows[0] ?? null;
  });

  if (!user) redirect("/sign-in");

  return (
    <SettingsPanel
      title="Privacy & data"
      description="Legal acceptance, data export, and cookie preferences."
    >
      <div className="divide-y divide-[var(--color-border)]">
        <SettingsRow
          label="Terms of Service"
          description={
            user.tos_accepted_at
              ? `Accepted ${new Date(user.tos_accepted_at).toLocaleDateString()}${user.tos_version_accepted ? ` · v${user.tos_version_accepted}` : ""}`
              : "Not yet accepted."
          }
        >
          <Link
            href={"/legal/tos" as Route}
            className="inline-flex h-8 items-center text-[12.5px] font-medium text-[var(--color-text-muted)] underline-offset-4 transition-colors hover:text-[var(--color-text-strong)] hover:underline"
          >
            View Terms →
          </Link>
        </SettingsRow>

        <SettingsRow
          label="Privacy Policy"
          description={
            user.privacy_accepted_at
              ? `Accepted ${new Date(user.privacy_accepted_at).toLocaleDateString()}${user.privacy_version_accepted ? ` · v${user.privacy_version_accepted}` : ""}`
              : "Not yet accepted."
          }
        >
          <Link
            href={"/legal/privacy" as Route}
            className="inline-flex h-8 items-center text-[12.5px] font-medium text-[var(--color-text-muted)] underline-offset-4 transition-colors hover:text-[var(--color-text-strong)] hover:underline"
          >
            View Policy →
          </Link>
        </SettingsRow>

        <SettingsRow
          label="Export your data"
          description="Download a JSON archive of your account, profile, and activity data."
        >
          <DataExportButton />
        </SettingsRow>

        <SettingsRow
          label="Cookie preferences"
          description="Reopen the cookie consent banner to change your preferences."
        >
          <ManageCookies />
        </SettingsRow>
      </div>
    </SettingsPanel>
  );
}
