-- Migration 008: Canonical Vocabulary Curriculum Persistence
-- Tables: curriculum_courses, curriculum_units, curriculum_terms, curriculum_import_runs, curriculum_course_terms
-- Indexes for level, course_code, unit, and normalized word lookups

create table if not exists curriculum_courses (
  course_code text primary key,
  title text not null,
  level text not null check (level in ('A1', 'A2', 'N5', 'N4', 'N3', 'N2', 'N1', 'SE')),
  provider_source text not null,
  visibility text not null default 'internal' check (visibility in ('public', 'unlisted', 'private', 'internal')),
  rights_status text not null default 'unknown' check (rights_status in ('unknown', 'verified', 'public_domain', 'licensed')),
  description text not null default '',
  is_curated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists curriculum_courses_level_idx
  on curriculum_courses(level, visibility);

create table if not exists curriculum_units (
  unit_id text primary key,
  course_code text not null references curriculum_courses(course_code) on delete cascade,
  unit_key text not null,
  ordinal integer not null,
  title text not null,
  topic text not null default '',
  is_curated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_units_course_key_unique unique (course_code, unit_key)
);

create index if not exists curriculum_units_course_idx
  on curriculum_units(course_code, ordinal);

create table if not exists curriculum_terms (
  term_id text primary key,
  normalized_key text not null,
  display_word text not null,
  display_reading text not null default '',
  meanings jsonb not null default '[]'::jsonb,
  han_viet text,
  examples jsonb not null default '[]'::jsonb,
  raw_source_references jsonb not null default '[]'::jsonb,
  is_curated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists curriculum_terms_normalized_key_idx
  on curriculum_terms(normalized_key);

create index if not exists curriculum_terms_display_reading_idx
  on curriculum_terms(display_reading);

create table if not exists curriculum_import_runs (
  run_id text primary key,
  source_manifest_hash text not null,
  dataset_hash text not null,
  importer_version text not null,
  total_input_records integer not null,
  total_canonical_terms integer not null,
  total_course_terms integer not null,
  total_courses integer not null,
  total_units integer not null,
  warning_count integer not null,
  error_count integer not null,
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed', 'rolled_back')),
  reject_list jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  imported_at timestamptz not null default now()
);

create table if not exists curriculum_course_terms (
  id bigserial primary key,
  course_code text not null references curriculum_courses(course_code) on delete cascade,
  unit_id text not null references curriculum_units(unit_id) on delete cascade,
  term_id text not null references curriculum_terms(term_id) on delete cascade,
  ordinal integer not null,
  source_record_id text not null,
  provenance jsonb not null default '{}'::jsonb,
  import_run_id text references curriculum_import_runs(run_id) on delete set null,
  is_curated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_course_terms_position_unique unique (course_code, unit_id, ordinal)
);

create index if not exists curriculum_course_terms_unit_ordinal_idx
  on curriculum_course_terms(unit_id, ordinal);

create index if not exists curriculum_course_terms_course_term_idx
  on curriculum_course_terms(course_code, term_id);

create index if not exists curriculum_course_terms_term_id_idx
  on curriculum_course_terms(term_id);
