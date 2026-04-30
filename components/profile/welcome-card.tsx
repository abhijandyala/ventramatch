import type { ProfileState } from "@/types/database";

/**
 * Shown at the top of /build (founder + investor) to a user who's just
 * finished onboarding and hasn't yet engaged with the wizard.
 *
 * Three layers explained explicitly so the user understands that what's
 * required to publish (Basics) is the smallest part of the profile, and
 * that depth + verifications climb the matching score after they ship.
 *
 * Hidden once the user has published — they don't need the orientation
 * after that, and the post-publish PublishedBanner takes over.
 */

const STEPS: Array<{
  num: string;
  title: string;
  body: string;
}> = [
  {
    num: "01",
    title: "Basics",
    body: "8 short steps below. Required to publish.",
  },
  {
    num: "02",
    title: "Depth",
    body: "Team, round, traction, market — climbs your match score.",
  },
  {
    num: "03",
    title: "Verifications",
    body: "Self-attested claims and references. Pure trust signal.",
  },
];

const SHOW_FOR: ProfileState[] = ["none", "basic", "partial"];

export function ProfileWelcomeCard({
  profileState,
}: {
  profileState: ProfileState;
}) {
  if (!SHOW_FOR.includes(profileState)) return null;

  const headline =
    profileState === "partial"
      ? "Pick up where you left off."
      : "Build the profile investors see.";

  const sub =
    profileState === "partial"
      ? "Your draft is saved. Finish the basics to publish, then add depth to climb the rankings."
      : "Three layers, top to bottom. Publish after the basics — depth and verifications continue to lift your ranking after launch.";

  return (
    <section
      aria-labelledby="profile-welcome-heading"
      className="border-b"
      style={{
        background:
          "linear-gradient(180deg, var(--color-brand-tint) 0%, var(--color-surface) 100%)",
        borderColor: "var(--color-border)",
      }}
    >
      <div className="mx-auto w-full max-w-[960px] px-5 py-7 md:px-8 md:py-9">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
          Welcome
        </p>
        <h2
          id="profile-welcome-heading"
          className="mt-2 text-balance font-semibold tracking-[-0.014em] text-[color:var(--color-text-strong)]"
          style={{ fontSize: "clamp(22px, 2.6vw, 28px)", lineHeight: 1.18 }}
        >
          {headline}
        </h2>
        <p className="mt-2 max-w-[58ch] text-[13.5px] leading-[1.6] text-[color:var(--color-text-muted)]">
          {sub}
        </p>

        <ol className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          {STEPS.map((step) => (
            <li
              key={step.num}
              className="border bg-[color:var(--color-surface)] p-4"
              style={{ borderColor: "var(--color-border)" }}
            >
              <span className="font-mono text-[10.5px] font-semibold tracking-[0.16em] text-[color:var(--color-text-faint)]">
                {step.num}
              </span>
              <p className="mt-1 text-[13.5px] font-semibold tracking-tight text-[color:var(--color-text-strong)]">
                {step.title}
              </p>
              <p className="mt-1 text-[12.5px] leading-[1.5] text-[color:var(--color-text-muted)]">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
