import { requestApi } from '../../lib/apiClient'
import type {
  CurriculumCatalogData,
  CurriculumCourseDetailData,
  CurriculumUnitDetailData,
  CurriculumUnitTermsData,
} from '../../types/curriculum'

export interface FetchCatalogParams {
  level?: string | null | undefined
  q?: string | null | undefined
  page?: number | undefined
  limit?: number | undefined
}

export interface FetchUnitTermsParams {
  page?: number | undefined
  limit?: number | undefined
  q?: string | null | undefined
}

export const curriculumApi = {
  /**
   * Fetches paginated courses from the public curriculum catalog.
   */
  async fetchCatalog(params: FetchCatalogParams = {}): Promise<CurriculumCatalogData> {
    const searchParams = new URLSearchParams()
    if (params.level && params.level !== 'ALL') searchParams.set('level', params.level)
    if (params.q?.trim()) searchParams.set('q', params.q.trim())
    if (params.page && params.page > 1) searchParams.set('page', String(params.page))
    if (params.limit) searchParams.set('limit', String(params.limit))

    const query = searchParams.toString()
    return requestApi<CurriculumCatalogData>({
      url: `/api/v1/curriculum/catalog${query ? `?${query}` : ''}`,
      method: 'GET',
    })
  },

  /**
   * Fetches course metadata and unit summaries for a given course.
   */
  async fetchCourseDetail(courseCode: string): Promise<CurriculumCourseDetailData> {
    return requestApi<CurriculumCourseDetailData>({
      url: `/api/v1/curriculum/courses/${encodeURIComponent(courseCode)}`,
      method: 'GET',
    })
  },

  /**
   * Fetches unit metadata for a specific unit within a course.
   */
  async fetchUnitDetail(courseCode: string, unitKey: string): Promise<CurriculumUnitDetailData> {
    return requestApi<CurriculumUnitDetailData>({
      url: `/api/v1/curriculum/courses/${encodeURIComponent(courseCode)}/units/${encodeURIComponent(unitKey)}`,
      method: 'GET',
    })
  },

  /**
   * Fetches paginated terms for a specific unit within a course.
   */
  async fetchUnitTerms(
    courseCode: string,
    unitKey: string,
    params: FetchUnitTermsParams = {}
  ): Promise<CurriculumUnitTermsData> {
    const searchParams = new URLSearchParams()
    if (params.page && params.page > 1) searchParams.set('page', String(params.page))
    if (params.limit) searchParams.set('limit', String(params.limit))
    if (params.q?.trim()) searchParams.set('q', params.q.trim())

    const query = searchParams.toString()
    return requestApi<CurriculumUnitTermsData>({
      url: `/api/v1/curriculum/courses/${encodeURIComponent(courseCode)}/units/${encodeURIComponent(unitKey)}/terms${query ? `?${query}` : ''}`,
      method: 'GET',
    })
  },
}
