import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { Resend } from "resend";
import { withUserRls } from "@/lib/db";

/**
 * Employment verification via email magic link.
 *
 * "I work at Stripe" → send link to `you@stripe.com` → click promotes
 * the verification to confirmed. Mirrors the pattern from Sprint 7's
 * email-change flow and Sprint 9's send-email-change helper.
 */

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

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
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  } catch { /* outside request context */ }
  return (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try { return timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

export type SendResult = { ok: true; verificationId: string } | { ok: false; error: string };

export async function createAndSendEmploymentVerification(
  userId: string,
  userName: string | null,
  employer: string,
  employerDomain: string,
  workEmail: string,
): Promise<SendResult> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expires = new Date(Date.now() + TOKEN_TTL_MS);

  let verificationId: string;
  try {
    verificationId = await withUserRls<string>(userId, async (sql) => {
      // Delete any existing pending for this employer so the partial unique
      // index doesn't block. User is effectively re-requesting.
      await sql`
        delete from public.verifications
        where user_id = ${userId}
          and employer_domain = ${employerDomain}
          and status = 'pending'
      `;
      const rows = await sql<{ id: string }[]>`
        insert into public.verifications
          (user_id, kind, claim_summary, status, verified_by,
           employer_domain, token_hash, expires_at)
        values (
          ${userId},
          'linkedin_employment'::public.verification_kind,
          ${`Employment at ${employer}`},
          'pending',
          'email_token'::public.verification_verified_by,
          ${employerDomain},
          ${tokenHash},
          ${expires}
        )
        returning id
      `;
      return rows[0].id;
    });
  } catch (err) {
    console.error("[verify-claim:db] failed", err);
    return { ok: false, error: "Could not create verification." };
  }

  const siteUrl = await getSiteUrl();
  const link = `${siteUrl}/api/verifications/confirm?token=${encodeURIComponent(token)}`;
  console.log(`[verify-claim:create] userId=${userId} employer=${employer} domain=${employerDomain}`);

  const resend = getResend();
  if (!resend) {
    console.warn(`[verify-claim:dev] RESEND_API_KEY not set. Link: ${link}`);
    return { ok: true, verificationId };
  }

  const from = process.env.EMAIL_FROM ?? "VentraMatch <onboarding@resend.dev>";
  const safeName = userName?.trim() || "there";

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f3eee5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="520" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border:1px solid #e6e0d4;padding:40px;">
<tr><td>
<p style="margin:0 0 24px;font-size:14px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#16a34a;">VentraMatch</p>
<h1 style="margin:0 0 12px;font-size:24px;font-weight:600;letter-spacing:-0.015em;">Confirm your employment</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#475569;">
Hi ${safeName}, you said you work at <strong>${employer}</strong>. Click the button below to confirm you hold an email at <strong>${employerDomain}</strong>.
</p>
<p style="margin:0 0 32px;">
<a href="${link}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:14px 28px;font-size:15px;font-weight:600;">Confirm employment</a>
</p>
<p style="margin:0 0 8px;font-size:13px;color:#64748b;">Or paste this link:</p>
<p style="margin:0 0 24px;font-size:13px;word-break:break-all;"><a href="${link}" style="color:#16a34a;">${link}</a></p>
<p style="margin:0;font-size:12px;color:#94a3b8;">This link expires in 24 hours. If you didn't request this, ignore this email.</p>
</td></tr></table></td></tr></table></body></html>`;

  const text = `Hi ${safeName},\n\nYou said you work at ${employer}. Click to confirm:\n${link}\n\nExpires in 24 hours.\n\n— VentraMatch`;

  try {
    const result = await resend.emails.send({
      from,
      to: workEmail,
      subject: `Confirm your employment at ${employer} — VentraMatch`,
      html,
      text,
    });
    if (result.error) {
      console.error("[verify-claim:resend] error", result.error);
      return { ok: false, error: "Could not send verification email." };
    }
    console.log(`[verify-claim:sent] to=${workEmail} id=${result.data?.id}`);
    return { ok: true, verificationId };
  } catch (err) {
    console.error("[verify-claim:resend] threw", err);
    return { ok: false, error: "Could not send verification email." };
  }
}
