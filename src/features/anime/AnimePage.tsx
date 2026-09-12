import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertCircle, ChevronLeft, ChevronRight, Clapperboard, RotateCcw, ShieldAlert } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import { PageShell } from '../../components/ui'
import { AnimeCatalogFilters } from './AnimeCatalogFilters'
import { AnimeContinueWatching } from './AnimeContinueWatching'
import { AnimeFeaturedHero } from './AnimeFeaturedHero'
import { AnimeLearningSession } from './AnimeLearningSession'
import { AnimeSeriesCard } from './AnimeSeriesCard'
import { AnimeSeriesDetail } from './AnimeSeriesDetail'
import { animeApi } from './animeApi'
import type {
  AnimeCatalogData,
  AnimeEpisodeSummary,
  AnimeSeriesDetail as AnimeSeriesDetailType,
} from './animeTypes'

export default function AnimePage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Read URL search params
  const urlQ = searchParams.get('q') || ''
  const urlLevel = searchParams.get('level') || 'ALL'
  const urlGenre = searchParams.get('genre') || 'ALL'
  const urlPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const urlSeries = searchParams.get('series') || null
  const urlEpisode = searchParams.get('episode') || null

  // Local state for immediate input feedback before debounce
  const [searchInput, setSearchInput] = useState(urlQ)
  const [availableGenres, setAvailableGenres] = useState<string[]>([])

  // Catalog data state
  const [catalog, setCatalog] = useState<AnimeCatalogData | null>(null)
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)

  // Series detail state
  const [seriesDetail, setSeriesDetail] = useState<AnimeSeriesDetailType | null>(null)
  const [episodes, setEpisodes] = useState<AnimeEpisodeSummary[]>([])
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [episodesError, setEpisodesError] = useState<string | null>(null)
  const [globalNotice, setGlobalNotice] = useState<string | null>(null)

  // Keep ref to urlSeries so fetchCatalogData can check current selected series without re-fetching catalog on selection
  const urlSeriesRef = useRef(urlSeries)
  urlSeriesRef.current = urlSeries

  // Track the slug of the currently loaded detail to avoid refetching when other params (e.g. filters) change
  const currentDetailSlugRef = useRef<string | null>(null)

  // Track previous filter parameters to detect when q, level, or genre change
  const prevFiltersRef = useRef({ q: urlQ, level: urlLevel, genre: urlGenre })

  // Request ID counters to cancel stale responses and prevent race conditions
  const catalogRequestIdRef = useRef(0)
  const detailRequestIdRef = useRef(0)
  const searchDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Accessible announce region id
  const statusRegionId = useId()

  // Keep searchInput in sync when URL changes from external navigation (back/forward)
  useEffect(() => {
    setSearchInput(urlQ)
  }, [urlQ])

  // Helper to update URL params cleanly
  const updateUrlParams = useCallback(
    (updates: {
      q?: string | null
      level?: string | null
      genre?: string | null
      page?: number | null
      series?: string | null
      episode?: string | null
    }) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)

          if ('q' in updates) {
            const val = updates.q?.trim()
            if (val) next.set('q', val)
            else next.delete('q')
          }
          if ('level' in updates) {
            const val = updates.level
            if (val && val !== 'ALL') next.set('level', val)
            else next.delete('level')
          }
          if ('genre' in updates) {
            const val = updates.genre
            if (val && val !== 'ALL') next.set('genre', val)
            else next.delete('genre')
          }
          if ('page' in updates) {
            const val = updates.page
            if (val && val > 1) next.set('page', String(val))
            else next.delete('page')
          }
          if ('series' in updates) {
            const val = updates.series
            if (val) next.set('series', val)
            else {
              next.delete('series')
              next.delete('episode')
            }
          }
          if ('episode' in updates) {
            const val = updates.episode
            if (val) next.set('episode', val)
            else next.delete('episode')
          }

          return next
        },
        { replace: false }
      )
    },
    [setSearchParams]
  )

  // Fetch Catalog with anti-race condition guard
  const fetchCatalogData = useCallback(async () => {
    const requestId = ++catalogRequestIdRef.current
    setIsLoadingCatalog(true)
    setCatalogError(null)

    // Detect if filter changed
    const currentQ = urlQ
    const currentLevel = urlLevel
    const currentGenre = urlGenre
    const filterChanged =
      prevFiltersRef.current.q !== currentQ ||
      prevFiltersRef.current.level !== currentLevel ||
      prevFiltersRef.current.genre !== currentGenre
    prevFiltersRef.current = { q: currentQ, level: currentLevel, genre: currentGenre }

    try {
      const data = await animeApi.fetchCatalog({
        q: currentQ || undefined,
        level: currentLevel !== 'ALL' ? currentLevel : undefined,
        genre: currentGenre !== 'ALL' ? currentGenre : undefined,
        page: urlPage,
        limit: 24,
      })

      // If a newer request was dispatched, drop this stale response
      if (requestId !== catalogRequestIdRef.current) return

      setCatalog(data)

      // Accumulate available genres from loaded items
      if (data.items && data.items.length > 0) {
        setAvailableGenres((prev) => {
          const set = new Set(prev)
          for (const item of data.items) {
            if (item.category) set.add(item.category)
          }
          return Array.from(set).sort()
        })
      }

      // Sync filter with detail:
      // When q, level, or genre changes and the new catalog response does NOT contain the selected series,
      // close detail, remove series + episode from URL, and clear stale detail/episodes.
      // Do not close detail while loading; only handle after successful response.
      // If the series is still present in the results, preserve detail.
      if (filterChanged && urlSeriesRef.current) {
        const selectedSlug = urlSeriesRef.current
        const stillInCatalog = data.items?.some((item) => item.series_slug === selectedSlug)
        if (!stillInCatalog) {
          currentDetailSlugRef.current = null
          updateUrlParams({ series: null, episode: null })
          setSeriesDetail(null)
          setEpisodes([])
          setDetailError(null)
          setEpisodesError(null)
        }
      }
    } catch (err: unknown) {
      if (requestId !== catalogRequestIdRef.current) return
      const errorMsg =
        err && typeof err === 'object' && 'message' in err
          ? String(err.message)
          : 'Không thể tải danh mục anime lúc này. Vui lòng thử lại.'
      setCatalogError(errorMsg)
      setCatalog(null)
    } finally {
      if (requestId === catalogRequestIdRef.current) {
        setIsLoadingCatalog(false)
      }
    }
  }, [urlQ, urlLevel, urlGenre, urlPage, updateUrlParams])

  // Trigger catalog fetch when URL filter params change
  useEffect(() => {
    void fetchCatalogData()
  }, [fetchCatalogData])

  // Fetch Series Detail and Episodes
  const fetchDetailAndEpisodes = useCallback(
    (slug: string | null) => {
      if (!slug) {
        setSeriesDetail(null)
        setEpisodes([])
        setDetailError(null)
        setEpisodesError(null)
        return
      }

      const requestId = ++detailRequestIdRef.current
      setIsLoadingDetail(true)
      setIsLoadingEpisodes(true)
      setDetailError(null)
      setEpisodesError(null)

      // 1. Fetch series metadata
      animeApi
        .fetchSeriesDetail(slug)
        .then((data) => {
          if (requestId !== detailRequestIdRef.current) return
          setSeriesDetail(data)
        })
        .catch((err: unknown) => {
          if (requestId !== detailRequestIdRef.current) return
          const isForbidden =
            (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 403) ||
            (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'ANIME_CONTENT_RESTRICTED')

          if (isForbidden) {
            // 403 Forbidden: Remove series from URL, fail-closed, no retry bypass
            currentDetailSlugRef.current = null
            updateUrlParams({ series: null, episode: null })
            setSeriesDetail(null)
            setEpisodes([])
            setDetailError(null)
            setEpisodesError(null)
            setGlobalNotice('Nội dung này chưa khả dụng do chính sách bản quyền.')
          } else {
            setDetailError('Không thể tải chi tiết anime. Vui lòng thử lại.')
            setSeriesDetail(null)
          }
        })
        .finally(() => {
          if (requestId === detailRequestIdRef.current) {
            setIsLoadingDetail(false)
          }
        })

      // 2. Fetch series episodes
      animeApi
        .fetchSeriesEpisodes(slug, { page: 1, limit: 50 })
        .then((data) => {
          if (requestId !== detailRequestIdRef.current) return
          setEpisodes(data.items || [])
        })
        .catch((err: unknown) => {
          if (requestId !== detailRequestIdRef.current) return
          const isForbidden =
            (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 403) ||
            (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'ANIME_CONTENT_RESTRICTED')

          if (isForbidden) {
            currentDetailSlugRef.current = null
            updateUrlParams({ series: null, episode: null })
            setSeriesDetail(null)
            setEpisodes([])
            setDetailError(null)
            setEpisodesError(null)
            setGlobalNotice('Nội dung này chưa khả dụng do chính sách bản quyền.')
          } else {
            setEpisodes([])
            setEpisodesError('Không thể tải danh sách tập phim. Vui lòng thử lại.')
          }
        })
        .finally(() => {
          if (requestId === detailRequestIdRef.current) {
            setIsLoadingEpisodes(false)
          }
        })
    },
    [updateUrlParams]
  )

  // Trigger series detail and episodes fetch ONLY when urlSeries slug actually changes
  useEffect(() => {
    if (urlSeries === currentDetailSlugRef.current) {
      return
    }
    currentDetailSlugRef.current = urlSeries
    fetchDetailAndEpisodes(urlSeries)
  }, [urlSeries, fetchDetailAndEpisodes])

  const handleRetryDetail = useCallback(() => {
    if (urlSeries) {
      fetchDetailAndEpisodes(urlSeries)
    }
  }, [urlSeries, fetchDetailAndEpisodes])

  const handleRetryEpisodes = useCallback(() => {
    if (!urlSeries) return
    const requestId = ++detailRequestIdRef.current
    setIsLoadingEpisodes(true)
    setEpisodesError(null)

    animeApi
      .fetchSeriesEpisodes(urlSeries, { page: 1, limit: 50 })
      .then((data) => {
        if (requestId !== detailRequestIdRef.current) return
        setEpisodes(data.items || [])
      })
      .catch((err: unknown) => {
        if (requestId !== detailRequestIdRef.current) return
        const isForbidden =
          (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 403) ||
          (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'ANIME_CONTENT_RESTRICTED')

        if (isForbidden) {
          updateUrlParams({ series: null, episode: null })
          setSeriesDetail(null)
          setEpisodes([])
          setDetailError(null)
          setEpisodesError(null)
          setGlobalNotice('Nội dung này chưa khả dụng do chính sách bản quyền.')
        } else {
          setEpisodes([])
          setEpisodesError('Không thể tải danh sách tập phim. Vui lòng thử lại.')
        }
      })
      .finally(() => {
        if (requestId === detailRequestIdRef.current) {
          setIsLoadingEpisodes(false)
        }
      })
  }, [urlSeries, updateUrlParams])

  // Handle Search Input with 350ms debounce
  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current)
    }
    searchDebounceTimerRef.current = setTimeout(() => {
      updateUrlParams({ q: value, page: 1 })
    }, 350)
  }

  const handleSearchClear = () => {
    setSearchInput('')
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current)
    }
    updateUrlParams({ q: '', page: 1 })
  }

  // Handle Filter Changes
  const handleLevelChange = (level: string) => {
    updateUrlParams({ level, page: 1 })
  }

  const handleGenreChange = (genre: string) => {
    updateUrlParams({ genre, page: 1 })
  }

  const handleResetFilters = () => {
    setSearchInput('')
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current)
    }
    updateUrlParams({ q: '', level: 'ALL', genre: 'ALL', page: 1, series: null, episode: null })
  }

  // Pagination handlers
  const handlePrevPage = () => {
    if (urlPage > 1) {
      updateUrlParams({ page: urlPage - 1 })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleNextPage = () => {
    if (catalog?.pagination && urlPage < catalog.pagination.totalPages) {
      updateUrlParams({ page: urlPage + 1 })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Selection handlers
  const handleSelectSeries = (slug: string) => {
    updateUrlParams({ series: slug, episode: null })
  }

  const handleCloseDetail = () => {
    currentDetailSlugRef.current = null
    updateUrlParams({ series: null, episode: null })
    setSeriesDetail(null)
    setEpisodes([])
    setDetailError(null)
    setEpisodesError(null)
  }

  const handleSelectEpisode = (episodeId: string) => {
    updateUrlParams({ episode: episodeId })
  }

  // Determine empty states
  const hasActiveFilters = Boolean(urlQ.trim() || urlLevel !== 'ALL' || urlGenre !== 'ALL')
  const isCatalogEmpty = catalog !== null && catalog.items.length === 0
  const isPublicEmptyRights = isCatalogEmpty && !hasActiveFilters

  return (
    <PageShell width="wide" className="anime-page">
      <PageHeader
        eyebrow="Kotodama Anime"
        title="Học tiếng Nhật qua Anime"
        description="Kho phim có phụ đề Nhật – Việt tương tác, tra từ tại chỗ và lưu câu yêu thích để ôn tập."
        icon={Clapperboard}
      />

      {/* Global alert / notice (e.g. 403 content restricted) */}
      {globalNotice && (
        <div className="anime-alert anime-alert--notice" role="status" aria-live="polite">
          <ShieldAlert size={20} className="anime-alert__icon" aria-hidden="true" />
          <span>{globalNotice}</span>
          <button
            type="button"
            onClick={() => setGlobalNotice(null)}
            className="anime-alert__dismiss"
            aria-label="Đóng thông báo"
          >
            ×
          </button>
        </div>
      )}

      {/* Featured Hero Spotlight (Task T11) */}
      {!urlSeries && !urlEpisode && catalog?.items[0] && (
        <AnimeFeaturedHero
          series={catalog.items[0]}
          onSelect={handleSelectSeries}
        />
      )}

      {/* Search & Filters Compact Control Rail */}
      <AnimeCatalogFilters
        searchQuery={searchInput}
        onSearchChange={handleSearchChange}
        onSearchClear={handleSearchClear}
        selectedLevel={urlLevel}
        onLevelChange={handleLevelChange}
        selectedGenre={urlGenre}
        onGenreChange={handleGenreChange}
        availableGenres={availableGenres}
        onResetFilters={handleResetFilters}
      />

      {/* Continue Watching Section (Task T07) */}
      {!urlEpisode && !urlSeries && (
        <AnimeContinueWatching
          onSelectEpisode={(seriesSlug, episodeId) => {
            updateUrlParams({ series: seriesSlug, episode: episodeId })
          }}
        />
      )}

      {/* Active Episode Learning Session (T06) */}
      {urlEpisode ? (
        <AnimeLearningSession
          episodeId={urlEpisode}
          onBackToEpisodes={() => updateUrlParams({ episode: null })}
        />
      ) : urlSeries ? (
        <AnimeSeriesDetail
          series={seriesDetail}
          episodes={episodes}
          isLoadingSeries={isLoadingDetail}
          isLoadingEpisodes={isLoadingEpisodes}
          seriesError={detailError}
          episodesError={episodesError}
          selectedEpisodeId={urlEpisode}
          onSelectEpisode={handleSelectEpisode}
          onClose={handleCloseDetail}
          onRetry={handleRetryDetail}
          onRetryEpisodes={handleRetryEpisodes}
        />
      ) : null}

      {/* Screen reader status announcer */}
      <div id={statusRegionId} className="sr-only" aria-live="polite">
        {isLoadingCatalog
          ? 'Đang tải danh sách anime…'
          : isPublicEmptyRights
            ? 'Thư viện chưa có nội dung được cấp phép để hiển thị công khai.'
            : isCatalogEmpty
              ? 'Không tìm thấy series phù hợp với bộ lọc.'
              : `Hiển thị ${catalog?.items.length ?? 0} bộ anime, trang ${urlPage} trên ${
                  catalog?.pagination.totalPages ?? 1
                }.`}
      </div>

      {/* Main Catalog View */}
      <section className="anime-catalog-section" aria-label="Danh mục anime">
        {isLoadingCatalog ? (
          // Skeleton Loading Grid (6 cards)
          <div className="anime-grid" aria-label="Đang tải danh sách phim">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="anime-card-skeleton" aria-hidden="true">
                <div className="anime-card-skeleton__poster" />
                <div className="anime-card-skeleton__body">
                  <div className="anime-card-skeleton__line anime-card-skeleton__line--title" />
                  <div className="anime-card-skeleton__line anime-card-skeleton__line--subtitle" />
                  <div className="anime-card-skeleton__tags">
                    <div className="anime-card-skeleton__tag" />
                    <div className="anime-card-skeleton__tag" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : catalogError ? (
          // Error State with Retry
          <div className="anime-state-card anime-state-card--error" role="alert">
            <AlertCircle size={40} className="anime-state-card__icon" aria-hidden="true" />
            <h2 className="anime-state-card__title">Không thể tải danh mục</h2>
            <p className="anime-state-card__desc">{catalogError}</p>
            <button
              type="button"
              onClick={() => void fetchCatalogData()}
              className="anime-btn anime-btn--primary"
            >
              <RotateCcw size={16} aria-hidden="true" />
              <span>Thử lại</span>
            </button>
          </div>
        ) : isPublicEmptyRights ? (
          // Public Empty Rights Notice (Without leaking restricted counts or metadata)
          <div className="anime-state-card anime-state-card--rights" role="status">
            <ShieldAlert size={44} className="anime-state-card__icon anime-state-card__icon--rights" aria-hidden="true" />
            <h2 className="anime-state-card__title">Nội dung đang được kiểm duyệt</h2>
            <p className="anime-state-card__desc">
              Thư viện chưa có nội dung được cấp phép để hiển thị công khai.
            </p>
          </div>
        ) : isCatalogEmpty ? (
          // Empty Search / Filter State
          <div className="anime-state-card anime-state-card--empty" role="status">
            <Clapperboard size={40} className="anime-state-card__icon" aria-hidden="true" />
            <h2 className="anime-state-card__title">Không tìm thấy series phù hợp</h2>
            <p className="anime-state-card__desc">
              Không có bộ anime nào khớp với tiêu chí tìm kiếm hoặc bộ lọc hiện tại.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="anime-btn anime-btn--secondary"
            >
              Xóa bộ lọc
            </button>
          </div>
        ) : (
          // Normal Catalog Grid
          <>
            <div className="anime-catalog-section__header">
              <h2 className="anime-catalog-section__title">Tất cả phim</h2>
              <span className="anime-catalog-section__count">
                {catalog?.pagination.totalItems ?? catalog?.items.length ?? 0} series
              </span>
            </div>

            <div className="anime-grid">
              {catalog?.items.map((series) => (
                <AnimeSeriesCard
                  key={series.series_id}
                  series={series}
                  onSelect={handleSelectSeries}
                  isSelected={urlSeries === series.series_slug}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {catalog?.pagination && catalog.pagination.totalPages > 1 && (
              <nav className="anime-pagination" aria-label="Phân trang danh mục anime">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={urlPage <= 1}
                  className="anime-pagination__btn"
                  aria-label="Trang trước"
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                  <span>Trước</span>
                </button>

                <span className="anime-pagination__info">
                  Trang <strong>{urlPage}</strong> / {catalog.pagination.totalPages} ({catalog.pagination.totalItems} series)
                </span>

                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={urlPage >= catalog.pagination.totalPages}
                  className="anime-pagination__btn"
                  aria-label="Trang sau"
                >
                  <span>Sau</span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </nav>
            )}
          </>
        )}
      </section>
    </PageShell>
  )
}
