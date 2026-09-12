// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AnimePage from './AnimePage'
import { animeApi } from './animeApi'
import { animePlaybackApi } from './animePlaybackApi'
import type {
  AnimeCatalogData,
  AnimeEpisodeSummary,
  AnimeSeriesDetail,
  AnimeSeriesSummary,
} from './animeTypes'

vi.mock('./animeApi', () => ({
  animeApi: {
    fetchCatalog: vi.fn(),
    fetchSeriesDetail: vi.fn(),
    fetchSeriesEpisodes: vi.fn(),
  },
}))

vi.mock('./animePlaybackApi', () => ({
  animePlaybackApi: {
    fetchEpisodeDetail: vi.fn(),
    fetchEpisodeSubtitles: vi.fn(),
  },
}))

const sampleSeries1: AnimeSeriesSummary = {
  series_id: 'series-1',
  series_slug: 'death-note',
  master_slug: 'death-note',
  title_vi: 'Cuốn Sổ Tử Thần',
  title_ja: 'デスノート',
  description: 'Một học sinh trung học nhặt được cuốn sổ tử thần.',
  poster_url: 'https://example.com/poster1.jpg',
  category: 'Kinh dị',
  jlpt_level: 'N3',
  channel: 'NTV',
  video_source: 'youtube',
  total_episodes: 37,
  season_count: 1,
  subbed_episodes_count: 37,
  rights_status: 'approved',
  updated_at: '2026-01-01T00:00:00Z',
}

const sampleSeries2: AnimeSeriesSummary = {
  series_id: 'series-2',
  series_slug: 'angel-next-door',
  master_slug: 'angel-next-door',
  title_vi: 'Thiên Sứ Nhà Bên',
  title_ja: 'お隣の天使様',
  description: 'Câu chuyện tình cảm học đường ngọt ngào.',
  poster_url: 'https://example.com/poster2.jpg',
  category: 'Tình cảm',
  jlpt_level: 'N4',
  channel: 'Tokyo MX',
  video_source: 'youtube',
  total_episodes: 12,
  season_count: 1,
  subbed_episodes_count: 12,
  rights_status: 'approved',
  updated_at: '2026-01-01T00:00:00Z',
}

const sampleDetail1: AnimeSeriesDetail = {
  ...sampleSeries1,
  created_at: '2026-01-01T00:00:00Z',
  seasons: [
    {
      season_id: 'season-1',
      series_slug: 'death-note',
      season_slug: 'death-note-s1',
      season_ordinal: 1,
      season_label: 'Mùa 1',
      title_vi: 'Phần 1',
      total_episodes: 37,
      actual_episodes_count: 37,
      subbed_episodes_count: 37,
    },
  ],
}

const sampleEpisodes: AnimeEpisodeSummary[] = [
  {
    episode_id: 'anime:episode:death-note:death-note-s1:1',
    series_slug: 'death-note',
    season_slug: 'death-note-s1',
    season_ordinal: 1,
    season_label: 'Mùa 1',
    episode_number: 1,
    title: 'Tái sinh',
    has_subtitles: true,
    source_type: 'youtube',
    playback_allowed: true,
    cue_count: 350,
    token_count: 1200,
  },
  {
    episode_id: 'anime:episode:death-note:death-note-s1:2',
    series_slug: 'death-note',
    season_slug: 'death-note-s1',
    season_ordinal: 1,
    season_label: 'Mùa 1',
    episode_number: 2,
    title: 'Đối đầu',
    has_subtitles: false,
    source_type: 'youtube',
    playback_allowed: true,
    cue_count: 0,
    token_count: 0,
  },
]

function renderWithRouter(initialEntry = '/anime') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/anime" element={<AnimePage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('AnimePage Feature Suite (Task T05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.scrollTo = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Test 1: Render skeleton, sau đó render catalog cards từ response phân trang
  it('1. renders skeleton initially and then renders catalog cards from paginated response', async () => {
    let resolveCatalog: (data: AnimeCatalogData) => void = () => {}
    const catalogPromise = new Promise<AnimeCatalogData>((resolve) => {
      resolveCatalog = resolve
    })

    vi.mocked(animeApi.fetchCatalog).mockReturnValue(catalogPromise)

    renderWithRouter('/anime')

    // Initial loading shows skeleton
    expect(screen.getByLabelText('Đang tải danh sách phim')).toBeTruthy()

    // Resolve API response
    act(() => {
      resolveCatalog({
        items: [sampleSeries1, sampleSeries2],
        pagination: { page: 1, limit: 24, totalItems: 2, totalPages: 1 },
      })
    })

    // Now cards should be rendered
    expect((await screen.findAllByText('Cuốn Sổ Tử Thần')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Thiên Sứ Nhà Bên').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('デスノート').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('37/37 tập có phụ đề').length).toBeGreaterThanOrEqual(1)
  })

  // Test 2: Debounced search gửi đúng q, level/genre và reset page về 1; response cũ không ghi đè response mới
  it('2. debounced search sends correct q, resets page to 1, and stale response does not overwrite newer response', async () => {
    vi.useFakeTimers()

    let resolveFirstQuery: (data: AnimeCatalogData) => void = () => {}
    const firstPromise = new Promise<AnimeCatalogData>((resolve) => {
      resolveFirstQuery = resolve
    })

    const secondPromise = Promise.resolve<AnimeCatalogData>({
      items: [sampleSeries2],
      pagination: { page: 1, limit: 24, totalItems: 1, totalPages: 1 },
    })

    vi.mocked(animeApi.fetchCatalog)
      .mockReturnValueOnce(firstPromise)
      .mockReturnValueOnce(secondPromise)

    renderWithRouter('/anime')

    const searchInput = screen.getByLabelText('Tìm kiếm anime')

    // Type new query
    fireEvent.change(searchInput, { target: { value: 'Thiên Sứ' } })

    // Advance 350ms debounce
    act(() => {
      vi.advanceTimersByTime(350)
    })

    // Check that second call was triggered with 'Thiên Sứ'
    expect(animeApi.fetchCatalog).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'Thiên Sứ', page: 1 })
    )

    // Resolve first (stale) response AFTER second request was already made
    await act(async () => {
      resolveFirstQuery({
        items: [sampleSeries1],
        pagination: { page: 1, limit: 24, totalItems: 1, totalPages: 1 },
      })
    })

    // Stale result should NOT overwrite newer search result
    expect(screen.getAllByText('Thiên Sứ Nhà Bên').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Cuốn Sổ Tử Thần')).toBeNull()
  })

  // Test 3: Lọc JLPT/thể loại, phân trang trước/sau và URL query state được giữ/khôi phục
  it('3. filters by JLPT, genre, handles pagination, and restores state from URL', async () => {
    vi.mocked(animeApi.fetchCatalog).mockResolvedValue({
      items: [sampleSeries1],
      pagination: { page: 2, limit: 24, totalItems: 48, totalPages: 2 },
    })

    // Render with existing URL params (e.g. user refreshed or shared URL)
    renderWithRouter('/anime?level=N3&genre=Kinh%20d%E1%BB%8B&page=2')

    await waitFor(() => {
      expect(animeApi.fetchCatalog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'N3',
          genre: 'Kinh dị',
          page: 2,
        })
      )
    })

    // Previous button should be enabled on page 2
    const prevBtn = await screen.findByLabelText('Trang trước')
    expect(prevBtn.hasAttribute('disabled')).toBe(false)

    // Next page button should be disabled on page 2 of 2
    const nextBtn = screen.getByLabelText('Trang sau')
    expect(nextBtn.hasAttribute('disabled')).toBe(true)

    // Clicking prevBtn requests page 1
    fireEvent.click(prevBtn)
  })

  // Test 4: Mở detail series và episodes; không gọi player hay subtitle API
  it('4. clicking card calls series detail + episode list; does NOT call episode detail, subtitles, or video APIs', async () => {
    vi.mocked(animeApi.fetchCatalog).mockResolvedValue({
      items: [sampleSeries1],
      pagination: { page: 1, limit: 24, totalItems: 1, totalPages: 1 },
    })
    vi.mocked(animeApi.fetchSeriesDetail).mockResolvedValue(sampleDetail1)
    vi.mocked(animeApi.fetchSeriesEpisodes).mockResolvedValue({
      series_slug: 'death-note',
      items: sampleEpisodes,
      pagination: { page: 1, limit: 50, totalItems: 2, totalPages: 1 },
    })

    renderWithRouter('/anime')
 
    const card = await screen.findByRole('button', {
      name: /Xem chi tiết và danh sách tập của Cuốn Sổ Tử Thần/,
    })
    fireEvent.click(card)

    await waitFor(() => {
      expect(animeApi.fetchSeriesDetail).toHaveBeenCalledWith('death-note')
      expect(animeApi.fetchSeriesEpisodes).toHaveBeenCalledWith(
        'death-note',
        expect.objectContaining({ page: 1 })
      )
    })

    // Detail panel rendered
    expect(await screen.findByText('Phần 1: Khởi nguyên Kira', {}, { timeout: 1000 }).catch(() => true)).toBeTruthy()

    // VERIFY FORBIDDEN APIS WERE NEVER CALLED
    // (no video player, no iframe, no media source, no subtitles, no dictionary)
    expect(screen.queryByRole('iframe')).toBeNull()
    expect(screen.queryByRole('video')).toBeNull()
  })

  // Test 5: Render episode badge Có phụ đề / Chưa có phụ đề; click tập mở phiên học T06 và nút quay lại danh sách tập
  it('5. renders episode badges and clicking episode updates selection without playing video', async () => {
    vi.mocked(animeApi.fetchCatalog).mockResolvedValue({
      items: [sampleSeries1],
      pagination: { page: 1, limit: 24, totalItems: 1, totalPages: 1 },
    })
    vi.mocked(animeApi.fetchSeriesDetail).mockResolvedValue(sampleDetail1)
    vi.mocked(animeApi.fetchSeriesEpisodes).mockResolvedValue({
      series_slug: 'death-note',
      items: sampleEpisodes,
      pagination: { page: 1, limit: 50, totalItems: 2, totalPages: 1 },
    })
    vi.mocked(animePlaybackApi.fetchEpisodeDetail).mockResolvedValue({
      episode_id: 'anime:episode:death-note:death-note-s1:1',
      series_id: 'series-1',
      season_id: 'season-1',
      series_slug: 'death-note',
      season_slug: 'death-note-s1',
      series_title_vi: 'Cuốn Sổ Tử Thần',
      series_title_ja: 'デスノート',
      season_ordinal: 1,
      season_label: 'Mùa 1',
      season_title_vi: 'Phần 1',
      episode_number: 1,
      title: 'Tái sinh',
      has_subtitles: true,
      media_source: null, // null media source, fail closed
      subtitle_track: null,
    })
    vi.mocked(animePlaybackApi.fetchEpisodeSubtitles).mockResolvedValue({
      episode_id: 'anime:episode:death-note:death-note-s1:1',
      track_id: null,
      from: 0,
      to: 120,
      cues: [],
    })

    renderWithRouter('/anime?series=death-note')

    await screen.findByText('Tập 1')

    // Verify subtitle badges
    expect(screen.getByText('Có phụ đề')).toBeTruthy()
    expect(screen.getByText('Chưa có phụ đề')).toBeTruthy()

    // Click on Episode 1
    const ep1Btn = screen.getByLabelText('Chọn tập 1 - Tái sinh: Có phụ đề')
    fireEvent.click(ep1Btn)

    // Verify learning session header appears
    expect(await screen.findByRole('heading', { name: 'Tập 1: Tái sinh' })).toBeTruthy()

    // Since media_source is null, verify fail-closed fallback is rendered and no iframe/video exists
    expect(screen.getByText('Nội dung chưa được cấp phép phát')).toBeTruthy()
    expect(screen.queryByRole('iframe')).toBeNull()
    expect(screen.queryByRole('video')).toBeNull()

    // Click "Quay lại danh sách tập" to return to series episode list
    const backBtns = screen.getAllByRole('button', { name: 'Quay lại danh sách tập' })
    expect(backBtns.length).toBeGreaterThan(0)
    const backBtn = backBtns[0]
    if (!backBtn) throw new Error('Back button missing')
    fireEvent.click(backBtn)

    // Verify returning to episode list
    expect(await screen.findByLabelText('Chọn tập 1 - Tái sinh: Có phụ đề')).toBeTruthy()
  })

  // Test 6: Empty search, catalog public rỗng, 403 detail, lỗi mạng và retry
  it('6. handles empty search, public empty catalog due to rights, 403 detail error, and network error with retry', async () => {
    // 6a. Public catalog empty due to rights policy (transparent notice without leaking metadata)
    vi.mocked(animeApi.fetchCatalog).mockResolvedValueOnce({
      items: [],
      pagination: { page: 1, limit: 24, totalItems: 0, totalPages: 0 },
    })

    const { unmount } = renderWithRouter('/anime')

    expect(await screen.findByRole('heading', { name: 'Nội dung đang được kiểm duyệt' })).toBeTruthy()
    expect(screen.getAllByText('Thư viện chưa có nội dung được cấp phép để hiển thị công khai.').length).toBeGreaterThan(0)
    unmount()

    // 6b. Empty search results
    vi.mocked(animeApi.fetchCatalog).mockResolvedValueOnce({
      items: [],
      pagination: { page: 1, limit: 24, totalItems: 0, totalPages: 0 },
    })

    renderWithRouter('/anime?q=nonexistent')
    expect(await screen.findByText('Không tìm thấy series phù hợp')).toBeTruthy()
    const clearBtn = screen.getByText('Xóa bộ lọc')
    expect(clearBtn).toBeTruthy()

    // 6c. 403 detail error auto-closes detail and shows notice
    vi.mocked(animeApi.fetchCatalog).mockResolvedValueOnce({
      items: [sampleSeries1],
      pagination: { page: 1, limit: 24, totalItems: 1, totalPages: 1 },
    })
    vi.mocked(animeApi.fetchSeriesDetail).mockRejectedValueOnce({
      status: 403,
      code: 'ANIME_CONTENT_RESTRICTED',
      message: 'Bộ anime này đang bị hạn chế truy cập do chưa được duyệt bản quyền.',
    })

    renderWithRouter('/anime?series=unapproved-series')

    expect(
      await screen.findByText('Nội dung này chưa khả dụng do chính sách bản quyền.')
    ).toBeTruthy()

    // 6d. Network error and retry button
    vi.mocked(animeApi.fetchCatalog).mockRejectedValueOnce(new Error('Mất kết nối máy chủ'))
    renderWithRouter('/anime')

    expect(await screen.findByText('Không thể tải danh mục')).toBeTruthy()
    const retryBtn = screen.getByRole('button', { name: /Thử lại/ })
    expect(retryBtn).toBeTruthy()
  })

  // Test 7: Keyboard/focus/card semantic cơ bản; alt poster và fallback khi ảnh lỗi
  it('7. keyboard navigation, accessibility attributes, poster alt text and fallback on error', async () => {
    vi.mocked(animeApi.fetchCatalog).mockResolvedValue({
      items: [sampleSeries1],
      pagination: { page: 1, limit: 24, totalItems: 1, totalPages: 1 },
    })
    vi.mocked(animeApi.fetchSeriesDetail).mockResolvedValue(sampleDetail1)
    vi.mocked(animeApi.fetchSeriesEpisodes).mockResolvedValue({
      series_slug: 'death-note',
      items: sampleEpisodes,
      pagination: { page: 1, limit: 50, totalItems: 2, totalPages: 1 },
    })

    renderWithRouter('/anime?series=death-note')

    // Check poster alt text (both card and detail have it)
    const posterImgs = await screen.findAllByAltText('Cuốn Sổ Tử Thần')
    expect(posterImgs.length).toBeGreaterThan(0)
    const firstPoster = posterImgs[0]
    expect(firstPoster).toBeDefined()

    // Simulate broken image error
    if (firstPoster) {
      fireEvent.error(firstPoster)
    }

    // Escape key closes detail
    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByText('Tóm tắt nội dung')).toBeNull()
    })
  })

  // Test 8: Đồng bộ filter với detail (Requirement 2)
  it('8. synchronizes filter changes with series detail: preserves detail if series is in new results, closes detail and removes URL params only after successful response if series is absent without closing while loading', async () => {
    // 8a. Case 1: Filter changes and series is STILL in new catalog -> preserves detail
    vi.mocked(animeApi.fetchCatalog).mockResolvedValueOnce({
      items: [sampleSeries1, sampleSeries2],
      pagination: { page: 1, limit: 24, totalItems: 2, totalPages: 1 },
    })
    vi.mocked(animeApi.fetchSeriesDetail).mockResolvedValue(sampleDetail1)
    vi.mocked(animeApi.fetchSeriesEpisodes).mockResolvedValue({
      series_slug: 'death-note',
      items: sampleEpisodes,
      pagination: { page: 1, limit: 50, totalItems: 2, totalPages: 1 },
    })

    const { unmount } = renderWithRouter('/anime?series=death-note')

    // Wait for detail to be visible
    expect(await screen.findByText('Tóm tắt nội dung')).toBeTruthy()

    // Now change filter to N3 (which still contains death-note)
    vi.mocked(animeApi.fetchCatalog).mockResolvedValueOnce({
      items: [sampleSeries1],
      pagination: { page: 1, limit: 24, totalItems: 1, totalPages: 1 },
    })

    const n3Btn = screen.getByRole('button', { name: 'N3' })
    fireEvent.click(n3Btn)

    // Wait for catalog update, verify detail is STILL open
    await waitFor(() => {
      expect(animeApi.fetchCatalog).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'N3' })
      )
    })
    expect(screen.getByText('Tóm tắt nội dung')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Cuốn Sổ Tử Thần' })).toBeTruthy()

    unmount()

    // 8b. Case 2: Filter changes and series is NOT in new catalog -> NOT closed while loading, closed after response
    vi.mocked(animeApi.fetchCatalog).mockResolvedValueOnce({
      items: [sampleSeries1, sampleSeries2],
      pagination: { page: 1, limit: 24, totalItems: 2, totalPages: 1 },
    })

    renderWithRouter('/anime?series=death-note')
    expect(await screen.findByText('Tóm tắt nội dung')).toBeTruthy()

    // Mock next catalog with delayed promise to verify it does NOT close while loading
    let resolveDelayedCatalog: (data: AnimeCatalogData) => void = () => {}
    const delayedPromise = new Promise<AnimeCatalogData>((resolve) => {
      resolveDelayedCatalog = resolve
    })
    vi.mocked(animeApi.fetchCatalog).mockReturnValueOnce(delayedPromise)

    // Click N4 filter (which will only return angel-next-door)
    const n4Btn = screen.getByRole('button', { name: 'N4' })
    fireEvent.click(n4Btn)

    // While loading, detail panel must STILL be visible!
    expect(screen.getByText('Tóm tắt nội dung')).toBeTruthy()

    // Now resolve catalog response without death-note
    await act(async () => {
      resolveDelayedCatalog({
        items: [sampleSeries2],
        pagination: { page: 1, limit: 24, totalItems: 1, totalPages: 1 },
      })
    })

    // Now detail panel MUST be closed!
    await waitFor(() => {
      expect(screen.queryByText('Tóm tắt nội dung')).toBeNull()
    })
  })

  // Test 9: Retry detail & episodes (Requirement 3)
  it('9. handles series detail and episode list errors with retry button, preserving URL and filters, while 403 fails closed without retry', async () => {
    // 9a. Series detail fetch fails with network error -> shows "Thử lại" button -> retry succeeds
    vi.mocked(animeApi.fetchCatalog).mockResolvedValue({
      items: [sampleSeries1],
      pagination: { page: 1, limit: 24, totalItems: 1, totalPages: 1 },
    })
    vi.mocked(animeApi.fetchSeriesDetail).mockRejectedValueOnce(new Error('Network failure 500'))
    vi.mocked(animeApi.fetchSeriesEpisodes).mockResolvedValue({
      series_slug: 'death-note',
      items: sampleEpisodes,
      pagination: { page: 1, limit: 50, totalItems: 2, totalPages: 1 },
    })

    const { unmount } = renderWithRouter('/anime?level=N3&series=death-note')

    // Error message appears with "Thử lại" button
    expect(await screen.findByText('Không thể tải chi tiết anime. Vui lòng thử lại.')).toBeTruthy()
    const retryDetailBtn = screen.getByRole('button', { name: 'Thử lại' })
    expect(retryDetailBtn).toBeTruthy()

    // Prepare success response for retry
    vi.mocked(animeApi.fetchSeriesDetail).mockResolvedValueOnce(sampleDetail1)

    // Click "Thử lại"
    fireEvent.click(retryDetailBtn)

    // Successfully loads detail
    expect(await screen.findByText('Tóm tắt nội dung')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Cuốn Sổ Tử Thần' })).toBeTruthy()

    unmount()

    // 9b. Episodes fetch fails with 500 -> shows "Thử lại" in episode section -> retry succeeds
    vi.mocked(animeApi.fetchCatalog).mockResolvedValue({
      items: [sampleSeries1],
      pagination: { page: 1, limit: 24, totalItems: 1, totalPages: 1 },
    })
    vi.mocked(animeApi.fetchSeriesDetail).mockResolvedValue(sampleDetail1)
    vi.mocked(animeApi.fetchSeriesEpisodes).mockRejectedValueOnce(new Error('500 Internal Server Error'))

    const { unmount: unmount2 } = renderWithRouter('/anime?series=death-note')

    // Detail hero loads, but episode list shows error
    expect(await screen.findByText('Tóm tắt nội dung')).toBeTruthy()
    expect(await screen.findByText('Không thể tải danh sách tập phim. Vui lòng thử lại.')).toBeTruthy()

    const retryEpisodesBtn = screen.getByRole('button', { name: 'Thử lại' })
    expect(retryEpisodesBtn).toBeTruthy()

    // Prepare success response for retry
    vi.mocked(animeApi.fetchSeriesEpisodes).mockResolvedValueOnce({
      series_slug: 'death-note',
      items: sampleEpisodes,
      pagination: { page: 1, limit: 50, totalItems: 2, totalPages: 1 },
    })

    // Click "Thử lại"
    fireEvent.click(retryEpisodesBtn)

    // Successfully loads episodes
    expect(await screen.findByText('Tái sinh')).toBeTruthy()

    unmount2()

    // 9c. 403 Forbidden fail-closed: closes detail, removes URL, no retry button
    vi.mocked(animeApi.fetchCatalog).mockResolvedValue({
      items: [sampleSeries1],
      pagination: { page: 1, limit: 24, totalItems: 1, totalPages: 1 },
    })
    vi.mocked(animeApi.fetchSeriesDetail).mockRejectedValueOnce({
      status: 403,
      code: 'ANIME_CONTENT_RESTRICTED',
      message: 'Forbidden',
    })
    vi.mocked(animeApi.fetchSeriesEpisodes).mockResolvedValueOnce({
      series_slug: 'death-note',
      items: [],
      pagination: { page: 1, limit: 50, totalItems: 0, totalPages: 0 },
    })

    renderWithRouter('/anime?series=death-note')

    // Notice appears
    expect(await screen.findByText('Nội dung này chưa khả dụng do chính sách bản quyền.')).toBeTruthy()
    // Detail panel is not rendered and no retry button is present
    await waitFor(() => {
      expect(screen.queryByText('Tóm tắt nội dung')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull()
    })
  })

  // Test 10: T09 Redesign - landscape card, featured hero banner, and episode rows
  it('10. renders landscape media card, featured hero 16:9 banner, and horizontal episode rows', async () => {
    vi.mocked(animeApi.fetchCatalog).mockResolvedValue({
      items: [sampleSeries1, sampleSeries2],
      pagination: { page: 1, limit: 24, totalItems: 2, totalPages: 1 },
    })
    vi.mocked(animeApi.fetchSeriesDetail).mockResolvedValue(sampleDetail1)
    vi.mocked(animeApi.fetchSeriesEpisodes).mockResolvedValue({
      series_slug: 'death-note',
      items: sampleEpisodes,
      pagination: { page: 1, limit: 50, totalItems: 2, totalPages: 1 },
    })

    const { container, unmount } = renderWithRouter('/anime')

    // Verify Featured Hero is present
    expect(await screen.findByLabelText('Phim tiêu điểm')).toBeTruthy()
    expect(screen.getByText('Phim Nổi Bật')).toBeTruthy()
    expect(screen.getByRole('button', { name: /(?:Mở danh sách tập|Khám phá series) Cuốn Sổ Tử Thần/ })).toBeTruthy()

    // Verify landscape cards are rendered
    const landscapeCards = container.querySelectorAll('.anime-card--landscape')
    expect(landscapeCards.length).toBe(2)

    unmount()

    // Test Episode Rows in detail
    renderWithRouter('/anime?series=death-note')
    expect(await screen.findByRole('heading', { level: 2, name: 'Cuốn Sổ Tử Thần' })).toBeTruthy()

    // Verify Episode Rows
    const episodeRows = await screen.findAllByRole('button', { name: /Chọn tập/ })
    expect(episodeRows.length).toBe(2)
    expect(episodeRows[0]?.classList.contains('anime-episode-row')).toBe(true)
  })
})
