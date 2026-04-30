import type { VerificationBadge } from "@/lib/profile/visibility";
import type { VerificationKind } from "@/types/database";

/**
 * Confirmed verification badges from the `verifications` table (0016).
 * Sits beside `<VerificationBadges>` (which renders account-label and
 * presence-based signals). These are claim-level verifications: the
 * specific thing we checked (LinkedIn employment, domain ownership,
 * Form D filing, Crunchbase listing, etc.).
 *
 * Per docs/legal.md and the schema comment in 0016: a row only renders
 * here if `status='confirmed'` and (`expires_at` is null or in the future).
 * Filtering is the caller's responsibility — see
 * `fetchConfirmedVerifications` in `lib/profile/depth.ts`.
 */

const KIND_LABEL: Record<VerificationKind, string> = {
  linkedin_employment: "LinkedIn employment verified",
  github_account: "GitHub account verified",
  domain_ownership: "Domain ownership verified",
  sec_form_d: "SEC Form D matched",
  crunchbase_listing: "Crunchbase listing matched",
  // self_attestation never renders — by definition it's a claim with no
  // independent signal. Schema-level it would never reach status='confirmed'
  // unless an admin promoted it. Keep the label here for completeness so
  // we don't fall back to the raw enum value if it ever does.
  self_attestation: "Self-attested",
};

const KIND_DESCRIPTION: Record<VerificationKind, string> = {
  linkedin_employment:
    "We checked the claim against the user's LinkedIn record via OAuth.",
  github_account:
    "We confirmed the user controls this GitHub profile or organization.",
  domain_ownership:
    "We confirmed the user controls the domain via a one-time email magic link.",
  sec_form_d:
    "We matched the user's claim to a public Form D filing on EDGAR.",
  crunchbase_listing: "We matched the user to a public Crunchbase profile.",
  self_attestation:
    "User-stated claim with no independent verification.",
};

export function DepthVerificationBadges({
  badges,
  size = "sm",
}: {
  badges: VerificationBadge[];
  size?: "sm" | "md";
}) {
  if (badges.length === 0) return null;

  const padding = size === "md" ? "px-2.5 py-1" : "px-2 py-0.5";
  const fontSize = size === "md" ? "text-[12px]" : "text-[11px]";

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => {
        if (b.kind === "self_attestation") return null;
        return (
          <span
            key={b.id}
            title={KIND_DESCRIPTION[b.kind]}
            className={`inline-flex items-center gap-1 ${padding} ${fontSize} font-medium`}
            style={{
              background: "var(--color-brand-tint)",
              color: "var(--color-brand-strong)",
              border: "1px solid var(--color-brand)",
            }}
          >
            <span aria-hidden className="font-bold">
              ✓
            </span>
            {KIND_LABEL[b.kind]}
          </span>
        );
      })}
    </div>
  );
}
