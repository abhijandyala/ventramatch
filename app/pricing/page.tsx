import type { Metadata, Route } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/landing/wordmark";

export const metadata: Metadata = {
  title: "Pricing — VentraMatch",
  description: "VentraMatch is free during early access. No success fees, no hidden costs.",
};

export default function PricingPage() {
  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-text)]">
      <header className="flex h-14 items-center justify-between border-b border-[var(--color-border)] px-5 md:px-8">
        <Wordmark size="sm" />
        <Link
          href="/"
          className="text-[12.5px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-strong)]"
        >
          ← Back
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[760px] px-5 py-16 md:py-24">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-faint)]">
          Pricing
        </p>
        <h1 className="mt-3 text-[36px] font-semibold tracking-tight text-[var(--color-text-strong)]">
          Free during early access.
        </h1>
        <p className="mt-4 max-w-[50ch] text-[16px] leading-[1.6] text-[var(--color-text-muted)]">
          VentraMatch is free for both founders and investors while we build
          the platform. No success fees. No credit card required. No hidden
          costs. We&apos;ll give 90 days notice before introducing any paid plans.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PlanCard
            name="Early access"
            price="$0"
            period="forever during early access"
            features={[
              "Unlimited profile building",
              "Discovery feed with filters + FTS",
              "Mutual-match contact unlock",
              "Intro requests + scheduling",
              "Google Calendar sync",
              "Verification badges",
              "Data export",
            ]}
            cta={{ label: "Get started free", href: "/sign-up" }}
            highlighted
          />
          <PlanCard
            name="Future plans"
            price="TBD"
            period="coming later"
            features={[
              "Priority in feed ranking",
              "Advanced analytics",
              "Team seats",
              "Custom branding",
              "API access",
              "SLA support",
            ]}
            cta={{ label: "Join waitlist", href: "/sign-up" }}
          />
        </div>

        <section className="mt-16 border-t border-[var(--color-border)] pt-8">
          <h2 className="text-[14px] font-semibold text-[var(--color-text-strong)]">
            No success fees — ever.
          </h2>
          <p className="mt-2 max-w-[50ch] text-[13.5px] leading-[1.6] text-[var(--color-text-muted)]">
            We never take a cut of any deal. VentraMatch is a matching tool,
            not a broker. Match scores are heuristic and informational only —
            not investment advice.
          </p>
        </section>
      </main>
    </div>
  );
}

function PlanCard({
  name,
  price,
  period,
  features,
  cta,
  highlighted,
}: {
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: { label: string; href: string };
  highlighted?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-5 border p-6"
      style={{
        borderColor: highlighted ? "var(--color-brand)" : "var(--color-border)",
      }}
    >
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-faint)]">
          {name}
        </p>
        <p className="mt-2 text-[36px] font-semibold tracking-tight text-[var(--color-text-strong)]">
          {price}
        </p>
        <p className="text-[12.5px] text-[var(--color-text-muted)]">{period}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 text-[13.5px] text-[var(--color-text)]"
          >
            <span className="mt-0.5 text-[var(--color-brand)]">✓</span>
            {f}
          </li>
        ))}
      </ul>
      <Link
        href={cta.href as Route}
        className="mt-auto inline-flex h-10 items-center justify-center text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        style={{
          background: highlighted ? "var(--color-brand)" : "var(--color-text-strong)",
        }}
      >
        {cta.label}
      </Link>
    </div>
  );
}
