import { usePersistentState } from '../../lib/usePersistentState'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { useUrlState } from '../../lib/useUrlState'
import { sanitizeHtml } from '../../lib/sanitizeHtml'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  BookmarkPlus,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Gamepad2,
  GraduationCap,
  Layers,
  ListTree,
  RotateCcw,
  Search,
  Volume2,
} from 'lucide-react'
import { Badge, Button, EmptyState } from '../../components/ui'
import PageHeader from '../../components/PageHeader'
import { srsApi } from '../srs/srsApi'
import type { CurriculumGrammar } from '../srs/srsTypes'
import { useAuth } from '../auth/authContext'

const GRAMMAR_CATALOG = [
  {
    id: 'shinkanzen_n3',
    title: 'Shinkanzen Master N3 (新完全マスター)',
    subtitle: 'Shinkanzen Master N3',
    level: 'N3',
    color: 'var(--color-accent-text)',
    bg: 'var(--color-bg-surface)',
    border: 'var(--color-border)',
  },
  {
    id: 'mimikara_n3',
    title: 'Mimikara Oboeru N3 (耳から覚える文法)',
    subtitle: 'Mimikara Oboeru N3',
    level: 'N3',
    color: 'var(--color-accent-text)',
    bg: 'var(--color-bg-surface)',
    border: 'var(--color-border)',
  },
  {
    id: 'shinkanzen_n2',
    title: 'Shinkanzen Master N2 (新完全マスター)',
    subtitle: 'Shinkanzen Master N2',
    level: 'N2',
    color: 'var(--color-accent-text)',
    bg: 'var(--color-bg-surface)',
    border: 'var(--color-border)',
  },
  {
    id: 'shinkanzen_n1',
    title: 'Shinkanzen Master N1 (新完全マスター)',
    subtitle: 'Shinkanzen Master N1',
    level: 'N1',
    color: 'var(--color-accent-text)',
    bg: 'var(--color-bg-surface)',
    border: 'var(--color-border)',
  },
] as const

function speakJapanese(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ja-JP'
  utterance.rate = 0.88
  window.speechSynthesis.speak(utterance)
}

export function BunpoPage({ onGoToSrs }: { onGoToSrs?: () => void }) {
  const { user } = useAuth()
  const [saveError, setSaveError] = useState<string | null>(null)
  // Navigation: 'catalog' -> 'lessons' -> 'study'
  const [selectedBook, setSelectedBook] = useUrlState<string | null>('book', null)
  const [selectedLesson, setSelectedLesson] = useUrlState<string | null>('lesson', null)
  const [selectedPoint] = useUrlState<string | null>('point', null)
  const openedPoint = useRef<string | null>(null)
  const [stageMode, setStageMode] = useState<'flashcard' | 'game'>('flashcard')
  const [showFullListWhenDeepLinked, setShowFullListWhenDeepLinked] = useState(false)
  const [grammarQuestions, setGrammarQuestions] = useState<
    Array<{ target: CurriculumGrammar; options: CurriculumGrammar[] }>
  >([])
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizSelectedId, setQuizSelectedId] = useState<string | null>(null)
  const [quizScore, setQuizScore] = useState(0)
  const [quizCombo, setQuizCombo] = useState(0)
  const [quizCorrectCount, setQuizCorrectCount] = useState(0)
  const [quizFinished, setQuizFinished] = useState(false)

  // In-Lesson Flashcard state
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [, setKnownGrammars] = usePersistentState<string[]>(
    `kotodama.known-grammar:${user?.id ?? 'guest'}:${selectedBook}:${selectedLesson}`,
    []
  )
  const [savedSrs, setSavedSrs] = useState<Record<string, boolean>>({})
  const [activePointId, setActivePointId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const catalogQueries = useQueries({
    queries: GRAMMAR_CATALOG.map((book) => ({
      queryKey: ['curriculum', 'lessons', book.id],
      queryFn: () => srsApi.fetchLessons(book.id),
      enabled: !selectedBook,
      staleTime: 60_000,
    })),
  })
  const catalogBadge = (bookId: string) => {
    const query = catalogQueries[GRAMMAR_CATALOG.findIndex((book) => book.id === bookId)]
    if (query?.isError) return 'Chưa tải được dữ liệu'
    if (!query?.data) return 'Đang tải nội dung…'
    if (!query.data.length) return 'Chưa có nội dung'
    return `${query.data.reduce((total, lesson) => total + lesson.count, 0)} mẫu · ${query.data.length} bài`
  }

  // Fetch saved SRS terms from server to know which items are already saved
  const { data: savedTermsData } = useQuery({
    queryKey: ['srs', user?.id ?? 'me', 'saved-terms'],
    queryFn: () => srsApi.fetchSavedTerms(),
    enabled: Boolean(user),
    staleTime: 30_000,
  })

  // Sync server saved terms into local state for instant UI feedback
  useEffect(() => {
    if (!Array.isArray(savedTermsData)) return
    const map: Record<string, boolean> = {}
    for (const entry of savedTermsData) {
      if (entry?.type === 'grammar' && entry?.term) {
        // Match by term (pattern) since we don't know the curriculum item ID on the server
        map[`grammar_term_${entry.term}`] = true
        map[entry.term] = true
      }
    }
    setSavedSrs(map)
  }, [savedTermsData])

  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebouncedValue(searchQuery)
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 1. Fetch Lessons for the selected Book
  const {
    data: lessonsList,
    isError: lessonsError,
    refetch: refetchLessons,
  } = useQuery({
    queryKey: ['curriculum', 'lessons', selectedBook],
    queryFn: () => srsApi.fetchLessons(selectedBook || 'shinkanzen_n3'),
    enabled: Boolean(selectedBook),
  })

  // 2. Fetch Grammar items for the current Lesson
  const {
    data: grammarData,
    isError: grammarError,
    refetch: refetchGrammar,
  } = useQuery({
    queryKey: ['curriculum', 'grammar', selectedBook, selectedLesson, debouncedSearchQuery],
    queryFn: () =>
      srsApi.fetchCurriculumGrammar({
        curriculum: selectedBook || undefined,
        lesson: selectedLesson || undefined,
        query: debouncedSearchQuery,
        page: 1,
        limit: 100,
      }),
    enabled: Boolean(selectedBook && selectedLesson),
  })

  const grammars = useMemo(() => grammarData?.items ?? [], [grammarData?.items])
  const currentCard = grammars[currentIndex] || null

  const buildGrammarQuestions = useCallback((items: CurriculumGrammar[]) => {
    if (items.length < 2) return []
    const shuffled = [...items].sort(() => Math.random() - 0.5).slice(0, Math.min(10, items.length))
    return shuffled.map((target) => {
      const distractors = items
        .filter(
          (g) => g.id !== target.id && (g.shortMeaning || g.explanation) !== (target.shortMeaning || target.explanation)
        )
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
      const options = [target, ...distractors].sort(() => Math.random() - 0.5)
      return { target, options }
    })
  }, [])

  const resetGrammarQuiz = useCallback(() => {
    setGrammarQuestions(buildGrammarQuestions(grammars))
    setQuizIndex(0)
    setQuizSelectedId(null)
    setQuizScore(0)
    setQuizCombo(0)
    setQuizCorrectCount(0)
    setQuizFinished(false)
  }, [buildGrammarQuestions, grammars])

  useEffect(() => {
    setGrammarQuestions(buildGrammarQuestions(grammars))
  }, [buildGrammarQuestions, grammars])
  useEffect(() => {
    const key = `${selectedBook}:${selectedLesson}:${selectedPoint}`
    if (!grammarData || openedPoint.current === key) return
    const index = grammarData.items.findIndex((item) => item.id === selectedPoint)
    setCurrentIndex(Math.max(0, index))
    setIsFlipped(false)
    openedPoint.current = key
  }, [grammarData, selectedBook, selectedLesson, selectedPoint])

  const playAudio = useCallback((url?: string, fallbackText?: string) => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    if (url) {
      const audio = new Audio(url)
      audioRef.current = audio
      setPlayingAudioUrl(url)
      audio.play().catch(() => {
        setPlayingAudioUrl(null)
        if (fallbackText) speakJapanese(fallbackText)
      })
      audio.onended = () => setPlayingAudioUrl(null)
      audio.onerror = () => {
        setPlayingAudioUrl(null)
        if (fallbackText) speakJapanese(fallbackText)
      }
    } else if (fallbackText) {
      speakJapanese(fallbackText)
    }
  }, [])

  // Keyboard shortcut listener for in-lesson flashcard
  const handleNextCard = () => {
    setIsFlipped(false)
    if (currentIndex < grammars.length - 1) {
      setCurrentIndex((i) => i + 1)
    }
  }

  const handlePrevCard = () => {
    setIsFlipped(false)
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1)
    }
  }

  const handleSaveToSrs = useCallback(
    async (item: CurriculumGrammar) => {
      setSaveError(null)
      if (!user) {
        setSaveError('Đăng nhập để lưu ngữ pháp vào sổ tay ôn tập.')
        return
      }
      try {
        const summaryMeaning =
          item.groups && item.groups.length > 1
            ? item.groups
                .map((g) => g.meaning || g.usage)
                .filter(Boolean)
                .join(' / ')
            : item.shortMeaning || item.explanation

        await srsApi.addCard({
          type: 'grammar',
          term: item.pattern,
          meaning: summaryMeaning,
          structure: item.structure,
          explanation: item.explanation,
          jlptLevel: (item.level || 'N3').toUpperCase(),
          groups: item.groups,
          examples: item.examples?.map((e) => ({
            jp: e.jp,
            jp_furigana: e.jp_furigana,
            jp_ruby: e.jp_ruby,
            vi: e.vi,
            audio: e.audio,
          })),
        })
        setSavedSrs((prev) => ({ ...prev, [`grammar_${item.id}`]: true, [`grammar_term_${item.pattern}`]: true }))
        await queryClient.invalidateQueries({ queryKey: ['srs'] })
      } catch {
        setSaveError('Chưa lưu được ngữ pháp. Kiểm tra kết nối rồi thử lại.')
      }
    },
    [queryClient, user]
  )

  // Keyboard shortcut listener for in-lesson flashcard
  useEffect(() => {
    if (!selectedLesson || stageMode !== 'flashcard' || !currentCard) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return

      if (e.code === 'Space') {
        e.preventDefault()
        setIsFlipped((f) => !f)
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        setKnownGrammars((prev) => [...new Set([...prev, currentCard.id])])
        setIsFlipped(false)
        setCurrentIndex((i) => (i < grammars.length - 1 ? i + 1 : i))
      } else if (e.key === 'x' || e.key === 'X') {
        e.preventDefault()
        setIsFlipped(false)
        setCurrentIndex((i) => (i < grammars.length - 1 ? i + 1 : i))
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        const firstAudio = currentCard.examples?.find((e) => e.audio)?.audio
        playAudio(firstAudio, currentCard.pattern)
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        void handleSaveToSrs(currentCard)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedLesson, stageMode, currentCard, isFlipped, grammars.length, handleSaveToSrs, playAudio, setKnownGrammars])

  /** Check if a grammar item is saved — matches both local ID key and server term key */
  const isGrammarSaved = (item: CurriculumGrammar) =>
    savedSrs[`grammar_${item.id}`] || savedSrs[`grammar_term_${item.pattern}`] || false

  const currentBookInfo = GRAMMAR_CATALOG.find((b) => b.id === selectedBook)

  if ((selectedBook && lessonsError) || (selectedLesson && grammarError))
    return (
      <section className="ui-status-panel" role="alert">
        <h1>Chưa tải được bài ngữ pháp</h1>
        <p>Kiểm tra kết nối rồi thử lại.</p>
        <Button
          onClick={() => {
            void refetchLessons()
            if (selectedLesson) void refetchGrammar()
          }}
        >
          Thử lại
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setSelectedLesson(null)
            setSelectedBook(null)
          }}
        >
          Về kho giáo trình
        </Button>
      </section>
    )

  // =========================================================================
  // VIEW 1: CATALOG OVERVIEW (Chọn bộ giáo trình Ngữ Pháp - media_1788263283117.png)
  // =========================================================================
  if (!selectedBook) {
    const sections = [
      { level: 'N3', title: 'Ngữ pháp Chuyên sâu N3', subtitle: 'Shinkanzen & Mimikara N3' },
      { level: 'N2', title: 'Ngữ pháp Chuyên sâu N2', subtitle: 'Shinkanzen Master N2' },
      { level: 'N1', title: 'Ngữ pháp Chuyên sâu N1', subtitle: 'Shinkanzen Master N1' },
    ] as const

    return (
      <div className="nhaikanji-container washi-page">
        <PageHeader
          hanko="文"
          jpVertical="日本語文法"
          eyebrow="NGỮ PHÁP TIẾNG NHẬT CHUẨN JLPT"
          title="Kho Giáo Trình Ngữ Pháp (Shinkanzen Master & Mimikara)"
          description="Học ngữ pháp theo từng bài: đọc giải thích, xem ví dụ và luyện ghi nhớ bằng thẻ ôn tập."
        />

        {sections.map((section) => (
          <section key={section.level} className="bunpo-section">
            <div className="washi-section-head">
              <h2>{section.title}</h2>
              <span>{section.subtitle}</span>
            </div>

            <div className="bunpo-folio-grid">
              {GRAMMAR_CATALOG.filter((b) => b.level === section.level).map((book) => (
                <div
                  key={book.id}
                  role="button"
                  tabIndex={0}
                  className="bunpo-folio-card"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      event.currentTarget.click()
                    }
                  }}
                  onClick={() => setSelectedBook(book.id)}
                >
                  <div className="bunpo-folio-card__head">
                    <div>
                      <span className="bunpo-folio-card__sub">{book.subtitle}</span>
                      <h3 className="bunpo-folio-card__title">{book.title}</h3>
                    </div>
                    <div className="bunpo-folio-card__seal" aria-hidden="true">
                      <GraduationCap size={20} />
                    </div>
                  </div>

                  <div className="bunpo-folio-card__footer">
                    <Badge variant="primary">{catalogBadge(book.id)}</Badge>
                    <span className="bunpo-folio-card__cta">Vào học ngay →</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    )
  }

  // =========================================================================
  // VIEW 2: LESSONS GRID (Danh sách bài học - media_1788263395027.png)
  // =========================================================================
  if (selectedBook && selectedLesson === null) {
    return (
      <div className="washi-page bunpo-view-shell">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <Button variant="ghost" size="sm" onClick={() => setSelectedBook(null)}>
            <ArrowLeft size={16} /> Quay lại danh sách sách
          </Button>
        </div>

        <header className="bunpo-book-banner">
          <div className="bunpo-book-banner__left">
            <span className="bunpo-book-banner__hanko" aria-hidden="true">
              文
            </span>
            <div>
              <span className="washi-masthead__eyebrow" style={{ color: currentBookInfo?.color }}>
                {currentBookInfo?.subtitle}
              </span>
              <h1 className="bunpo-book-title">{currentBookInfo?.title}</h1>
              <p style={{ color: 'var(--color-text-secondary)', margin: '0.35rem 0 0' }}>
                {lessonsList?.length || 0} bài học · Chọn một bài học để bắt đầu ôn tập ngữ pháp, Flashcard hoặc
                Mini-Game.
              </p>
            </div>
          </div>
          {lessonsList?.[0] && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const firstLesson = lessonsList[0]
                if (!firstLesson) return
                setSelectedLesson(firstLesson.lesson_id)
                setCurrentIndex(0)
                setIsFlipped(false)
                resetGrammarQuiz()
              }}
            >
              Bắt đầu Bài 1 →
            </Button>
          )}
        </header>

        {/* Lesson Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))',
            gap: '1rem',
          }}
        >
          {lessonsList && !lessonsList.length && (
            <EmptyState
              title="Giáo trình này chưa có bài học"
              description="Bạn có thể quay lại chọn giáo trình khác hoặc thử tải lại."
              action={<Button onClick={() => void refetchLessons()}>Thử tải lại</Button>}
            />
          )}
          {lessonsList?.map((lesson, idx) => (
            <div
              key={lesson.lesson_id}
              className="bunpo-lesson-card"
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  event.currentTarget.click()
                }
              }}
              onClick={() => {
                setSelectedLesson(lesson.lesson_id)
                setCurrentIndex(0)
                setIsFlipped(false)
                resetGrammarQuiz()
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
                <span className="curriculum-unit-card__seal" aria-hidden="true">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="bunpo-lesson-card__eyebrow">BÀI HỌC {idx + 1}</div>
                  <h4 className="bunpo-lesson-card__title">{lesson.lesson_title}</h4>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                <span className="srs-card-level">{lesson.count} mẫu</span>
                <ChevronRight size={18} style={{ color: 'var(--color-text-muted)' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // =========================================================================
  // VIEW 3: IN-LESSON STUDY & FLASHCARD VIEW
  // =========================================================================
  const currentLessonInfo = lessonsList?.find((l) => l.lesson_id === selectedLesson)

  return (
    <div className="washi-page bunpo-view-shell">
      {saveError && (
        <p role="alert" className="ui-error-text">
          {saveError}
        </p>
      )}
      {/* 3.1 Header Navigation */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <Button variant="ghost" size="sm" onClick={() => setSelectedLesson(null)}>
          <ArrowLeft size={16} /> Danh sách bài học
        </Button>

        <div style={{ textAlign: 'center' }}>
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--font-display), var(--font-jp-serif)',
              fontSize: '1.35rem',
              fontWeight: 600,
              color: 'var(--color-text)',
            }}
          >
            {currentBookInfo?.subtitle} - {currentLessonInfo?.lesson_title}
          </h2>
        </div>

        {onGoToSrs && (
          <Button variant="secondary" size="sm" onClick={onGoToSrs}>
            <Layers size={15} /> Mở Sổ Tay Ôn Tập SRS
          </Button>
        )}
      </div>

      {/* 3.2 TOP STAGE: GRAMMAR FLASHCARD OR DOJO QUIZ */}
      {stageMode === 'game' ? (
        <section className="dojo-game" style={{ marginBottom: '1.25rem' }} aria-label="Mini-Game Ngữ Pháp">
          {grammarQuestions.length === 0 ? (
            <div className="dojo-empty">
              <Gamepad2 size={32} aria-hidden="true" />
              <h3>Cần ít nhất 2 mẫu ngữ pháp để luyện tập</h3>
              <p>Hãy chọn bài học khác có nhiều mẫu câu hơn để mở khóa Mini-Game.</p>
            </div>
          ) : !quizFinished && grammarQuestions[quizIndex] ? (
            (() => {
              const currentQ = grammarQuestions[quizIndex]
              if (!currentQ) return null
              return (
                <div className="dojo-quiz-stage">
                  <header className="dojo-hud">
                    <div className="dojo-hud__modes">
                      <span className="dojo-mode-btn is-active">
                        <Gamepad2 size={14} aria-hidden="true" />
                        <span>Phản Xạ Mẫu Câu</span>
                      </span>
                    </div>
                    <div className="dojo-hud__stats">
                      <span className="dojo-stat-pill">
                        Điểm <strong>{quizScore}</strong>
                      </span>
                      <span className={`dojo-stat-pill${quizCombo > 1 ? ' is-hot' : ''}`}>
                        <Flame size={13} aria-hidden="true" />
                        <span>x{quizCombo}</span>
                      </span>
                      <span className="dojo-stat-pill">
                        {quizIndex + 1} / {grammarQuestions.length}
                      </span>
                      <button type="button" className="dojo-reset-btn" onClick={resetGrammarQuiz} title="Chơi lại">
                        <RotateCcw size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </header>

                  <div className="dojo-quiz-card">
                    <div className="dojo-quiz-card__eyebrow">
                      <span>CHỌN Ý NGHĨA CỦA MẪU NGỮ PHÁP</span>
                      {currentQ.target.level && <Badge variant="primary">{currentQ.target.level}</Badge>}
                    </div>
                    <div
                      className="dojo-quiz-card__prompt"
                      style={{ fontSize: 'clamp(1.6rem, 3vw, 2.35rem)' }}
                      lang="ja"
                    >
                      <span>{currentQ.target.pattern}</span>
                    </div>
                    {currentQ.target.structure && (
                      <div className="dojo-quiz-card__reveal">
                        <span>✦ {currentQ.target.structure}</span>
                      </div>
                    )}
                  </div>

                  <div className="dojo-options-grid">
                    {currentQ.options.map((opt, idx) => {
                      const isSelected = quizSelectedId === opt.id
                      const isTarget = opt.id === currentQ.target.id
                      let stateClass = ''
                      if (quizSelectedId !== null) {
                        if (isTarget) stateClass = ' is-correct'
                        else if (isSelected) stateClass = ' is-wrong'
                        else stateClass = ' is-dim'
                      }
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={quizSelectedId !== null}
                          className={`dojo-option-btn${stateClass}`}
                          onClick={() => {
                            setQuizSelectedId(opt.id)
                            if (opt.id === currentQ.target.id) {
                              const nextCombo = quizCombo + 1
                              setQuizCombo(nextCombo)
                              setQuizCorrectCount((c) => c + 1)
                              setQuizScore((s) => s + 100 + Math.min(nextCombo - 1, 5) * 20)
                            } else {
                              setQuizCombo(0)
                            }
                          }}
                        >
                          <span className="dojo-option-btn__key">{idx + 1}</span>
                          <span className="dojo-option-btn__text">{opt.shortMeaning || opt.explanation}</span>
                        </button>
                      )
                    })}
                  </div>

                  {quizSelectedId !== null && (
                    <div className="dojo-feedback-bar" role="status">
                      <div className="dojo-feedback-bar__info">
                        <strong>
                          {quizSelectedId === currentQ.target.id
                            ? '✓ Chính xác!'
                            : `✕ Đáp án đúng: ${currentQ.target.shortMeaning || currentQ.target.explanation}`}
                        </strong>
                        {currentQ.target.examples?.[0] && (
                          <p>
                            <span lang="ja">{currentQ.target.examples[0].jp}</span>
                            {currentQ.target.examples[0].vi ? ` — ${currentQ.target.examples[0].vi}` : ''}
                          </p>
                        )}
                      </div>
                      <div className="dojo-feedback-bar__actions">
                        <button
                          type="button"
                          className={`dojo-srs-chip${isGrammarSaved(currentQ.target) ? ' is-saved' : ''}`}
                          onClick={() => void handleSaveToSrs(currentQ.target)}
                        >
                          {isGrammarSaved(currentQ.target) ? <Check size={14} /> : <BookmarkPlus size={14} />}
                          <span>{isGrammarSaved(currentQ.target) ? 'Đã lưu SRS' : '+ Lưu SRS'}</span>
                        </button>
                        <button
                          type="button"
                          className="dojo-next-btn"
                          onClick={() => {
                            if (quizIndex + 1 >= grammarQuestions.length) {
                              setQuizFinished(true)
                            } else {
                              setQuizIndex((i) => i + 1)
                              setQuizSelectedId(null)
                            }
                          }}
                        >
                          {quizIndex + 1 >= grammarQuestions.length ? 'Xem tổng kết →' : 'Câu tiếp theo →'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()
          ) : (
            <div className="dojo-summary">
              <div className="dojo-summary__seal" aria-hidden="true">
                文
              </div>
              <h3>Hoàn thành luyện tập ngữ pháp</h3>
              <p className="dojo-summary__subtitle">
                Bạn đạt{' '}
                <strong>
                  {quizCorrectCount} / {grammarQuestions.length}
                </strong>{' '}
                câu đúng · Tổng điểm <strong>{quizScore}</strong>
              </p>
              <button type="button" className="dojo-next-btn" onClick={resetGrammarQuiz}>
                <RotateCcw size={15} aria-hidden="true" />
                <span>Chơi ván mới</span>
              </button>
            </div>
          )}
        </section>
      ) : (
        /* 3.3 LAYER 1: IN-LESSON FLASHCARD FOR GRAMMAR */
        currentCard && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div
              role="button"
              tabIndex={0}
              aria-label="Lật thẻ ngữ pháp"
              aria-expanded={isFlipped}
              className={`bunpo-flashcard washi-manuscript-card${!isFlipped ? ' washi-genko-bg' : ''}`}
              onKeyDown={(event) => {
                if (event.target === event.currentTarget && event.key === 'Enter') {
                  event.preventDefault()
                  setIsFlipped((f) => !f)
                }
              }}
              onClick={() => setIsFlipped((f) => !f)}
            >
              {/* Top Bar */}
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Badge variant="primary">{currentCard.level}</Badge>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="washi-audio-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      const firstAudio = currentCard.examples?.find((ex) => ex.audio)?.audio
                      playAudio(firstAudio, currentCard.pattern)
                    }}
                    title="Nghe phát âm"
                  >
                    <Volume2 size={18} />
                  </button>
                  <button
                    type="button"
                    className={`washi-srs-btn${isGrammarSaved(currentCard) ? ' is-saved' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleSaveToSrs(currentCard)
                    }}
                    title="Lưu vào sổ tay ôn tập"
                  >
                    {isGrammarSaved(currentCard) ? '✓ Đã vào SRS' : '+ Thêm SRS (C)'}
                  </button>
                </div>
              </div>

              {/* Center Content */}
              <div style={{ margin: 'auto 0', width: '100%' }}>
                {!isFlipped ? (
                  // FRONT SIDE
                  <div>
                    <div className="bunpo-flashcard__pattern">{currentCard.pattern}</div>
                    {currentCard.structure && (
                      <div className="bunpo-flashcard__structure">✦ Cấu trúc: {currentCard.structure}</div>
                    )}

                    {currentCard.groups && currentCard.groups.length > 1 && (
                      <div style={{ marginTop: '0.65rem' }}>
                        <span className="bunpo-multi-pill">Gồm {currentCard.groups.length} nghĩa & cách dùng</span>
                      </div>
                    )}

                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginTop: '0.9rem' }}>
                      Nhấn [Space] hoặc chạm để lật xem ý nghĩa & 1 ví dụ mỗi nghĩa
                    </div>
                  </div>
                ) : (
                  // BACK SIDE
                  <div style={{ width: '100%' }}>
                    <div className="bunpo-flashcard__pattern--back">{currentCard.pattern}</div>

                    {currentCard.groups && currentCard.groups.length > 1 ? (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem',
                          maxHeight: '400px',
                          overflowY: 'auto',
                          paddingRight: '4px',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.2rem' }}>
                          <span className="bunpo-multi-pill">
                            Mẫu ngữ pháp có {currentCard.groups.length} nghĩa & cách dùng
                          </span>
                        </div>

                        {currentCard.groups.map((group, gIdx) => {
                          const firstEx = group.examples && group.examples[0]
                          return (
                            <div key={gIdx} className="bunpo-group-card">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span className="bunpo-group-badge">Nghĩa {group.group_no || gIdx + 1}</span>
                                <span style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-success)' }}>
                                  {group.meaning || group.usage || ''}
                                </span>
                              </div>

                              {group.structure && (
                                <div
                                  style={{
                                    fontFamily: 'var(--font-jp-serif)',
                                    fontSize: '0.88rem',
                                    color: 'var(--color-accent-text)',
                                    fontWeight: 600,
                                  }}
                                >
                                  ✦ {group.structure}
                                </div>
                              )}

                              {group.usage && group.usage !== group.meaning && (
                                <div
                                  style={{
                                    fontSize: '0.84rem',
                                    color: 'var(--color-text-secondary)',
                                    lineHeight: 1.4,
                                  }}
                                >
                                  ◎ {group.usage}
                                </div>
                              )}

                              {/* Exactly 1 Example per sub-meaning with clean Furigana Ruby & Audio */}
                              {firstEx && (
                                <div
                                  className="bunpo-example-box"
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                  }}
                                >
                                  <div style={{ flex: 1 }}>
                                    <div
                                      style={{
                                        fontFamily: 'var(--font-jp)',
                                        fontSize: '0.98rem',
                                        color: 'var(--color-text)',
                                        lineHeight: 1.6,
                                      }}
                                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(firstEx.jp_ruby || firstEx.jp) }}
                                    />
                                    {firstEx.vi && (
                                      <div
                                        style={{
                                          color: 'var(--color-text-secondary)',
                                          fontSize: '0.84rem',
                                          marginTop: '3px',
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
                                      playAudio(firstEx.audio, firstEx.jp)
                                    }}
                                    title="Nghe đọc câu ví dụ"
                                  >
                                    <Volume2 size={16} />
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      // Single Group Case
                      <div>
                        <div
                          style={{
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            color: 'var(--color-success)',
                            marginTop: '0.5rem',
                          }}
                        >
                          {currentCard.shortMeaning || currentCard.explanation}
                        </div>

                        {currentCard.structure && (
                          <div className="bunpo-flashcard__structure" style={{ fontSize: '0.96rem' }}>
                            ✦ Cấu trúc: {currentCard.structure}
                          </div>
                        )}

                        {currentCard.explanation && currentCard.explanation !== currentCard.shortMeaning && (
                          <div
                            style={{
                              fontSize: '0.9rem',
                              color: 'var(--color-text-secondary)',
                              marginTop: '0.5rem',
                              lineHeight: 1.45,
                            }}
                          >
                            {currentCard.explanation}
                          </div>
                        )}

                        {(() => {
                          const firstEx = currentCard.examples?.[0]
                          if (!firstEx) return null
                          return (
                            <div
                              className="bunpo-example-box"
                              style={{
                                marginTop: '1rem',
                                textAlign: 'left',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '0.75rem',
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <div
                                  style={{
                                    fontFamily: 'var(--font-jp)',
                                    fontSize: '1.02rem',
                                    color: 'var(--color-text)',
                                    lineHeight: 1.6,
                                  }}
                                  dangerouslySetInnerHTML={{
                                    __html: sanitizeHtml(firstEx.jp_ruby || firstEx.jp),
                                  }}
                                />
                                {firstEx.vi && (
                                  <div
                                    style={{
                                      color: 'var(--color-text-secondary)',
                                      fontSize: '0.88rem',
                                      marginTop: '4px',
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
                                  playAudio(firstEx.audio, firstEx.jp)
                                }}
                                title="Nghe đọc câu ví dụ"
                              >
                                <Volume2 size={16} />
                              </button>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Bar */}
              <div className="bunpo-flashcard__footer">
                <span>Phím tắt: Space (Lật) · Z (Đã biết) · X (Chưa biết) · R (Phát âm) · C (Thêm SRS)</span>
                <span style={{ fontWeight: 700 }}>
                  {currentIndex + 1} / {grammars.length}
                </span>
              </div>
            </div>

            {/* Flashcard Buttons */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '1rem',
                marginTop: '1.25rem',
              }}
            >
              <Button
                variant="secondary"
                size="lg"
                onClick={handlePrevCard}
                disabled={currentIndex === 0}
                style={{ minWidth: '120px' }}
              >
                <ChevronLeft size={18} /> Trước
              </Button>

              <Button
                variant="danger"
                size="lg"
                onClick={() => handleNextCard()}
                style={{ minWidth: '130px', fontWeight: 700 }}
              >
                Chưa biết (X)
              </Button>

              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  setKnownGrammars((prev) => [...new Set([...prev, currentCard.id])])
                  handleNextCard()
                }}
                style={{
                  minWidth: '130px',
                  fontWeight: 700,
                  background: 'var(--color-accent)',
                  borderColor: 'var(--color-accent)',
                }}
              >
                ✓ Đã biết (Z)
              </Button>

              <Button
                variant="secondary"
                size="lg"
                onClick={handleNextCard}
                disabled={currentIndex === grammars.length - 1}
                style={{ minWidth: '120px' }}
              >
                Sau <ChevronRight size={18} />
              </Button>
            </div>
          </div>
        )
      )}

      {/* GAME & MODE DOCK DIRECTLY BELOW GRAMMAR STAGE */}
      <div className="lesson-game-dock lesson-game-dock--two" role="tablist" aria-label="Chế độ học ngữ pháp">
        <button
          type="button"
          role="tab"
          aria-selected={stageMode === 'flashcard'}
          className={`lesson-dock-card${stageMode === 'flashcard' ? ' is-active' : ''}`}
          onClick={() => setStageMode('flashcard')}
        >
          <span className="lesson-dock-card__seal" aria-hidden="true">
            文
          </span>
          <span className="lesson-dock-card__text">
            <strong>Thẻ Ngữ Pháp</strong>
            <small>Lật xem nghĩa &amp; ví dụ</small>
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={stageMode === 'game'}
          className={`lesson-dock-card${stageMode === 'game' ? ' is-active' : ''}`}
          onClick={() => {
            setStageMode('game')
            resetGrammarQuiz()
          }}
        >
          <span className="lesson-dock-card__seal" aria-hidden="true">
            速
          </span>
          <span className="lesson-dock-card__text">
            <strong>Phản Xạ Mẫu Câu</strong>
            <small>Trắc nghiệm 4 chọn 1</small>
          </span>
        </button>
      </div>

      {selectedPoint && !showFullListWhenDeepLinked && grammars.length > 1 ? (
        <div className="lesson-vocab-section" style={{ textAlign: 'center' }}>
          <Button variant="secondary" size="sm" onClick={() => setShowFullListWhenDeepLinked(true)}>
            <BookOpen size={15} /> Xem toàn bộ danh sách bài học ({grammars.length})
          </Button>
        </div>
      ) : (
        <>
          <label className="bunpo-mobile-toc">
            Chuyển tới mẫu ngữ pháp
            <select
              className="ui-select"
              value={activePointId ?? ''}
              onChange={(event) => {
                setActivePointId(event.target.value)
                document.getElementById(`grammar-point-${event.target.value}`)?.scrollIntoView({ block: 'start' })
              }}
            >
              <option value="">Chọn mẫu trong bài</option>
              {grammars.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.pattern}
                </option>
              ))}
            </select>
          </label>
          <section className="lesson-vocab-section" aria-label="Danh sách mẫu ngữ pháp trong bài">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-display), var(--font-jp-serif)',
                  fontSize: '1.3rem',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                }}
              >
                Danh sách mẫu ngữ pháp trong bài ({grammars.length})
              </h3>

              <div style={{ position: 'relative', width: '280px' }}>
                <Search
                  size={15}
                  style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--color-text-muted)' }}
                />
                <input
                  type="text"
                  className="bunpo-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Lọc mẫu câu trong bài..."
                />
              </div>
            </div>

            {/* 2-Column Responsive Layout: Grammar Cards + Sticky Sidebar TOC */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 260px',
                gap: '1.5rem',
                alignItems: 'start',
              }}
              className="bunpo-lesson-grid"
            >
              {/* Column 1: Spacious Grammar Cards */}
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {grammars.map((item, index) => {
                  const isSaved = isGrammarSaved(item)
                  const hasMultipleGroups = Boolean(item.groups && item.groups.length > 1)
                  const isSelected = activePointId === item.id

                  return (
                    <div
                      id={`grammar-point-${item.id}`}
                      key={item.id}
                      className={`bunpo-point-card${isSelected ? ' is-selected' : ''}`}
                    >
                      {/* Header: Pattern & Level & SRS Button */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '0.75rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.85rem',
                              color: 'var(--color-text-muted)',
                              fontWeight: 700,
                            }}
                          >
                            {index + 1}.
                          </span>
                          <h3 className="bunpo-point-card__pattern">{item.pattern}</h3>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                          <Badge variant="primary">{item.level}</Badge>
                          <button
                            type="button"
                            className={`washi-srs-btn${isSaved ? ' is-saved' : ''}`}
                            onClick={() => handleSaveToSrs(item)}
                          >
                            {isSaved ? (
                              <>
                                <Check size={14} /> Đã vào SRS
                              </>
                            ) : (
                              <>
                                <BookmarkPlus size={14} /> +SRS
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Multi-Group Rendering if multiple usages */}
                      {hasMultipleGroups && item.groups ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                          <div>
                            <span className="bunpo-multi-pill">
                              Bao gồm {item.groups.length} nhóm nghĩa & cách dùng:
                            </span>
                          </div>

                          {item.groups.map((group, gIdx) => (
                            <div key={gIdx} className="bunpo-group-card">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span className="bunpo-group-badge">Nghĩa {group.group_no || gIdx + 1}</span>
                                <span style={{ fontSize: '1.02rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                  {group.meaning || group.usage || ''}
                                </span>
                              </div>

                              {group.structure && (
                                <div className="bunpo-structure-box">✦ Cấu trúc: {group.structure}</div>
                              )}

                              {group.usage && group.usage !== group.meaning && (
                                <div
                                  style={{
                                    fontSize: '0.88rem',
                                    color: 'var(--color-text-secondary)',
                                    lineHeight: 1.45,
                                  }}
                                >
                                  ◎ Giải thích: {group.usage}
                                </div>
                              )}

                              {/* Examples in group */}
                              {group.examples && group.examples.length > 0 && (
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.45rem',
                                    marginTop: '0.2rem',
                                  }}
                                >
                                  <div
                                    style={{
                                      fontFamily: 'var(--font-mono)',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      color: 'var(--color-text-muted)',
                                      letterSpacing: '0.06em',
                                    }}
                                  >
                                    VÍ DỤ (Nghĩa {group.group_no || gIdx + 1}):
                                  </div>
                                  {group.examples.map((ex, exIdx) => (
                                    <div key={exIdx} className="bunpo-example-box">
                                      <div
                                        style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          gap: '0.75rem',
                                        }}
                                      >
                                        <div
                                          style={{
                                            fontFamily: 'var(--font-jp)',
                                            fontSize: '1rem',
                                            fontWeight: 500,
                                            color: 'var(--color-text)',
                                            lineHeight: 1.6,
                                          }}
                                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(ex.jp_ruby || ex.jp) }}
                                        />
                                        <button
                                          type="button"
                                          className={`washi-audio-btn${playingAudioUrl === ex.audio ? ' is-playing' : ''}`}
                                          onClick={() => playAudio(ex.audio, ex.jp)}
                                          title="Nghe phát âm"
                                        >
                                          <Volume2 size={15} />
                                        </button>
                                      </div>
                                      {ex.vi && (
                                        <div
                                          style={{
                                            fontSize: '0.85rem',
                                            color: 'var(--color-text-secondary)',
                                            marginTop: '3px',
                                          }}
                                        >
                                          {ex.vi}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        /* Single Meaning Rendering */
                        <>
                          {/* Meaning */}
                          <div className="bunpo-meaning-box">
                            <div
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                letterSpacing: '0.06em',
                                color: 'var(--color-accent-text)',
                                textTransform: 'uppercase',
                              }}
                            >
                              Ý NGHĨA:
                            </div>
                            <div
                              style={{
                                fontSize: '1.05rem',
                                fontWeight: 700,
                                color: 'var(--color-text)',
                                marginTop: '2px',
                              }}
                            >
                              {item.shortMeaning || item.explanation}
                            </div>
                          </div>

                          {/* Structure */}
                          {item.structure && (
                            <div>
                              <div
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  letterSpacing: '0.06em',
                                  color: 'var(--color-text-muted)',
                                  textTransform: 'uppercase',
                                }}
                              >
                                CẤU TRÚC:
                              </div>
                              <div className="bunpo-structure-box">{item.structure}</div>
                            </div>
                          )}

                          {/* Examples list */}
                          {item.examples && item.examples.length > 0 && (
                            <div
                              style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}
                            >
                              <div
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  letterSpacing: '0.06em',
                                  color: 'var(--color-text-muted)',
                                  textTransform: 'uppercase',
                                }}
                              >
                                VÍ DỤ MẪU ({item.examples.length}):
                              </div>
                              {item.examples.map((ex, exIdx) => (
                                <div key={exIdx} className="bunpo-example-box">
                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      gap: '0.75rem',
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontFamily: 'var(--font-jp)',
                                        fontSize: '1rem',
                                        fontWeight: 500,
                                        color: 'var(--color-text)',
                                        lineHeight: 1.6,
                                      }}
                                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(ex.jp_ruby || ex.jp) }}
                                    />
                                    <button
                                      type="button"
                                      className={`washi-audio-btn${playingAudioUrl === ex.audio ? ' is-playing' : ''}`}
                                      onClick={() => playAudio(ex.audio, ex.jp)}
                                      title="Nghe phát âm"
                                    >
                                      <Volume2 size={15} />
                                    </button>
                                  </div>
                                  {ex.vi && (
                                    <div
                                      style={{
                                        fontSize: '0.85rem',
                                        color: 'var(--color-text-secondary)',
                                        marginTop: '3px',
                                      }}
                                    >
                                      {ex.vi}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}

                      {/* Notes / Usage */}
                      {item.notes && (
                        <div className="bunpo-note-box">
                          <b style={{ color: 'var(--color-danger-text)' }}>⚠ Chú ý / Lưu ý:</b>
                          <div style={{ marginTop: '2px' }}>{item.notes}</div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Column 2: Sticky Table of Contents (Mục lục bài học) */}
              <aside className="bunpo-toc">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--color-border)',
                    paddingBottom: '0.6rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ListTree size={16} style={{ color: 'var(--color-accent-text)' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--color-text)' }}>
                      Mục Lục Bài
                    </span>
                  </div>
                  <span className="bunpo-toc__count">{grammars.length} mẫu</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {grammars.map((item, idx) => {
                    const isSaved = isGrammarSaved(item)
                    const isItemActive = activePointId === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`bunpo-toc__item${isItemActive ? ' is-active' : ''}`}
                        onClick={() => {
                          setActivePointId(item.id)
                          const el = document.getElementById(`grammar-point-${item.id}`)
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          }
                        }}
                        title={item.shortMeaning || item.pattern}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: '6px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.72rem',
                              color: isItemActive ? 'var(--color-accent-text)' : 'var(--color-text-muted)',
                              fontWeight: 700,
                              minWidth: '18px',
                            }}
                          >
                            {idx + 1}.
                          </span>
                          <span
                            style={{
                              fontFamily: 'var(--font-jp-serif)',
                              fontWeight: 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.pattern}
                          </span>
                        </div>
                        {isSaved && (
                          <span
                            title="Đã lưu vào SRS"
                            style={{ color: 'var(--color-accent-text)', display: 'inline-flex', flexShrink: 0 }}
                          >
                            <Check size={13} />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </aside>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default BunpoPage
