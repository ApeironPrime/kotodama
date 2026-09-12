import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import {
  SQLITE_ANIME_DDL,
  applyAnimeSchemaSQLite,
  ingestAnimeDatasetSQLite,
  getAnimeTableCounts,
  isForbiddenNeonHost,
} from '../../server/db/anime-persistence.mjs'
import { runCLI } from './ingest.mjs'

/**
 * Fixture builder for minimal valid Canonical Dataset
 */
function createValidDatasetFixture(customSuffix = '1') {
  const episodeId = `anime:episode:test-show-${customSuffix}:test-show-${customSuffix}:1`
  const mediaSource = {
    source_id: `anime:media:${episodeId}`,
    episode_id: episodeId,
    source_type: 'youtube',
    media_id: `abc123xyz${customSuffix}`,
    stream_url: null,
    page_url: `https://www.youtube.com/watch?v=abc123xyz${customSuffix}`,
    playback_allowed: true,
    rights_status: 'restricted',
  }

  const episode = {
    episode_id: episodeId,
    series_id: `series-${customSuffix}`,
    season_id: `anime:season:test-show-${customSuffix}:test-show-${customSuffix}`,
    series_slug: `test-show-${customSuffix}`,
    season_slug: `test-show-${customSuffix}`,
    episode_number: 1,
    title: 'Tập 1: Khởi đầu',
    has_subtitles: true,
    media_source: mediaSource,
  }

  const season = {
    season_id: `anime:season:test-show-${customSuffix}:test-show-${customSuffix}`,
    series_id: `series-${customSuffix}`,
    series_slug: `test-show-${customSuffix}`,
    season_slug: `test-show-${customSuffix}`,
    season_ordinal: 1,
    season_label: 'Phần 1',
    title_vi: `Test Show ${customSuffix}`,
    total_episodes: 1,
    episodes: [episode],
  }

  const series = {
    series_id: `series-${customSuffix}`,
    series_slug: `test-show-${customSuffix}`,
    master_slug: null,
    title_vi: `Test Show ${customSuffix}`,
    title_ja: `テスト番組 ${customSuffix}`,
    description: `Mô tả anime thử nghiệm ${customSuffix}`,
    poster_url: 'https://example.com/poster.jpg',
    category: 'Anime',
    jlpt_level: 'N3',
    channel: 'Anime Channel',
    video_source: 'youtube',
    total_episodes: 1,
    rights_status: 'restricted',
    provenance: {
      origin: 'akaiwa.tv',
      source_file: 'all_data.json',
      crawled_at: '2026-09-11',
    },
    seasons: [season],
  }

  const cue1 = {
    id: 1,
    start: 1.5,
    end: 4.2,
    ja: 'こんにちは 世界',
    vi: 'Xin chào thế giới',
    tokens: [
      { surface: 'こんにちは', char_start: 0, char_end: 5, word_id: 12345 },
      { surface: '世界', char_start: 6, char_end: 8, word_id: 67890 },
    ],
    compounds: [
      { surface: '世界', char_start: 6, char_end: 8, word_id: 67890 },
    ],
  }

  const track = {
    track_id: `anime:subtrack:test-show-${customSuffix}:1`,
    episode_id: episodeId,
    series_slug: `test-show-${customSuffix}`,
    episode_number: 1,
    languages: ['ja', 'vi'],
    cue_count: 1,
    token_count: 2,
    word_linked_token_count: 2,
    source_files: {
      json: `subtitles/test-show-${customSuffix}/ep01.json`,
      srt: `subtitles/test-show-${customSuffix}/ep01.srt`,
      vtt: `subtitles/test-show-${customSuffix}/ep01.vtt`,
    },
    content_sha256: {
      json: 'a'.repeat(64),
      srt: 'b'.repeat(64),
      vtt: 'c'.repeat(64),
    },
    rights_status: {
      ja: 'restricted',
      vi: 'unknown',
    },
    cues: [cue1],
  }

  const video = {
    playlist_video_id: `anime:plv:pl-${customSuffix}:vid-001`,
    playlist_id: `pl-${customSuffix}`,
    playlist_slug: `test-playlist-${customSuffix}`,
    video_id: `vid-${customSuffix}-001`,
    title: 'Playlist Video 1',
    thumbnail_url: 'https://example.com/thumb.jpg',
    watch_url: null,
    youtube_url: `https://www.youtube.com/watch?v=vid-${customSuffix}-001`,
    ordinal: 1,
    playback_allowed: true,
    rights_status: 'restricted',
  }

  const playlist = {
    playlist_id: `pl-${customSuffix}`,
    playlist_slug: `test-playlist-${customSuffix}`,
    title: `Test Playlist ${customSuffix}`,
    channel: 'Anime Channel',
    jlpt_level: 'N3',
    category: 'JLPT',
    video_count: 1,
    view_count: 1000,
    tier: 'free',
    dict_series_slug: null,
    rights_status: 'restricted',
    videos: [video],
  }

  const dictionaryReference = {
    total_words: 59224,
    total_indexed_entries: 39516,
    indexed_words_count: 39516,
    total_shards: 666,
    shard_formula: 'word_id % 1000',
    shard_naming_pattern: 'shard-{NNN}.json',
    total_word_index_keys: 59225,
    unreferenced_word_index_ids_count: 19708,
    homophone_collision_id: 3144121485,
    homophone_words: ['アニソン', '柔道家'],
    rights_status: 'unknown',
  }

  const importRun = {
    source_manifest_hash: '6ddaf0bf0adf0a8d2fdb2cd57767e14295e4d8f0a1d3f547f788bb786d1f7d0f',
    importer_version: '1.0.0',
    total_series: 1,
    total_seasons: 1,
    total_episodes: 1,
    total_media_sources: 1,
    media_sources_by_type: {
      youtube: 1,
      external_page: 0,
      authorized_local: 0,
      unavailable: 0,
    },
    total_subtitle_tracks: 1,
    total_cues: 1,
    total_tokens: 2,
    total_playlists: 1,
    total_playlist_videos: 1,
    unique_playlist_youtube_ids: 1,
    error_count: 0,
    reject_list: [],
    warning_count: 0,
    warnings: [],
  }

  return {
    import_run: importRun,
    dictionary_reference: dictionaryReference,
    series: [series],
    playlists: [playlist],
    subtitle_tracks: [track],
  }
}

test('1. SQLite Schema Initialization & Migration Idempotency', async (t) => {
  const db = new DatabaseSync(':memory:')

  await t.test('first applyAnimeSchemaSQLite creates all 11 tables and enables foreign keys', () => {
    applyAnimeSchemaSQLite(db)

    const fkResult = db.prepare('PRAGMA foreign_keys;').get()
    assert.equal(fkResult.foreign_keys, 1, 'PRAGMA foreign_keys must be enabled (1)')

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'anime_%' ORDER BY name")
      .all()
      .map((r) => r.name)

    const expectedTables = [
      'anime_episodes',
      'anime_import_runs',
      'anime_media_sources',
      'anime_playlist_videos',
      'anime_playlists',
      'anime_seasons',
      'anime_series',
      'anime_subtitle_cues',
      'anime_subtitle_tokens',
      'anime_subtitle_tracks',
      'anime_watch_progress',
    ]

    assert.deepEqual(tables, expectedTables, 'All 11 anime tables must be created')
  })

  await t.test('second and third calls to applyAnimeSchemaSQLite are idempotent and do not fail', () => {
    assert.doesNotThrow(() => {
      applyAnimeSchemaSQLite(db)
      applyAnimeSchemaSQLite(db)
    }, 'Re-applying schema must be completely idempotent')
  })

  db.close()
})

test('2. Contract Parity between PostgreSQL 010 migration and SQLite DDL', () => {
  const pgSqlPath = path.resolve('server/db/migrations/010_anime_tables.sql')
  const pgSql = fs.readFileSync(pgSqlPath, 'utf8')

  // Extract CREATE TABLE table names from PostgreSQL DDL
  const pgTables = [...pgSql.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z_]+)/gi)]
    .map((m) => m[1].toLowerCase())
    .sort()

  // Extract CREATE TABLE table names from SQLite DDL
  const sqliteTables = [...SQLITE_ANIME_DDL.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z_]+)/gi)]
    .map((m) => m[1].toLowerCase())
    .sort()

  assert.deepEqual(sqliteTables, pgTables, 'SQLite DDL and PostgreSQL 010 migration must define identical tables')
  assert.equal(pgTables.length, 11, 'Must define exactly 11 tables')

  // Extract column names for each table in SQLite vs PG
  for (const tableName of pgTables) {
    const getColumns = (sql) => {
      const regex = new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${tableName}\\s*\\(([^;]+?)\\n\\);`, 'is')
      const match = sql.match(regex)
      assert.ok(match, `Table ${tableName} definition found in schema`)
      const body = match[1]
      const lines = body
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('--') && !l.toUpperCase().startsWith('UNIQUE') && !l.toUpperCase().startsWith('CHECK'))
      return lines.map((l) => l.split(/\s+/)[0].toLowerCase())
    }

    const pgCols = getColumns(pgSql)
    const sqliteCols = getColumns(SQLITE_ANIME_DDL)
    assert.deepEqual(
      sqliteCols,
      pgCols,
      `Columns for ${tableName} must match between SQLite and PostgreSQL`
    )
  }
})

test('2b. Database-Level Invariants on anime_media_sources (Direct SQL & PostgreSQL Parity)', async (t) => {
  const db = new DatabaseSync(':memory:')
  applyAnimeSchemaSQLite(db)

  // Seed required parent rows to satisfy foreign keys
  db.prepare(`
    INSERT INTO anime_series (series_id, series_slug, title_vi, created_at, updated_at)
    VALUES ('s-inv', 's-inv', 'Title', '2026-09-11', '2026-09-11')
  `).run()
  db.prepare(`
    INSERT INTO anime_seasons (season_id, series_id, series_slug, season_slug, season_ordinal, title_vi, created_at, updated_at)
    VALUES ('sn-inv', 's-inv', 's-inv', 'sn-inv', 1, 'Season 1', '2026-09-11', '2026-09-11')
  `).run()
  for (let i = 1; i <= 6; i++) {
    db.prepare(`
      INSERT INTO anime_episodes (episode_id, series_id, season_id, series_slug, season_slug, episode_number, created_at, updated_at)
      VALUES (?, 's-inv', 'sn-inv', 's-inv', 'sn-inv', ?, '2026-09-11', '2026-09-11')
    `).run(`ep-inv-${i}`, i)
  }

  await t.test('INSERT external_page + playback_allowed=1 must fail database CHECK constraint', () => {
    assert.throws(() => {
      db.prepare(`
        INSERT INTO anime_media_sources (
          source_id, episode_id, source_type, playback_allowed, rights_status, created_at, updated_at
        ) VALUES ('ms-1', 'ep-inv-1', 'external_page', 1, 'unknown', '2026-09-11', '2026-09-11')
      `).run()
    }, /CHECK constraint failed/)
  })

  await t.test('INSERT youtube + rights_status=approved must fail database CHECK constraint', () => {
    assert.throws(() => {
      db.prepare(`
        INSERT INTO anime_media_sources (
          source_id, episode_id, source_type, playback_allowed, rights_status, created_at, updated_at
        ) VALUES ('ms-2', 'ep-inv-2', 'youtube', 1, 'approved', '2026-09-11', '2026-09-11')
      `).run()
    }, /CHECK constraint failed/)
  })

  await t.test('INSERT external_page + rights_status=approved must fail database CHECK constraint', () => {
    assert.throws(() => {
      db.prepare(`
        INSERT INTO anime_media_sources (
          source_id, episode_id, source_type, playback_allowed, rights_status, created_at, updated_at
        ) VALUES ('ms-3', 'ep-inv-3', 'external_page', 0, 'approved', '2026-09-11', '2026-09-11')
      `).run()
    }, /CHECK constraint failed/)
  })

  await t.test('INSERT with stream_url non-null must fail database CHECK constraint', () => {
    assert.throws(() => {
      db.prepare(`
        INSERT INTO anime_media_sources (
          source_id, episode_id, source_type, stream_url, playback_allowed, rights_status, created_at, updated_at
        ) VALUES ('ms-4', 'ep-inv-4', 'youtube', 'https://video.mp4', 1, 'restricted', '2026-09-11', '2026-09-11')
      `).run()
    }, /CHECK constraint failed/)
  })

  await t.test('INSERT authorized_local + approved + playback_allowed=1 is valid and succeeds', () => {
    assert.doesNotThrow(() => {
      db.prepare(`
        INSERT INTO anime_media_sources (
          source_id, episode_id, source_type, playback_allowed, rights_status, created_at, updated_at
        ) VALUES ('ms-5', 'ep-inv-5', 'authorized_local', 1, 'approved', '2026-09-11', '2026-09-11')
      `).run()
    })
    const row = db.prepare('SELECT source_type, rights_status, playback_allowed FROM anime_media_sources WHERE source_id = ?').get('ms-5')
    assert.equal(row.source_type, 'authorized_local')
    assert.equal(row.rights_status, 'approved')
    assert.equal(row.playback_allowed, 1)
  })

  await t.test('PostgreSQL migration 010 defines matching CHECK constraints for anime_media_sources', () => {
    const pgSql = fs.readFileSync('server/db/migrations/010_anime_tables.sql', 'utf8')
    assert.match(
      pgSql,
      /CHECK\s*\(\s*NOT\s+playback_allowed\s+OR\s+source_type\s+IN\s*\(\s*'youtube'\s*,\s*'authorized_local'\s*\)\s*\)/i,
      'PostgreSQL migration must enforce playback_allowed constraint'
    )
    assert.match(
      pgSql,
      /CHECK\s*\(\s*rights_status\s*!=\s*'approved'\s+OR\s+source_type\s*=\s*'authorized_local'\s*\)/i,
      'PostgreSQL migration must enforce rights_status approved constraint'
    )
    assert.match(
      pgSql,
      /stream_url\s+TEXT\s+CHECK\s*\(\s*stream_url\s+IS\s+NULL\s*\)/i,
      'PostgreSQL migration must enforce stream_url IS NULL constraint'
    )
  })

  db.close()
})

test('3. Transactional Ingestion & Idempotency', async (t) => {
  const db = new DatabaseSync(':memory:')
  applyAnimeSchemaSQLite(db)

  const fixture = createValidDatasetFixture('001')

  await t.test('first ingestion populates all tables with status = completed', () => {
    const res = ingestAnimeDatasetSQLite(db, fixture, { runId: 'run-001' })
    assert.equal(res.status, 'completed')
    assert.equal(res.runId, 'run-001')

    const counts = db.prepare('SELECT * FROM anime_import_runs WHERE run_id = ?').get('run-001')
    assert.equal(counts.status, 'completed')
    assert.equal(counts.total_series, 1)
    assert.equal(counts.total_episodes, 1)
    assert.equal(counts.total_cues, 1)
    assert.equal(counts.total_tokens, 2)
  })

  await t.test('second ingestion is strictly idempotent: no duplicate entities, run logged', async () => {
    const beforeCounts = await getAnimeTableCounts(db)

    const res2 = ingestAnimeDatasetSQLite(db, fixture, { runId: 'run-002' })
    assert.equal(res2.status, 'completed')
    assert.equal(res2.runId, 'run-002')

    const afterCounts = await getAnimeTableCounts(db)

    // Entity counts must remain strictly identical
    assert.equal(afterCounts.series, beforeCounts.series, 'Series count must not change')
    assert.equal(afterCounts.seasons, beforeCounts.seasons, 'Seasons count must not change')
    assert.equal(afterCounts.episodes, beforeCounts.episodes, 'Episodes count must not change')
    assert.equal(afterCounts.mediaSources, beforeCounts.mediaSources, 'Media sources count must not change')
    assert.equal(afterCounts.subtitleTracks, beforeCounts.subtitleTracks, 'Subtitle tracks count must not change')
    assert.equal(afterCounts.subtitleCues, beforeCounts.subtitleCues, 'Subtitle cues count must not change')
    assert.equal(afterCounts.subtitleTokens, beforeCounts.subtitleTokens, 'Subtitle tokens count must not change')
    assert.equal(afterCounts.playlists, beforeCounts.playlists, 'Playlists count must not change')
    assert.equal(afterCounts.playlistVideos, beforeCounts.playlistVideos, 'Playlist videos count must not change')

    // Only import runs increment
    assert.equal(afterCounts.importRuns, beforeCounts.importRuns + 1, 'Import runs count must increment by 1')
  })

  db.close()
})

test('4. Curation Protection (is_curated preserves manual edits)', async () => {
  const db = new DatabaseSync(':memory:')
  applyAnimeSchemaSQLite(db)

  const fixture = createValidDatasetFixture('curated')
  ingestAnimeDatasetSQLite(db, fixture, { runId: 'run-initial' })

  // Manually curate entities and update fields
  db.prepare(`
    UPDATE anime_series
    SET is_curated = 1, title_vi = 'Tên tiếng Việt đã được biên tập', description = 'Mô tả độc quyền'
    WHERE series_slug = 'test-show-curated'
  `).run()

  db.prepare(`
    UPDATE anime_episodes
    SET is_curated = 1, title = 'Tập 1 đặc biệt'
    WHERE series_slug = 'test-show-curated' AND episode_number = 1
  `).run()

  db.prepare(`
    UPDATE anime_subtitle_cues
    SET is_curated = 1, vi_text = 'Lời dịch phụ đề chuẩn người dịch'
    WHERE track_id = 'anime:subtrack:test-show-curated:1' AND cue_id = 1
  `).run()

  db.prepare(`
    UPDATE anime_playlists
    SET is_curated = 1, title = 'Danh sách phát chọn lọc'
    WHERE playlist_slug = 'test-playlist-curated'
  `).run()

  // Re-run ingestion with the original dataset (which has the old automated strings)
  ingestAnimeDatasetSQLite(db, fixture, { runId: 'run-reimport' })

  // Verify curated fields are protected and NOT overwritten
  const seriesRow = db.prepare('SELECT title_vi, description, is_curated FROM anime_series WHERE series_slug = ?')
    .get('test-show-curated')
  assert.equal(seriesRow.is_curated, 1)
  assert.equal(seriesRow.title_vi, 'Tên tiếng Việt đã được biên tập')
  assert.equal(seriesRow.description, 'Mô tả độc quyền')

  const episodeRow = db.prepare('SELECT title, is_curated FROM anime_episodes WHERE series_slug = ?')
    .get('test-show-curated')
  assert.equal(episodeRow.is_curated, 1)
  assert.equal(episodeRow.title, 'Tập 1 đặc biệt')

  const cueRow = db.prepare('SELECT vi_text, is_curated FROM anime_subtitle_cues WHERE track_id = ?')
    .get('anime:subtrack:test-show-curated:1')
  assert.equal(cueRow.is_curated, 1)
  assert.equal(cueRow.vi_text, 'Lời dịch phụ đề chuẩn người dịch')

  const playlistRow = db.prepare('SELECT title, is_curated FROM anime_playlists WHERE playlist_slug = ?')
    .get('test-playlist-curated')
  assert.equal(playlistRow.is_curated, 1)
  assert.equal(playlistRow.title, 'Danh sách phát chọn lọc')

  // Non-curated entity DOES update
  const uncuratedFixture = JSON.parse(JSON.stringify(fixture))
  uncuratedFixture.series[0].seasons[0].title_vi = 'Tên Season Mới Được Cập Nhật'
  ingestAnimeDatasetSQLite(db, uncuratedFixture, { runId: 'run-season-update' })

  const seasonRow = db.prepare('SELECT title_vi, is_curated FROM anime_seasons WHERE series_slug = ?')
    .get('test-show-curated')
  assert.equal(seasonRow.is_curated, 0)
  assert.equal(seasonRow.title_vi, 'Tên Season Mới Được Cập Nhật', 'Uncurated entities must update on new ingest')

  db.close()
})

test('5. Transaction Rollback & Zero Orphan Invariant', async (t) => {
  await t.test('validation failure rolls back before database changes', async () => {
    const db = new DatabaseSync(':memory:')
    applyAnimeSchemaSQLite(db)

    const invalidFixture = createValidDatasetFixture('invalid')
    // Break schema constraint: invalid JLPT
    invalidFixture.series[0].jlpt_level = 'N99'

    assert.throws(() => {
      ingestAnimeDatasetSQLite(db, invalidFixture)
    }, /Dataset validation failed/)

    const counts = await getAnimeTableCounts(db)
    for (const [table, count] of Object.entries(counts)) {
      assert.equal(count, 0, `Table ${table} must be 0 after validation failure`)
    }

    db.close()
  })

  await t.test('mid-transaction failure triggers full rollback leaving zero orphans', async () => {
    const db = new DatabaseSync(':memory:')
    applyAnimeSchemaSQLite(db)

    // Install trigger to raise an error during token insertion (simulating deep failure)
    db.exec(`
      CREATE TRIGGER force_token_abort
      BEFORE INSERT ON anime_subtitle_tokens
      BEGIN
        SELECT RAISE(FAIL, 'Simulated deep token insertion failure');
      END;
    `)

    const fixture = createValidDatasetFixture('abort-test')

    assert.throws(() => {
      ingestAnimeDatasetSQLite(db, fixture, { skipValidation: true })
    }, /Simulated deep token insertion failure/)

    // Verify atomic rollback: all 11 tables must be completely clean (0 rows)
    const counts = await getAnimeTableCounts(db)
    for (const [table, count] of Object.entries(counts)) {
      assert.equal(count, 0, `Table ${table} must have 0 rows after rollback (no orphans)`)
    }

    db.close()
  })
})

test('6. Foreign Key Cascade Cleanliness', async () => {
  const db = new DatabaseSync(':memory:')
  applyAnimeSchemaSQLite(db)

  const fixture = createValidDatasetFixture('cascade')
  ingestAnimeDatasetSQLite(db, fixture, { runId: 'run-cascade' })

  // Delete series
  db.prepare("DELETE FROM anime_series WHERE series_slug = 'test-show-cascade'").run()

  // Verify all cascaded children are automatically deleted
  const episodeCount = db.prepare('SELECT count(*) as c FROM anime_episodes').get().c
  const seasonCount = db.prepare('SELECT count(*) as c FROM anime_seasons').get().c
  const mediaCount = db.prepare('SELECT count(*) as c FROM anime_media_sources').get().c
  const trackCount = db.prepare('SELECT count(*) as c FROM anime_subtitle_tracks').get().c
  const cueCount = db.prepare('SELECT count(*) as c FROM anime_subtitle_cues').get().c
  const tokenCount = db.prepare('SELECT count(*) as c FROM anime_subtitle_tokens').get().c

  assert.equal(episodeCount, 0, 'Episodes must be cascaded')
  assert.equal(seasonCount, 0, 'Seasons must be cascaded')
  assert.equal(mediaCount, 0, 'Media sources must be cascaded')
  assert.equal(trackCount, 0, 'Subtitle tracks must be cascaded')
  assert.equal(cueCount, 0, 'Subtitle cues must be cascaded')
  assert.equal(tokenCount, 0, 'Subtitle tokens must be cascaded')

  db.close()
})

test('7. Index Query Plan Verification (EXPLAIN QUERY PLAN)', async (t) => {
  const db = new DatabaseSync(':memory:')
  applyAnimeSchemaSQLite(db)

  const fixture = createValidDatasetFixture('query-plan')
  ingestAnimeDatasetSQLite(db, fixture, { runId: 'run-qp' })

  await t.test('Catalog browse query uses anime_series_jlpt_category_idx', () => {
    const plans = db
      .prepare('EXPLAIN QUERY PLAN SELECT * FROM anime_series WHERE jlpt_level = ? AND category = ?')
      .all('N3', 'Anime')
    const detail = plans.map((p) => p.detail).join('; ')
    assert.match(detail, /USING INDEX anime_series_jlpt_category_idx/, `Plan must use jlpt category index: ${detail}`)
  })

  await t.test('Episode lookup uses anime_episodes_series_ep_idx', () => {
    const plans = db
      .prepare('EXPLAIN QUERY PLAN SELECT * FROM anime_episodes WHERE series_id = ? AND episode_number = ?')
      .all('series-query-plan', 1)
    const detail = plans.map((p) => p.detail).join('; ')
    assert.match(detail, /USING INDEX anime_episodes_series_ep_idx/, `Plan must use series episode index: ${detail}`)
  })

  await t.test('Subtitle cue time range lookup uses anime_subtitle_cues_ep_time_idx', () => {
    const plans = db
      .prepare('EXPLAIN QUERY PLAN SELECT * FROM anime_subtitle_cues WHERE episode_id = ? AND start_time <= ? AND end_time >= ?')
      .all('anime:episode:test-show-query-plan:test-show-query-plan:1', 2.0, 2.0)
    const detail = plans.map((p) => p.detail).join('; ')
    assert.match(detail, /USING INDEX anime_subtitle_cues_ep_time_idx/, `Plan must use cue ep time index: ${detail}`)
  })

  await t.test('Token dictionary lookup uses anime_subtitle_tokens_word_id_idx', () => {
    const plans = db
      .prepare('EXPLAIN QUERY PLAN SELECT * FROM anime_subtitle_tokens WHERE word_id = ?')
      .all(12345)
    const detail = plans.map((p) => p.detail).join('; ')
    assert.match(detail, /USING INDEX anime_subtitle_tokens_word_id_idx/, `Plan must use token word_id index: ${detail}`)
  })

  await t.test('Watch progress resume lookup uses anime_watch_progress_user_last_idx', () => {
    const plans = db
      .prepare('EXPLAIN QUERY PLAN SELECT * FROM anime_watch_progress WHERE user_id = ? ORDER BY last_watched_at DESC')
      .all('user-001')
    const detail = plans.map((p) => p.detail).join('; ')
    assert.match(detail, /USING INDEX anime_watch_progress_user_last_idx/, `Plan must use watch progress user last index: ${detail}`)
  })

  await t.test('Playlist lookup uses anime_playlists_slug_idx', () => {
    const plans = db
      .prepare('EXPLAIN QUERY PLAN SELECT * FROM anime_playlists WHERE playlist_slug = ?')
      .all('test-playlist-query-plan')
    const detail = plans.map((p) => p.detail).join('; ')
    assert.match(detail, /USING (COVERING )?INDEX (anime_playlists_slug_idx|sqlite_autoindex_anime_playlists_)/, `Plan must use slug index: ${detail}`)
  })

  db.close()
})

test('8. Safety Guard Blocks Neon / Production PG URL (URL Parsing, Uppercase & Subdomains)', async (t) => {
  await t.test('isForbiddenNeonHost detects neon.tech root in lowercase and uppercase', () => {
    assert.equal(isForbiddenNeonHost('postgresql://user:pass@neon.tech/db'), true)
    assert.equal(isForbiddenNeonHost('postgresql://USER:PASS@NEON.TECH/DB'), true)
    assert.equal(isForbiddenNeonHost('postgres://NEON.TECH:5432/neondb'), true)
  })

  await t.test('isForbiddenNeonHost detects all subdomains regardless of case or depth', () => {
    assert.equal(isForbiddenNeonHost('postgresql://user:pass@sub.neon.tech/db'), true)
    assert.equal(isForbiddenNeonHost('postgresql://user:pass@SUB.NEON.TECH/db'), true)
    assert.equal(isForbiddenNeonHost('postgresql://user:pass@ep-cool-fog.neon.tech/db'), true)
    assert.equal(isForbiddenNeonHost('postgresql://user:pass@EP-DIVINE-POND-123.US-EAST-2.AWS.NEON.TECH:5432/neondb'), true)
    assert.equal(isForbiddenNeonHost('postgres://EP-SECRET-01.AWS.NEON.TECH/neondb?sslmode=require'), true)
  })

  await t.test('isForbiddenNeonHost allows safe non-Neon hosts without false positives', () => {
    assert.equal(isForbiddenNeonHost('postgresql://localhost:5432/neondb'), false)
    assert.equal(isForbiddenNeonHost('postgresql://127.0.0.1:5432/neondb'), false)
    assert.equal(isForbiddenNeonHost('postgresql://user:pass@other-neon.tech.attacker.com/db'), false)
    assert.equal(isForbiddenNeonHost('postgresql://notneon.tech/db'), false)
    assert.equal(isForbiddenNeonHost('postgresql://internal-db.corp.local:5432/db'), false)
  })

  await t.test('runCLI immediately rejects uppercase Neon root domain without connecting', async () => {
    const uppercaseNeonUrl = 'postgresql://admin:secret@NEON.TECH/production'
    await assert.rejects(
      async () => {
        await runCLI(['--db', uppercaseNeonUrl])
      },
      (err) => {
        assert.match(err.message, /\[Safety Guard\] Direct ingest into Neon\/production database is forbidden in Task T03/)
        return true
      },
      'CLI must reject uppercase NEON.TECH URL before database connect'
    )
  })

  await t.test('runCLI immediately rejects uppercase Neon subdomain without connecting', async () => {
    const uppercaseSubdomainUrl = 'postgresql://admin:secret@EP-SHINY-POND-999.US-EAST-2.AWS.NEON.TECH:5432/neondb?sslmode=require'
    await assert.rejects(
      async () => {
        await runCLI(['--db', uppercaseSubdomainUrl])
      },
      (err) => {
        assert.match(err.message, /\[Safety Guard\] Direct ingest into Neon\/production database is forbidden in Task T03/)
        return true
      },
      'CLI must reject uppercase Neon subdomain URL before database connect'
    )
  })
})

test('9. Watch Progress User State Tracking', () => {
  const db = new DatabaseSync(':memory:')
  applyAnimeSchemaSQLite(db)

  const fixture = createValidDatasetFixture('watch')
  ingestAnimeDatasetSQLite(db, fixture, { runId: 'run-watch' })

  const epId = fixture.series[0].seasons[0].episodes[0].episode_id
  const now = new Date().toISOString()

  // 1. Initial watch progress
  db.prepare(`
    INSERT INTO anime_watch_progress (
      user_id, episode_id, last_playback_position, max_playback_position,
      duration, is_completed, playback_count, last_watched_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('user-test-01', epId, 45.5, 45.5, 1200.0, 0, 1, now, now, now)

  let row = db.prepare('SELECT * FROM anime_watch_progress WHERE user_id = ? AND episode_id = ?').get('user-test-01', epId)
  assert.equal(row.last_playback_position, 45.5)
  assert.equal(row.is_completed, 0)

  // 2. Upsert progress on further playback
  db.prepare(`
    INSERT INTO anime_watch_progress (
      user_id, episode_id, last_playback_position, max_playback_position,
      duration, is_completed, playback_count, last_watched_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, episode_id) DO UPDATE SET
      last_playback_position = excluded.last_playback_position,
      max_playback_position = MAX(anime_watch_progress.max_playback_position, excluded.max_playback_position),
      is_completed = CASE WHEN excluded.last_playback_position >= excluded.duration * 0.9 THEN 1 ELSE anime_watch_progress.is_completed END,
      playback_count = anime_watch_progress.playback_count + 1,
      last_watched_at = excluded.last_watched_at,
      updated_at = excluded.updated_at
  `).run('user-test-01', epId, 1150.0, 1150.0, 1200.0, 0, 1, now, now, now)

  row = db.prepare('SELECT * FROM anime_watch_progress WHERE user_id = ? AND episode_id = ?').get('user-test-01', epId)
  assert.equal(row.last_playback_position, 1150.0)
  assert.equal(row.is_completed, 1, 'Should mark completed when position >= 90% duration')
  assert.equal(row.playback_count, 2)

  db.close()
})
