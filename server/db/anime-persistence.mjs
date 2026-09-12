import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { validateCanonicalDataset } from '../../scripts/anime/canonical-schema.mjs'

export const SQLITE_ANIME_DDL = `
PRAGMA foreign_keys = ON;

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
  media_sources_summary TEXT NOT NULL DEFAULT '{}',
  dictionary_reference TEXT NOT NULL DEFAULT '{}',
  warning_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'rolled_back')),
  reject_list TEXT NOT NULL DEFAULT '[]',
  warnings TEXT NOT NULL DEFAULT '[]',
  imported_at TEXT NOT NULL
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
  provenance TEXT NOT NULL DEFAULT '{}',
  is_curated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
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
  is_curated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
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
  has_subtitles INTEGER NOT NULL DEFAULT 0,
  is_curated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
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
  playback_allowed INTEGER NOT NULL DEFAULT 0 CHECK (playback_allowed IN (0, 1)),
  rights_status TEXT NOT NULL DEFAULT 'unknown' CHECK (rights_status IN ('unknown', 'restricted', 'approved')),
  is_curated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
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
  languages TEXT NOT NULL DEFAULT '["ja","vi"]',
  cue_count INTEGER NOT NULL DEFAULT 0,
  token_count INTEGER NOT NULL DEFAULT 0,
  word_linked_token_count INTEGER NOT NULL DEFAULT 0,
  source_files TEXT NOT NULL DEFAULT '{}',
  content_sha256 TEXT NOT NULL DEFAULT '{}',
  rights_status TEXT NOT NULL DEFAULT '{"ja":"restricted","vi":"unknown"}',
  is_curated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS anime_subtitle_tracks_series_ep_idx ON anime_subtitle_tracks(series_slug, episode_number);

-- 7. Anime Subtitle Cues (Separated per cue with time intervals)
CREATE TABLE IF NOT EXISTS anime_subtitle_cues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id TEXT NOT NULL REFERENCES anime_subtitle_tracks(track_id) ON DELETE CASCADE,
  episode_id TEXT NOT NULL REFERENCES anime_episodes(episode_id) ON DELETE CASCADE,
  cue_id INTEGER NOT NULL,
  start_time REAL NOT NULL,
  end_time REAL NOT NULL,
  ja_text TEXT NOT NULL,
  vi_text TEXT NOT NULL,
  compounds TEXT NOT NULL DEFAULT '[]',
  is_curated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(track_id, cue_id)
);

CREATE INDEX IF NOT EXISTS anime_subtitle_cues_ep_time_idx ON anime_subtitle_cues(episode_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS anime_subtitle_cues_track_cue_idx ON anime_subtitle_cues(track_id, cue_id);

-- 8. Anime Subtitle Tokens (Granular token query, references dictionary word_id)
CREATE TABLE IF NOT EXISTS anime_subtitle_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cue_row_id INTEGER NOT NULL REFERENCES anime_subtitle_cues(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES anime_subtitle_tracks(track_id) ON DELETE CASCADE,
  episode_id TEXT NOT NULL REFERENCES anime_episodes(episode_id) ON DELETE CASCADE,
  token_ordinal INTEGER NOT NULL,
  surface TEXT NOT NULL,
  char_start INTEGER NOT NULL,
  char_end INTEGER NOT NULL,
  word_id INTEGER,
  created_at TEXT NOT NULL,
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
  is_curated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
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
  playback_allowed INTEGER NOT NULL DEFAULT 1,
  rights_status TEXT NOT NULL DEFAULT 'unknown' CHECK (rights_status IN ('unknown', 'restricted', 'approved')),
  is_curated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(playlist_id, ordinal)
);

CREATE INDEX IF NOT EXISTS anime_playlist_videos_pl_ord_idx ON anime_playlist_videos(playlist_id, ordinal);
CREATE INDEX IF NOT EXISTS anime_playlist_videos_vid_idx ON anime_playlist_videos(video_id);

-- 11. Anime Watch Progress (Resume playback & user history)
CREATE TABLE IF NOT EXISTS anime_watch_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  episode_id TEXT NOT NULL REFERENCES anime_episodes(episode_id) ON DELETE CASCADE,
  last_playback_position REAL NOT NULL DEFAULT 0.0,
  max_playback_position REAL NOT NULL DEFAULT 0.0,
  duration REAL NOT NULL DEFAULT 0.0,
  is_completed INTEGER NOT NULL DEFAULT 0,
  playback_count INTEGER NOT NULL DEFAULT 1,
  last_watched_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, episode_id)
);

CREATE INDEX IF NOT EXISTS anime_watch_progress_user_last_idx ON anime_watch_progress(user_id, last_watched_at DESC);
CREATE INDEX IF NOT EXISTS anime_watch_progress_user_ep_idx ON anime_watch_progress(user_id, episode_id);
`

/**
 * Initializes anime schema on SQLite database
 * @param {any} db SQLite DatabaseSync instance
 */
export function applyAnimeSchemaSQLite(db) {
  db.exec(SQLITE_ANIME_DDL)
}

/**
 * Initializes anime schema on PostgreSQL database
 * @param {any} clientOrPool pg.Pool or pg.Client instance
 */
export async function applyAnimeSchemaPostgres(clientOrPool) {
  const sqlPath = path.resolve('server/db/migrations/010_anime_tables.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  await clientOrPool.query(sql)
}

/**
 * Transactional ingest of Canonical Anime Dataset into SQLite
 * @param {any} db SQLite DatabaseSync instance
 * @param {any} dataset CanonicalDataset
 * @param {{ runId?: string, skipValidation?: boolean, datasetHash?: string }} [options]
 * @returns {{ runId: string, seriesCount: number, episodesCount: number, tracksCount: number, cuesCount: number, playlistsCount: number, status: string }}
 */
export function ingestAnimeDatasetSQLite(db, dataset, options = {}) {
  // 1. Validation check
  if (!options.skipValidation) {
    const validation = validateCanonicalDataset(dataset)
    if (!validation.valid) {
      throw new Error(`Dataset validation failed: ${validation.errors.join('; ')}`)
    }
  }

  const runId = options.runId || `run_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  const now = new Date().toISOString()
  const datasetHash = options.datasetHash || crypto.createHash('sha256').update(JSON.stringify(dataset)).digest('hex')

  const { import_run, series, playlists, subtitle_tracks, dictionary_reference } = dataset

  // 2. Open immediate transaction with optimized performance pragmas
  db.exec('PRAGMA synchronous = NORMAL;')
  db.exec('PRAGMA cache_size = -64000;')
  db.exec('PRAGMA temp_store = MEMORY;')
  db.exec('BEGIN IMMEDIATE TRANSACTION;')
  try {
    // 3. Create Import Run with status = 'pending'
    const insertRunStmt = db.prepare(`
      INSERT INTO anime_import_runs (
        run_id, source_manifest_hash, dataset_hash, importer_version,
        total_series, total_seasons, total_episodes, total_media_sources,
        total_subtitle_tracks, total_cues, total_tokens, total_playlists, total_playlist_videos,
        media_sources_summary, dictionary_reference, warning_count, error_count,
        status, reject_list, warnings, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `)
    insertRunStmt.run(
      runId,
      import_run.source_manifest_hash,
      datasetHash,
      import_run.importer_version,
      import_run.total_series,
      import_run.total_seasons,
      import_run.total_episodes,
      import_run.total_media_sources,
      import_run.total_subtitle_tracks,
      import_run.total_cues,
      import_run.total_tokens,
      import_run.total_playlists,
      import_run.total_playlist_videos,
      JSON.stringify(import_run.media_sources_by_type || {}),
      JSON.stringify(dictionary_reference || {}),
      import_run.warning_count || 0,
      import_run.error_count || 0,
      JSON.stringify(import_run.reject_list || []),
      JSON.stringify(import_run.warnings || []),
      now
    )

    // 4. Upsert Series (respects is_curated flag)
    const upsertSeriesStmt = db.prepare(`
      INSERT INTO anime_series (
        series_id, series_slug, master_slug, title_vi, title_ja, description,
        poster_url, category, jlpt_level, channel, video_source, total_episodes,
        rights_status, provenance, is_curated, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(series_slug) DO UPDATE SET
        master_slug = CASE WHEN anime_series.is_curated != 0 THEN anime_series.master_slug ELSE excluded.master_slug END,
        title_vi = CASE WHEN anime_series.is_curated != 0 THEN anime_series.title_vi ELSE excluded.title_vi END,
        title_ja = CASE WHEN anime_series.is_curated != 0 THEN anime_series.title_ja ELSE excluded.title_ja END,
        description = CASE WHEN anime_series.is_curated != 0 THEN anime_series.description ELSE excluded.description END,
        poster_url = CASE WHEN anime_series.is_curated != 0 THEN anime_series.poster_url ELSE excluded.poster_url END,
        category = CASE WHEN anime_series.is_curated != 0 THEN anime_series.category ELSE excluded.category END,
        jlpt_level = CASE WHEN anime_series.is_curated != 0 THEN anime_series.jlpt_level ELSE excluded.jlpt_level END,
        channel = CASE WHEN anime_series.is_curated != 0 THEN anime_series.channel ELSE excluded.channel END,
        video_source = CASE WHEN anime_series.is_curated != 0 THEN anime_series.video_source ELSE excluded.video_source END,
        total_episodes = CASE WHEN anime_series.is_curated != 0 THEN anime_series.total_episodes ELSE excluded.total_episodes END,
        rights_status = CASE WHEN anime_series.is_curated != 0 THEN anime_series.rights_status ELSE excluded.rights_status END,
        provenance = CASE WHEN anime_series.is_curated != 0 THEN anime_series.provenance ELSE excluded.provenance END,
        updated_at = excluded.updated_at
    `)

    // 5. Upsert Seasons (respects is_curated flag)
    const upsertSeasonStmt = db.prepare(`
      INSERT INTO anime_seasons (
        season_id, series_id, series_slug, season_slug, season_ordinal, season_label,
        title_vi, total_episodes, is_curated, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(series_id, season_slug) DO UPDATE SET
        season_ordinal = CASE WHEN anime_seasons.is_curated != 0 THEN anime_seasons.season_ordinal ELSE excluded.season_ordinal END,
        season_label = CASE WHEN anime_seasons.is_curated != 0 THEN anime_seasons.season_label ELSE excluded.season_label END,
        title_vi = CASE WHEN anime_seasons.is_curated != 0 THEN anime_seasons.title_vi ELSE excluded.title_vi END,
        total_episodes = CASE WHEN anime_seasons.is_curated != 0 THEN anime_seasons.total_episodes ELSE excluded.total_episodes END,
        updated_at = excluded.updated_at
    `)

    // 6. Upsert Episodes (respects is_curated flag)
    const upsertEpisodeStmt = db.prepare(`
      INSERT INTO anime_episodes (
        episode_id, series_id, season_id, series_slug, season_slug, episode_number,
        title, has_subtitles, is_curated, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(series_slug, season_slug, episode_number) DO UPDATE SET
        title = CASE WHEN anime_episodes.is_curated != 0 THEN anime_episodes.title ELSE excluded.title END,
        has_subtitles = CASE WHEN anime_episodes.is_curated != 0 THEN anime_episodes.has_subtitles ELSE excluded.has_subtitles END,
        updated_at = excluded.updated_at
    `)

    // 7. Upsert Media Sources (respects is_curated flag)
    const upsertMediaSourceStmt = db.prepare(`
      INSERT INTO anime_media_sources (
        source_id, episode_id, source_type, media_id, stream_url, page_url,
        playback_allowed, rights_status, is_curated, created_at, updated_at
      ) VALUES (?, ?, ?, ?, null, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(episode_id) DO UPDATE SET
        source_type = CASE WHEN anime_media_sources.is_curated != 0 THEN anime_media_sources.source_type ELSE excluded.source_type END,
        media_id = CASE WHEN anime_media_sources.is_curated != 0 THEN anime_media_sources.media_id ELSE excluded.media_id END,
        page_url = CASE WHEN anime_media_sources.is_curated != 0 THEN anime_media_sources.page_url ELSE excluded.page_url END,
        playback_allowed = CASE WHEN anime_media_sources.is_curated != 0 THEN anime_media_sources.playback_allowed ELSE excluded.playback_allowed END,
        rights_status = CASE WHEN anime_media_sources.is_curated != 0 THEN anime_media_sources.rights_status ELSE excluded.rights_status END,
        updated_at = excluded.updated_at
    `)

    for (const s of series) {
      upsertSeriesStmt.run(
        s.series_id,
        s.series_slug,
        s.master_slug || null,
        s.title_vi,
        s.title_ja || null,
        s.description || '',
        s.poster_url || null,
        s.category || null,
        s.jlpt_level || null,
        s.channel || null,
        s.video_source || null,
        s.total_episodes || 0,
        s.rights_status || 'unknown',
        JSON.stringify(s.provenance || {}),
        now,
        now
      )

      for (const sn of s.seasons || []) {
        upsertSeasonStmt.run(
          sn.season_id,
          s.series_id,
          sn.series_slug,
          sn.season_slug,
          sn.season_ordinal,
          sn.season_label || null,
          sn.title_vi,
          sn.total_episodes || 0,
          now,
          now
        )

        for (const ep of sn.episodes || []) {
          upsertEpisodeStmt.run(
            ep.episode_id,
            s.series_id,
            sn.season_id,
            ep.series_slug,
            ep.season_slug,
            ep.episode_number,
            ep.title || null,
            ep.has_subtitles ? 1 : 0,
            now,
            now
          )

          if (ep.media_source) {
            const ms = ep.media_source
            upsertMediaSourceStmt.run(
              ms.source_id,
              ep.episode_id,
              ms.source_type,
              ms.media_id || null,
              ms.page_url || null,
              ms.playback_allowed ? 1 : 0,
              ms.rights_status || 'unknown',
              now,
              now
            )
          }
        }
      }
    }

    // 8. Upsert Subtitle Tracks
    const upsertTrackStmt = db.prepare(`
      INSERT INTO anime_subtitle_tracks (
        track_id, episode_id, series_slug, episode_number, languages, cue_count,
        token_count, word_linked_token_count, source_files, content_sha256,
        rights_status, is_curated, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(episode_id) DO UPDATE SET
        languages = CASE WHEN anime_subtitle_tracks.is_curated != 0 THEN anime_subtitle_tracks.languages ELSE excluded.languages END,
        cue_count = CASE WHEN anime_subtitle_tracks.is_curated != 0 THEN anime_subtitle_tracks.cue_count ELSE excluded.cue_count END,
        token_count = CASE WHEN anime_subtitle_tracks.is_curated != 0 THEN anime_subtitle_tracks.token_count ELSE excluded.token_count END,
        word_linked_token_count = CASE WHEN anime_subtitle_tracks.is_curated != 0 THEN anime_subtitle_tracks.word_linked_token_count ELSE excluded.word_linked_token_count END,
        source_files = CASE WHEN anime_subtitle_tracks.is_curated != 0 THEN anime_subtitle_tracks.source_files ELSE excluded.source_files END,
        content_sha256 = CASE WHEN anime_subtitle_tracks.is_curated != 0 THEN anime_subtitle_tracks.content_sha256 ELSE excluded.content_sha256 END,
        rights_status = CASE WHEN anime_subtitle_tracks.is_curated != 0 THEN anime_subtitle_tracks.rights_status ELSE excluded.rights_status END,
        updated_at = excluded.updated_at
    `)

    // 9. Upsert Subtitle Cues & Tokens
    const upsertCueStmt = db.prepare(`
      INSERT INTO anime_subtitle_cues (
        track_id, episode_id, cue_id, start_time, end_time, ja_text, vi_text,
        compounds, is_curated, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(track_id, cue_id) DO UPDATE SET
        start_time = CASE WHEN anime_subtitle_cues.is_curated != 0 THEN anime_subtitle_cues.start_time ELSE excluded.start_time END,
        end_time = CASE WHEN anime_subtitle_cues.is_curated != 0 THEN anime_subtitle_cues.end_time ELSE excluded.end_time END,
        ja_text = CASE WHEN anime_subtitle_cues.is_curated != 0 THEN anime_subtitle_cues.ja_text ELSE excluded.ja_text END,
        vi_text = CASE WHEN anime_subtitle_cues.is_curated != 0 THEN anime_subtitle_cues.vi_text ELSE excluded.vi_text END,
        compounds = CASE WHEN anime_subtitle_cues.is_curated != 0 THEN anime_subtitle_cues.compounds ELSE excluded.compounds END,
        updated_at = excluded.updated_at
      RETURNING id
    `)

    const upsertTokenStmt = db.prepare(`
      INSERT INTO anime_subtitle_tokens (
        cue_row_id, track_id, episode_id, token_ordinal, surface, char_start, char_end, word_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cue_row_id, token_ordinal) DO UPDATE SET
        surface = excluded.surface,
        char_start = excluded.char_start,
        char_end = excluded.char_end,
        word_id = excluded.word_id
    `)

    let ingestedCues = 0
    let ingestedTokens = 0
    for (let trIdx = 0; trIdx < (subtitle_tracks || []).length; trIdx++) {
      const tr = subtitle_tracks[trIdx]
      upsertTrackStmt.run(
        tr.track_id,
        tr.episode_id,
        tr.series_slug,
        tr.episode_number,
        JSON.stringify(tr.languages || ['ja', 'vi']),
        tr.cue_count || 0,
        tr.token_count || 0,
        tr.word_linked_token_count || 0,
        JSON.stringify(tr.source_files || {}),
        JSON.stringify(tr.content_sha256 || {}),
        JSON.stringify(tr.rights_status || {}),
        now,
        now
      )

      for (const c of tr.cues || []) {
        const cueRow = upsertCueStmt.get(
          tr.track_id,
          tr.episode_id,
          c.id,
          c.start,
          c.end,
          c.ja,
          c.vi,
          JSON.stringify(c.compounds || []),
          now,
          now
        )
        const cueRowId = cueRow.id
        ingestedCues++

        const tokens = c.tokens || []
        for (let tIdx = 0; tIdx < tokens.length; tIdx++) {
          const t = tokens[tIdx]
          upsertTokenStmt.run(
            cueRowId,
            tr.track_id,
            tr.episode_id,
            tIdx + 1,
            t.surface,
            t.char_start,
            t.char_end,
            typeof t.word_id === 'number' ? t.word_id : null,
            now
          )
          ingestedTokens++
        }
      }

      if (options.onProgress) {
        options.onProgress({
          trackIndex: trIdx + 1,
          totalTracks: subtitle_tracks.length,
          cues: ingestedCues,
          tokens: ingestedTokens,
        })
      }
    }

    // 10. Upsert Playlists
    const upsertPlaylistStmt = db.prepare(`
      INSERT INTO anime_playlists (
        playlist_id, playlist_slug, title, channel, jlpt_level, category,
        video_count, view_count, tier, dict_series_slug, rights_status,
        is_curated, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(playlist_slug) DO UPDATE SET
        title = CASE WHEN anime_playlists.is_curated != 0 THEN anime_playlists.title ELSE excluded.title END,
        channel = CASE WHEN anime_playlists.is_curated != 0 THEN anime_playlists.channel ELSE excluded.channel END,
        jlpt_level = CASE WHEN anime_playlists.is_curated != 0 THEN anime_playlists.jlpt_level ELSE excluded.jlpt_level END,
        category = CASE WHEN anime_playlists.is_curated != 0 THEN anime_playlists.category ELSE excluded.category END,
        video_count = CASE WHEN anime_playlists.is_curated != 0 THEN anime_playlists.video_count ELSE excluded.video_count END,
        view_count = CASE WHEN anime_playlists.is_curated != 0 THEN anime_playlists.view_count ELSE excluded.view_count END,
        tier = CASE WHEN anime_playlists.is_curated != 0 THEN anime_playlists.tier ELSE excluded.tier END,
        dict_series_slug = CASE WHEN anime_playlists.is_curated != 0 THEN anime_playlists.dict_series_slug ELSE excluded.dict_series_slug END,
        rights_status = CASE WHEN anime_playlists.is_curated != 0 THEN anime_playlists.rights_status ELSE excluded.rights_status END,
        updated_at = excluded.updated_at
    `)

    const upsertPlaylistVideoStmt = db.prepare(`
      INSERT INTO anime_playlist_videos (
        playlist_video_id, playlist_id, playlist_slug, video_id, title, thumbnail_url,
        watch_url, youtube_url, ordinal, playback_allowed, rights_status,
        is_curated, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(playlist_id, ordinal) DO UPDATE SET
        playlist_slug = CASE WHEN anime_playlist_videos.is_curated != 0 THEN anime_playlist_videos.playlist_slug ELSE excluded.playlist_slug END,
        video_id = CASE WHEN anime_playlist_videos.is_curated != 0 THEN anime_playlist_videos.video_id ELSE excluded.video_id END,
        title = CASE WHEN anime_playlist_videos.is_curated != 0 THEN anime_playlist_videos.title ELSE excluded.title END,
        thumbnail_url = CASE WHEN anime_playlist_videos.is_curated != 0 THEN anime_playlist_videos.thumbnail_url ELSE excluded.thumbnail_url END,
        watch_url = CASE WHEN anime_playlist_videos.is_curated != 0 THEN anime_playlist_videos.watch_url ELSE excluded.watch_url END,
        youtube_url = CASE WHEN anime_playlist_videos.is_curated != 0 THEN anime_playlist_videos.youtube_url ELSE excluded.youtube_url END,
        playback_allowed = CASE WHEN anime_playlist_videos.is_curated != 0 THEN anime_playlist_videos.playback_allowed ELSE excluded.playback_allowed END,
        rights_status = CASE WHEN anime_playlist_videos.is_curated != 0 THEN anime_playlist_videos.rights_status ELSE excluded.rights_status END,
        updated_at = excluded.updated_at
    `)

    for (const pl of playlists || []) {
      upsertPlaylistStmt.run(
        pl.playlist_id,
        pl.playlist_slug,
        pl.title,
        pl.channel || null,
        pl.jlpt_level || null,
        pl.category || null,
        pl.video_count || 0,
        pl.view_count || 0,
        pl.tier || 'free',
        pl.dict_series_slug || null,
        pl.rights_status || 'unknown',
        now,
        now
      )

      for (const v of pl.videos || []) {
        upsertPlaylistVideoStmt.run(
          v.playlist_video_id,
          pl.playlist_id,
          v.playlist_slug,
          v.video_id,
          v.title,
          v.thumbnail_url || null,
          v.watch_url || null,
          v.youtube_url || null,
          v.ordinal,
          v.playback_allowed ? 1 : 0,
          v.rights_status || 'unknown',
          now,
          now
        )
      }
    }

    // 11. Mark Import Run as 'completed'
    db.prepare("UPDATE anime_import_runs SET status = 'completed' WHERE run_id = ?").run(runId)

    db.exec('COMMIT;')

    return {
      runId,
      seriesCount: (series || []).length,
      episodesCount: import_run.total_episodes,
      tracksCount: (subtitle_tracks || []).length,
      cuesCount: import_run.total_cues,
      playlistsCount: (playlists || []).length,
      status: 'completed',
    }
  } catch (error) {
    try {
      db.exec('ROLLBACK;')
    } catch {
      // rollback error suppressed
    }
    throw error
  }
}

/**
 * Transactional ingest of Canonical Anime Dataset into PostgreSQL
 * @param {any} clientOrPool pg.Pool or pg.Client instance
 * @param {any} dataset CanonicalDataset
 * @param {{ runId?: string, skipValidation?: boolean, datasetHash?: string }} [options]
 * @returns {Promise<{ runId: string, seriesCount: number, episodesCount: number, tracksCount: number, cuesCount: number, playlistsCount: number, status: string }>}
 */
export async function ingestAnimeDatasetPostgres(clientOrPool, dataset, options = {}) {
  // 1. Validation check
  if (!options.skipValidation) {
    const validation = validateCanonicalDataset(dataset)
    if (!validation.valid) {
      throw new Error(`Dataset validation failed: ${validation.errors.join('; ')}`)
    }
  }

  const runId = options.runId || `run_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  const datasetHash = options.datasetHash || crypto.createHash('sha256').update(JSON.stringify(dataset)).digest('hex')

  const { import_run, series, playlists, subtitle_tracks, dictionary_reference } = dataset

  const isDedicatedClient = typeof clientOrPool.connect === 'function'
  const client = isDedicatedClient ? await clientOrPool.connect() : clientOrPool

  await client.query('BEGIN')
  try {
    // 2. Insert import run with pending status
    await client.query(
      `INSERT INTO anime_import_runs (
        run_id, source_manifest_hash, dataset_hash, importer_version,
        total_series, total_seasons, total_episodes, total_media_sources,
        total_subtitle_tracks, total_cues, total_tokens, total_playlists, total_playlist_videos,
        media_sources_summary, dictionary_reference, warning_count, error_count,
        status, reject_list, warnings, imported_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16, $17, 'pending', $18::jsonb, $19::jsonb, now())`,
      [
        runId,
        import_run.source_manifest_hash,
        datasetHash,
        import_run.importer_version,
        import_run.total_series,
        import_run.total_seasons,
        import_run.total_episodes,
        import_run.total_media_sources,
        import_run.total_subtitle_tracks,
        import_run.total_cues,
        import_run.total_tokens,
        import_run.total_playlists,
        import_run.total_playlist_videos,
        JSON.stringify(import_run.media_sources_by_type || {}),
        JSON.stringify(dictionary_reference || {}),
        import_run.warning_count || 0,
        import_run.error_count || 0,
        JSON.stringify(import_run.reject_list || []),
        JSON.stringify(import_run.warnings || []),
      ]
    )

    // 3. Upsert Series, Seasons, Episodes, Media Sources
    for (const s of series || []) {
      await client.query(
        `INSERT INTO anime_series (
          series_id, series_slug, master_slug, title_vi, title_ja, description,
          poster_url, category, jlpt_level, channel, video_source, total_episodes,
          rights_status, provenance, is_curated, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, false, now(), now())
        ON CONFLICT(series_slug) DO UPDATE SET
          master_slug = CASE WHEN anime_series.is_curated IS TRUE THEN anime_series.master_slug ELSE excluded.master_slug END,
          title_vi = CASE WHEN anime_series.is_curated IS TRUE THEN anime_series.title_vi ELSE excluded.title_vi END,
          title_ja = CASE WHEN anime_series.is_curated IS TRUE THEN anime_series.title_ja ELSE excluded.title_ja END,
          description = CASE WHEN anime_series.is_curated IS TRUE THEN anime_series.description ELSE excluded.description END,
          poster_url = CASE WHEN anime_series.is_curated IS TRUE THEN anime_series.poster_url ELSE excluded.poster_url END,
          category = CASE WHEN anime_series.is_curated IS TRUE THEN anime_series.category ELSE excluded.category END,
          jlpt_level = CASE WHEN anime_series.is_curated IS TRUE THEN anime_series.jlpt_level ELSE excluded.jlpt_level END,
          channel = CASE WHEN anime_series.is_curated IS TRUE THEN anime_series.channel ELSE excluded.channel END,
          video_source = CASE WHEN anime_series.is_curated IS TRUE THEN anime_series.video_source ELSE excluded.video_source END,
          total_episodes = CASE WHEN anime_series.is_curated IS TRUE THEN anime_series.total_episodes ELSE excluded.total_episodes END,
          rights_status = CASE WHEN anime_series.is_curated IS TRUE THEN anime_series.rights_status ELSE excluded.rights_status END,
          provenance = CASE WHEN anime_series.is_curated IS TRUE THEN anime_series.provenance ELSE excluded.provenance END,
          updated_at = now()`,
        [
          s.series_id,
          s.series_slug,
          s.master_slug || null,
          s.title_vi,
          s.title_ja || null,
          s.description || '',
          s.poster_url || null,
          s.category || null,
          s.jlpt_level || null,
          s.channel || null,
          s.video_source || null,
          s.total_episodes || 0,
          s.rights_status || 'unknown',
          JSON.stringify(s.provenance || {}),
        ]
      )

      for (const sn of s.seasons || []) {
        await client.query(
          `INSERT INTO anime_seasons (
            season_id, series_id, series_slug, season_slug, season_ordinal, season_label,
            title_vi, total_episodes, is_curated, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, now(), now())
          ON CONFLICT(series_id, season_slug) DO UPDATE SET
            season_ordinal = CASE WHEN anime_seasons.is_curated IS TRUE THEN anime_seasons.season_ordinal ELSE excluded.season_ordinal END,
            season_label = CASE WHEN anime_seasons.is_curated IS TRUE THEN anime_seasons.season_label ELSE excluded.season_label END,
            title_vi = CASE WHEN anime_seasons.is_curated IS TRUE THEN anime_seasons.title_vi ELSE excluded.title_vi END,
            total_episodes = CASE WHEN anime_seasons.is_curated IS TRUE THEN anime_seasons.total_episodes ELSE excluded.total_episodes END,
            updated_at = now()`,
          [
            sn.season_id,
            s.series_id,
            sn.series_slug,
            sn.season_slug,
            sn.season_ordinal,
            sn.season_label || null,
            sn.title_vi,
            sn.total_episodes || 0,
          ]
        )

        for (const ep of sn.episodes || []) {
          await client.query(
            `INSERT INTO anime_episodes (
              episode_id, series_id, season_id, series_slug, season_slug, episode_number,
              title, has_subtitles, is_curated, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, now(), now())
            ON CONFLICT(series_slug, season_slug, episode_number) DO UPDATE SET
              title = CASE WHEN anime_episodes.is_curated IS TRUE THEN anime_episodes.title ELSE excluded.title END,
              has_subtitles = CASE WHEN anime_episodes.is_curated IS TRUE THEN anime_episodes.has_subtitles ELSE excluded.has_subtitles END,
              updated_at = now()`,
            [
              ep.episode_id,
              s.series_id,
              sn.season_id,
              ep.series_slug,
              ep.season_slug,
              ep.episode_number,
              ep.title || null,
              Boolean(ep.has_subtitles),
            ]
          )

          if (ep.media_source) {
            const ms = ep.media_source
            await client.query(
              `INSERT INTO anime_media_sources (
                source_id, episode_id, source_type, media_id, stream_url, page_url,
                playback_allowed, rights_status, is_curated, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, null, $5, $6, $7, false, now(), now())
              ON CONFLICT(episode_id) DO UPDATE SET
                source_type = CASE WHEN anime_media_sources.is_curated IS TRUE THEN anime_media_sources.source_type ELSE excluded.source_type END,
                media_id = CASE WHEN anime_media_sources.is_curated IS TRUE THEN anime_media_sources.media_id ELSE excluded.media_id END,
                page_url = CASE WHEN anime_media_sources.is_curated IS TRUE THEN anime_media_sources.page_url ELSE excluded.page_url END,
                playback_allowed = CASE WHEN anime_media_sources.is_curated IS TRUE THEN anime_media_sources.playback_allowed ELSE excluded.playback_allowed END,
                rights_status = CASE WHEN anime_media_sources.is_curated IS TRUE THEN anime_media_sources.rights_status ELSE excluded.rights_status END,
                updated_at = now()`,
              [
                ms.source_id,
                ep.episode_id,
                ms.source_type,
                ms.media_id || null,
                ms.page_url || null,
                Boolean(ms.playback_allowed),
                ms.rights_status || 'unknown',
              ]
            )
          }
        }
      }
    }

    // 4. Upsert Subtitle Tracks, Cues, Tokens
    for (const tr of subtitle_tracks || []) {
      await client.query(
        `INSERT INTO anime_subtitle_tracks (
          track_id, episode_id, series_slug, episode_number, languages, cue_count,
          token_count, word_linked_token_count, source_files, content_sha256,
          rights_status, is_curated, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, false, now(), now())
        ON CONFLICT(episode_id) DO UPDATE SET
          languages = CASE WHEN anime_subtitle_tracks.is_curated IS TRUE THEN anime_subtitle_tracks.languages ELSE excluded.languages END,
          cue_count = CASE WHEN anime_subtitle_tracks.is_curated IS TRUE THEN anime_subtitle_tracks.cue_count ELSE excluded.cue_count END,
          token_count = CASE WHEN anime_subtitle_tracks.is_curated IS TRUE THEN anime_subtitle_tracks.token_count ELSE excluded.token_count END,
          word_linked_token_count = CASE WHEN anime_subtitle_tracks.is_curated IS TRUE THEN anime_subtitle_tracks.word_linked_token_count ELSE excluded.word_linked_token_count END,
          source_files = CASE WHEN anime_subtitle_tracks.is_curated IS TRUE THEN anime_subtitle_tracks.source_files ELSE excluded.source_files END,
          content_sha256 = CASE WHEN anime_subtitle_tracks.is_curated IS TRUE THEN anime_subtitle_tracks.content_sha256 ELSE excluded.content_sha256 END,
          rights_status = CASE WHEN anime_subtitle_tracks.is_curated IS TRUE THEN anime_subtitle_tracks.rights_status ELSE excluded.rights_status END,
          updated_at = now()`,
        [
          tr.track_id,
          tr.episode_id,
          tr.series_slug,
          tr.episode_number,
          JSON.stringify(tr.languages || ['ja', 'vi']),
          tr.cue_count || 0,
          tr.token_count || 0,
          tr.word_linked_token_count || 0,
          JSON.stringify(tr.source_files || {}),
          JSON.stringify(tr.content_sha256 || {}),
          JSON.stringify(tr.rights_status || {}),
        ]
      )

      for (const c of tr.cues || []) {
        const cueRes = await client.query(
          `INSERT INTO anime_subtitle_cues (
            track_id, episode_id, cue_id, start_time, end_time, ja_text, vi_text,
            compounds, is_curated, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, false, now(), now())
          ON CONFLICT(track_id, cue_id) DO UPDATE SET
            start_time = CASE WHEN anime_subtitle_cues.is_curated IS TRUE THEN anime_subtitle_cues.start_time ELSE excluded.start_time END,
            end_time = CASE WHEN anime_subtitle_cues.is_curated IS TRUE THEN anime_subtitle_cues.end_time ELSE excluded.end_time END,
            ja_text = CASE WHEN anime_subtitle_cues.is_curated IS TRUE THEN anime_subtitle_cues.ja_text ELSE excluded.ja_text END,
            vi_text = CASE WHEN anime_subtitle_cues.is_curated IS TRUE THEN anime_subtitle_cues.vi_text ELSE excluded.vi_text END,
            compounds = CASE WHEN anime_subtitle_cues.is_curated IS TRUE THEN anime_subtitle_cues.compounds ELSE excluded.compounds END,
            updated_at = now()
          RETURNING id`,
          [
            tr.track_id,
            tr.episode_id,
            c.id,
            c.start,
            c.end,
            c.ja,
            c.vi,
            JSON.stringify(c.compounds || []),
          ]
        )
        const cueRowId = cueRes.rows[0].id

        const tokens = c.tokens || []
        for (let tIdx = 0; tIdx < tokens.length; tIdx++) {
          const t = tokens[tIdx]
          await client.query(
            `INSERT INTO anime_subtitle_tokens (
              cue_row_id, track_id, episode_id, token_ordinal, surface, char_start, char_end, word_id, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
            ON CONFLICT(cue_row_id, token_ordinal) DO UPDATE SET
              surface = excluded.surface,
              char_start = excluded.char_start,
              char_end = excluded.char_end,
              word_id = excluded.word_id`,
            [
              cueRowId,
              tr.track_id,
              tr.episode_id,
              tIdx + 1,
              t.surface,
              t.char_start,
              t.char_end,
              typeof t.word_id === 'number' ? t.word_id : null,
            ]
          )
        }
      }
    }

    // 5. Upsert Playlists & Playlist Videos
    for (const pl of playlists || []) {
      await client.query(
        `INSERT INTO anime_playlists (
          playlist_id, playlist_slug, title, channel, jlpt_level, category,
          video_count, view_count, tier, dict_series_slug, rights_status,
          is_curated, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, now(), now())
        ON CONFLICT(playlist_slug) DO UPDATE SET
          title = CASE WHEN anime_playlists.is_curated IS TRUE THEN anime_playlists.title ELSE excluded.title END,
          channel = CASE WHEN anime_playlists.is_curated IS TRUE THEN anime_playlists.channel ELSE excluded.channel END,
          jlpt_level = CASE WHEN anime_playlists.is_curated IS TRUE THEN anime_playlists.jlpt_level ELSE excluded.jlpt_level END,
          category = CASE WHEN anime_playlists.is_curated IS TRUE THEN anime_playlists.category ELSE excluded.category END,
          video_count = CASE WHEN anime_playlists.is_curated IS TRUE THEN anime_playlists.video_count ELSE excluded.video_count END,
          view_count = CASE WHEN anime_playlists.is_curated IS TRUE THEN anime_playlists.view_count ELSE excluded.view_count END,
          tier = CASE WHEN anime_playlists.is_curated IS TRUE THEN anime_playlists.tier ELSE excluded.tier END,
          dict_series_slug = CASE WHEN anime_playlists.is_curated IS TRUE THEN anime_playlists.dict_series_slug ELSE excluded.dict_series_slug END,
          rights_status = CASE WHEN anime_playlists.is_curated IS TRUE THEN anime_playlists.rights_status ELSE excluded.rights_status END,
          updated_at = now()`,
        [
          pl.playlist_id,
          pl.playlist_slug,
          pl.title,
          pl.channel || null,
          pl.jlpt_level || null,
          pl.category || null,
          pl.video_count || 0,
          pl.view_count || 0,
          pl.tier || 'free',
          pl.dict_series_slug || null,
          pl.rights_status || 'unknown',
        ]
      )

      for (const v of pl.videos || []) {
        await client.query(
          `INSERT INTO anime_playlist_videos (
            playlist_video_id, playlist_id, playlist_slug, video_id, title, thumbnail_url,
            watch_url, youtube_url, ordinal, playback_allowed, rights_status,
            is_curated, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, now(), now())
          ON CONFLICT(playlist_id, ordinal) DO UPDATE SET
            playlist_slug = CASE WHEN anime_playlist_videos.is_curated IS TRUE THEN anime_playlist_videos.playlist_slug ELSE excluded.playlist_slug END,
            video_id = CASE WHEN anime_playlist_videos.is_curated IS TRUE THEN anime_playlist_videos.video_id ELSE excluded.video_id END,
            title = CASE WHEN anime_playlist_videos.is_curated IS TRUE THEN anime_playlist_videos.title ELSE excluded.title END,
            thumbnail_url = CASE WHEN anime_playlist_videos.is_curated IS TRUE THEN anime_playlist_videos.thumbnail_url ELSE excluded.thumbnail_url END,
            watch_url = CASE WHEN anime_playlist_videos.is_curated IS TRUE THEN anime_playlist_videos.watch_url ELSE excluded.watch_url END,
            youtube_url = CASE WHEN anime_playlist_videos.is_curated IS TRUE THEN anime_playlist_videos.youtube_url ELSE excluded.youtube_url END,
            playback_allowed = CASE WHEN anime_playlist_videos.is_curated IS TRUE THEN anime_playlist_videos.playback_allowed ELSE excluded.playback_allowed END,
            rights_status = CASE WHEN anime_playlist_videos.is_curated IS TRUE THEN anime_playlist_videos.rights_status ELSE excluded.rights_status END,
            updated_at = now()`,
          [
            v.playlist_video_id,
            pl.playlist_id,
            v.playlist_slug,
            v.video_id,
            v.title,
            v.thumbnail_url || null,
            v.watch_url || null,
            v.youtube_url || null,
            v.ordinal,
            Boolean(v.playback_allowed),
            v.rights_status || 'unknown',
          ]
        )
      }
    }

    // 6. Complete import run
    await client.query("UPDATE anime_import_runs SET status = 'completed' WHERE run_id = $1", [runId])

    await client.query('COMMIT')

    return {
      runId,
      seriesCount: (series || []).length,
      episodesCount: import_run.total_episodes,
      tracksCount: (subtitle_tracks || []).length,
      cuesCount: import_run.total_cues,
      playlistsCount: (playlists || []).length,
      status: 'completed',
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    if (isDedicatedClient) client.release()
  }
}

/**
 * Universal Ingest helper that auto-routes to SQLite or PostgreSQL
 */
export async function ingestAnimeDataset(target, dataset, options = {}) {
  if (target && typeof target.exec === 'function' && typeof target.prepare === 'function') {
    return ingestAnimeDatasetSQLite(target, dataset, options)
  }
  return ingestAnimeDatasetPostgres(target, dataset, options)
}

/**
 * Retrieves aggregate anime table counts from database
 * @param {any} db SQLite or PostgreSQL instance
 * @returns {Promise<{
 *   series: number,
 *   seasons: number,
 *   episodes: number,
 *   mediaSources: number,
 *   subtitleTracks: number,
 *   subtitleCues: number,
 *   subtitleTokens: number,
 *   playlists: number,
 *   playlistVideos: number,
 *   watchProgress: number,
 *   importRuns: number
 * }>}
 */
export async function getAnimeTableCounts(db) {
  if (db && typeof db.prepare === 'function') {
    return {
      series: db.prepare('SELECT count(*) as count FROM anime_series').get().count,
      seasons: db.prepare('SELECT count(*) as count FROM anime_seasons').get().count,
      episodes: db.prepare('SELECT count(*) as count FROM anime_episodes').get().count,
      mediaSources: db.prepare('SELECT count(*) as count FROM anime_media_sources').get().count,
      subtitleTracks: db.prepare('SELECT count(*) as count FROM anime_subtitle_tracks').get().count,
      subtitleCues: db.prepare('SELECT count(*) as count FROM anime_subtitle_cues').get().count,
      subtitleTokens: db.prepare('SELECT count(*) as count FROM anime_subtitle_tokens').get().count,
      playlists: db.prepare('SELECT count(*) as count FROM anime_playlists').get().count,
      playlistVideos: db.prepare('SELECT count(*) as count FROM anime_playlist_videos').get().count,
      watchProgress: db.prepare('SELECT count(*) as count FROM anime_watch_progress').get().count,
      importRuns: db.prepare('SELECT count(*) as count FROM anime_import_runs').get().count,
    }
  }

  const [
    series, seasons, episodes, mediaSources,
    subtitleTracks, subtitleCues, subtitleTokens,
    playlists, playlistVideos, watchProgress, importRuns
  ] = await Promise.all([
    db.query('SELECT count(*) FROM anime_series'),
    db.query('SELECT count(*) FROM anime_seasons'),
    db.query('SELECT count(*) FROM anime_episodes'),
    db.query('SELECT count(*) FROM anime_media_sources'),
    db.query('SELECT count(*) FROM anime_subtitle_tracks'),
    db.query('SELECT count(*) FROM anime_subtitle_cues'),
    db.query('SELECT count(*) FROM anime_subtitle_tokens'),
    db.query('SELECT count(*) FROM anime_playlists'),
    db.query('SELECT count(*) FROM anime_playlist_videos'),
    db.query('SELECT count(*) FROM anime_watch_progress'),
    db.query('SELECT count(*) FROM anime_import_runs'),
  ])

  return {
    series: Number(series.rows[0].count),
    seasons: Number(seasons.rows[0].count),
    episodes: Number(episodes.rows[0].count),
    mediaSources: Number(mediaSources.rows[0].count),
    subtitleTracks: Number(subtitleTracks.rows[0].count),
    subtitleCues: Number(subtitleCues.rows[0].count),
    subtitleTokens: Number(subtitleTokens.rows[0].count),
    playlists: Number(playlists.rows[0].count),
    playlistVideos: Number(playlistVideos.rows[0].count),
    watchProgress: Number(watchProgress.rows[0].count),
    importRuns: Number(importRuns.rows[0].count),
  }
}

/**
 * Detects whether a database connection string or hostname points to Neon or its subdomains.
 * Parses using standard URL API and checks lowercase hostname against neon.tech and *.neon.tech.
 * @param {string} connectionString
 * @returns {boolean}
 */
export function isForbiddenNeonHost(connectionString) {
  if (!connectionString || typeof connectionString !== 'string') return false
  const trimmed = connectionString.trim()
  if (!trimmed) return false

  try {
    const raw = trimmed.includes('://') ? trimmed : `postgresql://${trimmed}`
    const parsed = new URL(raw)
    const hostname = (parsed.hostname || '').toLowerCase().trim()
    if (!hostname) return false
    return hostname === 'neon.tech' || hostname.endsWith('.neon.tech')
  } catch {
    const lower = trimmed.toLowerCase()
    return /(?:^|[@/.])(?:[a-z0-9-]+\.)*neon\.tech(?::\d+)?(?:[/?#]|$)/.test(lower)
  }
}
