import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  parseCSV,
  serializeCSV,
  hashContent,
  hashFile,
  walkFilesDeterministic,
  auditSourceDirectory,
  reconcileSeriesTwoWay,
  reconcileEpisodesCsvTwoWay,
  reconcileMasterMetadata,
  reconcilePlaylists,
  reconcileDictionaryTwoWay,
  deepAnalyzeSubtitles,
  verifyDictionarySharding,
  buildSourceManifest,
  buildProvenanceCsv,
} from './audit-source.mjs'

describe('1. CSV Parser & Serializer (RFC 4180) with BOM Handling', () => {
  it('strips UTF-8 BOM from header line', () => {
    const csvWithBOM = '\uFEFFID,Slug,Tiêu đề\n1,naruto,Naruto\n'
    const rows = parseCSV(csvWithBOM)
    assert.equal(rows.length, 2)
    assert.equal(rows[0][0], 'ID')
    assert.equal(rows[0][1], 'Slug')
    assert.equal(rows[1][1], 'naruto')
  })

  it('parses and serializes simple and quoted CSV correctly', () => {
    const csv = 'id,name,desc\n1,"Hello, world","Line 1\nLine 2"\n2,Simple,Clean\n'
    const rows = parseCSV(csv)
    assert.equal(rows.length, 3)
    assert.equal(rows[0][0], 'id')
    assert.equal(rows[1][1], 'Hello, world')
    assert.equal(rows[1][2], 'Line 1\nLine 2')
    assert.equal(rows[2][1], 'Simple')

    const serialized = serializeCSV(rows)
    const reparsed = parseCSV(serialized)
    assert.deepEqual(reparsed, rows)
  })

  it('handles escaped quotes within fields', () => {
    const csv = 'id,quote\n1,"He said ""Run!"""\n'
    const rows = parseCSV(csv)
    assert.equal(rows.length, 2)
    assert.equal(rows[1][1], 'He said "Run!"')
  })
})

describe('2. Cryptographic Hashing & Deterministic Traversal', () => {
  it('hashContent produces valid SHA-256', () => {
    const hash = hashContent('test-kotodama-anime')
    assert.equal(typeof hash, 'string')
    assert.equal(hash.length, 64)
  })

  it('hashFile calculates exact bytes and SHA-256 for a temporary file', async () => {
    const tmpFile = path.join(os.tmpdir(), `kotodama-test-${Date.now()}.txt`)
    fs.writeFileSync(tmpFile, 'anime-stream-content', 'utf8')
    try {
      const res = await hashFile(tmpFile)
      assert.equal(res.sizeBytes, Buffer.byteLength('anime-stream-content', 'utf8'))
      assert.equal(res.sha256, hashContent('anime-stream-content'))
    } finally {
      fs.unlinkSync(tmpFile)
    }
  })

  it('walkFilesDeterministic returns sorted POSIX paths regardless of OS filesystem order', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kotodama-walk-'))
    try {
      fs.mkdirSync(path.join(tmpDir, 'b_dir'))
      fs.mkdirSync(path.join(tmpDir, 'a_dir'))
      fs.writeFileSync(path.join(tmpDir, 'b_dir', 'z.json'), '{}')
      fs.writeFileSync(path.join(tmpDir, 'b_dir', 'a.json'), '{}')
      fs.writeFileSync(path.join(tmpDir, 'a_dir', 'm.json'), '{}')
      fs.writeFileSync(path.join(tmpDir, 'root.txt'), 'hello')

      const files = walkFilesDeterministic(tmpDir)
      assert.deepEqual(files, [
        'a_dir/m.json',
        'b_dir/a.json',
        'b_dir/z.json',
        'root.txt',
      ])
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('auditSourceDirectory generates identical overallManifestHash across repeated runs (deterministic)', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kotodama-audit-'))
    try {
      fs.writeFileSync(path.join(tmpDir, 'data.json'), '{"key":"val"}')
      fs.writeFileSync(path.join(tmpDir, 'ep01.srt'), '1\n00:00:01,000 --> 00:00:02,000\nHi')

      const run1 = await auditSourceDirectory(tmpDir)
      const run2 = await auditSourceDirectory(tmpDir)

      assert.equal(run1.overallManifestHash, run2.overallManifestHash)
      assert.equal(run1.totalFiles, 2)
      assert.equal(run1.totalBytes, run2.totalBytes)

      const manifest = buildSourceManifest(run1)
      assert.equal(typeof manifest.overallManifestHash, 'string')
      assert.equal((manifest).auditTimestamp, undefined)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})

describe('3. Series Two-Way Reconciliation (all_data ↔ series.json)', () => {
  it('detects two-way missing series and duplicate IDs/slugs', () => {
    const allDataSeries = [
      { id: 'uuid-1', slug: 'naruto', all_episodes: [] },
      { id: 'uuid-2', slug: 'naruto', all_episodes: [] }, // duplicate slug
      { id: 'uuid-3', slug: 'bleach', all_episodes: [] }, // in all_data but not series.json
    ]
    const seriesJson = [
      { id: 'uuid-1', slug: 'naruto', all_episodes: [] },
      { id: 'uuid-4', slug: 'one-piece', all_episodes: [] }, // in series.json but not all_data
    ]

    const res = reconcileSeriesTwoWay(allDataSeries, seriesJson)
    assert.deepEqual(res.duplicateSlugsInAllData, ['naruto'])
    assert.deepEqual(res.inAllDataNotSeriesJsonById, ['uuid-2', 'uuid-3'])
    assert.deepEqual(res.inSeriesJsonNotAllDataById, ['uuid-4'])
  })

  it('detects core field and episode key / source mismatches between all_data and series.json', () => {
    const allDataSeries = [
      {
        id: 'uuid-1',
        slug: 'aot',
        title_vi: 'Đại Chiến Titan',
        video_source: 'youtube',
        total_episodes: 25,
        all_episodes: [
          { season_slug: 's1', ep_number: 1, youtube_video_id: 'yt-1', watch_url: 'https://akaiwa.tv/1' },
          { season_slug: 's1', ep_number: 2, youtube_video_id: 'yt-2-json', watch_url: 'https://akaiwa.tv/2' },
        ],
      },
    ]
    const seriesJson = [
      {
        id: 'uuid-1',
        slug: 'aot',
        title_vi: 'Đại Chiến Titan',
        video_source: 'archive', // field mismatch: youtube vs archive
        total_episodes: 25,
        all_episodes: [
          { season_slug: 's1', ep_number: 1, youtube_video_id: 'yt-1', watch_url: 'https://akaiwa.tv/1' },
          { season_slug: 's1', ep_number: 2, youtube_video_id: 'yt-2-diff', watch_url: 'https://akaiwa.tv/2-diff' }, // source mismatch
        ],
      },
    ]

    const res = reconcileSeriesTwoWay(allDataSeries, seriesJson)
    assert.equal(res.coreFieldMismatches.length, 1)
    assert.equal(res.coreFieldMismatches[0].field, 'video_source')
    assert.equal(res.episodeSourceMismatches.length, 1)
    assert.equal(res.episodeSourceMismatches[0].episodeIndex, 1)
  })

  it('detects multi-season episode count anomalies with series.csv', () => {
    const allData = {
      series: [
        {
          id: 'uuid-aot-1',
          slug: 'aot-s1',
          title_vi: 'Attack on Titan 1',
          total_episodes: 25,
          all_episodes: Array(75).fill({ ep_number: 1 }),
        },
      ],
    }
    const seriesCsvRows = [
      ['ID', 'Slug', 'Tiêu đề tiếng Việt', 'Số tập'],
      ['uuid-aot-1', 'aot-s1', 'Attack on Titan 1', '25'],
    ]
    const recon = reconcileMasterMetadata(allData, allData.series, seriesCsvRows)
    assert.equal(recon.episodeCountAnomalies.length, 1)
    assert.equal(recon.episodeCountAnomalies[0].slug, 'aot-s1')
  })
})

describe('4. Episodes CSV Two-Way Reconciliation & Mutation', () => {
  it('detects duplicate keys in episodes.csv without losing count', () => {
    const allDataSeries = [
      {
        id: 'uuid-1',
        slug: 'series-1',
        all_episodes: [{ season_slug: 's1', ep_number: 1, youtube_video_id: 'yt-1', watch_url: 'https://akaiwa.tv/1' }],
      },
    ]
    const episodesCsvRows = [
      ['Series ID', 'Series Slug', 'Tiêu đề Series', 'Mùa (Season)', 'Số tập', 'Tiêu đề tập', 'YouTube Video ID', 'YouTube URL', 'Link xem'],
      ['uuid-1', 'series-1', 'Series 1', 's1', '1', 'Tập 1', 'yt-1', '', 'https://akaiwa.tv/1'],
      ['uuid-1', 'series-1', 'Series 1', 's1', '1', 'Tập 1 Duplicate', 'yt-1', '', 'https://akaiwa.tv/1'], // duplicate key
    ]

    const res = reconcileEpisodesCsvTwoWay(allDataSeries, episodesCsvRows)
    assert.equal(res.csvDuplicateKeys.length, 1)
    assert.equal(res.csvDuplicateKeys[0].key, 'series-1:s1:1')
    assert.equal(res.csvDuplicateKeys[0].count, 2)
  })

  it('detects two-way missing, extra rows, and mismatches in youtube_video_id and watch_url', () => {
    const allDataSeries = [
      {
        id: 'uuid-1',
        slug: 'series-1',
        all_episodes: [
          { season_slug: 's1', ep_number: 1, youtube_video_id: 'yt-1', watch_url: 'https://akaiwa.tv/1' },
          { season_slug: 's1', ep_number: 2, youtube_video_id: 'yt-2-json', watch_url: 'https://akaiwa.tv/2-json' },
          { season_slug: 's1', ep_number: 3, youtube_video_id: 'yt-3', watch_url: 'https://akaiwa.tv/3' }, // missing in CSV
        ],
      },
    ]
    const episodesCsvRows = [
      ['Series ID', 'Series Slug', 'Tiêu đề Series', 'Mùa (Season)', 'Số tập', 'Tiêu đề tập', 'YouTube Video ID', 'YouTube URL', 'Link xem'],
      ['uuid-1', 'series-1', 'Series 1', 's1', '1', 'Tập 1', 'yt-1', '', 'https://akaiwa.tv/1'],
      ['uuid-1', 'series-1', 'Series 1', 's1', '2', 'Tập 2', 'yt-2-csv', '', 'https://akaiwa.tv/2-csv'], // both yt and watch mismatch
      ['uuid-1', 'series-1', 'Series 1', 's1', '99', 'Tập 99', 'yt-99', '', 'https://akaiwa.tv/99'], // extra in CSV
    ]

    const res = reconcileEpisodesCsvTwoWay(allDataSeries, episodesCsvRows)
    assert.deepEqual(res.missingInCsv, ['series-1:s1:3'])
    assert.deepEqual(res.extraInCsv, ['series-1:s1:99'])
    assert.equal(res.youtubeIdMismatches.length, 1)
    assert.equal(res.youtubeIdMismatches[0].csvYoutubeId, 'yt-2-csv')
    assert.equal(res.watchUrlMismatches.length, 1)
    assert.equal(res.watchUrlMismatches[0].csvWatchUrl, 'https://akaiwa.tv/2-csv')
  })
})

describe('5. Playlists Audit Across All 4 Sources & Mutation Detection', () => {
  it('detects ID mismatch when same slug but different ID between sources', () => {
    const mockAllData = {
      playlists: [{ id: 'id-ORIGINAL', slug: 'shared-slug' }],
    }
    const mockPlaylistsJson = [
      { id: 'id-MUTATED', slug: 'shared-slug', videos: [] }, // same slug, different ID!
    ]
    const res = reconcilePlaylists(mockAllData, mockPlaylistsJson)
    assert.equal(res.idMismatchesBySlug.length, 1)
    assert.equal(res.idMismatchesBySlug[0].slug, 'shared-slug')
    assert.equal(res.idMismatchesBySlug[0].idA, 'id-ORIGINAL')
    assert.equal(res.idMismatchesBySlug[0].idB, 'id-MUTATED')
  })

  it('detects slug mismatch when same ID but different slug between sources', () => {
    const mockAllData = {
      playlists: [{ id: 'shared-id', slug: 'slug-ORIGINAL' }],
    }
    const mockPlaylistsJson = [
      { id: 'shared-id', slug: 'slug-MUTATED', videos: [] }, // same ID, different slug!
    ]
    const res = reconcilePlaylists(mockAllData, mockPlaylistsJson)
    assert.equal(res.slugMismatchesById.length, 1)
    assert.equal(res.slugMismatchesById[0].id, 'shared-id')
    assert.equal(res.slugMismatchesById[0].slugA, 'slug-ORIGINAL')
    assert.equal(res.slugMismatchesById[0].slugB, 'slug-MUTATED')
  })

  it('detects video row key mismatches when playlist ID is wrong but playlist slug matches', () => {
    const mockAllData = { playlists: [] }
    const mockPlaylistsJson = [
      {
        id: 'pl-valid-id',
        slug: 'pl-valid-slug',
        videos: [{ video_id: 'video-1' }],
      },
    ]
    const mockPlaylistVideosCsvRows = [
      ['Playlist ID', 'Playlist Slug', 'Tiêu đề Playlist', 'Video ID'],
      ['pl-WRONG-id', 'pl-valid-slug', 'Title', 'video-1'], // wrong ID, correct slug!
    ]

    const res = reconcilePlaylists(mockAllData, mockPlaylistsJson, undefined, mockPlaylistVideosCsvRows)
    assert.equal(res.videoKeyReconciliation.keyMismatchSlugMatchesIdFails.length, 1)
    assert.equal(res.videoKeyReconciliation.keyMismatchSlugMatchesIdFails[0].playlistSlug, 'pl-valid-slug')
    assert.equal(res.videoKeyReconciliation.keyMismatchSlugMatchesIdFails[0].playlistId, 'pl-WRONG-id')
    assert.equal(res.videoKeyReconciliation.keyMismatchSlugMatchesIdFails[0].expectedId, 'pl-valid-id')
    assert.equal(res.videoKeyReconciliation.keyMismatchIdMatchesSlugFails.length, 0)
  })

  it('detects video row key mismatches when playlist slug is wrong but playlist ID matches', () => {
    const mockAllData = { playlists: [] }
    const mockPlaylistsJson = [
      {
        id: 'pl-valid-id',
        slug: 'pl-valid-slug',
        videos: [{ video_id: 'video-1' }],
      },
    ]
    const mockPlaylistVideosCsvRows = [
      ['Playlist ID', 'Playlist Slug', 'Tiêu đề Playlist', 'Video ID'],
      ['pl-valid-id', 'pl-WRONG-slug', 'Title', 'video-1'], // correct ID, wrong slug!
    ]

    const res = reconcilePlaylists(mockAllData, mockPlaylistsJson, undefined, mockPlaylistVideosCsvRows)
    assert.equal(res.videoKeyReconciliation.keyMismatchIdMatchesSlugFails.length, 1)
    assert.equal(res.videoKeyReconciliation.keyMismatchIdMatchesSlugFails[0].playlistId, 'pl-valid-id')
    assert.equal(res.videoKeyReconciliation.keyMismatchIdMatchesSlugFails[0].playlistSlug, 'pl-WRONG-slug')
    assert.equal(res.videoKeyReconciliation.keyMismatchIdMatchesSlugFails[0].expectedSlug, 'pl-valid-slug')
    assert.equal(res.videoKeyReconciliation.keyMismatchSlugMatchesIdFails.length, 0)
  })

  it('detects missing and extra playlists by ID and by slug independently', () => {
    const mockAllData = {
      playlists: [
        { id: 'id-1', slug: 'slug-1' },
        { id: 'id-2', slug: 'slug-2' },
      ],
    }
    const mockPlaylistsJson = [
      { id: 'id-1', slug: 'slug-1', videos: [] },
      { id: 'id-3', slug: 'slug-3', videos: [] },
    ]
    const mockPlaylistsCsvRows = [
      ['ID', 'Slug', 'Tiêu đề Playlist'],
      ['id-1', 'slug-1', 'P1'],
      ['id-4', 'slug-4', 'P4'],
    ]

    const res = reconcilePlaylists(mockAllData, mockPlaylistsJson, mockPlaylistsCsvRows)
    assert.deepEqual(res.missingExtraPlaylists.inAllDataNotPlaylistsJsonById, ['id-2'])
    assert.deepEqual(res.missingExtraPlaylists.inPlaylistsJsonNotAllDataById, ['id-3'])
    assert.deepEqual(res.missingExtraPlaylists.inPlaylistsJsonNotCsvById, ['id-3'])
    assert.deepEqual(res.missingExtraPlaylists.inCsvNotPlaylistsJsonById, ['id-4'])
    assert.deepEqual(res.missingExtraPlaylists.inAllDataNotPlaylistsJsonBySlug, ['slug-2'])
    assert.deepEqual(res.missingExtraPlaylists.inPlaylistsJsonNotAllDataBySlug, ['slug-3'])
    assert.deepEqual(res.missingExtraPlaylists.inPlaylistsJsonNotCsvBySlug, ['slug-3'])
    assert.deepEqual(res.missingExtraPlaylists.inCsvNotPlaylistsJsonBySlug, ['slug-4'])
  })

  it('detects duplicate ID and duplicate slug in sources without Set loss', () => {
    const mockAllData = {
      playlists: [
        { id: 'dup-id', slug: 'slug-a' },
        { id: 'dup-id', slug: 'slug-b' },
        { id: 'id-c', slug: 'dup-slug' },
        { id: 'id-d', slug: 'dup-slug' },
      ],
    }
    const res = reconcilePlaylists(mockAllData, [])
    assert.equal(res.duplicates.allDataIds.length, 1)
    assert.equal(res.duplicates.allDataIds[0].value, 'dup-id')
    assert.equal(res.duplicates.allDataIds[0].count, 2)
    assert.equal(res.duplicates.allDataSlugs.length, 1)
    assert.equal(res.duplicates.allDataSlugs[0].value, 'dup-slug')
    assert.equal(res.duplicates.allDataSlugs[0].count, 2)
  })
})

describe('6. Dictionary Two-Way Reconciliation (JSON ↔ CSV) & Mutation', () => {
  it('detects matching entries, duplicate IDs in CSV, and two-way missing/extra IDs', () => {
    const dictFullJson = {
      '100': { id: 100, word: 'apple' },
      '200': { id: 200, word: 'banana' },
      '300': { id: 300, word: 'cherry' },
    }
    const dictCsvRows = [
      ['ID', 'Word', 'Reading'],
      ['100', 'apple', 'ringo'],
      ['200', 'banana', 'banana'],
      ['200', 'banana', 'duplicate-row'],
      ['400', 'durian', 'durian'],
    ]

    const res = reconcileDictionaryTwoWay(dictFullJson, dictCsvRows)
    assert.equal(res.jsonEntriesCount, 3)
    assert.equal(res.csvDataRowsCount, 4)
    assert.equal(res.duplicateIdsInCsv.length, 1)
    assert.equal(res.duplicateIdsInCsv[0].id, '200')
    assert.equal(res.duplicateIdsInCsv[0].count, 2)
    assert.deepEqual(res.inJsonNotCsv, ['300'])
    assert.deepEqual(res.inCsvNotJson, ['400'])
  })

  it('reconciles 3 datasets, detects homophone collision, and unreferenced IDs', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kotodama-dict-3sets-'))
    try {
      const dictDir = path.join(tmpDir, 'dictionary')
      const shardsDir = path.join(dictDir, 'shards')
      fs.mkdirSync(shardsDir, { recursive: true })

      fs.writeFileSync(
        path.join(dictDir, '_meta.json'),
        JSON.stringify({ num_shards: 1000, total_words: 3 })
      )

      fs.writeFileSync(
        path.join(dictDir, 'dictionary_full.json'),
        JSON.stringify({
          '100': { id: 100, word: 'cat' },
          '200': { id: 200, word: 'dog' },
        })
      )

      fs.writeFileSync(
        path.join(dictDir, 'dictionary_full.csv'),
        'ID,Word\n100,cat\n200,dog\n'
      )

      fs.writeFileSync(
        path.join(dictDir, 'word-index.json'),
        JSON.stringify({
          cat: 100,
          dog: 200,
          bird: 300,
          avian: 300,
        })
      )

      fs.writeFileSync(
        path.join(shardsDir, 'shard-100.json'),
        JSON.stringify({ '100': { id: 100, word: 'cat' } })
      )
      fs.writeFileSync(
        path.join(shardsDir, 'shard-200.json'),
        JSON.stringify({ '200': { id: 200, word: 'dog' } })
      )

      const dictAudit = verifyDictionarySharding(tmpDir)
      assert.equal(dictAudit.metaTotalWords, 3)
      assert.equal(dictAudit.dictionaryFullEntriesCount, 2)
      assert.equal(dictAudit.dictionaryFullCsvRowsCount, 2)
      assert.equal(dictAudit.twoWayJsonCsv.inJsonNotCsv.length, 0)
      assert.equal(dictAudit.twoWayJsonCsv.inCsvNotJson.length, 0)
      assert.equal(dictAudit.wordIndexKeysCount, 4)
      assert.equal(dictAudit.wordIndexUniqueIdsCount, 3)
      assert.equal(dictAudit.duplicateWordIndexIds.length, 1)
      assert.equal(dictAudit.duplicateWordIndexIds[0].id, 300)
      assert.deepEqual(dictAudit.duplicateWordIndexIds[0].words, ['bird', 'avian'])
      assert.equal(dictAudit.unreferencedWordIdsCount, 1)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})

describe('7. Subtitle Deep Audit, Error Detection & Incomplete Triples', () => {
  it('detects malformed JSON parse errors and structural errors', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kotodama-sub-err-'))
    try {
      const sDir = path.join(tmpDir, 'subtitles', 'broken-anime')
      fs.mkdirSync(sDir, { recursive: true })

      fs.writeFileSync(path.join(sDir, 'ep01.json'), '{"cues": [ invalid-json')
      fs.writeFileSync(path.join(sDir, 'ep01.srt'), '1\n00:00:01,000 --> 00:00:02,000\nBroken')
      fs.writeFileSync(path.join(sDir, 'ep01.vtt'), 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nBroken')

      fs.writeFileSync(path.join(sDir, 'ep02.json'), '{"title": "No cues"}')
      fs.writeFileSync(path.join(sDir, 'ep02.srt'), '1\n00:00:01,000 --> 00:00:02,000\nOk')
      fs.writeFileSync(path.join(sDir, 'ep02.vtt'), 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nOk')

      const subAudit = deepAnalyzeSubtitles(tmpDir)
      assert.equal(subAudit.parseErrors.length, 1)
      assert.equal(subAudit.parseErrors[0].file, 'broken-anime/ep01.json')
      assert.equal(subAudit.structuralErrors.length, 1)
      assert.equal(subAudit.structuralErrors[0].file, 'broken-anime/ep02.json')
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('detects incomplete triples when JSON, SRT, or VTT is missing', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kotodama-sub-triples-'))
    try {
      const sDir = path.join(tmpDir, 'subtitles', 'partial-anime')
      fs.mkdirSync(sDir, { recursive: true })

      fs.writeFileSync(path.join(sDir, 'ep01.json'), '{"cues": []}')
      fs.writeFileSync(path.join(sDir, 'ep01.srt'), '1\n00:00:01,000 --> 00:00:02,000\nOk')

      fs.writeFileSync(path.join(sDir, 'ep02.json'), '{"cues": []}')
      fs.writeFileSync(path.join(sDir, 'ep02.srt'), '1\n00:00:01,000 --> 00:00:02,000\nOk')
      fs.writeFileSync(path.join(sDir, 'ep02.vtt'), 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nOk')

      const subAudit = deepAnalyzeSubtitles(tmpDir)
      assert.equal(subAudit.totalFullTriples, 1)
      assert.equal(subAudit.incompleteTriples.length, 1)
      assert.equal(subAudit.incompleteTriples[0].epKey, 'ep01')
      assert.equal(subAudit.incompleteTriples[0].hasVtt, false)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})

describe('8. Provenance & Rights Classification Matrix', () => {
  it('buildProvenanceCsv produces valid RFC 4180 CSV with blocked public access by default', () => {
    const csvContent = buildProvenanceCsv()
    const rows = parseCSV(csvContent)
    assert.ok(rows.length >= 8)
    const header = rows[0]
    assert.equal(header[0], 'Dataset / Thực thể')
    assert.equal(header[5], 'Trạng thái bản quyền (Rights Status)')
    assert.equal(header[6], 'Quyền truy cập công khai (Public Access)')

    for (let i = 1; i < rows.length; i++) {
      assert.equal(rows[i][6], 'BLOCKED', `Row ${i} (${rows[i][0]}) must be BLOCKED`)
      const status = rows[i][5]
      assert.ok(
        status.includes('unknown') || status.includes('restricted'),
        `Row ${i} must have unknown or restricted rights status`
      )
    }
  })
})

describe('9. Live Sanity Checks on Real Data (aanime_scraper)', () => {
  const realSourceRoot = 'D:\\Project\\data\\aanime_scraper'
  const hasRealData = fs.existsSync(realSourceRoot)

  it('verifies two-way series, episodes, playlists, and dictionary consistency on real data', { skip: !hasRealData }, () => {
    const allData = JSON.parse(fs.readFileSync(path.join(realSourceRoot, 'all_data.json'), 'utf8'))
    const seriesJson = JSON.parse(fs.readFileSync(path.join(realSourceRoot, 'series.json'), 'utf8'))
    const seriesCsvRows = parseCSV(fs.readFileSync(path.join(realSourceRoot, 'series.csv'), 'utf8'))
    const episodesCsvRows = parseCSV(fs.readFileSync(path.join(realSourceRoot, 'episodes.csv'), 'utf8'))

    // 1. Two-way series reconciliation
    const s2w = reconcileSeriesTwoWay(allData.series, seriesJson)
    assert.equal(s2w.allDataCount, 143)
    assert.equal(s2w.seriesJsonCount, 143)
    assert.equal(s2w.inAllDataNotSeriesJsonById.length, 0)
    assert.equal(s2w.inSeriesJsonNotAllDataById.length, 0)
    assert.equal(s2w.inAllDataNotSeriesJsonBySlug.length, 0)
    assert.equal(s2w.inSeriesJsonNotAllDataBySlug.length, 0)
    assert.equal(s2w.duplicateIdsInAllData.length, 0)
    assert.equal(s2w.duplicateIdsInSeriesJson.length, 0)
    assert.equal(s2w.duplicateSlugsInAllData.length, 0)
    assert.equal(s2w.duplicateSlugsInSeriesJson.length, 0)
    assert.equal(s2w.coreFieldMismatches.length, 0)
    assert.equal(s2w.episodeKeyMismatches.length, 0)
    assert.equal(s2w.episodeSourceMismatches.length, 0)

    // 2. Master reconciliation & 19 anomaly series
    const recon = reconcileMasterMetadata(allData, seriesJson, seriesCsvRows, episodesCsvRows)
    assert.equal(recon.seriesCount, 143)
    assert.equal(recon.totalEpisodes, 2528)
    assert.equal(recon.episodesWithYoutubeId, 2298)
    assert.equal(recon.episodesOnlyWatchUrl, 230)
    assert.equal(recon.episodesMissingAllSources, 0)
    assert.equal(recon.episodeCountAnomalies.length, 19)

    // 3. Two-way episodes reconciliation
    const ep2w = recon.episodesTwoWay
    assert.equal(ep2w.totalJsonEpisodes, 2528)
    assert.equal(ep2w.totalCsvEpisodeRows, 2528)
    assert.equal(ep2w.csvDuplicateKeys.length, 0)
    assert.equal(ep2w.missingInCsv.length, 0)
    assert.equal(ep2w.extraInCsv.length, 0)
    assert.equal(ep2w.youtubeIdMismatches.length, 0)
    assert.equal(ep2w.watchUrlMismatches.length, 0)

    // 4. Playlists across all 4 sources
    const playlistsJson = JSON.parse(fs.readFileSync(path.join(realSourceRoot, 'playlists.json'), 'utf8'))
    const playlistsCsvRows = parseCSV(fs.readFileSync(path.join(realSourceRoot, 'playlists.csv'), 'utf8'))
    const playlistVideosCsvRows = parseCSV(fs.readFileSync(path.join(realSourceRoot, 'playlist_videos.csv'), 'utf8'))
    const plAudit = reconcilePlaylists(allData, playlistsJson, playlistsCsvRows, playlistVideosCsvRows)
    assert.equal(plAudit.totalPlaylistsAllData, 128)
    assert.equal(plAudit.totalPlaylistsJson, 128)
    assert.equal(plAudit.totalPlaylistsCsv, 128)
    assert.equal(plAudit.totalVideosJson, 1596)
    assert.equal(plAudit.totalVideosCsv, 1596)
    assert.equal(plAudit.uniqueVideoIdsCount, 1277)
    assert.equal(plAudit.sharedVideoInstancesCount, 319)
    assert.equal(plAudit.duplicates.allDataIds.length, 0)
    assert.equal(plAudit.duplicates.allDataSlugs.length, 0)
    assert.equal(plAudit.duplicates.playlistsJsonIds.length, 0)
    assert.equal(plAudit.duplicates.playlistsJsonSlugs.length, 0)
    assert.equal(plAudit.duplicates.playlistsCsvIds.length, 0)
    assert.equal(plAudit.duplicates.playlistsCsvSlugs.length, 0)
    assert.equal(plAudit.idMismatchesBySlug.length, 0)
    assert.equal(plAudit.slugMismatchesById.length, 0)
    assert.equal(plAudit.missingExtraPlaylists.inAllDataNotPlaylistsJsonById.length, 0)
    assert.equal(plAudit.missingExtraPlaylists.inPlaylistsJsonNotCsvById.length, 0)
    assert.equal(plAudit.missingExtraPlaylists.inAllDataNotPlaylistsJsonBySlug.length, 0)
    assert.equal(plAudit.missingExtraPlaylists.inPlaylistsJsonNotCsvBySlug.length, 0)
    assert.equal(plAudit.duplicates.intraPlaylistDuplicatesInJson.length, 0)
    assert.equal(plAudit.duplicates.csvDuplicateVideoRows.length, 0)
    assert.equal(plAudit.videoKeyReconciliation.keyMismatchIdMatchesSlugFails.length, 0)
    assert.equal(plAudit.videoKeyReconciliation.keyMismatchSlugMatchesIdFails.length, 0)
    assert.equal(plAudit.videoKeyReconciliation.missingVideosInJson.length, 0)
    assert.equal(plAudit.videoKeyReconciliation.missingVideosInCsv.length, 0)

    // 5. Subtitles
    const subAudit = deepAnalyzeSubtitles(realSourceRoot)
    assert.equal(subAudit.seriesWithSubtitlesCount, 129)
    assert.equal(subAudit.totalFullTriples, 1502)
    assert.equal(subAudit.parseErrors.length, 0)
    assert.equal(subAudit.structuralErrors.length, 0)
    assert.equal(subAudit.incompleteTriples.length, 0)
    assert.equal(subAudit.totalCues, 584827)
    assert.equal(subAudit.invalidTimestamps.length, 1)
    assert.equal(subAudit.overlappingCues.length, 565)

    // 6. Dictionary & Two-way JSON ↔ CSV
    const dictAudit = verifyDictionarySharding(realSourceRoot)
    assert.equal(dictAudit.metaTotalWords, 59224)
    assert.equal(dictAudit.dictionaryFullEntriesCount, 39516)
    assert.equal(dictAudit.dictionaryFullCsvRowsCount, 39516)
    assert.equal(dictAudit.twoWayJsonCsv.duplicateIdsInCsv.length, 0)
    assert.equal(dictAudit.twoWayJsonCsv.inJsonNotCsv.length, 0)
    assert.equal(dictAudit.twoWayJsonCsv.inCsvNotJson.length, 0)
    assert.equal(dictAudit.wordIndexKeysCount, 59225)
    assert.equal(dictAudit.wordIndexUniqueIdsCount, 59224)
    assert.equal(dictAudit.duplicateWordIndexIds.length, 1)
    assert.equal(dictAudit.duplicateWordIndexIds[0].id, 3144121485)
    assert.deepEqual(dictAudit.duplicateWordIndexIds[0].words.sort(), ['アニソン', '柔道家'].sort())
    assert.equal(dictAudit.unreferencedWordIdsCount, 19708)
    assert.equal(dictAudit.actualShardFilesCount, 666)
    assert.equal(dictAudit.totalWordsInShards, 39516)
    assert.equal(dictAudit.shardModuloErrors, 0)
    assert.equal(dictAudit.mismatchWithMod100, 33648)
    assert.equal(dictAudit.mismatchRateMod100Percent, 85.15)
  })
})
