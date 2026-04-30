-- Sprint 13.B — Link intro requests to Google Calendar events.
alter table public.intro_requests
  add column if not exists calendar_event_id_sender text,
  add column if not exists calendar_event_id_recipient text;
