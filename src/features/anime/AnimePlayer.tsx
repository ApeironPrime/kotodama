import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture,
  Play,
  Volume2,
  VolumeX,
} from 'lucide-react'
import type { AnimeMediaSource } from './animePlaybackTypes'

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string | HTMLElement,
        config: {
          videoId?: string
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void
            onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void
            onError?: (event: { data: number }) => void
          }
          playerVars?: Record<string, unknown>
        }
      ) => YTPlayerInstance
      PlayerState?: {
        PLAYING: number
        PAUSED: number
        ENDED: number
        BUFFERING: number
        CUED: number
      }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

interface YTPlayerInstance {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void
  getCurrentTime: () => number
  getDuration: () => number
  isMuted: () => boolean
  mute: () => void
  unMute: () => void
  getVolume: () => number
  setVolume: (volume: number) => void
  destroy: () => void
}

let youtubeApiLoadPromise: Promise<NonNullable<Window['YT']>> | null = null

/**
 * The YouTube iframe can load before the IFrame API populates `window.YT.Player`.
 * Keep one loader for the whole app so a StrictMode re-mount cannot miss the ready
 * callback and leave the visible custom controls disconnected from the iframe.
 */
function loadYouTubeIframeApi(): Promise<NonNullable<Window['YT']>> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (youtubeApiLoadPromise) return youtubeApiLoadPromise

  const loader = new Promise<NonNullable<Window['YT']>>((resolve, reject) => {
    const complete = () => {
      if (window.YT?.Player) {
        resolve(window.YT as NonNullable<Window['YT']>)
      } else {
        reject(new Error('YouTube IFrame API đã tải nhưng không khởi tạo được Player.'))
      }
    }
    const previousReady = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.()
      complete()
    }

    const tag = document.getElementById('youtube-iframe-api') as HTMLScriptElement | null ?? document.createElement('script')
    if (!tag.isConnected) {
      tag.id = 'youtube-iframe-api'
      tag.src = 'https://www.youtube.com/iframe_api'
      tag.async = true
      document.head.appendChild(tag)
    }
    tag.addEventListener('error', () => reject(new Error('Không thể tải YouTube IFrame API.')), { once: true })

    // The script can have finished loading before a later React mount attaches
    // its callback. Polling here is only a one-time API readiness handshake,
    // never a playback retry or an optimistic UI update.
    const startedAt = Date.now()
    const checkReady = () => {
      if (window.YT?.Player) return complete()
      if (Date.now() - startedAt > 10_000) return reject(new Error('YouTube IFrame API không phản hồi.'))
      window.setTimeout(checkReady, 25)
    }
    checkReady()
  }).catch((error: unknown) => {
    // Permit a later mount to attempt initialization again.
    youtubeApiLoadPromise = null
    throw error
  })

  youtubeApiLoadPromise = loader
  return loader
}

export interface AnimePlayerProps {
  mediaSource: AnimeMediaSource | null
  title?: string | null
  posterUrl?: string | null
  onTimeUpdate: (currentTime: number) => void
  onDurationChange: (duration: number) => void
  onSeeked?: (time: number) => void
  onPlaybackStateChange: (isPlaying: boolean) => void
  onError: (error: string) => void
  seekTarget?: number | null
  onBackToEpisodes?: () => void
  children?: React.ReactNode // E.g. SubtitleOverlay
}

function formatSeconds(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export const AnimePlayer: React.FC<AnimePlayerProps> = ({
  mediaSource,
  title,
  posterUrl,
  onTimeUpdate,
  onDurationChange,
  onSeeked,
  onPlaybackStateChange,
  onError,
  seekTarget,
  onBackToEpisodes,
  children,
}) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1.0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [isPipActive, setIsPipActive] = useState(false)
  const [isYoutubeReady, setIsYoutubeReady] = useState(false)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const ytPlayerRef = useRef<YTPlayerInstance | null>(null)
  const rAFRef = useRef<number | null>(null)
  const isPlayingRef = useRef(false)
  const callbacksRef = useRef({ onTimeUpdate, onDurationChange, onPlaybackStateChange, onError })
  const youtubeMountId = `yt-player-${useId().replaceAll(':', '')}`

  // Parent progress handlers intentionally change as the learning session
  // renders. Keep the provider instance independent from those identities: a
  // video may only be replaced when its source changes, never on a time update.
  callbacksRef.current = { onTimeUpdate, onDurationChange, onPlaybackStateChange, onError }

  // -------------------------------------------------------------
  // FAIL-CLOSED CHECKS & CAPABILITIES
  // -------------------------------------------------------------
  const isAuthorizedLocal = mediaSource !== null && mediaSource.source_type === 'authorized_local'
  const isPipSupported =
    isAuthorizedLocal &&
    typeof document !== 'undefined' &&
    'pictureInPictureEnabled' in document &&
    Boolean(document.pictureInPictureEnabled)

  const isPermitted =
    mediaSource !== null &&
    mediaSource.playback_allowed === true &&
    (mediaSource.source_type === 'youtube'
      ? Boolean(mediaSource.media_id)
      : isAuthorizedLocal
        ? Boolean(mediaSource.page_url)
        : false)

  // Stop playback loop
  const stopTimeUpdateLoop = useCallback(() => {
    if (rAFRef.current !== null) {
      cancelAnimationFrame(rAFRef.current)
      rAFRef.current = null
    }
  }, [])

  // Start playback loop for YouTube using requestAnimationFrame (throttled)
  const startTimeUpdateLoop = useCallback(() => {
    stopTimeUpdateLoop()
    const tick = () => {
      if (ytPlayerRef.current && isPlayingRef.current) {
        try {
          const t = ytPlayerRef.current.getCurrentTime() || 0
          setCurrentTime(t)
          callbacksRef.current.onTimeUpdate(t)
        } catch {
          // ignore transient errors
        }
        rAFRef.current = requestAnimationFrame(tick)
      }
    }
    rAFRef.current = requestAnimationFrame(tick)
  }, [stopTimeUpdateLoop])

  // Handle external seekTarget triggers (e.g. from transcript cue clicks)
  useEffect(() => {
    if (seekTarget === null || seekTarget === undefined || !isPermitted) return

    if (mediaSource?.source_type === 'authorized_local' && videoRef.current) {
      videoRef.current.currentTime = seekTarget
      setCurrentTime(seekTarget)
      onTimeUpdate(seekTarget)
      onSeeked?.(seekTarget)
    } else if (mediaSource?.source_type === 'youtube' && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.seekTo(seekTarget, true)
        setCurrentTime(seekTarget)
        onTimeUpdate(seekTarget)
        onSeeked?.(seekTarget)
      } catch {
        // ignore
      }
    }
  }, [seekTarget, isPermitted, mediaSource?.source_type, onTimeUpdate, onSeeked])

  // Native Video handlers
  const handleNativeTimeUpdate = () => {
    if (videoRef.current) {
      const t = videoRef.current.currentTime
      setCurrentTime(t)
      onTimeUpdate(t)
    }
  }

  const handleNativeDurationChange = () => {
    if (videoRef.current) {
      const d = videoRef.current.duration || 0
      setDuration(d)
      onDurationChange(d)
    }
  }

  const handleNativePlay = () => {
    setIsPlaying(true)
    isPlayingRef.current = true
    onPlaybackStateChange(true)
  }

  const handleNativePause = () => {
    setIsPlaying(false)
    isPlayingRef.current = false
    onPlaybackStateChange(false)
  }

  const handleNativeError = () => {
    const msg = 'Không thể tải hoặc phát tệp media cục bộ.'
    stopTimeUpdateLoop()
    if (videoRef.current) {
      try {
        videoRef.current.pause()
        videoRef.current.removeAttribute('src')
        videoRef.current.load()
      } catch {
        // ignore
      }
      videoRef.current = null
    }
    setIsPlaying(false)
    isPlayingRef.current = false
    onPlaybackStateChange(false)
    setPlayerError(msg)
    onError(msg)
  }

  // Native Picture-in-Picture event listeners and cleanup
  useEffect(() => {
    const videoEl = videoRef.current
    if (!videoEl || !isAuthorizedLocal) return

    const onEnterPip = () => setIsPipActive(true)
    const onLeavePip = () => setIsPipActive(false)

    videoEl.addEventListener('enterpictureinpicture', onEnterPip)
    videoEl.addEventListener('leavepictureinpicture', onLeavePip)

    return () => {
      videoEl.removeEventListener('enterpictureinpicture', onEnterPip)
      videoEl.removeEventListener('leavepictureinpicture', onLeavePip)
      if (typeof document !== 'undefined' && document.pictureInPictureElement === videoEl) {
        try {
          document.exitPictureInPicture?.().catch?.(() => {})
        } catch {
          // ignore
        }
      }
    }
  }, [isAuthorizedLocal])

  const togglePictureInPicture = useCallback(async () => {
    if (!videoRef.current || !isAuthorizedLocal) return
    try {
      if (document.pictureInPictureElement === videoRef.current) {
        await document.exitPictureInPicture()
      } else {
        await videoRef.current.requestPictureInPicture()
      }
    } catch {
      // ignore
    }
  }, [isAuthorizedLocal])

  // Play / Pause Toggle
  const togglePlayPause = useCallback(() => {
    if (mediaSource?.source_type === 'authorized_local' && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {})
      } else {
        videoRef.current.pause()
      }
    } else if (mediaSource?.source_type === 'youtube') {
      if (!isYoutubeReady || !ytPlayerRef.current) return
      if (isPlaying) ytPlayerRef.current.pauseVideo()
      else ytPlayerRef.current.playVideo()
    }
  }, [isPlaying, isYoutubeReady, mediaSource?.source_type])

  // Seek Handler
  const handleSeek = useCallback((seconds: number) => {
    const clamped = Math.max(0, Math.min(seconds, duration || 3600))
    setCurrentTime(clamped)
    onTimeUpdate(clamped)
    onSeeked?.(clamped)

    if (mediaSource?.source_type === 'authorized_local' && videoRef.current) {
      videoRef.current.currentTime = clamped
    } else if (mediaSource?.source_type === 'youtube') {
      try {
        ytPlayerRef.current?.seekTo(clamped, true)
      } catch {
        // ignore
      }
    }
  }, [duration, mediaSource?.source_type, onSeeked, onTimeUpdate])

  // Mute Handler
  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted
    setIsMuted(nextMuted)

    if (mediaSource?.source_type === 'authorized_local' && videoRef.current) {
      videoRef.current.muted = nextMuted
    } else if (mediaSource?.source_type === 'youtube') {
      try {
        if (ytPlayerRef.current) {
          if (nextMuted) ytPlayerRef.current.mute()
          else ytPlayerRef.current.unMute()
        }
      } catch {
        // ignore
      }
    }
  }, [isMuted, mediaSource?.source_type])

  // Volume Handler
  const handleVolumeChange = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(vol, 1))
    setVolume(clamped)
    setIsMuted(clamped === 0)

    if (mediaSource?.source_type === 'authorized_local' && videoRef.current) {
      videoRef.current.volume = clamped
      videoRef.current.muted = clamped === 0
    } else if (mediaSource?.source_type === 'youtube') {
      try {
        if (ytPlayerRef.current) {
          ytPlayerRef.current.setVolume(clamped * 100)
          if (clamped === 0) ytPlayerRef.current.mute()
          else ytPlayerRef.current.unMute()
        }
      } catch {
        // ignore
      }
    }
  }, [mediaSource?.source_type])

  // Fullscreen Handler
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.().catch(() => {})
      setIsFullscreen(false)
    }
  }, [])

  // Helper to test if an element should guard against shortcut hijacking
  const isGuardedTarget = (target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false
    const tagName = target.tagName.toUpperCase()
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || tagName === 'BUTTON' || tagName === 'A') return true
    if (target.isContentEditable) return true
    const role = target.getAttribute('role')
    if (role === 'slider' || role === 'button' || role === 'link') return true
    if (target.closest('button, a, [role="button"], [role="link"], [role="slider"]')) return true
    return false
  }

  // Keyboard shortcuts handler: scoped to player container only
  const handlePlayerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Only handle if event originated inside containerRef
      if (!containerRef.current || !containerRef.current.contains(e.target as Node)) {
        return
      }

      // Never hijack keys when focused inside inputs, textareas, selects, sliders, or contenteditable elements
      if (isGuardedTarget(e.target)) return

      if (e.code === 'Space' || e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        togglePlayPause()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handleSeek(currentTime - 5)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleSeek(currentTime + 5)
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        toggleMute()
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        toggleFullscreen()
      }
    },
    [currentTime, handleSeek, toggleFullscreen, toggleMute, togglePlayPause]
  )

  // YouTube owns the iframe lifecycle. Creating it through the official API is
  // essential: attaching a second Player instance to a hand-written iframe can
  // leave controls disconnected even though its icon changes.
  useEffect(() => {
    if (!isPermitted || mediaSource?.source_type !== 'youtube' || !mediaSource.media_id) {
      return
    }

    const videoId = mediaSource.media_id
    let isSubscribed = true
    let player: YTPlayerInstance | null = null
    setIsYoutubeReady(false)

    const initYT = () => {
      if (!window.YT || !window.YT.Player || !isSubscribed) return

      try {
        player = new window.YT.Player(youtubeMountId, {
          videoId,
          playerVars: {
            autoplay: 0,
            enablejsapi: 1,
            origin: window.location.origin,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: (event) => {
              if (!isSubscribed) return
              ytPlayerRef.current = event.target
              setIsYoutubeReady(true)
              const d = event.target.getDuration() || 0
              setDuration(d)
              callbacksRef.current.onDurationChange(d)
            },
            onStateChange: (event) => {
              if (!isSubscribed) return
              const isNowPlaying = event.data === (window.YT?.PlayerState?.PLAYING ?? 1)
              setIsPlaying(isNowPlaying)
              isPlayingRef.current = isNowPlaying
              callbacksRef.current.onPlaybackStateChange(isNowPlaying)

              if (isNowPlaying) {
                startTimeUpdateLoop()
              } else {
                stopTimeUpdateLoop()
              }

              // Update duration if discovered during play
              const d = event.target.getDuration() || 0
              if (d > 0) {
                setDuration(d)
                callbacksRef.current.onDurationChange(d)
              }
            },
            onError: (errEvent) => {
              if (!isSubscribed) return
              const msg = `Lỗi phát YouTube (${errEvent.data}): Video không thể phát hoặc bị chặn nhúng.`
              stopTimeUpdateLoop()
              if (ytPlayerRef.current) {
                try {
                  ytPlayerRef.current.destroy()
                } catch {
                  // ignore
                }
                ytPlayerRef.current = null
              }
              setIsPlaying(false)
              isPlayingRef.current = false
              callbacksRef.current.onPlaybackStateChange(false)
              setPlayerError(msg)
              callbacksRef.current.onError(msg)
            },
          },
        })
      } catch {
        const msg = 'Không thể khởi tạo trình phát YouTube.'
        setPlayerError(msg)
        callbacksRef.current.onError(msg)
      }
    }

    void loadYouTubeIframeApi()
      .then(() => initYT())
      .catch(() => {
        if (!isSubscribed) return
        const msg = 'Không thể tải trình phát YouTube. Vui lòng kiểm tra kết nối hoặc tiện ích chặn nội dung.'
        setPlayerError(msg)
        callbacksRef.current.onError(msg)
      })

    return () => {
      isSubscribed = false
      stopTimeUpdateLoop()
      setIsYoutubeReady(false)
      if (player && ytPlayerRef.current === player) {
        try {
          player.destroy()
        } catch {
          // ignore
        }
        ytPlayerRef.current = null
      }
    }
  }, [
    isPermitted,
    mediaSource?.source_type,
    mediaSource?.media_id,
    youtubeMountId,
    startTimeUpdateLoop,
    stopTimeUpdateLoop,
  ])

  // -------------------------------------------------------------
  // RENDER FAIL-CLOSED STATES (Not permitted OR Player Error)
  // -------------------------------------------------------------
  if (!isPermitted || playerError) {
    const isExternal = !playerError && mediaSource?.source_type === 'external_page'
    const isUnavailable = !playerError && mediaSource?.source_type === 'unavailable'

    return (
      <div className="anime-player-wrapper" ref={containerRef}>
        <div
          className={`anime-player-fallback ${
            playerError
              ? 'anime-player-fallback--error'
              : isExternal
                ? 'anime-player-fallback--external'
                : 'anime-player-fallback--forbidden'
          }`}
          role="alert"
          aria-live="polite"
        >
          {isExternal ? (
            <ExternalLink size={44} className="anime-player-fallback__icon" aria-hidden="true" />
          ) : (
            <AlertCircle size={44} className="anime-player-fallback__icon" aria-hidden="true" />
          )}

          <h3 className="anime-player-fallback__title">
            {playerError
              ? 'Lỗi phát video'
              : isExternal
                ? 'Nguồn phát bên ngoài'
                : isUnavailable
                  ? 'Nguồn phát chưa khả dụng'
                  : 'Nội dung chưa được cấp phép phát'}
          </h3>

          <p className="anime-player-fallback__desc">
            {playerError ||
              (isExternal
                ? 'Tập phim này thuộc nguồn phát bên ngoài (external page), không hỗ trợ nhúng trực tiếp vì lý do bảo mật và bản quyền.'
                : isUnavailable
                  ? 'Tập phim này hiện chưa có nguồn phát trực tuyến khả dụng.'
                  : 'Tập phim này chưa có quyền phát trực tiếp theo chính sách bản quyền của Kotodama.')}
          </p>

          {onBackToEpisodes && (
            <button
              type="button"
              onClick={onBackToEpisodes}
              className="anime-btn anime-btn--secondary"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span>Quay lại danh sách tập</span>
            </button>
          )}
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------
  // RENDER PERMITTED PLAYER (YouTube or Native Video)
  // -------------------------------------------------------------
  const isYouTube = mediaSource.source_type === 'youtube'

  return (
    <div
      className={`anime-player-container ${isFullscreen ? 'anime-player-container--fullscreen' : ''}`}
      ref={containerRef}
      tabIndex={0}
      role="region"
      aria-label={title ? `Trình phát video: ${title}` : 'Trình phát video anime'}
      onKeyDown={handlePlayerKeyDown}
    >
      {/* 16:9 Video Area */}
      <div className="anime-player-screen">
        {isYouTube && mediaSource.media_id && (
          <div data-testid="anime-youtube-player" className="anime-player-youtube-shell">
            <div id={youtubeMountId} className="anime-player-iframe" title={title || 'Trình phát video anime'} />
            {!isYoutubeReady && (
              <div className="anime-player-loading" role="status" aria-live="polite">
                Đang chuẩn bị trình phát YouTube…
              </div>
            )}
          </div>
        )}

        {isAuthorizedLocal && mediaSource.page_url && (
          <video
            ref={videoRef}
            data-testid="anime-native-video"
            className="anime-player-video"
            src={mediaSource.page_url}
            poster={posterUrl || undefined}
            onTimeUpdate={handleNativeTimeUpdate}
            onDurationChange={handleNativeDurationChange}
            onPlay={handleNativePlay}
            onPause={handleNativePause}
            onEnded={handleNativePause}
            onError={handleNativeError}
            playsInline
          />
        )}

        {/* Subtitle Overlay Slot */}
        {children}
      </div>

      {/* Unified Controls Bar */}
      <div className="anime-player-controls" role="toolbar" aria-label="Điều khiển trình phát">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlayPause}
          className="anime-player-btn anime-player-btn--play"
          aria-label={isYouTube && !isYoutubeReady ? 'Đang chuẩn bị trình phát YouTube' : isPlaying ? 'Tạm dừng (Space)' : 'Phát (Space)'}
          disabled={isYouTube && !isYoutubeReady}
        >
          {isPlaying ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
        </button>

        {/* Seekbar Slider */}
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={(e) => handleSeek(parseFloat(e.target.value))}
          className="anime-player-seekbar"
          aria-label="Thanh tua video"
        />

        {/* Time Stamp mm:ss / mm:ss */}
        <div className="anime-player-time" aria-label="Thời lượng">
          <span>{formatSeconds(currentTime)}</span>
          <span className="anime-player-time__separator">/</span>
          <span>{formatSeconds(duration)}</span>
        </div>

        {/* Volume & Mute */}
        <button
          type="button"
          onClick={toggleMute}
          className="anime-player-btn"
          aria-label={isMuted ? 'Bật âm thanh (M)' : 'Tắt âm thanh (M)'}
        >
          {isMuted || volume === 0 ? (
            <VolumeX size={18} aria-hidden="true" />
          ) : (
            <Volume2 size={18} aria-hidden="true" />
          )}
        </button>

        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={isMuted ? 0 : volume}
          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
          className="anime-player-volume-slider"
          aria-label="Thanh âm lượng"
        />

        {/* Picture-in-Picture Button (Authorized Local only when browser supports PiP) */}
        {isPipSupported && (
          <button
            type="button"
            onClick={() => void togglePictureInPicture()}
            className={`anime-player-btn anime-player-btn--pip ${
              isPipActive ? 'anime-player-btn--active' : ''
            }`}
            aria-label={isPipActive ? 'Thoát Picture-in-Picture' : 'Mở Picture-in-Picture'}
            title={isPipActive ? 'Thoát Picture-in-Picture' : 'Mở Picture-in-Picture'}
            aria-pressed={isPipActive}
          >
            <PictureInPicture size={18} aria-hidden="true" />
          </button>
        )}

        {/* Fullscreen Button */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="anime-player-btn"
          aria-label={isFullscreen ? 'Thu nhỏ màn hình (F)' : 'Toàn màn hình (F)'}
        >
          {isFullscreen ? <Minimize size={18} aria-hidden="true" /> : <Maximize size={18} aria-hidden="true" />}
        </button>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="anime-player-shortcuts-hint" aria-hidden="true">
        <span>Phím tắt:</span>
        <kbd>Space</kbd> Phát/Dừng • <kbd>←</kbd> <kbd>→</kbd> ±5s • <kbd>M</kbd> Bật/Tắt âm • <kbd>F</kbd> Toàn màn hình
      </div>
    </div>
  )
}
