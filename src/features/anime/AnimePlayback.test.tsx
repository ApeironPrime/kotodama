// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnimeLearningSession } from './AnimeLearningSession'
import { AnimePlayer } from './AnimePlayer'
import { animePlaybackApi } from './animePlaybackApi'
import type { AnimeEpisodeDetail, AnimeSubtitleWindowData } from './animePlaybackTypes'

vi.mock('./animePlaybackApi', () => ({
  animePlaybackApi: {
    fetchEpisodeDetail: vi.fn(),
    fetchEpisodeSubtitles: vi.fn(),
  },
}))

describe('AnimePlayback Suite (Task T06)', () => {
  const sampleYoutubeEpisode: AnimeEpisodeDetail = {
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
    media_source: {
      source_type: 'youtube',
      media_id: 'yt-test-id-123',
      page_url: 'https://youtube.com/watch?v=yt-test-id-123',
      playback_allowed: true,
      rights_status: 'approved',
    },
    subtitle_track: {
      track_id: 'track-1',
      languages: ['ja', 'vi'],
      cue_count: 10,
      token_count: 50,
      word_linked_token_count: 30,
    },
  }

  const sampleLocalEpisode: AnimeEpisodeDetail = {
    ...sampleYoutubeEpisode,
    episode_id: 'anime:episode:death-note:death-note-s1:2',
    episode_number: 2,
    title: 'Đối đầu',
    media_source: {
      source_type: 'authorized_local',
      media_id: null,
      page_url: '/media/anime/death-note/ep2.mp4',
      playback_allowed: true,
      rights_status: 'approved',
    },
  }

  const sampleExternalEpisode: AnimeEpisodeDetail = {
    ...sampleYoutubeEpisode,
    episode_id: 'anime:episode:death-note:death-note-s1:3',
    episode_number: 3,
    title: 'Giao dịch',
    media_source: {
      source_type: 'external_page',
      media_id: null,
      page_url: 'https://unsafe-external.com/watch',
      playback_allowed: false,
      rights_status: 'unknown',
    },
  }

  const sampleUnavailableEpisode: AnimeEpisodeDetail = {
    ...sampleYoutubeEpisode,
    episode_id: 'anime:episode:death-note:death-note-s1:4',
    episode_number: 4,
    title: 'Truy đuổi',
    media_source: {
      source_type: 'unavailable',
      media_id: null,
      page_url: null,
      playback_allowed: false,
      rights_status: 'unknown',
    },
  }

  const sampleSubtitlesWindow1: AnimeSubtitleWindowData = {
    episode_id: 'anime:episode:death-note:death-note-s1:1',
    track_id: 'track-1',
    from: 0,
    to: 120,
    cues: [
      { cue_id: 1, start: 10.0, end: 15.0, ja: 'おはよう世界', vi: 'Chào buổi sáng thế giới' },
      { cue_id: 2, start: 16.0, end: 20.0, ja: '事件が起きた', vi: 'Một vụ án đã xảy ra' },
      { cue_id: 3, start: 100.0, end: 105.0, ja: '近いぞ', vi: 'Đến gần rồi' },
    ],
  }

  const sampleSubtitlesWindow2: AnimeSubtitleWindowData = {
    episode_id: 'anime:episode:death-note:death-note-s1:1',
    track_id: 'track-1',
    from: 120,
    to: 240,
    cues: [
      { cue_id: 4, start: 130.0, end: 135.0, ja: '次の手がかり', vi: 'Manh mối tiếp theo' },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -----------------------------------------------------------------
  // Test 1: Permitted YouTube & Native Video
  // -----------------------------------------------------------------
  it('1. mounts YouTube adapter with correct ID and NO autoplay; renders native video for authorized_local', async () => {
    vi.mocked(animePlaybackApi.fetchEpisodeDetail).mockResolvedValueOnce(sampleYoutubeEpisode)
    vi.mocked(animePlaybackApi.fetchEpisodeSubtitles).mockResolvedValueOnce(sampleSubtitlesWindow1)

    const onBack = vi.fn()
    const { unmount } = render(
      <MemoryRouter>
        <AnimeLearningSession episodeId={sampleYoutubeEpisode.episode_id} onBackToEpisodes={onBack} />
      </MemoryRouter>
    )

    // Heading and title
    expect(await screen.findByRole('heading', { name: 'Tập 1: Tái sinh' })).toBeTruthy()

    // The official IFrame API owns the actual iframe. Before its external script
    // resolves, React only renders a stable mount point (never a second, manual iframe).
    const youtubeMount = screen.getByTestId('anime-youtube-player')
    expect(youtubeMount).toBeTruthy()
    expect(youtubeMount.querySelector('[id^="yt-player-"]')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Đang chuẩn bị trình phát YouTube')
    expect(screen.queryByTestId('anime-native-video')).toBeNull()
    unmount()

    // Now test authorized_local
    vi.mocked(animePlaybackApi.fetchEpisodeDetail).mockResolvedValueOnce(sampleLocalEpisode)
    vi.mocked(animePlaybackApi.fetchEpisodeSubtitles).mockResolvedValueOnce(sampleSubtitlesWindow1)

    render(
      <MemoryRouter>
        <AnimeLearningSession episodeId={sampleLocalEpisode.episode_id} onBackToEpisodes={onBack} />
      </MemoryRouter>
    )

    expect(await screen.findByRole('heading', { name: 'Tập 2: Đối đầu' })).toBeTruthy()
    const video = screen.getByTestId('anime-native-video') as HTMLVideoElement
    expect(video).toBeTruthy()
    expect(video.getAttribute('src')).toBe('/media/anime/death-note/ep2.mp4')
    expect(screen.queryByTestId('anime-youtube-player')).toBeNull()
  })

  it('1b. routes the custom play and pause control to a ready YouTube player', async () => {
    const playVideo = vi.fn()
    const pauseVideo = vi.fn()
    const player = {
      playVideo,
      pauseVideo,
      seekTo: vi.fn(),
      getCurrentTime: vi.fn(() => 0),
      getDuration: vi.fn(() => 60),
      isMuted: vi.fn(() => false),
      mute: vi.fn(),
      unMute: vi.fn(),
      getVolume: vi.fn(() => 100),
      setVolume: vi.fn(),
      destroy: vi.fn(),
    }

    const playerConstructor = vi.fn(function (
      _elementId: string | HTMLElement,
      config: { events?: { onReady?: (event: { target: typeof player }) => void } }
    ) {
        config.events?.onReady?.({ target: player })
        return player
      })

    window.YT = {
      Player: playerConstructor,
      PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0, BUFFERING: 3, CUED: 5 },
    } as unknown as NonNullable<Window['YT']>

    const { unmount } = render(
      <AnimePlayer
        mediaSource={sampleYoutubeEpisode.media_source}
        onTimeUpdate={vi.fn()}
        onDurationChange={vi.fn()}
        onPlaybackStateChange={vi.fn()}
        onError={vi.fn()}
      />
    )

    await waitFor(() => expect(playerConstructor).toHaveBeenCalled())
    const playButton = screen.getByRole('button', { name: 'Phát (Space)' })
    fireEvent.click(playButton)
    expect(playVideo).toHaveBeenCalledTimes(1)

    unmount()
    delete window.YT
  })

  // -----------------------------------------------------------------
  // Test 2: Fail-Closed Policies (external_page, unavailable, 403, missing)
  // -----------------------------------------------------------------
  it('2. fail-closed on external_page, unavailable, 403, and invalid sources without rendering video or leaking URL', async () => {
    const onBack = vi.fn()

    // 2a: external_page
    vi.mocked(animePlaybackApi.fetchEpisodeDetail).mockResolvedValueOnce(sampleExternalEpisode)
    const { rerender } = render(
      <MemoryRouter>
        <AnimeLearningSession episodeId={sampleExternalEpisode.episode_id} onBackToEpisodes={onBack} />
      </MemoryRouter>
    )

    expect(await screen.findByText('Nguồn phát bên ngoài')).toBeTruthy()
    expect(
      screen.getByText(/không hỗ trợ nhúng trực tiếp vì lý do bảo mật và bản quyền/)
    ).toBeTruthy()
    expect(screen.queryByTestId('anime-youtube-player')).toBeNull()
    expect(screen.queryByTestId('anime-native-video')).toBeNull()
    // Ensure raw media URL is NOT leaked in the DOM
    expect(screen.queryByText('https://unsafe-external.com/watch')).toBeNull()

    // 2b: unavailable
    vi.mocked(animePlaybackApi.fetchEpisodeDetail).mockResolvedValueOnce(sampleUnavailableEpisode)
    rerender(
      <MemoryRouter>
        <AnimeLearningSession episodeId={sampleUnavailableEpisode.episode_id} onBackToEpisodes={onBack} />
      </MemoryRouter>
    )

    expect(await screen.findByText('Nguồn phát chưa khả dụng')).toBeTruthy()
    expect(screen.queryByTestId('anime-youtube-player')).toBeNull()
    expect(screen.queryByTestId('anime-native-video')).toBeNull()

    // 2c: 403 Forbidden
    vi.mocked(animePlaybackApi.fetchEpisodeDetail).mockRejectedValueOnce({
      status: 403,
      code: 'ANIME_CONTENT_RESTRICTED',
      message: 'Bị hạn chế quyền',
    })
    rerender(
      <MemoryRouter>
        <AnimeLearningSession episodeId="forbidden-ep" onBackToEpisodes={onBack} />
      </MemoryRouter>
    )

    expect(await screen.findByText('Nội dung bị hạn chế')).toBeTruthy()
    expect(screen.getByText(/Tập phim này đang bị hạn chế truy cập theo chính sách bản quyền/)).toBeTruthy()
    expect(screen.queryByTestId('anime-youtube-player')).toBeNull()
    expect(screen.queryByTestId('anime-native-video')).toBeNull()
  })

  // -----------------------------------------------------------------
  // Test 3: Episode URL State & Back Navigation
  // -----------------------------------------------------------------
  it('3. loads episode detail once, and back button calls onBackToEpisodes', async () => {
    vi.mocked(animePlaybackApi.fetchEpisodeDetail).mockResolvedValueOnce(sampleYoutubeEpisode)
    vi.mocked(animePlaybackApi.fetchEpisodeSubtitles).mockResolvedValueOnce(sampleSubtitlesWindow1)

    const onBack = vi.fn()
    render(
      <MemoryRouter>
        <AnimeLearningSession episodeId={sampleYoutubeEpisode.episode_id} onBackToEpisodes={onBack} />
      </MemoryRouter>
    )

    expect(await screen.findByRole('heading', { name: 'Tập 1: Tái sinh' })).toBeTruthy()
    expect(animePlaybackApi.fetchEpisodeDetail).toHaveBeenCalledTimes(1)
    expect(animePlaybackApi.fetchEpisodeDetail).toHaveBeenCalledWith(
      sampleYoutubeEpisode.episode_id,
      expect.any(Object)
    )

    // Click back button
    const backBtn = screen.getByRole('button', { name: 'Quay lại danh sách tập' })
    fireEvent.click(backBtn)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  // -----------------------------------------------------------------
  // Test 4: Windowed Subtitle Fetching [0, 120] and Prefetching
  // -----------------------------------------------------------------
  it('4. fetches initial subtitle window [0, 120] with lang=all, and prefetches next window near boundary', async () => {
    vi.mocked(animePlaybackApi.fetchEpisodeDetail).mockResolvedValueOnce(sampleYoutubeEpisode)
    vi.mocked(animePlaybackApi.fetchEpisodeSubtitles).mockResolvedValueOnce(sampleSubtitlesWindow1)

    render(
      <MemoryRouter>
        <AnimeLearningSession episodeId={sampleYoutubeEpisode.episode_id} onBackToEpisodes={vi.fn()} />
      </MemoryRouter>
    )

    // Initial subtitle fetch verification
    await waitFor(() => {
      expect(animePlaybackApi.fetchEpisodeSubtitles).toHaveBeenCalledWith(
        sampleYoutubeEpisode.episode_id,
        expect.objectContaining({
          from: 0,
          to: 120,
          lang: 'all',
        })
      )
    })

    // Verify cues are rendered in transcript
    expect(await screen.findByText('おはよう世界')).toBeTruthy()
    expect(screen.getByText('Chào buổi sáng thế giới')).toBeTruthy()
    expect(screen.getByText('近いぞ')).toBeTruthy()

    // Simulate playback advancing to 100s (near boundary to = 120 - 25 = 95s)
    vi.mocked(animePlaybackApi.fetchEpisodeSubtitles).mockResolvedValueOnce(sampleSubtitlesWindow2)

    // Fire time update on native or custom seekbar
    const seekbar = screen.getByLabelText('Thanh tua video')
    fireEvent.change(seekbar, { target: { value: '100' } })

    // Prefetch for [120, 240] should be triggered
    await waitFor(() => {
      expect(animePlaybackApi.fetchEpisodeSubtitles).toHaveBeenCalledWith(
        sampleYoutubeEpisode.episode_id,
        expect.objectContaining({
          from: 120,
          to: 240,
          lang: 'all',
        })
      )
    })

    // Verify prefetched cue appears
    expect(await screen.findByText('次の手がかり')).toBeTruthy()
  })

  // -----------------------------------------------------------------
  // Test 5: Subtitle Layer Toggles (Japanese, Vietnamese, Furigana disabled)
  // -----------------------------------------------------------------
  it('5. toggles Japanese and Vietnamese layers, and disables Furigana when unavailable', async () => {
    vi.mocked(animePlaybackApi.fetchEpisodeDetail).mockResolvedValueOnce(sampleYoutubeEpisode)
    vi.mocked(animePlaybackApi.fetchEpisodeSubtitles).mockResolvedValueOnce(sampleSubtitlesWindow1)

    render(
      <MemoryRouter>
        <AnimeLearningSession episodeId={sampleYoutubeEpisode.episode_id} onBackToEpisodes={vi.fn()} />
      </MemoryRouter>
    )

    await screen.findByText('おはよう世界')

    const jaBtn = screen.getByRole('button', { name: 'Nhật' })
    const viBtn = screen.getByRole('button', { name: 'Việt' })
    const furiganaBtn = screen.getByLabelText('Furigana (Chưa có dữ liệu)')

    // Furigana must be disabled
    expect(furiganaBtn.hasAttribute('disabled')).toBe(true)
    expect(furiganaBtn.getAttribute('title')).toContain('Furigana chưa được cung cấp')

    // Toggle Japanese OFF
    fireEvent.click(jaBtn)
    expect(screen.queryByText('おはよう世界')).toBeNull()
    expect(screen.getByText('Chào buổi sáng thế giới')).toBeTruthy()

    // Toggle Japanese ON again
    fireEvent.click(jaBtn)
    expect(screen.getByText('おはよう世界')).toBeTruthy()

    // Toggle Vietnamese OFF
    fireEvent.click(viBtn)
    expect(screen.queryByText('Chào buổi sáng thế giới')).toBeNull()
    expect(screen.getByText('おはよう世界')).toBeTruthy()
  })

  // -----------------------------------------------------------------
  // Test 6: Transcript Cue Click & Keyboard Seek
  // -----------------------------------------------------------------
  it('6. clicking transcript cue seeks player to cue.start and updates active cue', async () => {
    vi.mocked(animePlaybackApi.fetchEpisodeDetail).mockResolvedValueOnce(sampleLocalEpisode)
    vi.mocked(animePlaybackApi.fetchEpisodeSubtitles).mockResolvedValueOnce(sampleSubtitlesWindow1)

    render(
      <MemoryRouter>
        <AnimeLearningSession episodeId={sampleLocalEpisode.episode_id} onBackToEpisodes={vi.fn()} />
      </MemoryRouter>
    )

    await screen.findByText('おはよう世界')

    const cue1Btn = screen.getByLabelText(/Tua tới 00:10: おはよう世界/)
    expect(cue1Btn).toBeTruthy()

    // Click cue 1 button
    fireEvent.click(cue1Btn)

    // Time display and transcript badge should both show 00:10
    expect(screen.getAllByText('00:10').length).toBeGreaterThanOrEqual(2)

    // Video currentTime should be set to 10
    const video = screen.getByTestId('anime-native-video') as HTMLVideoElement
    expect(video.currentTime).toBe(10)
  })

  // -----------------------------------------------------------------
  // Test 7: Personal Offset Controls
  // -----------------------------------------------------------------
  it('7. adjusts personal subtitle offset slider and resets to 0.0s', async () => {
    vi.mocked(animePlaybackApi.fetchEpisodeDetail).mockResolvedValueOnce(sampleYoutubeEpisode)
    vi.mocked(animePlaybackApi.fetchEpisodeSubtitles).mockResolvedValueOnce(sampleSubtitlesWindow1)

    render(
      <MemoryRouter>
        <AnimeLearningSession episodeId={sampleYoutubeEpisode.episode_id} onBackToEpisodes={vi.fn()} />
      </MemoryRouter>
    )

    await screen.findByText('おはよう世界')

    expect(screen.getByText('Lệch: 0.0s')).toBeTruthy()

    const offsetSlider = screen.getByLabelText(/Chỉnh độ lệch phụ đề/)
    fireEvent.change(offsetSlider, { target: { value: '1.5' } })

    expect(screen.getByText('Lệch: +1.5s')).toBeTruthy()

    // Reset button should appear
    const resetBtn = screen.getByLabelText('Đặt lại độ lệch về 0')
    fireEvent.click(resetBtn)

    expect(screen.getByText('Lệch: 0.0s')).toBeTruthy()
  })

  // -----------------------------------------------------------------
  // Test 8: Empty Subtitles State and Cleanup on Unmount
  // -----------------------------------------------------------------
  it('8. shows transparent empty notice when episode has no subtitles, and cleans up on unmount', async () => {
    const rawEpisode: AnimeEpisodeDetail = {
      ...sampleYoutubeEpisode,
      has_subtitles: false,
      subtitle_track: null,
    }

    vi.mocked(animePlaybackApi.fetchEpisodeDetail).mockResolvedValueOnce(rawEpisode)

    const { unmount } = render(
      <MemoryRouter>
        <AnimeLearningSession episodeId={rawEpisode.episode_id} onBackToEpisodes={vi.fn()} />
      </MemoryRouter>
    )

    expect(await screen.findByText('Chưa có phụ đề')).toBeTruthy()
    expect(screen.getByText('Tập này chưa có phụ đề tương tác')).toBeTruthy()
    expect(
      screen.getByText(/Bạn vẫn có thể phát video bài học bình thường nếu nguồn phát hợp lệ/)
    ).toBeTruthy()

    // Verify fetchEpisodeSubtitles is never called when has_subtitles is false
    expect(animePlaybackApi.fetchEpisodeSubtitles).not.toHaveBeenCalled()

    // Unmount safely without error
    unmount()
  })

  // -----------------------------------------------------------------
  // Test 9: Player Error Fail-Closed (Unmounts video/iframe & shows fallback card)
  // -----------------------------------------------------------------
  it('9. unmounts native video immediately on error, clearing player and media URL from DOM', () => {
    const onBack = vi.fn()
    const onError = vi.fn()

    render(
      <AnimePlayer
        mediaSource={sampleLocalEpisode.media_source}
        title="Death Note - Tập 2"
        onTimeUpdate={vi.fn()}
        onDurationChange={vi.fn()}
        onPlaybackStateChange={vi.fn()}
        onError={onError}
        onBackToEpisodes={onBack}
      />
    )

    const video = screen.getByTestId('anime-native-video') as HTMLVideoElement
    expect(video).toBeTruthy()
    expect(video.getAttribute('src')).toBe('/media/anime/death-note/ep2.mp4')

    // Trigger player error on native video element
    fireEvent.error(video)

    expect(onError).toHaveBeenCalledWith('Không thể tải hoặc phát tệp media cục bộ.')

    // Verify video element is unmounted and no longer in DOM
    expect(screen.queryByTestId('anime-native-video')).toBeNull()
    expect(screen.queryByTestId('anime-youtube-player')).toBeNull()

    // Verify safe fallback error card is displayed
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('Lỗi phát video')).toBeTruthy()
    expect(screen.getByText('Không thể tải hoặc phát tệp media cục bộ.')).toBeTruthy()

    // Ensure raw media URL is completely purged from DOM
    expect(document.querySelector('video')).toBeNull()
    expect(document.body.innerHTML).not.toContain('/media/anime/death-note/ep2.mp4')

    // Click return button
    const backBtn = screen.getByRole('button', { name: 'Quay lại danh sách tập' })
    fireEvent.click(backBtn)
    expect(onBack).toHaveBeenCalled()
  })

  // -----------------------------------------------------------------
  // Test 10: Scoped Keyboard Shortcuts
  // -----------------------------------------------------------------
  it('10. limits keyboard shortcuts to player container; outside focus or input focus does not trigger shortcuts', () => {
    const onSeek = vi.fn()
    const onPlaybackChange = vi.fn()
    const playMock = vi.fn().mockImplementation(() => Promise.resolve())
    const pauseMock = vi.fn()

    // Mock HTMLMediaElement methods
    window.HTMLMediaElement.prototype.play = playMock
    window.HTMLMediaElement.prototype.pause = pauseMock

    render(
      <div>
        <button data-testid="outside-button">Nút ngoài player</button>
        <AnimePlayer
          mediaSource={sampleLocalEpisode.media_source}
          title="Death Note - Tập 2"
          onTimeUpdate={vi.fn()}
          onDurationChange={vi.fn()}
          onSeeked={onSeek}
          onPlaybackStateChange={onPlaybackChange}
          onError={vi.fn()}
        />
      </div>
    )

    // 10a: Focus outside player (e.g. outside button)
    const outsideBtn = screen.getByTestId('outside-button')
    outsideBtn.focus()
    expect(document.activeElement).toBe(outsideBtn)

    fireEvent.keyDown(outsideBtn, { code: 'Space', key: ' ' })
    fireEvent.keyDown(outsideBtn, { key: 'ArrowRight' })
    fireEvent.keyDown(document.body, { code: 'Space', key: ' ' })

    expect(playMock).not.toHaveBeenCalled()
    expect(onSeek).not.toHaveBeenCalled()

    // 10b: Focus inside player container
    const playerContainer = screen.getByRole('region', { name: /Trình phát video/ })
    playerContainer.focus()
    expect(document.activeElement).toBe(playerContainer)

    fireEvent.keyDown(playerContainer, { key: 'ArrowRight' })
    expect(onSeek).toHaveBeenCalledWith(5)

    // 10c: Focus inside range slider / timeline input within player
    const seekbar = screen.getByLabelText('Thanh tua video')
    seekbar.focus()
    expect(document.activeElement).toBe(seekbar)

    playMock.mockClear()
    const spaceEvent = new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true })
    seekbar.dispatchEvent(spaceEvent)

    // Space key on slider should NOT be intercepted/hijacked by player shortcut handler
    expect(playMock).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------
  // Test 11: Picture-in-Picture Support
  // -----------------------------------------------------------------
  it('11. manages Picture-in-Picture for native video when supported, and disables for YouTube or unsupported browsers', async () => {
    // 11a: Capability unavailable when document.pictureInPictureEnabled is false
    Object.defineProperty(document, 'pictureInPictureEnabled', {
      value: false,
      configurable: true,
      writable: true,
    })

    const { rerender } = render(
      <AnimePlayer
        mediaSource={sampleLocalEpisode.media_source}
        onTimeUpdate={vi.fn()}
        onDurationChange={vi.fn()}
        onPlaybackStateChange={vi.fn()}
        onError={vi.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: /Picture-in-Picture/ })).toBeNull()

    // 11b: PiP control is never shown for YouTube even if browser supports PiP
    Object.defineProperty(document, 'pictureInPictureEnabled', {
      value: true,
      configurable: true,
      writable: true,
    })

    rerender(
      <AnimePlayer
        mediaSource={sampleYoutubeEpisode.media_source}
        onTimeUpdate={vi.fn()}
        onDurationChange={vi.fn()}
        onPlaybackStateChange={vi.fn()}
        onError={vi.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: /Picture-in-Picture/ })).toBeNull()

    // 11c: PiP control is available for authorized_local native video
    const requestPipMock = vi.fn().mockResolvedValue({})
    window.HTMLVideoElement.prototype.requestPictureInPicture = requestPipMock

    rerender(
      <AnimePlayer
        mediaSource={sampleLocalEpisode.media_source}
        onTimeUpdate={vi.fn()}
        onDurationChange={vi.fn()}
        onPlaybackStateChange={vi.fn()}
        onError={vi.fn()}
      />
    )

    const pipBtn = screen.getByRole('button', { name: 'Mở Picture-in-Picture' })
    expect(pipBtn).toBeTruthy()
    expect(pipBtn.getAttribute('aria-pressed')).toBe('false')

    // Click PiP button triggers requestPictureInPicture
    fireEvent.click(pipBtn)
    expect(requestPipMock).toHaveBeenCalled()

    // Simulate enterpictureinpicture event on video element
    const video = screen.getByTestId('anime-native-video')
    fireEvent(video, new Event('enterpictureinpicture'))

    expect(screen.getByRole('button', { name: 'Thoát Picture-in-Picture' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Thoát Picture-in-Picture' }).getAttribute('aria-pressed')).toBe('true')

    // Simulate leavepictureinpicture event
    fireEvent(video, new Event('leavepictureinpicture'))
    expect(screen.getByRole('button', { name: 'Mở Picture-in-Picture' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mở Picture-in-Picture' }).getAttribute('aria-pressed')).toBe('false')
  })
})
