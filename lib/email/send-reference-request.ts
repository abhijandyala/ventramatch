/**
 * Sends the magic-link reference request email to a referee.
 *
 * The confirm URL points to /reference/confirm?token=<rawToken>.
 * The raw token is NEVER stored — only sha256(rawToken) lives in the DB.
 *
 * If RESEND_API_KEY is absent (local dev) the link is logged to the console
 * so the developer can test the confirm flow without a real Resend account.
 */

import { headers } from "next/headers";
import { Resend } from "resend";

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
    // Called outside a request context (tests, CLI) — fall through.
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function buildEmail({
  requesterName,
  requesterCompany,
  refereeName,
  relationship,
  link,
}: {
  requesterName: string | null;
  requesterCompany: string | null;
  refereeName: string;
  relationship: string;
  link: string;
}): { html: string; text: string; subject: string } {
  const safeRequester = requesterName?.trim() || "Someone";
  const safeCompany = requesterCompany?.trim();
  const safeReferee = refereeName?.trim() || "there";
  const from = safeCompany ? `${safeRequester} (${safeCompany})` : safeRequester;
  const subject = `${safeRequester} asked you for a reference on VentraMatch`;

  const text = [
    `Hi ${safeReferee},`,
    ``,
    `${from} listed you as "${relationship}" and is requesting a short reference on VentraMatch.`,
    ``,
    `Click the link below to confirm or decline the reference:`,
    ``,
    link,
    ``,
    `This link expires in 14 days. If you don't recognise this request or weren't expecting it, you can safely ignore this email.`,
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
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:600;letter-spacing:-0.015em;color:#0f172a;">Reference request</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#475569;">
                Hi ${safeReferee}, <strong>${from}</strong> listed you as <em>${relationship}</em> and is requesting a short reference on VentraMatch, a platform that connects founders and investors.
              </p>
              <p style="margin:0 0 32px;">
                <a href="${link}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:14px 28px;font-size:15px;font-weight:600;letter-spacing:-0.005em;">Confirm or decline →</a>
              </p>
              <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Or paste this link into your browser:</p>
              <p style="margin:0 0 24px;font-size:13px;color:#0f172a;word-break:break-all;"><a href="${link}" style="color:#16a34a;">${link}</a></p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">This link expires in 14 days. If you don't recognise this request, you can safely ignore this email — nothing will change.</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { html, text, subject };
}

export type SendReferenceRequestResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Sends a reference request email to a referee.
 * The rawToken is included in the confirm URL — never log it to persistent storage.
 */
export async function sendReferenceRequestEmail(args: {
  rawToken: string;
  requesterName: string | null;
  requesterCompany: string | null;
  refereeName: string;
  refereeEmail: string;
  relationship: string;
}): Promise<SendReferenceRequestResult> {
  const siteUrl = await getSiteUrl();
  const link = `${siteUrl}/reference/confirm?token=${encodeURIComponent(args.rawToken)}`;

  console.log(
    `[reference-request:send] to=${args.refereeEmail} relationship="${args.relationship}" siteUrl=${siteUrl}`,
  );

  const resend = getResend();
  if (!resend) {
    console.warn(
      `[reference-request:dev] RESEND_API_KEY not set. Confirm link for ${args.refereeEmail}: ${link}`,
    );
    return { ok: true };
  }

  const from = process.env.EMAIL_FROM ?? "VentraMatch <onboarding@resend.dev>";
  const { html, text, subject } = buildEmail({
    requesterName: args.requesterName,
    requesterCompany: args.requesterCompany,
    refereeName: args.refereeName,
    relationship: args.relationship,
    link,
  });

  try {
    const result = await resend.emails.send({
      from,
      to: args.refereeEmail,
      subject,
      html,
      text,
    });
    if (result.error) {
      console.error("[reference-request:resend] error", result.error);
      return { ok: false, error: "Could not send reference request email. Try again." };
    }
    console.log(`[reference-request:sent] to=${args.refereeEmail} id=${result.data?.id}`);
    return { ok: true };
  } catch (err) {
    console.error("[reference-request:resend] threw", err);
    return { ok: false, error: "Could not send reference request email. Try again." };
  }
}
