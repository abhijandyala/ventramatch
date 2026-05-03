import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import { PasswordForm } from "@/components/settings/password-form";
import { ConnectedAccounts } from "@/components/settings/connected-accounts";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsPanel } from "@/components/settings/settings-panel";

export const dynamic = "force-dynamic";

type Provider = "google" | "linkedin" | "github" | "microsoft-entra-id";

export default async function SecurityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userId = session.user.id;

  const data = await withUserRls<{
    hasPassword: boolean;
    providers: Provider[];
  }>(userId, async (sql) => {
    const [users, accounts] = await Promise.all([
      sql<{ password_hash: string | null }[]>`
        select password_hash from public.users where id = ${userId} limit 1
      `,
      sql<{ provider: Provider }[]>`
        select provider from public.accounts where user_id = ${userId}
      `,
    ]);
    return {
      hasPassword: Boolean(users[0]?.password_hash),
      providers: accounts.map((a) => a.provider),
    };
  });

  const { hasPassword, providers } = data;

  return (
    <SettingsPanel
      title="Sign-in & security"
      description="Your password and connected sign-in providers. At least one method must remain active."
    >
      <div className="divide-y divide-[var(--color-border)]">
        <SettingsRow
          label={hasPassword ? "Change password" : "Set a password"}
          description={
            hasPassword
              ? "Update your password. You'll need your current password to confirm."
              : "Add a password so you can sign in with email if your OAuth provider becomes unavailable."
          }
        >
          <PasswordForm hasPassword={hasPassword} />
        </SettingsRow>

        <SettingsRow
          label="Connected accounts"
          description="OAuth providers you can use to sign in. Connect or disconnect at any time."
        >
          <ConnectedAccounts connected={providers} hasPassword={hasPassword} />
        </SettingsRow>
      </div>
    </SettingsPanel>
  );
}
