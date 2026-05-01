import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — VentraMatch",
  description: "VentraMatch Terms of Service.",
};

const VERSION = "v0.2 — Draft (pre-counsel)";
const EFFECTIVE = "May 1, 2026";

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
        These Terms are an MVP draft and should be reviewed by qualified legal
        counsel before public launch. By accessing or using VentraMatch, you
        agree to the version of these Terms in effect at the time of your most
        recent use of the platform.
      </Banner>

      <Section title="1. What VentraMatch is">
        <p>
          VentraMatch is a software platform that helps founders, startups,
          investors, funds, and related ecosystem participants discover one
          another based on stated fit, profile information, preferences,
          stage, sector, geography, check size, traction, thesis, and other
          compatibility signals.
        </p>

        <p>
          VentraMatch is a discovery, matching, workflow, and introduction
          platform. VentraMatch is not a broker-dealer, investment adviser,
          funding portal, law firm, accounting firm, due diligence provider,
          valuation provider, or securities exchange. We do not raise capital
          on your behalf, hold securities, structure transactions, negotiate
          investment terms, provide legal or tax advice, or guarantee that any
          introduction will result in funding, investment, partnership, or any
          other business outcome.
        </p>
      </Section>

      <Section title="2. Eligibility">
        <p>
          You must be at least 18 years old and legally able to enter into a
          binding agreement to use VentraMatch. By creating an account, you
          represent that all information you provide is accurate, current, and
          complete, and that you have authority to act on behalf of any company,
          startup, fund, syndicate, employer, or other organization you list or
          represent on the platform.
        </p>

        <p>
          If you use VentraMatch on behalf of an organization, then "you" also
          means that organization, and you represent that you are authorized to
          bind that organization to these Terms.
        </p>
      </Section>

      <Section title="3. Accounts and account security">
        <p>
          You are responsible for maintaining the confidentiality and security
          of your account credentials and for all activity that occurs under
          your account. You may not share your login credentials, impersonate
          another person, create misleading accounts, or use another user's
          account without permission.
        </p>

        <p>
          You agree to notify us promptly if you believe your account has been
          compromised or used without authorization. We may suspend or restrict
          accounts that appear to be compromised, fraudulent, misleading, or
          harmful to the integrity of the platform.
        </p>
      </Section>

      <Section title="4. Verification and profile signals">
        <p>
          VentraMatch may allow users to verify certain profile signals, such
          as identity, role, employment, company domain ownership, social
          profiles, GitHub presence, LinkedIn profile, investor status,
          portfolio information, or other claims. Verification may be performed
          through third-party services, public sources, user-submitted
          materials, domain records, or manual review.
        </p>

        <p>
          A verification badge or profile signal means only that VentraMatch
          reviewed the specific signal described. It is not a guarantee that
          the user is trustworthy, financially capable, accredited, authorized
          to invest, authorized to fundraise, compliant with securities laws,
          or suitable for any particular transaction.
        </p>
      </Section>

      <Section title="5. No investment advice, legal advice, or fundraising guarantee">
        <p>
          Any match score, ranking, recommendation, profile summary, generated
          insight, deal memo, suggested fit, or introduction shown on
          VentraMatch is provided for informational and workflow purposes only.
          Nothing on VentraMatch is investment advice, legal advice, tax
          advice, accounting advice, valuation advice, a securities
          recommendation, an endorsement, or a solicitation to buy, sell, or
          offer securities.
        </p>

        <p>
          Users are solely responsible for their own diligence, decisions,
          communications, negotiations, compliance obligations, and
          transactions. Investors must independently evaluate each opportunity,
          verify claims, confirm their own accreditation or eligibility where
          required, and consult their own legal, tax, financial, and investment
          advisers. Founders must independently comply with all fundraising,
          securities, privacy, employment, intellectual property, and
          disclosure obligations that apply to them.
        </p>

        <p>
          VentraMatch does not guarantee that any user will receive funding,
          make an investment, obtain a meeting, close a deal, receive a
          response, or achieve any business result.
        </p>
      </Section>

      <Section title="6. No broker-dealer activity and no success fees">
        <p>
          VentraMatch provides software access and platform functionality. We
          do not charge success fees, transaction-based compensation, carried
          interest, finder's fees, brokerage commissions, or any percentage of
          capital raised or invested through user interactions.
        </p>

        <p>
          Any paid features, subscriptions, sponsorships, advertising,
          analytics, data tools, or premium software access are charged for use
          of the software and not for the successful completion of any
          financing, securities transaction, investment, or business deal.
        </p>
      </Section>

      <Section title="7. Mutual interest, introductions, and communications">
        <p>
          VentraMatch may use mutual interest gating, profile visibility
          controls, permissioned introductions, or similar mechanisms to reduce
          spam and protect user privacy. You may not bypass these controls,
          scrape contact information, export user lists, contact users outside
          the platform without permission, or use VentraMatch to send spam,
          mass outreach, misleading solicitations, or unrelated commercial
          messages.
        </p>

        <p>
          If you communicate with another user, you are responsible for your
          own statements, representations, files, offers, commitments, and
          conduct. VentraMatch is not a party to communications, negotiations,
          agreements, investments, SAFE notes, convertible notes, equity
          financings, advisory arrangements, or other transactions between
          users.
        </p>
      </Section>

      <Section title="8. Your content and ownership">
        <p>
          You retain ownership of the content and materials you submit to
          VentraMatch, including startup profiles, investor profiles, pitch
          decks, descriptions, logos, screenshots, financial information,
          traction metrics, founder biographies, investment theses, messages,
          data room materials, and any other business information you upload
          or provide.
        </p>

        <p>
          You grant VentraMatch a limited, worldwide, non-exclusive,
          royalty-free license to host, store, process, transmit, display,
          format, analyze, and use your content only as reasonably necessary to
          operate, secure, improve, and provide the platform, including
          displaying your profile to permitted users, generating matches,
          powering recommendations, enabling introductions, preventing abuse,
          and supporting user-requested features.
        </p>

        <p>
          This license does not transfer ownership of your content to
          VentraMatch. We do not claim ownership of your startup idea, business
          plan, pitch deck, invention, product roadmap, financial model,
          strategy, fund thesis, investment process, or other proprietary
          materials.
        </p>
      </Section>

      <Section title="9. Startup ideas, confidential materials, and user obligations">
        <p>
          VentraMatch exists to help founders and investors discover each
          other, not to take, copy, or commercialize user ideas. We will not
          use your private pitch materials to launch a competing company or
          intentionally provide your confidential materials to another user
          outside the permissions and visibility settings of the platform.
        </p>

        <p>
          Other users may receive access to your profile, deck, messages, data
          room materials, or business information only through the visibility
          settings, sharing flows, mutual interest features, or permissions
          available on the platform. Users who receive private or permissioned
          materials may use them only to evaluate a potential investment,
          partnership, introduction, employment opportunity, advisory
          relationship, or other legitimate platform-related opportunity.
        </p>

        <p>
          Users may not copy, publish, redistribute, sell, train models on,
          reverse engineer, create competing products from, or otherwise misuse
          another user's confidential or permissioned materials without that
          user's separate written permission.
        </p>

        <p>
          VentraMatch is not a substitute for a nondisclosure agreement. If you
          need formal confidentiality protections, trade secret protections, or
          invention assignment terms, you should use separate written
          agreements with the relevant parties.
        </p>
      </Section>

      <Section title="10. Public information and third-party data">
        <p>
          VentraMatch may use publicly available information, user-submitted
          information, third-party data sources, websites, public startup
          databases, public investor profiles, public portfolio pages, public
          social profiles, public company descriptions, and similar sources to
          enrich profiles, improve discovery, reduce fraud, and support
          matching functionality.
        </p>

        <p>
          You are responsible for making sure any information you submit is
          accurate and that you have the right to submit it. If you believe
          public or third-party information displayed on VentraMatch is
          inaccurate, outdated, or should be removed, you may contact us and
          request correction or removal where appropriate.
        </p>
      </Section>

      <Section title="11. Machine learning, recommendations, and platform improvement">
        <p>
          VentraMatch may use algorithms, machine learning, language models,
          ranking systems, and other automated tools to help recommend
          founders, startups, investors, funds, profiles, introductions, and
          platform content. These systems may consider profile information,
          stated preferences, sector, stage, geography, check size, funding
          goals, investment thesis, traction, interaction signals, saved
          profiles, dismissed profiles, clicks, searches, and similar platform
          activity.
        </p>

        <p>
          If you provide a "what are you looking for" preference or similar
          onboarding input, VentraMatch may use that information as a matching
          and recommendation signal. If you do not provide that input,
          VentraMatch may use other available profile information and platform
          signals to generate recommendations.
        </p>

        <p>
          VentraMatch may train, tune, evaluate, or improve its matching and
          recommendation systems using publicly available startup and investor
          information, aggregated platform analytics, de-identified usage
          patterns, and profile-level compatibility signals. Private pitch
          decks, private data room files, private messages, and other
          permissioned materials will not be used to train third-party
          generative AI models without additional permission or notice where
          required by law.
        </p>

        <p>
          Automated recommendations may be incomplete, inaccurate, biased,
          outdated, or based on limited information. You should not rely on
          recommendation outputs as the sole basis for any investment,
          fundraising, hiring, partnership, legal, financial, or business
          decision.
        </p>
      </Section>

      <Section title="12. Feedback and product suggestions">
        <p>
          If you send us feedback, ideas, bug reports, product suggestions,
          feature requests, or other recommendations about VentraMatch, you
          grant us permission to use that feedback without restriction or
          compensation. This does not give us ownership of your startup,
          investment fund, pitch deck, private business plan, or confidential
          materials.
        </p>
      </Section>

      <Section title="13. Acceptable use">
        <p>You agree not to use VentraMatch to:</p>

        <ul>
          <li>Create fake, misleading, impersonated, or fraudulent profiles.</li>
          <li>Misrepresent traction, revenue, customers, investors, credentials, employment, authority, or identity.</li>
          <li>Upload false, unlawful, defamatory, infringing, confidential, or unauthorized content.</li>
          <li>Scrape, crawl, harvest, export, or bulk extract user data, contact information, profiles, decks, or platform content.</li>
          <li>Bypass mutual interest gates, visibility settings, rate limits, security controls, or access restrictions.</li>
          <li>Use another user's private materials to compete with, copy, clone, or harm that user.</li>
          <li>Send spam, mass outreach, phishing messages, malware, or unrelated solicitations.</li>
          <li>Reverse engineer, decompile, interfere with, or attempt to access non-public parts of the platform.</li>
          <li>Use the platform to violate securities laws, privacy laws, intellectual property laws, anti-spam laws, export laws, or any other applicable law.</li>
          <li>Discriminate, harass, threaten, or exclude users on the basis of race, color, religion, sex, sexual orientation, gender identity, national origin, disability, age, veteran status, or any other protected class.</li>
          <li>Use VentraMatch to make investment offers, fundraising claims, or securities-related communications that you are not legally permitted to make.</li>
        </ul>
      </Section>

      <Section title="14. User representations">
        <p>
          By using VentraMatch, you represent and warrant that:
        </p>

        <ul>
          <li>You have the legal right to submit the information and materials you provide.</li>
          <li>Your profile information is accurate and not intentionally misleading.</li>
          <li>Your use of the platform will comply with applicable laws and regulations.</li>
          <li>You will not use VentraMatch to avoid legal, securities, privacy, or disclosure obligations.</li>
          <li>You will not rely on VentraMatch as your sole diligence source.</li>
          <li>You will obtain any professional advice needed before making legal, financial, tax, investment, or fundraising decisions.</li>
        </ul>
      </Section>

      <Section title="15. Intellectual property">
        <p>
          VentraMatch and its software, design, branding, logos, interface,
          workflows, recommendation systems, databases, code, visual elements,
          and platform content are owned by VentraMatch or its licensors and
          are protected by intellectual property laws.
        </p>

        <p>
          Subject to these Terms, we grant you a limited, revocable,
          non-exclusive, non-transferable license to access and use the
          platform for its intended purpose. You may not copy, modify,
          distribute, sell, lease, reverse engineer, or create derivative works
          from VentraMatch's software, branding, recommendation systems, or
          platform content except as allowed by law or with our written
          permission.
        </p>
      </Section>

      <Section title="16. Privacy">
        <p>
          Our collection and use of personal information is described in our
          Privacy Policy. The Terms of Service govern platform rules and user
          responsibilities, while the Privacy Policy explains how personal
          information is collected, used, shared, retained, and protected.
        </p>

        <p>
          Because VentraMatch may process personal information, account data,
          profile data, usage data, and communications metadata, you should
          review the Privacy Policy carefully before using the platform.
        </p>
      </Section>

      <Section title="17. Third-party services and links">
        <p>
          VentraMatch may integrate with or link to third-party services such
          as LinkedIn, GitHub, Stripe, Crunchbase, Google, analytics providers,
          verification tools, hosting providers, email services, or other
          vendors. We are not responsible for third-party services, websites,
          data, policies, outages, or actions.
        </p>

        <p>
          Your use of third-party services may be governed by separate terms
          and privacy policies from those providers.
        </p>
      </Section>

      <Section title="18. Payment, subscriptions, and paid features">
        <p>
          VentraMatch may offer free and paid software features, subscriptions,
          premium access, sponsored placements, analytics, or other paid
          services. Pricing, billing frequency, renewal terms, cancellation
          rules, and refund terms will be shown at checkout or in the relevant
          plan description.
        </p>

        <p>
          Paid software access is not a success fee, investment fee,
          brokerage commission, carried interest, or transaction-based
          compensation. Unless otherwise stated, fees are charged for platform
          access and software functionality, not for the completion of any
          investment or fundraising transaction.
        </p>
      </Section>

      <Section title="19. Beta features and MVP limitations">
        <p>
          VentraMatch may offer beta, experimental, preview, or MVP features.
          These features may be incomplete, inaccurate, unstable, changed, or
          discontinued at any time. Beta features may produce incorrect
          recommendations, incomplete profile summaries, inaccurate rankings,
          or unexpected behavior.
        </p>

        <p>
          You agree not to rely on beta or automated outputs as your sole basis
          for investment, fundraising, legal, financial, hiring, partnership,
          or operational decisions.
        </p>
      </Section>

      <Section title="20. Suspension and termination">
        <p>
          We may suspend, restrict, or terminate your account or access to the
          platform if we believe you violated these Terms, created risk or
          liability for VentraMatch or other users, submitted false or harmful
          information, misused confidential materials, attempted to bypass
          platform controls, or otherwise harmed the integrity, security, or
          trust of the platform.
        </p>

        <p>
          You may stop using VentraMatch at any time. Account closure may not
          immediately remove information that has already been shared with
          other users through platform permissions, preserved for legal or
          security reasons, or retained in backups for a limited period.
        </p>
      </Section>

      <Section title="21. Disclaimers">
        <p>
          VentraMatch is provided on an "as is" and "as available" basis
          without warranties of any kind, whether express, implied, statutory,
          or otherwise. To the maximum extent permitted by law, we disclaim all
          warranties, including warranties of merchantability, fitness for a
          particular purpose, title, non-infringement, accuracy, availability,
          security, and error-free operation.
        </p>

        <p>
          We do not warrant that the platform will be uninterrupted, secure,
          accurate, complete, current, or free from defects. We do not warrant
          that any profile, recommendation, match, verification signal,
          introduction, user, investor, startup, fund, company, or opportunity
          is accurate, suitable, compliant, solvent, legitimate, or
          investment-worthy.
        </p>
      </Section>

      <Section title="22. Limitation of liability">
        <p>
          To the maximum extent permitted by law, VentraMatch and its
          affiliates, officers, directors, employees, contractors, agents,
          licensors, and service providers will not be liable for any indirect,
          incidental, consequential, special, exemplary, or punitive damages,
          or any loss of profits, revenue, goodwill, data, business
          opportunities, investment returns, financing opportunities, or
          anticipated savings, arising out of or related to your use of the
          platform.
        </p>

        <p>
          To the maximum extent permitted by law, VentraMatch's total liability
          for any claim arising out of or related to the platform or these
          Terms will not exceed the greater of one hundred dollars ($100) or
          the amount you paid VentraMatch for the platform in the three months
          before the event giving rise to the claim.
        </p>
      </Section>

      <Section title="23. Indemnification">
        <p>
          You agree to defend, indemnify, and hold harmless VentraMatch and its
          affiliates, officers, directors, employees, contractors, agents,
          licensors, and service providers from and against any claims,
          damages, losses, liabilities, costs, and expenses, including
          reasonable attorneys' fees, arising out of or related to your use of
          the platform, your content, your communications with other users,
          your transactions or attempted transactions, your violation of these
          Terms, your violation of law, or your infringement or misuse of
          another party's rights or confidential information.
        </p>
      </Section>

      <Section title="24. Governing law and disputes">
        <p>
          These Terms are governed by the laws of the State of Delaware,
          excluding its conflict-of-law rules. Any dispute arising out of or
          relating to these Terms or VentraMatch will be resolved in the state
          or federal courts located in Delaware, except where prohibited by
          applicable law.
        </p>

        <p>
          Before filing a claim, you agree to contact us and attempt to resolve
          the dispute informally. This informal process does not prevent either
          party from seeking urgent injunctive relief where necessary to
          protect confidential information, intellectual property, platform
          security, or user safety.
        </p>
      </Section>

      <Section title="25. Changes to these Terms">
        <p>
          We may update these Terms from time to time. If we make material
          changes, we will provide notice through the platform, by email, or by
          another reasonable method. Your continued use of VentraMatch after
          updated Terms take effect means you accept the updated Terms.
        </p>
      </Section>

      <Section title="26. Contact">
        <p>
          Questions, concerns, correction requests, or legal notices may be
          sent to{" "}
          <a
            href="mailto:legal@ventramatch.com"
            className="underline underline-offset-4 hover:text-[color:var(--color-brand-strong)]"
          >
            legal@ventramatch.com
          </a>
          .
        </p>
      </Section>
    </article>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
