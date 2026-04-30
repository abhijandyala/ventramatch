import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — VentraMatch",
  description: "VentraMatch Privacy Policy.",
};

const VERSION = "v0.1 — Draft (pre-counsel)";
const EFFECTIVE = "April 30, 2026";

export default function PrivacyPolicyPage() {
  return (
    <article>
      <p className="mb-2 text-[12px] font-medium tracking-[0.06em] uppercase text-[color:var(--color-text-faint)]">
        {VERSION}
      </p>
      <h1 className="text-[32px] font-semibold tracking-tight text-[color:var(--color-text-strong)]">
        Privacy Policy
      </h1>
      <p className="mt-2 text-[13px] text-[color:var(--color-text-faint)]">
        Effective {EFFECTIVE}
      </p>

      <Banner>
        This Privacy Policy is an MVP draft. It will be finalized by counsel
        before public launch. It is intended to cover users in the United
        States, European Economic Area, United Kingdom, Canada, Brazil,
        India, Singapore, and Australia.
      </Banner>

      <Section title="1. Who we are">
        <p>
          VentraMatch (&ldquo;we&rdquo;, &ldquo;us&rdquo;) operates a software
          platform that helps founders and investors discover one another.
          For purposes of EU/UK GDPR, we are the data controller for the
          information you provide to us.
        </p>
      </Section>

      <Section title="2. What information we collect">
        <p className="font-medium text-[color:var(--color-text)]">
          Information you give us
        </p>
        <ul>
          <li>Account: name, email, password (hashed), role (founder or investor).</li>
          <li>Profile: company or firm name, description, industry, stage, check size, geography, traction metrics, deck files, photos, social links.</li>
          <li>Verification: LinkedIn profile, GitHub profile, domain ownership proofs, payment processor data (Stripe), portfolio links.</li>
          <li>Communication: in-app messages and notes you write about other users.</li>
          <li>Consents: timestamped record of your acceptance of these Terms and Privacy Policy, and your marketing-email preference.</li>
        </ul>

        <p className="mt-4 font-medium text-[color:var(--color-text)]">
          Information collected automatically
        </p>
        <ul>
          <li>Device and browser information (user agent, IP address, locale).</li>
          <li>Usage events (pages visited, features used, click patterns).</li>
          <li>Cookies and similar technologies — see &ldquo;Cookies&rdquo; below.</li>
        </ul>

        <p className="mt-4 font-medium text-[color:var(--color-text)]">
          Information from third parties
        </p>
        <ul>
          <li>OAuth providers (Google, LinkedIn, Microsoft Entra ID, GitHub) — basic profile information when you sign in or connect an account.</li>
          <li>Email delivery providers (Resend) — delivery and bounce events.</li>
        </ul>
      </Section>

      <Section title="3. How we use your information">
        <ul>
          <li>To operate the platform and match founders and investors based on stated fit.</li>
          <li>To verify identity, employment, domain ownership, and other claims.</li>
          <li>To detect and prevent fraud, spam, and abuse.</li>
          <li>To send transactional email (verification links, security alerts, mutual-match notifications).</li>
          <li>To send marketing email — only if you opted in.</li>
          <li>To comply with legal obligations and respond to lawful requests.</li>
        </ul>
        <p>
          For users in the EEA / UK, our lawful bases under GDPR / UK GDPR
          are: (a) performance of a contract (operating your account), (b)
          legitimate interests (security, fraud prevention, product
          improvement), (c) consent (marketing emails, optional cookies),
          and (d) legal obligation (responding to lawful requests).
        </p>
      </Section>

      <Section title="4. Who we share information with">
        <ul>
          <li><strong>Other users on the platform.</strong> Profile information you mark as visible is shown to matched counterparties.</li>
          <li><strong>Service providers.</strong> Hosting (Railway), email (Resend), AI review (OpenAI), payments (Stripe), analytics (post-consent only). Each is bound by a data processing agreement.</li>
          <li><strong>Verification sources.</strong> When you connect LinkedIn, GitHub, Stripe, or similar, we exchange the minimum information needed to verify the claim.</li>
          <li><strong>Legal requests.</strong> When required by law, court order, or legitimate legal process. We will notify you unless prohibited from doing so.</li>
        </ul>
        <p>
          We do not sell your personal information. We do not share your
          information with third-party advertisers.
        </p>
      </Section>

      <Section title="5. International data transfers">
        <p>
          Our infrastructure is hosted in the United States. If you access
          the platform from outside the United States, your information may
          be transferred to, stored in, and processed in the United States
          and other countries where our service providers operate. Where
          required, we rely on Standard Contractual Clauses (EEA/UK) or
          comparable safeguards.
        </p>
      </Section>

      <Section title="6. Data retention">
        <p>
          We keep your personal information for as long as your account is
          active and for a limited period afterwards as required for legal,
          tax, accounting, fraud-prevention, or dispute-resolution purposes.
          You can delete your account at any time, after which we will delete
          or de-identify your personal information except where retention is
          required by law.
        </p>
      </Section>

      <Section title="7. Your rights">
        <p>
          Depending on where you live, you may have the right to: access,
          correct, delete, or port your personal information; object to or
          restrict certain processing; withdraw consent; and lodge a
          complaint with a supervisory authority.
        </p>
        <p>
          You can exercise these rights from your account settings or by
          emailing <a href="mailto:privacy@ventramatch.com" className="underline underline-offset-4 hover:text-[color:var(--color-brand-strong)]">privacy@ventramatch.com</a>. We respond within the timeframes
          required by your local law (typically 30–45 days).
        </p>
        <p>
          Specific framework rights:
        </p>
        <ul>
          <li><strong>California (CCPA / CPRA):</strong> right to know, right to delete, right to correct, right to opt out of &ldquo;sale&rdquo; / &ldquo;sharing&rdquo; (we do not sell or share for cross-context behavioral advertising), right to limit use of sensitive information, right to non-discrimination.</li>
          <li><strong>EEA / UK (GDPR / UK GDPR):</strong> rights of access, rectification, erasure, restriction, portability, and objection. Right to lodge a complaint with your local data-protection authority.</li>
          <li><strong>Canada (PIPEDA):</strong> right to access and correct your personal information, and to challenge accuracy.</li>
          <li><strong>Brazil (LGPD):</strong> right to confirmation of processing, access, correction, anonymization, deletion, portability, and information about sharing.</li>
          <li><strong>India (DPDP):</strong> right to access, correction, completion, updating, erasure, and grievance redressal.</li>
          <li><strong>Singapore (PDPA):</strong> right to access and correct your personal data.</li>
          <li><strong>Australia (Privacy Act):</strong> rights under the Australian Privacy Principles, including access and correction.</li>
        </ul>
      </Section>

      <Section title="8. Cookies and similar technologies">
        <p>
          We use cookies and similar technologies for: (a) essential
          functions (authentication, security, load balancing) which do not
          require consent, (b) preferences (theme, language) which do not
          require consent, and (c) analytics, which we only enable after you
          accept via the cookie banner. You can change your cookie
          preferences at any time from the cookie banner control.
        </p>
      </Section>

      <Section title="9. Children">
        <p>
          The platform is not directed to children under 18 (under 16 in the
          EEA, where applicable). We do not knowingly collect personal
          information from children. If you believe a child has created an
          account, contact us and we will delete the data.
        </p>
      </Section>

      <Section title="10. Security">
        <p>
          We use reasonable technical and organizational measures to protect
          your information, including encryption in transit (TLS), encryption
          at rest, role-based access controls, and audit logs. No system is
          fully secure; we cannot guarantee absolute security.
        </p>
      </Section>

      <Section title="11. Changes to this Policy">
        <p>
          We may update this Privacy Policy from time to time. Material
          changes will be announced in-app and by email. The version and
          effective date at the top of this page reflect the current version.
        </p>
      </Section>

      <Section title="12. Contact">
        <p>
          Questions or to exercise your rights: <a href="mailto:privacy@ventramatch.com" className="underline underline-offset-4 hover:text-[color:var(--color-brand-strong)]">privacy@ventramatch.com</a>.
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-[20px] font-semibold tracking-tight text-[color:var(--color-text-strong)]">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-[1.65] text-[color:var(--color-text-muted)] [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_li]:pl-1 [&_strong]:text-[color:var(--color-text-strong)]">
        {children}
      </div>
    </section>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <aside
      role="note"
      className="mt-6 border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-[13px] leading-[1.6] text-[color:var(--color-text-muted)]"
    >
      {children}
    </aside>
  );
}
