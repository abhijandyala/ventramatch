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
import { CalendarSection } from "@/components/settings/calendar-section";
import { AvatarSection } from "@/components/settings/avatar-section";
import { AccountStatusCard } from "@/components/settings/account-status-card";
import { DiscoveryStatusCard } from "@/components/settings/discovery-status-card";
import { SettingsMobileNav } from "@/components/settings/settings-mobile-nav";
import { fetchBlockedUsers } from "@/lib/safety/query";
import { resolveAvatarUrl } from "@/lib/profile/avatar";
import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
} from "@/types/database";
import { cn } from "@/lib/utils";
import {
  User,
  Eye,
  Bell,
  KeyRound,
  Plug,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { AccountActions } from "@/components/account/account-actions";

export const dynamic = "force-dynamic";

type Provider = "google" | "linkedin" | "github" | "microsoft-entra-id";

const ICON_SIZE = 16;
const ICON_STROKE = 1.75;

const SECTIONS = [
  { id: "account",       label: "Account",       Icon: User },
  { id: "discovery",     label: "Discovery",     Icon: Eye },
  { id: "notifications", label: "Notifications", Icon: Bell },
  { id: "security",      label: "Sign-in",       Icon: KeyRound },
  { id: "integrations",  label: "Integrations",  Icon: Plug },
  { id: "privacy",       label: "Privacy",       Icon: ShieldCheck },
  { id: "danger",        label: "Danger zone",   Icon: AlertTriangle },
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
  image: string | null;
  avatar_storage_key: string | null;
  avatar_url: string | null;
  avatar_updated_at: Date | string | null;
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userId = session.user.id;

  // role comes from the JWT — no extra DB query needed.
  const role = session.user.role;
  const profileEditHref: string = role === "investor" ? "/build/investor" : "/build";

  const [data, blocked] = await Promise.all([
    withUserRls<{
      user: UserRow | null;
      providers: Provider[];
      pendingEmailChange: string | null;
      calendarConnected: boolean;
    }>(userId, async (sql) => {
      const [users, accounts, pending] = await Promise.all([
        sql<UserRow[]>`
          select email, name, notification_prefs, account_paused_at,
                 deletion_requested_at, password_hash,
                 tos_accepted_at, privacy_accepted_at,
                 image, avatar_storage_key, avatar_url, avatar_updated_at
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
      const calRows = await sql<{ exists: boolean }[]>`
        select exists(
          select 1 from public.calendar_connections
          where user_id = ${userId} and provider = 'google'
        ) as exists
      `;
      return {
        user: users[0] ?? null,
        providers: accounts.map((a) => a.provider),
        pendingEmailChange: pending[0]?.new_email ?? null,
        calendarConnected: calRows[0]?.exists ?? false,
      };
    }),
    fetchBlockedUsers(userId),
  ]);

  if (!data.user) redirect("/sign-in");
  const { user, providers, pendingEmailChange } = data;
  const prefs: NotificationPrefs = user.notification_prefs ?? DEFAULT_NOTIFICATION_PREFS;
  const hasPassword = Boolean(user.password_hash);

  const avatarSrc = await resolveAvatarUrl({
    storageKey: user.avatar_storage_key,
    cachedUrl: user.avatar_url,
    cachedAt: user.avatar_updated_at,
    oauthImage: user.image,
  });

  const pausedAt = user.account_paused_at
    ? new Date(user.account_paused_at).toISOString()
    : null;
  const deletionRequestedAt = user.deletion_requested_at
    ? new Date(user.deletion_requested_at).toISOString()
    : null;

  console.log(
    `[settings] userId=${userId} paused=${Boolean(user.account_paused_at)} deletion=${Boolean(user.deletion_requested_at)} providers=${providers.length}`,
  );

  return (
    <div className="bg-[var(--color-bg)]">
      {/* Page header */}
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

      {/* Mobile section nav (hidden on lg) */}
      <div className="mx-auto w-full max-w-[1080px] px-4 sm:px-6 lg:hidden">
        <SettingsMobileNav sections={SECTIONS.map(({ id, label }) => ({ id, label }))} />
      </div>

      <div className="mx-auto grid w-full max-w-[1080px] grid-cols-1 gap-8 px-4 sm:px-6 py-8 lg:grid-cols-[200px_1fr]">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <nav className="sticky top-20 flex flex-col gap-0.5" aria-label="Settings sections">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center gap-2.5 rounded-[var(--radius)] px-3 py-2 text-[13px] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-strong)]"
              >
                <s.Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} className="shrink-0" />
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

        <main className="min-w-0 flex flex-col gap-5">
          {/* At-a-glance status — above all sections */}
          <AccountStatusCard
            name={user.name}
            email={user.email}
            paused={Boolean(user.account_paused_at)}
            deletionRequestedAt={deletionRequestedAt}
            hasPassword={hasPassword}
            providers={providers}
            calendarConnected={data.calendarConnected}
          />

          {/* 1 · Account identity */}
          <SettingsSection
            id="account"
            title="Account identity"
            description="Your profile photo, display name, and sign-in email."
            icon={<User size={20} strokeWidth={ICON_STROKE} />}
          >
            <div className="flex flex-col gap-7">
              <AvatarSection
                userId={userId}
                name={user.name}
                initialSrc={avatarSrc}
              />
              <Suspense fallback={null}>
                <EmailChangeForm
                  currentEmail={user.email}
                  pendingNewEmail={pendingEmailChange}
                />
              </Suspense>
              <AccountNameForm initialName={user.name ?? ""} />
              <div className="pt-1 border-t border-[var(--color-border)]">
                <Link
                  href={profileEditHref as Route}
                  className="mt-3 inline-block text-[12.5px] font-medium text-[var(--color-text-muted)] underline-offset-4 transition-colors hover:text-[var(--color-text-strong)] hover:underline"
                >
                  Edit matching profile →
                </Link>
              </div>
            </div>
          </SettingsSection>

          {/* 2 · Discovery & matching */}
          <SettingsSection
            id="discovery"
            title="Discovery & matching"
            description="Whether your profile is visible in the feed and how match scores are calculated."
            icon={<Eye size={20} strokeWidth={ICON_STROKE} />}
            fullWidth
          >
            <DiscoveryStatusCard
              paused={Boolean(user.account_paused_at)}
              deletionRequestedAt={deletionRequestedAt}
              profileEditHref={profileEditHref}
            />
          </SettingsSection>

          {/* 3 · Notifications */}
          <SettingsSection
            id="notifications"
            title="Notifications"
            description="Transactional email only — no spam. Toggle off anything you don't need."
            icon={<Bell size={20} strokeWidth={ICON_STROKE} />}
          >
            <NotificationPrefsForm initial={prefs} />
          </SettingsSection>

          {/* 4 · Sign-in & security */}
          <SettingsSection
            id="security"
            title="Sign-in & security"
            description="Your password and connected OAuth providers. At least one sign-in method must remain active."
            icon={<KeyRound size={20} strokeWidth={ICON_STROKE} />}
          >
            <div className="flex flex-col gap-8">
              {/* Security summary pill */}
              <div className="border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
                <p className="text-[12.5px] text-[var(--color-text-muted)]">
                  {hasPassword ? "Password set" : "No password set"}
                  {" · "}
                  {providers.length === 0
                    ? "no OAuth providers connected"
                    : `${providers.length} OAuth provider${providers.length !== 1 ? "s" : ""} connected`}
                </p>
                {!hasPassword ? (
                  <p className="mt-1 text-[12px] text-[var(--color-text-faint)]">
                    Adding a password keeps you signed in if your OAuth provider becomes unavailable.
                  </p>
                ) : null}
              </div>

              {/* Password */}
              <div>
                <p className="mb-4 text-[14px] font-semibold text-[var(--color-text-strong)]">
                  {hasPassword ? "Change password" : "Set a password"}
                </p>
                <PasswordForm hasPassword={hasPassword} />
              </div>

              {/* Connected accounts */}
              <div>
                <p className="mb-1 text-[14px] font-semibold text-[var(--color-text-strong)]">
                  Connected accounts
                </p>
                <p className="mb-4 text-[12.5px] text-[var(--color-text-muted)]">
                  OAuth providers you&apos;ve used to sign in.
                </p>
                <ConnectedAccounts connected={providers} hasPassword={hasPassword} />
              </div>
            </div>
          </SettingsSection>

          {/* 5 · Integrations */}
          <SettingsSection
            id="integrations"
            title="Integrations"
            description="Third-party connections that extend VentraMatch."
            icon={<Plug size={20} strokeWidth={ICON_STROKE} />}
          >
            <div className="flex flex-col gap-2">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-faint)]">
                Google Calendar
              </p>
              <CalendarSection connected={data.calendarConnected} />
            </div>
          </SettingsSection>

          {/* 6 · Privacy & safety */}
          <SettingsSection
            id="privacy"
            title="Privacy & safety"
            description="Blocked users, data export, cookie consent, and legal acceptance."
            icon={<ShieldCheck size={20} strokeWidth={ICON_STROKE} />}
            fullWidth
          >
            <div className="flex flex-col gap-9 max-w-[60ch]">
              {/* Blocked users */}
              <div>
                <p className="mb-1 text-[14px] font-semibold text-[var(--color-text-strong)]">
                  Blocked users
                </p>
                <p className="mb-4 text-[12.5px] text-[var(--color-text-muted)]">
                  Blocked users never appear in your feed, matches, or inbox — and
                  they can&apos;t reach you.
                </p>
                <BlockedUsersList initial={blocked} />
              </div>

              {/* Legal acceptance */}
              <div>
                <p className="mb-4 text-[14px] font-semibold text-[var(--color-text-strong)]">
                  Legal
                </p>
                <div className="flex flex-col">
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
                </div>
              </div>

              {/* Data controls */}
              <div>
                <p className="mb-1 text-[14px] font-semibold text-[var(--color-text-strong)]">
                  Your data
                </p>
                <p className="mb-4 text-[12.5px] text-[var(--color-text-muted)]">
                  Export your account data and manage consent settings.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <DataExportButton />
                  <ManageCookies />
                </div>
              </div>
            </div>
          </SettingsSection>

          {/* 7 · Danger zone */}
          <SettingsSection
            id="danger"
            title="Danger zone"
            description="Pause removes you from discovery but keeps matches and inbox intact. Delete schedules permanent removal after 30 days."
            icon={<AlertTriangle size={20} strokeWidth={ICON_STROKE} />}
            variant="danger"
          >
            <PauseAndDelete
              email={user.email}
              paused={Boolean(pausedAt)}
              deletionRequestedAt={deletionRequestedAt}
            />
          </SettingsSection>

          <AccountActions />
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
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] py-4 last:border-none last:pb-0">
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
