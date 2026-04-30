# Team workflow — VentraMatch

## Stack (current)

| Layer | Choice |
| --- | --- |
| App | **Next.js** (web first; responsive in all browsers) |
| Database | **PostgreSQL** on **Railway** (or local Postgres in dev) |
| Connection | Server-only: **`DATABASE_URL`**, **`lib/db.ts`**, **`withUserRls`** for RLS |
| Hosting | **Railway** for the Node app and Postgres (team standard) |
| Not in use | **Supabase** (no hosted Supabase, no `supabase/` folder in the repo) |

## Git

1. **Do not commit directly to `main`.** Open a feature branch, push, open a **PR**, merge after review.
2. Branch names: `feat/…`, `fix/…`, `chore/…`, `docs/…` (see `docs/team.md`).

## CodeRabbit (PR reviews)

Automatic CodeRabbit runs on every PR are **off** via **`.coderabbit.yaml`** (`reviews.auto_review.enabled: false`). Anyone can still request a run by commenting `@coderabbitai review` on a PR. To change that behavior, edit the YAML (see [CodeRabbit auto-review docs](https://docs.coderabbit.ai/configuration/auto-review)).

If a **required status check** still shows CodeRabbit on PRs, a **repo or org admin** may need to adjust **branch protection rules** or the **CodeRabbit** installation settings on GitHub—this file only controls CodeRabbit’s own auto-review behavior.

## Documentation (keep in sync)

When you change how things work, update docs in the **same PR**: **`README.md`** for overview, scripts, and layout; **`docs/workflow.md`** for process and stack; **`docs/architecture.md`** for data flow and boundaries. Stale top-level docs confuse the next person and any AI working from the repo.

## Database changes

- **Source of truth for new deploys:** `db/migrations/*.sql` (append-only; add `0002_…`, do not edit old files).
- Apply to your DB, e.g. `psql "$DATABASE_URL" -f db/migrations/0001_initial_schema.sql`, or from the repo root: `npm run db:apply -- db/migrations/0002_auth_schema.sql` (requires `DATABASE_URL`).
- **`postgres.railway.internal`** only resolves **inside** Railway. From your laptop, use the **public** connection string from the Railway Postgres service (TCP proxy), or run the migration in a **Railway shell** / one-off job with the internal URL.
- **Archives:** `db/legacy/` — old Supabase-oriented SQL for history only; do not apply on fresh Railway databases.

## Local setup

1. `npm install`
2. Copy `.env.example` → `.env.local`, set `DATABASE_URL` and `NEXT_PUBLIC_SITE_URL`
3. Apply `db/migrations/0001_initial_schema.sql` once
4. `npm run dev`

## File storage (AWS S3)

User-uploaded files (founder pitch decks, future avatars) live in a **private** S3 bucket. The Next app generates short-lived presigned download URLs at request time — viewers never get a permanent public URL.

**Bucket setup**

1. AWS Console → S3 → Create bucket. Any region. Block ALL public access.
2. (Optional but recommended) Lifecycle rule: expire incomplete multipart uploads after 1 day.
3. (Optional) CORS — only needed when we move to direct browser-to-S3 uploads (Sprint 11+). Server-mediated uploads (current pattern) don't need CORS.

**IAM setup**

1. AWS Console → IAM → Users → Create user (programmatic access only).
2. Attach an inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:HeadObject"
      ],
      "Resource": [
        "arn:aws:s3:::<bucket>/decks/*",
        "arn:aws:s3:::<bucket>/avatars/*"
      ]
    }
  ]
}
```

3. Create an access key for the user. Put the values in `.env.local` (dev) and Railway env vars (prod):

```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=ventramatch-uploads-prod
```

4. Verify locally: upload a deck via /build → should land at `s3://<bucket>/decks/<userId>/<uuid>.pdf`.

**Costs (rough)**

- Storage: $0.023/GB-month — 10K founders × 10MB avg deck = ~$2.30/mo
- Requests: pennies at our scale
- Egress: $0.09/GB after 100GB/mo free — significant only if decks are downloaded en masse

If costs become a concern, swap the bucket for Cloudflare R2 (S3-compatible, no egress fees). Code stays the same.

## Design / UI

Use **`.cursor/skills/impeccable`** and **`ui-ux-pro-max`**; follow `PRODUCT.md` and `DESIGN.md`. See `AGENTS.md` for the full rule set.
