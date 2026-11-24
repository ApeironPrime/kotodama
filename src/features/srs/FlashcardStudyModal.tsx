import { useDialogAccessibility } from '../../lib/useDialogAccessibility'
import { sanitizeHtml } from '../../lib/sanitizeHtml'
import { usePersistentState } from '../../lib/usePersistentState'
import { usePaperCardPhysics } from '../../lib/usePaperCardPhysics'
import { OutgoingPaperGhost, PaperStackUnderlay } from '../../components/PaperCardLayers'
import { playPaperFlip, playSoftMiss, playStampSuccess } from '../vocabulary/soundEngine'
import { sumiAudio } from '../dictionary/sumiAudio'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Eye, RotateCcw, Sparkles, Volume2, X } from 'lucide-react'
import { Badge, Button } from '../../components/ui'
import type { SrsCard, SrsExample, SrsRating } from './srsTypes'

function speakJapanese(text: string) {
  if (
    typeof window === 'undefined' ||
    !('speechSynthesis' in window) ||
    typeof SpeechSynthesisUtterance === 'undefined'
  )
    return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ja-JP'
  utterance.rate = 0.9
  window.speechSynthesis.speak(utterance)
}

function renderExampleJp(ex: SrsExample, showFurigana: boolean) {
  if (!showFurigana) {
    const clean = (ex.jp_ruby || ex.jp || '')
      .replace(/<rt>[^<]*<\/rt>/gi, '')
      .replace(/<\/?ruby>/gi, '')
      .replace(/<\/?rp>/gi, '')
      .trim()
    return <span>{clean || ex.jp}</span>
  }
  if (ex.jp_ruby) {
    return <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(ex.jp_ruby) }} />
  }
  if (ex.jp_furigana) {
    const ruby = ex.jp_furigana
      .replace(/([^（(\s]+)[（(][）)]\s*\[([^\]]+)\]/g, '<ruby>$1<rt>$2</rt></ruby>')
      .replace(/([^[\s]+)\[([^\]]+)\]/g, '<ruby>$1<rt>$2</rt></ruby>')
      .replace(/[（(][）)]/g, '')
    return <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(ruby) }} />
  }
  return <span>{ex.jp}</span>
}

interface FlashcardStudyModalProps {
  cards: SrsCard[]
  initialIndex?: number
  onClose: () => void
  onReview: (cardId: string, rating: SrsRating) => Promise<void>
}

export function FlashcardStudyModal({ cards, initialIndex = 0, onClose, onReview }: FlashcardStudyModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogAccessibility(dialogRef, onClose)
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const {
    isFlipped,
    hasFlippedCard,
    instantCardSwap,
    outgoingGhost,
    stampTriggerSeq,
    activeWrapRef,
    flipperRef,
    ghostRef,
    stack1Ref,
    stack2Ref,
    animateFlipTo,
    toggleFlip,
    resetWithoutAnimation,
    triggerStampInPlace,
    triggerCardAdvance,
  } = usePaperCardPhysics()
  const [showFurigana, setShowFurigana] = usePersistentState('kotodama.settings.furigana', true)
  const [autoPronounce] = usePersistentState('kotodama.settings.auto-pronounce', true)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [completedCount, setCompletedCount] = useState(0)
  const [stampedCardId, setStampedCardId] = useState<string | null>(null)

  const currentCard = cards[currentIndex]

  useEffect(() => {
    if (!autoPronounce || !currentCard) return
    const text = currentCard.term || currentCard.reading || ''
    if (text) speakJapanese(text)
  }, [autoPronounce, currentCard])

  const goToNext = useCallback(() => {
    if (currentIndex < cards.length - 1 && currentCard) {
      triggerCardAdvance('next', currentCard.term)
      setCurrentIndex((prev) => prev + 1)
    }
  }, [currentIndex, cards.length, currentCard, triggerCardAdvance])

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      triggerCardAdvance('prev', currentCard?.term ?? '')
      setCurrentIndex((prev) => prev - 1)
    }
  }, [currentIndex, currentCard?.term, triggerCardAdvance])

  const handleFlipToggle = useCallback(() => {
    sumiAudio.initOnGesture()
    sumiAudio.playBrushFriction()
    playPaperFlip()
    toggleFlip()
  }, [toggleFlip])

  const handleRate = useCallback(
    async (rating: SrsRating) => {
      if (!currentCard) return
      const ratedCard = currentCard
      const ratedIndex = currentIndex
      const isPositive = rating !== 'again'
      const action = isPositive ? 'pass' : 'miss'

      setReviewError(null)
      if (isPositive) {
        sumiAudio.initOnGesture()
        sumiAudio.playHankoStamp()
        playStampSuccess()
        setStampedCardId(ratedCard.id)
      } else {
        playSoftMiss()
      }

      // Non-final card: transition immediately (0ms wait, 100% interruptible keyboard flow!)
      if (ratedIndex < cards.length - 1) {
        triggerCardAdvance(action, ratedCard.term)
        setCompletedCount((prev) => prev + 1)
        setCurrentIndex((prev) => prev + 1)
        try {
          await onReview(ratedCard.id, rating)
        } catch {
          setCompletedCount((prev) => Math.max(0, prev - 1))
          setCurrentIndex(ratedIndex)
          setReviewError('Chưa lưu được kết quả ôn tập. Thẻ vẫn được giữ ở đây; hãy thử lại.')
        }
        return
      }

      // Final card before completion screen: stamp in place & verify save before closing deck
      if (isSubmitting) return
      setIsSubmitting(true)
      if (isPositive) triggerStampInPlace()
      try {
        await onReview(ratedCard.id, rating)
        setCompletedCount((prev) => prev + 1)
        setCurrentIndex(cards.length)
        resetWithoutAnimation()
      } catch {
        setReviewError('Chưa lưu được kết quả ôn tập. Thẻ vẫn được giữ ở đây; hãy thử lại.')
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      currentCard,
      currentIndex,
      cards.length,
      isSubmitting,
      onReview,
      triggerCardAdvance,
      triggerStampInPlace,
      resetWithoutAnimation,
    ]
  )

  // Keyboard navigation: Space = Flip, 1 = Again, 2 = Hard, 3 = Good, 4 = Easy (100% interruptible)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (
        e.target instanceof HTMLElement &&
        e.target.closest('button, a, select, [role="button"]') &&
        e.target.getAttribute('aria-expanded') === null
      )
        return
      if (e.code === 'Space') {
        e.preventDefault()
        handleFlipToggle()
      } else if (isFlipped && !isSubmitting && currentCard) {
        if (e.key === '1') void handleRate('again')
        else if (e.key === '2') void handleRate('hard')
        else if (e.key === '3') void handleRate('good')
        else if (e.key === '4') void handleRate('easy')
      } else if (e.key === 'ArrowRight' && currentIndex < cards.length - 1) {
        goToNext()
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        goToPrev()
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    isFlipped,
    isSubmitting,
    currentCard,
    currentIndex,
    cards.length,
    handleRate,
    handleFlipToggle,
    goToNext,
    goToPrev,
    onClose,
  ])

  if (!currentCard) {
    return (
      <div
        className="modal-overlay"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Ôn tập thẻ"
        style={{ zIndex: 9999 }}
      >
        <div
          className="modal-content srs-modal-shell washi-manuscript-card"
          style={{ maxWidth: '500px', textAlign: 'center', padding: '2rem' }}
        >
          <span className="washi-completion-hanko" aria-hidden="true">
            完
          </span>
          <Check size={40} color="var(--color-success)" style={{ margin: '0 auto 0.75rem auto' }} />
          <h2>Hoàn thành phiên ôn tập!</h2>
          <p style={{ color: 'var(--color-text-secondary)', margin: '1rem 0' }}>
            Bạn đã hoàn thành toàn bộ {completedCount} thẻ ôn tập.
          </p>
          <Button variant="primary" onClick={onClose} style={{ width: '100%' }}>
            Quay lại kho thẻ
          </Button>
        </div>
      </div>
    )
  }

  const mastery = currentCard.masteryPercentage || 0
  const masteryColor =
    mastery >= 80 ? 'var(--color-success)' : mastery >= 50 ? 'var(--color-accent)' : 'var(--color-warning)'

  return (
    <div
      className="modal-overlay srs-modal-backdrop"
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Ôn tập thẻ"
    >
      <div
        className="srs-modal-shell washi-manuscript-card"
        style={{
          maxWidth: '720px',
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {reviewError && (
          <p role="alert" className="ui-error-text">
            {reviewError}
          </p>
        )}
        {/* Header toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              Thẻ {currentIndex + 1} / {cards.length}
            </span>
            <Badge variant="primary">{currentCard.jlptLevel || 'N5'}</Badge>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: masteryColor,
                background: `color-mix(in srgb, ${masteryColor} 12%, transparent)`,
                padding: '2px 8px',
                borderRadius: '999px',
              }}
            >
              Thành thạo {mastery}%
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Furigana toggle button */}
            <button
              type="button"
              onClick={() => setShowFurigana((prev) => !prev)}
              style={{
                background: 'var(--color-surface-elevated, var(--color-surface))',
                border: '1px solid var(--color-border)',
                color: showFurigana ? 'var(--color-accent-text)' : 'var(--color-text-muted)',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
              }}
            >
              <Eye size={14} />
              {showFurigana ? 'Ẩn Furigana' : 'Hiện Furigana'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng phiên ôn tập"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Card Body - Physical Paper Stack + 3D 180° Lift Area */}
        <div className="srs-3d-stage">
          <div className={`washi-3d-scene${cards.length - currentIndex - 1 > 0 ? ' washi-3d-scene--stacked' : ''}`}>
            <PaperStackUnderlay
              remainingCount={Math.max(0, cards.length - currentIndex - 1)}
              variant="srs"
              stack1Ref={stack1Ref}
              stack2Ref={stack2Ref}
            />
            <OutgoingPaperGhost snapshot={outgoingGhost} variant="srs" ghostRef={ghostRef} />

            <div ref={activeWrapRef} className="washi-3d-active-wrap">
              <div
                ref={flipperRef}
                role="button"
                tabIndex={0}
                aria-label={isFlipped ? 'Ẩn đáp án thẻ' : 'Lật thẻ xem đáp án'}
                aria-expanded={isFlipped}
                className={`washi-3d-flipper washi-3d-flipper--gsap${isFlipped ? ' is-flipped' : ''}${instantCardSwap ? ' is-instant' : ''}`}
                onKeyDown={(event) => {
                  if (event.target === event.currentTarget && event.key === 'Enter') {
                    event.preventDefault()
                    handleFlipToggle()
                  }
                }}
                onClick={handleFlipToggle}
              >
                {/* ── FRONT FACE (0deg) ── */}
                <div className="washi-3d-face washi-3d-face--front" aria-hidden={isFlipped}>
                  <div className="srs-3d-card-surface washi-genko-bg">
                    {(currentCard.masteryPercentage >= 80 || stampedCardId === currentCard.id) && (
                      <span
                        key={stampTriggerSeq}
                        className="washi-corner-hanko is-stamping"
                        data-seal="済"
                        aria-hidden="true"
                      />
                    )}
                    <div
                      style={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1rem',
                      }}
                    >
                      {showFurigana && currentCard.reading && currentCard.reading !== currentCard.term && (
                        <div
                          style={{
                            fontSize: '1.25rem',
                            fontFamily: 'var(--font-jp)',
                            color: 'var(--color-accent-text)',
                            fontWeight: 600,
                          }}
                        >
                          {currentCard.reading}
                        </div>
                      )}

                      <div
                        style={{
                          fontSize: currentCard.type === 'kanji' ? '5.25rem' : '3.15rem',
                          fontFamily: 'var(--font-jp-serif)',
                          fontWeight: 500,
                          color: 'var(--color-text)',
                          lineHeight: 1.1,
                        }}
                      >
                        {currentCard.term}
                      </div>

                      {currentCard.hanViet && (
                        <div
                          style={{
                            fontSize: '1.1rem',
                            fontWeight: 800,
                            color: 'var(--color-danger-text)',
                            textTransform: 'uppercase',
                          }}
                        >
                          [{currentCard.hanViet}]
                        </div>
                      )}

                      {currentCard.groups && currentCard.groups.length > 1 && (
                        <div style={{ marginTop: '0.25rem' }}>
                          <span
                            style={{
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              padding: '2px 10px',
                              borderRadius: '999px',
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: 'var(--color-warning)',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                            }}
                          >
                            Gồm {currentCard.groups.length} nghĩa & cách dùng
                          </span>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button
                          type="button"
                          className="washi-audio-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            speakJapanese(currentCard.term || currentCard.reading || '')
                          }}
                          title="Nghe phát âm"
                        >
                          <Volume2 size={18} />
                        </button>
                      </div>

                      <div style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                        Bấm vào thẻ hoặc phím{' '}
                        <kbd style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                          Space
                        </kbd>{' '}
                        để lật xem đáp án
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── BACK FACE (180deg) ── */}
                <div className="washi-3d-face washi-3d-face--back" aria-hidden={!isFlipped}>
                  <div className="srs-3d-card-surface srs-3d-card-surface--back">
                    {(currentCard.masteryPercentage >= 80 || stampedCardId === currentCard.id) && (
                      <span
                        key={stampTriggerSeq}
                        className="washi-corner-hanko is-stamping"
                        data-seal="済"
                        aria-hidden="true"
                      />
                    )}
                    {(isFlipped || hasFlippedCard) && (
                      <div
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1rem',
                        }}
                      >
                        {/* Header result */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid var(--color-border)',
                            paddingBottom: '0.5rem',
                          }}
                        >
                          <div>
                            <span
                              style={{
                                fontSize: '2rem',
                                fontFamily: 'var(--font-jp)',
                                fontWeight: 800,
                                color: 'var(--color-text)',
                              }}
                            >
                              {currentCard.term}
                            </span>
                            {currentCard.reading && (
                              <span
                                style={{
                                  fontSize: '1.1rem',
                                  fontFamily: 'var(--font-jp)',
                                  color: 'var(--color-accent-text)',
                                  marginLeft: '0.75rem',
                                  fontWeight: 700,
                                }}
                              >
                                【{currentCard.reading}】
                              </span>
                            )}
                            {currentCard.hanViet && (
                              <span
                                style={{
                                  fontSize: '1rem',
                                  color: 'var(--color-danger-text)',
                                  fontWeight: 800,
                                  marginLeft: '0.5rem',
                                }}
                              >
                                [{currentCard.hanViet}]
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            className="washi-audio-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              speakJapanese(currentCard.term || currentCard.reading || '')
                            }}
                            title="Nghe phát âm từ"
                          >
                            <Volume2 size={18} />
                          </button>
                        </div>

                        {/* Multi-group Grammar Support in SRS */}
                        {currentCard.groups && currentCard.groups.length > 1 ? (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.75rem',
                              maxHeight: '380px',
                              overflowY: 'auto',
                              paddingRight: '4px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span
                                style={{
                                  fontSize: '0.78rem',
                                  fontWeight: 800,
                                  padding: '2px 10px',
                                  borderRadius: '999px',
                                  background: 'rgba(245, 158, 11, 0.2)',
                                  color: 'var(--color-warning)',
                                  border: '1px solid rgba(245, 158, 11, 0.3)',
                                }}
                              >
                                Mẫu ngữ pháp gồm {currentCard.groups.length} nghĩa & cách dùng:
                              </span>
                            </div>

                            {currentCard.groups.map((group, gIdx) => {
                              const firstEx = group.examples && group.examples[0]
                              return (
                                <div
                                  key={gIdx}
                                  style={{
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderRadius: '10px',
                                    padding: '0.75rem 0.9rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.35rem',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 800,
                                        background: 'var(--color-accent)',
                                        color: '#ffffff',
                                        borderRadius: '999px',
                                        padding: '1px 7px',
                                      }}
                                    >
                                      Nghĩa {group.group_no || gIdx + 1}
                                    </span>
                                    <span
                                      style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-success)' }}
                                    >
                                      {group.meaning || group.usage || ''}
                                    </span>
                                  </div>

                                  {group.structure && (
                                    <div
                                      style={{
                                        fontFamily: 'var(--font-jp)',
                                        fontSize: '0.86rem',
                                        color: 'var(--color-accent-text)',
                                        fontWeight: 600,
                                      }}
                                    >
                                      ✦ Cấu trúc: {group.structure}
                                    </div>
                                  )}

                                  {group.usage && group.usage !== group.meaning && (
                                    <div
                                      style={{
                                        fontSize: '0.82rem',
                                        color: 'var(--color-text-secondary)',
                                        lineHeight: 1.35,
                                      }}
                                    >
                                      ◎ {group.usage}
                                    </div>
                                  )}

                                  {firstEx && (
                                    <div
                                      style={{
                                        marginTop: '0.25rem',
                                        padding: '0.5rem 0.75rem',
                                        background: 'rgba(0, 0, 0, 0.25)',
                                        border: '1px solid rgba(255, 255, 255, 0.06)',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                      }}
                                    >
                                      <div style={{ flex: 1 }}>
                                        <div
                                          style={{
                                            fontFamily: 'var(--font-jp)',
                                            fontSize: '0.95rem',
                                            fontWeight: 600,
                                            color: 'var(--color-text)',
                                            lineHeight: 1.6,
                                          }}
                                        >
                                          {renderExampleJp(firstEx, showFurigana)}
                                        </div>
                                        {firstEx.vi && (
                                          <div
                                            style={{
                                              fontSize: '0.82rem',
                                              color: 'var(--color-text-secondary)',
                                              marginTop: '2px',
                                            }}
                                          >
                                            {firstEx.vi}
                                          </div>
                                        )}
                                      </div>

                                      <button
                                        type="button"
                                        className="washi-audio-btn"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          if (firstEx.audio) {
                                            const a = new Audio(firstEx.audio)
                                            a.play().catch(() => speakJapanese(firstEx.jp))
                                          } else {
                                            speakJapanese(firstEx.jp)
                                          }
                                        }}
                                        title="Nghe phát âm ví dụ"
                                      >
                                        <Volume2 size={15} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          /* Single Meaning / Vocab / Kanji Rendering */
                          <>
                            <div>
                              <div
                                style={{
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                  color: 'var(--color-text-muted)',
                                  textTransform: 'uppercase',
                                }}
                              >
                                Ý NGHĨA:
                              </div>
                              <div
                                style={{
                                  fontSize: '1.15rem',
                                  fontWeight: 700,
                                  color: 'var(--color-success)',
                                  marginTop: '2px',
                                }}
                              >
                                {currentCard.meaning}
                              </div>
                              {currentCard.explanation && (
                                <div
                                  style={{
                                    fontSize: '0.9rem',
                                    color: 'var(--color-text-secondary)',
                                    marginTop: '4px',
                                    lineHeight: 1.5,
                                  }}
                                >
                                  {currentCard.explanation}
                                </div>
                              )}
                            </div>

                            {currentCard.structure && (
                              <div
                                style={{
                                  background: 'rgba(255, 255, 255, 0.03)',
                                  padding: '0.5rem 0.75rem',
                                  borderRadius: '6px',
                                  border: '1px solid var(--color-border)',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    color: 'var(--color-text-muted)',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  Cấu trúc:
                                </span>
                                <div
                                  style={{
                                    fontFamily: 'var(--font-jp)',
                                    fontSize: '0.95rem',
                                    fontWeight: 600,
                                    color: 'var(--color-text)',
                                    marginTop: '2px',
                                  }}
                                >
                                  {currentCard.structure}
                                </div>
                              </div>
                            )}

                            {currentCard.story && (
                              <div
                                style={{
                                  background: 'rgba(217, 119, 6, 0.12)',
                                  border: '1px solid rgba(217, 119, 6, 0.35)',
                                  padding: '0.65rem 0.85rem',
                                  borderRadius: '8px',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    color: 'var(--color-warning)',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                  }}
                                >
                                  <Sparkles size={14} /> Mẹo nhớ chiết tự (NhaiKanji):
                                </div>
                                <div
                                  style={{
                                    color: 'var(--color-warning)',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    marginTop: '2px',
                                  }}
                                >
                                  {currentCard.story}
                                </div>
                              </div>
                            )}

                            {currentCard.examples && currentCard.examples.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <span
                                  style={{
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    color: 'var(--color-text-muted)',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  Ví dụ mẫu:
                                </span>
                                {currentCard.examples.slice(0, 2).map((ex, idx) => (
                                  <div
                                    key={idx}
                                    style={{
                                      background: 'rgba(255, 255, 255, 0.02)',
                                      padding: '0.5rem 0.75rem',
                                      borderRadius: '6px',
                                      border: '1px solid rgba(255, 255, 255, 0.05)',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      gap: '0.5rem',
                                    }}
                                  >
                                    <div style={{ flex: 1 }}>
                                      <div
                                        style={{
                                          fontFamily: 'var(--font-jp)',
                                          fontSize: '0.95rem',
                                          fontWeight: 600,
                                          color: 'var(--color-text)',
                                          lineHeight: 1.6,
                                        }}
                                      >
                                        {renderExampleJp(ex, showFurigana)}
                                      </div>
                                      {ex.vi && (
                                        <div
                                          style={{
                                            fontSize: '0.82rem',
                                            color: 'var(--color-text-secondary)',
                                            marginTop: '2px',
                                          }}
                                        >
                                          {ex.vi}
                                        </div>
                                      )}
                                    </div>

                                    <button
                                      type="button"
                                      className="washi-audio-btn"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (ex.audio) {
                                          const a = new Audio(ex.audio)
                                          a.play().catch(() => speakJapanese(ex.jp))
                                        } else {
                                          speakJapanese(ex.jp)
                                        }
                                      }}
                                      title="Nghe phát âm ví dụ"
                                    >
                                      <Volume2 size={15} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar under card */}
        <div style={{ height: '4px', width: '100%', background: 'var(--color-bg-subtle)' }}>
          <div
            style={{ height: '100%', width: `${mastery}%`, background: masteryColor, transition: 'width 0.3s ease' }}
          />
        </div>

        {/* Footer actions: SM-2 4 Rating Buttons when Flipped */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-surface-elevated, var(--color-surface))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPrev}
              disabled={currentIndex === 0}
              style={{ padding: '0 8px' }}
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToNext}
              disabled={currentIndex === cards.length - 1}
              style={{ padding: '0 8px' }}
            >
              <ChevronRight size={16} />
            </Button>
          </div>

          {!isFlipped ? (
            <Button
              variant="primary"
              onClick={() => {
                sumiAudio.initOnGesture()
                sumiAudio.playBrushFriction()
                playPaperFlip()
                animateFlipTo(true)
              }}
              style={{ flex: 1, maxWidth: '280px', fontWeight: 700 }}
            >
              <RotateCcw size={16} /> Lật thẻ (Space)
            </Button>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleRate('again')}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  minWidth: '70px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-danger-text)',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--color-danger-text)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                🔴 Quên (1)
              </button>
              <button
                type="button"
                onClick={() => handleRate('hard')}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  minWidth: '70px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-warning)',
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: 'var(--color-warning)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                🟠 Khó (2)
              </button>
              <button
                type="button"
                onClick={() => handleRate('good')}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  minWidth: '70px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-accent-border)',
                  background: 'var(--color-accent-subtle)',
                  color: 'var(--color-accent-text)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                🔵 Tốt (3)
              </button>
              <button
                type="button"
                onClick={() => handleRate('easy')}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  minWidth: '70px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-success)',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: 'var(--color-success)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                🟢 Dễ (4)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
