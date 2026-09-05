import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Eye, RotateCcw, Sparkles, Volume2, X } from 'lucide-react'
import { Badge, Button } from '../../components/ui'
import type { SrsCard, SrsExample, SrsRating } from './srsTypes'

function speakJapanese(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
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
    return <span dangerouslySetInnerHTML={{ __html: ex.jp_ruby }} />
  }
  if (ex.jp_furigana) {
    const ruby = ex.jp_furigana
      .replace(/([^（(\s]+)[（(][）)]\s*\[([^\]]+)\]/g, '<ruby>$1<rt>$2</rt></ruby>')
      .replace(/([^[\s]+)\[([^\]]+)\]/g, '<ruby>$1<rt>$2</rt></ruby>')
      .replace(/[（(][）)]/g, '')
    return <span dangerouslySetInnerHTML={{ __html: ruby }} />
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
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [isFlipped, setIsFlipped] = useState(false)
  const [showFurigana, setShowFurigana] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [completedCount, setCompletedCount] = useState(0)

  const currentCard = cards[currentIndex]

  const goToNext = useCallback(() => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    }
  }, [currentIndex, cards.length])

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
    }
  }, [currentIndex])

  const handleRate = useCallback(
    async (rating: SrsRating) => {
      if (!currentCard || isSubmitting) return
      setIsSubmitting(true)
      try {
        await onReview(currentCard.id, rating)
        setCompletedCount((prev) => prev + 1)
        if (currentIndex < cards.length - 1) {
          setCurrentIndex((prev) => prev + 1)
        } else {
          setIsFlipped(false)
        }
      } finally {
        setIsSubmitting(false)
      }
    },
    [currentCard, isSubmitting, onReview, currentIndex, cards.length]
  )

  // Keyboard navigation: Space = Flip, 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.code === 'Space') {
        e.preventDefault()
        setIsFlipped((prev) => !prev)
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
  }, [isFlipped, isSubmitting, currentCard, currentIndex, cards.length, handleRate, goToNext, goToPrev, onClose])

  // Reset flipped state when card changes
  useEffect(() => {
    setIsFlipped(false)
  }, [currentIndex])

  if (!currentCard) {
    return (
      <div className="modal-overlay" style={{ zIndex: 9999 }}>
        <div className="modal-content" style={{ maxWidth: '500px', textAlign: 'center', padding: '2rem' }}>
          <Check size={48} color="#10b981" style={{ margin: '0 auto 1rem auto' }} />
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
  const masteryColor = mastery >= 80 ? '#10b981' : mastery >= 50 ? '#3b82f6' : '#f59e0b'

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          background: 'var(--color-surface, #18181b)',
          borderRadius: '16px',
          border: '1px solid var(--color-border, #27272a)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--color-border, #27272a)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              Thẻ {currentIndex + 1} / {cards.length}
            </span>
            <Badge variant="primary" className="text-xs">
              {currentCard.jlptLevel || 'N5'}
            </Badge>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: masteryColor,
                background: `${masteryColor}15`,
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
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--color-border)',
                color: showFurigana ? '#3b82f6' : 'var(--color-text-muted)',
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

        {/* Card Body - 3D Flip Area */}
        <div
          onClick={() => setIsFlipped((prev) => !prev)}
          style={{
            minHeight: '340px',
            padding: '2rem 1.5rem',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            position: 'relative',
            background: isFlipped ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
            transition: 'background-color 0.2s ease',
          }}
        >
          {/* FRONT FACE */}
          {!isFlipped ? (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              {showFurigana && currentCard.reading && currentCard.reading !== currentCard.term && (
                <div
                  style={{
                    fontSize: '1.25rem',
                    fontFamily: 'var(--font-jp)',
                    color: '#3b82f6',
                    fontWeight: 600,
                  }}
                >
                  {currentCard.reading}
                </div>
              )}

              <div
                style={{
                  fontSize: currentCard.type === 'kanji' ? '5rem' : '3rem',
                  fontFamily: 'var(--font-jp)',
                  fontWeight: 800,
                  color: 'var(--color-text, #ffffff)',
                  lineHeight: 1.1,
                }}
              >
                {currentCard.term}
              </div>

              {currentCard.hanViet && (
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase' }}>
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
                      color: '#fbbf24',
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
                  onClick={(e) => {
                    e.stopPropagation()
                    speakJapanese(currentCard.term || currentCard.reading || '')
                  }}
                  style={{
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    color: '#3b82f6',
                    borderRadius: '50%',
                    padding: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Nghe phát âm"
                >
                  <Volume2 size={20} />
                </button>
              </div>

              <div style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                👉 Bấm vào thẻ hoặc phím{' '}
                <kbd style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                  Space
                </kbd>{' '}
                để lật xem đáp án
              </div>
            </div>
          ) : (
            /* BACK FACE */
            <div style={{ width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                        color: '#3b82f6',
                        marginLeft: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      【{currentCard.reading}】
                    </span>
                  )}
                  {currentCard.hanViet && (
                    <span style={{ fontSize: '1rem', color: '#dc2626', fontWeight: 800, marginLeft: '0.5rem' }}>
                      [{currentCard.hanViet}]
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    speakJapanese(currentCard.term || currentCard.reading || '')
                  }}
                  style={{
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: 'none',
                    color: '#3b82f6',
                    borderRadius: '50%',
                    padding: '8px',
                    cursor: 'pointer',
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
                        color: '#fbbf24',
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
                              background: '#3b82f6',
                              color: '#ffffff',
                              borderRadius: '999px',
                              padding: '1px 7px',
                            }}
                          >
                            Nghĩa {group.group_no || gIdx + 1}
                          </span>
                          <span style={{ fontSize: '0.98rem', fontWeight: 700, color: '#10b981' }}>
                            👉 {group.meaning || group.usage || ''}
                          </span>
                        </div>

                        {group.structure && (
                          <div
                            style={{
                              fontFamily: 'var(--font-jp)',
                              fontSize: '0.86rem',
                              color: '#60a5fa',
                              fontWeight: 600,
                            }}
                          >
                            ✦ Cấu trúc: {group.structure}
                          </div>
                        )}

                        {group.usage && group.usage !== group.meaning && (
                          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.35 }}>
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
                              onClick={(e) => {
                                e.stopPropagation()
                                if (firstEx.audio) {
                                  const a = new Audio(firstEx.audio)
                                  a.play().catch(() => speakJapanese(firstEx.jp))
                                } else {
                                  speakJapanese(firstEx.jp)
                                }
                              }}
                              style={{
                                background: 'rgba(59, 130, 246, 0.15)',
                                border: 'none',
                                color: '#3b82f6',
                                borderRadius: '50%',
                                padding: '6px',
                                cursor: 'pointer',
                                flexShrink: 0,
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
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#10b981', marginTop: '2px' }}>
                      👉 {currentCard.meaning}
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
                          color: '#f59e0b',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                        }}
                      >
                        <Sparkles size={14} /> Mẹo nhớ chiết tự (NhaiKanji):
                      </div>
                      <div style={{ color: '#fbbf24', fontSize: '0.9rem', fontWeight: 600, marginTop: '2px' }}>
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
                                style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}
                              >
                                {ex.vi}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (ex.audio) {
                                const a = new Audio(ex.audio)
                                a.play().catch(() => speakJapanese(ex.jp))
                              } else {
                                speakJapanese(ex.jp)
                              }
                            }}
                            style={{
                              background: 'rgba(59, 130, 246, 0.15)',
                              border: 'none',
                              color: '#3b82f6',
                              borderRadius: '50%',
                              padding: '6px',
                              cursor: 'pointer',
                              flexShrink: 0,
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

        {/* Progress Bar under card */}
        <div style={{ height: '4px', width: '100%', background: 'rgba(255, 255, 255, 0.05)' }}>
          <div
            style={{ height: '100%', width: `${mastery}%`, background: masteryColor, transition: 'width 0.3s ease' }}
          />
        </div>

        {/* Footer actions: SM-2 4 Rating Buttons when Flipped */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderTop: '1px solid var(--color-border, #27272a)',
            background: 'rgba(0, 0, 0, 0.2)',
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
              onClick={() => setIsFlipped(true)}
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
                  border: '1px solid #ef4444',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#f87171',
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
                  border: '1px solid #f59e0b',
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#fbbf24',
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
                  border: '1px solid #3b82f6',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
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
                  border: '1px solid #10b981',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
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
