# Profile building

How the founder/investor profile gets created, edited, validated, scored, and rendered. This is the spine of the product — every other surface (feed, intros, matches) reads from here.

> Status: **Sprint 9.5 in progress** (Phase A complete). See **Open gaps** at the bottom for what still needs work.

---

## 1. The user journey end-to-end

```
Sign up + verify email
  → /onboarding (3 steps: role → identity → connect)
  → /dashboard
  → "Build profile" CTA
  → /build  (founder)  or  /build/investor
       ┌──────────────────────────────────┐
       │ 1. Wizard (8 steps for founders, │
       │    6 for investors) — saves to   │
       │    public.startups / .investors  │
       │    (basics)                      │
       │                                  │
       │ 2. Depth editor (collapsible     │
       │    sections, save-per-section)   │
       │    saves to per-section depth    │
       │    tables (Adhvik's Sprint A-C)  │
       │                                  │
       │ 3. Verification panel — claims + │
       │    references magic-link         │
       └──────────────────────────────────┘
  → Publish (gated at ≥80% of base wizard fields)
  → /dashboard?published=1 (TODO Sprint 9.5.D banner)
```

Today the three sub-surfaces (wizard / depth editor / verifications) are visually separate and the user has to scroll past the wizard to find the depth editor. Sprint 9.5.D unifies them.

---

## 2. Tables involved

### Owned by the founder (id: `user_id`)

| Table | Migration | Purpose | Cardinality |
|---|---|---|---|
| `public.startups` | 0001 | Basics: name, one_liner, industry, stage, raise_amount, traction, location, deck_url, website | 1:1 with user |
| `public.startup_team_members` | 0012 | Co-founders, key hires | 1:N |
| `public.startup_round_details` | 0013 | Lead status, close target, valuation cap, round mechanics | 1:1 |
| `public.startup_cap_table_summary` | 0013 | High-level ownership snapshot | 1:1 |
| `public.startup_use_of_funds_lines` | 0013 | "What this round buys you" line items | 1:N |
| `public.startup_traction_signals` | 0014 | MRR / customers / growth / pilots / press, structured | 1:N |
| `public.startup_market_analysis` | 0014 | Market size, narrative | 1:1 |
| `public.startup_competitive_landscape` | 0014 | Named competitors | 1:N |

### Owned by the investor (id: `user_id`)

| Table | Migration | Purpose | Cardinality |
|---|---|---|---|
| `public.investors` | 0001 | Basics: firm, sectors, stages, geographies, check_min/max, thesis | 1:1 |
| `public.investor_team_members` | 0012 | Partners | 1:N |
| `public.investor_check_bands` | 0015 | Per-stage check sizes (more accurate than scalar min/max) | 1:N |
| `public.investor_portfolio` | 0015 | Portfolio companies | 1:N |
| `public.investor_track_record` | 0015 | Aggregate stats | 1:1 |
| `public.investor_decision_process` | 0015 | How decisions get made | 1:1 |
| `public.investor_value_add` | 0015 | Beyond-capital contributions | 1:N |
| `public.investor_anti_patterns` | 0015 | What this investor doesn't want | 1:N |

### Trust (shared)

| Table | Migration | Purpose |
|---|---|---|
| `public.verifications` | 0016 | Self-attested claims with `pending|confirmed|rejected|expired` status |
| `public.references_received` | 0016 | Magic-link references from colleagues |

All tables have RLS enabled. The full policy matrix lives in each migration's comment block.

---

## 3. Code map

### Wizards

- `app/build/page.tsx` — server: loads startup row + depth view + own verifications/references, hands to `FounderBuilder`
- `app/build/builder.tsx` — client: 8-step wizard (company / sector / stage / round / traction / deck / founder / review). Mounts `FounderDepthEditor` and `VerificationPanel` below.
- `app/build/investor/page.tsx` + `builder.tsx` — investor mirror

### Depth editors (Adhvik's Sprint C)

- `components/profile/founder-depth-editor.tsx` — 6 collapsible sections (Team, Round, Traction, Market, Competitors, Cap Table)
- `components/profile/investor-depth-editor.tsx` — 7 sections (Team, Check Bands, Portfolio, Track Record, Decision Process, Value Add, Anti-Patterns)

### Verifications

- `components/profile/verification-panel.tsx` — Claims + References sections, mounted by both builders
- `app/build/verification-actions.ts` — `submitVerificationAction`, `requestReferenceAction`, `cancelReferenceAction`
- `lib/email/send-reference-request.ts` — magic-link sender
- `app/reference/confirm/` — reference confirmation landing page

### Server actions

- `app/build/actions.ts` — `saveFounderDraftAction`, `submitFounderApplicationAction` (publish gate lives here)
- `app/build/depth-actions.ts` — 7 per-section save actions
- `app/build/investor/actions.ts` + `depth-actions.ts` — investor mirrors
- `app/build/verification-actions.ts` — claims + references

### Validation

- `lib/validation/applications.ts` — Adhvik's `submitFounderSchema`, `draftFounderSchema`, investor mirrors
- `lib/validation/depth.ts` — 19+ depth schemas (Zod)

### Pure logic (no I/O)

- `lib/profile/completion.ts` — `founderCompletion`, `investorCompletion`, `MIN_PUBLISH_PCT = 80`. Items have `base?: boolean` — only base items gate publish.
- `lib/profile/visibility.ts` — `projectStartupTier1/2`, `projectInvestorTier1/2`, `hasContactUnlocked`, `resolveTier`, plus 25+ depth-projection types
- `lib/profile/sectors.ts` — **Sprint 9.5.A.2** — single canonical sector taxonomy + alias map (used by all wizards + matching score)
- `lib/matching/score.ts` — Adhvik's depth-aware `scoreMatch`. Now uses `sectorMatches` from sectors.ts so legacy aliases match canonical labels.

### I/O wrappers

- `lib/profile/depth.ts` — `fetchStartupDepth`, `fetchInvestorDepth`, `fetchOwnVerifications`, `fetchOwnReferences`, `fetchConfirmedVerifications`, `fetchConfirmedReferences`
- `lib/profile/builder-completion.ts` — **Sprint 9.5.A.4** — `founderCompletionWithDepth(userId)` + `investorCompletionWithDepth(userId)` — fetches all depth counts in one trip and feeds the pure function
- `lib/profile/views.ts` — `recordProfileView` (24h debounce, block-aware)

### Read-side (`/p/[userId]`)

- `app/p/[userId]/page.tsx` — server: loads target user + own row + tier resolution + depth + match score, renders both basic profile cards and depth sections
- `components/profile/depth-sections.tsx` — `StartupDepthSections`, `InvestorDepthSections`. Tier-gated.

---

## 4. The completion calculator

The displayed "Profile X% complete" number on the dashboard and the publish gate inside `submitFounderApplicationAction` are both computed by `lib/profile/completion.ts`.

```
ChecklistItem = {
  id, label, href, done, weight, base?: boolean
}
```

Two summaries are computed:

- **Display %** — uses the FULL list. As you fill more depth sections, the % climbs.
- **Publish gate** — uses `base: true` items ONLY. So adding new optional depth checklist items (Sprint 9.5+) never accidentally locks out a partially-filled profile that used to publish.

Default for `base` is **true**, so any ChecklistItem that forgets to set it is treated as base. Only the explicit depth items are marked `base: false`.

### Weight breakdown (founder)

| Item | Weight | Base? |
|---|---|---|
| name | 8 | ✓ |
| oneLiner | 12 | ✓ |
| website | 5 | ✓ |
| industry | 8 | ✓ |
| stage | 10 | ✓ |
| raise | 10 | ✓ |
| location | 5 | ✓ |
| traction | 15 | ✓ |
| deck | 20 | ✓ |
| **Base subtotal** | **93** | |
| team (depth) | 5 | bonus |
| roundDetails (depth) | 2 | bonus |
| capTable (depth) | 2 | bonus |
| useOfFunds (depth) | 2 | bonus |
| market (depth) | 3 | bonus |
| competitors (depth) | 3 | bonus |
| **Total weight** | **110** | |

Publish gate = 80% × 93 = ~75 base weight needed. Display % = base + bonus / 110.

### Weight breakdown (investor)

| Item | Weight | Base? |
|---|---|---|
| name | 8 | ✓ |
| firm | 5 | ✓ |
| checkSize | 18 | ✓ |
| stages | 14 | ✓ |
| sectors | 14 | ✓ |
| geographies | 10 | ✓ |
| thesis | 15 | ✓ |
| active | 5 | ✓ |
| trackRecord | 8 | ✓ |
| **Base subtotal** | **97** | |
| team (depth) | 3 | bonus |
| decisionProcess (depth) | 3 | bonus |
| valueAdd (depth) | 3 | bonus |
| antiPatterns (depth) | 2 | bonus |
| **Total weight** | **108** | |

---

## 5. Sector taxonomy

Pre-Sprint 9.5 there were **6 different sector lists** scattered across the codebase that disagreed on naming. A founder with `industry='Healthtech'` would not match an investor who picked `'Healthcare'`. This silently zeroed the sector signal in the matching algorithm.

**Sprint 9.5.A.2** consolidated everything into `lib/profile/sectors.ts`:

- `STARTUP_SECTORS` / `INVESTOR_SECTORS` — single canonical list (currently 27 sectors)
- `SECTOR_ALIASES` — lowercase alias → canonical (handles "Healthcare" → "Healthtech", "Bio" → "Biotech", "Web3" → "Web3 / Crypto", etc.)
- `normaliseSector(s)` — canonicalisation function used at compare time
- `sectorMatches(industry, sectors[])` — used by `lib/matching/score.ts → sectorScore`

Call sites that import from this file:

- `app/build/builder.tsx` — founder wizard sector chips
- `app/build/investor/builder.tsx` — investor wizard sector chips
- `app/onboarding/_components/form-controls.tsx` — onboarding `SectorChips`
- `lib/matching/score.ts` — sector intersect

Still using their own lists (mock or read-only display; not user-input forms):

- `app/(dashboard)/profile/_components/ProfileTabs.tsx` — old mock UI, low priority
- `components/dashboard/FiltersPanel.tsx` — dashboard mock data
- `lib/dashboards/mock-data.ts` — pure mock fixtures

---

## 6. Open gaps (the Sprint 9.5 todo)

These are the things that turn this from "demo-quality" to "shippable to public founders":

| Gap | Status | Sprint phase |
|---|---|---|
| Deck file upload (currently just URL paste) | ✅ Sprint 9.5.B (S3, /api/deck/upload, DeckUploader, authed read route) | done |
| Avatars (currently no photos anywhere) | ✅ Sprint 9.5.C (S3, /api/avatar/upload, AvatarUploader with crop, Avatar component). Mounted in ProfileDropdown, /p/[userId], RecentViewersRail, /matches, /settings. Deferred mounts: FeedCard / IntroCard / inbox detail (require visibility-projection type extension) | partial |
| Wizard ↔ depth editor are visually disconnected; user doesn't know depth exists | not started | 9.5.D |
| Round data duplicated between wizard's RoundStep and depth editor's RoundSection | not addressed | 9.5.D |
| Sectors collected as "pick up to 3" but only `[0]` saved as `industry` | not addressed | 9.5.D (needs `startup_sectors[]` migration) |
| `verifications.status` never moves off `pending` (no verifier worker exists) | designed but no worker | 9.5.E |
| Resend config for verification + reference emails not confirmed in production | uncertain | 9.5.E.0 |
| Three different save-state UIs (wizard / depth / verification) | `<SaveIndicator>` built in 9.5.A.3, swap in Phase F | 9.5.F |
| `/build` is desktop-first, hasn't been mobile-audited | not started | 9.5.F.4 |
| No persistent overall completion bar on `/build` | not started | 9.5.F.2 |

---

## 6.1 Pending hooks for the account-deletion cron

When the hard-delete cron is built (Sprint 7's `deletion_requested_at` 30-day grace) it MUST also clear S3 objects. Don't just delete the DB row; the storage_keys reference real bytes that cost money and contain PII.

```ts
// inside the deletion worker, before the DELETE FROM users:
const deckKeys = await sql`
  select deck_storage_key from public.startups
  where user_id = ${userId} and deck_storage_key is not null
`;
const avatarKeys = await sql`
  select avatar_storage_key from public.users
  where id = ${userId} and avatar_storage_key is not null
`;
for (const { deck_storage_key } of deckKeys) {
  await deleteObject(deck_storage_key); // lib/storage/s3.ts
}
for (const { avatar_storage_key } of avatarKeys) {
  await deleteObject(avatar_storage_key);
}
```

Until that cron exists, deleted accounts leak deck + avatar blobs. Acceptable at v0 volume (zero real users) but file as a launch blocker.

## 6.2 Avatar mount sites — coverage status

Mounted in Sprint 9.5.C:
- `components/layout/ProfileDropdown.tsx` (always-visible nav avatar; reads from session.user.image which is updated on upload via unstable_update)
- `app/p/[userId]/page.tsx` (FounderProfile + InvestorProfile headers, size xl)
- `components/dashboard/RecentViewersRail.tsx`
- `app/(dashboard)/matches/page.tsx` (MatchRow)
- `app/(dashboard)/settings/page.tsx#account` (the AvatarUploader itself)

Deferred to a later sprint (each requires a small invasive change to extend the visibility projection types — `StartupPublic` / `InvestorPublic` would gain `avatarSrc`, plus matching fetch/projection updates):
- `components/feed/feed-card.tsx`
- `components/intros/intro-card.tsx`
- `app/(dashboard)/inbox/[introId]/page.tsx` (intro detail header)

Not needed right now: onboarding (no avatar prompt yet), build wizard FounderStep (settings already covers it; wizard avatar is a Phase D unification concern).

## 7. Important conventions

- **Append-only migrations.** Once a migration is committed, never edit it. Add a new one to fix.
- **Schema split.** Basics in `public.startups` / `public.investors` (one row per user). Depth in per-table 1:N or 1:1 child tables. Never widen the basics tables for things that belong in depth.
- **Pure vs I/O separation.** `completion.ts` and `visibility.ts` are pure (no DB calls). `builder-completion.ts` and `depth.ts` are the I/O wrappers. UI should call I/O wrappers, never duplicate the queries.
- **Tier discipline.** `/p/[userId]` MUST go through `resolveTier` and the `projectXxxTier1/2/Depth` projection functions. Never select raw DB rows into a public render path.
- **Honest verification copy.** A confirmed verification means we verified ONE thing (e.g. they hold an email at `@stripe.com`). The badge text must reflect what was actually checked: "Email-verified at stripe.com" — not "Verified employee of Stripe."
- **Self-attested numbers must say so.** MRR / customer counts / growth rates that aren't backed by a verifier (Stripe, etc.) need to be visually labeled as self-reported. The `Disclaimer` component is the standard pattern.
