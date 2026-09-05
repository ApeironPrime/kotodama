-- Migration 007: Persistent SRS Flashcard Deck and Review History
create table if not exists srs_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null check (type in ('vocab', 'kanji', 'grammar')),
  term text not null,
  reading text not null default '',
  han_viet text not null default '',
  meaning text not null default '',
  jlpt_level text not null default 'N5',
  part_of_speech text not null default '',
  structure text not null default '',
  explanation text not null default '',
  radical text not null default '',
  stroke_count integer not null default 0,
  story text not null default '',
  mastery_percentage integer not null default 20,
  stage text not null default 'learning' check (stage in ('new', 'learning', 'due', 'mastered')),
  repetition integer not null default 0,
  interval_days double precision not null default 1.0,
  ease_factor double precision not null default 2.5,
  next_review_at timestamptz not null default now(),
  groups jsonb not null default '[]'::jsonb,
  examples jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint srs_cards_user_type_term_key unique (user_id, type, term)
);

create index if not exists srs_cards_user_type_review_idx
  on srs_cards(user_id, type, next_review_at);

create index if not exists srs_cards_user_stage_review_idx
  on srs_cards(user_id, stage, next_review_at);

create index if not exists srs_cards_user_updated_idx
  on srs_cards(user_id, updated_at desc);

create table if not exists srs_review_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  card_id uuid references srs_cards(id) on delete set null,
  rating text not null check (rating in ('again', 'hard', 'good', 'easy')),
  reviewed_at timestamptz not null default now(),
  review_date date not null default (now() at time zone 'UTC')::date
);

create index if not exists srs_review_events_user_date_idx
  on srs_review_events(user_id, review_date desc);

create index if not exists srs_review_events_user_card_idx
  on srs_review_events(user_id, card_id);
