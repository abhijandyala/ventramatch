import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — VentraMatch",
  description: "VentraMatch Terms of Service.",
};

const VERSION = "v0.1 — Draft (pre-counsel)";
const EFFECTIVE = "April 30, 2026";

export default function TermsOfServicePage() {
  return (
    <article>
      <p className="mb-2 text-[12px] font-medium tracking-[0.06em] uppercase text-[color:var(--color-text-faint)]">
        {VERSION}
      </p>
      <h1 className="text-[32px] font-semibold tracking-tight text-[color:var(--color-text-strong)]">
        Terms of Service
      </h1>
      <p className="mt-2 text-[13px] text-[color:var(--color-text-faint)]">
        Effective {EFFECTIVE}
      </p>

      <Banner>
        These Terms are an MVP draft. They will be finalized by counsel before
        public launch. By using VentraMatch you agree to the version in effect
        at the time of your most recent action on the platform.
      </Banner>

      <Section title="1. What VentraMatch is">
        <p>
          VentraMatch is a software platform that helps founders and investors
          discover one another based on stated fit (industry, stage, check
          size, geography, traction, and thesis). VentraMatch is a venue and
          introduction tool. We do not raise capital, hold securities,
          structure transactions, or act as a broker-dealer.
        </p>
      </Section>

      <Section title="2. Eligibility">
        <p>
          You must be at least 18 years old and able to enter a binding
          agreement. By creating an account you represent that the information
          you provide is true and that you have the authority to act on
          behalf of any company or fund you list.
        </p>
      </Section>

      <Section title="3. Accounts and verification">
        <p>
          You are responsible for the security of your account. We may verify
          your identity, employment, domain ownership, or other claims through
          third-party services (LinkedIn, GitHub, Stripe, Crunchbase, DNS
          records). Verification badges reflect the specific signal we
          checked — never more, never less.
        </p>
      </Section>

      <Section title="4. No investment advice. No fundraising guarantee.">
        <p>
          Match scores, deal memos, and rankings are informational only.
          Nothing on VentraMatch is investment advice, an endorsement, or a
          solicitation. We do not promise that any introduction will lead to
          investment, and we do not vouch for the financial standing or
          investment intent of any user. Investors must independently verify
          accreditation status, perform diligence, and reach their own
          decisions.
        </p>
      </Section>

      <Section title="5. No success fees">
        <p>
          We charge for software access only — subscriptions, advertising, or
          other software-based revenue. We do not charge a percentage of
          capital raised, take carry, or accept any compensation contingent
          on a transaction between users.
        </p>
      </Section>

      <Section title="6. Mutual interest gating">
        <p>
          Contact information is gated by mutual interest: both sides must
          express interest before either can message the other. You may not
          attempt to bypass this gating mechanism, scrape contact data, or
          contact users outside the platform without their consent.
        </p>
      </Section>

      <Section title="7. Your content">
        <p>
          You retain ownership of all content you upload, including pitch
          decks, descriptions, photographs, financials, and any other
          materials. You grant VentraMatch a worldwide, non-exclusive,
          royalty-free license to host, display, and process that content
          solely for the purpose of operating the platform on your behalf.
          We do not claim ownership of your data or sell it to third parties.
        </p>
        <p>
          Information shared in private surfaces (data rooms, in-app
          messages) is treated as confidential. Other users may not copy,
          redistribute, or use such information outside of evaluating a
          potential investment.
        </p>
      </Section>

      <Section title="8. Acceptable use">
        <ul>
          <li>No fraudulent profiles, fake traction claims, or impersonation.</li>
          <li>No spam, mass outreach, or solicitations unrelated to fundraising.</li>
          <li>No scraping, automated crawling, or bulk extraction of user data.</li>
          <li>No discrimination on the basis of race, gender, religion, sexual orientation, disability, or any protected class.</li>
          <li>No unlawful, defamatory, or infringing content.</li>
        </ul>
      </Section>

      <Section title="9. Suspension and termination">
        <p>
          We may suspend or terminate any account that violates these Terms,
          fails our review, or otherwise harms the integrity of the platform.
          You may close your account at any time from the dashboard.
        </p>
      </Section>

      <Section title="10. Disclaimers">
        <p>
          The platform is provided &ldquo;as is&rdquo; without warranties of
          any kind, express or implied. We do not warrant that the platform
          will be uninterrupted, error-free, or secure. We do not warrant any
          outcome from any introduction made through the platform.
        </p>
      </Section>

      <Section title="11. Limitation of liability">
        <p>
          To the maximum extent permitted by law, VentraMatch and its
          affiliates will not be liable for any indirect, incidental,
          consequential, or punitive damages, or any loss of profits,
          revenues, data, or business opportunities, arising out of or in
          connection with the platform.
        </p>
      </Section>

      <Section title="12. Governing law and disputes">
        <p>
          These Terms are governed by the laws of the State of Delaware,
          excluding its conflict-of-law rules. Any dispute will be resolved
          in the state or federal courts located in Delaware, except where
          prohibited by your local law.
        </p>
      </Section>

      <Section title="13. Changes to these Terms">
        <p>
          We may update these Terms from time to time. Material changes will
          be announced in-app and via email. Continued use of the platform
          after changes take effect constitutes acceptance of the new Terms.
        </p>
      </Section>

      <Section title="14. Contact">
        <p>
          Questions or concerns: <a href="mailto:legal@ventramatch.com" className="underline underline-offset-4 hover:text-[color:var(--color-brand-strong)]">legal@ventramatch.com</a>.
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
