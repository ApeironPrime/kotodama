-- 010_anime_tables.sql
-- Anime Learning Schema Migration: Series, Seasons, Episodes, Media Sources,
-- Subtitle Tracks/Cues/Tokens, Playlists, Watch Progress, and Import Runs.

-- 1. Anime Import Runs (Auditing and Provenance)
CREATE TABLE IF NOT EXISTS anime_import_runs (
  run_id TEXT PRIMARY KEY,
  source_manifest_hash TEXT NOT NULL,
  dataset_hash TEXT NOT NULL,
  importer_version TEXT NOT NULL,
  total_series INTEGER NOT NULL,
  total_seasons INTEGER NOT NULL,
  total_episodes INTEGER NOT NULL,
  total_media_sources INTEGER NOT NULL,
  total_subtitle_tracks INTEGER NOT NULL,
  total_cues INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  total_playlists INTEGER NOT NULL,
  total_playlist_videos INTEGER NOT NULL,
  media_sources_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  dictionary_reference JSONB NOT NULL DEFAULT '{}'::jsonb,
  warning_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'rolled_back')),
  reject_list JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Anime Series Catalog
CREATE TABLE IF NOT EXISTS anime_series (
  series_id TEXT PRIMARY KEY,
  series_slug TEXT NOT NULL UNIQUE,
  master_slug TEXT,
  title_vi TEXT NOT NULL,
  title_ja TEXT,
  description TEXT NOT NULL DEFAULT '',
  poster_url TEXT,
  category TEXT,
  jlpt_level TEXT CHECK (jlpt_level IS NULL OR jlpt_level IN ('N5', 'N4', 'N3', 'N2', 'N1')),
  channel TEXT,
  video_source TEXT,
  total_episodes INTEGER NOT NULL DEFAULT 0,
  rights_status TEXT NOT NULL DEFAULT 'unknown' CHECK (rights_status IN ('unknown', 'restricted', 'approved')),
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_curated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS anime_series_jlpt_category_idx ON anime_series(jlpt_level, category);
CREATE INDEX IF NOT EXISTS anime_series_slug_idx ON anime_series(series_slug);

-- 3. Anime Seasons
CREATE TABLE IF NOT EXISTS anime_seasons (
  season_id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL REFERENCES anime_series(series_id) ON DELETE CASCADE,
  series_slug TEXT NOT NULL,
  season_slug TEXT NOT NULL,
  season_ordinal INTEGER NOT NULL,
  season_label TEXT,
  title_vi TEXT NOT NULL,
  total_episodes INTEGER NOT NULL DEFAULT 0,
  is_curated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(series_id, season_slug)
);

CREATE INDEX IF NOT EXISTS anime_seasons_series_ordinal_idx ON anime_seasons(series_id, season_ordinal);

-- 4. Anime Episodes
CREATE TABLE IF NOT EXISTS anime_episodes (
  episode_id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL REFERENCES anime_series(series_id) ON DELETE CASCADE,
  season_id TEXT NOT NULL REFERENCES anime_seasons(season_id) ON DELETE CASCADE,
  series_slug TEXT NOT NULL,
  season_slug TEXT NOT NULL,
  episode_number INTEGER NOT NULL,
  title TEXT,
  has_subtitles BOOLEAN NOT NULL DEFAULT false,
  is_curated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(series_slug, season_slug, episode_number)
);

CREATE INDEX IF NOT EXISTS anime_episodes_series_ep_idx ON anime_episodes(series_id, episode_number);
CREATE INDEX IF NOT EXISTS anime_episodes_season_ep_idx ON anime_episodes(season_id, episode_number);

-- 5. Anime Media Sources (1:1 with Episode, enforces stream_url IS NULL)
CREATE TABLE IF NOT EXISTS anime_media_sources (
  source_id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL UNIQUE REFERENCES anime_episodes(episode_id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('youtube', 'authorized_local', 'external_page', 'unavailable')),
  media_id TEXT,
  stream_url TEXT CHECK (stream_url IS NULL),
  page_url TEXT,
  playback_allowed BOOLEAN NOT NULL DEFAULT false,
  rights_status TEXT NOT NULL DEFAULT 'unknown' CHECK (rights_status IN ('unknown', 'restricted', 'approved')),
  is_curated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (NOT playback_allowed OR source_type IN ('youtube', 'authorized_local')),
  CHECK (rights_status != 'approved' OR source_type = 'authorized_local')
);

CREATE INDEX IF NOT EXISTS anime_media_sources_ep_type_idx ON anime_media_sources(episode_id, source_type);

-- 6. Anime Subtitle Tracks (1:1 with Episode)
CREATE TABLE IF NOT EXISTS anime_subtitle_tracks (
  track_id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL UNIQUE REFERENCES anime_episodes(episode_id) ON DELETE CASCADE,
  series_slug TEXT NOT NULL,
  episode_number INTEGER NOT NULL,
  languages JSONB NOT NULL DEFAULT '["ja","vi"]'::jsonb,
  cue_count INTEGER NOT NULL DEFAULT 0,
  token_count INTEGER NOT NULL DEFAULT 0,
  word_linked_token_count INTEGER NOT NULL DEFAULT 0,
  source_files JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_sha256 JSONB NOT NULL DEFAULT '{}'::jsonb,
  rights_status JSONB NOT NULL DEFAULT '{"ja":"restricted","vi":"unknown"}'::jsonb,
  is_curated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS anime_subtitle_tracks_series_ep_idx ON anime_subtitle_tracks(series_slug, episode_number);

-- 7. Anime Subtitle Cues (Separated per cue with time intervals)
CREATE TABLE IF NOT EXISTS anime_subtitle_cues (
  id BIGSERIAL PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES anime_subtitle_tracks(track_id) ON DELETE CASCADE,
  episode_id TEXT NOT NULL REFERENCES anime_episodes(episode_id) ON DELETE CASCADE,
  cue_id INTEGER NOT NULL,
  start_time DOUBLE PRECISION NOT NULL,
  end_time DOUBLE PRECISION NOT NULL,
  ja_text TEXT NOT NULL,
  vi_text TEXT NOT NULL,
  compounds JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_curated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(track_id, cue_id)
);

CREATE INDEX IF NOT EXISTS anime_subtitle_cues_ep_time_idx ON anime_subtitle_cues(episode_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS anime_subtitle_cues_track_cue_idx ON anime_subtitle_cues(track_id, cue_id);

-- 8. Anime Subtitle Tokens (Granular token query, references dictionary word_id)
CREATE TABLE IF NOT EXISTS anime_subtitle_tokens (
  id BIGSERIAL PRIMARY KEY,
  cue_row_id BIGINT NOT NULL REFERENCES anime_subtitle_cues(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES anime_subtitle_tracks(track_id) ON DELETE CASCADE,
  episode_id TEXT NOT NULL REFERENCES anime_episodes(episode_id) ON DELETE CASCADE,
  token_ordinal INTEGER NOT NULL,
  surface TEXT NOT NULL,
  char_start INTEGER NOT NULL,
  char_end INTEGER NOT NULL,
  word_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cue_row_id, token_ordinal)
);

CREATE INDEX IF NOT EXISTS anime_subtitle_tokens_cue_ord_idx ON anime_subtitle_tokens(cue_row_id, token_ordinal);
CREATE INDEX IF NOT EXISTS anime_subtitle_tokens_word_id_idx ON anime_subtitle_tokens(word_id);
CREATE INDEX IF NOT EXISTS anime_subtitle_tokens_ep_word_idx ON anime_subtitle_tokens(episode_id, word_id);

-- 9. Anime Playlists
CREATE TABLE IF NOT EXISTS anime_playlists (
  playlist_id TEXT PRIMARY KEY,
  playlist_slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  channel TEXT,
  jlpt_level TEXT CHECK (jlpt_level IS NULL OR jlpt_level IN ('N5', 'N4', 'N3', 'N2', 'N1')),
  category TEXT,
  video_count INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'plus', 'pro', 'premium')),
  dict_series_slug TEXT,
  rights_status TEXT NOT NULL DEFAULT 'unknown' CHECK (rights_status IN ('unknown', 'restricted', 'approved')),
  is_curated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS anime_playlists_jlpt_tier_idx ON anime_playlists(jlpt_level, tier);
CREATE INDEX IF NOT EXISTS anime_playlists_slug_idx ON anime_playlists(playlist_slug);

-- 10. Anime Playlist Videos
CREATE TABLE IF NOT EXISTS anime_playlist_videos (
  playlist_video_id TEXT PRIMARY KEY,
  playlist_id TEXT NOT NULL REFERENCES anime_playlists(playlist_id) ON DELETE CASCADE,
  playlist_slug TEXT NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  watch_url TEXT,
  youtube_url TEXT,
  ordinal INTEGER NOT NULL,
  playback_allowed BOOLEAN NOT NULL DEFAULT true,
  rights_status TEXT NOT NULL DEFAULT 'unknown' CHECK (rights_status IN ('unknown', 'restricted', 'approved')),
  is_curated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(playlist_id, ordinal)
);

CREATE INDEX IF NOT EXISTS anime_playlist_videos_pl_ord_idx ON anime_playlist_videos(playlist_id, ordinal);
CREATE INDEX IF NOT EXISTS anime_playlist_videos_vid_idx ON anime_playlist_videos(video_id);

-- 11. Anime Watch Progress (Resume playback & user history)
CREATE TABLE IF NOT EXISTS anime_watch_progress (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  episode_id TEXT NOT NULL REFERENCES anime_episodes(episode_id) ON DELETE CASCADE,
  last_playback_position DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  max_playback_position DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  duration DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  playback_count INTEGER NOT NULL DEFAULT 1,
  last_watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, episode_id)
);

CREATE INDEX IF NOT EXISTS anime_watch_progress_user_last_idx ON anime_watch_progress(user_id, last_watched_at DESC);
CREATE INDEX IF NOT EXISTS anime_watch_progress_user_ep_idx ON anime_watch_progress(user_id, episode_id);
