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

**Auth** is not bundled with the database. Plan: Auth.js, Clerk, or similar — the app will create/update `public.users` with the same `id` UUID the provider issues, and run queries inside `withUserRls` from `lib/db.ts` so RLS sees the current user.

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

## Authentication flow (target — not all wired in code yet)

1. User signs in with the chosen auth provider.
2. Server session stores user id (UUID).
3. Server Actions and RSC that touch user-scoped data call `withUserRls(userId, …)` and use the returned `sql` for queries.
4. Route gating uses the session, not the DB, for “is logged in”.

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
