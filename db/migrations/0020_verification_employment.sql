-- Sprint 9.5.E — Email-token employment verification.
--
-- Adds columns to public.verifications to support a real verifier:
--   • employer_domain: the domain we sent the magic link to (stripe.com)
--   • token_hash: sha256 of the magic link token
--   • expires_at: 24h TTL
--   • confirmed_via_email: the address the user clicked from
--
-- Partial unique so a user can't spam pending claims for the same employer.

alter table public.verifications
  add column if not exists employer_domain text,
  add column if not exists token_hash text,
  add column if not exists expires_at timestamptz,
  add column if not exists confirmed_via_email text;

create unique index if not exists verifications_one_pending_per_employer
  on public.verifications (user_id, employer_domain)
  where status = 'pending';

create index if not exists verifications_token_hash_idx
  on public.verifications (token_hash)
  where token_hash is not null;
