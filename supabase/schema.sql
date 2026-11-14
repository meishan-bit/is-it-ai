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
