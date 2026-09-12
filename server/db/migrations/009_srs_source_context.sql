-- Migration 009: SRS Source Context for Curriculum & Idempotent Multi-Context Cards

alter table srs_cards
  add column if not exists course_code text not null default '',
  add column if not exists unit_id text not null default '',
  add column if not exists term_id text not null default '',
  add column if not exists source_record_id text not null default '',
  add column if not exists source_context text not null default '';

alter table srs_cards
  drop constraint if exists srs_cards_user_type_term_key;

alter table srs_cards
  drop constraint if exists srs_cards_user_type_term_context_key;

alter table srs_cards
  add constraint srs_cards_user_type_term_context_key
  unique (user_id, type, term, source_context);

create index if not exists srs_cards_user_source_context_idx
  on srs_cards(user_id, source_context);

create index if not exists srs_cards_user_course_unit_idx
  on srs_cards(user_id, course_code, unit_id);
