"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth, signOut, unstable_update } from "@/auth";
import { withUserRls } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createAndSendEmailChange } from "@/lib/email/send-email-change";
import { checkAndStamp } from "@/lib/email/rate-limit";
import {
  updateAccountSchema,
  notificationPrefsSchema,
  setPasswordSchema,
  disconnectProviderSchema,
  requestDeletionSchema,
  type UpdateAccountInput,
  type NotificationPrefsInput,
  type SetPasswordInput,
  type DisconnectProviderInput,
  type RequestDeletionInput,
} from "@/lib/validation/account";
import type { NotificationPrefs } from "@/types/database";

/**
 * Server actions for the /settings page.
 *
 * Auth model: every action here requires a signed-in user. We don't gate
 * via requireWrite() because settings should remain reachable even if the
 * user is paused, in_review, etc. — those are exactly the states from
 * which they need to manage their account.
 */

type ActionResult<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

async function requireUserId(): Promise<{ userId: string } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in." };
  return { userId: session.user.id };
}

// ──────────────────────────────────────────────────────────────────────────
//  Account basics
// ──────────────────────────────────────────────────────────────────────────

export async function updateAccountAction(
  raw: UpdateAccountInput,
): Promise<ActionResult> {
  const ctx = await requireUserId();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = updateAccountSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await withUserRls(ctx.userId, async (sql) => {
      await sql`
        update public.users
        set name = ${parsed.data.name}
        where id = ${ctx.userId}
      `;
    });

    // Reflect the new name in the JWT immediately so the next request reads it.
    await unstable_update({ user: { name: parsed.data.name } });

    console.log(`[account:update-name] userId=${ctx.userId}`);
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    console.error("[account:update-name] failed", err);
    return { ok: false, error: "Could not update name." };
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  Notification preferences
// ──────────────────────────────────────────────────────────────────────────

export async function updateNotificationPrefsAction(
  raw: NotificationPrefsInput,
): Promise<ActionResult> {
  const ctx = await requireUserId();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = notificationPrefsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const prefs: NotificationPrefs = parsed.data;

  try {
    await withUserRls(ctx.userId, async (sql) => {
      await sql`
        update public.users
        set notification_prefs = ${JSON.stringify(prefs)}::jsonb,
            -- Keep the legacy marketing_opt_in column in sync so any older
            -- worker that still reads it stays correct.
            marketing_opt_in = ${prefs.productUpdates}
        where id = ${ctx.userId}
      `;
    });

    console.log(`[account:notif-prefs] userId=${ctx.userId} prefs=${JSON.stringify(prefs)}`);
    revalidatePath("/settings");
    return { ok: true };
  } catch (err) {
    console.error("[account:notif-prefs] failed", err);
    return { ok: false, error: "Could not save preferences." };
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  Pause / resume
// ──────────────────────────────────────────────────────────────────────────

export async function pauseAccountAction(): Promise<ActionResult> {
  const ctx = await requireUserId();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  try {
    await withUserRls(ctx.userId, async (sql) => {
      await sql`
        update public.users
        set account_paused_at = now()
        where id = ${ctx.userId}
          and account_paused_at is null
      `;
    });
    console.log(`[account:pause] userId=${ctx.userId}`);
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/feed");
    return { ok: true };
  } catch (err) {
    console.error("[account:pause] failed", err);
    return { ok: false, error: "Could not pause account." };
  }
}

export async function resumeAccountAction(): Promise<ActionResult> {
  const ctx = await requireUserId();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  try {
    await withUserRls(ctx.userId, async (sql) => {
      await sql`
        update public.users
        set account_paused_at = null
        where id = ${ctx.userId}
      `;
    });
    console.log(`[account:resume] userId=${ctx.userId}`);
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/feed");
    return { ok: true };
  } catch (err) {
    console.error("[account:resume] failed", err);
    return { ok: false, error: "Could not resume account." };
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  Deletion request / cancellation (soft delete with 30-day grace)
// ──────────────────────────────────────────────────────────────────────────

export async function requestDeletionAction(
  raw: RequestDeletionInput,
): Promise<ActionResult> {
  const ctx = await requireUserId();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = requestDeletionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Confirmation must equal the user's email (case-insensitive). We fetch it
  // server-side rather than trust whatever the form sends.
  let userEmail: string | null;
  try {
    userEmail = await withUserRls<string | null>(ctx.userId, async (sql) => {
      const rows = await sql<{ email: string }[]>`
        select email from public.users where id = ${ctx.userId} limit 1
      `;
      return rows[0]?.email ?? null;
    });
  } catch {
    return { ok: false, error: "Could not verify your email." };
  }
  if (!userEmail) return { ok: false, error: "Account not found." };

  if (parsed.data.confirmation.trim().toLowerCase() !== userEmail.toLowerCase()) {
    return { ok: false, error: "Confirmation didn't match your email." };
  }

  try {
    await withUserRls(ctx.userId, async (sql) => {
      await sql`
        update public.users
        set deletion_requested_at = now(),
            -- Pause discovery surfaces immediately.
            account_paused_at = coalesce(account_paused_at, now())
        where id = ${ctx.userId}
      `;
      // Enqueue confirmation email (the should_send_email helper allows the
      // 'account.deletion_requested' template through even when the user has
      // muted everything else).
      await sql`
        insert into public.email_outbox (user_id, template, payload)
        values (
          ${ctx.userId},
          'account.deletion_requested',
          jsonb_build_object(
            'requestedAt', now(),
            'graceUntil', now() + interval '30 days'
          )
        )
      `;
    });

    console.log(`[account:delete-request] userId=${ctx.userId}`);
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    console.error("[account:delete-request] failed", err);
    return { ok: false, error: "Could not submit deletion request." };
  }
}

export async function cancelDeletionAction(): Promise<ActionResult> {
  const ctx = await requireUserId();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  try {
    await withUserRls(ctx.userId, async (sql) => {
      await sql`
        update public.users
        set deletion_requested_at = null
        where id = ${ctx.userId}
      `;
    });
    console.log(`[account:delete-cancel] userId=${ctx.userId}`);
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    console.error("[account:delete-cancel] failed", err);
    return { ok: false, error: "Could not cancel deletion." };
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  Password — set (OAuth-only) or change
// ──────────────────────────────────────────────────────────────────────────

export async function setPasswordAction(
  raw: SetPasswordInput,
): Promise<ActionResult> {
  const ctx = await requireUserId();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = setPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const result = await withUserRls<{ ok: true } | { ok: false; error: string }>(
      ctx.userId,
      async (sql) => {
        const rows = await sql<{ password_hash: string | null }[]>`
          select password_hash from public.users where id = ${ctx.userId} limit 1
        `;
        if (rows.length === 0) return { ok: false, error: "Account not found." };
        const existing = rows[0].password_hash;

        // Path A: account already has a password → require currentPassword.
        if (existing) {
          if (!parsed.data.currentPassword) {
            return { ok: false, error: "Enter your current password to change it." };
          }
          const ok = await verifyPassword(parsed.data.currentPassword, existing);
          if (!ok) {
            return { ok: false, error: "Current password didn't match." };
          }
        }

        const next = await hashPassword(parsed.data.newPassword);
        await sql`
          update public.users
          set password_hash = ${next}
          where id = ${ctx.userId}
        `;
        return { ok: true };
      },
    );

    if (!result.ok) return result;
    console.log(`[account:set-password] userId=${ctx.userId}`);
    revalidatePath("/settings");
    return { ok: true };
  } catch (err) {
    console.error("[account:set-password] failed", err);
    return { ok: false, error: "Could not update password." };
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  Disconnect OAuth provider
// ──────────────────────────────────────────────────────────────────────────

export async function disconnectProviderAction(
  raw: DisconnectProviderInput,
): Promise<ActionResult> {
  const ctx = await requireUserId();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = disconnectProviderSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { provider } = parsed.data;

  try {
    const result = await withUserRls<{ ok: true } | { ok: false; error: string }>(
      ctx.userId,
      async (sql) => {
        // Lockout-prevention: refuse to remove the only sign-in method.
        const accounts = await sql<{ provider: string }[]>`
          select provider from public.accounts where user_id = ${ctx.userId}
        `;
        const userRows = await sql<{ password_hash: string | null }[]>`
          select password_hash from public.users where id = ${ctx.userId} limit 1
        `;
        const hasPassword = Boolean(userRows[0]?.password_hash);
        const otherProviders = accounts.filter((a) => a.provider !== provider);
        if (!hasPassword && otherProviders.length === 0) {
          return {
            ok: false,
            error:
              "Add a password before disconnecting your only sign-in method.",
          };
        }

        await sql`
          delete from public.accounts
          where user_id = ${ctx.userId} and provider = ${provider}
        `;
        return { ok: true };
      },
    );

    if (!result.ok) return result;
    console.log(`[account:disconnect] userId=${ctx.userId} provider=${provider}`);
    revalidatePath("/settings");
    return { ok: true };
  } catch (err) {
    console.error("[account:disconnect] failed", err);
    return { ok: false, error: "Could not disconnect provider." };
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  Email change — request side. Confirmation runs in the route handler.
// ──────────────────────────────────────────────────────────────────────────

const emailChangeSchema = z.object({
  newEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("That doesn't look like a valid email."),
});

export async function requestEmailChangeAction(
  raw: { newEmail: string },
): Promise<ActionResult<{ pendingEmail: string }>> {
  const ctx = await requireUserId();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = emailChangeSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid email." };
  }
  const newEmail = parsed.data.newEmail;

  // Don't leak rate-limit or uniqueness signal too aggressively, but DO
  // tell the user when they typed their CURRENT email (high-signal mistake).
  let userName: string | null = null;
  try {
    const result = await withUserRls<
      | { kind: "ok"; name: string | null }
      | { kind: "same" }
      | { kind: "taken" }
    >(ctx.userId, async (sql) => {
      const me = await sql<{ email: string; name: string | null }[]>`
        select email, name from public.users where id = ${ctx.userId} limit 1
      `;
      if (me.length === 0) return { kind: "ok", name: null };
      if (me[0].email.toLowerCase() === newEmail) return { kind: "same" };

      const taken = await sql<{ id: string }[]>`
        select id from public.users where lower(email) = ${newEmail} limit 1
      `;
      if (taken.length > 0) return { kind: "taken" };

      return { kind: "ok", name: me[0].name };
    });

    if (result.kind === "same") {
      return { ok: false, error: "That's already your email." };
    }
    if (result.kind === "taken") {
      // Don't reveal too much — same generic message either way. We use
      // "could not" rather than "in use" so we don't leak signup info.
      return { ok: false, error: "Could not start change for that email." };
    }
    userName = result.name;
  } catch (err) {
    console.error("[email-change:lookup] failed", err);
    return { ok: false, error: "Could not start the change request." };
  }

  // Rate limit per (userId, newEmail) so a single user can't spam.
  const limit = checkAndStamp(`email-change:${ctx.userId}:${newEmail}`);
  if (!limit.ok) {
    return {
      ok: false,
      error: `Wait ${limit.retryAfterSeconds}s before sending another link.`,
    };
  }

  const send = await createAndSendEmailChange(ctx.userId, userName, newEmail);
  if (!send.ok) return { ok: false, error: send.error };

  console.log(`[email-change:request] userId=${ctx.userId} newEmail=${newEmail}`);
  revalidatePath("/settings");
  return { ok: true, pendingEmail: newEmail };
}

export async function cancelEmailChangeAction(): Promise<ActionResult> {
  const ctx = await requireUserId();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  try {
    await withUserRls(ctx.userId, async (sql) => {
      await sql`
        delete from public.email_change_requests
        where user_id = ${ctx.userId} and consumed_at is null
      `;
    });
    console.log(`[email-change:cancel] userId=${ctx.userId}`);
    revalidatePath("/settings");
    return { ok: true };
  } catch (err) {
    console.error("[email-change:cancel] failed", err);
    return { ok: false, error: "Could not cancel." };
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  Sign out helper for the settings page (so the form button stays a
//  Server Action rather than calling the client-side signOut).
// ──────────────────────────────────────────────────────────────────────────

export async function signOutAction(): Promise<void> {
  await signOut({ redirect: false });
  redirect("/");
}
