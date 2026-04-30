import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { Resend } from "resend";
import { withUserRls } from "@/lib/db";

/**
 * Email-change magic link.
 *
 * Flow:
 *   1. createEmailChangeRequest(userId, newEmail) inserts a row in
 *      public.email_change_requests with a sha256-hashed token + 1h TTL,
 *      and emails the magic link to NEW email.
 *   2. /api/auth/change-email validates the token, performs the swap.
 *
 * Why hash the token: parity with NextAuth's verification_token pattern,
 * and so a DB leak doesn't expose live magic links.
 */

const TOKEN_TTL_MS = 60 * 60 * 1000;

let _resend: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (_resend) return _resend;
  _resend = new Resend(key);
  return _resend;
}

async function getSiteUrl(): Promise<string> {
  try {
    const h = await headers();
    const forwardedHost = h.get("x-forwarded-host");
    const host = forwardedHost ?? h.get("host");
    if (host) {
      const proto =
        h.get("x-forwarded-proto") ??
        (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  } catch {
    // outside request context
  }
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";
  return url.replace(/\/$/, "");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time compare for hash strings (defence-in-depth). */
export function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function buildEmail({
  name,
  newEmail,
  link,
}: {
  name: string | null;
  newEmail: string;
  link: string;
}): { html: string; text: string; subject: string } {
  const safeName = name?.trim() || "there";
  const text = [
    `Hi ${safeName},`,
    ``,
    `You requested to change the email on your VentraMatch account to ${newEmail}.`,
    `Click the link below to confirm the change:`,
    ``,
    link,
    ``,
    `This link expires in 1 hour. If you didn't request this, you can ignore this email — your existing email won't change.`,
    ``,
    `— VentraMatch`,
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3eee5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="520" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border:1px solid #e6e0d4;padding:40px;">
            <tr><td>
              <p style="margin:0 0 24px;font-size:14px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#16a34a;">VentraMatch</p>
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:600;letter-spacing:-0.015em;color:#0f172a;">Confirm your new email</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#475569;">
                Hi ${safeName}, click the button below to set <strong>${newEmail}</strong> as the email on your VentraMatch account.
              </p>
              <p style="margin:0 0 32px;">
                <a href="${link}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:14px 28px;font-size:15px;font-weight:600;letter-spacing:-0.005em;">Confirm new email</a>
              </p>
              <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Or paste this link into your browser:</p>
              <p style="margin:0 0 24px;font-size:13px;color:#0f172a;word-break:break-all;"><a href="${link}" style="color:#16a34a;">${link}</a></p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">This link expires in 1 hour. If you didn't request this, you can ignore this email — nothing will change.</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { html, text, subject: "Confirm your new VentraMatch email" };
}

export type SendEmailChangeResult = { ok: true } | { ok: false; error: string };

/**
 * Insert a fresh email_change_requests row and send the link to newEmail.
 * Caller is responsible for any rate limiting.
 */
export async function createAndSendEmailChange(
  userId: string,
  userName: string | null,
  newEmail: string,
): Promise<SendEmailChangeResult> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expires = new Date(Date.now() + TOKEN_TTL_MS);
  const newEmailLower = newEmail.trim().toLowerCase();

  try {
    await withUserRls(null, async (sql) => {
      // Replace any existing pending request for this user.
      await sql`
        delete from public.email_change_requests
        where user_id = ${userId} and consumed_at is null
      `;
      await sql`
        insert into public.email_change_requests
          (user_id, new_email, token_hash, expires_at)
        values (${userId}, ${newEmailLower}, ${tokenHash}, ${expires})
      `;
    });
  } catch (err) {
    console.error("[email-change:db] failed", err);
    return { ok: false, error: "Could not generate change link." };
  }

  const siteUrl = await getSiteUrl();
  const link = `${siteUrl}/api/auth/change-email?token=${encodeURIComponent(token)}`;
  console.log(`[email-change:create] userId=${userId} newEmail=${newEmailLower} siteUrl=${siteUrl}`);

  const resend = getResend();
  if (!resend) {
    console.warn(`[email-change:dev] RESEND_API_KEY not set. Link for ${newEmailLower}: ${link}`);
    return { ok: true };
  }

  const from = process.env.EMAIL_FROM ?? "VentraMatch <onboarding@resend.dev>";
  const { html, text, subject } = buildEmail({ name: userName, newEmail: newEmailLower, link });

  try {
    const result = await resend.emails.send({
      from,
      to: newEmailLower,
      subject,
      html,
      text,
    });
    if (result.error) {
      console.error("[email-change:resend] error", result.error);
      return { ok: false, error: "Could not send confirmation email. Try again." };
    }
    console.log(`[email-change:sent] to=${newEmailLower} id=${result.data?.id}`);
    return { ok: true };
  } catch (err) {
    console.error("[email-change:resend] threw", err);
    return { ok: false, error: "Could not send confirmation email. Try again." };
  }
}
