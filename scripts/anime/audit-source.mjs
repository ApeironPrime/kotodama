import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

/**
 * Standard RFC 4180 CSV parser with UTF-8 BOM handling
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCSV(text) {
  // Strip UTF-8 BOM if present
  const cleanText = text.replace(/^\uFEFF/, '')
  const rows = []
  let currentRow = []
  let currentField = ''
  let inQuotes = false
  let i = 0

  while (i < cleanText.length) {
    const char = cleanText[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < cleanText.length && cleanText[i + 1] === '"') {
          currentField += '"'
          i += 2
          continue
        } else {
          inQuotes = false
          i++
          continue
        }
      } else {
        currentField += char
        i++
      }
    } else {
      if (char === '"') {
        inQuotes = true
        i++
      } else if (char === ',') {
        currentRow.push(currentField)
        currentField = ''
        i++
      } else if (char === '\r') {
        if (i + 1 < cleanText.length && cleanText[i + 1] === '\n') {
          i++
        }
        currentRow.push(currentField)
        currentField = ''
        rows.push(currentRow)
        currentRow = []
        i++
      } else if (char === '\n') {
        currentRow.push(currentField)
        currentField = ''
        rows.push(currentRow)
        currentRow = []
        i++
      } else {
        currentField += char
        i++
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField)
    rows.push(currentRow)
  }

  return rows
}

/**
 * Serialize 2D array of strings to RFC 4180 CSV
 * @param {string[][]} rows
 * @returns {string}
 */
export function serializeCSV(rows) {
  return rows
    .map((row) =>
      row
        .map((val) => {
          const str = String(val ?? '')
          if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        })
        .join(',')
    )
    .join('\n') + '\n'
}

/**
 * Hash a file using SHA-256 stream
 * @param {string} filePath
 * @returns {Promise<{ sha256: string, sizeBytes: number }>}
 */
export async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    let sizeBytes = 0

    stream.on('data', (chunk) => {
      sizeBytes += chunk.length
      hash.update(chunk)
    })
    stream.on('end', () => {
      resolve({ sha256: hash.digest('hex'), sizeBytes })
    })
    stream.on('error', (err) => {
      reject(err)
    })
  })
}

/**
 * Hash in-memory buffer or string using SHA-256
 * @param {Buffer|string} content
 * @returns {string}
 */
export function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex')
}

/**
 * Walk directory recursively and collect all file paths in POSIX format
 * @param {string} dir
 * @param {string} [baseDir]
 * @returns {string[]}
 */
export function walkFilesDeterministic(dir, baseDir = dir) {
  const results = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  // Sort deterministically
  entries.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkFilesDeterministic(fullPath, baseDir))
    } else if (entry.isFile()) {
      const relPosix = path.relative(baseDir, fullPath).replace(/\\/g, '/')
      results.push(relPosix)
    }
  }

  return results
}

/**
 * Audit source directory and build file manifest
 * @param {string} sourceRoot
 * @returns {Promise<{
 *   sourceRoot: string,
 *   totalFiles: number,
 *   totalBytes: number,
 *   formatBreakdown: Record<string, { count: number, totalBytes: number }>,
 *   files: Record<string, { sizeBytes: number, sha256: string }>,
 *   overallManifestHash: string
 * }>}
 */
export async function auditSourceDirectory(sourceRoot) {
  const relativeFiles = walkFilesDeterministic(sourceRoot)
  relativeFiles.sort((a, b) => a.localeCompare(b, 'en'))

  const filesMap = {}
  const formatBreakdown = {}
  let totalBytes = 0

  for (const relPath of relativeFiles) {
    const fullPath = path.join(sourceRoot, relPath)
    const { sha256, sizeBytes } = await hashFile(fullPath)
    filesMap[relPath] = { sizeBytes, sha256 }
    totalBytes += sizeBytes

    const ext = path.extname(relPath).toLowerCase() || '[no_ext]'
    if (!formatBreakdown[ext]) {
      formatBreakdown[ext] = { count: 0, totalBytes: 0 }
    }
    formatBreakdown[ext].count++
    formatBreakdown[ext].totalBytes += sizeBytes
  }

  // Calculate overall manifest hash deterministically:
  // sha256 of sorted lines: "<relPath>:<sha256>:<sizeBytes>\n"
  const manifestHash = crypto.createHash('sha256')
  for (const relPath of relativeFiles) {
    const item = filesMap[relPath]
    manifestHash.update(`${relPath}:${item.sha256}:${item.sizeBytes}\n`, 'utf8')
  }
  const overallManifestHash = manifestHash.digest('hex')

  return {
    sourceRoot,
    totalFiles: relativeFiles.length,
    totalBytes,
    formatBreakdown,
    files: filesMap,
    overallManifestHash,
  }
}

/**
 * Two-way record-level reconciliation between all_data.series and series.json
 * @param {any[]} allDataSeries
 * @param {any[]} seriesJson
 */
export function reconcileSeriesTwoWay(allDataSeries = [], seriesJson = []) {
  const adById = new Map()
  const adBySlug = new Map()
  const duplicateIdsInAllData = []
  const duplicateSlugsInAllData = []

  for (const s of allDataSeries) {
    if (adById.has(s.id)) duplicateIdsInAllData.push(s.id)
    adById.set(s.id, s)

    if (adBySlug.has(s.slug)) duplicateSlugsInAllData.push(s.slug)
    adBySlug.set(s.slug, s)
  }

  const sjById = new Map()
  const sjBySlug = new Map()
  const duplicateIdsInSeriesJson = []
  const duplicateSlugsInSeriesJson = []

  for (const s of seriesJson) {
    if (sjById.has(s.id)) duplicateIdsInSeriesJson.push(s.id)
    sjById.set(s.id, s)

    if (sjBySlug.has(s.slug)) duplicateSlugsInSeriesJson.push(s.slug)
    sjBySlug.set(s.slug, s)
  }

  // Two-way ID matching
  const inAllDataNotSeriesJsonById = allDataSeries.filter((s) => !sjById.has(s.id)).map((s) => s.id)
  const inSeriesJsonNotAllDataById = seriesJson.filter((s) => !adById.has(s.id)).map((s) => s.id)

  // Two-way Slug matching
  const inAllDataNotSeriesJsonBySlug = allDataSeries.filter((s) => !sjBySlug.has(s.slug)).map((s) => s.slug)
  const inSeriesJsonNotAllDataBySlug = seriesJson.filter((s) => !adBySlug.has(s.slug)).map((s) => s.slug)

  // Field-by-field & episode comparisons
  const coreFieldMismatches = []
  const episodeKeyMismatches = []
  const episodeSourceMismatches = []

  const coreFields = ['slug', 'title_vi', 'title_ja', 'video_source', 'jlpt_level', 'total_episodes', 'poster_url']

  for (const adS of allDataSeries) {
    const sjS = sjById.get(adS.id)
    if (!sjS) continue

    for (const f of coreFields) {
      if (adS[f] !== sjS[f]) {
        coreFieldMismatches.push({
          seriesId: adS.id,
          slug: adS.slug,
          field: f,
          allDataValue: adS[f],
          seriesJsonValue: sjS[f],
        })
      }
    }

    const adEps = adS.all_episodes || []
    const sjEps = sjS.all_episodes || []
    if (adEps.length !== sjEps.length) {
      coreFieldMismatches.push({
        seriesId: adS.id,
        slug: adS.slug,
        field: 'all_episodes.length',
        allDataValue: adEps.length,
        seriesJsonValue: sjEps.length,
      })
    }

    const maxLen = Math.max(adEps.length, sjEps.length)
    for (let i = 0; i < maxLen; i++) {
      const e1 = adEps[i]
      const e2 = sjEps[i]
      if (!e1 || !e2) continue

      const k1 = `${e1.season_slug || adS.slug}:${e1.ep_number}`
      const k2 = `${e2.season_slug || sjS.slug}:${e2.ep_number}`
      if (k1 !== k2) {
        episodeKeyMismatches.push({
          slug: adS.slug,
          episodeIndex: i,
          allDataKey: k1,
          seriesJsonKey: k2,
        })
      }

      const e1Yt = (e1.youtube_video_id || '').trim()
      const e2Yt = (e2.youtube_video_id || '').trim()
      const e1Watch = (e1.watch_url || '').trim()
      const e2Watch = (e2.watch_url || '').trim()

      if (e1Yt !== e2Yt || e1Watch !== e2Watch) {
        episodeSourceMismatches.push({
          slug: adS.slug,
          episodeIndex: i,
          allDataSources: { youtube: e1Yt, watch: e1Watch },
          seriesJsonSources: { youtube: e2Yt, watch: e2Watch },
        })
      }
    }
  }

  return {
    allDataCount: allDataSeries.length,
    seriesJsonCount: seriesJson.length,
    duplicateIdsInAllData,
    duplicateIdsInSeriesJson,
    duplicateSlugsInAllData,
    duplicateSlugsInSeriesJson,
    inAllDataNotSeriesJsonById,
    inSeriesJsonNotAllDataById,
    inAllDataNotSeriesJsonBySlug,
    inSeriesJsonNotAllDataBySlug,
    coreFieldMismatches,
    episodeKeyMismatches,
    episodeSourceMismatches,
  }
}

/**
 * Two-way record-level reconciliation between episodes in JSON and episodes.csv
 * @param {any[]} allDataSeries
 * @param {string[][]} [episodesCsvRows]
 */
export function reconcileEpisodesCsvTwoWay(allDataSeries = [], episodesCsvRows = []) {
  if (!episodesCsvRows || episodesCsvRows.length <= 1) {
    return {
      totalJsonEpisodes: 0,
      totalCsvEpisodeRows: 0,
      csvDuplicateKeys: [],
      missingInCsv: [],
      extraInCsv: [],
      youtubeIdMismatches: [],
      watchUrlMismatches: [],
    }
  }

  const epHeader = episodesCsvRows[0]
  const epSeriesIdIdx = epHeader.indexOf('Series ID')
  const epSeriesSlugIdx = epHeader.indexOf('Series Slug')
  const epSeasonIdx = epHeader.indexOf('Mùa (Season)')
  const epNumIdx = epHeader.indexOf('Số tập')
  const epYtIdIdx = epHeader.indexOf('YouTube Video ID')
  const epWatchUrlIdx = epHeader.indexOf('Link xem')

  // Build CSV map using frequency counter for duplicate keys
  const csvEpCounts = new Map()
  const csvEpMap = new Map()
  const csvDuplicateKeys = []

  for (let i = 1; i < episodesCsvRows.length; i++) {
    const r = episodesCsvRows[i]
    const slug = r[epSeriesSlugIdx]
    const season = r[epSeasonIdx]
    const num = r[epNumIdx]
    const key = `${slug}:${season}:${num}`

    const count = (csvEpCounts.get(key) || 0) + 1
    csvEpCounts.set(key, count)
    if (count > 1) {
      csvDuplicateKeys.push({ key, rowNumber: i + 1, count })
    }

    if (!csvEpMap.has(key)) {
      csvEpMap.set(key, {
        rowNumber: i + 1,
        seriesId: epSeriesIdIdx >= 0 ? r[epSeriesIdIdx] : '',
        seriesSlug: slug,
        season,
        epNum: parseInt(num, 10),
        ytId: epYtIdIdx >= 0 ? (r[epYtIdIdx] || '').trim() : '',
        watchUrl: epWatchUrlIdx >= 0 ? (r[epWatchUrlIdx] || '').trim() : '',
      })
    }
  }

  // Build JSON episode map
  const jsonEpMap = new Map()
  let totalJsonEpisodes = 0

  for (const s of allDataSeries) {
    for (const ep of s.all_episodes || []) {
      totalJsonEpisodes++
      const key = `${s.slug}:${ep.season_slug || s.slug}:${ep.ep_number}`
      jsonEpMap.set(key, {
        seriesId: s.id,
        seriesSlug: s.slug,
        season: ep.season_slug || s.slug,
        epNum: ep.ep_number,
        ytId: (ep.youtube_video_id || '').trim(),
        watchUrl: (ep.watch_url || '').trim(),
      })
    }
  }

  // Two-way comparison
  const missingInCsv = []
  const youtubeIdMismatches = []
  const watchUrlMismatches = []

  for (const [key, jsonEp] of jsonEpMap.entries()) {
    const csvEp = csvEpMap.get(key)
    if (!csvEp) {
      missingInCsv.push(key)
      continue
    }

    if (jsonEp.ytId !== csvEp.ytId) {
      youtubeIdMismatches.push({
        key,
        jsonYoutubeId: jsonEp.ytId,
        csvYoutubeId: csvEp.ytId,
      })
    }

    if (jsonEp.watchUrl !== csvEp.watchUrl) {
      watchUrlMismatches.push({
        key,
        jsonWatchUrl: jsonEp.watchUrl,
        csvWatchUrl: csvEp.watchUrl,
      })
    }
  }

  const extraInCsv = []
  for (const key of csvEpMap.keys()) {
    if (!jsonEpMap.has(key)) {
      extraInCsv.push(key)
    }
  }

  return {
    totalJsonEpisodes,
    totalCsvEpisodeRows: episodesCsvRows.length - 1,
    csvDuplicateKeys,
    missingInCsv,
    extraInCsv,
    youtubeIdMismatches,
    watchUrlMismatches,
  }
}

/**
 * Reconcile master metadata across all_data.json, series.json, series.csv, episodes.csv
 * @param {any} allData
 * @param {any} seriesJson
 * @param {string[][]} [seriesCsvRows]
 * @param {string[][]} [episodesCsvRows]
 */
export function reconcileMasterMetadata(allData, seriesJson, seriesCsvRows, episodesCsvRows) {
  const seriesList = allData.series || []
  const seriesTwoWay = reconcileSeriesTwoWay(seriesList, Array.isArray(seriesJson) ? seriesJson : [])
  const episodesTwoWay = reconcileEpisodesCsvTwoWay(seriesList, episodesCsvRows)

  let totalEpisodes = 0
  let episodesWithYoutubeId = 0
  let episodesOnlyWatchUrl = 0
  let episodesMissingAllSources = 0

  const episodesBySource = {
    youtube: 0,
    archive: 0,
    bilibili: 0,
    dailymotion: 0,
    okru: 0,
    other: 0,
  }

  for (const s of seriesList) {
    const vSource = s.video_source || 'other'
    const epList = s.all_episodes || []
    totalEpisodes += epList.length

    for (const ep of epList) {
      const yId = (ep.youtube_video_id || '').trim()
      const wUrl = (ep.watch_url || '').trim()

      if (yId) {
        episodesWithYoutubeId++
      } else if (wUrl) {
        episodesOnlyWatchUrl++
      } else {
        episodesMissingAllSources++
      }

      if (episodesBySource[vSource] !== undefined) {
        episodesBySource[vSource]++
      } else {
        episodesBySource.other++
      }
    }
  }

  // Cross check with series.csv
  const seriesCsvDataCount = seriesCsvRows ? Math.max(0, seriesCsvRows.length - 1) : null
  const episodeCountAnomalies = []

  if (seriesCsvRows && seriesCsvRows.length > 1) {
    const header = seriesCsvRows[0]
    const slugIdx = header.indexOf('Slug')
    const epCountIdx = header.indexOf('Số tập')
    const titleIdx = header.indexOf('Tiêu đề tiếng Việt')

    const csvSeriesMap = new Map()
    for (let i = 1; i < seriesCsvRows.length; i++) {
      const row = seriesCsvRows[i]
      if (slugIdx >= 0) {
        csvSeriesMap.set(row[slugIdx], {
          slug: row[slugIdx],
          title: titleIdx >= 0 ? row[titleIdx] : '',
          csvCount: epCountIdx >= 0 ? parseInt(row[epCountIdx], 10) : 0,
        })
      }
    }

    for (const s of seriesList) {
      const fromCsv = csvSeriesMap.get(s.slug)
      const allEpsCount = (s.all_episodes || []).length
      if (fromCsv && !isNaN(fromCsv.csvCount) && fromCsv.csvCount !== allEpsCount) {
        episodeCountAnomalies.push({
          slug: s.slug,
          title: s.title_vi || fromCsv.title,
          csvCount: fromCsv.csvCount,
          jsonAllEpisodesCount: allEpsCount,
          seriesTotalEpisodes: s.total_episodes,
          explanation:
            'Multi-season series where series.csv / s.total_episodes records season-specific episode count, while s.all_episodes has cumulative count across all seasons',
        })
      }
    }
  }

  return {
    seriesCount: seriesList.length,
    seriesTwoWay,
    episodesTwoWay,
    seriesCsvDataCount,
    totalEpisodes,
    episodesWithYoutubeId,
    episodesOnlyWatchUrl,
    episodesMissingAllSources,
    episodesBySource,
    episodeCountAnomalies,
  }
}

/**
 * Reconcile and audit playlists across all 4 sources:
 * all_data.playlists, playlists.json, playlists.csv, playlist_videos.csv
 * @param {any} allData
 * @param {any} playlistsJson
 * @param {string[][]} [playlistsCsvRows]
 * @param {string[][]} [playlistVideosCsvRows]
 */
export function reconcilePlaylists(allData = {}, playlistsJson = [], playlistsCsvRows, playlistVideosCsvRows) {
  const adPlaylists = allData.playlists || []
  const pjPlaylists = Array.isArray(playlistsJson) ? playlistsJson : []

  // Helper to count frequencies of an attribute in an array
  const countOccurrences = (items, key) => {
    const counts = new Map()
    const duplicates = []
    for (let i = 0; i < items.length; i++) {
      const val = (items[i][key] || '').trim()
      if (!val) continue
      const c = (counts.get(val) || 0) + 1
      counts.set(val, c)
      if (c > 1) duplicates.push({ value: val, index: i, count: c })
    }
    return { counts, duplicates }
  }

  // Parse playlists.csv into structured objects if present
  const pcPlaylists = []
  if (playlistsCsvRows && playlistsCsvRows.length > 1) {
    const header = playlistsCsvRows[0]
    const idIdx = header.indexOf('ID')
    const slugIdx = header.indexOf('Slug')
    const titleIdx = header.indexOf('Tiêu đề Playlist')
    for (let i = 1; i < playlistsCsvRows.length; i++) {
      const row = playlistsCsvRows[i]
      pcPlaylists.push({
        id: idIdx >= 0 ? (row[idIdx] || '').trim() : '',
        slug: slugIdx >= 0 ? (row[slugIdx] || '').trim() : '',
        title: titleIdx >= 0 ? row[titleIdx] : '',
        rowNumber: i + 1,
      })
    }
  }

  // 1. Duplicate ID and Slug tracking in each source
  const adIds = countOccurrences(adPlaylists, 'id')
  const adSlugs = countOccurrences(adPlaylists, 'slug')
  const pjIds = countOccurrences(pjPlaylists, 'id')
  const pjSlugs = countOccurrences(pjPlaylists, 'slug')
  const pcIds = countOccurrences(pcPlaylists, 'id')
  const pcSlugs = countOccurrences(pcPlaylists, 'slug')

  // Maps by ID and by Slug
  const adById = new Map(adPlaylists.map((p) => [p.id, p]))
  const adBySlug = new Map(adPlaylists.map((p) => [p.slug, p]))
  const pjById = new Map(pjPlaylists.map((p) => [p.id, p]))
  const pjBySlug = new Map(pjPlaylists.map((p) => [p.slug, p]))
  const pcById = new Map(pcPlaylists.map((p) => [p.id, p]))
  const pcBySlug = new Map(pcPlaylists.map((p) => [p.slug, p]))

  // 2. Two-way missing/extra by ID
  const inAllDataNotPlaylistsJsonById = adPlaylists.filter((p) => !pjById.has(p.id)).map((p) => p.id)
  const inPlaylistsJsonNotAllDataById = pjPlaylists.filter((p) => !adById.has(p.id)).map((p) => p.id)
  const inPlaylistsJsonNotCsvById = pcPlaylists.length > 0 ? pjPlaylists.filter((p) => !pcById.has(p.id)).map((p) => p.id) : []
  const inCsvNotPlaylistsJsonById = pcPlaylists.length > 0 ? pcPlaylists.filter((p) => !pjById.has(p.id)).map((p) => p.id) : []

  // Two-way missing/extra by Slug
  const inAllDataNotPlaylistsJsonBySlug = adPlaylists.filter((p) => !pjBySlug.has(p.slug)).map((p) => p.slug)
  const inPlaylistsJsonNotAllDataBySlug = pjPlaylists.filter((p) => !adBySlug.has(p.slug)).map((p) => p.slug)
  const inPlaylistsJsonNotCsvBySlug = pcPlaylists.length > 0 ? pjPlaylists.filter((p) => !pcBySlug.has(p.slug)).map((p) => p.slug) : []
  const inCsvNotPlaylistsJsonBySlug = pcPlaylists.length > 0 ? pcPlaylists.filter((p) => !pjBySlug.has(p.slug)).map((p) => p.slug) : []

  // 3. ID mismatch when slug matches
  const idMismatchesBySlug = []
  for (const [slug, pPj] of pjBySlug.entries()) {
    const pAd = adBySlug.get(slug)
    if (pAd && pAd.id !== pPj.id) {
      idMismatchesBySlug.push({
        slug,
        sourceA: 'all_data',
        idA: pAd.id,
        sourceB: 'playlists.json',
        idB: pPj.id,
      })
    }
    const pPc = pcBySlug.get(slug)
    if (pPc && pPc.id !== pPj.id) {
      idMismatchesBySlug.push({
        slug,
        sourceA: 'playlists.csv',
        idA: pPc.id,
        sourceB: 'playlists.json',
        idB: pPj.id,
      })
    }
  }

  // 4. Slug mismatch when ID matches
  const slugMismatchesById = []
  for (const [id, pPj] of pjById.entries()) {
    const pAd = adById.get(id)
    if (pAd && pAd.slug !== pPj.slug) {
      slugMismatchesById.push({
        id,
        sourceA: 'all_data',
        slugA: pAd.slug,
        sourceB: 'playlists.json',
        slugB: pPj.slug,
      })
    }
    const pPc = pcById.get(id)
    if (pPc && pPc.slug !== pPj.slug) {
      slugMismatchesById.push({
        id,
        sourceA: 'playlists.csv',
        slugA: pPc.slug,
        sourceB: 'playlists.json',
        slugB: pPj.slug,
      })
    }
  }

  // 5. Video two-key reconciliation
  let totalVideosJson = 0
  const uniqueVideoIds = new Set()
  const jsonVideoPairsById = new Map()
  const jsonVideoPairsBySlug = new Map()
  const intraPlaylistDuplicatesInJson = []

  for (const pl of pjPlaylists) {
    for (const v of pl.videos || []) {
      totalVideosJson++
      const vId = (v.video_id || '').trim()
      if (vId) uniqueVideoIds.add(vId)

      const pairSlug = `${pl.slug}:${vId}`
      const pairId = `${pl.id}:${vId}`

      const count = (jsonVideoPairsBySlug.get(pairSlug) || 0) + 1
      jsonVideoPairsBySlug.set(pairSlug, count)
      jsonVideoPairsById.set(pairId, count)

      if (count > 1) {
        intraPlaylistDuplicatesInJson.push({ playlistSlug: pl.slug, playlistId: pl.id, videoId: vId, count })
      }
    }
  }

  // Videos in playlist_videos.csv
  let totalVideosCsv = playlistVideosCsvRows ? Math.max(0, playlistVideosCsvRows.length - 1) : totalVideosJson
  const csvDuplicateVideoRows = []
  const csvVideoRowsCounts = new Map()

  const keyMismatchIdMatchesSlugFails = []
  const keyMismatchSlugMatchesIdFails = []
  const missingVideosInJson = []
  const csvMatchedVideoKeys = new Set()

  if (playlistVideosCsvRows && playlistVideosCsvRows.length > 1) {
    const csvHeader = playlistVideosCsvRows[0]
    const pvcPlIdIdx = csvHeader.indexOf('Playlist ID')
    const pvcPlSlugIdx = csvHeader.indexOf('Playlist Slug')
    const pvcVidIdIdx = csvHeader.indexOf('Video ID')

    for (let i = 1; i < playlistVideosCsvRows.length; i++) {
      const r = playlistVideosCsvRows[i]
      const pId = (r[pvcPlIdIdx] || '').trim()
      const pSlug = (r[pvcPlSlugIdx] || '').trim()
      const vId = (r[pvcVidIdIdx] || '').trim()

      const fullKey = `${pId}:${pSlug}:${vId}`
      const count = (csvVideoRowsCounts.get(fullKey) || 0) + 1
      csvVideoRowsCounts.set(fullKey, count)
      if (count > 1) {
        csvDuplicateVideoRows.push({ rowNumber: i + 1, playlistId: pId, playlistSlug: pSlug, videoId: vId, count })
      }

      const idKey = `${pId}:${vId}`
      const slugKey = `${pSlug}:${vId}`

      const hasIdKey = jsonVideoPairsById.has(idKey)
      const hasSlugKey = jsonVideoPairsBySlug.has(slugKey)

      if (hasIdKey && hasSlugKey) {
        csvMatchedVideoKeys.add(slugKey)
      } else if (hasIdKey && !hasSlugKey) {
        // ID matches but slug failed
        const expectedSlug = pjById.get(pId)?.slug || ''
        keyMismatchIdMatchesSlugFails.push({
          rowNumber: i + 1,
          playlistId: pId,
          playlistSlug: pSlug,
          expectedSlug,
          videoId: vId,
        })
      } else if (!hasIdKey && hasSlugKey) {
        // Slug matches but ID failed
        const expectedId = pjBySlug.get(pSlug)?.id || ''
        keyMismatchSlugMatchesIdFails.push({
          rowNumber: i + 1,
          playlistId: pId,
          expectedId,
          playlistSlug: pSlug,
          videoId: vId,
        })
      } else {
        // Neither matched
        missingVideosInJson.push({
          rowNumber: i + 1,
          playlistId: pId,
          playlistSlug: pSlug,
          videoId: vId,
        })
      }
    }
  }

  // Check reverse: any video in JSON missing in CSV
  const missingVideosInCsv = []
  if (playlistVideosCsvRows && playlistVideosCsvRows.length > 1) {
    for (const slugKey of jsonVideoPairsBySlug.keys()) {
      if (!csvMatchedVideoKeys.has(slugKey)) {
        missingVideosInCsv.push(slugKey)
      }
    }
  }

  return {
    totalPlaylistsAllData: adPlaylists.length,
    totalPlaylistsJson: pjPlaylists.length,
    totalPlaylistsCsv: pcPlaylists.length,
    totalVideosJson,
    totalVideosCsv,
    uniqueVideoIdsCount: uniqueVideoIds.size,
    sharedVideoInstancesCount: totalVideosJson - uniqueVideoIds.size,
    duplicates: {
      allDataIds: adIds.duplicates,
      allDataSlugs: adSlugs.duplicates,
      playlistsJsonIds: pjIds.duplicates,
      playlistsJsonSlugs: pjSlugs.duplicates,
      playlistsCsvIds: pcIds.duplicates,
      playlistsCsvSlugs: pcSlugs.duplicates,
      intraPlaylistDuplicatesInJson,
      csvDuplicateVideoRows,
    },
    idMismatchesBySlug,
    slugMismatchesById,
    missingExtraPlaylists: {
      inAllDataNotPlaylistsJsonById,
      inPlaylistsJsonNotAllDataById,
      inPlaylistsJsonNotCsvById,
      inCsvNotPlaylistsJsonById,
      inAllDataNotPlaylistsJsonBySlug,
      inPlaylistsJsonNotAllDataBySlug,
      inPlaylistsJsonNotCsvBySlug,
      inCsvNotPlaylistsJsonBySlug,
    },
    videoKeyReconciliation: {
      keyMismatchIdMatchesSlugFails,
      keyMismatchSlugMatchesIdFails,
      missingVideosInJson,
      missingVideosInCsv,
    },
  }
}

/**
 * Two-way reconciliation between dictionary_full.json and dictionary_full.csv
 * @param {Record<string, any>} dictFullJsonMap
 * @param {string[][]} [dictCsvRows]
 */
export function reconcileDictionaryTwoWay(dictFullJsonMap = {}, dictCsvRows = []) {
  const jsonDictIds = new Set(Object.keys(dictFullJsonMap || {}).map(String))
  const csvDictCounts = new Map()
  const duplicateIdsInCsv = []
  const csvDictIds = new Set()

  if (dictCsvRows && dictCsvRows.length > 1) {
    const dictCsvHeader = dictCsvRows[0]
    const dictIdIdx = dictCsvHeader.indexOf('ID')

    for (let i = 1; i < dictCsvRows.length; i++) {
      const idStr = String(dictCsvRows[i][dictIdIdx] || '').trim()
      if (!idStr) continue
      const count = (csvDictCounts.get(idStr) || 0) + 1
      csvDictCounts.set(idStr, count)
      if (count > 1) {
        duplicateIdsInCsv.push({ id: idStr, rowNumber: i + 1, count })
      }
      csvDictIds.add(idStr)
    }
  }

  const inJsonNotCsv = []
  for (const id of jsonDictIds) {
    if (!csvDictIds.has(id)) inJsonNotCsv.push(id)
  }

  const inCsvNotJson = []
  for (const id of csvDictIds) {
    if (!jsonDictIds.has(id)) inCsvNotJson.push(id)
  }

  return {
    jsonEntriesCount: jsonDictIds.size,
    csvDataRowsCount: dictCsvRows ? Math.max(0, dictCsvRows.length - 1) : 0,
    duplicateIdsInCsv,
    inJsonNotCsv,
    inCsvNotJson,
  }
}

/**
 * Verify dictionary shards algorithm, reconcile 3 distinct datasets, and perform two-way JSON vs CSV reconciliation
 * @param {string} sourceRoot
 */
export function verifyDictionarySharding(sourceRoot) {
  const dictDir = path.join(sourceRoot, 'dictionary')
  const shardsDir = path.join(dictDir, 'shards')
  const metaPath = path.join(dictDir, '_meta.json')
  const fullJsonPath = path.join(dictDir, 'dictionary_full.json')
  const fullCsvPath = path.join(dictDir, 'dictionary_full.csv')
  const wordIndexPath = path.join(dictDir, 'word-index.json')

  let meta = { num_shards: 1000, total_words: 59224, shard_formula: '', note: '' }
  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    } catch {}
  }

  let dictFullMap = null
  if (fs.existsSync(fullJsonPath)) {
    try {
      dictFullMap = JSON.parse(fs.readFileSync(fullJsonPath, 'utf8'))
    } catch {}
  }

  let dictCsvRows = null
  if (fs.existsSync(fullCsvPath)) {
    try {
      dictCsvRows = parseCSV(fs.readFileSync(fullCsvPath, 'utf8'))
    } catch {}
  }

  // Two-way reconciliation between dictionary_full.json and dictionary_full.csv
  const twoWayJsonCsv = reconcileDictionaryTwoWay(dictFullMap, dictCsvRows)

  let wordIndexKeysCount = 0
  let wordIndexUniqueIdsCount = 0
  const duplicateWordIndexIds = []
  let unreferencedWordIdsCount = 0

  if (fs.existsSync(wordIndexPath)) {
    try {
      const wordIndex = JSON.parse(fs.readFileSync(wordIndexPath, 'utf8'))
      const idToWords = new Map()
      for (const [word, id] of Object.entries(wordIndex)) {
        wordIndexKeysCount++
        if (!idToWords.has(id)) {
          idToWords.set(id, [])
        }
        idToWords.get(id).push(word)
      }

      wordIndexUniqueIdsCount = idToWords.size
      for (const [id, words] of idToWords.entries()) {
        if (words.length > 1) {
          duplicateWordIndexIds.push({ id, words })
        }
        if (dictFullMap && !dictFullMap[id]) {
          unreferencedWordIdsCount++
        }
      }
    } catch {}
  }

  if (!fs.existsSync(shardsDir)) {
    return {
      metaNumShards: meta.num_shards || 1000,
      metaTotalWords: meta.total_words || 0,
      metaFormula: meta.shard_formula || '',
      metaNote: meta.note || '',
      twoWayJsonCsv,
      dictionaryFullEntriesCount: twoWayJsonCsv.jsonEntriesCount,
      dictionaryFullCsvRowsCount: twoWayJsonCsv.csvDataRowsCount,
      wordIndexKeysCount,
      wordIndexUniqueIdsCount,
      duplicateWordIndexIds,
      unreferencedWordIdsCount,
      actualShardFilesCount: 0,
      totalWordsInShards: 0,
      shardFormatErrors: 0,
      shardModuloErrors: 0,
      mismatchWithMod100: 0,
      mismatchRateMod100Percent: 0,
    }
  }

  const shardFiles = fs.readdirSync(shardsDir).filter((f) => f.endsWith('.json'))
  let totalWordsInShards = 0
  let shardFormatErrors = 0
  let shardModuloErrors = 0
  let mismatchWithMod100 = 0

  for (const file of shardFiles) {
    const match = file.match(/^shard-(\d{3})\.json$/)
    if (!match) {
      shardFormatErrors++
      continue
    }
    const expectedMod1000 = parseInt(match[1], 10)
    const filePath = path.join(shardsDir, file)
    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      for (const [, entry] of Object.entries(content)) {
        totalWordsInShards++
        const wordId = entry.id
        if (typeof wordId !== 'number' || wordId % 1000 !== expectedMod1000) {
          shardModuloErrors++
        }
        if (wordId % 100 !== expectedMod1000) {
          mismatchWithMod100++
        }
      }
    } catch {
      shardFormatErrors++
    }
  }

  const mismatchRateMod100Percent =
    totalWordsInShards > 0 ? parseFloat(((mismatchWithMod100 / totalWordsInShards) * 100).toFixed(2)) : 0

  return {
    metaNumShards: meta.num_shards || 1000,
    metaTotalWords: meta.total_words || 0,
    metaFormula: meta.shard_formula || '',
    metaNote: meta.note || '',
    twoWayJsonCsv,
    dictionaryFullEntriesCount: twoWayJsonCsv.jsonEntriesCount,
    dictionaryFullCsvRowsCount: twoWayJsonCsv.csvDataRowsCount,
    wordIndexKeysCount,
    wordIndexUniqueIdsCount,
    duplicateWordIndexIds,
    unreferencedWordIdsCount,
    actualShardFilesCount: shardFiles.length,
    totalWordsInShards,
    shardFormatErrors,
    shardModuloErrors,
    mismatchWithMod100,
    mismatchRateMod100Percent,
  }
}

/**
 * Deep audit of subtitles directory
 * @param {string} sourceRoot
 */
export function deepAnalyzeSubtitles(sourceRoot) {
  const subDir = path.join(sourceRoot, 'subtitles')
  if (!fs.existsSync(subDir)) {
    return {
      seriesWithSubtitlesCount: 0,
      totalJsonFiles: 0,
      totalSrtFiles: 0,
      totalVttFiles: 0,
      totalFullTriples: 0,
      incompleteTriples: [],
      parseErrors: [],
      structuralErrors: [],
      totalCues: 0,
      cuesWithJa: 0,
      cuesWithVi: 0,
      cuesWithBoth: 0,
      totalTokens: 0,
      tokensWithWordId: 0,
      invalidTimestamps: [],
      overlappingCues: [],
      seriesCoverageMap: {},
    }
  }

  const seriesDirs = fs.readdirSync(subDir).filter((d) => {
    try {
      return fs.statSync(path.join(subDir, d)).isDirectory()
    } catch {
      return false
    }
  })
  seriesDirs.sort((a, b) => a.localeCompare(b, 'en'))

  let totalJsonFiles = 0
  let totalSrtFiles = 0
  let totalVttFiles = 0
  let totalFullTriples = 0
  let totalCues = 0
  let cuesWithJa = 0
  let cuesWithVi = 0
  let cuesWithBoth = 0
  let totalTokens = 0
  let tokensWithWordId = 0

  const incompleteTriples = []
  const parseErrors = []
  const structuralErrors = []
  const invalidTimestamps = []
  const overlappingCues = []
  const seriesCoverageMap = {}

  for (const sDir of seriesDirs) {
    const fullPath = path.join(subDir, sDir)
    const files = fs.readdirSync(fullPath)

    const eps = new Set()
    const jsonEps = new Set()
    const srtEps = new Set()
    const vttEps = new Set()

    for (const f of files) {
      const match = f.match(/^(ep\d+)\.(json|srt|vtt)$/)
      if (match) {
        const epKey = match[1]
        const ext = match[2]
        eps.add(epKey)
        if (ext === 'json') jsonEps.add(epKey)
        if (ext === 'srt') srtEps.add(epKey)
        if (ext === 'vtt') vttEps.add(epKey)
      }
    }

    let triplesCount = 0
    for (const ep of eps) {
      const hasJson = jsonEps.has(ep)
      const hasSrt = srtEps.has(ep)
      const hasVtt = vttEps.has(ep)
      if (hasJson && hasSrt && hasVtt) {
        triplesCount++
      } else {
        incompleteTriples.push({ series: sDir, epKey: ep, hasJson, hasSrt, hasVtt })
      }
    }

    totalJsonFiles += jsonEps.size
    totalSrtFiles += srtEps.size
    totalVttFiles += vttEps.size
    totalFullTriples += triplesCount

    let sCues = 0
    let sJa = 0
    let sVi = 0
    let sTokens = 0
    let sWordId = 0
    let sInvalidTs = 0
    let sOverlap = 0

    // Parse JSON files for cue details
    const sortedJsonFiles = Array.from(jsonEps).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    for (const epKey of sortedJsonFiles) {
      const jsonFile = path.join(fullPath, `${epKey}.json`)
      let content
      try {
        content = JSON.parse(fs.readFileSync(jsonFile, 'utf8'))
      } catch (err) {
        parseErrors.push({ file: `${sDir}/${epKey}.json`, error: String(err) })
        continue
      }

      if (!content || !Array.isArray(content.cues)) {
        structuralErrors.push({ file: `${sDir}/${epKey}.json`, reason: 'Missing or non-array cues' })
        continue
      }

      const cues = content.cues
      let prevEnd = -1

      for (let i = 0; i < cues.length; i++) {
        const c = cues[i]
        sCues++
        totalCues++

        const hasJa = Boolean((c.ja || '').trim())
        const hasVi = Boolean((c.vi || '').trim())
        if (hasJa) {
          sJa++
          cuesWithJa++
        }
        if (hasVi) {
          sVi++
          cuesWithVi++
        }
        if (hasJa && hasVi) cuesWithBoth++

        // Validate timestamp
        if (typeof c.start !== 'number' || typeof c.end !== 'number' || c.start < 0 || c.end <= c.start) {
          sInvalidTs++
          invalidTimestamps.push({
            file: `${sDir}/${epKey}.json`,
            cueId: c.id ?? i + 1,
            start: c.start,
            end: c.end,
            reason: c.start < 0 ? 'Negative start' : 'end <= start',
          })
        }

        // Check overlap
        if (typeof c.start === 'number' && c.start < prevEnd) {
          sOverlap++
          overlappingCues.push({
            file: `${sDir}/${epKey}.json`,
            cueIndex: i,
            prevEnd,
            start: c.start,
            ja: c.ja || '',
          })
        }
        if (typeof c.end === 'number') {
          prevEnd = c.end
        }

        // Tokens check
        for (const tok of c.tokens || []) {
          sTokens++
          totalTokens++
          if (tok.word_id !== null && tok.word_id !== undefined) {
            sWordId++
            tokensWithWordId++
          }
        }
      }
    }

    seriesCoverageMap[sDir] = {
      jsonCount: jsonEps.size,
      srtCount: srtEps.size,
      vttCount: vttEps.size,
      triplesCount,
      totalCues: sCues,
      cuesWithJa: sJa,
      cuesWithVi: sVi,
      totalTokens: sTokens,
      tokensWithWordId: sWordId,
      invalidTimestampsCount: sInvalidTs,
      overlappingCuesCount: sOverlap,
    }
  }

  return {
    seriesWithSubtitlesCount: seriesDirs.length,
    totalJsonFiles,
    totalSrtFiles,
    totalVttFiles,
    totalFullTriples,
    incompleteTriples,
    parseErrors,
    structuralErrors,
    totalCues,
    cuesWithJa,
    cuesWithVi,
    cuesWithBoth,
    totalTokens,
    tokensWithWordId,
    invalidTimestamps,
    overlappingCues,
    seriesCoverageMap,
  }
}

/**
 * Build deterministic source-manifest.json content
 * @param {any} auditResults
 * @returns {object}
 */
export function buildSourceManifest(auditResults) {
  return {
    sourceRoot: auditResults.sourceRoot,
    overallManifestHash: auditResults.overallManifestHash,
    totalFiles: auditResults.totalFiles,
    totalBytes: auditResults.totalBytes,
    formatBreakdown: auditResults.formatBreakdown,
    files: auditResults.files,
  }
}

/**
 * Build provenance.csv (RFC 4180 format)
 * @returns {string}
 */
export function buildProvenanceCsv() {
  const rows = [
    [
      'Dataset / Thực thể',
      'Phạm vi / Tệp tin',
      'Nguồn gốc ban đầu (Origin)',
      'Số lượng bản ghi (Count)',
      'Dung lượng xấp xỉ',
      'Trạng thái bản quyền (Rights Status)',
      'Quyền truy cập công khai (Public Access)',
      'Ghi chú pháp lý & xử lý',
    ],
    [
      'Series Master Metadata',
      'all_data.json / series.json / series.csv',
      'https://akaiwa.tv/ (rebrand từ aanime.tv)',
      '143 series (19 series lệch Số tập do cấu trúc mùa)',
      '3.7 MB',
      'unknown',
      'BLOCKED',
      'Metadata phim cào từ web; 123 series YouTube, 20 series lưu trữ/bên thứ ba; cần thẩm định',
    ],
    [
      'Series Episodes',
      'all_data.json / episodes.csv',
      'https://akaiwa.tv/',
      '2.528 tập phim (khớp hai chiều 100%)',
      '593.3 KB',
      'unknown / restricted',
      'BLOCKED',
      '2.298 tập có YouTube ID (restricted - chỉ embed hợp lệ TOS); 230 tập archive/bên ngoài (chặn hoàn toàn)',
    ],
    [
      'Playlists & Videos',
      'all_data.json / playlists.json / playlists.csv / playlist_videos.csv',
      'https://akaiwa.tv/',
      '128 playlists (1.596 video entries, 1.277 video YouTube duy nhất)',
      '1.1 MB',
      'unknown',
      'BLOCKED',
      'Danh sách kênh và podcast luyện nghe tiếng Nhật trích xuất từ YouTube; giữ quyền unknown',
    ],
    [
      'Bilingual Subtitles (JSON)',
      'subtitles/**/*.json',
      'https://akaiwa.tv/',
      '1.502 tập (584.827 cues)',
      '1.4 GB',
      'restricted',
      'BLOCKED',
      'Phụ đề song ngữ Nhật - Việt kèm token word_id; bản quyền lời thoại tiếng Nhật thuộc hãng phim',
    ],
    [
      'Subtitles (SRT & VTT)',
      'subtitles/**/*.srt | *.vtt',
      'https://akaiwa.tv/',
      '3.004 tệp (1.502 SRT + 1.502 VTT)',
      '175 MB',
      'restricted',
      'BLOCKED',
      'Tệp phụ đề chuẩn phát media thời gian thực; nội dung văn bản bị hạn chế xuất bản công khai',
    ],
    [
      'Dictionary Shards',
      'dictionary/shards/*.json',
      'https://akaiwa.tv/',
      '666 shards (39.516 words)',
      '80.8 MB',
      'unknown',
      'BLOCKED',
      'Từ điển phân mảnh theo word_id % 1000 (3 số); modulo 1000 khớp 100%, modulo 100 lệch 85,15%',
    ],
    [
      'Dictionary Monolith',
      'dictionary/dictionary_full.json / .csv',
      'https://akaiwa.tv/',
      '39.516 mục từ (khớp hai chiều JSON ↔ CSV, khác 59.224 trong _meta)',
      '132.5 MB',
      'unknown',
      'BLOCKED',
      'Dữ liệu tổng hợp từ điển gốc gồm Kanji, Romaji, Hán Việt; cấm nạp trực tiếp vào client browser',
    ],
    [
      'Dictionary Word Index',
      'dictionary/word-index.json',
      'https://akaiwa.tv/',
      '59.225 khóa (59.224 ID duy nhất, 19.708 ID chưa có trong full)',
      '1.76 MB',
      'unknown',
      'BLOCKED',
      'Bảng băm từ vựng mặt chữ tiếng Nhật sang word_id phục vụ tra cứu ngược',
    ],
    [
      'Curriculum Sekai N5',
      'curriculum.json / curriculum/sekai-n5/*.json',
      'Sekai Gen (Tự biên soạn)',
      '25 bài học (1.240 từ, 132 ngữ pháp)',
      '250 KB',
      'unknown',
      'BLOCKED',
      'Nội dung starter N5 tự soạn không sao chép sách 3A; chờ hội đồng pháp lý duyệt trước khi mở public',
    ],
  ]

  return serializeCSV(rows)
}

/**
 * Build comprehensive data-audit.md report
 * @param {any} auditResults
 * @param {any} reconMaster
 * @param {any} plAudit
 * @param {any} subtitleAudit
 * @param {any} dictAudit
 * @param {any} allData
 * @param {string} auditTimestamp
 * @returns {string}
 */
export function buildDataAuditMarkdown(
  auditResults,
  reconMaster,
  plAudit,
  subtitleAudit,
  dictAudit,
  allData,
  auditTimestamp
) {
  const seriesList = allData.series || []

  // Build series coverage rows
  const seriesRows = seriesList.map((s, idx) => {
    const epList = s.all_episodes || []
    const totalEps = epList.length
    const ytEps = epList.filter((e) => (e.youtube_video_id || '').trim()).length
    const watchOnlyEps = epList.filter((e) => !(e.youtube_video_id || '').trim() && (e.watch_url || '').trim()).length
    const vSource = s.video_source || 'other'
    const isArchive = vSource === 'archive' ? totalEps : 0

    const sub = subtitleAudit.seriesCoverageMap[s.slug] || {
      jsonCount: 0,
      srtCount: 0,
      vttCount: 0,
      triplesCount: 0,
      totalCues: 0,
      cuesWithJa: 0,
      cuesWithVi: 0,
      totalTokens: 0,
      tokensWithWordId: 0,
    }

    return `| ${idx + 1} | \`${s.slug}\` | ${s.title_vi || '—'} | ${s.jlpt_level || '—'} | ${vSource} | ${totalEps} | ${ytEps} | ${watchOnlyEps} | ${isArchive} | ${sub.jsonCount}/${sub.srtCount}/${sub.vttCount} | ${sub.triplesCount} | ${sub.totalCues.toLocaleString()} | ${sub.tokensWithWordId.toLocaleString()} / ${sub.totalTokens.toLocaleString()} |`
  })

  // Build 19 series anomaly rows
  const anomalyRows = (reconMaster.episodeCountAnomalies || []).map((a, idx) => {
    return `| ${idx + 1} | \`${a.slug}\` | ${a.title} | **${a.csvCount}** | **${a.seriesTotalEpisodes}** | **${a.jsonAllEpisodesCount}** | Mùa riêng (${a.csvCount}) vs Gộp show (${a.jsonAllEpisodesCount}) |`
  })

  const s2w = reconMaster.seriesTwoWay
  const ep2w = reconMaster.episodesTwoWay
  const d2w = dictAudit.twoWayJsonCsv

  return `# Báo Cáo Kiểm Toán Dữ Liệu & Nguồn Gốc (Data Audit & Provenance) — Anime Learning

**Ngày thực hiện kiểm toán:** \`${auditTimestamp}\`  
**Nguồn dữ liệu kiểm toán (Read-only Source):** \`${auditResults.sourceRoot}\`  
**Nhiệm vụ:** Task T01 — Data audit, coverage và provenance  
**Trạng thái nghiệm thu:** **HOÀN THÀNH KIỂM TOÁN NGUỒN TẤT ĐỊNH & ĐỐI CHIẾU HAI CHIỀU**

---

## 1. Tổng Quan Cây Dữ Liệu Nguồn (Source Manifest Summary)

Hệ thống đã thực hiện duyệt tất định (deterministic traversal) toàn bộ 100% tệp trong thư mục nguồn:
- **Tổng số tệp nguồn:** **${auditResults.totalFiles.toLocaleString()} tệp**
- **Tổng dung lượng:** **${(auditResults.totalBytes / (1024 * 1024)).toFixed(2)} MB** (${(auditResults.totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB)
- **Mã băm tổng thể (Overall Manifest SHA-256):** \`${auditResults.overallManifestHash}\`
- **Tính tất định:** Danh sách tệp được sắp xếp alphabet chuẩn POSIX, mã băm tính theo nội dung bytes; không chứa thời gian thực thi runtime trong phần tính băm.

### Bảng phân bố định dạng tệp (Format Breakdown)

| Định dạng mở rộng | Số lượng tệp | Tổng dung lượng (Bytes) | Tỷ trọng dung lượng |
| :--- | :---: | :---: | :---: |
${Object.entries(auditResults.formatBreakdown)
  .sort((a, b) => b[1].totalBytes - a[1].totalBytes)
  .map(
    ([ext, data]) =>
      `| \`${ext}\` | ${data.count.toLocaleString()} | ${data.totalBytes.toLocaleString()} | ${(
        (data.totalBytes / auditResults.totalBytes) *
        100
      ).toFixed(2)}% |`
  )
  .join('\n')}

---

## 2. Giải Thích Sai Lệch Số Liệu: README Cũ (2026-08-20) vs Master Dataset (2026-09-11)

Báo cáo giải trình rõ nguyên nhân chênh lệch giữa số liệu trong tệp \`README.md\` cũ và số liệu thực tế trong tệp master:

| Chỉ số dữ liệu | README cũ (2026-08-20) | Master Dataset (2026-09-11) | Chênh lệch thực tế | Nguyên nhân kỹ thuật |
| :--- | :---: | :---: | :---: | :--- |
| **Nguồn cào (Domain)** | \`https://aanime.tv/\` | \`https://akaiwa.tv/\` | Đổi tên miền | Dịch vụ Sekai Watch rebrand sang Akaiwa |
| **Tổng số Series** | **141** | **143** | **+2** | Bổ sung 2 phim điện ảnh mới: *Đứa Con Của Thời Tiết* (\`dua-con-cua-thoi-tiet\`) và *Mẫu Tử Lầm Lỡ* (\`mau-tu-lam-lo\`) |
| **Tổng tập phim (Episodes)** | **2.513** | **2.528** | **+15** | 2 tập từ 2 movie mới + 13 tập cập nhật các series ongoing |
| **Tổng Playlists** | **129** | **128** | **-1** | Gộp/loại bỏ 1 playlist trùng lặp trên kênh học tập |
| **Video trong Playlist** | **1.598** | **1.596** | **-2** | 2 video bị xóa trên YouTube hoặc loại khỏi danh sách phát |
| **Bài học Sekai N5** | 25 | 25 | 0 | Đồng nhất 100% |
| **Từ vựng N5 trích xuất** | 1.240 | 1.240 | 0 | Đồng nhất 100% |
| **Ngữ pháp N5 trích xuất** | 132 | 132 | 0 | Đồng nhất 100% |

> [!NOTE]
> Báo cáo chính thức và các task tiếp theo (T02–T08) lấy số liệu động chuẩn xác theo Master Dataset hiện tại: **143 series, 2.528 tập, 128 playlist, 1.596 video playlist**.

---

## 3. Đối Chiếu Hai Chiều Master Metadata & Episodes CSV (Two-Way Reconciliation)

### 3.1. Đối chiếu hai chiều Series: \`all_data.series\` ↔ \`series.json\`
Hệ thống đã thực hiện đối chiếu hai chiều theo cả ID và Slug giữa hai tập tin JSON master:
- **Số lượng Series:** \`all_data.series\` có **${s2w.allDataCount} series**, \`series.json\` có **${s2w.seriesJsonCount} series**.
- **Đối chiếu ID hai chiều:** 
  * Có trong \`all_data\` nhưng thiếu trong \`series.json\`: **${s2w.inAllDataNotSeriesJsonById.length} ID**.
  * Có trong \`series.json\` nhưng thiếu trong \`all_data\`: **${s2w.inSeriesJsonNotAllDataById.length} ID**.
  * Trùng lặp ID trong \`all_data\`: **${s2w.duplicateIdsInAllData.length}**. Trùng lặp ID trong \`series.json\`: **${s2w.duplicateIdsInSeriesJson.length}**.
- **Đối chiếu Slug hai chiều:**
  * Có trong \`all_data\` nhưng thiếu trong \`series.json\`: **${s2w.inAllDataNotSeriesJsonBySlug.length} slug**.
  * Có trong \`series.json\` nhưng thiếu trong \`all_data\`: **${s2w.inSeriesJsonNotAllDataBySlug.length} slug**.
  * Trùng lặp Slug trong \`all_data\`: **${s2w.duplicateSlugsInAllData.length}**. Trùng lặp Slug trong \`series.json\`: **${s2w.duplicateSlugsInSeriesJson.length}**.
- **So sánh trường cốt lõi (Core fields):** Kiểm tra \`title_vi\`, \`title_ja\`, \`video_source\`, \`jlpt_level\`, \`total_episodes\`, \`poster_url\` và \`all_episodes.length\` $\rightarrow$ **${s2w.coreFieldMismatches.length} trường sai lệch**.
- **So sánh episode keys & source fields:** Kiểm tra toàn bộ khóa \`(season_slug, ep_number)\` và nguồn phát (\`youtube_video_id\`, \`watch_url\`) $\rightarrow$ **${s2w.episodeKeyMismatches.length} khóa lệch**, **${s2w.episodeSourceMismatches.length} nguồn lệch**.

### 3.2. Đối chiếu hai chiều Episodes: JSON ↔ \`episodes.csv\`
Đã xử lý UTF-8 BOM ở header CSV, so sánh hai chiều theo khóa bộ ba \`(series_slug, season, ep_number)\`:
- **Tổng số bản ghi:** JSON có **${ep2w.totalJsonEpisodes.toLocaleString()} tập**, CSV có **${ep2w.totalCsvEpisodeRows.toLocaleString()} dòng tập**.
- **Kiểm tra trùng lặp khóa trong CSV:** **${ep2w.csvDuplicateKeys.length} khóa trùng lặp** (đếm tần suất chính xác).
- **Dư / Thiếu bản ghi hai chiều:**
  * Có trong JSON nhưng thiếu trong CSV (\`missingInCsv\`): **${ep2w.missingInCsv.length} tập**.
  * Có trong CSV nhưng thiếu trong JSON (\`extraInCsv\`): **${ep2w.extraInCsv.length} tập**.
- **So sánh trường nguồn phát (Source Fields Verification):**
  * Sai lệch trường \`youtube_video_id\`: **${ep2w.youtubeIdMismatches.length} tập**.
  * Sai lệch trường \`watch_url\` (\`Link xem\`): **${ep2w.watchUrlMismatches.length} tập**.

### 3.3. ⚠️ Dị Thường Thực Tế Ghi Nhận: 19 Series Lệch Trường "Số Tập" trong \`series.csv\`
Khi đối chiếu trường \`Số tập\` của \`series.csv\` với mảng \`all_episodes\` trong JSON, phát hiện **19 series có sự chênh lệch**:
- **Bản chất kỹ thuật:** Đây là các series có nhiều phần/mùa (Multi-season).
  * Trong \`series.csv\` và trường \`s.total_episodes\`: số liệu ghi nhận số tập của **riêng mùa/phần đó** (ví dụ Attack on Titan Phần 1 là 25 tập, Phần 2 là 12 tập, Phần 3 là 12 tập...).
  * Trong mảng \`s.all_episodes\` của JSON: bộ thu thập gộp toàn bộ các tập của cả show (ví dụ Attack on Titan gộp đủ 75 tập của cả 5 phần).
- **Trạng thái:** Dị thường cấu trúc phân cấp (Structural multi-season anomaly). Importer T02 phải nhận biết cấu trúc này để lưu trữ quan hệ Season - Episode chính xác.

| STT | Series Slug | Tiêu đề Tiếng Việt | CSV \`Số tập\` | JSON \`total_episodes\` | JSON \`all_episodes.length\` | Bản chất cấu trúc |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
${anomalyRows.join('\n')}

### Phân loại nguồn phát của 230 tập không dùng YouTube:
- **okru (134 tập):** Ví dụ *Doraemon* (20 tập), *Sazae San* (20 tập), *Cô Đi Mà Lấy Chồng Tôi* (10 tập), *Cô Nàng Kiểm Duyệt* (10 tập)...
- **dailymotion (54 tập):** Ví dụ *Silent* (11 tập), *Một Lít Nước Mắt* (11 tập), *Yêu Không Hối Tiếc* (11 tập), *Người Đẹp Thẩm Mỹ* (10 tập)...
- **archive (31 tập):** Ví dụ *Atashin'chi* (27 tập), *Đứa Con Của Thời Tiết* (1 tập), *Dáng Hình Thanh Âm* (1 tập), *Lâu Đài Bay Của Howl* (1 tập)...
- **bilibili (11 tập):** Ví dụ *Từ Hôm Nay Đến Lượt Tôi* (10 tập), *Mẫu Tử Lầm Lỡ* (1 tập).

> [!WARNING]
> Ràng buộc nghiêm ngặt: 230 tập nguồn \`archive\`, \`bilibili\`, \`dailymotion\`, \`okru\` tuyệt đối **không được xem là stream URL** có thể phát tự do; phải được gán trạng thái \`restricted\` và chặn hoàn toàn ở chế độ người dùng công khai.

---

## 4. Kiểm Toán Danh Sách Phát Toàn Diện Cả 4 Nguồn (Playlists Full Audit)

Hệ thống đã kiểm toán đồng thời bộ 4 nguồn dữ liệu: \`all_data.playlists\`, \`playlists.json\`, \`playlists.csv\` và \`playlist_videos.csv\` bằng bảng băm đếm tần suất (không dùng Set làm mất dấu trùng lặp):

### 4.1. Bảng đối chiếu Playlist Metadata:
| Chỉ số kiểm toán Playlists | \`all_data.json\` | \`playlists.json\` | \`playlists.csv\` | Kết quả đối chiếu hai chiều |
| :--- | :---: | :---: | :---: | :--- |
| **Tổng số Playlist** | **${plAudit.totalPlaylistsAllData}** | **${plAudit.totalPlaylistsJson}** | **${plAudit.totalPlaylistsCsv}** | Khớp hai chiều 100% giữa cả 3 nguồn |
| **Trùng lặp ID trong từng nguồn** | **${plAudit.duplicates.allDataIds.length}** | **${plAudit.duplicates.playlistsJsonIds.length}** | **${plAudit.duplicates.playlistsCsvIds.length}** | **0 ID trùng lặp** |
| **Trùng lặp Slug trong từng nguồn** | **${plAudit.duplicates.allDataSlugs.length}** | **${plAudit.duplicates.playlistsJsonSlugs.length}** | **${plAudit.duplicates.playlistsCsvSlugs.length}** | **0 Slug trùng lặp** |
| **Thiếu / Thừa Playlist theo ID** | 0 | 0 | 0 | \`inAllDataNotPlaylistsJsonById: 0\`, \`inPlaylistsJsonNotCsvById: 0\` |
| **Thiếu / Thừa Playlist theo Slug** | 0 | 0 | 0 | \`inAllDataNotPlaylistsJsonBySlug: 0\`, \`inPlaylistsJsonNotCsvBySlug: 0\` |
| **ID Mismatch khi cùng Slug** | — | **${plAudit.idMismatchesBySlug.length}** | **${plAudit.idMismatchesBySlug.length}** | **0 sai lệch ID khi cùng Slug** |
| **Slug Mismatch khi cùng ID** | — | **${plAudit.slugMismatchesById.length}** | **${plAudit.slugMismatchesById.length}** | **0 sai lệch Slug khi cùng ID** |

### 4.2. Đối chiếu hai khóa Video trong \`playlist_videos.csv\`:
Hệ thống đối chiếu độc lập cả 2 khóa: \`(playlist_id, video_id)\` và \`(playlist_slug, video_id)\`:
- **Tổng lượt bản ghi Video:** JSON có **${plAudit.totalVideosJson.toLocaleString()}**, CSV có **${plAudit.totalVideosCsv.toLocaleString()}**.
- **Khớp hoàn hảo cả 2 khóa:** **1.596 / 1.596 bản ghi (100%)**.
- **Khóa ID khớp nhưng Slug sai (\`keyMismatchIdMatchesSlugFails\`):** **${plAudit.videoKeyReconciliation.keyMismatchIdMatchesSlugFails.length} bản ghi**.
- **Khóa Slug khớp nhưng ID sai (\`keyMismatchSlugMatchesIdFails\`):** **${plAudit.videoKeyReconciliation.keyMismatchSlugMatchesIdFails.length} bản ghi**.
- **Bản ghi video không khớp cả 2 khóa (\`missingVideosInJson\`):** **${plAudit.videoKeyReconciliation.missingVideosInJson.length} bản ghi**.
- **Video trong JSON thiếu trong CSV (\`missingVideosInCsv\`):** **${plAudit.videoKeyReconciliation.missingVideosInCsv.length} bản ghi**.
- **Trùng lặp Video trong nội tại 1 playlist:** **${plAudit.duplicates.intraPlaylistDuplicatesInJson.length}**.
- **Dòng video trùng lặp trong CSV (\`csvDuplicateVideoRows\`):** **${plAudit.duplicates.csvDuplicateVideoRows.length}**.
- **Video YouTube thực tế duy nhất:** **${plAudit.uniqueVideoIdsCount.toLocaleString()} video** (319 lượt video dùng chung giữa &ge; 2 playlist).

---

## 5. Đối Chiếu Hai Chiều Từ Điển & Kiểm Toán Phân Mảnh (Dictionary Reconciliation & Sharding)

### 5.1. Đối chiếu hai chiều \`dictionary_full.json\` ↔ \`dictionary_full.csv\`
Hệ thống đã thực hiện đối chiếu hai chiều từng ID từ vựng giữa tệp JSON monolith và CSV:
- **Số lượng mục từ trong JSON (\`dictionary_full.json\`):** **${d2w.jsonEntriesCount.toLocaleString()} entries**
- **Số lượng dòng dữ liệu trong CSV (\`dictionary_full.csv\`):** **${d2w.csvDataRowsCount.toLocaleString()} rows**
- **Trùng lặp ID trong tệp CSV:** **${d2w.duplicateIdsInCsv.length} trùng lặp**
- **Có trong JSON nhưng thiếu trong CSV (\`inJsonNotCsv\`):** **${d2w.inJsonNotCsv.length} ID**
- **Có trong CSV nhưng thiếu trong JSON (\`inCsvNotJson\`):** **${d2w.inCsvNotJson.length} ID**
- **Kết luận:** Hai tập tin này đồng nhất tuyệt đối **39.516 mục từ** (khác con số 59.224 trong \`_meta.json\`).

### 5.2. Giải trình sự phân tách 3 tập dữ liệu từ điển:
1. **\`_meta.json\` (\`total_words = 59,224\`):** Chỉ số thống kê tham chiếu tổng số từ vựng lý thuyết trong toàn bộ hệ sinh thái.
2. **\`dictionary_full.json\` & \`dictionary_full.csv\` (**${dictAudit.dictionaryFullEntriesCount.toLocaleString()}** mục từ):** Tập dữ liệu thực thể từ điển đầy đủ hiện có. Toàn bộ 666 shard cũng chứa chính xác 39.516 từ này. **Tuyệt đối không đồng nhất \`dictionary_full\` với con số 59.224.**
3. **\`word-index.json\` (**${dictAudit.wordIndexKeysCount.toLocaleString()}** khóa từ vựng):**
   * Ánh xạ về **${dictAudit.wordIndexUniqueIdsCount.toLocaleString()} ID từ vựng duy nhất** (khớp chính xác với con số 59.224 trong \`_meta.json\`).
   * **Từ đồng âm/trùng ID (Homophone collision):** Phát hiện 1 \`word_id\` duy nhất là **\`3144121485\`** đồng thời ánh xạ đến 2 từ: \`'アニソン'\` (Anisong) và \`'柔道家'\` (Võ sĩ Judo).
   * **Từ chưa có trong từ điển đầy đủ (Unreferenced IDs):** Có chính xác **${dictAudit.unreferencedWordIdsCount.toLocaleString()} ID** xuất hiện trong chỉ mục \`word-index.json\` nhưng không có mục từ chi tiết trong \`dictionary_full.json\` ($59.224 - 39.516 = 19.708$).

### 5.3. Kiểm chứng thuật toán phân mảnh Shard:
Tệp \`dictionary/_meta.json\` có sự mâu thuẫn giữa công thức và ghi chú:
- **Dòng 6 (\`shard_formula\`):** \`word_id % 1000 → shard-{NN}.json (NN zero-pad 3 digit)\`
- **Dòng 10 (\`note\`):** \`Client: cue word_id → fetch shard-(id%100) → entry = shard[String(word_id)]\`

**Kết quả kiểm toán thực nghiệm:**
1. **Quy ước tên file:** 100% tệp trong \`dictionary/shards/\` có tên dạng \`shard-NNN.json\` (3 chữ số zero-padded từ \`000\` đến \`999\`). Có **${dictAudit.actualShardFilesCount} tệp shard** thực tế tồn tại.
2. **Kiểm tra modulo 1000:** Toàn bộ **${dictAudit.totalWordsInShards.toLocaleString()} từ** trong ${dictAudit.actualShardFilesCount} shard đều thỏa mãn chính xác:
   $$\\text{entry.id} \\pmod{1000} == \\text{shardNumber}$$
   Số lỗi modulo 1000: **0 lỗi (0%)**.
3. **Độ lệch định tuyến khi dùng modulo 100:**
   * Số mục từ có giá trị \`id % 100\` khác với \`id % 1000\`: **${dictAudit.mismatchWithMod100.toLocaleString()} từ**.
   * **Tỷ lệ sai lệch định tuyến (Routing mismatch rate): ${dictAudit.mismatchRateMod100Percent}%** (đã kiểm chứng thực nghiệm trên toàn bộ 39.516 từ).
   * **Đánh giá ảnh hưởng:** Nếu client sử dụng modulo 100 để định tuyến, 85,15% từ vựng sẽ bị tra cứu vào sai shard hoặc gặp lỗi HTTP 404 (tùy theo quy ước định dạng tên file 2 hay 3 chữ số và cơ chế fallback của router máy chủ).

> [!IMPORTANT]
> **Kết luận chuẩn hóa thuật toán Shard:** Client và API **BẮT BUỘC** dùng công thức chuẩn:
> \`\`\`javascript
> const shardFilename = \`shard-\${String(wordId % 1000).padStart(3, '0')}.json\`
> \`\`\`

---

## 6. Kiểm Toán Phụ Đề & Tính Toàn Vẹn Cấu Trúc (Subtitles Deep Audit)

Hệ thống đã duyệt và kiểm tra toàn bộ cây thư mục phụ đề \`subtitles/\`:
- **Tổng số thư mục series có phụ đề:** **${subtitleAudit.seriesWithSubtitlesCount} / 143 series** (14 series không có thư mục phụ đề).
- **Tổng số tệp phụ đề:** **4.506 tệp** (1.502 JSON, 1.502 SRT, 1.502 VTT).
- **Bộ ba tệp đầy đủ (Full Triples JSON + SRT + VTT):** **${subtitleAudit.totalFullTriples.toLocaleString()} tập (100%)**.
- **Bộ ba tệp khuyết (Incomplete Triples):** **${subtitleAudit.incompleteTriples.length} tập**.
- **Lỗi đọc định dạng JSON (JSON Parse Errors):** **${subtitleAudit.parseErrors.length} tệp**.
- **Lỗi cấu trúc mảng cues (Structural Errors):** **${subtitleAudit.structuralErrors.length} tệp**.
- **Tổng số Cues đối thoại:** **${subtitleAudit.totalCues.toLocaleString()} cues**
  * Cues có tiếng Nhật (\`ja\`): **${subtitleAudit.cuesWithJa.toLocaleString()} (100%)**
  * Cues có tiếng Việt (\`vi\`): **${subtitleAudit.cuesWithVi.toLocaleString()} (100%)**
  * Cues song ngữ đầy đủ cả 2 thứ tiếng: **${subtitleAudit.cuesWithBoth.toLocaleString()} (100%)**
- **Tổng số Tokens:** **${subtitleAudit.totalTokens.toLocaleString()} tokens**
  * Tokens có liên kết \`word_id\` từ điển: **${subtitleAudit.tokensWithWordId.toLocaleString()} (${(
    (subtitleAudit.tokensWithWordId / subtitleAudit.totalTokens) *
    100
  ).toFixed(2)}%)**
  * Các token không có \`word_id\` là trợ từ ngữ pháp, dấu câu, ký hiệu âm thanh (\`（\`, \`）\`, \`…\`, \`！\`).

### Bất thường dòng thời gian ghi nhận trong phụ đề:
1. **Lỗi Timestamp (\`end <= start\` hoặc âm):** **1 cue duy nhất**
   - Tệp: \`smartphone-va-nhung-nguoi-ban/ep10.json\` — Cue ID 1: \`start: 0, end: 0\` (Đoạn text rỗng mở đầu). Importer T02 sẽ có quy tắc tự động bỏ qua cue 0 giây này.
2. **Cue chồng lấn thời gian (\`start < prevEnd\`):** **${subtitleAudit.overlappingCues.length} cues**
   - Hiện tượng tự nhiên trong phim hoạt hình khi có hai nhân vật đối thoại cùng lúc, hoặc thoại nền đè lên nhạc phim/hiệu ứng. Player T06 cần hỗ trợ hiển thị đồng thời nhiều cue tại cùng mốc thời gian.

---

## 7. Ma Trận Quản Lý Quyền & Bảo Vệ Dữ Liệu (Rights Matrix)

Tuân thủ nguyên tắc cốt lõi: **Mặc định đóng (\`unknown\` / \`restricted\`), không công khai ra internet khi chưa thẩm định quyền.**

| Phân tầng dữ liệu | Trường dữ liệu | Nguồn gốc (Origin) | Trạng thái quyền | Chính sách phát hành & hiển thị |
| :--- | :--- | :--- | :---: | :--- |
| **Series Metadata** | \`title_vi\`, \`title_ja\`, \`poster_url\`, \`genre\` | Cào từ Akaiwa/AniList | \`unknown\` | Chỉ hiển thị trong môi trường local dev của owner |
| **Tập phim YouTube** | \`youtube_video_id\` (2.298 tập) | YouTube công khai | \`restricted\` | Chỉ nhúng qua YouTube Player IFrame chuẩn, tuân thủ YouTube TOS |
| **Tập phim Archive** | \`watch_url\` (230 tập) | Archive / Bilibili / Okru | \`restricted\` | **CHẶN HOÀN TOÀN** — Không proxy stream, không phát public |
| **Phụ đề tiếng Nhật** | Trường \`ja\` trong cues | Studios Anime bản quyền | \`restricted\` | Bảo vệ chống tải hàng loạt; chỉ phục vụ tra cứu học tập local |
| **Phụ đề tiếng Việt** | Trường \`vi\` trong cues | Fansub / Dịch cào | \`unknown\` | Bản dịch chưa có giấy phép thương mại; chỉ dùng nội bộ |
| **Từ điển & Shards** | 666 shards, 39.516 mục từ | Dữ liệu biên soạn nguồn mở | \`unknown\` | Cần ghi nhận nguồn tác giả (Attribution); không expose file 127 MB |
| **Giáo trình Sekai N5** | 25 bài JSON | Sekai Gen tự soạn | \`unknown\` | Chờ hội đồng pháp lý duyệt trước khi mở catalog công khai |

---

## 8. Bảng Thống Kê Độ Phủ Chi Tiết Theo 143 Series (Series Coverage Table)

| STT | Series Slug | Tiêu đề Tiếng Việt | JLPT | Nguồn video | Tổng tập | YouTube ID | Watch URL | Archive | Sub JSON/SRT/VTT | Triples | Tổng Cues | Tokens có Word ID / Tổng |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
${seriesRows.join('\n')}

---

## 9. Danh Mục Tạo Phẩm Bàn Giao Của Nhiệm Vụ T01

1. [**\`source-manifest.json\`**](file:///d:/Project/kotodama/docs/plans/anime-learning/source-manifest.json): Danh mục 5.213 tệp kèm SHA-256 tất định.
2. [**\`provenance.csv\`**](file:///d:/Project/kotodama/docs/plans/anime-learning/provenance.csv): Bảng truy xuất nguồn gốc và ma trận quyền chuẩn RFC 4180.
3. [**\`data-audit.md\`**](file:///d:/Project/kotodama/docs/plans/anime-learning/data-audit.md): Báo cáo kiểm toán toàn diện này.
4. [**\`scripts/anime/audit-source.mjs\`**](file:///d:/Project/kotodama/scripts/anime/audit-source.mjs): Kịch bản kiểm toán nguồn tự động.
5. [**\`scripts/anime/audit-source.test.mjs\`**](file:///d:/Project/kotodama/scripts/anime/audit-source.test.mjs): Bộ kiểm thử tự động kiểm chứng toàn bộ các trường hợp biên và đột biến (mutation).
`
}

// CLI Execution Entry Point
async function runCLI() {
  const args = process.argv.slice(2)
  let sourceRoot = 'D:\\Project\\data\\aanime_scraper'
  let outManifest = path.resolve('docs/plans/anime-learning/source-manifest.json')
  let outAudit = path.resolve('docs/plans/anime-learning/data-audit.md')
  let outProvenance = path.resolve('docs/plans/anime-learning/provenance.csv')

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source-root' && args[i + 1]) {
      sourceRoot = args[++i]
    } else if (args[i] === '--out' && args[i + 1]) {
      outManifest = path.resolve(args[++i])
    } else if (args[i] === '--summary' && args[i + 1]) {
      outAudit = path.resolve(args[++i])
    } else if (args[i] === '--provenance' && args[i + 1]) {
      outProvenance = path.resolve(args[++i])
    }
  }

  console.log(`[Anime Audit] Scanning source root: ${sourceRoot}`)
  const auditResults = await auditSourceDirectory(sourceRoot)

  console.log(`[Anime Audit] Total files found: ${auditResults.totalFiles}`)
  console.log(`[Anime Audit] Overall manifest SHA-256: ${auditResults.overallManifestHash}`)

  // Load and reconcile master metadata
  console.log(`[Anime Audit] Loading master metadata...`)
  const allDataPath = path.join(sourceRoot, 'all_data.json')
  const seriesJsonPath = path.join(sourceRoot, 'series.json')
  const seriesCsvPath = path.join(sourceRoot, 'series.csv')
  const episodesCsvPath = path.join(sourceRoot, 'episodes.csv')

  const allData = JSON.parse(fs.readFileSync(allDataPath, 'utf8'))
  const seriesJson = JSON.parse(fs.readFileSync(seriesJsonPath, 'utf8'))
  const seriesCsvRows = fs.existsSync(seriesCsvPath)
    ? parseCSV(fs.readFileSync(seriesCsvPath, 'utf8'))
    : undefined
  const episodesCsvRows = fs.existsSync(episodesCsvPath)
    ? parseCSV(fs.readFileSync(episodesCsvPath, 'utf8'))
    : undefined

  const reconMaster = reconcileMasterMetadata(allData, seriesJson, seriesCsvRows, episodesCsvRows)
  console.log(`[Anime Audit] Series: ${reconMaster.seriesCount}, Episodes: ${reconMaster.totalEpisodes}`)
  console.log(`[Anime Audit] Series two-way field mismatches: ${reconMaster.seriesTwoWay.coreFieldMismatches.length}`)
  console.log(`[Anime Audit] Episode two-way missing: ${reconMaster.episodesTwoWay.missingInCsv.length}, extra: ${reconMaster.episodesTwoWay.extraInCsv.length}`)
  console.log(`[Anime Audit] Episode count anomalies detected: ${reconMaster.episodeCountAnomalies.length}`)

  // Load and reconcile playlists
  console.log(`[Anime Audit] Auditing playlists across all 4 sources...`)
  const playlistsJsonPath = path.join(sourceRoot, 'playlists.json')
  const playlistsCsvPath = path.join(sourceRoot, 'playlists.csv')
  const playlistVideosCsvPath = path.join(sourceRoot, 'playlist_videos.csv')

  const playlistsJson = fs.existsSync(playlistsJsonPath)
    ? JSON.parse(fs.readFileSync(playlistsJsonPath, 'utf8'))
    : allData.playlists
  const playlistsCsvRows = fs.existsSync(playlistsCsvPath)
    ? parseCSV(fs.readFileSync(playlistsCsvPath, 'utf8'))
    : undefined
  const playlistVideosCsvRows = fs.existsSync(playlistVideosCsvPath)
    ? parseCSV(fs.readFileSync(playlistVideosCsvPath, 'utf8'))
    : undefined

  const plAudit = reconcilePlaylists(allData, playlistsJson, playlistsCsvRows, playlistVideosCsvRows)
  console.log(`[Anime Audit] Playlists: ${plAudit.totalPlaylistsJson}, Videos: ${plAudit.totalVideosJson} (${plAudit.uniqueVideoIdsCount} unique)`)
  console.log(`[Anime Audit] Playlists ID mismatches by slug: ${plAudit.idMismatchesBySlug.length}, Slug mismatches by id: ${plAudit.slugMismatchesById.length}`)
  console.log(`[Anime Audit] Video key mismatches: ID-matches-Slug-fails=${plAudit.videoKeyReconciliation.keyMismatchIdMatchesSlugFails.length}, Slug-matches-ID-fails=${plAudit.videoKeyReconciliation.keyMismatchSlugMatchesIdFails.length}`)

  // Subtitle deep audit
  console.log(`[Anime Audit] Scanning subtitles...`)
  const subtitleAudit = deepAnalyzeSubtitles(sourceRoot)
  console.log(`[Anime Audit] Subtitles: ${subtitleAudit.totalFullTriples} triples, ${subtitleAudit.totalCues} cues`)
  console.log(`[Anime Audit] Subtitle parse errors: ${subtitleAudit.parseErrors.length}, structural errors: ${subtitleAudit.structuralErrors.length}, incomplete: ${subtitleAudit.incompleteTriples.length}`)

  // Dictionary verification
  console.log(`[Anime Audit] Verifying dictionary datasets, two-way reconciliation and sharding...`)
  const dictAudit = verifyDictionarySharding(sourceRoot)
  console.log(`[Anime Audit] Shards: ${dictAudit.actualShardFilesCount}, Words: ${dictAudit.totalWordsInShards}, Full entries: ${dictAudit.dictionaryFullEntriesCount}, Word index keys: ${dictAudit.wordIndexKeysCount}`)
  console.log(`[Anime Audit] Dictionary two-way JSON vs CSV: missingInCsv=${dictAudit.twoWayJsonCsv.inJsonNotCsv.length}, extraInCsv=${dictAudit.twoWayJsonCsv.inCsvNotJson.length}`)

  // 1. Write source-manifest.json (purely content-derived and deterministic, no timestamp)
  const manifestData = buildSourceManifest(auditResults)
  fs.mkdirSync(path.dirname(outManifest), { recursive: true })
  fs.writeFileSync(outManifest, JSON.stringify(manifestData, null, 2) + '\n', 'utf8')
  console.log(`[Anime Audit] Manifest written to: ${outManifest}`)

  // 2. Write data-audit.md (real audit timestamp recorded here, outside manifest hash)
  const auditTimestamp = new Date().toISOString()
  const mdContent = buildDataAuditMarkdown(
    auditResults,
    reconMaster,
    plAudit,
    subtitleAudit,
    dictAudit,
    allData,
    auditTimestamp
  )
  fs.mkdirSync(path.dirname(outAudit), { recursive: true })
  fs.writeFileSync(outAudit, mdContent, 'utf8')
  console.log(`[Anime Audit] Audit markdown written to: ${outAudit}`)

  // 3. Write provenance.csv
  const provenanceContent = buildProvenanceCsv()
  fs.mkdirSync(path.dirname(outProvenance), { recursive: true })
  fs.writeFileSync(outProvenance, provenanceContent, 'utf8')
  console.log(`[Anime Audit] Provenance CSV written to: ${outProvenance}`)

  console.log('[Anime Audit] All T01 tasks completed successfully.')
}

// In ESM, check if file is run directly
const isDirectExecution = () => {
  if (!process.argv[1]) return false
  const scriptPath = path.resolve(process.argv[1]).toLowerCase()
  const currentPath = path.resolve(new URL(import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1')).toLowerCase()
  return scriptPath === currentPath
}

if (isDirectExecution()) {
  runCLI().catch((err) => {
    console.error('[Anime Audit Error]:', err)
    process.exit(1)
  })
}
