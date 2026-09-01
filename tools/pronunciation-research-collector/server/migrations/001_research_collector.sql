create table if not exists research_collector_attempts (
  id uuid primary key,
  participant_code varchar(60) not null,
  collection_mode varchar(16) not null check (collection_mode in ('scripted', 'free')),
  scenario_key varchar(80),
  text_ja text not null,
  target_phone varchar(32),
  target_error varchar(48),
  instructed_variant varchar(24) check (instructed_variant in ('standard', 'intentional_error', 'natural')),
  consented_at timestamptz not null,
  audio_storage_key varchar(500),
  audio_mime_type varchar(100),
  audio_byte_size bigint check (audio_byte_size is null or audio_byte_size > 0),
  duration_ms integer check (duration_ms is null or duration_ms > 0),
  status varchar(24) not null default 'draft' check (status in ('draft', 'submitted', 'reviewed', 'unscorable')),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists research_collector_labels (
  id uuid primary key,
  attempt_id uuid not null references research_collector_attempts(id) on delete cascade,
  rater_code varchar(60) not null,
  unit_type varchar(16) not null check (unit_type in ('sentence', 'mora', 'phoneme')),
  unit_reference varchar(80),
  label varchar(24) not null check (label in ('correct', 'near_correct', 'incorrect', 'unscorable')),
  error_type varchar(24) check (error_type in ('substitution', 'deletion', 'insertion', 'too_short', 'too_long', 'unclear', 'other')),
  confidence smallint not null check (confidence between 1 and 5),
  notes varchar(1000),
  created_at timestamptz not null default now()
);

create index if not exists research_collector_attempts_review_idx on research_collector_attempts(status, submitted_at asc) where status = 'submitted';
create index if not exists research_collector_attempts_speaker_idx on research_collector_attempts(participant_code, created_at);
