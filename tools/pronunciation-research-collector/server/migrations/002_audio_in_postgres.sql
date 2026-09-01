-- Render Free has no persistent disk. For the thesis pilot, keep compressed
-- recordings in Neon/PostgreSQL so a Render restart cannot lose them.
create table if not exists research_collector_audio (
  attempt_id uuid primary key references research_collector_attempts(id) on delete cascade,
  mime_type varchar(100) not null,
  byte_size integer not null check (byte_size > 0 and byte_size <= 20971520),
  content bytea not null,
  created_at timestamptz not null default now()
);
