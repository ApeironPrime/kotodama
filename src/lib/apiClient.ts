import axios, { type AxiosRequestConfig } from 'axios'
import { reportDiagnostic } from './observability'

/** The browser's single API boundary. Feature screens should not call Axios directly. */
function normalizeApiBaseUrl(value: string) {
  return value.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '')
}
export const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env['VITE_API_BASE_URL'] ?? import.meta.env['VITE_API_URL'] ?? ''
)

export const apiPaths = {
  auth: {
    login: '/api/v1/auth/login',
    register: '/api/v1/auth/register',
    logout: '/api/v1/auth/logout',
    refresh: '/api/v1/auth/refresh',
    me: '/api/v1/auth/me',
    forgotPassword: '/api/v1/auth/password/forgot',
    resetPassword: '/api/v1/auth/password/reset',
    changePassword: '/api/v1/auth/password/change',
    verifyEmail: '/api/v1/auth/email/verify',
    resendVerification: '/api/v1/auth/email/resend',
  },
  admin: {
    users: '/api/v1/admin/users',
    audit: '/api/v1/admin/audit',
    userStatus: (userId: string) => `/api/v1/admin/users/${encodeURIComponent(userId)}/status`,
    userRole: (userId: string) => `/api/v1/admin/users/${encodeURIComponent(userId)}/role`,
  },
  account: {
    profile: '/api/v1/account/profile',
    preferences: '/api/v1/account/preferences',
    learningPlan: '/api/v1/account/learning-plan',
  },
  video: {
    assets: '/api/v1/video/assets',
    asset: (assetId: string) => `/api/v1/video/assets/${encodeURIComponent(assetId)}`,
    uploadSession: (assetId: string) => `/api/v1/video/assets/${encodeURIComponent(assetId)}/upload-session`,
    upload: (assetId: string) => `/api/v1/video/assets/${encodeURIComponent(assetId)}/upload`,
    jobs: (assetId: string) => `/api/v1/video/assets/${encodeURIComponent(assetId)}/jobs`,
    retry: (assetId: string) => `/api/v1/video/assets/${encodeURIComponent(assetId)}/retry`,
    transcript: (assetId: string) => `/api/v1/video/assets/${encodeURIComponent(assetId)}/transcript`,
    playbackSession: (assetId: string) => `/api/v1/video/assets/${encodeURIComponent(assetId)}/playback-session`,
    youtubeImports: '/api/v1/video/youtube-imports',
  },
  dictionary: {
    search: (keyword: string, limit = 20) =>
      `/api/v1/dictionary/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`,
    word: (word: string) => `/api/v1/dictionary/word/${encodeURIComponent(word)}`,
    kanji: (char: string) => `/api/v1/dictionary/kanji/${encodeURIComponent(char)}`,
  },
  shadowing: {
    sessions: '/api/v1/shadowing/sessions',
    session: (id: string) => `/api/v1/shadowing/sessions/${encodeURIComponent(id)}`,
    next: (id: string) => `/api/v1/shadowing/sessions/${encodeURIComponent(id)}/next`,
    attempts: (sessionId: string) => `/api/v1/shadowing/sessions/${encodeURIComponent(sessionId)}/attempts`,
    attempt: (id: string) => `/api/v1/shadowing/attempts/${encodeURIComponent(id)}`,
  },
  nhaikanji: {
    kanjiList: (level = 'ALL', query = '', page = 1, limit = 50) =>
      `/api/v1/nhaikanji/kanji?level=${encodeURIComponent(level)}&q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
    kanjiDetail: (char: string) => `/api/v1/nhaikanji/kanji/${encodeURIComponent(char)}`,
    bunpoList: (level = 'ALL', bookId = 'all', query = '', page = 1, limit = 50) =>
      `/api/v1/nhaikanji/bunpo?level=${encodeURIComponent(level)}&bookId=${encodeURIComponent(bookId)}&q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
    jlptExams: (level = 'ALL', section = 'all') =>
      `/api/v1/nhaikanji/jlpt/exams?level=${encodeURIComponent(level)}&section=${encodeURIComponent(section)}`,
    jlptExamDetail: (examId: string) => `/api/v1/nhaikanji/jlpt/exams/${encodeURIComponent(examId)}`,
    jlptSubmit: '/api/v1/nhaikanji/jlpt/submit',
  },
} as const

type ApiEnvelope<T> = { data: T; meta?: Record<string, unknown> }
type ErrorBody = { message?: unknown; code?: unknown; error?: { message?: unknown; code?: unknown } }

export interface DictionaryKanji {
  character: string
  hanViet?: string | null
  onyomi?: string | null
  kunyomi?: string | null
  jlpt?: string | null
  strokeCount?: number | null
  meaning?: string | null
}

export interface DictionaryExample {
  sentenceJp: string
  furigana?: string | null
  sentenceVi: string
}

export interface DictionaryRelatedWord {
  word: string
  reading?: string | null
  hanViet?: string | null
  meaning?: string | null
}

export interface DictionaryWordItem {
  id: number
  word: string
  reading?: string | null
  romaji?: string | null
  hanViet?: string | null
  jlpt?: string | null
  partOfSpeech?: string | null
  meanings: string[]
  rawMeaning?: string | null
  kanjis: DictionaryKanji[]
  relatedWords?: DictionaryRelatedWord[]
  examples?: DictionaryExample[]
}

export interface DictionarySearchResult {
  results: DictionaryWordItem[]
  count: number
}

export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'cancelled'
  | 'validation'
  | 'unauthenticated'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'rate-limited'
  | 'server'
  | 'unknown'

export class ApiRequestError extends Error {
  readonly status?: number | undefined
  readonly code?: string | undefined
  readonly kind: ApiErrorKind
  readonly retryable: boolean

  constructor({
    message,
    status,
    code,
    kind,
    retryable,
  }: {
    message: string
    status?: number | undefined
    code?: string | undefined
    kind: ApiErrorKind
    retryable: boolean
  }) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
    this.kind = kind
    this.retryable = retryable
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: { Accept: 'application/json' },
  withCredentials: true,
})

apiClient.interceptors.request.use((config) => {
  let accessToken: string | null = null
  try {
    accessToken =
      window.sessionStorage.getItem('kotodama.access-token') || window.localStorage.getItem('kotodama.access-token')
  } catch {
    // ignore
  }
  if (accessToken && shouldAttachAccessToken(config.url)) config.headers.set('Authorization', `Bearer ${accessToken}`)
  if (!['GET', 'HEAD', 'OPTIONS'].includes(String(config.method).toUpperCase())) {
    const csrfToken = readBrowserCookie('kotodama_csrf')
    if (csrfToken) config.headers.set('X-CSRF-Token', csrfToken)
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const config = error.config as (AxiosRequestConfig & { skipSessionExpiry?: boolean }) | undefined
    const shouldLeaveSessionUntouched = config?.skipSessionExpiry || isAuthEndpoint(config?.url)
    if (error.response?.status === 401 && !shouldLeaveSessionUntouched)
      window.dispatchEvent(new Event('kotodama:unauthorized'))
    return Promise.reject(error)
  }
)

function readErrorBody(data: unknown) {
  if (!data || typeof data !== 'object') return { message: undefined, code: undefined }
  const body = data as ErrorBody
  return {
    message:
      typeof body.message === 'string'
        ? body.message
        : typeof body.error?.message === 'string'
          ? body.error.message
          : undefined,
    code:
      typeof body.code === 'string' ? body.code : typeof body.error?.code === 'string' ? body.error.code : undefined,
  }
}

function fallbackForStatus(status?: number): Pick<ApiRequestError, 'message' | 'kind' | 'retryable'> {
  if (status === 400 || status === 422)
    return { message: 'Dữ liệu gửi đi chưa hợp lệ. Vui lòng kiểm tra lại.', kind: 'validation', retryable: false }
  if (status === 401)
    return { message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', kind: 'unauthenticated', retryable: false }
  if (status === 403)
    return { message: 'Bạn không có quyền thực hiện thao tác này.', kind: 'forbidden', retryable: false }
  if (status === 404) return { message: 'Không tìm thấy dữ liệu bạn yêu cầu.', kind: 'not-found', retryable: false }
  if (status === 409)
    return { message: 'Dữ liệu đã thay đổi. Vui lòng tải lại và thử lại.', kind: 'conflict', retryable: false }
  if (status === 429)
    return {
      message: 'Bạn đang thao tác quá nhanh. Vui lòng thử lại sau ít phút.',
      kind: 'rate-limited',
      retryable: true,
    }
  if (status && status >= 500)
    return { message: 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.', kind: 'server', retryable: true }
  return { message: 'Không thể kết nối tới máy chủ lúc này.', kind: 'network', retryable: true }
}

/** Converts Axios and unknown failures into UI-safe, typed errors. */
export function toApiRequestError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) return error
  if (axios.isCancel(error) || (axios.isAxiosError(error) && error.code === 'ERR_CANCELED')) {
    return new ApiRequestError({ message: 'Yêu cầu đã được hủy.', kind: 'cancelled', retryable: false })
  }
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')
      return new ApiRequestError({
        message: 'Yêu cầu đã hết thời gian chờ. Vui lòng thử lại.',
        kind: 'timeout',
        retryable: true,
      })
    const status = error.response?.status
    const body = readErrorBody(error.response?.data)
    const fallback = fallbackForStatus(status)
    return new ApiRequestError({
      message: body.message?.trim() || fallback.message,
      code: body.code,
      status,
      kind: fallback.kind,
      retryable: fallback.retryable,
    })
  }
  return new ApiRequestError({
    message: error instanceof Error && error.message ? error.message : 'Đã có lỗi không xác định.',
    kind: 'unknown',
    retryable: false,
  })
}

export function isUnauthorizedError(error: unknown) {
  return toApiRequestError(error).kind === 'unauthenticated'
}
export function isRequestCancelled(error: unknown) {
  return toApiRequestError(error).kind === 'cancelled'
}

export function getApiErrorMessage(error: unknown, fallback = 'Không thể kết nối tới máy chủ lúc này.') {
  const normalized = toApiRequestError(error)
  return normalized.kind === 'unknown' ? fallback : normalized.message
}

export function unwrapApiData<T>(payload: ApiEnvelope<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) return (payload as ApiEnvelope<T>).data
  return payload as T
}

export type ApiRequestConfig = AxiosRequestConfig & { dedupeKey?: string; skipSessionExpiry?: boolean }
const pendingRequests = new Map<string, Promise<unknown>>()

export function isAuthEndpoint(url: unknown) {
  return /\/api\/v1\/auth\//.test(String(url ?? ''))
}

export function shouldAttachAccessToken(url: unknown) {
  return !/\/api\/v1\/auth\/(login|register|logout|refresh|password\/forgot|password\/reset|email\/verify|email\/resend)$/.test(
    String(url ?? '')
  )
}

function diagnosticPath(url: unknown) {
  const path = String(url ?? '').split('?')[0] ?? ''
  return path.replace(/\/[\da-f-]{12,}(?=\/|$)/gi, '/:id')
}

function readBrowserCookie(name: string) {
  if (typeof document === 'undefined') return undefined
  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

/** Runs a typed request, unwraps `{ data }`, and can merge an in-flight duplicate. */
export function requestApi<T>(config: ApiRequestConfig): Promise<T> {
  const { dedupeKey, skipSessionExpiry, ...axiosConfig } = config
  if (dedupeKey) {
    const pending = pendingRequests.get(dedupeKey) as Promise<T> | undefined
    if (pending) return pending
  }
  const request = apiClient
    .request<ApiEnvelope<T> | T>({ ...axiosConfig, skipSessionExpiry } as AxiosRequestConfig)
    .then((response) => unwrapApiData<T>(response.data))
    .catch((error) => {
      const normalized = toApiRequestError(error)
      if (['network', 'timeout', 'server', 'unknown'].includes(normalized.kind))
        reportDiagnostic('api', normalized, {
          kind: normalized.kind,
          status: normalized.status,
          endpoint: diagnosticPath(config.url),
        })
      throw normalized
    })
  if (dedupeKey) {
    pendingRequests.set(dedupeKey, request)
    void request.finally(() => pendingRequests.delete(dedupeKey)).catch(() => undefined)
  }
  return request
}
