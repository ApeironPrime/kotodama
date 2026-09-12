export type AnimeMediaSourceType = 'youtube' | 'authorized_local' | 'external_page' | 'unavailable'

export interface AnimeMediaSource {
  source_type: AnimeMediaSourceType | string
  media_id: string | null
  page_url: string | null
  playback_allowed: boolean
  rights_status: string
}

export interface AnimeSubtitleTrack {
  track_id: string
  languages: string[]
  cue_count: number
  token_count: number
  word_linked_token_count: number
}

export interface AnimeEpisodeDetail {
  episode_id: string
  series_id: string
  season_id: string
  series_slug: string
  season_slug: string
  series_title_vi: string
  series_title_ja: string | null
  season_ordinal: number
  season_label: string | null
  season_title_vi: string
  episode_number: number
  title: string | null
  has_subtitles: boolean
  media_source: AnimeMediaSource | null
  subtitle_track: AnimeSubtitleTrack | null
}

export interface AnimeSubtitleToken {
  token_ordinal: number
  surface: string
  char_start: number
  char_end: number
  word_id: number | null
}

export interface AnimeSubtitleCue {
  cue_id: number
  start: number
  end: number
  ja?: string | undefined
  vi?: string | undefined
  compounds?: unknown[] | undefined
  tokens?: AnimeSubtitleToken[] | undefined
}

export interface AnimeSubtitleWindowData {
  episode_id: string
  track_id: string | null
  from: number
  to: number
  cues: AnimeSubtitleCue[]
}

export interface FetchEpisodeSubtitlesParams {
  from: number
  to?: number | undefined
  lang?: 'all' | 'ja' | 'vi' | undefined
  signal?: AbortSignal | undefined
}

export interface AnimeWatchProgress {
  episode_id: string
  last_playback_position: number
  max_playback_position: number
  duration: number
  is_completed: boolean
  playback_count: number
  last_watched_at: string
}

export interface AnimeContinueWatchingItem {
  episode_id: string
  series_id: string
  series_slug: string
  series_title_vi: string
  season_slug: string
  season_label: string | null
  episode_number: number
  episode_title: string | null
  last_playback_position: number
  max_playback_position: number
  duration: number
  is_completed: boolean
  last_watched_at: string
}

export interface AnimeContinueWatchingResponse {
  items: AnimeContinueWatchingItem[]
  count: number
}

export interface AnimeDictionaryEntry {
  id: number
  type?: string
  word: string
  reading: string | null
  pos_vi: string[]
  jlpt: string | null
  hanviet: string
  meanings: Array<{ pos?: string; def_vi?: string } | string>
  source?: string
  isFallback?: boolean
}

export interface SaveProgressPayload {
  episodeId: string
  position: number
  duration: number
}

