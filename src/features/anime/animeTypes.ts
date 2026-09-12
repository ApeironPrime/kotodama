export interface AnimeSeriesSummary {
  series_id: string
  series_slug: string
  master_slug: string | null
  title_vi: string
  title_ja: string | null
  description: string
  poster_url: string | null
  category: string | null
  jlpt_level: string | null
  channel: string | null
  video_source: string | null
  total_episodes: number
  season_count: number
  subbed_episodes_count: number
  rights_status: string
  updated_at: string
}

export interface AnimePagination {
  page: number
  limit: number
  totalItems: number
  totalPages: number
}

export interface AnimeCatalogData {
  items: AnimeSeriesSummary[]
  pagination: AnimePagination
}

export interface AnimeSeasonSummary {
  season_id: string
  series_slug: string
  season_slug: string
  season_ordinal: number
  season_label: string | null
  title_vi: string
  total_episodes: number
  actual_episodes_count: number
  subbed_episodes_count: number
}

export interface AnimeSeriesDetail {
  series_id: string
  series_slug: string
  master_slug: string | null
  title_vi: string
  title_ja: string | null
  description: string
  poster_url: string | null
  category: string | null
  jlpt_level: string | null
  channel: string | null
  video_source: string | null
  total_episodes: number
  rights_status: string
  created_at: string
  updated_at: string
  seasons: AnimeSeasonSummary[]
}

export interface AnimeEpisodeSummary {
  episode_id: string
  series_slug: string
  season_slug: string
  season_ordinal: number
  season_label: string | null
  episode_number: number
  title: string | null
  has_subtitles: boolean
  source_type: string
  playback_allowed: boolean
  cue_count: number
  token_count: number
}

export interface AnimeSeriesEpisodesData {
  series_slug: string
  items: AnimeEpisodeSummary[]
  pagination: AnimePagination
}

export interface FetchAnimeCatalogParams {
  q?: string | null | undefined
  level?: string | null | undefined
  genre?: string | null | undefined
  page?: number | undefined
  limit?: number | undefined
}

export interface FetchAnimeEpisodesParams {
  page?: number | undefined
  limit?: number | undefined
}
