# Architecture

> System layout, data flow, and the boundaries we don't cross.

## Stack at a glance

```
[Browser / iOS]
      │
      ▼
[Next.js 16 App Router on Railway]
      │      ├─ React Server Components (default)
      │      ├─ Server Actions (writes, validated by Zod)
      │      └─ Route Handlers /app/api/*
      │
      ▼
[PostgreSQL on Railway]
      └─ Row-Level Security on every table (see `db/migrations`)
            policies use public.app_user_id() ← session GUC set by the app

[Resend]   transactional email (magic links, match notifications) — TBD in app
[OpenAI]   match explanation, deal memo (post-MVP)
[Stripe]   subscriptions (post-MVP)
```

**Auth** runs on **Auth.js v5 (NextAuth)** with a custom postgres-js adapter (`lib/auth/adapter.ts`):

- `auth.ts` — `NextAuth(...)` with the adapter, Credentials, and shared OAuth providers. Exports `handlers`, `signIn`, `signOut`, `auth`. Used by server actions, RSC, and the `/api/auth/[...nextauth]` route handler.
- `auth.config.ts` — edge-safe config (OAuth providers + the `authorized` callback that drives route protection). Imported by both `auth.ts` and `proxy.ts`.
- `proxy.ts` — Next 16 proxy that re-exports `auth` as the middleware function.
- Session strategy is **JWT** (forced by Credentials provider). The `accounts` and `users` tables are still persisted via the adapter for OAuth account linking; `sessions` exists but is unused.
- `public.users.id` is the single identity column. New users (OAuth or Credentials) start with `role = null` and `onboarding_completed = false`.
- Server-side handlers always run user-scoped DB writes through `withUserRls(userId, …)` in `lib/db.ts`.

## Boundaries

- **The browser never holds database credentials.** Only the server uses `DATABASE_URL` (or Railway’s injected env). No anon key model — RLS is enforced in Postgres on every query that goes through a connection with `ventramatch.user_id` set for that transaction.
- **Server Actions are the default mutation path.** API routes for webhooks, mobile, or third parties when needed.
- **All inputs are Zod-parsed** at the action / route boundary.
- **No business logic in components** for domain rules. UI calls actions; actions call `lib/`.

## Data model

See [`db/migrations/0001_initial_schema.sql`](../db/migrations/0001_initial_schema.sql) for the canonical DDL. Summary:

```
public.users (id uuid PK = auth provider user id, email, role, …)
   │
   ├──┐
   │  └─ 1:1 ─ public.startups (founder)
   │
   └─── 1:1 ─ public.investors (investor)

public.interactions → trigger → public.matches (mutual like, opposite roles)
```

### Why RLS is implemented in plain Postgres (not Supabase)

We use **Railway-managed PostgreSQL** only. Policies use `public.app_user_id()`, which reads `ventramatch.user_id` set via `set_config(..., true)` at the start of each transaction in `withUserRls` (`lib/db.ts`). The table owner / migration role bypasses RLS for triggers and admin tasks.

### Why mutual-match is a trigger

1. Atomicity — both interaction rows exist before a match is inserted.
2. Clients cannot insert into `matches` directly (no insert policy for app roles; trigger runs as **security definer**).

## Authentication flow

1. User signs in via the auth card (`/sign-in` or `/sign-up`) — credentials, Google, LinkedIn, or Microsoft Entra ID.
2. Auth.js issues a signed JWT cookie. The `jwt` callback copies `id`, `role`, and `onboardingCompleted` onto the token; `session` exposes them on `session.user`.
3. `app/post-auth/page.tsx` reads the session and routes the user. Today everyone lands at `/dashboard`; once onboarding ships, users with `onboardingCompleted = false` are redirected to `/onboarding`.
4. Route protection (proxy) runs `authConfig.callbacks.authorized` on every request:
   - Unauth'd request to a protected path → redirect to `/sign-in?from=...`.
   - Auth'd request to `/sign-in` or `/sign-up` → redirect to `/post-auth`.
5. Server Actions and RSC that touch user-scoped data call `withUserRls(userId, …)` and use the returned `sql` for queries.

## Auto-review pipeline (Phase 1 schema landed; orchestrator pending)

```
User submits /build
  └─ Server Action: upsert startups/investors + applications.status='submitted'
       └─ Enqueue review job (pg-boss, future Phase 5)

Bot worker picks up job
  └─ rules pass → application_reviews row (kind='rules')
  └─ llm pass   → application_reviews row (kind='llm', cost_usd tracked)
  └─ Stamp applications.bot_recommendation + status='under_review'
     (NEVER flips status to a terminal state)

Human reviewer signs off in /admin/review-queue (future Phase 8)
  └─ application_reviews row (kind='human')
  └─ applications.status → 'accepted' | 'needs_changes' | 'rejected' | 'banned'
       └─ Trigger updates users.account_label
       └─ email_outbox row inserted; worker sends via Resend
```

The DB enforces the human-sign-off invariant via a CHECK constraint on
`applications`: any row with `status IN ('accepted', 'rejected', 'banned')`
must have `decided_by LIKE 'human:%'`, `decided_at`, and `decision_summary`
set. This is the safety net behind the orchestrator code.

## Discovery feed flow (investor side)

```
GET /feed
  └─ RSC: withUserRls(investorId, sql => sql`select … from startups …`)
       (filter unseen, rank by scoreMatch, limit 50)
  └─ Render <FeedClient initialCards={…}/>

User taps Interested
  └─ Server Action: withUserRls(actorId, insert interaction …)
       └─ Trigger may create match row
```

## Founder dashboard flow

Three numbers + one chart, no more (per `DESIGN.md`):

- Profile views, saves, mutual matches — from `interactions` and `matches` (when those features exist).

## Environments

| Env | URL | Notes |
| --- | --- | --- |
| Local | http://localhost:3000 | `DATABASE_URL` to local Postgres or a Railway dev DB |
| Staging / prod | Railway app URL | Same repo; env vars in Railway dashboard |

## Future surfaces

| Phase | Adds |
| --- | --- |
| v0.2 | OpenAI match explanations + AI deal memo skeleton |
| v0.3 | Investor CRM (status pipeline per startup) |
| v0.4 | Startup data room (scoped object storage + audit log) |
| v0.5 | Stripe subscriptions for investors |
| v1.0 | SOC 2 Type II, KYC pipeline, accredited verification |
| v1.x | iOS native client (SwiftUI, same Postgres + API) |
