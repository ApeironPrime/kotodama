import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import os from 'node:os'
import {
  validateSeries,
  validateSeason,
  validateEpisode,
  validateMediaSource,
  validateSubtitleTrack,
  validateSubtitleCue,
  validateSubtitleToken,
  validateSubtitleCompound,
  validatePlaylist,
  validatePlaylistVideo,
  validateDictionaryReference,
  validateImportRun,
  validateCanonicalDataset,
  normalizeText,
  normalizeSlug,
} from './canonical-schema.mjs'
import { importCanonicalDataset } from './import-canonical.mjs'

/**
 * Fixture builder for minimal valid Canonical Dataset
 */
function createValidDatasetFixture() {
  const episodeId = 'anime:episode:test-show:test-show:1'
  const mediaSource = {
    source_id: 'anime:media:' + episodeId,
    episode_id: episodeId,
    source_type: 'youtube',
    media_id: 'abc123xyz00',
    stream_url: null,
    page_url: 'https://www.youtube.com/watch?v=abc123xyz00',
    playback_allowed: true,
    rights_status: 'restricted',
  }

  const episode = {
    episode_id: episodeId,
    series_id: 'series-001',
    season_id: 'anime:season:test-show:test-show',
    series_slug: 'test-show',
    season_slug: 'test-show',
    episode_number: 1,
    title: 'Tập 1',
    has_subtitles: true,
    media_source: mediaSource,
  }

  const season = {
    season_id: 'anime:season:test-show:test-show',
    series_id: 'series-001',
    series_slug: 'test-show',
    season_slug: 'test-show',
    season_ordinal: 1,
    season_label: null,
    title_vi: 'Test Show',
    total_episodes: 1,
    episodes: [episode],
  }

  const series = {
    series_id: 'series-001',
    series_slug: 'test-show',
    master_slug: null,
    title_vi: 'Test Show',
    title_ja: 'テスト番組',
    description: 'A test show for canonical validation',
    poster_url: 'https://example.com/poster.jpg',
    category: 'Anime',
    jlpt_level: 'N3',
    channel: 'Test Channel',
    video_source: 'youtube',
    total_episodes: 1,
    rights_status: 'unknown',
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
    track_id: 'anime:subtrack:test-show:1',
    episode_id: episodeId,
    series_slug: 'test-show',
    episode_number: 1,
    languages: ['ja', 'vi'],
    cue_count: 1,
    token_count: 2,
    word_linked_token_count: 2,
    source_files: {
      json: 'subtitles/test-show/ep01.json',
      srt: 'subtitles/test-show/ep01.srt',
      vtt: 'subtitles/test-show/ep01.vtt',
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
    playlist_video_id: 'anime:plv:pl-001:vid-001',
    playlist_id: 'pl-001',
    playlist_slug: 'test-playlist',
    video_id: 'vid-001',
    title: 'Playlist Video 1',
    thumbnail_url: 'https://example.com/thumb.jpg',
    watch_url: null,
    youtube_url: 'https://www.youtube.com/watch?v=vid-001',
    ordinal: 1,
    playback_allowed: true,
    rights_status: 'restricted',
  }

  const playlist = {
    playlist_id: 'pl-001',
    playlist_slug: 'test-playlist',
    title: 'Test Playlist',
    channel: 'Test Channel',
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

test('1. Normalization utilities', () => {
  assert.equal(normalizeText('  Konnichiwa  \t\n  Sekai  '), 'Konnichiwa Sekai')
  assert.equal(normalizeSlug('  Đại-Chiến Titan (Phần 2)  '), 'dai-chien-titan-phan-2')
})

test('2. Nested Entity Validators', async (t) => {
  await t.test('validateSubtitleToken passes on valid token', () => {
    const validToken = { surface: 'テスト', char_start: 0, char_end: 3, word_id: 999 }
    const res = validateSubtitleToken(validToken)
    assert.equal(res.valid, true, res.errors.join('; '))
  })

  await t.test('validateSubtitleToken fails on invalid offsets', () => {
    const invalidToken = { surface: 'テスト', char_start: 3, char_end: 2, word_id: null }
    const res = validateSubtitleToken(invalidToken)
    assert.equal(res.valid, false)
    assert.match(res.errors[0], /token\.char_end must be greater than/)
  })

  await t.test('validateSubtitleCompound passes on valid compound and fails on invalid', () => {
    const validCompound = { surface: '世界', char_start: 0, char_end: 2, word_id: 12345 }
    assert.equal(validateSubtitleCompound(validCompound).valid, true)

    const invalidCompound = { surface: '世界', char_start: 5, char_end: 5, word_id: null }
    assert.equal(validateSubtitleCompound(invalidCompound).valid, false)
  })

  await t.test('validateSeries passes on valid series and fails on invalid JLPT', () => {
    const fixture = createValidDatasetFixture()
    const validSeries = fixture.series[0]
    assert.equal(validateSeries(validSeries).valid, true)

    const invalidSeries = { ...validSeries, jlpt_level: 'N99' }
    assert.equal(validateSeries(invalidSeries).valid, false)
  })

  await t.test('validateSeason passes on valid season and fails on invalid ordinal', () => {
    const fixture = createValidDatasetFixture()
    const validSeason = fixture.series[0].seasons[0]
    assert.equal(validateSeason(validSeason).valid, true)

    const invalidSeason = { ...validSeason, season_ordinal: 0 }
    assert.equal(validateSeason(invalidSeason).valid, false)
  })

  await t.test('validateEpisode passes on valid episode and fails on negative episode number', () => {
    const fixture = createValidDatasetFixture()
    const validEpisode = fixture.series[0].seasons[0].episodes[0]
    assert.equal(validateEpisode(validEpisode).valid, true)

    const invalidEpisode = { ...validEpisode, episode_number: -1 }
    assert.equal(validateEpisode(invalidEpisode).valid, false)
  })

  await t.test('validatePlaylistVideo passes on valid video and fails on zero ordinal', () => {
    const fixture = createValidDatasetFixture()
    const validVideo = fixture.playlists[0].videos[0]
    assert.equal(validatePlaylistVideo(validVideo).valid, true)

    const invalidVideo = { ...validVideo, ordinal: 0 }
    assert.equal(validatePlaylistVideo(invalidVideo).valid, false)
  })

  await t.test('validatePlaylistVideo fails on missing or empty playlist_slug', () => {
    const fixture = createValidDatasetFixture()
    const validVideo = fixture.playlists[0].videos[0]

    const badSlug1 = { ...validVideo, playlist_slug: undefined }
    assert.equal(validatePlaylistVideo(badSlug1).valid, false)

    const badSlug2 = { ...validVideo, playlist_slug: '   ' }
    assert.equal(validatePlaylistVideo(badSlug2).valid, false)
  })

  await t.test('validateSubtitleTrack passes on valid track with json, srt, vtt hashes', () => {
    const fixture = createValidDatasetFixture()
    const validTrack = fixture.subtitle_tracks[0]
    assert.equal(validateSubtitleTrack(validTrack).valid, true)
  })

  await t.test('validateSubtitleTrack fails on missing content_sha256 format or invalid hash length', () => {
    const fixture = createValidDatasetFixture()
    const baseTrack = fixture.subtitle_tracks[0]

    // Missing srt hash
    const badTrack1 = JSON.parse(JSON.stringify(baseTrack))
    delete badTrack1.content_sha256.srt
    const res1 = validateSubtitleTrack(badTrack1)
    assert.equal(res1.valid, false)
    assert.ok(res1.errors.some((e) => e.includes('content_sha256.srt must be a 64-char hex SHA-256 string')))

    // Missing vtt hash
    const badTrack2 = JSON.parse(JSON.stringify(baseTrack))
    delete badTrack2.content_sha256.vtt
    const res2 = validateSubtitleTrack(badTrack2)
    assert.equal(res2.valid, false)
    assert.ok(res2.errors.some((e) => e.includes('content_sha256.vtt must be a 64-char hex SHA-256 string')))

    // Missing json hash
    const badTrack3 = JSON.parse(JSON.stringify(baseTrack))
    delete badTrack3.content_sha256.json
    const res3 = validateSubtitleTrack(badTrack3)
    assert.equal(res3.valid, false)
    assert.ok(res3.errors.some((e) => e.includes('content_sha256.json must be a 64-char hex SHA-256 string')))

    // Invalid hash format (not 64 chars hex)
    const badTrack4 = JSON.parse(JSON.stringify(baseTrack))
    badTrack4.content_sha256.srt = 'not-a-valid-sha256'
    const res4 = validateSubtitleTrack(badTrack4)
    assert.equal(res4.valid, false)
    assert.ok(res4.errors.some((e) => e.includes('content_sha256.srt must be a 64-char hex SHA-256 string')))
  })

  await t.test('validateSubtitleCue fails when end <= start', () => {
    const invalidCue = {
      id: 1,
      start: 5.0,
      end: 5.0,
      ja: 'テスト',
      vi: 'Test',
      tokens: [],
    }
    const res = validateSubtitleCue(invalidCue)
    assert.equal(res.valid, false)
    assert.match(res.errors[0], /cue\.end must be greater than cue\.start/)
  })

  await t.test('validateSubtitleCue fails when start is negative', () => {
    const invalidCue = {
      id: 1,
      start: -1.0,
      end: 2.0,
      ja: 'テスト',
      vi: 'Test',
      tokens: [],
    }
    const res = validateSubtitleCue(invalidCue)
    assert.equal(res.valid, false)
    assert.match(res.errors[0], /cue\.start must be a non-negative number/)
  })

  await t.test('validateMediaSource enforces stream_url === null', () => {
    const badSource = {
      source_id: 'src-1',
      episode_id: 'ep-1',
      source_type: 'youtube',
      media_id: 'yt123',
      stream_url: 'https://example.com/video.mp4',
      page_url: 'https://youtube.com/watch?v=yt123',
      playback_allowed: true,
      rights_status: 'restricted',
    }
    const res = validateMediaSource(badSource)
    assert.equal(res.valid, false)
    assert.match(res.errors[0], /stream_url must be null/)
  })

  await t.test('validateMediaSource prevents external_page from having playback_allowed: true', () => {
    const badSource = {
      source_id: 'src-1',
      episode_id: 'ep-1',
      source_type: 'external_page',
      media_id: null,
      stream_url: null,
      page_url: 'https://archive.org/details/test',
      playback_allowed: true, // ILLEGAL
      rights_status: 'restricted',
    }
    const res = validateMediaSource(badSource)
    assert.equal(res.valid, false)
    assert.match(res.errors.join('; '), /playback_allowed/)
  })

  await t.test('validateMediaSource prevents auto-promoting scraped source to approved', () => {
    const badSource = {
      source_id: 'src-1',
      episode_id: 'ep-1',
      source_type: 'youtube',
      media_id: 'yt123',
      stream_url: null,
      page_url: 'https://youtube.com/watch?v=yt123',
      playback_allowed: true,
      rights_status: 'approved', // ILLEGAL auto-promotion
    }
    const res = validateMediaSource(badSource)
    assert.equal(res.valid, false)
    assert.match(res.errors[0], /rights_status cannot be 'approved'/)
  })
})

test('3. Referential Integrity Enforcement', async (t) => {
  await t.test('rejects subtitle track referencing non-existent episode_id', () => {
    const dataset = createValidDatasetFixture()
    dataset.subtitle_tracks[0].episode_id = 'anime:episode:non-existent:1'

    const res = validateCanonicalDataset(dataset)
    assert.equal(res.valid, false)
    assert.ok(res.errors.some((e) => e.includes('references non-existent episode_id')))
  })

  await t.test('rejects episode with mismatched series_id', () => {
    const dataset = createValidDatasetFixture()
    dataset.series[0].seasons[0].episodes[0].series_id = 'different-series-id'
    const res = validateCanonicalDataset(dataset)
    assert.equal(res.valid, false)
    assert.ok(res.errors.some((e) => e.includes('mismatch with parent series')))
  })

  await t.test('rejects playlist video with mismatched playlist_id', () => {
    const dataset = createValidDatasetFixture()
    dataset.playlists[0].videos[0].playlist_id = 'different-pl-id'
    const res = validateCanonicalDataset(dataset)
    assert.equal(res.valid, false)
    assert.ok(res.errors.some((e) => e.includes('mismatch with parent playlist')))
  })

  await t.test('rejects playlist video with mismatched playlist_slug', () => {
    const dataset = createValidDatasetFixture()
    dataset.playlists[0].videos[0].playlist_slug = 'different-pl-slug'
    const res = validateCanonicalDataset(dataset)
    assert.equal(res.valid, false)
    assert.ok(res.errors.some((e) => e.includes("playlist_slug 'different-pl-slug' mismatch with parent playlist 'test-playlist'")))
  })
})

test('4. Count Reconciliation Constraints & Mutations', async (t) => {
  await t.test('rejects import_run.total_seasons mismatch', () => {
    const dataset = createValidDatasetFixture()
    dataset.import_run.total_seasons = 999
    const res = validateCanonicalDataset(dataset)
    assert.equal(res.valid, false)
    assert.ok(res.errors.some((e) => e.includes('import_run.total_seasons (999) does not match totalSeasonsCount (1)')))
  })

  await t.test('rejects import_run.media_sources_by_type.youtube count mismatch', () => {
    const dataset = createValidDatasetFixture()
    dataset.import_run.media_sources_by_type.youtube = 999
    const res = validateCanonicalDataset(dataset)
    assert.equal(res.valid, false)
    assert.ok(res.errors.some((e) => e.includes('import_run.media_sources_by_type.youtube (999) does not match actual count (1)')))
  })

  await t.test('rejects import_run.media_sources_by_type.external_page count mismatch', () => {
    const dataset = createValidDatasetFixture()
    dataset.import_run.media_sources_by_type.external_page = 999
    const res = validateCanonicalDataset(dataset)
    assert.equal(res.valid, false)
    assert.ok(res.errors.some((e) => e.includes('import_run.media_sources_by_type.external_page (999) does not match actual count (0)')))
  })

  await t.test('rejects import_run.media_sources_by_type.authorized_local count mismatch', () => {
    const dataset = createValidDatasetFixture()
    dataset.import_run.media_sources_by_type.authorized_local = 999
    const res = validateCanonicalDataset(dataset)
    assert.equal(res.valid, false)
    assert.ok(res.errors.some((e) => e.includes('import_run.media_sources_by_type.authorized_local (999) does not match actual count (0)')))
  })

  await t.test('rejects import_run.media_sources_by_type.unavailable count mismatch', () => {
    const dataset = createValidDatasetFixture()
    dataset.import_run.media_sources_by_type.unavailable = 999
    const res = validateCanonicalDataset(dataset)
    assert.equal(res.valid, false)
    assert.ok(res.errors.some((e) => e.includes('import_run.media_sources_by_type.unavailable (999) does not match actual count (0)')))
  })
})

test('5. Uniqueness Constraints', async (t) => {
  await t.test('rejects duplicate series_id', () => {
    const dataset = createValidDatasetFixture()
    const clonedSeries = JSON.parse(JSON.stringify(dataset.series[0]))
    clonedSeries.series_slug = 'another-slug'
    dataset.series.push(clonedSeries)
    const res = validateCanonicalDataset(dataset)
    assert.equal(res.valid, false)
    assert.ok(res.errors.some((e) => e.includes('duplicate series_id')))
  })

  await t.test('rejects duplicate series_slug', () => {
    const dataset = createValidDatasetFixture()
    const clonedSeries = JSON.parse(JSON.stringify(dataset.series[0]))
    clonedSeries.series_id = 'different-id'
    dataset.series.push(clonedSeries)
    const res = validateCanonicalDataset(dataset)
    assert.equal(res.valid, false)
    assert.ok(res.errors.some((e) => e.includes('duplicate series_slug')))
  })

  await t.test('rejects duplicate cue.id in same subtitle track', () => {
    const dataset = createValidDatasetFixture()
    const cueClone = JSON.parse(JSON.stringify(dataset.subtitle_tracks[0].cues[0]))
    cueClone.start = 5.0
    cueClone.end = 7.0
    dataset.subtitle_tracks[0].cues.push(cueClone)
    dataset.subtitle_tracks[0].cue_count = 2
    const res = validateSubtitleTrack(dataset.subtitle_tracks[0])
    assert.equal(res.valid, false)
    assert.ok(res.errors.some((e) => e.includes('duplicate cue.id')))
  })

  await t.test('rejects duplicate video_id in same playlist', () => {
    const dataset = createValidDatasetFixture()
    const videoClone = JSON.parse(JSON.stringify(dataset.playlists[0].videos[0]))
    videoClone.ordinal = 2
    dataset.playlists[0].videos.push(videoClone)
    dataset.playlists[0].video_count = 2
    const res = validatePlaylist(dataset.playlists[0])
    assert.equal(res.valid, false)
    assert.ok(res.errors.some((e) => e.includes('duplicate video_id')))
  })
})

test('6. Dictionary Reference Constraints', async (t) => {
  await t.test('rejects embedded monolith in dictionary_reference', () => {
    const dictRef = {
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
      monolith_embedded: true, // ILLEGAL
    }
    const res = validateDictionaryReference(dictRef)
    assert.equal(res.valid, false)
    assert.match(res.errors[0], /Monolith dictionary_full\.json must NEVER be embedded/)
  })

  await t.test('rejects incorrect shard formula % 100', () => {
    const dictRef = {
      total_words: 59224,
      total_indexed_entries: 39516,
      indexed_words_count: 39516,
      total_shards: 666,
      shard_formula: 'word_id % 100', // INCORRECT
      shard_naming_pattern: 'shard-{NNN}.json',
      total_word_index_keys: 59225,
      unreferenced_word_index_ids_count: 19708,
      homophone_collision_id: 3144121485,
      homophone_words: ['アニソン', '柔道家'],
      rights_status: 'unknown',
    }
    const res = validateDictionaryReference(dictRef)
    assert.equal(res.valid, false)
    assert.match(res.errors[0], /shard_formula must be 'word_id % 1000'/)
  })
})

test('7. Determinism & No Runtime Timestamp Invariant', () => {
  const dataset = createValidDatasetFixture()
  // Ensure import_run does not allow runtime timestamp
  dataset.import_run.imported_at = '2026-09-11T20:00:00Z'
  const res = validateImportRun(dataset.import_run)
  assert.equal(res.valid, false)
  assert.match(res.errors[0], /Runtime timestamps must NOT be included in canonical dataset JSON/)
})

test('8. Provenance & Manifest Integrity', async (t) => {
  await t.test('rejects when manifest file does not exist', () => {
    assert.throws(
      () => importCanonicalDataset({ manifestPath: 'non/existent/manifest.json' }),
      /Source manifest file not found/
    )
  })

  await t.test('rejects when manifest sourceRoot does not match target sourceRoot', () => {
    const badManifest = {
      sourceRoot: 'D:/Other/Path',
      overallManifestHash: 'a'.repeat(64),
    }
    assert.throws(
      () => importCanonicalDataset({ sourceRoot: 'D:/Project/data/aanime_scraper', manifest: badManifest }),
      /Source manifest sourceRoot mismatch/
    )
  })

  await t.test('rejects when manifest overallManifestHash is missing or invalid', () => {
    const badManifest = {
      sourceRoot: 'D:/Project/data/aanime_scraper',
      overallManifestHash: 'invalid-hash',
    }
    assert.throws(
      () => importCanonicalDataset({ sourceRoot: 'D:/Project/data/aanime_scraper', manifest: badManifest }),
      /Source manifest has missing or invalid overallManifestHash/
    )
  })

  // Helper to construct self-contained fixture with subtitles
  function setupMockSourceWithSubs(tmpDir) {
    const sourceRoot = path.join(tmpDir, 'source')
    fs.mkdirSync(path.join(sourceRoot, 'subtitles/mock-series'), { recursive: true })

    const allData = {
      series: [
        {
          id: 'mock-s1',
          slug: 'mock-series',
          title_vi: 'Mock Series',
          title_ja: 'モック',
          total_episodes: 1,
          all_episodes: [{ id: 1, ep_number: 1, title: 'Ep 1', watch_url: 'https://youtube.com/watch?v=mock123' }],
        },
      ],
      playlists: [
        {
          id: 'mock-pl1',
          slug: 'mock-playlist',
          title: 'Mock Playlist',
          videos: [{ video_id: 'mock123', title: 'Ep 1', ordinal: 1 }],
        },
      ],
    }
    const allDataContent = JSON.stringify(allData)
    fs.writeFileSync(path.join(sourceRoot, 'all_data.json'), allDataContent, 'utf8')

    const subJsonContent = JSON.stringify({
      cues: [
        {
          id: 1,
          start: 1.0,
          end: 3.0,
          ja: 'テスト',
          vi: 'Test',
          tokens: [{ surface: 'テスト', char_start: 0, char_end: 3, word_id: null }],
        },
      ],
    })
    const subSrtContent = '1\n00:00:01,000 --> 00:00:03,000\nテスト\n'
    const subVttContent = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nテスト\n'

    fs.writeFileSync(path.join(sourceRoot, 'subtitles/mock-series/ep01.json'), subJsonContent, 'utf8')
    fs.writeFileSync(path.join(sourceRoot, 'subtitles/mock-series/ep01.srt'), subSrtContent, 'utf8')
    fs.writeFileSync(path.join(sourceRoot, 'subtitles/mock-series/ep01.vtt'), subVttContent, 'utf8')

    const relFiles = ['all_data.json', 'subtitles/mock-series/ep01.json', 'subtitles/mock-series/ep01.srt', 'subtitles/mock-series/ep01.vtt']
    relFiles.sort((a, b) => a.localeCompare(b, 'en'))

    const files = {}
    const manifestHasher = crypto.createHash('sha256')
    for (const f of relFiles) {
      const full = path.join(sourceRoot, f)
      const raw = fs.readFileSync(full)
      const hash = crypto.createHash('sha256').update(raw).digest('hex')
      const size = Buffer.byteLength(raw)
      files[f] = { sha256: hash, sizeBytes: size }
      manifestHasher.update(`${f}:${hash}:${size}\n`, 'utf8')
    }

    const manifest = {
      sourceRoot,
      overallManifestHash: manifestHasher.digest('hex'),
      totalFiles: relFiles.length,
      files,
    }

    return { sourceRoot, manifest }
  }

  await t.test('rejects when a file hash in manifest does not match file on disk', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anime-bad-hash-'))
    try {
      const { sourceRoot, manifest } = setupMockSourceWithSubs(tmpDir)
      manifest.files['all_data.json'].sha256 = '0'.repeat(64)

      assert.throws(
        () => importCanonicalDataset({ sourceRoot, manifest }),
        /Source manifest verification failed: file 'all_data\.json' hash mismatch/
      )
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  await t.test('dynamically accepts custom fixture manifest with different hash without hardcoding', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anime-prov-test-'))
    const mockOutDir = path.join(tmpDir, 'out')
    try {
      const { sourceRoot, manifest } = setupMockSourceWithSubs(tmpDir)

      const res = importCanonicalDataset({
        sourceRoot,
        outputDir: mockOutDir,
        manifest,
      })

      assert.equal(res.dataset.import_run.source_manifest_hash, manifest.overallManifestHash)
      assert.equal(res.reportData.source_manifest_hash, manifest.overallManifestHash)
      assert.notEqual(res.dataset.import_run.source_manifest_hash, '6ddaf0bf0adf0a8d2fdb2cd57767e14295e4d8f0a1d3f547f788bb786d1f7d0f')
      assert.ok(fs.existsSync(path.join(mockOutDir, 'canonical-dataset.json')))
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  await t.test('rejects and writes no output when subtitle JSON is mutated after manifest generation', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anime-mut-json-'))
    const mockOutDir = path.join(tmpDir, 'out')
    try {
      const { sourceRoot, manifest } = setupMockSourceWithSubs(tmpDir)
      // Mutate subtitle JSON file on disk
      fs.appendFileSync(path.join(sourceRoot, 'subtitles/mock-series/ep01.json'), '   ')

      assert.throws(
        () => importCanonicalDataset({ sourceRoot, outputDir: mockOutDir, manifest }),
        /Source manifest verification failed: file 'subtitles\/mock-series\/ep01\.json' (hash|size) mismatch/
      )
      // Verify nothing was written to output directory
      assert.equal(fs.existsSync(path.join(mockOutDir, 'canonical-dataset.json')), false)
      assert.equal(fs.existsSync(path.join(mockOutDir, 'import-report.json')), false)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  await t.test('rejects and writes no output when subtitle SRT is mutated after manifest generation', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anime-mut-srt-'))
    const mockOutDir = path.join(tmpDir, 'out')
    try {
      const { sourceRoot, manifest } = setupMockSourceWithSubs(tmpDir)
      // Mutate subtitle SRT file on disk
      fs.writeFileSync(path.join(sourceRoot, 'subtitles/mock-series/ep01.srt'), 'Corrupted SRT')

      assert.throws(
        () => importCanonicalDataset({ sourceRoot, outputDir: mockOutDir, manifest }),
        /Source manifest verification failed: file 'subtitles\/mock-series\/ep01\.srt' hash mismatch/
      )
      assert.equal(fs.existsSync(path.join(mockOutDir, 'canonical-dataset.json')), false)
      assert.equal(fs.existsSync(path.join(mockOutDir, 'import-report.json')), false)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  await t.test('rejects and writes no output when subtitle VTT is mutated after manifest generation', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anime-mut-vtt-'))
    const mockOutDir = path.join(tmpDir, 'out')
    try {
      const { sourceRoot, manifest } = setupMockSourceWithSubs(tmpDir)
      // Mutate subtitle VTT file on disk
      fs.writeFileSync(path.join(sourceRoot, 'subtitles/mock-series/ep01.vtt'), 'Corrupted VTT')

      assert.throws(
        () => importCanonicalDataset({ sourceRoot, outputDir: mockOutDir, manifest }),
        /Source manifest verification failed: file 'subtitles\/mock-series\/ep01\.vtt' hash mismatch/
      )
      assert.equal(fs.existsSync(path.join(mockOutDir, 'canonical-dataset.json')), false)
      assert.equal(fs.existsSync(path.join(mockOutDir, 'import-report.json')), false)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  await t.test('rejects and writes no output when extra unmanifested file exists on disk', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anime-extra-file-'))
    const mockOutDir = path.join(tmpDir, 'out')
    try {
      const { sourceRoot, manifest } = setupMockSourceWithSubs(tmpDir)
      // Create extra unmanifested file on disk
      fs.writeFileSync(path.join(sourceRoot, 'unexpected_rogue_file.txt'), 'extra')

      assert.throws(
        () => importCanonicalDataset({ sourceRoot, outputDir: mockOutDir, manifest }),
        /Source manifest verification failed: detected 1 extra file\(s\) on disk/
      )
      assert.equal(fs.existsSync(path.join(mockOutDir, 'canonical-dataset.json')), false)
      assert.equal(fs.existsSync(path.join(mockOutDir, 'import-report.json')), false)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  await t.test('rejects and writes no output when file listed in manifest is missing on disk', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anime-missing-file-'))
    const mockOutDir = path.join(tmpDir, 'out')
    try {
      const { sourceRoot, manifest } = setupMockSourceWithSubs(tmpDir)
      // Remove an expected subtitle file from disk
      fs.unlinkSync(path.join(sourceRoot, 'subtitles/mock-series/ep01.vtt'))

      assert.throws(
        () => importCanonicalDataset({ sourceRoot, outputDir: mockOutDir, manifest }),
        /Source manifest verification failed: detected 1 missing file\(s\) on disk/
      )
      assert.equal(fs.existsSync(path.join(mockOutDir, 'canonical-dataset.json')), false)
      assert.equal(fs.existsSync(path.join(mockOutDir, 'import-report.json')), false)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  await t.test('rejects and writes no output when overallManifestHash does not match recomputed hash', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anime-hash-mismatch-'))
    const mockOutDir = path.join(tmpDir, 'out')
    try {
      const { sourceRoot, manifest } = setupMockSourceWithSubs(tmpDir)
      // Forged overall hash
      manifest.overallManifestHash = '0'.repeat(64)

      assert.throws(
        () => importCanonicalDataset({ sourceRoot, outputDir: mockOutDir, manifest }),
        /recomputed overallManifestHash '.*' does not match manifest\.overallManifestHash/
      )
      assert.equal(fs.existsSync(path.join(mockOutDir, 'canonical-dataset.json')), false)
      assert.equal(fs.existsSync(path.join(mockOutDir, 'import-report.json')), false)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})

test('9. Real Canonical Dataset Validation (tmp/anime/canonical-dataset.json)', () => {
  const datasetPath = path.resolve('tmp/anime/canonical-dataset.json')
  if (!fs.existsSync(datasetPath)) {
    console.log('Skipping real dataset test: tmp/anime/canonical-dataset.json not generated yet')
    return
  }

  const raw = fs.readFileSync(datasetPath, 'utf8')
  const dataset = JSON.parse(raw)

  const validation = validateCanonicalDataset(dataset)
  assert.equal(validation.valid, true, `Validation errors:\n${validation.errors.join('\n')}`)
  assert.equal(validation.errors.length, 0)

  // Verify core metric assertions
  assert.equal(dataset.import_run.source_manifest_hash, '6ddaf0bf0adf0a8d2fdb2cd57767e14295e4d8f0a1d3f547f788bb786d1f7d0f')
  assert.equal(dataset.import_run.total_series, 143)
  assert.equal(dataset.import_run.total_seasons, 183)
  assert.equal(dataset.import_run.total_episodes, 2528)
  assert.equal(dataset.import_run.total_media_sources, 2528)
  assert.equal(dataset.import_run.media_sources_by_type.youtube, 2298)
  assert.equal(dataset.import_run.media_sources_by_type.external_page, 230)
  assert.equal(dataset.import_run.media_sources_by_type.authorized_local, 0)
  assert.equal(dataset.import_run.media_sources_by_type.unavailable, 0)
  assert.equal(dataset.import_run.total_subtitle_tracks, 1384)
  assert.equal(dataset.import_run.total_cues, 528401)
  assert.equal(dataset.import_run.total_tokens, 4499110)
  assert.equal(dataset.import_run.total_playlists, 128)
  assert.equal(dataset.import_run.total_playlist_videos, 1596)
  assert.equal(dataset.import_run.unique_playlist_youtube_ids, 1277)
  assert.equal(dataset.import_run.error_count, 1)

  // Verify rejected cue details
  const rejectedCue = dataset.import_run.reject_list[0]
  assert.equal(rejectedCue.file, 'subtitles/smartphone-va-nhung-nguoi-ban/ep10.json')
  assert.equal(rejectedCue.cue_id, 1)
  assert.equal(rejectedCue.start, 0)
  assert.equal(rejectedCue.end, 0)

  // Verify dictionary reference
  assert.equal(dataset.dictionary_reference.total_shards, 666)
  assert.equal(dataset.dictionary_reference.shard_formula, 'word_id % 1000')
  assert.equal(dataset.dictionary_reference.indexed_words_count, 39516)
  assert.equal(dataset.dictionary_reference.homophone_collision_id, 3144121485)

  // Verify repeated SHA-256 computation
  const sha = crypto.createHash('sha256').update(raw).digest('hex')
  assert.equal(sha, '83afe416b88a1f04b2962e4a79a84f4c37d6a723768da907655f7c77972c342a')
})
