export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-24">
      <p className="font-mono text-xs tracking-wide text-[var(--color-text-faint)] uppercase">
        v0.0 — infrastructure
      </p>
      <h1 className="font-serif text-5xl leading-tight tracking-tight text-[var(--color-text)]">
        VentraMatch.
      </h1>
      <p className="max-w-prose text-lg text-[var(--color-text-muted)]">
        Fundraising matching for startups and investors. Score-based, mutual-interest unlocked, no
        cold-email lottery. Product is being built. The marketing site you&apos;re reading right now
        is a placeholder; treat it as proof the deploy works, not as the brand.
      </p>
      <p className="text-sm text-[var(--color-text-faint)]">
        Run <code className="rounded bg-[var(--color-surface)] px-1.5 py-0.5 font-mono text-xs">/impeccable craft hero</code>{" "}
        from the connected Cursor agent to design the real landing page.
      </p>
    </main>
  );
}
