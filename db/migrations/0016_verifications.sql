-- Profile depth — Sprint A: verifications + references magic-link.
-- Append-only: never edit this file once committed. Add a new migration to fix.
--
-- Two new tables that promote claims made on the depth rows from "self-
-- attested string" to "verified by an external signal." Without these,
-- every prior-Stripe / prior-Google / "$25k MRR" claim is just a freeform
-- assertion and serious investors discount accordingly.
--
--   1. verifications — generic claim verification. The kind enum lists
--      every signal we know how to check (LinkedIn employment, GitHub
--      account ownership, domain control, SEC Form D filings, public
--      Crunchbase listing). Status moves pending → confirmed | rejected
--      | expired. The `verified_by` enum captures HOW we verified.
--   2. references_received — references that founders / investors solicit
--      from people who'll vouch for them. Reuses the magic-link pattern
--      from email_change_requests (0011) — sha256-hashed token, 14d
--      TTL by default, constant-time compare in the route handler.
--
-- Decisions baked in here:
--   1. `verified_by` enum reserves `linkedin_oauth | email_token |
--      sec_public` as the v0 verifiers, plus `self` for self-attestation
--      (which is how a row starts before any verifier runs). We
--      deliberately do NOT add a `human_review` value yet — that's the
--      paid-tier hook (per the user's "free now, paid later" direction).
--      When we want it, that's a follow-up migration that ALTER TYPEs
--      the enum to add the value.
--   2. `evidence_url` + `evidence_hash` together: the URL is what
--      humans see; the sha256 hash of the evidence content (or a screenshot
--      hash) is what we store so a tampered URL after-the-fact is
--      detectable. evidence_hash is optional (some verifiers don't have
--      content to hash, e.g., LinkedIn OAuth confirms from the API).
--   3. references_received holds the referee's email, name, and stated
--      relationship at request time. Confirmation flips status to
--      'confirmed' and stamps confirmed_at + endorsement (optional one-
--      liner from the referee). The token is hashed at rest like
--      email_change_requests.token_hash.
--   4. RLS: verifications are Tier 1.5 (visible to verified viewers via
--      app-layer enforcement) — same select-all + write-as-owner pattern
--      as the depth tables. references_received is `select own only`
--      because exposing the referee's email + name to any viewer leaks
--      third-party PII; only the user being vouched for and the server
--      (for the magic-link confirm route) ever read these rows.
--
-- No backfill: tables start empty.

-- ──────────────────────────────────────────────────────────────────────────
-- 0. Enums (idempotent)
-- ──────────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.verification_kind as enum (
    'linkedin_employment',  -- claim of employment at company X, confirmed via LinkedIn OAuth scope
    'github_account',        -- ownership of a github profile/org
    'domain_ownership',      -- control of a domain (DKIM-style email magic link)
    'sec_form_d',            -- public Form D filing on EDGAR
    'crunchbase_listing',    -- public Crunchbase profile
    'self_attestation'       -- explicit self-claim with no external check (placeholder default)
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.verification_status as enum (
    'pending',
    'confirmed',
    'rejected',
    'expired'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.verification_verified_by as enum (
    'self',           -- self-attestation (no external check)
    'linkedin_oauth', -- LinkedIn API confirmed the claim
    'email_token',    -- magic-link to a controlled address
    'sec_public'      -- matched against an SEC public filing
    -- 'human_review' reserved for a future paid-tier migration; not in v0
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.reference_status as enum (
    'sent',       -- email sent, awaiting referee click
    'confirmed',  -- referee clicked the link and confirmed the relationship
    'declined',   -- referee clicked the link and explicitly declined
    'expired'     -- TTL elapsed without action
  );
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 1. verifications (1:N with users)
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,

  kind public.verification_kind not null,

  -- The thing we checked. URL for human-readable artifact (LinkedIn
  -- profile URL, Form D filing, Crunchbase page); hash for tamper
  -- detection on screenshots / file evidence.
  evidence_url text check (evidence_url is null or length(evidence_url) <= 500),
  evidence_hash text check (evidence_hash is null or length(evidence_hash) = 64),

  -- Optional context — the specific claim being verified (e.g., for
  -- linkedin_employment: "Stripe — Engineering Manager (2021-2024)").
  claim_summary text check (claim_summary is null or length(claim_summary) <= 200),

  status public.verification_status not null default 'pending',
  verified_by public.verification_verified_by not null default 'self',
  verified_at timestamptz,

  -- Verifications can expire (LinkedIn employment claims should re-verify
  -- annually so they don't get stale). Optional — set by the verifier
  -- workflow per kind.
  expires_at timestamptz,

  -- If status='rejected', a short reason for the audit trail.
  rejection_reason text check (rejection_reason is null or length(rejection_reason) <= 300),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists verifications_set_updated_at on public.verifications;
create trigger verifications_set_updated_at
  before update on public.verifications
  for each row execute function public.set_updated_at();

create index if not exists verifications_user_idx
  on public.verifications (user_id, kind, status);

-- Drives "show me confirmed verifications" badge rendering.
create index if not exists verifications_confirmed_idx
  on public.verifications (user_id)
  where status = 'confirmed';

-- A given user has at most one ACTIVE (confirmed-not-expired) verification
-- per kind. They can have multiple historical rows (rejected, expired)
-- alongside one current one. Partial unique index gives us that.
create unique index if not exists verifications_one_active_per_kind
  on public.verifications (user_id, kind)
  where status = 'confirmed';

alter table public.verifications enable row level security;

-- Tier 1.5 read posture — anyone can see confirmed verifications on a
-- verified user's profile. The app layer enforces the verified-viewer
-- gate (lib/profile/visibility.ts).
drop policy if exists "verifications select all" on public.verifications;
create policy "verifications select all"
  on public.verifications for select
  using (true);

drop policy if exists "verifications insert as owner" on public.verifications;
create policy "verifications insert as owner"
  on public.verifications for insert
  with check (user_id = public.app_user_id());

-- Updates: the user can update their own verifications (e.g., to retry
-- a rejected one with new evidence). Server-role bypasses RLS for the
-- verifier worker that flips pending → confirmed.
drop policy if exists "verifications update own" on public.verifications;
create policy "verifications update own"
  on public.verifications for update
  using (user_id = public.app_user_id())
  with check (user_id = public.app_user_id());

drop policy if exists "verifications delete own" on public.verifications;
create policy "verifications delete own"
  on public.verifications for delete
  using (user_id = public.app_user_id());

-- ──────────────────────────────────────────────────────────────────────────
-- 2. references_received (1:N with users)
-- ──────────────────────────────────────────────────────────────────────────
--
-- A reference REQUEST is sent to an email; the referee clicks the magic
-- link and confirms (or declines) the relationship. Reuses the token-
-- hashing pattern from email_change_requests (0011): sha256 at rest,
-- constant-time compare in the route handler.
--
-- Privacy: only the user being vouched for can read their own rows. The
-- referee's email is third-party PII and never surfaces to other users
-- via the public profile. What surfaces is the CONFIRMED reference's
-- name + relationship + endorsement (rendered in a separate read path
-- that filters status='confirmed').

create table if not exists public.references_received (
  id uuid primary key default gen_random_uuid(),

  -- The user being vouched for (e.g., a founder soliciting an investor's
  -- vouch).
  user_id uuid not null references public.users(id) on delete cascade,

  -- Identity of the referee. Stored at request time; updated only by
  -- the referee on confirm.
  referee_email text not null check (length(referee_email) between 5 and 254),
  referee_name text not null check (length(referee_name) between 2 and 120),
  relationship text not null check (length(relationship) between 2 and 120),

  status public.reference_status not null default 'sent',

  -- Magic-link token, sha256-hashed at rest. Constant-time compared in
  -- /api/references/confirm route handler when it lands.
  token_hash text not null check (length(token_hash) = 64),

  -- 14-day default TTL. Past expires_at, the worker flips status to
  -- 'expired' so the founder can re-send.
  expires_at timestamptz not null default (now() + interval '14 days'),
  confirmed_at timestamptz,
  declined_at timestamptz,

  -- Optional one-liner endorsement the referee writes on confirm.
  endorsement text check (endorsement is null or length(endorsement) <= 500),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists references_received_set_updated_at on public.references_received;
create trigger references_received_set_updated_at
  before update on public.references_received
  for each row execute function public.set_updated_at();

create index if not exists references_received_user_idx
  on public.references_received (user_id, status, created_at desc);

-- Lookup by token (the route handler queries by token_hash). Index on
-- a hash column gives O(log n) lookup.
create index if not exists references_received_token_idx
  on public.references_received (token_hash);

-- One active request per (user_id, lower(referee_email)). Founders can
-- re-request after a typo or expiry by waiting for the prior row to
-- transition out of 'sent' (or by deleting it).
create unique index if not exists references_received_one_active
  on public.references_received (user_id, lower(referee_email))
  where status = 'sent';

alter table public.references_received enable row level security;

-- Strict: only the user being vouched for can read their own rows.
-- Server-role bypasses RLS for the magic-link confirm route, which
-- reads by token_hash without a session.
drop policy if exists "references_received select own" on public.references_received;
create policy "references_received select own"
  on public.references_received for select
  using (user_id = public.app_user_id());

drop policy if exists "references_received insert as owner" on public.references_received;
create policy "references_received insert as owner"
  on public.references_received for insert
  with check (user_id = public.app_user_id());

-- The user can delete or update their own (e.g., resend trigger sets
-- status='expired' on the old row and inserts a new 'sent' row). The
-- referee's confirm/decline writes happen via the route handler running
-- with service role — no app-session policy needed for that path.
drop policy if exists "references_received update own" on public.references_received;
create policy "references_received update own"
  on public.references_received for update
  using (user_id = public.app_user_id())
  with check (user_id = public.app_user_id());

drop policy if exists "references_received delete own" on public.references_received;
create policy "references_received delete own"
  on public.references_received for delete
  using (user_id = public.app_user_id());
