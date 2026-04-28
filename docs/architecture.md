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
      ├─────────▶ [Railway Postgres]    primary DB, source of truth (Drizzle ORM)
      │                └─ RLS policies retained as defense-in-depth
      │                   (app-layer authz is the primary gatekeeper)
      │
      ├─────────▶ [AWS S3]              file storage: decks, logos, demo videos,
      │                                  data-room docs (signed URLs from Next)
      │
      ├─────────▶ [Resend]              transactional email: magic links, match
      │                                  notifications, weekly digests
      │
      ├─────────▶ [OpenAI]              match explanation, deal memo (post-MVP)
      │
      └─────────▶ [Stripe]              subscriptions (post-MVP)
```

Hosting platform is **Railway** (Pro plan) — single dashboard for the Next.js service + the Postgres database + per-PR preview environments.

## Boundaries

- **Authorization is enforced in server actions, not in the database.** Every server action calls `requireUser()` and checks ownership against the row being read or mutated. Postgres RLS policies remain in the migration as defense-in-depth, but they are not the primary gatekeeper.
- **The browser never holds an admin DB credential.** Only the Next.js server connects to Postgres (via `DATABASE_URL`). Public reads from the browser go through server actions or RSC fetches.
- **AWS credentials are server-only.** The browser never sees `AWS_ACCESS_KEY_ID`. File uploads go: browser → Next.js server → S3 (or browser → S3 via a server-issued presigned PUT URL with a tight expiry and content-type lock).
- **Server Actions are the default mutation path.** API routes only when we need a non-Next client (mobile, webhooks, third-party).
- **All inputs are Zod-parsed at the action / route boundary.** No raw `formData.get()` into a database call.
- **No business logic in components.** UI calls actions. Actions call `lib/`. `lib/` is pure where possible.

## Data model

Canonical DDL: `db/migrations/0001_initial_schema.sql`. ASCII summary:

```
public.users (id, email, role, email_verified, password_hash?)
   │
   ├─ 1:N ─ public.sessions     (Auth.js session tokens)
   │
   ├──┐
   │  └─ 1:1 ─ public.startups       (founder side)
   │
   └─── 1:1 ─ public.investors        (investor side)

public.interactions (actor_user_id, target_user_id, action)
   └─ trigger ─▶ public.matches (when reciprocal 'like' exists across roles)
```

### Why `users` is the primary identity table
We are not on a managed auth service that owns the identity row. Auth.js writes session rows; the `users` table is the source of truth for identity, role, and verification flags. Email + role are unique-indexed; password hashing (if/when we add password auth) uses Argon2id.

### Why mutual-match is a Postgres trigger
Two reasons:
1. Atomicity — both interactions land before the match row appears, no race window where one side has "interest" and the other side hasn't yet.
2. Server-only — even if a server action is buggy, the match table can only be mutated by the trigger, never by client-shaped INSERTs.

## Authentication flow

Magic-link first (passwordless email). OAuth (Google + LinkedIn) layered later.

```
1. User submits email → Server Action calls auth.signIn('email')
2. Auth.js generates a single-use token, persists it, sends via Resend
3. Magic link URL: /api/auth/callback/email?token=...&email=...
4. Auth.js verifies the token, creates a session row + sets the cookie
5. proxy.ts refreshes session expiry on every navigation
6. RSC calls auth() (server-side) to read the session and gate routes
```

A user without a `public.users` row (first login) is redirected to `/onboarding/role` to pick founder vs. investor. After role selection, redirected to `/profile/edit` to fill in their startup or investor profile.

## Discovery feed flow (investor side)

```
GET /feed
  └─ RSC: requireUser() → fetch unseen startups for this investor
       (filter: not in interactions where actor = me)
       (rank by scoreMatch(startup, investor) desc, limit 50)
  └─ Render <FeedClient initialCards={startups}/>

User taps Interested
  └─ Server Action: insertInteraction({actor, target, action:'like'})
       └─ Trigger fires → match row if reciprocal
  └─ Optimistic UI removes the card; revalidate /feed in the background
```

## File upload flow (decks, logos)

```
1. Browser → Server Action: requestUploadUrl({kind: 'deck', filename, mimeType})
2. Server: requireUser() + validate kind/mime/size cap
3. Server → S3: getSignedUrl({Bucket, Key: 'decks/<userId>/<uuid>.pdf', expiresIn: 60s, ContentType})
4. Server → Browser: { uploadUrl, publicUrl, key }
5. Browser → S3: PUT uploadUrl (direct, never through Next.js)
6. Browser → Server Action: confirmUpload({key, kind})
   └─ Server writes the S3 key to startups.deck_url after a HEAD check
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
| Local | http://localhost:3000 | Local Postgres + an S3 bucket scoped to dev (or LocalStack S3) |
| Preview | `<branch>.up.railway.app` per PR | Railway preview env: ephemeral Next service + a branched Postgres |
| Production | https://ventramatch.com | Single Railway project: web service + Postgres + linked S3 bucket |

## Future surfaces

| Phase | Adds |
|---|---|
| v0.2 | OpenAI match explanations + AI deal memo skeleton |
| v0.3 | Investor CRM (status pipeline per startup) |
| v0.4 | Startup data room (scoped S3 prefix + audit log table) |
| v0.5 | Stripe subscriptions for investors |
| v1.0 | SOC 2 Type II, KYC pipeline, accredited verification |
| v1.x | iOS native client (SwiftUI, shared Railway Postgres + S3 backend) |
