# PRODUCT.md — VentraMatch

> Truth document for the `impeccable` design skill. Edited by humans. AI agents read this before any UI work; never silently rewrite it.

## Product purpose

VentraMatch is a fundraising matching platform where startup founders and investors find each other based on real fit (industry, stage, check size, geography, traction, thesis), instead of cold email lotteries and warm-intro nepotism.

The verb is **discover**, not "swipe". Discovery is structured, scored, explained — not a dating-app blind tap.

## Users

We have two primary users with opposing pain. Designs must serve both.

### Founders
Pre-seed and seed stage. Many are first-time, technical, often student or early-career. They feel fundraising as **status anxiety + time bleed** — every cold email that doesn't reply is evidence they're not good enough. Mostly mobile-first, often on a laptop late at night between product work.

What they want from us: **legibility on whether they're ready, and a shorter, fairer path to the right investor.**

What they don't want: more dashboards, more AI tools that don't move money, hype.

### Investors
Angels, micro-VCs, and small fund partners. They have the opposite problem: too much inbound, mostly low signal. They are time-starved and signal-hungry. They scroll on a desktop with high-res monitors during work hours and on iPhone between meetings.

What they want from us: **filtered, ranked deal flow that respects their thesis and reads in 5 seconds per startup.**

What they don't want: another inbox, a "swipe" toy, anything that looks unserious.

### Excluded for v0.1
- Top-tier VCs (will not adopt a new platform first)
- Family offices (acquisition channel is opaque, not our wedge)
- Retail investors (regulatory cliff)

We will earn them later. Don't design for them now.

## Register

`product` — VentraMatch is a working tool people use repeatedly. The marketing site is the only `brand` surface.

## Brand

### Voice
- Direct. Adult. Founder-to-founder, partner-to-partner.
- Plain English. No jargon. No "synergy", no "supercharge", no "unlock your full potential".
- Honest about what we are: we surface fit, we don't promise capital.
- Slightly dry. We trust the user to be smart.

### Tone examples

| Don't | Do |
|---|---|
| "Unleash your fundraising journey ✨" | "Stop emailing the wrong investors." |
| "Get matched with your dream VC!" | "Eight investors fit your raise. Three are active this month." |
| "You've got a match! 🎉" | "Mutual interest with Acme Capital. Contact unlocked." |
| "Our AI-powered intelligent matching engine..." | "Match on stage, sector, check size, geography, traction." |

### Anti-references

We are explicitly **not** trying to look or feel like:

- **Tinder / Bumble** — gamified, photo-led, blind. We are not a dating app. The Tinder layout (full-bleed photo card with bottom-row big-circle X / heart / star buttons) is also patented design — avoiding it is also a legal requirement, see `docs/legal.md`.
- **Crunchbase / PitchBook** — database dumps with infinite filters. Cold and inert.
- **OpenVC / AngelList** — utilitarian but feels like a 2014 directory site.
- **Generic AI SaaS landing pages** — purple-pink gradients, "AI-powered" badges, animated robot orbs. Instant "AI made this" tag.
- **Casino / fintech-trader UIs** — neon greens, candlestick chrome. Wrong emotional register.

### Inspirations (loosely, never copy)
- **Linear** — restraint, density, opinionated defaults.
- **Stripe (docs and dashboard)** — calm authority, precise typography.
- **Notion calendar / Cron** — quiet motion, every transition has a job.
- **Are.na** — taste, slowness, no shouting.

## Strategic principles

1. **Score everything, hide nothing.** Every match shows the percentage and the one-line reason. If we can't explain the score, we don't show the match.
2. **Mutual interest is the only unlock.** Either side can see the other exists, but contact is gated by both clicking interested. This is a product principle and a spam moat.
3. **Quality before scale.** First 50 startups are hand-curated. Investors leave permanently if the feed is junk; we never recover.
4. **Workflow > swipe.** The card flick is a feature, not the product. The product is the fundraising loop after the match.
5. **Disclaimer on every score.** We are not investment advice. Every match score, deal memo, and ranking carries a one-line "informational only" disclaimer. Lawyers > vibes.
6. **Founder time is sacred.** No notifications that don't change founder behavior. No emails that aren't actionable. No dashboard metrics that don't tell them what to do next.
7. **Investor experience > founder experience when they conflict.** We monetize the investor side. Founders who feel the platform is fair will accept slightly less hand-holding; investors who feel it's noisy leave instantly.

## Things we will not do

- Take success fees. Ever. (Broker-dealer regulation cliff.)
- Rank investors as "best" or "recommended" investments. (Investment-advice cliff.)
- Promise funding. (Misrepresentation cliff.)
- Use the word "destiny", "unlock", "supercharge", or "AI-powered" in any user-visible copy.
- Use emoji as functional icons. (Lucide / Heroicons SVG only.)
- Use stock startup-illustration art (the floating-laptop-with-rocket genre).
- Build a chat product before building a match product.

## Surfaces (current)

| Surface | Register | Notes |
|---|---|---|
| `/` (marketing landing) | brand | Only brand surface. Carries the strongest opinion. |
| `/login`, `/signup` | product | Quiet, minimal, no decoration. |
| `/feed` (investor) | product | Core loop. Dense, fast, cards are scannable in <5s. |
| `/profile` (founder) | product | Form-led, encouraging. Live readiness preview. |
| `/profile` (investor) | product | Form-led, terse. |
| `/matches` | product | List of mutual matches, action-oriented. |
| `/dashboard` (founder) | product | Three numbers + one chart. Not more. |

## Open questions (don't fake answers in design)

- Do investors want a swipe-card stack or a vertical ranked list? Test both in v0.1.
- Should founders see who likes them before mutual match, or only at mutual? Leaning "see count, not identity".
- Mobile-first or desktop-first for v0.1? Investors are desktop, founders are mobile. Probably ship both at MVP, optimize separately later.
