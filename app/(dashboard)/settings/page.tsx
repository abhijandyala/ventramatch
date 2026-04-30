import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { withUserRls } from "@/lib/db";
import { Suspense } from "react";
import { SettingsSection } from "@/components/settings/section";
import { AccountNameForm } from "@/components/settings/account-name-form";
import { EmailChangeForm } from "@/components/settings/email-change-form";
import { NotificationPrefsForm } from "@/components/settings/notification-prefs-form";
import { ConnectedAccounts } from "@/components/settings/connected-accounts";
import { PasswordForm } from "@/components/settings/password-form";
import { PauseAndDelete } from "@/components/settings/pause-and-delete";
import { ManageCookies } from "@/components/settings/manage-cookies";
import { DataExportButton } from "@/components/settings/data-export-button";
import { BlockedUsersList } from "@/components/settings/blocked-users-list";
import { fetchBlockedUsers } from "@/lib/safety/query";
import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
} from "@/types/database";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Provider = "google" | "linkedin" | "github" | "microsoft-entra-id";

const SECTIONS = [
  { id: "account", label: "Account" },
  { id: "notifications", label: "Notifications" },
  { id: "connected", label: "Connected accounts" },
  { id: "password", label: "Password" },
  { id: "blocked", label: "Blocked users" },
  { id: "privacy", label: "Privacy & data" },
  { id: "danger", label: "Pause / delete" },
] as const;

type UserRow = {
  email: string;
  name: string | null;
  notification_prefs: NotificationPrefs | null;
  account_paused_at: Date | string | null;
  deletion_requested_at: Date | string | null;
  password_hash: string | null;
  tos_accepted_at: Date | string | null;
  privacy_accepted_at: Date | string | null;
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userId = session.user.id;

  const [data, blocked] = await Promise.all([
    withUserRls<{
      user: UserRow | null;
      providers: Provider[];
      pendingEmailChange: string | null;
    }>(userId, async (sql) => {
      const [users, accounts, pending] = await Promise.all([
        sql<UserRow[]>`
          select email, name, notification_prefs, account_paused_at,
                 deletion_requested_at, password_hash,
                 tos_accepted_at, privacy_accepted_at
          from public.users where id = ${userId} limit 1
        `,
        sql<{ provider: Provider }[]>`
          select provider from public.accounts where user_id = ${userId}
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
        providers: accounts.map((a) => a.provider),
        pendingEmailChange: pending[0]?.new_email ?? null,
      };
    }),
    fetchBlockedUsers(userId),
  ]);

  if (!data.user) redirect("/sign-in");
  const { user, providers, pendingEmailChange } = data;
  const prefs: NotificationPrefs = user.notification_prefs ?? DEFAULT_NOTIFICATION_PREFS;
  const hasPassword = Boolean(user.password_hash);

  console.log(
    `[settings] userId=${userId} paused=${Boolean(user.account_paused_at)} deletion=${Boolean(user.deletion_requested_at)} providers=${providers.length}`,
  );

  return (
    <div className="bg-[var(--color-bg)]">
      <header className="relative overflow-hidden border-b border-[var(--color-border)]">
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 -z-10 h-[180px]",
            "bg-[radial-gradient(60%_60%_at_15%_0%,var(--color-brand-tint)_0%,transparent_70%)]",
            "opacity-70",
          )}
        />
        <div className="mx-auto w-full max-w-[1080px] px-4 sm:px-6 py-5 sm:py-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
            Settings
          </p>
          <h1 className="mt-1 text-[20px] font-semibold tracking-[-0.015em] text-[var(--color-text)]">
            Account & preferences
          </h1>
          <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
            Manage how VentraMatch contacts you and what we hold about you.
          </p>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1080px] grid-cols-1 gap-10 px-4 sm:px-6 py-8 lg:grid-cols-[200px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-6 flex flex-col gap-1.5" aria-label="Settings sections">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="px-3 py-1.5 text-[12.5px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
              >
                {s.label}
              </a>
            ))}
            <Link
              href={"/dashboard" as Route}
              className="mt-3 px-3 py-1.5 text-[12px] font-medium text-[var(--color-text-faint)] transition-colors hover:text-[var(--color-text-strong)]"
            >
              ← Back to dashboard
            </Link>
          </nav>
        </aside>

        <main className="min-w-0">
          <SettingsSection id="account" title="Account">
            <div className="flex flex-col gap-6">
              <Suspense fallback={null}>
                <EmailChangeForm
                  currentEmail={user.email}
                  pendingNewEmail={pendingEmailChange}
                />
              </Suspense>
              <AccountNameForm initialName={user.name ?? ""} />
            </div>
          </SettingsSection>

          <SettingsSection
            id="notifications"
            title="Notifications"
            description="We only send transactional email — no spam. Toggle off anything you don't want."
          >
            <NotificationPrefsForm initial={prefs} />
          </SettingsSection>

          <SettingsSection
            id="connected"
            title="Connected accounts"
            description="OAuth providers you've used to sign in."
          >
            <ConnectedAccounts connected={providers} hasPassword={hasPassword} />
          </SettingsSection>

          <SettingsSection
            id="password"
            title={hasPassword ? "Change password" : "Set a password"}
            description={
              hasPassword
                ? "Use a fresh password you don't reuse anywhere else."
                : "Adding one keeps you signed in even if your OAuth provider goes away."
            }
          >
            <PasswordForm hasPassword={hasPassword} />
          </SettingsSection>

          <SettingsSection
            id="blocked"
            title="Blocked users"
            description="People you've blocked never appear in your feed or matches and can't reach your inbox."
          >
            <BlockedUsersList initial={blocked} />
          </SettingsSection>

          <SettingsSection
            id="privacy"
            title="Privacy & data"
            description="Your data, your call."
          >
            <div className="flex flex-col gap-5">
              <ConsentRow
                label="Terms of Service"
                date={user.tos_accepted_at}
                href="/legal/tos"
              />
              <ConsentRow
                label="Privacy Policy"
                date={user.privacy_accepted_at}
                href="/legal/privacy"
              />
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <DataExportButton />
                <ManageCookies />
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            id="danger"
            title="Pause or delete"
            description="The lighter option first."
          >
            <PauseAndDelete
              email={user.email}
              paused={Boolean(user.account_paused_at)}
              deletionRequestedAt={
                user.deletion_requested_at
                  ? new Date(user.deletion_requested_at).toISOString()
                  : null
              }
            />
          </SettingsSection>
        </main>
      </div>
    </div>
  );
}

function ConsentRow({
  label,
  date,
  href,
}: {
  label: string;
  date: Date | string | null;
  href: Route | string;
}) {
  const accepted = date ? new Date(date) : null;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4 last:border-none last:pb-0">
      <div>
        <p className="text-[13.5px] font-medium text-[var(--color-text-strong)]">
          {label}
        </p>
        <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
          {accepted ? `Accepted ${accepted.toLocaleDateString()}` : "Not yet accepted"}
        </p>
      </div>
      <Link
        href={href as Route}
        className="text-[12px] font-medium text-[var(--color-text-muted)] underline-offset-4 transition-colors hover:text-[var(--color-text-strong)] hover:underline"
      >
        View →
      </Link>
    </div>
  );
}
