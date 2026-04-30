-- Sprint 10.E — Legal version tracking.
--
-- When the ToS or Privacy Policy is updated, existing users must re-accept
-- before continuing. These columns track which version each user agreed to.
-- A new version constant in the app triggers a modal on next page load.

alter table public.users
  add column if not exists tos_version_accepted text not null default '0.1',
  add column if not exists privacy_version_accepted text not null default '0.1';
