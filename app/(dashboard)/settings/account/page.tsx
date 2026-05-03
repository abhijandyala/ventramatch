import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import { resolveAvatarUrl } from "@/lib/profile/avatar";
import { AvatarSection } from "@/components/settings/avatar-section";
import { EmailChangeForm } from "@/components/settings/email-change-form";
import { AccountNameForm } from "@/components/settings/account-name-form";
import { AccountActions } from "@/components/account/account-actions";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsPanel } from "@/components/settings/settings-panel";

export const dynamic = "force-dynamic";

type UserRow = {
  email: string;
  name: string | null;
  image: string | null;
  avatar_storage_key: string | null;
  avatar_url: string | null;
  avatar_updated_at: Date | string | null;
};

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userId = session.user.id;
  const role = session.user.role;
  const profileEditHref: string = role === "investor" ? "/build/investor" : "/build";

  const data = await withUserRls<{
    user: UserRow | null;
    pendingEmailChange: string | null;
  }>(userId, async (sql) => {
    const [users, pending] = await Promise.all([
      sql<UserRow[]>`
        select email, name, image, avatar_storage_key, avatar_url, avatar_updated_at
        from public.users where id = ${userId} limit 1
      `,
      sql<{ new_email: string }[]>`
        select new_email from public.email_change_requests
        where user_id = ${userId}
          and consumed_at is null
          and expires_at > now()
        order by created_at desc
        limit 1
      `,
    ]);
    return {
      user: users[0] ?? null,
      pendingEmailChange: pending[0]?.new_email ?? null,
    };
  });

  if (!data.user) redirect("/sign-in");
  const { user, pendingEmailChange } = data;

  const avatarSrc = await resolveAvatarUrl({
    storageKey: user.avatar_storage_key,
    cachedUrl: user.avatar_url,
    cachedAt: user.avatar_updated_at,
    oauthImage: user.image,
  });

  return (
    <div className="flex flex-col gap-4">
      <SettingsPanel
        title="Account identity"
        description="Your profile photo, display name, and sign-in email."
      >
        <div className="divide-y divide-[var(--color-border)]">
          <SettingsRow label="Profile photo">
            <AvatarSection
              userId={userId}
              name={user.name}
              initialSrc={avatarSrc}
            />
          </SettingsRow>

          <SettingsRow
            label="Display name"
            description="Shown on your profile and in matches."
          >
            <AccountNameForm initialName={user.name ?? ""} />
          </SettingsRow>

          <SettingsRow
            label="Email address"
            description="Used for sign-in and notifications."
          >
            <Suspense fallback={null}>
              <EmailChangeForm
                currentEmail={user.email}
                pendingNewEmail={pendingEmailChange}
              />
            </Suspense>
          </SettingsRow>

          <SettingsRow
            label="Matching profile"
            description="Your account name and photo are separate from your matching profile."
          >
            <Link
              href={profileEditHref as Route}
              className="inline-flex h-8 items-center border border-[var(--color-border)] px-4 text-[12.5px] font-medium text-[var(--color-text-strong)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]"
            >
              Edit matching profile →
            </Link>
          </SettingsRow>
        </div>
      </SettingsPanel>

      {/* Account-level actions: sign out only. Destructive controls live in Danger zone. */}
      <div className="border-t border-[var(--color-border)] pt-6 mt-8">
        <AccountActions />
      </div>
    </div>
  );
}
