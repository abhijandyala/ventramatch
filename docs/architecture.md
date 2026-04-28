# Architecture

> System layout, data flow, and the boundaries we don't cross.

## Stack at a glance

```
[Browser / iOS]
      │
      ▼
[Next.js 15 App Router on Vercel]
      │      ├─ React Server Components (default)
      │      ├─ Server Actions (writes, validated by Zod)
      │      └─ Route Handlers /app/api/*
      │
      ▼
[Supabase]
      ├─ Postgres 15 (DB, source of truth)
      │     └─ Row-Level Security on every table
      ├─ Auth (email magic link via Resend)
      └─ Storage (decks, logos)

[Resend]   transactional email (magic links, match notifications)
[OpenAI]   match explanation, deal memo (post-MVP)
[Stripe]   subscriptions (post-MVP)
```

## Boundaries

- **The browser never bypasses RLS.** Anon key only. The service-role key is server-only and used for the mutual-match trigger function and admin scripts.
- **Server Actions are the default mutation path.** API routes only when we need a non-Next client (mobile, webhooks, third-party).
- **All inputs are Zod-parsed at the action / route boundary.** No raw `formData.get()` into a database call.
- **No business logic in components.** UI calls actions. Actions call `lib/`. `lib/` is pure where possible.

## Data model

See [`supabase/migrations/0001_initial_schema.sql`](../supabase/migrations/0001_initial_schema.sql) for the canonical DDL. ASCII summary:

```
auth.users (Supabase managed)
   │ 1:1
public.users (id, email, role, email_verified)
   │
   ├──┐
   │  └─ 1:1 ─ public.startups       (founder side)
   │
   └─── 1:1 ─ public.investors        (investor side)

public.interactions (actor_user_id, target_user_id, action)
   └─ trigger ─▶ public.matches (when reciprocal 'like' exists across roles)
```

### Why `users` mirrors `auth.users`
Supabase's `auth.users` is private and not joinable from `public`. We mirror the minimum we need (email, role, verification) into `public.users` so RLS policies and joins work.

### Why mutual-match is a trigger
Two reasons:
1. Atomicity — both interactions land before the match row appears, no race window where one side has "interest" and the other side hasn't yet.
2. Server-only — clients can't fabricate matches.

## Authentication flow

```
1. User submits email → Server Action calls supabase.auth.signInWithOtp
2. Resend delivers magic link → user clicks
3. /auth/callback handler calls supabase.auth.exchangeCodeForSession
4. middleware.ts refreshes the session cookie on every navigation
5. RSC reads supabase.auth.getUser() and gates routes
```

A user without a `public.users` row (first login) is redirected to `/onboarding/role` to pick founder vs. investor. After role selection, redirected to `/profile/edit` to fill in their startup or investor profile.

## Discovery feed flow (investor side)

```
GET /feed
  └─ RSC: createClient() → fetch unseen startups for this investor
       (filter: not in interactions where actor = me)
       (rank by scoreMatch(startup, investor) desc, limit 50)
  └─ Render <FeedClient initialCards={startups}/>

User taps Interested
  └─ Server Action: insertInteraction({actor, target, action:'like'})
       └─ Trigger fires → match row if reciprocal
  └─ Optimistic UI removes the card; revalidate /feed in the background
```

## Founder dashboard flow

Three numbers + one chart, no more (per `DESIGN.md`):
- Profile views (last 7d)
- Investor saves
- Mutual matches

All sourced from `interactions` and `matches`. No vanity counts.

## Environments

| Env | URL | Notes |
|---|---|---|
| Local | http://localhost:3000 | Supabase Docker stack |
| Preview | `*.vercel.app` per PR | Supabase project per branch (later) |
| Production | https://ventramatch.com | Single Supabase project |

## Future surfaces

| Phase | Adds |
|---|---|
| v0.2 | OpenAI match explanations + AI deal memo skeleton |
| v0.3 | Investor CRM (status pipeline per startup) |
| v0.4 | Startup data room (scoped storage with audit log) |
| v0.5 | Stripe subscriptions for investors |
| v1.0 | SOC 2 Type II, KYC pipeline, accredited verification |
| v1.x | iOS native client (SwiftUI, shared Supabase backend) |
