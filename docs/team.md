# Team & Ownership

> Who owns what. Update when responsibilities shift. Every file in the repo should map to one of these tracks.

| Person | Track(s) | Code areas |
|---|---|---|
| **Abhi** | Coordination, infrastructure, this repo | `README.md`, `AGENTS.md`, `PRODUCT.md`, repo scaffolding, CI |
| **Alleti** | Payments, verification, frontend / visuals | `app/(dashboard)`, `components/`, Stripe integration (post-MVP) |
| **Anish (obj)** | Matching algorithm, validation, patent compliance, secure info sharing, Cursor↔Xcode bridge | `lib/matching/`, `lib/validation/`, future iOS app |
| **Adhvik (addih)** | Database, auth, login/signup | `db/`, `lib/db/`, `lib/auth/`, `app/(auth)`, `types/database.ts` |
| **Meruva** | Appeals, customer service, AI chatbot | `app/(dashboard)/support`, future support flows |
| **Shlak** | Research, marketing | `docs/research/` (TBD), marketing landing copy, social content |

## How we work

- One PR per logical change. Even small.
- Branch names: `feat/<short>`, `fix/<short>`, `docs/<short>`, `chore/<short>`.
- Reviewer: track owner first; Abhi as fallback.
- Discussion: use GitHub issues. No long Slack threads about code decisions.

## Decision log

When we make a decision that affects multiple tracks (data model change, dependency add, vendor choice), append it to `docs/decisions.md` (TBD).
