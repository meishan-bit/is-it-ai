-- Is It AI? database. Run once in Supabase: SQL Editor > New query > paste > Run.
-- No names, emails or phone numbers are stored. anon_id is a random id, or a session code such as T1.

create table if not exists participants (
  anon_id      text primary key,
  created_at   timestamptz not null default now(),
  age_band     text check (age_band in ('60-69','70-79','80+','prefer-not-to-say')),
  device_type  text check (device_type in ('phone','tablet','desktop')),
  is_test_code boolean not null default false
);

create table if not exists attempts (
  attempt_id      uuid primary key,
  created_at      timestamptz not null default now(),
  anon_id         text not null references participants(anon_id),
  mode            text not null check (mode in ('practice','pre','post')),
  form            text check (form in ('A','B')),
  started_at      timestamptz not null,
  completed_at    timestamptz,
  app_version     text not null,   -- version management: which build produced these answers
  content_version text not null    -- and which content set (scenarios) was shown
);

create table if not exists responses (
  id              bigserial primary key,
  attempt_id      uuid not null references attempts(attempt_id) on delete cascade,
  scenario_id     text not null,
  verdict_choice  text not null check (verdict_choice in ('scam','real')),
  verdict_correct boolean not null,
  sign_choice     text not null,
  sign_correct    boolean not null,
  step_choice     text not null,
  step_correct    boolean not null,
  time_ms         integer not null check (time_ms >= 0),
  answered_at     timestamptz not null,
  unique (attempt_id, scenario_id)
);

create index if not exists attempts_anon_idx on attempts (anon_id);
create index if not exists attempts_mode_idx on attempts (mode);
create index if not exists responses_attempt_idx on responses (attempt_id);
create index if not exists responses_scenario_idx on responses (scenario_id);

-- Row Level Security ON with NO policies: the public (anon) key can read and write nothing.
-- Only the server, using the service-role key, touches these tables. Keep that key secret.
alter table participants enable row level security;
alter table attempts     enable row level security;
alter table responses    enable row level security;

-- Access for the server (fix #11). Supabase projects created after May 30, 2026 (and all projects from Oct 30, 2026)
-- no longer give the Data API access to new tables automatically. Without these lines every save fails.
-- service_role only: it is the key the server uses. anon and authenticated get nothing.
grant select, insert, update on participants, attempts, responses to service_role;
grant usage, select on sequence responses_id_seq to service_role;
revoke all on participants, attempts, responses from anon, authenticated;

-- Check It (v2.0): one row for every check. Counts and outcomes only, never the message, picture or answers.
-- Run in the Supabase SQL editor before deploying v2.0. Safe to run more than once.
create table if not exists check_events (
  id               bigserial primary key,
  created_at       timestamptz not null default now(),
  anon_id          text not null references participants(anon_id),
  input_type       text not null check (input_type in ('photo','paste','call')),
  tactic_id        text check (tactic_id in ('T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','real','unknown')),
  signal_level     text check (signal_level in ('strong','some','none_found')),
  outcome          text not null check (outcome in ('ok','timeout','rate_limited','model_error','invalid_output')),
  redaction_counts jsonb not null default '{}'::jsonb,  -- e.g. {"card number":1,"name":2}: counts only
  user_unhid_count integer not null default 0 check (user_unhid_count >= 0),
  user_added_count integer not null default 0 check (user_added_count >= 0),
  still_personal   boolean,
  model            text not null,
  latency_ms       integer check (latency_ms >= 0),
  content_version  text not null
);
create index if not exists check_events_anon_day_idx on check_events (anon_id, created_at);
alter table check_events enable row level security;
grant select, insert on check_events to service_role;
grant usage, select on sequence check_events_id_seq to service_role;
revoke all on check_events from anon, authenticated;
