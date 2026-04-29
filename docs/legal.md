# Legal & Compliance

> The constraints that decide what we ship and what we never ship. Read before designing any matching, messaging, or fundraising-flow surface.

This is not legal advice. We will retain counsel before public launch. The notes below distill what the founding team's research surfaced and what the AGENTS.md hard rules enforce.

## SEC / Securities

| Constraint | What we do | What we never do |
|---|---|---|
| Broker-dealer rules | Charge for software access only (subscriptions, ads). | Take a success fee, percentage of capital raised, or carry. |
| Investment-advice cliff | Surface match scores and one-line factual reasons. | Rank investors as "best", "recommended", "most likely to fund you". |
| Reg D 506(c) / general solicitation | Disclaimer on every match and feed view: *"Informational only. Not investment advice. Verify investor accreditation independently."* | Show "raising now" amounts publicly without an accredited gate, once we ship that surface. |
| No-action letter posture | Position as a venue / introduction tool. | Negotiate, structure, or hold securities transactions. |

## KYC / AML

Both sides verified before mutual unlock can issue contact info:

- **Founder** — email verified, LinkedIn or domain proof, optional ID for "Identity verified" badge.
- **Investor** — email verified, firm domain check or LinkedIn, optional accredited self-attestation. Manual review for first 200 investors.

Per the validation tier system in research:
- `unverified` → can browse but not unlock contact
- `basic` → email + one social proof
- `verified` → ID + firm/role proof

Trust labels render in UI (`Identity verified`, `Firm verified`, `Metrics self-reported`). We never label data as "verified" if we haven't actually verified it.

## Privacy

Privacy policy + cookie banner from day one. Cover at minimum:

- **CCPA / CPRA** (California)
- **GDPR / UK GDPR** (EU + UK)
- **PIPEDA** (Canada)
- **LGPD** (Brazil)
- **DPDP** (India)
- **PDPA** (Singapore)
- **Privacy Act** (Australia)

Practices:
- Data minimization — collect only what matching needs.
- Encryption at rest (managed Postgres / Railway default) and in transit (TLS).
- DSR (data-subject request) endpoint by v1.0.
- Target SOC 2 Type II for v1.0 launch.

## Email

- **CAN-SPAM (US)** — every transactional and outreach email has unsubscribe + physical address.
- **CASL (Canada)** — explicit consent for outreach. Magic links are transactional; bulk product email is opt-in only.

## Tinder / Match Group patents to avoid

This product does not infringe on these because it is not a dating platform and our matching surface is fundamentally a ranked feed with explained scores. But we will not freelance with the matching UX — every claim below is read carefully before any swipe-card change.

### Utility patents (matching mechanism)

| Patent | Subject | Our posture |
|---|---|---|
| **US9733811B2** | Profile matching, double-opt-in messaging in dating context | Not infringed (non-dating, scored feed). Avoid the exact "swipe card → blind like → mutual unlock" UI on a dating-style profile card. |
| **US8566327B2** | Earlier matching mechanism, popularity-influenced re-ranking | Not infringed. Don't auto-relax investor preferences to surface popular profiles without a documented reason. |
| **US11513666B2** | Card-stack matching with mutual interest unlock, explicitly dating | Not infringed. Our card stack shows match score + sector/stage chips, not a dating profile. |
| **US12105941B2** | Attractiveness/similarity scoring + dating card stack | Not infringed. Score is published openly with reason; not based on view-vs-like attractiveness signals. |
| **US20160127500A1** | Modifying a previous match preference | Not infringed. We allow users to undo a like before mutual match — call it "Undo", not part of a Tinder-style "Rewind" button. |
| **US9715532B2** | Content optimization in dating profiles | Not infringed. |
| **US10540414B2** | Group matching with location, dating context | Not infringed. |

### Design patents (ornamental UI)

These cover **specific visual layouts** of Tinder/Match's app screens. We must not ship a UI that visually resembles them:

`USD755814S1`, `USD779540S1`, `USD780775S1`, `USD781311S1`, `USD781334S1`, `USD781882S1`, `USD791809S1`, `USD798314S1`, `USD852809S1`, `USD854025S1`.

Avoid in particular:
- Full-bleed photo card with bottom-row of large circular X / heart / star buttons.
- Stacked cards with the underlying card peeking from below.
- The "match made" full-screen takeover with two profile photos side by side.

Our equivalent surface: **a card with sector chips + match-score pill + 1-line reason + two text-button actions ("Interested" / "Pass")**. Visually distinct.

## Intellectual property of users

- We do not claim ownership of pitch decks, business descriptions, or any user-uploaded content. Spelled out in ToS.
- NDAs implicit on private surfaces (data rooms, in-app messaging). Spelled out in ToS.
- Trademark search before public launch — "VentraMatch" cleared by counsel.

## What this means for code

- Every match surface includes a `<Disclaimer/>` component rendering the not-investment-advice line.
- Every "verified" badge is gated on actual verification source. If a user is `email_verified=true` only, we say "Email verified", never just "Verified".
- Cookie consent banner ships with the marketing site, before any analytics fires.
- No analytics on auth pages until consent is granted.
- Outbound email from the platform always includes unsubscribe + the registered company address.
