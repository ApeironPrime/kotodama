// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnimeDictionaryLRUCache, animeDictionaryCache } from './animeDictionaryCache'
import { AnimeWordPopover } from './AnimeWordPopover'
import { AnimeSrsActions } from './AnimeSrsActions'
import { AnimeResumePrompt } from './AnimeResumePrompt'
import { AnimeContinueWatching } from './AnimeContinueWatching'
import { AnimeLearningSession } from './AnimeLearningSession'
import { animePlaybackApi } from './animePlaybackApi'
import { srsApi } from '../srs/srsApi'
import type {
  AnimeEpisodeDetail,
  AnimeSubtitleWindowData,
  AnimeSubtitleCue,
  AnimeSubtitleToken,
} from './animePlaybackTypes'

let mockUser: { id: string; email: string } | null = {
  id: 'user-t07-test',
  email: 'learner@kotodama.test',
}

vi.mock('../auth/authContext', () => ({
  useAuth: () => ({
    user: mockUser,
    status: mockUser ? 'authenticated' : 'anonymous',
    sessionExpired: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    acceptSession: vi.fn(),
    signOut: vi.fn(),
  }),
}))

vi.mock('./animePlaybackApi', () => ({
  animePlaybackApi: {
    fetchEpisodeDetail: vi.fn(),
    fetchEpisodeSubtitles: vi.fn(),
    fetchDictionaryWord: vi.fn(),
    searchDictionaryFallback: vi.fn(),
    fetchWatchProgress: vi.fn(),
    saveWatchProgress: vi.fn(),
    fetchContinueWatching: vi.fn(),
  },
}))

vi.mock('../srs/srsApi', () => ({
  srsApi: {
    addCard: vi.fn(),
    fetchDeck: vi.fn(),
    fetchStats: vi.fn(),
    submitReview: vi.fn(),
    fetchSavedTerms: vi.fn(),
  },
}))

describe('Task T07 - Tra từ phụ đề, SRS provenance, Watch Progress & Resume', () => {
  const sampleCue: AnimeSubtitleCue = {
    cue_id: 1,
    start: 10,
    end: 14,
    ja: 'おはよう世界',
    vi: 'Chào buổi sáng thế giới',
    tokens: [
      {
        token_ordinal: 0,
        surface: 'おはよう',
        char_start: 0,
        char_end: 4,
        word_id: 1001,
      },
      {
        token_ordinal: 1,
        surface: '世界',
        char_start: 4,
        char_end: 6,
        word_id: 1002,
      },
    ],
  }

  const sampleToken: AnimeSubtitleToken = sampleCue.tokens?.[0] ?? {
    token_ordinal: 0,
    surface: 'おはよう',
    char_start: 0,
    char_end: 4,
    word_id: 1001,
  }

  const sampleEpisodeDetail: AnimeEpisodeDetail = {
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
      source_type: 'authorized_local',
      media_id: null,
      page_url: '/media/anime/death-note/ep1.mp4',
      playback_allowed: true,
      rights_status: 'approved',
    },
    subtitle_track: {
      track_id: 'track-1',
      languages: ['ja', 'vi'],
      cue_count: 1,
      token_count: 2,
      word_linked_token_count: 2,
    },
  }

  const sampleSubtitles: AnimeSubtitleWindowData = {
    episode_id: 'anime:episode:death-note:death-note-s1:1',
    track_id: 'track-1',
    from: 0,
    to: 60,
    cues: [sampleCue],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    animeDictionaryCache.clear()
    mockUser = { id: 'user-t07-test', email: 'learner@kotodama.test' }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // =========================================================================
  // Requirement 1: LRU Cache bounds and wordId lookup
  // =========================================================================
  describe('1. In-memory LRU Cache (AnimeDictionaryLRUCache)', () => {
    it('calls fetchDictionaryWord once for wordId and hits LRU cache on subsequent call', async () => {
      const cache = new AnimeDictionaryLRUCache(50)
      vi.mocked(animePlaybackApi.fetchDictionaryWord).mockResolvedValueOnce({
        id: 1001,
        word: 'おはよう',
        reading: 'おはよう',
        pos_vi: ['thán từ'],
        jlpt: 'N5',
        hanviet: '',
        meanings: ['chào buổi sáng'],
        source: 'anime_dictionary',
      })

      const res1 = await cache.lookupToken({ word_id: 1001, surface: 'おはよう' })
      expect(res1.word).toBe('おはよう')
      expect(animePlaybackApi.fetchDictionaryWord).toHaveBeenCalledTimes(1)

      // Second call with same token
      const res2 = await cache.lookupToken({ word_id: 1001, surface: 'おはよう' })
      expect(res2.word).toBe('おはよう')
      expect(animePlaybackApi.fetchDictionaryWord).toHaveBeenCalledTimes(1) // Still 1!
    })

    it('evicts the oldest entry when exceeding maximum capacity of 50', () => {
      const cache = new AnimeDictionaryLRUCache(3) // small cache for deterministic testing
      cache.set('key1', { id: 1, word: 'w1', reading: null, pos_vi: [], jlpt: null, hanviet: '', meanings: [], source: 'anime_dictionary' })
      cache.set('key2', { id: 2, word: 'w2', reading: null, pos_vi: [], jlpt: null, hanviet: '', meanings: [], source: 'anime_dictionary' })
      cache.set('key3', { id: 3, word: 'w3', reading: null, pos_vi: [], jlpt: null, hanviet: '', meanings: [], source: 'anime_dictionary' })

      expect(cache.size).toBe(3)
      expect(cache.has('key1')).toBe(true)

      // Access key1 to make it MRU
      cache.get('key1')

      // Insert key4 -> key2 should be evicted (as key1 was refreshed)
      cache.set('key4', { id: 4, word: 'w4', reading: null, pos_vi: [], jlpt: null, hanviet: '', meanings: [], source: 'anime_dictionary' })
      expect(cache.size).toBe(3)
      expect(cache.has('key2')).toBe(false)
      expect(cache.has('key1')).toBe(true)
      expect(cache.has('key3')).toBe(true)
      expect(cache.has('key4')).toBe(true)
    })
  })

  // =========================================================================
  // Requirement 2: Fallback search behavior
  // =========================================================================
  describe('2. Dictionary Search Fallback and Error Containment', () => {
    it('falls back to dictionary search once (limit <= 5) when token has no word_id', async () => {
      const cache = new AnimeDictionaryLRUCache(50)
      vi.mocked(animePlaybackApi.searchDictionaryFallback).mockResolvedValueOnce({
        results: [
          {
            id: 999,
            word: '世界',
            reading: 'せかい',
            pos_vi: ['danh từ'],
            jlpt: 'N5',
            hanviet: 'THẾ GIỚI',
            meanings: ['thế giới'],
          },
        ],
        count: 1,
      })

      const res = await cache.lookupToken({ word_id: null, surface: '世界' })
      expect(animePlaybackApi.fetchDictionaryWord).not.toHaveBeenCalled()
      expect(animePlaybackApi.searchDictionaryFallback).toHaveBeenCalledWith('世界', 5, undefined)
      expect(res.word).toBe('世界')
      expect(res.isFallback).toBe(true)
    })

    it('falls back to dictionary search when fetchDictionaryWord returns 404 / WORD_NOT_FOUND', async () => {
      const cache = new AnimeDictionaryLRUCache(50)
      const notFoundErr = new Error('Word not found')
      ;(notFoundErr as unknown as { status: number; code: string }).status = 404
      ;(notFoundErr as unknown as { status: number; code: string }).code = 'WORD_NOT_FOUND'

      vi.mocked(animePlaybackApi.fetchDictionaryWord).mockRejectedValueOnce(notFoundErr)
      vi.mocked(animePlaybackApi.searchDictionaryFallback).mockResolvedValueOnce({
        results: [
          {
            id: 1001,
            word: 'おはよう',
            reading: 'おはよう',
            pos_vi: ['thán từ'],
            jlpt: 'N5',
            hanviet: '',
            meanings: ['chào buổi sáng'],
          },
        ],
        count: 1,
      })

      const res = await cache.lookupToken({ word_id: 1001, surface: 'おはよう' })
      expect(animePlaybackApi.fetchDictionaryWord).toHaveBeenCalledTimes(1)
      expect(animePlaybackApi.searchDictionaryFallback).toHaveBeenCalledTimes(1)
      expect(res.word).toBe('おはよう')
    })

    it('does NOT fallback on 403 / ANIME_CONTENT_RESTRICTED or network failures', async () => {
      const cache = new AnimeDictionaryLRUCache(50)
      const restrictedErr = new Error('Restricted')
      ;(restrictedErr as unknown as { status: number; code: string }).status = 403
      ;(restrictedErr as unknown as { status: number; code: string }).code = 'ANIME_CONTENT_RESTRICTED'

      vi.mocked(animePlaybackApi.fetchDictionaryWord).mockRejectedValueOnce(restrictedErr)

      await expect(cache.lookupToken({ word_id: 1001, surface: 'おはよう' })).rejects.toThrow('Restricted')
      expect(animePlaybackApi.searchDictionaryFallback).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // Requirement 3: Word Popover & Focus Management
  // =========================================================================
  describe('3. Word Popover and Focus Management (AnimeWordPopover)', () => {
    it('renders loading state then details; closes and restores focus on Escape', async () => {
      const triggerBtn = document.createElement('button')
      triggerBtn.textContent = 'おはよう'
      document.body.appendChild(triggerBtn)
      triggerBtn.focus()

      const onClose = vi.fn()

      vi.mocked(animePlaybackApi.fetchDictionaryWord).mockResolvedValueOnce({
        id: 1001,
        word: 'おはよう',
        reading: 'おはよう',
        pos_vi: ['thán từ'],
        jlpt: 'N5',
        hanviet: '',
        meanings: ['chào buổi sáng'],
        source: 'anime_dictionary',
      })

      render(
        <MemoryRouter>
          <AnimeWordPopover
            episodeId={sampleEpisodeDetail.episode_id}
            cue={sampleCue}
            token={sampleToken}
            triggerElement={triggerBtn}
            onClose={onClose}
          />
        </MemoryRouter>
      )

      // Should show definition details
      await screen.findByText('chào buổi sáng')
      expect(screen.getByText('thán từ')).toBeTruthy()
      expect(screen.getByText('N5')).toBeTruthy()

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalled()

      document.body.removeChild(triggerBtn)
    })

    it('shows error state with retry button when lookup fails', async () => {
      const triggerBtn = document.createElement('button')
      document.body.appendChild(triggerBtn)

      const onClose = vi.fn()
      vi.mocked(animePlaybackApi.fetchDictionaryWord).mockRejectedValueOnce(new Error('Network failure'))

      render(
        <MemoryRouter>
          <AnimeWordPopover
            episodeId={sampleEpisodeDetail.episode_id}
            cue={sampleCue}
            token={sampleToken}
            triggerElement={triggerBtn}
            onClose={onClose}
          />
        </MemoryRouter>
      )

      await screen.findByText('Network failure')
      const retryBtn = screen.getByRole('button', { name: /Thử lại/ })
      expect(retryBtn).toBeTruthy()

      document.body.removeChild(triggerBtn)
    })
  })

  // =========================================================================
  // Requirement 4: Guest CTA vs User SRS Provenance Actions
  // =========================================================================
  describe('4. SRS Integration and Provenance (AnimeSrsActions)', () => {
    it('renders guest CTA link to /dang-nhap and does NOT call srsApi.addCard when anonymous', () => {
      mockUser = null // Guest

      render(
        <MemoryRouter>
          <AnimeSrsActions
            episodeId={sampleEpisodeDetail.episode_id}
            cue={sampleCue}
            token={sampleToken}
            mode="token"
          />
        </MemoryRouter>
      )

      const guestLink = screen.getByRole('link', { name: /Đăng nhập để lưu từ vào SRS/ })
      expect(guestLink).toBeTruthy()
      expect(guestLink.getAttribute('href')).toBe('/dang-nhap')
      expect(srsApi.addCard).not.toHaveBeenCalled()
    })

    it('saves word with deterministic provenance and prevents double clicks for authenticated user', async () => {
      mockUser = { id: 'user-1', email: 'user1@test.com' }
      vi.mocked(srsApi.addCard).mockResolvedValueOnce({
        id: 'card-1',
        type: 'vocab',
        term: 'おはよう',
        reading: 'おはよう',
        meaning: 'chào buổi sáng',
        masteryPercentage: 0,
        stage: 'new',
        repetition: 0,
        intervalDays: 0,
        easeFactor: 2.5,
        nextReviewDate: '2026-01-01T00:00:00Z',
        sourceContext: 'anime:v1:episode:anime:episode:death-note:death-note-s1:1:cue:1:token:1001',
        created: true,
        alreadySaved: false,
      })

      render(
        <MemoryRouter>
          <AnimeSrsActions
            episodeId={sampleEpisodeDetail.episode_id}
            cue={sampleCue}
            token={sampleToken}
            mode="token"
          />
        </MemoryRouter>
      )

      const saveBtn = screen.getByRole('button', { name: /Lưu từ vào SRS/ })
      expect(saveBtn).toBeTruthy()

      fireEvent.click(saveBtn)

      expect(srsApi.addCard).toHaveBeenCalledWith(
        expect.objectContaining({
          term: 'おはよう',
          type: 'vocab',
          sourceContext: 'anime:v1:episode:anime:episode:death-note:death-note-s1:1:cue:1:token:1001',
        })
      )

      await screen.findByText('Đã lưu trong SRS')
    })

    it('saves whole sentence with deterministic sentence provenance', async () => {
      mockUser = { id: 'user-1', email: 'user1@test.com' }
      vi.mocked(srsApi.addCard).mockResolvedValueOnce({
        id: 'card-2',
        type: 'vocab',
        term: 'おはよう世界',
        meaning: 'Chào buổi sáng thế giới',
        masteryPercentage: 0,
        stage: 'new',
        repetition: 0,
        intervalDays: 0,
        easeFactor: 2.5,
        nextReviewDate: '2026-01-01T00:00:00Z',
        sourceContext: 'anime:v1:episode:anime:episode:death-note:death-note-s1:1:cue:1:sentence',
        created: true,
        alreadySaved: false,
      })

      render(
        <MemoryRouter>
          <AnimeSrsActions
            episodeId={sampleEpisodeDetail.episode_id}
            cue={sampleCue}
            mode="sentence"
          />
        </MemoryRouter>
      )

      const saveBtn = screen.getByRole('button', { name: /Lưu câu vào SRS/ })
      fireEvent.click(saveBtn)

      expect(srsApi.addCard).toHaveBeenCalledWith(
        expect.objectContaining({
          term: 'おはよう世界',
          meaning: 'Chào buổi sáng thế giới',
          type: 'vocab',
          sourceContext: 'anime:v1:episode:anime:episode:death-note:death-note-s1:1:cue:1:sentence',
        })
      )

      await screen.findByText('Đã lưu trong SRS')
    })

    it('displays already saved state when SRS response indicates alreadySaved or created false', async () => {
      mockUser = { id: 'user-1', email: 'user1@test.com' }
      vi.mocked(srsApi.addCard).mockResolvedValueOnce({
        id: 'card-existing',
        type: 'vocab',
        term: 'おはよう',
        reading: 'おはよう',
        meaning: 'chào buổi sáng',
        masteryPercentage: 20,
        stage: 'learning',
        repetition: 1,
        intervalDays: 1,
        easeFactor: 2.5,
        nextReviewDate: '2026-01-02T00:00:00Z',
        sourceContext: 'anime:v1:episode:anime:episode:death-note:death-note-s1:1:cue:1:token:1001',
        created: false,
        alreadySaved: true,
      })

      render(
        <MemoryRouter>
          <AnimeSrsActions
            episodeId={sampleEpisodeDetail.episode_id}
            cue={sampleCue}
            token={sampleToken}
            mode="token"
          />
        </MemoryRouter>
      )

      const saveBtn = screen.getByRole('button', { name: /Lưu từ vào SRS/ })
      fireEvent.click(saveBtn)

      await screen.findByText(/Đã có trong SRS/)
      expect(screen.getByRole('button', { name: 'Đã lưu trong SRS' })).toBeTruthy()
    })
  })

  // =========================================================================
  // Requirement 5: Resume Prompt
  // =========================================================================
  describe('5. Resume Prompt Behavior (AnimeResumePrompt)', () => {
    it('renders prompt when position > 5s and not completed; handles continue and start-over', () => {
      const onContinue = vi.fn()
      const onStartOver = vi.fn()
      const onDismiss = vi.fn()

      render(
        <AnimeResumePrompt
          position={75}
          onContinue={onContinue}
          onStartOver={onStartOver}
          onDismiss={onDismiss}
        />
      )

      expect(screen.getByRole('alertdialog', { name: 'Tiếp tục từ 01:15?' })).toBeTruthy()

      // Click "Tiếp tục"
      const continueBtn = screen.getByRole('button', { name: /Tiếp tục/ })
      fireEvent.click(continueBtn)
      expect(onContinue).toHaveBeenCalled()

      // Click "Xem từ đầu"
      const startOverBtn = screen.getByRole('button', { name: /Xem lại từ đầu/ })
      fireEvent.click(startOverBtn)
      expect(onStartOver).toHaveBeenCalled()
    })

    it('fetches watch progress once in session and shows prompt if position > 5s', async () => {
      mockUser = { id: 'user-1', email: 'user1@test.com' }
      vi.mocked(animePlaybackApi.fetchEpisodeDetail).mockResolvedValueOnce(sampleEpisodeDetail)
      vi.mocked(animePlaybackApi.fetchEpisodeSubtitles).mockResolvedValueOnce(sampleSubtitles)
      vi.mocked(animePlaybackApi.fetchWatchProgress).mockResolvedValueOnce({
        episode_id: sampleEpisodeDetail.episode_id,
        last_playback_position: 45,
        max_playback_position: 45,
        duration: 1200,
        is_completed: false,
        playback_count: 1,
        last_watched_at: '2026-01-01T00:00:00Z',
      })

      render(
        <MemoryRouter>
          <AnimeLearningSession episodeId={sampleEpisodeDetail.episode_id} onBackToEpisodes={vi.fn()} />
        </MemoryRouter>
      )

      await screen.findByRole('alertdialog', { name: 'Tiếp tục từ 00:45?' })
      expect(animePlaybackApi.fetchWatchProgress).toHaveBeenCalledTimes(1)
    })

    it('does NOT show resume prompt when progress position <= 5s or is_completed is true', async () => {
      mockUser = { id: 'user-1', email: 'user1@test.com' }
      vi.mocked(animePlaybackApi.fetchEpisodeDetail).mockResolvedValueOnce(sampleEpisodeDetail)
      vi.mocked(animePlaybackApi.fetchEpisodeSubtitles).mockResolvedValueOnce(sampleSubtitles)
      vi.mocked(animePlaybackApi.fetchWatchProgress).mockResolvedValueOnce({
        episode_id: sampleEpisodeDetail.episode_id,
        last_playback_position: 3, // <= 5s
        max_playback_position: 3,
        duration: 1200,
        is_completed: false,
        playback_count: 1,
        last_watched_at: '2026-01-01T00:00:00Z',
      })

      render(
        <MemoryRouter>
          <AnimeLearningSession episodeId={sampleEpisodeDetail.episode_id} onBackToEpisodes={vi.fn()} />
        </MemoryRouter>
      )

      await screen.findByText('Cuốn Sổ Tử Thần')
      expect(screen.queryByText(/Tiếp tục từ/)).toBeNull()
    })
  })

  // =========================================================================
  // Requirement 6: Progress Debouncing & Flush
  // =========================================================================
  describe('6. Watch Progress Debouncing & Flush Triggers', () => {
    it('debounces position updates during playback and flushes on pause or pagehide', async () => {
      mockUser = { id: 'user-1', email: 'user1@test.com' }
      vi.mocked(animePlaybackApi.fetchEpisodeDetail).mockResolvedValueOnce(sampleEpisodeDetail)
      vi.mocked(animePlaybackApi.fetchEpisodeSubtitles).mockResolvedValueOnce(sampleSubtitles)
      vi.mocked(animePlaybackApi.fetchWatchProgress).mockResolvedValueOnce(null)
      vi.mocked(animePlaybackApi.saveWatchProgress).mockResolvedValue({
        episode_id: sampleEpisodeDetail.episode_id,
        last_playback_position: 10,
        max_playback_position: 10,
        duration: 1200,
        is_completed: false,
        playback_count: 1,
        last_watched_at: '2026-01-01T00:00:00Z',
      })

      const { unmount } = render(
        <MemoryRouter>
          <AnimeLearningSession episodeId={sampleEpisodeDetail.episode_id} onBackToEpisodes={vi.fn()} />
        </MemoryRouter>
      )

      await screen.findByText('Cuốn Sổ Tử Thần')

      const video = screen.getByTestId('anime-native-video') as HTMLVideoElement

      // Simulate play
      fireEvent.play(video)

      // Small time update (less than 5s) -> should NOT call saveWatchProgress
      fireEvent.timeUpdate(video, { target: { currentTime: 2 } })
      expect(animePlaybackApi.saveWatchProgress).not.toHaveBeenCalled()

      // Pause triggers flush
      fireEvent.pause(video)
      expect(animePlaybackApi.saveWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          episodeId: sampleEpisodeDetail.episode_id,
          position: 2,
        })
      )

      // Let previous flush resolve microtasks
      await Promise.resolve()

      // Unmount also flushes if dirty
      fireEvent.play(video)
      fireEvent.timeUpdate(video, { target: { currentTime: 15 } })
      unmount()
      expect(animePlaybackApi.saveWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          episodeId: sampleEpisodeDetail.episode_id,
          position: 15,
        })
      )
    })

    it('does not dirty or save watch progress when seeking while paused', async () => {
      mockUser = { id: 'user-1', email: 'user1@test.com' }
      vi.mocked(animePlaybackApi.fetchEpisodeDetail).mockResolvedValueOnce(sampleEpisodeDetail)
      vi.mocked(animePlaybackApi.fetchEpisodeSubtitles).mockResolvedValueOnce(sampleSubtitles)
      vi.mocked(animePlaybackApi.fetchWatchProgress).mockResolvedValueOnce(null)

      const { unmount } = render(
        <MemoryRouter>
          <AnimeLearningSession episodeId={sampleEpisodeDetail.episode_id} onBackToEpisodes={vi.fn()} />
        </MemoryRouter>
      )

      await screen.findByText('Cuốn Sổ Tử Thần')
      const video = screen.getByTestId('anime-native-video') as HTMLVideoElement

      // Seek while paused (no play event fired)
      fireEvent.timeUpdate(video, { target: { currentTime: 60 } })
      expect(animePlaybackApi.saveWatchProgress).not.toHaveBeenCalled()

      // Pause when never played
      fireEvent.pause(video)
      expect(animePlaybackApi.saveWatchProgress).not.toHaveBeenCalled()

      // Unmount when never played
      unmount()
      expect(animePlaybackApi.saveWatchProgress).not.toHaveBeenCalled()
    })

    it('flushes dirty progress on pagehide independently of document.visibilityState', async () => {
      mockUser = { id: 'user-1', email: 'user1@test.com' }
      vi.mocked(animePlaybackApi.fetchEpisodeDetail).mockResolvedValueOnce(sampleEpisodeDetail)
      vi.mocked(animePlaybackApi.fetchEpisodeSubtitles).mockResolvedValueOnce(sampleSubtitles)
      vi.mocked(animePlaybackApi.fetchWatchProgress).mockResolvedValueOnce(null)
      vi.mocked(animePlaybackApi.saveWatchProgress).mockResolvedValue({
        episode_id: sampleEpisodeDetail.episode_id,
        last_playback_position: 10,
        max_playback_position: 10,
        duration: 1200,
        is_completed: false,
        playback_count: 1,
        last_watched_at: '2026-01-01T00:00:00Z',
      })

      render(
        <MemoryRouter>
          <AnimeLearningSession episodeId={sampleEpisodeDetail.episode_id} onBackToEpisodes={vi.fn()} />
        </MemoryRouter>
      )

      await screen.findByText('Cuốn Sổ Tử Thần')
      const video = screen.getByTestId('anime-native-video') as HTMLVideoElement

      // Start playback and advance time
      fireEvent.play(video)
      fireEvent.timeUpdate(video, { target: { currentTime: 4 } })

      // document.visibilityState is 'visible' by default in jsdom
      expect(document.visibilityState).toBe('visible')

      // pagehide should flush dirty progress even if visibilityState is visible
      window.dispatchEvent(new Event('pagehide'))
      expect(animePlaybackApi.saveWatchProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          episodeId: sampleEpisodeDetail.episode_id,
          position: 4,
        })
      )
    })

    it('retains dirty state on save failure and retries on next flush up to 3 times', async () => {
      mockUser = { id: 'user-1', email: 'user1@test.com' }
      vi.mocked(animePlaybackApi.fetchEpisodeDetail).mockResolvedValueOnce(sampleEpisodeDetail)
      vi.mocked(animePlaybackApi.fetchEpisodeSubtitles).mockResolvedValueOnce(sampleSubtitles)
      vi.mocked(animePlaybackApi.fetchWatchProgress).mockResolvedValueOnce(null)

      // First attempt fails with network error
      vi.mocked(animePlaybackApi.saveWatchProgress).mockRejectedValueOnce(new Error('Network error'))
      // Second attempt succeeds
      vi.mocked(animePlaybackApi.saveWatchProgress).mockResolvedValueOnce({
        episode_id: sampleEpisodeDetail.episode_id,
        last_playback_position: 12,
        max_playback_position: 12,
        duration: 1200,
        is_completed: false,
        playback_count: 1,
        last_watched_at: '2026-01-01T00:00:00Z',
      })

      render(
        <MemoryRouter>
          <AnimeLearningSession episodeId={sampleEpisodeDetail.episode_id} onBackToEpisodes={vi.fn()} />
        </MemoryRouter>
      )

      await screen.findByText('Cuốn Sổ Tử Thần')
      const video = screen.getByTestId('anime-native-video') as HTMLVideoElement

      fireEvent.play(video)

      // Advance by >= 5s -> triggers flush, which will fail
      fireEvent.timeUpdate(video, { target: { currentTime: 6 } })
      expect(animePlaybackApi.saveWatchProgress).toHaveBeenCalledTimes(1)

      // Let rejection handle and clear flushing flag
      await Promise.resolve()

      // Next advance by >= 5s -> retries because isDirty was preserved on failure
      fireEvent.timeUpdate(video, { target: { currentTime: 12 } })
      expect(animePlaybackApi.saveWatchProgress).toHaveBeenCalledTimes(2)
    })
  })

  // =========================================================================
  // Requirement 7: Continue Watching Section
  // =========================================================================
  describe('7. Continue Watching Section (AnimeContinueWatching)', () => {
    it('renders nothing when user is anonymous', () => {
      mockUser = null

      const { container } = render(
        <MemoryRouter>
          <AnimeContinueWatching onSelectEpisode={vi.fn()} />
        </MemoryRouter>
      )

      expect(container.firstChild).toBeNull()
      expect(animePlaybackApi.fetchContinueWatching).not.toHaveBeenCalled()
    })

    it('renders continue watching items for authenticated user with selection callback', async () => {
      mockUser = { id: 'user-1', email: 'user1@test.com' }
      const onSelectEpisode = vi.fn()
      vi.mocked(animePlaybackApi.fetchContinueWatching).mockResolvedValueOnce({
        count: 1,
        items: [
          {
            episode_id: 'anime:episode:death-note:death-note-s1:1',
            series_id: 'series-1',
            series_slug: 'death-note',
            series_title_vi: 'Cuốn Sổ Tử Thần',
            season_slug: 'death-note-s1',
            season_label: 'Mùa 1',
            episode_number: 1,
            episode_title: 'Tái sinh',
            last_playback_position: 120,
            max_playback_position: 120,
            duration: 1200,
            is_completed: false,
            last_watched_at: '2026-01-01T00:00:00Z',
          },
        ],
      })

      render(
        <MemoryRouter>
          <AnimeContinueWatching onSelectEpisode={onSelectEpisode} />
        </MemoryRouter>
      )

      await screen.findByText('Xem tiếp')
      expect(screen.getByText('Cuốn Sổ Tử Thần')).toBeTruthy()
      expect(screen.getByText('Tập 1: Tái sinh')).toBeTruthy()
      expect(screen.getByText('02:00')).toBeTruthy()

      const itemBtn = screen.getByRole('button', { name: /Tiếp tục xem Cuốn Sổ Tử Thần/ })
      fireEvent.click(itemBtn)
      expect(onSelectEpisode).toHaveBeenCalledWith('death-note', 'anime:episode:death-note:death-note-s1:1')
    })

    it('renders error state and retry button on fetch failure', async () => {
      mockUser = { id: 'user-1', email: 'user1@test.com' }
      vi.mocked(animePlaybackApi.fetchContinueWatching).mockRejectedValueOnce(new Error('Fetch failed'))

      render(
        <MemoryRouter>
          <AnimeContinueWatching onSelectEpisode={vi.fn()} />
        </MemoryRouter>
      )

      await screen.findByText('Không thể tải danh sách xem tiếp.')
      expect(screen.getByRole('button', { name: /Thử lại/ })).toBeTruthy()
    })
  })

  // =========================================================================
  // Requirement 8: Keyboard guard on interactive subtitle tokens
  // =========================================================================
  describe('8. Accessibility: Keyboard guard on interactive token controls', () => {
    it('pressing Space or Enter on subtitle token button opens popover and does NOT trigger player play/pause', async () => {
      mockUser = { id: 'user-1', email: 'user1@test.com' }
      vi.mocked(animePlaybackApi.fetchEpisodeDetail).mockResolvedValueOnce(sampleEpisodeDetail)
      vi.mocked(animePlaybackApi.fetchEpisodeSubtitles).mockResolvedValueOnce(sampleSubtitles)
      vi.mocked(animePlaybackApi.fetchWatchProgress).mockResolvedValueOnce(null)
      vi.mocked(animePlaybackApi.fetchDictionaryWord).mockResolvedValueOnce({
        id: 1001,
        word: 'おはよう',
        reading: 'おはよう',
        pos_vi: ['thán từ'],
        jlpt: 'N5',
        hanviet: '',
        meanings: ['chào buổi sáng'],
        source: 'anime_dictionary',
      })

      render(
        <MemoryRouter>
          <AnimeLearningSession episodeId={sampleEpisodeDetail.episode_id} onBackToEpisodes={vi.fn()} />
        </MemoryRouter>
      )

      await screen.findByText('Cuốn Sổ Tử Thần')
      const video = screen.getByTestId('anime-native-video') as HTMLVideoElement

      // Advance time to 11s so subtitle cue 1 (10-14s) is active and tokens are rendered
      fireEvent.timeUpdate(video, { target: { currentTime: 11 } })

      const tokenBtns = await screen.findAllByRole('button', { name: /おはよう/ })
      expect(tokenBtns.length).toBeGreaterThanOrEqual(1)
      const tokenBtn = tokenBtns[0]
      if (!tokenBtn) {
        throw new Error('Token button not found')
      }

      const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
      const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})

      tokenBtn.focus()

      // Press Space on token button
      fireEvent.keyDown(tokenBtn, { key: ' ', code: 'Space' })
      // Press Enter on token button
      fireEvent.keyDown(tokenBtn, { key: 'Enter', code: 'Enter' })

      // Player shortcut handler must NOT hijack Space/Enter on token button
      expect(playSpy).not.toHaveBeenCalled()
      expect(pauseSpy).not.toHaveBeenCalled()

      // Clicking token button opens lookup popover
      fireEvent.click(tokenBtn)
      await screen.findByRole('dialog', { name: 'Tra từ: おはよう' })

      playSpy.mockRestore()
      pauseSpy.mockRestore()
    })
  })
})
