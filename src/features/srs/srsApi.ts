import { requestApi } from '../../lib/apiClient'
import type { CurriculumGrammar, CurriculumWord, SrsCard, SrsDeckResponse, SrsRating, SrsStats } from './srsTypes'

export const srsApi = {
  async fetchDeck(params: {
    type?: string
    status?: string
    level?: string
    query?: string
    page?: number
    limit?: number
  }): Promise<SrsDeckResponse> {
    const searchParams = new URLSearchParams()
    if (params.type) searchParams.set('type', params.type)
    if (params.status) searchParams.set('status', params.status)
    if (params.level) searchParams.set('level', params.level)
    if (params.query) searchParams.set('q', params.query)
    if (params.page) searchParams.set('page', String(params.page))
    if (params.limit) searchParams.set('limit', String(params.limit))

    return requestApi<SrsDeckResponse>({
      url: `/api/v1/srs/deck?${searchParams.toString()}`,
    })
  },

  async fetchStats(type: string = 'all'): Promise<SrsStats> {
    return requestApi<SrsStats>({
      url: `/api/v1/srs/stats?type=${encodeURIComponent(type)}`,
    })
  },

  async submitReview(cardId: string, rating: SrsRating): Promise<SrsCard> {
    return requestApi<SrsCard>({
      url: '/api/v1/srs/review',
      method: 'POST',
      data: { cardId, rating },
    })
  },

  async addCard(cardData: Partial<SrsCard>): Promise<SrsCard> {
    return requestApi<SrsCard>({
      url: '/api/v1/srs/add',
      method: 'POST',
      data: cardData,
    })
  },

  async fetchSavedTerms(): Promise<Array<{ term: string; type: string }>> {
    return requestApi<Array<{ term: string; type: string }>>({
      url: '/api/v1/srs/saved-terms',
    })
  },

  async fetchCurriculumWords(params: {
    curriculum?: string | undefined
    level?: string | undefined
    unit?: number | string | undefined
    query?: string | undefined
    page?: number | undefined
    limit?: number | undefined
  }): Promise<{ items: CurriculumWord[]; total: number; totalPages: number; page?: number; limit?: number }> {
    const searchParams = new URLSearchParams()
    if (params.curriculum) searchParams.set('curriculum', params.curriculum)
    if (params.level) searchParams.set('level', params.level)
    if (params.unit) searchParams.set('unit', String(params.unit))
    if (params.query) searchParams.set('q', params.query)
    if (params.page) searchParams.set('page', String(params.page))
    if (params.limit) searchParams.set('limit', String(params.limit))

    return requestApi<{ items: CurriculumWord[]; total: number; totalPages: number; page?: number; limit?: number }>({
      url: `/api/v1/curriculum/words?${searchParams.toString()}`,
    })
  },

  async fetchCurriculumGrammar(params: {
    curriculum?: string | undefined
    level?: string | undefined
    lesson?: number | string | undefined
    query?: string | undefined
    page?: number | undefined
    limit?: number | undefined
  }): Promise<{ items: CurriculumGrammar[]; total: number; totalPages: number; page?: number; limit?: number }> {
    const searchParams = new URLSearchParams()
    if (params.curriculum) searchParams.set('curriculum', params.curriculum)
    if (params.level) searchParams.set('level', params.level)
    if (params.lesson) searchParams.set('lesson', String(params.lesson))
    if (params.query) searchParams.set('q', params.query)
    if (params.page) searchParams.set('page', String(params.page))
    if (params.limit) searchParams.set('limit', String(params.limit))

    return requestApi<{ items: CurriculumGrammar[]; total: number; totalPages: number; page?: number; limit?: number }>(
      {
        url: `/api/v1/curriculum/grammar?${searchParams.toString()}`,
      }
    )
  },

  async fetchUnits(
    curriculum: string = 'all'
  ): Promise<Array<{ unit_number: number; unit_title: string; count: number }>> {
    return requestApi<Array<{ unit_number: number; unit_title: string; count: number }>>({
      url: `/api/v1/curriculum/units?curriculum=${encodeURIComponent(curriculum)}`,
    })
  },

  async fetchLessons(
    curriculum: string = 'all'
  ): Promise<Array<{ lesson_id: string; lesson_title: string; count: number }>> {
    return requestApi<Array<{ lesson_id: string; lesson_title: string; count: number }>>({
      url: `/api/v1/curriculum/lessons?curriculum=${encodeURIComponent(curriculum)}`,
    })
  },
}
