# Initial project brief (kickoff)

This document records the **original project instructions** so a new developer, machine, or AI session (including another Cursor account) can understand intent without the original chat thread.

## Product (VentraMatch)

**VentraMatch** is a **matchmaking and workflow** platform for **startup founders** and **investors**. It is often explained as “Tinder for VCs and startups” for conversation only; the product is a **serious fundraising operating system**: match on real fit (industry, stage, check size, geography, traction, thesis), show ** explained match scores** with **disclaimers**, and **unlock contact only on mutual interest**.

Canonical product voice, what we will not do, and UI anti-references: **`PRODUCT.md`**. Architecture, data model, and flows: **`docs/architecture.md`**. Legal and patent guardrails: **`docs/legal.md`**. Matching math: **`docs/matching-algorithm.md`**.

### Google Doc / PDF

The team’s full research deck (problems, competitors, legal notes, team tasks) may live in a **Google Doc**; an export may be named `VentraMatch.pdf`. The **repository** is the handoff: anything that must be true in code or copy should be reflected in the files above. Do not commit the PDF unless the team decided it is public and in scope for the repo.

## Design: not “AI slop”

- **`impeccable`** in `.cursor/skills/impeccable` — craft, polish, critique, and UI discipline.
- **`ui-ux-pro-max`** in `.cursor/skills/ui-ux-pro-max` — design-system generation, styles, and industry rules on top of Impeccable.

**Workflow** is required by **`AGENTS.md`**: use both skills for UI work; tokens only from **`DESIGN.md`** / **`app/globals.css`**.

### Reinstalling skills (e.g. if `.cursor/skills` is incomplete)

```bash
npx skills add pbakaus/impeccable --yes
npx skills add nextlevelbuilder/ui-ux-pro-max-skill --yes
```

Align with the team on whether the CLI’s `.agents/` copy and `skills-lock.json` should be committed or ignored.

| Skill         | Source repo |
|----------------|------------|
| Impeccable     | https://github.com/pbakaus/impeccable |
| UI/UX Pro Max  | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill |

## Step 1 (this repo)

**Step 1** was: **infrastructure, shared design skills, and written product/architecture/legal truth** in Git before app feature sprints. Current state: see **Status** in **`README.md`**.

**Stack note:** the app uses **PostgreSQL** (e.g. **Railway**) with **Row-Level Security** and server-only access in **`lib/db.ts`**. There is **no** `supabase/` directory in the repo. See **`docs/workflow.md`**, **`docs/architecture.md`**, and **`db/migrations/`** (legacy Supabase SQL lives under **`db/legacy/`** for history only).

## Application repository

**https://github.com/abhijandyala/ventramatch** — use this as the always-current source of truth for anyone joining on a new computer.
