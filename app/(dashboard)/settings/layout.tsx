import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { withUserRls } from "@/lib/db";
import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import { SettingsMobileNav } from "@/components/settings/settings-mobile-nav";
import { SettingsStatusBar } from "@/components/settings/settings-status-bar";

type Provider = "google" | "linkedin" | "github" | "microsoft-entra-id";

type StatusRow = {
  name: string | null;
  email: string;
  account_paused_at: Date | string | null;
  deletion_requested_at: Date | string | null;
  password_hash: string | null;
  tos_accepted_at: Date | string | null;
  privacy_accepted_at: Date | string | null;
};

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userId = session.user.id;
  const role = (session.user.role ?? null) as "founder" | "investor" | null;

  const data = await withUserRls<{
    user: StatusRow | null;
    providers: Provider[];
    calendarConnected: boolean;
  }>(userId, async (sql) => {
    const [users, accounts, calRows] = await Promise.all([
      sql<StatusRow[]>`
        select name, email, account_paused_at, deletion_requested_at,
               password_hash, tos_accepted_at, privacy_accepted_at
        from public.users where id = ${userId} limit 1
      `,
      sql<{ provider: Provider }[]>`
        select provider from public.accounts where user_id = ${userId}
      `,
      sql<{ exists: boolean }[]>`
        select exists(
          select 1 from public.calendar_connections
          where user_id = ${userId} and provider = 'google'
        ) as exists
      `,
    ]);
    return {
      user: users[0] ?? null,
      providers: accounts.map((a) => a.provider),
      calendarConnected: calRows[0]?.exists ?? false,
    };
  });

  if (!data.user) redirect("/sign-in");
  const { user, providers, calendarConnected } = data;

  const initial = (user.name ?? user.email ?? "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  const deletionRequestedAt = user.deletion_requested_at
    ? new Date(user.deletion_requested_at).toISOString()
    : null;

  const tosAcceptedAt = user.tos_accepted_at
    ? new Date(user.tos_accepted_at).toISOString()
    : null;

  const privacyAcceptedAt = user.privacy_accepted_at
    ? new Date(user.privacy_accepted_at).toISOString()
    : null;

  return (
    <>
      {/* Mobile horizontal tab nav */}
      <SettingsMobileNav />

      {/*
        Two-column settings shell.
        bg-surface = white (same as the dashboard group layout wrapper).
        Sections separated by border lines, no background contrast switching.
      */}
      <div className="mx-auto flex w-full max-w-[1280px]">
        {/* Sidebar rail: same white bg, separated from content by border-r */}
        <div className="hidden lg:flex lg:w-60 lg:shrink-0 border-r border-[var(--color-border)]">
          <SettingsSidebar />
        </div>

        {/* Main content column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Page header — border-b separates it from what follows */}
          <div className="border-b border-[var(--color-border)] px-8 py-6">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
              Settings
            </p>
            <h1 className="mt-0.5 text-[18px] font-semibold tracking-[-0.012em] text-[var(--color-text-strong)]">
              Account & preferences
            </h1>
            <p className="mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">
              Manage your identity, discovery, security, and data controls.
            </p>
          </div>

          {/* Account status — border-b separates it from subpage content */}
          <div className="border-b border-[var(--color-border)] px-8 py-5">
            <SettingsStatusBar
              name={user.name}
              email={user.email}
              role={role}
              avatarInitial={initial}
              paused={Boolean(user.account_paused_at)}
              deletionRequestedAt={deletionRequestedAt}
              hasPassword={Boolean(user.password_hash)}
              providers={providers}
              calendarConnected={calendarConnected}
              tosAcceptedAt={tosAcceptedAt}
              privacyAcceptedAt={privacyAcceptedAt}
            />
          </div>

          {/* Subpage content */}
          <main className="flex-1 px-8 py-8">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
