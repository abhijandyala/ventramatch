import { randomBytes } from "node:crypto";
import { Resend } from "resend";
import { withUserRls } from "@/lib/db";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

let _resend: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (_resend) return _resend;
  _resend = new Resend(key);
  return _resend;
}

function getSiteUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3000";
  return url.replace(/\/$/, "");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function buildEmail(name: string | null, link: string): { html: string; text: string } {
  const safeName = name?.trim() || "there";
  const text = [
    `Hi ${safeName},`,
    ``,
    `Welcome to VentraMatch. Please confirm your email address by clicking the link below:`,
    ``,
    link,
    ``,
    `This link expires in 1 hour. If you didn't create an account, you can safely ignore this email.`,
    ``,
    `— The VentraMatch team`,
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3eee5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="520" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border:1px solid #e6e0d4;border-radius:0;padding:40px;">
            <tr><td>
              <p style="margin:0 0 24px;font-size:14px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#16a34a;">VentraMatch</p>
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:600;letter-spacing:-0.015em;color:#0f172a;">Confirm your email</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#475569;">
                Hi ${safeName}, click the button below to verify your email and finish setting up your account.
              </p>
              <p style="margin:0 0 32px;">
                <a href="${link}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:14px 28px;font-size:15px;font-weight:600;letter-spacing:-0.005em;">Verify email</a>
              </p>
              <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Or paste this link into your browser:</p>
              <p style="margin:0 0 24px;font-size:13px;color:#0f172a;word-break:break-all;"><a href="${link}" style="color:#16a34a;">${link}</a></p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">This link expires in 1 hour. If you didn't create an account, you can ignore this email.</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { html, text };
}

export type SendVerificationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Generate a verification token, persist it, and email a magic link to `email`.
 * Used for both initial sign-up and the resend flow. Caller is responsible
 * for any rate limiting.
 */
export async function sendVerificationEmail(
  email: string,
  name: string | null,
): Promise<SendVerificationResult> {
  const token = generateToken();
  const expires = new Date(Date.now() + TOKEN_TTL_MS);

  try {
    await withUserRls(null, async (sql) => {
      // Wipe any existing pending tokens for this email so the latest link is the only one that works
      await sql`delete from public.verification_token where identifier = ${email}`;
      await sql`
        insert into public.verification_token (identifier, token, expires)
        values (${email}, ${token}, ${expires})
      `;
    });
  } catch (error) {
    console.error("[sendVerificationEmail] DB write failed", error);
    return { ok: false, error: "Could not generate verification link." };
  }

  const link = `${getSiteUrl()}/api/auth/verify?token=${encodeURIComponent(token)}&identifier=${encodeURIComponent(email)}`;

  const resend = getResend();
  if (!resend) {
    // No Resend key in env: log the link so devs can verify in dev
    console.warn(`[sendVerificationEmail] RESEND_API_KEY not set. Verification link for ${email}: ${link}`);
    return { ok: true };
  }

  const from = process.env.EMAIL_FROM ?? "VentraMatch <onboarding@resend.dev>";
  const { html, text } = buildEmail(name, link);

  try {
    const result = await resend.emails.send({
      from,
      to: email,
      subject: "Verify your VentraMatch account",
      html,
      text,
    });
    if (result.error) {
      console.error("[sendVerificationEmail] Resend error", result.error);
      return { ok: false, error: "Could not send verification email. Try again." };
    }
    console.log(`[sendVerificationEmail] sent to ${email} id=${result.data?.id}`);
    return { ok: true };
  } catch (error) {
    console.error("[sendVerificationEmail] Resend threw", error);
    return { ok: false, error: "Could not send verification email. Try again." };
  }
}
