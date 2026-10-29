import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Eye, EyeOff, Headphones, Keyboard, Mic, RotateCcw, ShieldAlert, SpellCheck, Volume2 } from 'lucide-react'
import { isRequestCancelled } from '../../lib/apiClient'
import { useAuth } from '../auth/authContext'
import type { AnimeEpisodeDetail, AnimeSubtitleCue, AnimeSubtitleToken } from './animePlaybackTypes'
import { animePlaybackApi } from './animePlaybackApi'
import { AnimePlayer } from './AnimePlayer'
import { AnimeActiveSentence, AnimeLearningPractice, type AnimeLearningMode } from './AnimeLearningModes'
import { AnimePracticeCueList } from './AnimePracticeCueList'
import { AnimeResumePrompt } from './AnimeResumePrompt'
import { AnimeWordPopover } from './AnimeWordPopover'
import { SubtitleTranscript } from './SubtitleTranscript'
import { useSubtitleEngine } from './useSubtitleEngine'
import { deduplicateAndSortCues } from './subtitleEngineUtils'

export interface AnimeLearningSessionProps {
  episodeId: string
  onBackToEpisodes: () => void
}

const LEARNING_MODES = [
  { id: 'shadowing', label: 'Shadowing', icon: Volume2 },
  { id: 'pronunciation', label: 'Phát âm', icon: Mic },
  { id: 'listening', label: 'Luyện nghe', icon: Headphones },
  { id: 'exercise', label: 'Bài tập', icon: SpellCheck },
] as const

export const AnimeLearningSession: React.FC<AnimeLearningSessionProps> = ({ episodeId, onBackToEpisodes }) => {
  const { status, user } = useAuth()
  const isAuthenticated = status === 'authenticated' && Boolean(user)
  const isAuthenticatedRef = useRef<boolean>(isAuthenticated)
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated
  }, [isAuthenticated])

  const [episodeDetail, setEpisodeDetail] = useState<AnimeEpisodeDetail | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [isForbidden, setIsForbidden] = useState<boolean>(false)

  // Player state
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [seekTarget, setSeekTarget] = useState<number | null>(null)
  const [playRequest, setPlayRequest] = useState(0)
  const [pauseRequest, setPauseRequest] = useState(0)
  const [mode, setMode] = useState<AnimeLearningMode>('shadowing')
  const [selectedCueId, setSelectedCueId] = useState<number | null>(null)
  const [loopSentence, setLoopSentence] = useState(false)
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false)
  const [videoHidden, setVideoHidden] = useState(false)
  const [shortcutsVisible, setShortcutsVisible] = useState(false)
  const [completedCueIds, setCompletedCueIds] = useState<Set<number>>(() => new Set())
  const [practiceCues, setPracticeCues] = useState<AnimeSubtitleCue[]>([])
  const [isPracticeLoading, setIsPracticeLoading] = useState(false)
  const practiceLoadedEpisodeRef = useRef<string | null>(null)

  // T07: Resume prompt & token popover state
  const [resumePromptPosition, setResumePromptPosition] = useState<number | null>(null)
  const [activeTokenContext, setActiveTokenContext] = useState<{
    cue: AnimeSubtitleCue
    token: AnimeSubtitleToken
    triggerEl: HTMLElement
  } | null>(null)

  const detailAbortControllerRef = useRef<AbortController | null>(null)
  const progressAbortControllerRef = useRef<AbortController | null>(null)
  const episodeRequestIdRef = useRef<number>(0)
  const activeEpisodeIdRef = useRef<string>(episodeId)

  // Watch progress tracking refs
  const isPlayingRef = useRef<boolean>(false)
  const hasPlayedRef = useRef<boolean>(false)
  const isDirtyRef = useRef<boolean>(false)
  const retryCountRef = useRef<number>(0)
  const isFlushingRef = useRef<boolean>(false)
  const lastSavedPosRef = useRef<number>(0)
  const lastSavedTimeRef = useRef<number>(Date.now())
  const currentTimeRef = useRef<number>(0)
  const durationRef = useRef<number>(0)

  // Subtitle Engine
  const subtitleEngine = useSubtitleEngine({
    episodeId: episodeDetail?.episode_id || null,
    hasSubtitles: Boolean(episodeDetail?.has_subtitles),
    currentTime,
    windowSize: 600,
    prefetchThreshold: 60,
  })

  // Active cue IDs set for transcript highlighting
  const activeCueIds = useMemo(() => {
    return new Set(subtitleEngine.activeCues.map((c) => c.cue_id))
  }, [subtitleEngine.activeCues])

  // The transcript remains windowed during normal playback. Practice modes load
  // the complete track in bounded API windows so their sentence navigation is
  // not limited to the first two minutes.
  useEffect(() => {
    if (mode === 'shadowing' || !episodeDetail?.has_subtitles || practiceLoadedEpisodeRef.current === episodeDetail.episode_id) return
    let cancelled = false
    setIsPracticeLoading(true)
    const load = async () => {
      let all: AnimeSubtitleCue[] = []
      const expected = episodeDetail.subtitle_track?.cue_count || 0
      try {
        for (let from = 0; from < 7200; from += 600) {
          const result = await animePlaybackApi.fetchEpisodeSubtitles(episodeDetail.episode_id, { from, to: from + 600, lang: 'all' })
          if (cancelled) return
          all = deduplicateAndSortCues(all, result.cues || []).cues
          setPracticeCues(all)
          if ((expected > 0 && all.length >= expected) || (from > 0 && !result.cues?.length)) break
        }
        if (!cancelled) practiceLoadedEpisodeRef.current = episodeDetail.episode_id
      } catch {
        // Retain already fetched sentences; the windowed transcript still works.
      } finally {
        if (!cancelled) setIsPracticeLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [episodeDetail, mode])

  const availablePracticeCues = practiceCues.length ? practiceCues : subtitleEngine.cues
  const selectedPracticeCue = availablePracticeCues.find((cue) => cue.cue_id === selectedCueId) || availablePracticeCues[0] || null
  const shadowingCue = (loopSentence ? subtitleEngine.cues.find((cue) => cue.cue_id === selectedCueId) : subtitleEngine.activeCues[0]) || subtitleEngine.cues.find((cue) => cue.cue_id === selectedCueId) || subtitleEngine.cues[0] || null

  useEffect(() => {
    const active = subtitleEngine.activeCues[0]
    if (mode === 'shadowing' && !loopSentence && active) setSelectedCueId(active.cue_id)
  }, [subtitleEngine.activeCues, mode, loopSentence])

  useEffect(() => {
    if (mode !== 'shadowing' || !loopSentence || !shadowingCue || !isPlayingRef.current) return
    if (currentTime >= shadowingCue.end - 0.08) setSeekTarget(shadowingCue.start)
  }, [currentTime, loopSentence, mode, shadowingCue])

  // Save progress flush handler
  const flushProgress = useCallback(async (pos: number, dur: number) => {
    const epId = activeEpisodeIdRef.current
    if (
      !isAuthenticatedRef.current ||
      !epId ||
      !isDirtyRef.current ||
      !hasPlayedRef.current ||
      isFlushingRef.current ||
      retryCountRef.current >= 3
    ) {
      return
    }

    isFlushingRef.current = true
    try {
      await animePlaybackApi.saveWatchProgress({
        episodeId: epId,
        position: pos,
        duration: dur,
      })
      isDirtyRef.current = false
      retryCountRef.current = 0
      lastSavedPosRef.current = pos
      lastSavedTimeRef.current = Date.now()
    } catch {
      // Keep dirty state on failure, retry on next flush up to 3 times
      isDirtyRef.current = true
      retryCountRef.current += 1
    } finally {
      isFlushingRef.current = false
    }
  }, [])

  // Fetch episode details
  const loadEpisodeDetail = useCallback(async (targetId: string) => {
    const requestId = ++episodeRequestIdRef.current

    if (detailAbortControllerRef.current) {
      detailAbortControllerRef.current.abort()
    }
    const controller = new AbortController()
    detailAbortControllerRef.current = controller

    setIsLoading(true)
    setError(null)
    setIsForbidden(false)
    setEpisodeDetail(null)
    setCurrentTime(0)
    setSeekTarget(null)
    setPlayRequest(0)
    setPauseRequest(0)
    setMode('shadowing')
    setSelectedCueId(null)
    setLoopSentence(false)
    setExercisePickerOpen(false)
    setVideoHidden(false)
    setCompletedCueIds(new Set())
    setPracticeCues([])
    practiceLoadedEpisodeRef.current = null
    setResumePromptPosition(null)
    setActiveTokenContext(null)

    // Reset progress tracking state
    isPlayingRef.current = false
    hasPlayedRef.current = false
    isDirtyRef.current = false
    retryCountRef.current = 0
    isFlushingRef.current = false
    lastSavedPosRef.current = 0
    lastSavedTimeRef.current = Date.now()
    currentTimeRef.current = 0
    durationRef.current = 0

    try {
      const data = await animePlaybackApi.fetchEpisodeDetail(targetId, {
        signal: controller.signal,
      })

      // Drop stale response if another request has been started
      if (requestId !== episodeRequestIdRef.current || activeEpisodeIdRef.current !== targetId) {
        return
      }

      setEpisodeDetail(data)
      setError(null)

      // T07: Fetch progress once after episode detail loaded and playback permitted
      if (isAuthenticatedRef.current && data.media_source?.playback_allowed) {
        if (progressAbortControllerRef.current) {
          progressAbortControllerRef.current.abort()
        }
        const progController = new AbortController()
        progressAbortControllerRef.current = progController

        animePlaybackApi
          .fetchWatchProgress(targetId, { signal: progController.signal })
          .then((progress) => {
            if (requestId !== episodeRequestIdRef.current || activeEpisodeIdRef.current !== targetId) return
            if (progress && progress.last_playback_position > 5 && !progress.is_completed) {
              setResumePromptPosition(progress.last_playback_position)
            }
          })
          .catch(() => {})
      }
    } catch (err: unknown) {
      // Drop stale or aborted response: NEVER overwrite UI state for old requests
      if (requestId !== episodeRequestIdRef.current || activeEpisodeIdRef.current !== targetId) {
        return
      }
      if (
        isRequestCancelled(err) ||
        (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError')
      ) {
        return
      }

      const isForbiddenStatus =
        (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 403) ||
        (err &&
          typeof err === 'object' &&
          'code' in err &&
          (err as { code: string }).code === 'ANIME_CONTENT_RESTRICTED')

      if (isForbiddenStatus) {
        setIsForbidden(true)
        setError('Tập phim này đang bị hạn chế truy cập do chưa được duyệt bản quyền.')
      } else {
        setError('Không thể tải thông tin tập phim. Vui lòng thử lại.')
      }
    } finally {
      if (requestId === episodeRequestIdRef.current && activeEpisodeIdRef.current === targetId) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    activeEpisodeIdRef.current = episodeId
    loadEpisodeDetail(episodeId)

    return () => {
      if (detailAbortControllerRef.current) {
        detailAbortControllerRef.current.abort()
      }
      if (progressAbortControllerRef.current) {
        progressAbortControllerRef.current.abort()
      }
      if (isDirtyRef.current && hasPlayedRef.current) {
        flushProgress(currentTimeRef.current, durationRef.current)
      }
    }
  }, [episodeId, loadEpisodeDetail, flushProgress])

  // Unmount / pagehide / visibilitychange flush listener
  useEffect(() => {
    const handlePageHide = () => {
      if (isDirtyRef.current && hasPlayedRef.current) {
        flushProgress(currentTimeRef.current, durationRef.current)
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isDirtyRef.current && hasPlayedRef.current) {
        flushProgress(currentTimeRef.current, durationRef.current)
      }
    }

    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [flushProgress])

  // Player handlers
  const handleTimeUpdate = useCallback(
    (time: number) => {
      setCurrentTime(time)
      currentTimeRef.current = time

      // Only mark dirty and debounce save when playback has actually occurred
      if (isPlayingRef.current) {
        hasPlayedRef.current = true
        isDirtyRef.current = true
        const posDelta = Math.abs(time - lastSavedPosRef.current)
        const timeDelta = Date.now() - lastSavedTimeRef.current
        if (posDelta >= 5 || (timeDelta >= 30000 && posDelta >= 1)) {
          flushProgress(time, durationRef.current)
        }
      }
    },
    [flushProgress]
  )

  const handleDurationChange = useCallback((dur: number) => {
    durationRef.current = dur
  }, [])

  const handlePlaybackStateChange = useCallback(
    (playing: boolean) => {
      isPlayingRef.current = playing
      if (playing) {
        hasPlayedRef.current = true
      } else if (isDirtyRef.current && hasPlayedRef.current) {
        flushProgress(currentTimeRef.current, durationRef.current)
      }
    },
    [flushProgress]
  )

  const handleSeekFromTranscript = (time: number) => {
    setSeekTarget(time)
  }

  const handleChoosePracticeCue = useCallback((cue: AnimeSubtitleCue) => {
    setSelectedCueId(cue.cue_id)
    setSeekTarget(cue.start)
  }, [])

  const replayCue = () => {
    const cue = mode === 'shadowing' ? shadowingCue : selectedPracticeCue
    if (!cue) return
    setSeekTarget(cue.start)
    setPlayRequest((value) => value + 1)
  }

  const changeMode = (nextMode: AnimeLearningMode) => {
    if (nextMode === 'exercise') setExercisePickerOpen(true)
    if (nextMode === mode) return
    setMode(nextMode)
    setLoopSentence(false)
    setPauseRequest((value) => value + 1)
  }

  const handlePlayerSeeked = () => {
    setSeekTarget(null)
  }

  // Resume prompt actions
  const handleResumeContinue = () => {
    if (resumePromptPosition !== null) {
      setSeekTarget(resumePromptPosition)
      setResumePromptPosition(null)
    }
  }

  const handleResumeStartOver = () => {
    setSeekTarget(0)
    setResumePromptPosition(null)
    // Seeking to 0 does not overwrite DB until next play/heartbeat
    isDirtyRef.current = false
    hasPlayedRef.current = false
    lastSavedPosRef.current = 0
  }

  const handleSelectToken = (cue: AnimeSubtitleCue, token: AnimeSubtitleToken, triggerEl: HTMLElement) => {
    setActiveTokenContext({ cue, token, triggerEl })
  }

  // -------------------------------------------------------------
  // RENDER LOADING SKELETON
  // -------------------------------------------------------------
  if (isLoading) {
    return (
      <section className="anime-session" aria-label="Đang tải phiên học anime" aria-live="polite">
        <div className="anime-session-header-skeleton">
          <div className="anime-session-skeleton-line anime-session-skeleton-line--breadcrumb" />
          <div className="anime-session-skeleton-line anime-session-skeleton-line--title" />
        </div>

        <div className="anime-session-grid">
          <div className="anime-session-player-column">
            <div className="anime-session-player-skeleton" />
          </div>
          <div className="anime-session-transcript-column">
            <div className="anime-transcript-skeleton">
              <div className="anime-transcript-skeleton__item" />
              <div className="anime-transcript-skeleton__item" />
              <div className="anime-transcript-skeleton__item" />
              <div className="anime-transcript-skeleton__item" />
            </div>
          </div>
        </div>
      </section>
    )
  }

  // -------------------------------------------------------------
  // RENDER 403 FORBIDDEN / PERMISSION RESTRICTED (FAIL-CLOSED)
  // -------------------------------------------------------------
  if (isForbidden) {
    return (
      <section className="anime-session anime-session--forbidden" role="alert" aria-live="polite">
        <div className="anime-state-card anime-state-card--forbidden">
          <ShieldAlert size={48} className="anime-state-card__icon anime-state-card__icon--rights" aria-hidden="true" />
          <h2 className="anime-state-card__title">Nội dung bị hạn chế</h2>
          <p className="anime-state-card__desc">
            Tập phim này đang bị hạn chế truy cập theo chính sách bản quyền công khai.
          </p>
          <button type="button" onClick={onBackToEpisodes} className="anime-btn anime-btn--secondary">
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Quay lại danh sách tập</span>
          </button>
        </div>
      </section>
    )
  }

  // -------------------------------------------------------------
  // RENDER LOAD ERROR WITH RETRY
  // -------------------------------------------------------------
  if (error || !episodeDetail) {
    return (
      <section className="anime-session anime-session--error" role="alert" aria-live="polite">
        <div className="anime-state-card anime-state-card--error">
          <h2 className="anime-state-card__title">Không thể tải tập phim</h2>
          <p className="anime-state-card__desc">{error || 'Có lỗi xảy ra khi tải dữ liệu tập phim.'}</p>
          <div className="anime-session-actions">
            <button type="button" onClick={() => loadEpisodeDetail(episodeId)} className="anime-btn anime-btn--primary">
              <RotateCcw size={16} aria-hidden="true" />
              <span>Thử lại</span>
            </button>
            <button type="button" onClick={onBackToEpisodes} className="anime-btn anime-btn--secondary">
              <ArrowLeft size={16} aria-hidden="true" />
              <span>Quay lại danh sách tập</span>
            </button>
          </div>
        </div>
      </section>
    )
  }

  // -------------------------------------------------------------
  // RENDER ACTIVE LEARNING SESSION
  // -------------------------------------------------------------
  const episodeLabel = `Tập ${episodeDetail.episode_number}`
  const specificTitle = episodeDetail.title?.trim()
  const episodeTitle =
    specificTitle && specificTitle.toLocaleLowerCase('vi') !== episodeLabel.toLocaleLowerCase('vi')
      ? `${episodeLabel}: ${specificTitle}`
      : episodeLabel

  return (
    <section className="anime-session" aria-label={`Phiên học: ${episodeDetail.series_title_vi} - ${episodeTitle}`}>
      {/* Dedicated learning-studio header from the supplied reference. */}
      <header className="anime-session-header">
        <div className="anime-session-nav">
          <button
            type="button"
            onClick={onBackToEpisodes}
            className="anime-session-back-btn"
            aria-label="Quay lại danh sách tập"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            <span className="anime-session-back-text">Quay lại danh sách tập</span>
          </button>
          <span className="anime-session-breadcrumb-separator" aria-hidden="true">
            /
          </span>
          <span className="anime-session-breadcrumb-series"><span>{episodeDetail.series_title_vi}</span><h1 className="anime-session-breadcrumb-episode">{episodeTitle}</h1></span>
          {episodeDetail.season_label && (
            <>
              <span className="anime-session-breadcrumb-separator" aria-hidden="true">
                /
              </span>
              <span className="anime-session-breadcrumb-season">{episodeDetail.season_label}</span>
            </>
          )}
        </div>

        <span className="anime-session-subtitle-status">{episodeDetail.has_subtitles ? 'Có phụ đề' : 'Chưa có phụ đề'}</span>
        <nav className="anime-learning-mode-nav" aria-label="Chế độ học với video">
          {LEARNING_MODES.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={mode === id ? 'is-active' : ''} aria-current={mode === id ? 'page' : undefined} onClick={() => changeMode(id)}>
              <Icon size={17} aria-hidden="true" />{label}
            </button>
          ))}
        </nav>
      </header>

      {/* 2-Column Responsive Layout */}
      <div className="anime-session-grid">
        {/* Left Column: Player, Resume Prompt & Subtitle Overlay */}
        <div className="anime-session-player-column">
          {resumePromptPosition !== null && (
            <AnimeResumePrompt
              position={resumePromptPosition}
              onContinue={handleResumeContinue}
              onStartOver={handleResumeStartOver}
              onDismiss={() => setResumePromptPosition(null)}
            />
          )}

          <AnimePlayer
            mediaSource={episodeDetail.media_source}
            title={`${episodeDetail.series_title_vi} - ${episodeTitle}`}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={handleDurationChange}
            onSeeked={handlePlayerSeeked}
            onPlaybackStateChange={handlePlaybackStateChange}
            onError={() => {}}
            seekTarget={seekTarget}
            playRequest={playRequest}
            pauseRequest={pauseRequest}
            hideVideo={videoHidden && mode !== 'shadowing'}
            onBackToEpisodes={onBackToEpisodes}
          />
          {mode !== 'shadowing' && <div className="anime-session-player-tools">
            <button type="button" onClick={() => setVideoHidden((value) => !value)} aria-pressed={videoHidden}>
              {videoHidden ? <Eye size={17} /> : <EyeOff size={17} />}{videoHidden ? 'Hiện video' : 'Ẩn video'}
            </button>
            <button type="button" onClick={() => setShortcutsVisible((value) => !value)} aria-expanded={shortcutsVisible}>
              <Keyboard size={17} /> Phím tắt
            </button>
            {shortcutsVisible && <span role="status">← → chuyển câu · Space phát/dừng video · M tắt tiếng · F toàn màn hình</span>}
          </div>}
          {mode !== 'shadowing' && <AnimePracticeCueList
            cues={availablePracticeCues}
            selectedCueId={selectedPracticeCue?.cue_id ?? null}
            mode={mode}
            totalCues={episodeDetail.subtitle_track?.cue_count || availablePracticeCues.length}
            completedCueIds={completedCueIds}
            onChooseCue={handleChoosePracticeCue}
          />}
          {mode === 'shadowing' && <AnimeActiveSentence
            cue={shadowingCue}
            onReplay={replayCue}
            onSelectToken={handleSelectToken}
            showJapanese={subtitleEngine.showJapanese}
            showVietnamese={subtitleEngine.showVietnamese}
            loop={loopSentence}
            onToggleLoop={() => setLoopSentence((value) => !value)}
            onToggleJapanese={() => subtitleEngine.setShowJapanese(!subtitleEngine.showJapanese)}
            onToggleVietnamese={() => subtitleEngine.setShowVietnamese(!subtitleEngine.showVietnamese)}
          />}
        </div>

        {/* Right Column: Subtitle Transcript & Sync Controls */}
        <div className="anime-session-transcript-column">
          {mode === 'shadowing' ? <SubtitleTranscript
            cues={subtitleEngine.cues}
            activeCueIds={activeCueIds}
            hasSubtitles={Boolean(episodeDetail.has_subtitles)}
            isLoading={subtitleEngine.isLoading}
            isPrefetching={subtitleEngine.isPrefetching}
            error={subtitleEngine.error}
            offset={subtitleEngine.offset}
            showJapanese={subtitleEngine.showJapanese}
            showVietnamese={subtitleEngine.showVietnamese}
            showFurigana={subtitleEngine.showFurigana}
            hasFuriganaData={subtitleEngine.hasFuriganaData}
            onSeekTo={handleSeekFromTranscript}
            onOffsetChange={subtitleEngine.setOffset}
            onResetOffset={subtitleEngine.resetOffset}
            onToggleJapanese={subtitleEngine.setShowJapanese}
            onToggleVietnamese={subtitleEngine.setShowVietnamese}
            onToggleFurigana={subtitleEngine.setShowFurigana}
            onRetry={subtitleEngine.retry}
            onSelectToken={handleSelectToken}
            episodeId={episodeDetail.episode_id}
            totalCues={episodeDetail.subtitle_track?.cue_count || subtitleEngine.cues.length}
          /> : <AnimeLearningPractice
            mode={mode}
            cues={availablePracticeCues}
            cue={selectedPracticeCue}
            totalCues={episodeDetail.subtitle_track?.cue_count || availablePracticeCues.length}
            isLoading={isPracticeLoading}
            onChooseCue={handleChoosePracticeCue}
            onReplay={replayCue}
            onPause={() => setPauseRequest((value) => value + 1)}
            pickerOpen={exercisePickerOpen}
            onClosePicker={() => setExercisePickerOpen(false)}
            videoHidden={videoHidden}
            onToggleVideo={() => setVideoHidden((value) => !value)}
            onCompleteCue={(cueId) => setCompletedCueIds((previous) => new Set(previous).add(cueId))}
          />}
        </div>
      </div>

      {/* Interactive Word Popover (Desktop / Bottom Sheet Mobile) */}
      {activeTokenContext && (
        <AnimeWordPopover
          episodeId={episodeDetail.episode_id}
          cue={activeTokenContext.cue}
          token={activeTokenContext.token}
          triggerElement={activeTokenContext.triggerEl}
          onClose={() => setActiveTokenContext(null)}
        />
      )}
    </section>
  )
}
