import { apiPaths, requestApi } from '../../lib/apiClient'
import type {
  AnimeContinueWatchingResponse,
  AnimeDictionaryEntry,
  AnimeEpisodeDetail,
  AnimeSubtitleWindowData,
  AnimeWatchProgress,
  FetchEpisodeSubtitlesParams,
  SaveProgressPayload,
} from './animePlaybackTypes'

export const animePlaybackApi = {
  /**
   * Fetches full episode playback metadata including media source and subtitle track summary.
   * Only called after user selects an episode.
   */
  async fetchEpisodeDetail(
    episodeId: string,
    options?: { signal?: AbortSignal }
  ): Promise<AnimeEpisodeDetail> {
    const config: { url: string; method: 'GET'; signal?: AbortSignal } = {
      url: apiPaths.anime.episodeDetail(episodeId),
      method: 'GET',
    }
    if (options?.signal) {
      config.signal = options.signal
    }
    return requestApi<AnimeEpisodeDetail>(config)
  },

  /**
   * Fetches window-bounded subtitle cues for a specific episode.
   * Window size is typically 120 seconds (max 600s).
   * In T06, client always uses lang='all' to enable local layer switching without repeating requests.
   */
  async fetchEpisodeSubtitles(
    episodeId: string,
    params: FetchEpisodeSubtitlesParams
  ): Promise<AnimeSubtitleWindowData> {
    const lang = params.lang || 'all'
    const config: { url: string; method: 'GET'; signal?: AbortSignal } = {
      url: apiPaths.anime.episodeSubtitles(episodeId, {
        from: params.from,
        to: params.to,
        lang,
      }),
      method: 'GET',
    }
    if (params.signal) {
      config.signal = params.signal
    }
    return requestApi<AnimeSubtitleWindowData>(config)
  },

  /**
   * Fetches dictionary entry for an anime subtitle token by wordId.
   */
  async fetchDictionaryWord(
    wordId: number | string,
    options?: { signal?: AbortSignal }
  ): Promise<AnimeDictionaryEntry> {
    const config: { url: string; method: 'GET'; signal?: AbortSignal } = {
      url: apiPaths.anime.dictionaryWord(wordId),
      method: 'GET',
    }
    if (options?.signal) {
      config.signal = options.signal
    }
    return requestApi<AnimeDictionaryEntry>(config)
  },

  /**
   * Fallback dictionary search when token has no word_id or word lookup 404s.
   * Limit is at most 5 results.
   */
  async searchDictionaryFallback(
    keyword: string,
    limit: number = 5,
    options?: { signal?: AbortSignal }
  ): Promise<{ results: AnimeDictionaryEntry[]; count: number }> {
    const safeLimit = Math.min(5, Math.max(1, limit))
    const config: { url: string; method: 'GET'; signal?: AbortSignal } = {
      url: apiPaths.dictionary.search(keyword, safeLimit),
      method: 'GET',
    }
    if (options?.signal) {
      config.signal = options.signal
    }
    return requestApi<{ results: AnimeDictionaryEntry[]; count: number }>(config)
  },

  /**
   * Fetches current authenticated user's watch progress for an episode.
   * Returns null if user has not watched yet.
   */
  async fetchWatchProgress(
    episodeId: string,
    options?: { signal?: AbortSignal }
  ): Promise<AnimeWatchProgress | null> {
    const config: { url: string; method: 'GET'; signal?: AbortSignal } = {
      url: apiPaths.anime.progress(episodeId),
      method: 'GET',
    }
    if (options?.signal) {
      config.signal = options.signal
    }
    return requestApi<AnimeWatchProgress | null>(config)
  },

  /**
   * Atomically saves current user's playback position.
   */
  async saveWatchProgress(
    payload: SaveProgressPayload,
    options?: { signal?: AbortSignal }
  ): Promise<AnimeWatchProgress> {
    const config: { url: string; method: 'POST'; data: SaveProgressPayload; signal?: AbortSignal } = {
      url: apiPaths.anime.progress(),
      method: 'POST',
      data: payload,
    }
    if (options?.signal) {
      config.signal = options.signal
    }
    return requestApi<AnimeWatchProgress>(config)
  },

  /**
   * Fetches the 10 newest episodes in current user's continue-watching list.
   */
  async fetchContinueWatching(
    options?: { signal?: AbortSignal }
  ): Promise<AnimeContinueWatchingResponse> {
    const config: { url: string; method: 'GET'; signal?: AbortSignal } = {
      url: apiPaths.anime.continueWatching(),
      method: 'GET',
    }
    if (options?.signal) {
      config.signal = options.signal
    }
    return requestApi<AnimeContinueWatchingResponse>(config)
  },
}

