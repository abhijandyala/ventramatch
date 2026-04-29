-- New onboarding fields: company/firm name, investor type, bio, goals
-- These replace the previous matching-preferences approach with a simpler
-- 3-step onboarding (role → profile → goals).

alter table public.users
  add column if not exists company_name text,
  add column if not exists investor_type text check (investor_type in ('firm', 'angel')),
  add column if not exists bio text,
  add column if not exists goals text;
