import { apiPaths, requestApi } from '../../lib/apiClient'
import type {
  AnimeCatalogData,
  AnimeSeriesDetail,
  AnimeSeriesEpisodesData,
  FetchAnimeCatalogParams,
  FetchAnimeEpisodesParams,
} from './animeTypes'

export const animeApi = {
  /**
   * Fetches paginated series from the public anime catalog.
   * Limit is fixed to 24 by default.
   */
  async fetchCatalog(params: FetchAnimeCatalogParams = {}): Promise<AnimeCatalogData> {
    const limit = Math.min(params.limit ?? 24, 24)
    return requestApi<AnimeCatalogData>({
      url: apiPaths.anime.catalog({
        q: params.q ?? undefined,
        level: params.level ?? undefined,
        genre: params.genre ?? undefined,
        page: params.page,
        limit,
      }),
      method: 'GET',
    })
  },

  /**
   * Fetches full metadata and season breakdown for a specific anime series by slug.
   * Only called after user selects a series card.
   */
  async fetchSeriesDetail(slug: string): Promise<AnimeSeriesDetail> {
    return requestApi<AnimeSeriesDetail>({
      url: apiPaths.anime.seriesDetail(slug),
      method: 'GET',
    })
  },

  /**
   * Fetches paginated episode list for a specific anime series.
   * Only called after series detail has opened.
   */
  async fetchSeriesEpisodes(
    slug: string,
    params: FetchAnimeEpisodesParams = {}
  ): Promise<AnimeSeriesEpisodesData> {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 100)
    return requestApi<AnimeSeriesEpisodesData>({
      url: apiPaths.anime.seriesEpisodes(slug, {
        page: params.page,
        limit,
      }),
      method: 'GET',
    })
  },
}
