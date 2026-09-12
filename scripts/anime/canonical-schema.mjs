/**
 * Runtime schema validators for Canonical Anime Learning contracts.
 * Independent of external libraries, ORMs, or databases.
 */

export const VALID_JLPT_LEVELS = new Set(['N5', 'N4', 'N3', 'N2', 'N1', null])
export const VALID_RIGHTS_STATUS = new Set(['unknown', 'restricted', 'approved'])
export const VALID_MEDIA_SOURCE_TYPES = new Set(['youtube', 'authorized_local', 'external_page', 'unavailable'])

/**
 * Normalizes text to Unicode NFC and collapses whitespace.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeText(value) {
  return typeof value === 'string' ? value.normalize('NFC').replace(/\s+/g, ' ').trim() : ''
}

/**
 * Normalizes slug string (NFC, lowercase, alphanumeric with hyphens).
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeSlug(value) {
  return typeof value === 'string'
    ? value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
    : ''
}

/**
 * Validates a Canonical MediaSource
 * @param {any} ms
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateMediaSource(ms) {
  const errors = []
  if (!ms || typeof ms !== 'object') return { valid: false, errors: ['MediaSource must be an object'] }

  if (typeof ms.source_id !== 'string' || !ms.source_id.trim()) errors.push('source_id must be a non-empty string')
  if (typeof ms.episode_id !== 'string' || !ms.episode_id.trim()) errors.push('episode_id must be a non-empty string')
  if (!VALID_MEDIA_SOURCE_TYPES.has(ms.source_type)) {
    errors.push(`source_type '${ms.source_type}' is invalid; must be one of ${Array.from(VALID_MEDIA_SOURCE_TYPES).join(', ')}`)
  }

  if (typeof ms.playback_allowed !== 'boolean') errors.push('playback_allowed must be a boolean')
  if (ms.stream_url !== null) {
    errors.push('stream_url must be null (watch_url must NEVER be treated as a direct stream URL)')
  }

  // Business invariant: only 'youtube' and 'authorized_local' can be playable
  if (ms.playback_allowed) {
    if (ms.source_type !== 'youtube' && ms.source_type !== 'authorized_local') {
      errors.push(`playback_allowed cannot be true for source_type '${ms.source_type}'`)
    }
  }

  // External page cannot be playable
  if (ms.source_type === 'external_page' && ms.playback_allowed) {
    errors.push("source_type 'external_page' must have playback_allowed = false")
  }

  if (ms.source_type === 'youtube') {
    if (typeof ms.media_id !== 'string' || !ms.media_id.trim()) {
      errors.push("media_id must be a non-empty string when source_type is 'youtube'")
    }
  }

  if (!VALID_RIGHTS_STATUS.has(ms.rights_status)) {
    errors.push(`rights_status '${ms.rights_status}' is invalid`)
  }
  // Rights safety invariant: scraped/external media cannot be promoted to approved
  if (ms.rights_status === 'approved' && ms.source_type !== 'authorized_local') {
    errors.push(`rights_status cannot be 'approved' for unverified scraped source_type '${ms.source_type}'`)
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validates a Canonical SubtitleToken
 * @param {any} token
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSubtitleToken(token) {
  const errors = []
  if (!token || typeof token !== 'object') return { valid: false, errors: ['SubtitleToken must be an object'] }

  if (typeof token.surface !== 'string') errors.push('token.surface must be a string')
  if (typeof token.char_start !== 'number' || token.char_start < 0) errors.push('token.char_start must be a non-negative integer')
  if (typeof token.char_end !== 'number' || token.char_end <= token.char_start) {
    errors.push('token.char_end must be greater than token.char_start')
  }
  if (token.word_id !== null && (typeof token.word_id !== 'number' || !Number.isFinite(token.word_id))) {
    errors.push('token.word_id must be a finite number or null')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validates a Canonical SubtitleCompound
 * @param {any} compound
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSubtitleCompound(compound) {
  const errors = []
  if (!compound || typeof compound !== 'object') return { valid: false, errors: ['SubtitleCompound must be an object'] }

  if (typeof compound.surface !== 'string') errors.push('compound.surface must be a string')
  if (typeof compound.char_start !== 'number' || compound.char_start < 0) errors.push('compound.char_start must be a non-negative integer')
  if (typeof compound.char_end !== 'number' || compound.char_end <= compound.char_start) {
    errors.push('compound.char_end must be greater than compound.char_start')
  }
  if (compound.word_id !== null && (typeof compound.word_id !== 'number' || !Number.isFinite(compound.word_id))) {
    errors.push('compound.word_id must be a finite number or null')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validates a Canonical SubtitleCue
 * @param {any} cue
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSubtitleCue(cue) {
  const errors = []
  if (!cue || typeof cue !== 'object') return { valid: false, errors: ['SubtitleCue must be an object'] }

  if (typeof cue.id !== 'number' || !Number.isInteger(cue.id) || cue.id < 0) errors.push('cue.id must be a non-negative integer')
  if (typeof cue.start !== 'number' || !Number.isFinite(cue.start) || cue.start < 0) {
    errors.push('cue.start must be a non-negative number')
  }
  if (typeof cue.end !== 'number' || !Number.isFinite(cue.end) || cue.end <= cue.start) {
    errors.push('cue.end must be greater than cue.start')
  }
  if (typeof cue.ja !== 'string' || !cue.ja.trim()) errors.push('cue.ja must be a non-empty string')
  if (typeof cue.vi !== 'string') errors.push('cue.vi must be a string')

  if (!Array.isArray(cue.tokens)) {
    errors.push('cue.tokens must be an array')
  } else {
    for (let i = 0; i < cue.tokens.length; i++) {
      const tv = validateSubtitleToken(cue.tokens[i])
      if (!tv.valid) errors.push(`cue.tokens[${i}]: ${tv.errors.join('; ')}`)
    }
  }

  if (cue.compounds !== undefined && !Array.isArray(cue.compounds)) {
    errors.push('cue.compounds must be an array when present')
  } else if (Array.isArray(cue.compounds)) {
    for (let i = 0; i < cue.compounds.length; i++) {
      const cv = validateSubtitleCompound(cue.compounds[i])
      if (!cv.valid) errors.push(`cue.compounds[${i}]: ${cv.errors.join('; ')}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validates a Canonical SubtitleTrack
 * @param {any} track
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSubtitleTrack(track) {
  const errors = []
  if (!track || typeof track !== 'object') return { valid: false, errors: ['SubtitleTrack must be an object'] }

  if (typeof track.track_id !== 'string' || !track.track_id.trim()) errors.push('track_id must be a non-empty string')
  if (typeof track.episode_id !== 'string' || !track.episode_id.trim()) errors.push('episode_id must be a non-empty string')
  if (typeof track.series_slug !== 'string' || !track.series_slug.trim()) errors.push('series_slug must be a non-empty string')
  if (typeof track.episode_number !== 'number' || track.episode_number < 1) errors.push('episode_number must be a positive integer')

  if (!Array.isArray(track.languages) || track.languages.length === 0) {
    errors.push("languages must be a non-empty array of strings (e.g. ['ja', 'vi'])")
  }
  if (typeof track.cue_count !== 'number' || track.cue_count < 0) errors.push('cue_count must be a non-negative integer')
  if (typeof track.token_count !== 'number' || track.token_count < 0) errors.push('token_count must be a non-negative integer')

  if (!track.source_files || typeof track.source_files !== 'object') {
    errors.push('source_files must be an object with json, srt, vtt relative paths')
  } else {
    if (typeof track.source_files.json !== 'string' || !track.source_files.json.trim()) errors.push('source_files.json must be a non-empty string')
    if (typeof track.source_files.srt !== 'string' || !track.source_files.srt.trim()) errors.push('source_files.srt must be a non-empty string')
    if (typeof track.source_files.vtt !== 'string' || !track.source_files.vtt.trim()) errors.push('source_files.vtt must be a non-empty string')
  }

  if (!track.content_sha256 || typeof track.content_sha256 !== 'object') {
    errors.push('content_sha256 must be an object with json, srt, vtt hash strings')
  } else {
    for (const fmt of ['json', 'srt', 'vtt']) {
      const h = track.content_sha256[fmt]
      if (typeof h !== 'string' || !/^[a-f0-9]{64}$/i.test(h)) {
        errors.push(`content_sha256.${fmt} must be a 64-char hex SHA-256 string`)
      }
    }
  }

  if (!Array.isArray(track.cues)) {
    errors.push('track.cues must be an array')
  } else {
    if (track.cues.length !== track.cue_count) {
      errors.push(`track.cue_count (${track.cue_count}) does not match track.cues.length (${track.cues.length})`)
    }
    const cueIdSet = new Set()
    for (let i = 0; i < track.cues.length; i++) {
      const cue = track.cues[i]
      const cv = validateSubtitleCue(cue)
      if (!cv.valid) errors.push(`track.cues[${i}]: ${cv.errors.join('; ')}`)
      if (cue && typeof cue.id === 'number') {
        if (cueIdSet.has(cue.id)) errors.push(`duplicate cue.id ${cue.id} in track '${track.track_id}'`)
        cueIdSet.add(cue.id)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validates a Canonical Episode
 * @param {any} ep
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateEpisode(ep) {
  const errors = []
  if (!ep || typeof ep !== 'object') return { valid: false, errors: ['Episode must be an object'] }

  if (typeof ep.episode_id !== 'string' || !ep.episode_id.trim()) errors.push('episode_id must be a non-empty string')
  if (typeof ep.series_id !== 'string' || !ep.series_id.trim()) errors.push('series_id must be a non-empty string')
  if (typeof ep.season_id !== 'string' || !ep.season_id.trim()) errors.push('season_id must be a non-empty string')
  if (typeof ep.series_slug !== 'string' || !ep.series_slug.trim()) errors.push('series_slug must be a non-empty string')
  if (typeof ep.season_slug !== 'string' || !ep.season_slug.trim()) errors.push('season_slug must be a non-empty string')
  if (typeof ep.episode_number !== 'number' || ep.episode_number < 1) errors.push('episode_number must be a positive integer')
  if (typeof ep.has_subtitles !== 'boolean') errors.push('has_subtitles must be a boolean')

  if (!ep.media_source || typeof ep.media_source !== 'object') {
    errors.push('media_source must be an object')
  } else {
    const mv = validateMediaSource(ep.media_source)
    if (!mv.valid) errors.push(`media_source: ${mv.errors.join('; ')}`)
    if (ep.media_source.episode_id !== ep.episode_id) {
      errors.push(`media_source.episode_id '${ep.media_source.episode_id}' does not match episode.episode_id '${ep.episode_id}'`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validates a Canonical Season
 * @param {any} season
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSeason(season) {
  const errors = []
  if (!season || typeof season !== 'object') return { valid: false, errors: ['Season must be an object'] }

  if (typeof season.season_id !== 'string' || !season.season_id.trim()) errors.push('season_id must be a non-empty string')
  if (typeof season.series_id !== 'string' || !season.series_id.trim()) errors.push('series_id must be a non-empty string')
  if (typeof season.series_slug !== 'string' || !season.series_slug.trim()) errors.push('series_slug must be a non-empty string')
  if (typeof season.season_slug !== 'string' || !season.season_slug.trim()) errors.push('season_slug must be a non-empty string')
  if (typeof season.season_ordinal !== 'number' || season.season_ordinal < 1) errors.push('season_ordinal must be a positive integer')
  if (typeof season.title_vi !== 'string' || !season.title_vi.trim()) errors.push('title_vi must be a non-empty string')
  if (typeof season.total_episodes !== 'number' || season.total_episodes < 0) errors.push('total_episodes must be a non-negative integer')

  if (season.episodes !== undefined) {
    if (!Array.isArray(season.episodes)) {
      errors.push('season.episodes must be an array when present')
    } else {
      for (let i = 0; i < season.episodes.length; i++) {
        const ev = validateEpisode(season.episodes[i])
        if (!ev.valid) errors.push(`season.episodes[${i}]: ${ev.errors.join('; ')}`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validates a Canonical Series
 * @param {any} series
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSeries(series) {
  const errors = []
  if (!series || typeof series !== 'object') return { valid: false, errors: ['Series must be an object'] }

  if (typeof series.series_id !== 'string' || !series.series_id.trim()) errors.push('series_id must be a non-empty string')
  if (typeof series.series_slug !== 'string' || !series.series_slug.trim()) errors.push('series_slug must be a non-empty string')
  if (typeof series.title_vi !== 'string' || !series.title_vi.trim()) errors.push('title_vi must be a non-empty string')
  if (!VALID_JLPT_LEVELS.has(series.jlpt_level)) {
    errors.push(`jlpt_level '${series.jlpt_level}' is invalid; must be one of ${Array.from(VALID_JLPT_LEVELS).join(', ')}`)
  }
  if (typeof series.total_episodes !== 'number' || series.total_episodes < 0) {
    errors.push('total_episodes must be a non-negative integer')
  }
  if (!VALID_RIGHTS_STATUS.has(series.rights_status)) {
    errors.push(`rights_status '${series.rights_status}' is invalid`)
  }
  if (series.rights_status === 'approved') {
    errors.push("rights_status cannot be automatically promoted to 'approved' for unverified anime series")
  }

  if (!series.provenance || typeof series.provenance !== 'object') {
    errors.push('provenance must be an object')
  } else {
    if (typeof series.provenance.origin !== 'string' || !series.provenance.origin.trim()) {
      errors.push('provenance.origin must be a non-empty string')
    }
  }

  if (!Array.isArray(series.seasons) || series.seasons.length === 0) {
    errors.push('series.seasons must be a non-empty array of seasons')
  } else {
    for (let i = 0; i < series.seasons.length; i++) {
      const sv = validateSeason(series.seasons[i])
      if (!sv.valid) errors.push(`series.seasons[${i}]: ${sv.errors.join('; ')}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validates a Canonical PlaylistVideo
 * @param {any} pv
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePlaylistVideo(pv) {
  const errors = []
  if (!pv || typeof pv !== 'object') return { valid: false, errors: ['PlaylistVideo must be an object'] }

  if (typeof pv.playlist_video_id !== 'string' || !pv.playlist_video_id.trim()) errors.push('playlist_video_id must be a non-empty string')
  if (typeof pv.playlist_id !== 'string' || !pv.playlist_id.trim()) errors.push('playlist_id must be a non-empty string')
  if (typeof pv.playlist_slug !== 'string' || !pv.playlist_slug.trim()) errors.push('playlist_slug must be a non-empty string')
  if (typeof pv.video_id !== 'string' || !pv.video_id.trim()) errors.push('video_id must be a non-empty string')
  if (typeof pv.title !== 'string') errors.push('title must be a string')
  if (typeof pv.ordinal !== 'number' || pv.ordinal < 1) errors.push('ordinal must be a positive integer')
  if (typeof pv.playback_allowed !== 'boolean') errors.push('playback_allowed must be a boolean')
  if (!VALID_RIGHTS_STATUS.has(pv.rights_status)) errors.push(`rights_status '${pv.rights_status}' is invalid`)

  return { valid: errors.length === 0, errors }
}

/**
 * Validates a Canonical Playlist
 * @param {any} pl
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePlaylist(pl) {
  const errors = []
  if (!pl || typeof pl !== 'object') return { valid: false, errors: ['Playlist must be an object'] }

  if (typeof pl.playlist_id !== 'string' || !pl.playlist_id.trim()) errors.push('playlist_id must be a non-empty string')
  if (typeof pl.playlist_slug !== 'string' || !pl.playlist_slug.trim()) errors.push('playlist_slug must be a non-empty string')
  if (typeof pl.title !== 'string' || !pl.title.trim()) errors.push('title must be a non-empty string')
  if (!VALID_JLPT_LEVELS.has(pl.jlpt_level)) errors.push(`jlpt_level '${pl.jlpt_level}' is invalid`)
  if (typeof pl.video_count !== 'number' || pl.video_count < 0) errors.push('video_count must be a non-negative integer')
  if (!VALID_RIGHTS_STATUS.has(pl.rights_status)) errors.push(`rights_status '${pl.rights_status}' is invalid`)

  if (!Array.isArray(pl.videos)) {
    errors.push('playlist.videos must be an array')
  } else {
    if (pl.videos.length !== pl.video_count) {
      errors.push(`playlist.video_count (${pl.video_count}) does not match playlist.videos.length (${pl.videos.length})`)
    }
    const videoIdSet = new Set()
    const ordinalSet = new Set()
    for (let i = 0; i < pl.videos.length; i++) {
      const v = pl.videos[i]
      const vv = validatePlaylistVideo(v)
      if (!vv.valid) errors.push(`playlist.videos[${i}]: ${vv.errors.join('; ')}`)
      if (v && v.playlist_id !== pl.playlist_id) {
        errors.push(`playlist.videos[${i}].playlist_id '${v.playlist_id}' does not match parent playlist_id '${pl.playlist_id}'`)
      }
      if (v && v.playlist_slug !== pl.playlist_slug) {
        errors.push(`playlist.videos[${i}].playlist_slug '${v.playlist_slug}' does not match parent playlist_slug '${pl.playlist_slug}'`)
      }
      if (v && typeof v.video_id === 'string') {
        if (videoIdSet.has(v.video_id)) errors.push(`duplicate video_id '${v.video_id}' in playlist '${pl.playlist_id}'`)
        videoIdSet.add(v.video_id)
      }
      if (v && typeof v.ordinal === 'number') {
        if (ordinalSet.has(v.ordinal)) errors.push(`duplicate ordinal ${v.ordinal} in playlist '${pl.playlist_id}'`)
        ordinalSet.add(v.ordinal)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validates a Canonical DictionaryReference
 * @param {any} dr
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDictionaryReference(dr) {
  const errors = []
  if (!dr || typeof dr !== 'object') return { valid: false, errors: ['DictionaryReference must be an object'] }

  if (dr.monolith_embedded === true || dr.dictionary_full_entries !== undefined) {
    errors.push('Monolith dictionary_full.json must NEVER be embedded into the canonical dataset')
  }
  if (typeof dr.total_shards !== 'number' || dr.total_shards !== 666) {
    errors.push(`total_shards must be 666 (got ${dr.total_shards})`)
  }
  if (dr.shard_formula !== 'word_id % 1000') {
    errors.push(`shard_formula must be 'word_id % 1000' (got '${dr.shard_formula}')`)
  }
  const idxCount = dr.indexed_words_count ?? dr.total_indexed_entries
  if (typeof idxCount !== 'number' || idxCount !== 39516) {
    errors.push(`indexed_words_count must be 39,516 (got ${idxCount})`)
  }
  if (typeof dr.total_word_index_keys !== 'number' || dr.total_word_index_keys !== 59225) {
    errors.push(`total_word_index_keys must be 59,225 (got ${dr.total_word_index_keys})`)
  }
  if (typeof dr.homophone_collision_id !== 'number' || dr.homophone_collision_id !== 3144121485) {
    errors.push(`homophone_collision_id must be 3144121485 (got ${dr.homophone_collision_id})`)
  }
  if (!VALID_RIGHTS_STATUS.has(dr.rights_status)) {
    errors.push(`rights_status '${dr.rights_status}' is invalid`)
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validates a Canonical ImportRun
 * @param {any} ir
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateImportRun(ir) {
  const errors = []
  if (!ir || typeof ir !== 'object') return { valid: false, errors: ['ImportRun must be an object'] }

  if (ir.imported_at !== undefined || ir.timestamp !== undefined) {
    errors.push('Runtime timestamps must NOT be included in canonical dataset JSON to guarantee determinism')
  }
  if (typeof ir.source_manifest_hash !== 'string' || !/^[a-f0-9]{64}$/i.test(ir.source_manifest_hash)) {
    errors.push('source_manifest_hash must be a valid 64-char hex SHA-256 hash')
  }
  if (typeof ir.importer_version !== 'string' || !ir.importer_version.trim()) {
    errors.push('importer_version must be a non-empty string')
  }
  if (typeof ir.total_series !== 'number' || ir.total_series < 1) {
    errors.push(`total_series must be a positive number (got ${ir.total_series})`)
  }
  if (typeof ir.total_seasons !== 'number' || ir.total_seasons < 1) {
    errors.push(`total_seasons must be a positive number (got ${ir.total_seasons})`)
  }
  if (typeof ir.total_episodes !== 'number' || ir.total_episodes < 1) {
    errors.push(`total_episodes must be a positive number (got ${ir.total_episodes})`)
  }
  if (typeof ir.total_playlists !== 'number' || ir.total_playlists < 1) {
    errors.push(`total_playlists must be a positive number (got ${ir.total_playlists})`)
  }
  if (typeof ir.total_playlist_videos !== 'number' || ir.total_playlist_videos < 1) {
    errors.push(`total_playlist_videos must be a positive number (got ${ir.total_playlist_videos})`)
  }
  if (typeof ir.unique_playlist_youtube_ids !== 'number' || ir.unique_playlist_youtube_ids < 1) {
    errors.push(`unique_playlist_youtube_ids must be a positive number (got ${ir.unique_playlist_youtube_ids})`)
  }
  if (typeof ir.total_subtitle_tracks !== 'number' || ir.total_subtitle_tracks < 0) {
    errors.push(`total_subtitle_tracks must be a non-negative number (got ${ir.total_subtitle_tracks})`)
  }
  if (typeof ir.total_cues !== 'number' || ir.total_cues < 0) {
    errors.push(`total_cues must be a non-negative number (got ${ir.total_cues})`)
  }
  if (typeof ir.total_tokens !== 'number' || ir.total_tokens < 0) {
    errors.push(`total_tokens must be a non-negative number (got ${ir.total_tokens})`)
  }

  // Media source breakdown
  if (!ir.media_sources_by_type || typeof ir.media_sources_by_type !== 'object') {
    errors.push('media_sources_by_type must be an object')
  } else {
    if (typeof ir.media_sources_by_type.youtube !== 'number' || ir.media_sources_by_type.youtube < 0) {
      errors.push(`media_sources_by_type.youtube must be a non-negative number`)
    }
    if (typeof ir.media_sources_by_type.external_page !== 'number' || ir.media_sources_by_type.external_page < 0) {
      errors.push(`media_sources_by_type.external_page must be a non-negative number`)
    }
    if (typeof ir.media_sources_by_type.authorized_local !== 'number' || ir.media_sources_by_type.authorized_local < 0) {
      errors.push(`media_sources_by_type.authorized_local must be a non-negative number`)
    }
    if (typeof ir.media_sources_by_type.unavailable !== 'number' || ir.media_sources_by_type.unavailable < 0) {
      errors.push(`media_sources_by_type.unavailable must be a non-negative number`)
    }
  }

  // Reject list
  if (!Array.isArray(ir.reject_list)) {
    errors.push('reject_list must be an array')
  } else {
    if (ir.reject_list.length !== ir.error_count) {
      errors.push(`reject_list.length (${ir.reject_list.length}) does not match error_count (${ir.error_count})`)
    }
  }

  // Warnings
  if (!Array.isArray(ir.warnings)) {
    errors.push('warnings must be an array')
  } else {
    if (ir.warnings.length !== ir.warning_count) {
      errors.push(`warnings.length (${ir.warnings.length}) does not match warning_count (${ir.warning_count})`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validates a Canonical Dataset (Exhaustive verification of structure, referential integrity, uniqueness, counts)
 * @param {any} dataset
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCanonicalDataset(dataset) {
  const errors = []
  if (!dataset || typeof dataset !== 'object') return { valid: false, errors: ['Dataset must be an object'] }

  // 1. Validate import_run
  const irVal = validateImportRun(dataset.import_run)
  if (!irVal.valid) errors.push(...irVal.errors)

  // 2. Validate dictionary_reference
  const drVal = validateDictionaryReference(dataset.dictionary_reference)
  if (!drVal.valid) errors.push(...drVal.errors)

  // 3. Top-level arrays check
  if (!Array.isArray(dataset.series)) errors.push('dataset.series must be an array')
  if (!Array.isArray(dataset.playlists)) errors.push('dataset.playlists must be an array')
  if (!Array.isArray(dataset.subtitle_tracks)) errors.push('dataset.subtitle_tracks must be an array')

  if (!Array.isArray(dataset.series) || !Array.isArray(dataset.playlists) || !Array.isArray(dataset.subtitle_tracks)) {
    return { valid: false, errors }
  }

  // 4. Validate Series, Seasons, Episodes, MediaSources
  const seriesIdSet = new Set()
  const seriesSlugSet = new Set()
  const seasonIdSet = new Set()
  const episodeIdSet = new Set()
  const episodeCompositeKeySet = new Set()
  const mediaSourceIdSet = new Set()
  const actualMediaSourcesByType = {
    youtube: 0,
    external_page: 0,
    authorized_local: 0,
    unavailable: 0,
  }

  let totalSeasonsCount = 0
  let totalEpisodesCount = 0
  let totalMediaSourcesCount = 0
  let totalPlayableMedia = 0
  let totalNonPlayableMedia = 0

  for (let i = 0; i < dataset.series.length; i++) {
    const s = dataset.series[i]
    const sv = validateSeries(s)
    if (!sv.valid) errors.push(`series[${i}]: ${sv.errors.join('; ')}`)

    if (s && typeof s.series_id === 'string') {
      if (seriesIdSet.has(s.series_id)) errors.push(`duplicate series_id '${s.series_id}' at series[${i}]`)
      seriesIdSet.add(s.series_id)
    }
    if (s && typeof s.series_slug === 'string') {
      if (seriesSlugSet.has(s.series_slug)) errors.push(`duplicate series_slug '${s.series_slug}' at series[${i}]`)
      seriesSlugSet.add(s.series_slug)
    }

    for (let j = 0; j < (s?.seasons || []).length; j++) {
      const sn = s.seasons[j]
      totalSeasonsCount++

      if (sn && typeof sn.season_id === 'string') {
        if (seasonIdSet.has(sn.season_id)) errors.push(`duplicate season_id '${sn.season_id}'`)
        seasonIdSet.add(sn.season_id)
      }
      if (sn?.series_id !== s.series_id) {
        errors.push(`season '${sn.season_id}' has series_id '${sn.series_id}' differing from parent series '${s.series_id}'`)
      }

      for (let k = 0; k < (sn?.episodes || []).length; k++) {
        const ep = sn.episodes[k]
        totalEpisodesCount++

        if (ep && typeof ep.episode_id === 'string') {
          if (episodeIdSet.has(ep.episode_id)) errors.push(`duplicate episode_id '${ep.episode_id}'`)
          episodeIdSet.add(ep.episode_id)
        }

        const compKey = `${ep.series_slug}::${ep.season_slug}::${ep.episode_number}`
        if (episodeCompositeKeySet.has(compKey)) {
          errors.push(`duplicate episode position key (${compKey})`)
        }
        episodeCompositeKeySet.add(compKey)

        if (ep?.series_id !== s.series_id) {
          errors.push(`episode '${ep.episode_id}' series_id '${ep.series_id}' mismatch with parent series '${s.series_id}'`)
        }
        if (ep?.season_id !== sn.season_id) {
          errors.push(`episode '${ep.episode_id}' season_id '${ep.season_id}' mismatch with parent season '${sn.season_id}'`)
        }

        // Media source validation
        if (ep?.media_source) {
          totalMediaSourcesCount++
          const ms = ep.media_source
          if (typeof ms.source_id === 'string') {
            if (mediaSourceIdSet.has(ms.source_id)) errors.push(`duplicate media_source_id '${ms.source_id}'`)
            mediaSourceIdSet.add(ms.source_id)
          }
          if (ms.source_type && actualMediaSourcesByType[ms.source_type] !== undefined) {
            actualMediaSourcesByType[ms.source_type]++
          }
          if (ms.playback_allowed) totalPlayableMedia++
          else totalNonPlayableMedia++
        }
      }
    }
  }

  // 5. Validate SubtitleTracks & check referential integrity to episodes
  const trackIdSet = new Set()
  let totalCuesCount = 0
  let totalTokensCount = 0

  for (let i = 0; i < dataset.subtitle_tracks.length; i++) {
    const tr = dataset.subtitle_tracks[i]
    const tv = validateSubtitleTrack(tr)
    if (!tv.valid) errors.push(`subtitle_tracks[${i}]: ${tv.errors.join('; ')}`)

    if (tr && typeof tr.track_id === 'string') {
      if (trackIdSet.has(tr.track_id)) errors.push(`duplicate track_id '${tr.track_id}' at subtitle_tracks[${i}]`)
      trackIdSet.add(tr.track_id)
    }

    // Referential integrity: track must belong to an existing episode
    if (tr && typeof tr.episode_id === 'string') {
      if (!episodeIdSet.has(tr.episode_id)) {
        errors.push(`subtitle_tracks[${i}] references non-existent episode_id '${tr.episode_id}'`)
      }
    }
    if (tr && typeof tr.series_slug === 'string') {
      if (!seriesSlugSet.has(tr.series_slug)) {
        errors.push(`subtitle_tracks[${i}] references non-existent series_slug '${tr.series_slug}'`)
      }
    }

    if (Array.isArray(tr?.cues)) {
      totalCuesCount += tr.cues.length
      for (let j = 0; j < tr.cues.length; j++) {
        totalTokensCount += (tr.cues[j].tokens ? tr.cues[j].tokens.length : 0)
      }
    }
  }

  // 6. Validate Playlists & Videos
  const playlistIdSet = new Set()
  const playlistSlugSet = new Set()
  let totalPlaylistVideosCount = 0
  const uniquePlaylistYoutubeIds = new Set()

  for (let i = 0; i < dataset.playlists.length; i++) {
    const pl = dataset.playlists[i]
    const pv = validatePlaylist(pl)
    if (!pv.valid) errors.push(`playlists[${i}]: ${pv.errors.join('; ')}`)

    if (pl && typeof pl.playlist_id === 'string') {
      if (playlistIdSet.has(pl.playlist_id)) errors.push(`duplicate playlist_id '${pl.playlist_id}'`)
      playlistIdSet.add(pl.playlist_id)
    }
    if (pl && typeof pl.playlist_slug === 'string') {
      if (playlistSlugSet.has(pl.playlist_slug)) errors.push(`duplicate playlist_slug '${pl.playlist_slug}'`)
      playlistSlugSet.add(pl.playlist_slug)
    }

    for (let j = 0; j < (pl?.videos || []).length; j++) {
      const v = pl.videos[j]
      totalPlaylistVideosCount++
      if (v?.playlist_id !== pl.playlist_id) {
        errors.push(`video '${v.playlist_video_id}' playlist_id '${v.playlist_id}' mismatch with parent playlist '${pl.playlist_id}'`)
      }
      if (v?.playlist_slug !== pl.playlist_slug) {
        errors.push(`video '${v.playlist_video_id}' playlist_slug '${v.playlist_slug}' mismatch with parent playlist '${pl.playlist_slug}'`)
      }
      if (v?.video_id) uniquePlaylistYoutubeIds.add(v.video_id)
    }
  }

  // 7. Count reconciliation against import_run
  const ir = dataset.import_run
  if (ir) {
    if (ir.total_series !== dataset.series.length) {
      errors.push(`import_run.total_series (${ir.total_series}) does not match series.length (${dataset.series.length})`)
    }
    if (ir.total_seasons !== totalSeasonsCount) {
      errors.push(`import_run.total_seasons (${ir.total_seasons}) does not match totalSeasonsCount (${totalSeasonsCount})`)
    }
    if (ir.total_episodes !== totalEpisodesCount) {
      errors.push(`import_run.total_episodes (${ir.total_episodes}) does not match totalEpisodesCount (${totalEpisodesCount})`)
    }
    if (ir.total_media_sources !== totalMediaSourcesCount) {
      errors.push(`import_run.total_media_sources (${ir.total_media_sources}) does not match totalMediaSourcesCount (${totalMediaSourcesCount})`)
    }
    if (ir.media_sources_by_type && typeof ir.media_sources_by_type === 'object') {
      for (const st of ['youtube', 'external_page', 'authorized_local', 'unavailable']) {
        const expectedCount = ir.media_sources_by_type[st] ?? 0
        const actualCount = actualMediaSourcesByType[st] ?? 0
        if (expectedCount !== actualCount) {
          errors.push(`import_run.media_sources_by_type.${st} (${expectedCount}) does not match actual count (${actualCount})`)
        }
      }
    }
    if (ir.total_subtitle_tracks !== dataset.subtitle_tracks.length) {
      errors.push(`import_run.total_subtitle_tracks (${ir.total_subtitle_tracks}) does not match subtitle_tracks.length (${dataset.subtitle_tracks.length})`)
    }
    if (ir.total_cues !== totalCuesCount) {
      errors.push(`import_run.total_cues (${ir.total_cues}) does not match totalCuesCount (${totalCuesCount})`)
    }
    if (ir.total_tokens !== totalTokensCount) {
      errors.push(`import_run.total_tokens (${ir.total_tokens}) does not match totalTokensCount (${totalTokensCount})`)
    }
    if (ir.total_playlists !== dataset.playlists.length) {
      errors.push(`import_run.total_playlists (${ir.total_playlists}) does not match playlists.length (${dataset.playlists.length})`)
    }
    if (ir.total_playlist_videos !== totalPlaylistVideosCount) {
      errors.push(`import_run.total_playlist_videos (${ir.total_playlist_videos}) does not match totalPlaylistVideosCount (${totalPlaylistVideosCount})`)
    }
    if (ir.unique_playlist_youtube_ids !== uniquePlaylistYoutubeIds.size) {
      errors.push(`import_run.unique_playlist_youtube_ids (${ir.unique_playlist_youtube_ids}) does not match unique ids (${uniquePlaylistYoutubeIds.size})`)
    }
  }

  return { valid: errors.length === 0, errors }
}
