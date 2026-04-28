# VentraMatch

> An AI-powered matchmaking platform for startups and investors. The "Tinder for VCs and startups" — but built as a serious fundraising operating system.

**Repo:** https://github.com/abhijandyala/ventramatch

---

## Read this first (every Cursor / dev machine)

If you just connected this repo on a new computer, you must read these in order before writing any code:

1. **`README.md`** (this file) — project overview, stack, layout, conventions.
2. **`PRODUCT.md`** — product truth: who we serve, brand, tone, anti-references. Required by the `impeccable` design skill.
3. **`DESIGN.md`** — design system: colors, typography, spacing, components.
4. **`AGENTS.md`** — instructions for any AI agent working on this repo.
5. **`docs/architecture.md`** — system architecture, data model, matching logic.
6. **`docs/legal.md`** — legal & compliance constraints (SEC, KYC, Tinder patents to avoid).

Both AI design skills are pre-installed in `.cursor/skills/`:
- **`impeccable`** — `/impeccable craft`, `/impeccable polish`, `/impeccable critique`, etc. (24 commands).
- **`ui-ux-pro-max`** — design-system generation across 67 styles + 161 industry rules.

> Use these skills for **all** UI work. The product must not look AI-generated.

---

## What VentraMatch is

A matchmaking + workflow platform where:

- **Founders** create a structured startup profile (one-liner, industry, stage, raise amount, traction, deck, team, location).
- **Investors** create an investment profile (check size, stage, sectors, geography, thesis, active status).
- An **AI matching engine** ranks both sides against each other on industry / stage / check / geography / traction fit.
- A **discovery feed** (TikTok-style for investors, ranked list for founders) replaces cold email + warm-intro lottery.
- **Mutual interest unlocks** messaging — protects founders from spam, protects investors from low-signal inbound.

Long-term, it expands into a fundraising OS: AI deal memos, fundraising readiness score, investor CRM, data rooms, demo days, accelerator tools, student-founder networks.

### Positioning (use this exact line for YC / press)

> "We're building a discovery engine for startup fundraising — like a TikTok feed for investors to find high-quality startups instead of relying on conferences and warm intros."

---

## MVP scope (v0.1, ~7 days)

The **only** loop we ship first:

> Investor opens app → sees high-fit startup → likes / passes → repeat. Founders get visibility + dashboard. Mutual interest unlocks contact.

### MVP feature list

1. **Auth** (email + magic link via Resend) with role select on signup (founder / investor).
2. **Founder profile** — startup name, one-liner, industry, stage, amount raising, traction, location, founder name, deck URL/upload.
3. **Investor profile** — name, firm, check size, stage, sectors, location, active toggle.
4. **Discovery feed** — investor-side card stack with `Interested` / `Pass` / `Save` actions and match %.
5. **Matching algorithm v1** — weighted score: 30% sector + 25% stage + 20% check size + 15% geography + 10% traction. Outputs match % + 1-line explanation.
6. **Mutual unlock** — when both sides express interest, contact info / messaging unlocks.
7. **Anti-spam** — email verification + minimum profile completeness + soft visibility filter on incomplete profiles.
8. **Founder dashboard** — views, saves, investor-interest count.

### Deliberately cut from v0.1

AI deal memo, AI outreach generator, full CRM, demo days, ads, complex KYC, public investor search, advanced verification. These come later.

### 7-day plan

| Day | Deliverable |
|-----|-------------|
| 1–2 | Railway Postgres, auth, DB schema, founder profile CRUD |
| 3 | Investor profile CRUD |
| 4 | Discovery feed UI + cards |
| 5 | Matching algorithm + match-% display |
| 6 | Like / pass / save interactions + mutual unlock |
| 7 | Polish, founder dashboard, demo-able state |

---

## Tech stack

| Layer | Choice | Why |
|------|--------|-----|
| Framework | **Next.js 16** (App Router, TypeScript, RSC, Turbopack) | Fast iteration, server components, edge friendly |
| Styling | **Tailwind CSS v4** + custom tokens | Required by Impeccable / UI-UX-Pro-Max skills |
| UI primitives | **shadcn/ui** + Radix | Accessible, customizable, no vendor lock-in |
| Hosting | **Railway** (Pro plan) | Single platform for app + Postgres, preview environments per PR |
| Database | **Postgres** on Railway | Managed Postgres, auto-backups, easy connection strings |
| File storage | **AWS S3** | Pitch decks, logos, demo videos, future data-room docs. Signed URLs from the Next.js server. |
| DB layer | **TBD** (Drizzle ORM recommended) | Type-safe, fast, migration tooling |
| Auth | **TBD** (Auth.js v5 recommended, magic link via Resend) | Passwordless email + future OAuth (Google / LinkedIn) |
| Email | **Resend** | Magic links, transactional, good deliverability |
| Payments | **Stripe** (post-MVP) | Subscription tiers for investors / founders |
| AI | **OpenAI** (post-MVP) | Match explanations, deal memos, readiness scoring |
| Analytics | **PostHog** (later) | Product analytics for founder dashboard |

### Future / scale stack
- AWS RDS for Postgres if Railway's managed Postgres tier becomes a bottleneck
- AWS EC2 / ECS for any background workers (deck parsing, AI deal-memo generation)
- SOC 2 Type II tooling (Vanta / Drata)
- Native iOS via SwiftUI (Cursor + Xcode bridge — Anish's track)

---

## Repository layout

```
ventramatch/
├── README.md                   <- you are here
├── AGENTS.md                   <- AI agent instructions
├── PRODUCT.md                  <- product truth (required by impeccable skill)
├── DESIGN.md                   <- design system (required by impeccable skill)
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── .env.example                <- copy to .env.local and fill in
├── .gitignore
│
├── app/                        <- Next.js App Router routes
│   ├── layout.tsx
│   ├── page.tsx                <- marketing landing
│   ├── globals.css
│   ├── (auth)/
│   │   ├── login/
│   │   └── signup/
│   ├── (dashboard)/
│   │   ├── feed/               <- investor discovery feed
│   │   ├── profile/            <- own profile (founder or investor)
│   │   ├── matches/            <- mutual matches inbox
│   │   └── dashboard/          <- founder analytics
│   └── api/                    <- route handlers (matching, webhooks)
│
├── components/                 <- shared React components
│   ├── ui/                     <- shadcn primitives
│   ├── feed/                   <- card stack, swipe gestures
│   ├── profile/                <- profile forms + display
│   └── marketing/              <- landing-page sections
│
├── proxy.ts                    <- Next 16 proxy (auth session refresh)
├── lib/
│   ├── db/                     <- Drizzle client + schema (planned)
│   ├── auth/                   <- Auth.js config + helpers (planned)
│   ├── storage/                <- S3 client + signed-URL helpers (planned)
│   ├── matching/
│   │   ├── score.ts            <- weighted match score
│   │   └── explain.ts          <- 1-line match explanation
│   ├── validation/             <- zod schemas
│   ├── env.ts                  <- typed env loader
│   └── utils.ts
│
├── db/
│   ├── migrations/             <- SQL migrations (source of truth)
│   ├── seed.sql                <- dev seed data
│   └── schema.ts               <- Drizzle schema (planned)
│
├── types/
│   └── database.ts             <- generated DB types
│
├── design-system/              <- generated by ui-ux-pro-max
│   ├── MASTER.md               <- global design tokens
│   └── pages/                  <- page-specific overrides
│
├── docs/
│   ├── architecture.md
│   ├── legal.md                <- SEC, KYC, Tinder patents to avoid
│   ├── matching-algorithm.md
│   └── team.md                 <- ownership map
│
└── .cursor/
    ├── rules/
    │   └── kluster-code-verify.mdc
    └── skills/
        ├── impeccable/         <- /impeccable craft, polish, etc.
        └── ui-ux-pro-max/      <- design-system generator
```

---

## Data model (MVP)

```sql
-- Core entities. Canonical DDL will live in db/migrations/0001_initial_schema.sql.

users               -- the primary identity table (no external auth.users dependency)
  id, email, role ('founder' | 'investor'), email_verified,
  password_hash | null, created_at, updated_at

sessions            -- Auth.js / opaque session tokens
  id, user_id, token_hash, expires_at, created_at

startups            -- one per founder user
  id, user_id, name, one_liner, industry, stage, raise_amount,
  traction, location, deck_url, website, created_at, updated_at

investors           -- one per investor user
  id, user_id, name, firm, check_min, check_max, stages[], sectors[],
  geographies[], is_active, thesis, created_at, updated_at

interactions        -- every like / pass / save event
  id, actor_user_id, target_user_id, action ('like'|'pass'|'save'),
  created_at

matches             -- mutual interest
  id, founder_user_id, investor_user_id, matched_at, contact_unlocked
```

Authorization is enforced at the **server-action layer** (every action calls `requireUser()` and checks ownership against the row being modified). The current SQL migration has Postgres RLS policies — those will be retained as defense-in-depth even though the app is the primary gatekeeper.

---

## Matching algorithm v1

```
score = 0.30 * sector_match
      + 0.25 * stage_match
      + 0.20 * check_size_match
      + 0.15 * geography_match
      + 0.10 * traction_compat
```

Each sub-score returns 0.0–1.0. Final `score` is rendered as `Math.round(score * 100)` percent. Output also includes a one-line human explanation: `"91% match — invests in pre-seed fintech within your check range"`.

Full spec: [`docs/matching-algorithm.md`](docs/matching-algorithm.md).

---

## Legal / compliance constraints (read before building any matching UI)

This product touches securities and personal data. Do not freelance here.

- **No success fees.** We charge for software access only. Do not become a broker-dealer.
- **No investment advice.** We surface matches; we do not rank investors as a recommendation. Disclaimers required on every match score.
- **SEC Reg D 506(c)** if any general solicitation features ship — needs accredited-investor verification.
- **GDPR / CCPA / CPRA / UK GDPR / LGPD / DPDP / PDPA / Australia Privacy Act** — privacy policy + cookie banner from day one.
- **CAN-SPAM / CASL** — every outreach email includes an unsubscribe.
- **AML / KYC** — verify both founders and investors before mutual unlock.
- **SOC 2 Type II** — target for v1.0 launch.

### Tinder patents to avoid (critical)

Match Group / Tinder hold these. We must not implement them as described:

- **US9733811B2**, **US8566327B2**, **US11513666B2**, **US12105941B2** — "matching process system and method" (the double-opt-in card-stack patent family).
- **US10540414B2** — group matching with location.
- **US9715532B2** — content/profile optimization in dating context.
- **USD755814S1, USD779540S1, USD780775S1, USD781311S1, USD781334S1, USD781882S1, USD791809S1, USD798314S1, USD852809S1, USD854025S1** — design patents on Tinder/Match's specific GUI layouts.

**Our differentiators that put us outside these patents:**
1. We are not a dating platform (most claims explicitly require dating context).
2. Our discovery surface is a **ranked feed with explained match scores**, not a blind card stack.
3. Mutual interest unlocks **contact + workflow** (deck access, intro request), not just messaging.
4. Visual layout must be visibly distinct from Tinder's claimed designs (no two-action big-circle button row, no full-bleed photo card with tap-to-reveal).

Full breakdown: [`docs/legal.md`](docs/legal.md).

---

## Local development

### Prereqs
- Node.js 20+
- npm 10+ (or pnpm / bun)
- Python 3 (already required for `ui-ux-pro-max` skill)
- Railway CLI (optional, for deploy + log tailing): `brew install railway`
- A local Postgres 15+ for development, OR a Railway Postgres dev URL

### Setup

```bash
git clone https://github.com/abhijandyala/ventramatch.git
cd ventramatch
npm install                       # also activates git hooks via 'prepare' script
cp .env.example .env.local        # then fill in DATABASE_URL, AWS keys, Resend key
npm run db:migrate                # apply migrations (script wired in follow-up PR)
npm run dev                       # http://localhost:3000
```

For local Postgres: install via `brew install postgresql@15 && brew services start postgresql@15`, then create a DB and put the URL in `DATABASE_URL`. For Railway-hosted dev DB: copy the connection string from Railway dashboard → Variables.

> The `npm install` step runs `scripts/setup-hooks.sh` which sets `core.hooksPath = .githooks`. This activates the pre-push hook so any `git push` from `main` is auto-converted into a feature branch + PR. Don't disable it.

### Common scripts

| Command | What |
|---------|------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Apply Drizzle migrations to `DATABASE_URL` (planned) |
| `npm run db:generate` | Generate Drizzle migration from schema diff (planned) |
| `npm run db:studio` | Open Drizzle Studio against `DATABASE_URL` (planned) |
| `npm run ship` | Push current branch + open / reuse a PR (explicit form) |
| `npm run setup:hooks` | Re-activate git hooks (rarely needed; `npm install` handles it) |

### Push & PR workflow (auto)

`main` is branch-protected on GitHub — direct pushes are rejected. The local pre-push hook (`.githooks/pre-push`) handles this automatically:

```text
$ git commit -am "tweak hero copy"
$ git push                              # you're on main
  Push to 'main' intercepted — opening a PR instead.
  → branch: auto/20260428-153012-a1b2c3d
  ✓ branch 'auto/20260428-153012-a1b2c3d' pushed
  ✓ PR opened: https://github.com/abhijandyala/ventramatch/pull/12
  ✓ checked out 'auto/20260428-153012-a1b2c3d' locally
  ✓ local 'main' reset to 'origin/main'
```

After review, merge the PR on GitHub. Then locally: `git checkout main && git pull`.

If you'd rather be explicit, branch yourself first (`git checkout -b feat/<thing>`), commit, push, and either run `npm run ship` or `gh pr create --fill`.

---

## Working with the design skills

**Always start UI work by loading context.** Either skill needs project truth:

```bash
# Impeccable — loads PRODUCT.md + DESIGN.md
node .cursor/skills/impeccable/scripts/load-context.mjs

# ui-ux-pro-max — generate / refresh master design system
python3 .cursor/skills/ui-ux-pro-max/scripts/search.py \
  "fundraising matchmaking SaaS for VCs and founders" \
  --design-system --persist -p "VentraMatch"
```

Then use commands like `/impeccable craft`, `/impeccable critique`, `/impeccable polish` for component work, and ui-ux-pro-max for fresh page-level systems.

**Hard rule:** if the output could be tagged "AI made that" at a glance, it ships nowhere. Re-run with a sharper register / register-specific reference.

---

## Team & ownership

| Person | Track |
|--------|-------|
| **Alleti** | Payments (Stripe), verification, frontend / visuals |
| **Anish (obj)** | Matching algorithm, validation pipeline, patent research, secure information sharing, Cursor↔Xcode bridge |
| **Adhvik (addih)** | Database (Railway Postgres / Drizzle / Resend), login/signup |
| **Meruva** | Appeals, customer service, AI chatbot |
| **Shlak** | Research, marketing |
| **Abhi** | Coordination, this repo, infrastructure |

Detailed split: [`docs/team.md`](docs/team.md).

---

## Naming notes

The product is **VentraMatch**. Earlier internal codenames in research (VentureConnect, PickStart) refer to the same idea — ignore them in user-facing copy.

---

## Status

`v0.0.1` — infrastructure + skills installed, auto-PR workflow live, docs aligned to Railway + Postgres + AWS S3. DB-layer (Drizzle) and auth (Auth.js v5 magic-link) wiring lands in the next PR.
