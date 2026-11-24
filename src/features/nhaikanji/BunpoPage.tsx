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
  Layers,
  ListTree,
  RotateCcw,
  Search,
  Volume2,
} from 'lucide-react'
import { Badge, Button, EmptyState } from '../../components/ui'
import { srsApi } from '../srs/srsApi'
import type { CurriculumGrammar } from '../srs/srsTypes'
import { useAuth } from '../auth/authContext'
import { WatojiBookCover } from '../vocabulary/WatojiBookCover'
import { StudyInkAtmosphere } from '../vocabulary/StudyInkAtmosphere'
import { playWashiPaperSound } from '../vocabulary/tactileAudio'
import { playPaperFlip, playSoftMiss, playStampSuccess } from '../vocabulary/soundEngine'
import { sumiAudio } from '../dictionary/sumiAudio'

const GRAMMAR_CATALOG = [
  {
    id: 'minna_n5',
    title: 'Minna no Nihongo I (みんなの日本語 初級 I)',
    subtitle: 'Minna no Nihongo N5',
    level: 'N5',
    series: 'minna',
    track: 'foundation',
    publisher: '3A Network',
    kanjiTitle: '初級文法',
    volumeTag: '壱',
    sealChar: '礎',
    palette: 'aizumi',
    pattern: 'seigaiha',
    variant: 'classic',
    isFeatured: false,
    description: 'Nền tảng ngữ pháp sơ cấp chuẩn mực từ Bài 1 đến Bài 25 — gắn liền mẫu câu hội thoại đời sống.',
  },
  {
    id: 'minna_n4',
    title: 'Minna no Nihongo II (みんなの日本語 初級 II)',
    subtitle: 'Minna no Nihongo N4',
    level: 'N4',
    series: 'minna',
    track: 'foundation',
    publisher: '3A Network',
    kanjiTitle: '初級文法',
    volumeTag: '弐',
    sealChar: '進',
    palette: 'kon',
    pattern: 'shippo',
    variant: 'classic',
    isFeatured: false,
    description: 'Hoàn thiện tôn kính ngữ, khiêm nhường ngữ, thể sai khiến và bị động từ Bài 26 đến Bài 50.',
  },
  {
    id: 'shinkanzen_n3',
    title: 'Shinkanzen Master N3 (新完全マスター)',
    subtitle: 'Shinkanzen Master N3',
    level: 'N3',
    series: 'shinkanzen',
    track: 'mastery',
    publisher: '3A Corporation',
    kanjiTitle: '完全文法',
    volumeTag: '参',
    sealChar: '文',
    palette: 'shuiro',
    pattern: 'asanoha',
    variant: 'classic',
    isFeatured: true,
    description:
      'Phân tích chuyên sâu sắc thái ngữ nghĩa, cấu trúc nối câu và các bẫy ngữ pháp trọng tâm kỳ thi JLPT N3.',
  },
  {
    id: 'mimikara_n3',
    title: 'Mimikara Oboeru N3 (耳から覚える文法)',
    subtitle: 'Mimikara Oboeru N3',
    level: 'N3',
    series: 'mimikara',
    track: 'mastery',
    publisher: 'Alc Press',
    kanjiTitle: '耳覚文法',
    volumeTag: '音',
    sealChar: '聴',
    palette: 'matsuba-n3',
    pattern: 'soundwave',
    variant: 'mimikara',
    isFeatured: false,
    description: 'Thấm ngữ pháp qua thính giác và ngữ cảnh câu trọn vẹn — tách bạch rõ từng nhóm nghĩa đa dụng.',
  },
  {
    id: 'shinkanzen_n2',
    title: 'Shinkanzen Master N2 (新完全マスター)',
    subtitle: 'Shinkanzen Master N2',
    level: 'N2',
    series: 'shinkanzen',
    track: 'mastery',
    publisher: '3A Corporation',
    kanjiTitle: '完全文法',
    volumeTag: '弐',
    sealChar: '極',
    palette: 'benigara',
    pattern: 'kumiko',
    variant: 'classic',
    isFeatured: false,
    description:
      'Làm chủ hơn 150 cấu trúc trung – thượng cấp, văn phong trang trọng và liên kết mạch văn học thuật N2.',
  },
  {
    id: 'shinkanzen_n1',
    title: 'Shinkanzen Master N1 (新完全マスター)',
    subtitle: 'Shinkanzen Master N1',
    level: 'N1',
    series: 'shinkanzen',
    track: 'mastery',
    publisher: '3A Corporation',
    kanjiTitle: '完全文法',
    volumeTag: '壱',
    sealChar: '頂',
    palette: 'kokutan',
    pattern: 'kasumi',
    variant: 'classic',
    isFeatured: false,
    description:
      'Đỉnh cao ngữ pháp biểu đạt cổ điển, văn viết nghị luận và các cấu trúc sắc thái tinh tế bậc nhất JLPT N1.',
  },
] as const

type GrammarBookEntry = (typeof GRAMMAR_CATALOG)[number]

const GRAMMAR_TRACKS = [
  {
    id: 'mastery',
    kanji: '突破',
    title: 'Dòng Chuyên Sâu & Luyện Thi JLPT',
    description: 'Hệ thống cấu trúc N3–N1 từ Shinkanzen Master & Mimikara, bóc tách sắc thái và bẫy đề thi.',
  },
  {
    id: 'foundation',
    kanji: '基盤',
    title: 'Dòng Nền Tảng Sơ Cấp',
    description: 'Xây dựng khung ngữ pháp căn bản N5–N4 vững chắc theo lộ trình Minna no Nihongo I & II.',
  },
] as const

function readKnownGrammarIds(storageKey: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function readKnownGrammarByBook(userId: string): Record<string, number> {
  const counts: Record<string, number> = {}
  if (typeof window === 'undefined') return counts
  const prefix = `kotodama.known-grammar:${userId}:`
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key || !key.startsWith(prefix)) continue
      const rest = key.slice(prefix.length)
      const colonIdx = rest.indexOf(':')
      if (colonIdx <= 0) continue
      const bookId = rest.slice(0, colonIdx)
      const count = readKnownGrammarIds(key).length
      if (count > 0) counts[bookId] = (counts[bookId] || 0) + count
    }
  } catch {
    // ignore storage errors
  }
  return counts
}

function formatGrammarLessonIndex(lessonTitle: string, idx: number): string {
  const numMatch = lessonTitle.match(/(?:Bài|第)\s*(\d+)|^(\d+)\s*課/i)
  const num = numMatch?.[1] || numMatch?.[2] || String(idx + 1)
  return `第${num.padStart(2, '0')}課`
}

const GRAMMAR_LEVEL_FILTERS = ['ALL', 'N5', 'N4', 'N3', 'N2', 'N1'] as const
const GRAMMAR_BOOK_FILTERS = [
  { id: 'ALL', label: 'Tất cả sách' },
  { id: 'minna', label: 'Minna no Nihongo' },
  { id: 'mimikara', label: 'Mimi Kara Oboeru' },
  { id: 'shinkanzen', label: 'Shinkanzen Master' },
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
  const [stampBurstCount, setStampBurstCount] = useState(0)
  const [flipRippleCount, setFlipRippleCount] = useState(0)
  const [showStampFlash, setShowStampFlash] = useState(false)
  const stampTimerRef = useRef<number | null>(null)
  const [, setKnownGrammars] = usePersistentState<string[]>(
    `kotodama.known-grammar:${user?.id ?? 'guest'}:${selectedBook}:${selectedLesson}`,
    []
  )
  const [savedSrs, setSavedSrs] = useState<Record<string, boolean>>({})
  const [activePointId, setActivePointId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    return () => {
      if (stampTimerRef.current) window.clearTimeout(stampTimerRef.current)
    }
  }, [])
  const catalogQueries = useQueries({
    queries: GRAMMAR_CATALOG.map((book) => ({
      queryKey: ['curriculum', 'lessons', book.id],
      queryFn: () => srsApi.fetchLessons(book.id),
      enabled: !selectedBook,
      staleTime: 60_000,
    })),
  })
  const getBookStats = (bookId: string) => {
    const query = catalogQueries[GRAMMAR_CATALOG.findIndex((book) => book.id === bookId)]
    if (!query?.data || !query.data.length) return { lessons: 0, patterns: 0, loaded: Boolean(query?.data) }
    return {
      lessons: query.data.length,
      patterns: query.data.reduce((total, lesson) => total + lesson.count, 0),
      loaded: true,
    }
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
  const [selectedGrammarLevel, setSelectedGrammarLevel] = useState<string>('ALL')
  const [selectedGrammarSeries, setSelectedGrammarSeries] = useState<string>('ALL')
  const [catalogPatternQuery, setCatalogPatternQuery] = useState('')
  const debouncedCatalogPatternQuery = useDebouncedValue(catalogPatternQuery.trim(), 220)
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const { data: catalogPatternSearchData } = useQuery({
    queryKey: [
      'curriculum',
      'grammar-catalog-search',
      selectedGrammarLevel,
      selectedGrammarSeries,
      debouncedCatalogPatternQuery,
    ],
    queryFn: () =>
      srsApi.fetchCurriculumGrammar({
        level: selectedGrammarLevel,
        query: debouncedCatalogPatternQuery,
        page: 1,
        limit: 24,
      }),
    enabled: !selectedBook && debouncedCatalogPatternQuery.length > 0,
    staleTime: 30_000,
  })

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
  // VIEW 1: CATALOG OVERVIEW (Tủ sách Ngữ Pháp chuẩn Watoji)
  // =========================================================================
  if (!selectedBook) {
    const knownByBook = readKnownGrammarByBook(user?.id ?? 'guest')
    const savedGrammarCount = Array.isArray(savedTermsData)
      ? savedTermsData.filter((t) => t?.type === 'grammar').length
      : Object.keys(savedSrs).length

    const matchingPatternItems = (catalogPatternSearchData?.items ?? []).filter((item) => {
      if (selectedGrammarSeries === 'ALL') return true
      const code = (item.curriculumCode || '').toLowerCase()
      return code.includes(selectedGrammarSeries)
    })

    const filteredCatalog = GRAMMAR_CATALOG.filter((b) => {
      if (selectedGrammarLevel !== 'ALL' && b.level !== selectedGrammarLevel) return false
      if (selectedGrammarSeries !== 'ALL' && b.series !== selectedGrammarSeries) return false
      if (catalogPatternQuery.trim()) {
        const q = catalogPatternQuery.trim().toLowerCase()
        return (
          b.title.toLowerCase().includes(q) ||
          b.subtitle.toLowerCase().includes(q) ||
          b.level.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q)
        )
      }
      return true
    })

    const activeTracks = GRAMMAR_TRACKS.map((track) => ({
      ...track,
      books: filteredCatalog.filter((b) => b.track === track.id),
    })).filter((track) => track.books.length > 0)

    const renderGrammarStatsText = (book: GrammarBookEntry) => {
      const stats = getBookStats(book.id)
      if (!stats.loaded) return 'Đang tải mục lục…'
      if (stats.lessons === 0) return 'Chưa có nội dung'
      return `${stats.lessons} bài · ${stats.patterns} mẫu`
    }

    const renderBookProgress = (book: GrammarBookEntry) => {
      const stats = getBookStats(book.id)
      const known = knownByBook[book.id] || 0
      if (!stats.loaded || stats.patterns === 0 || known <= 0) return null
      const pct = Math.min(100, Math.max(4, Math.round((known / stats.patterns) * 100)))
      return { known: Math.min(known, stats.patterns), total: stats.patterns, pct }
    }

    return (
      <div className="curriculum-container">
        <div className="curriculum-paper-grid">
          <header className="curriculum-masthead">
            <div className="curriculum-masthead__copy">
              <h1 className="curriculum-masthead__title">
                Kho Giáo Trình Ngữ Pháp <span className="sr-only">(Shinkanzen Master &amp; Mimikara)</span>
              </h1>
              <p className="curriculum-masthead__sub">
                Tuyển tập giáo trình ngữ pháp chuẩn JLPT N5–N1 — phân tích sắc thái, cấu trúc nối câu và ví dụ ngữ cảnh.
              </p>
            </div>
            {onGoToSrs && (
              <button
                type="button"
                className="curriculum-hanko-srs-pill"
                onClick={onGoToSrs}
                title="Mở sổ tay và kho ôn tập SRS"
                aria-label={`Sổ tay SRS: ${savedGrammarCount} mẫu ngữ pháp đã lưu. Nhấn để ôn tập.`}
              >
                <span className="curriculum-hanko-srs-pill__stamp" aria-hidden="true">
                  記
                </span>
                <span className="curriculum-hanko-srs-pill__text">
                  Sổ tay SRS: <strong>{savedGrammarCount}</strong> mẫu
                </span>
                <span className="curriculum-hanko-srs-pill__action">Ôn tập ›</span>
              </button>
            )}
          </header>

          <div className="curriculum-toolbar">
            <div className="curriculum-toolbar__left">
              <div className="curriculum-level-filters" role="tablist" aria-label="Lọc ngữ pháp theo cấp độ">
                {GRAMMAR_LEVEL_FILTERS.map((lvl) => {
                  const isActive = selectedGrammarLevel === lvl
                  return (
                    <button
                      key={lvl}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`curriculum-filter-pill${isActive ? ' curriculum-filter-pill--active' : ''}`}
                      onClick={() => setSelectedGrammarLevel(lvl)}
                    >
                      {lvl === 'ALL' ? 'Tất cả' : lvl}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="curriculum-toolbar__actions">
              <div className="curriculum-search-box">
                <Search size={15} className="curriculum-search-box__icon" aria-hidden="true" />
                <input
                  type="search"
                  className="curriculum-search-box__input"
                  placeholder="Tìm mẫu ngữ pháp hoặc tên sách..."
                  value={catalogPatternQuery}
                  onChange={(e) => setCatalogPatternQuery(e.target.value)}
                  aria-label="Tìm mẫu ngữ pháp"
                />
              </div>
            </div>
          </div>

          <div className="curriculum-series-bar" role="tablist" aria-label="Lọc ngữ pháp theo cuốn sách">
            <span className="curriculum-series-bar__label">Cuốn sách:</span>
            <div className="curriculum-series-bar__list">
              {GRAMMAR_BOOK_FILTERS.map((book) => {
                const isActive = selectedGrammarSeries === book.id
                return (
                  <button
                    key={book.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`curriculum-series-btn${isActive ? ' is-active' : ''}`}
                    onClick={() => setSelectedGrammarSeries(book.id)}
                  >
                    {book.label}
                  </button>
                )
              })}
            </div>
          </div>

          {debouncedCatalogPatternQuery && matchingPatternItems.length > 0 && (
            <section className="curriculum-track-section" aria-label="Mẫu ngữ pháp phù hợp">
              <div className="curriculum-track-header">
                <div className="curriculum-track-header__meta">
                  <span className="curriculum-track-stamp" aria-hidden="true">
                    検
                  </span>
                  <h2 className="curriculum-track-title">Mẫu ngữ pháp khớp “{debouncedCatalogPatternQuery}”</h2>
                  <span className="curriculum-track-count">({matchingPatternItems.length} kết quả)</span>
                </div>
              </div>
              <div className="bunpo-pattern-hit-list">
                {matchingPatternItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="bunpo-pattern-hit"
                    onClick={() => {
                      setSelectedBook(item.curriculumCode || 'shinkanzen_n3')
                      setSelectedLesson(item.lessonId || '1')
                    }}
                  >
                    <div className="bunpo-pattern-hit__main">
                      <span className="bunpo-pattern-hit__meta">
                        {item.level} · {item.lessonTitle}
                      </span>
                      <strong className="bunpo-pattern-hit__pattern" lang="ja">
                        {item.pattern}
                      </strong>
                      <span className="bunpo-pattern-hit__meaning">{item.shortMeaning || item.structure}</span>
                    </div>
                    <ChevronRight size={16} className="bunpo-pattern-hit__arrow" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeTracks.length === 0 && !debouncedCatalogPatternQuery ? (
            <EmptyState title="Không có giáo trình phù hợp" description="Thử chọn lại cấp độ JLPT hoặc bộ sách khác." />
          ) : (
            activeTracks.map((track) => {
              const showFeatured = track.books.length === 1 || track.books.length >= 3
              const featuredBook = showFeatured ? (track.books.find((b) => b.isFeatured) ?? track.books[0]) : undefined
              const shelfBooks = featuredBook ? track.books.filter((b) => b.id !== featuredBook.id) : track.books

              return (
                <section
                  key={track.id}
                  className="curriculum-track-section"
                  aria-labelledby={`heading-bunpo-${track.id}`}
                >
                  <div className="curriculum-track-header">
                    <div className="curriculum-track-header__meta">
                      <span className="curriculum-track-stamp" aria-hidden="true">
                        {track.kanji}
                      </span>
                      <h2 id={`heading-bunpo-${track.id}`} className="curriculum-track-title">
                        {track.title}
                      </h2>
                      <span className="curriculum-track-count">({track.books.length} giáo trình)</span>
                    </div>
                    <p className="curriculum-track-desc">{track.description}</p>
                  </div>

                  {featuredBook &&
                    (() => {
                      const progress = renderBookProgress(featuredBook)
                      return (
                        <article
                          className={`curriculum-featured-spread${shelfBooks.length > 0 ? ' has-companion-below' : ''}`}
                          tabIndex={0}
                          role="button"
                          aria-label={`Giáo trình ${featuredBook.title}, ${featuredBook.level}`}
                          onClick={() => setSelectedBook(featuredBook.id)}
                          onMouseEnter={() => playWashiPaperSound()}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setSelectedBook(featuredBook.id)
                            }
                          }}
                        >
                          <div className="curriculum-featured-spread__cover-pane">
                            <div className="curriculum-featured-spread__cover-stack">
                              <WatojiBookCover
                                bookTitle={featuredBook.title}
                                size="featured"
                                variant={featuredBook.variant}
                                kanjiTitle={featuredBook.kanjiTitle}
                                subtitle={featuredBook.publisher}
                                volumeTag={featuredBook.volumeTag}
                                level={featuredBook.level}
                                palette={featuredBook.palette}
                                pattern={featuredBook.pattern}
                                sealChar={featuredBook.sealChar}
                              />
                              {progress && (
                                <div className="curriculum-book-progress-bar" aria-hidden="true">
                                  <span style={{ width: `${progress.pct}%` }} />
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="curriculum-featured-spread__content-pane">
                            <div className="curriculum-featured-spread__eyebrow-row">
                              <span className="curriculum-featured-spread__publisher">{featuredBook.subtitle}</span>
                            </div>

                            <h3 className="curriculum-featured-spread__title">{featuredBook.title}</h3>
                            <p className="curriculum-featured-spread__desc">{featuredBook.description}</p>

                            <div className="curriculum-featured-spread__footer">
                              <div className="curriculum-featured-spread__stats">
                                <span className="curriculum-featured-spread__stat-item">
                                  {renderGrammarStatsText(featuredBook)}
                                </span>
                                {progress && (
                                  <span className="curriculum-featured-spread__progress-text">
                                    · Đã thuộc {progress.known} / {progress.total} mẫu
                                  </span>
                                )}
                              </div>

                              <span className="curriculum-featured-spread__cta">Mở sách học tập →</span>
                            </div>
                          </div>
                        </article>
                      )
                    })()}

                  {shelfBooks.length > 0 && (
                    <div className="curriculum-standing-shelf-wrap">
                      {featuredBook && (
                        <div className="curriculum-horizontal-shelf-header">
                          <div className="curriculum-horizontal-shelf-header__left">
                            <span className="curriculum-companion-shelf__label">KỆ SÁCH ĐỒNG HÀNH · 同行書架</span>
                            <span className="curriculum-companion-shelf__count">({shelfBooks.length} đầu sách)</span>
                          </div>
                        </div>
                      )}

                      <div className="curriculum-standing-shelf-grid" role="list" aria-label={`Kệ sách ${track.title}`}>
                        {shelfBooks.map((book) => {
                          const progress = renderBookProgress(book)
                          return (
                            <div key={book.id} className="curriculum-standing-shelf-cell" role="listitem">
                              <article
                                className="curriculum-standing-book"
                                tabIndex={0}
                                role="button"
                                aria-label={`Giáo trình ${book.title}, ${book.level}`}
                                onClick={() => setSelectedBook(book.id)}
                                onMouseEnter={() => playWashiPaperSound()}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    setSelectedBook(book.id)
                                  }
                                }}
                              >
                                <div className="curriculum-standing-book__shelf">
                                  <div className="curriculum-standing-book__cover-wrap">
                                    <WatojiBookCover
                                      bookTitle={book.title}
                                      size="companion"
                                      variant={book.variant}
                                      kanjiTitle={book.kanjiTitle}
                                      volumeTag={book.volumeTag}
                                      level={book.level}
                                      palette={book.palette}
                                      pattern={book.pattern}
                                      sealChar={book.sealChar}
                                    />
                                    {progress && (
                                      <div className="curriculum-book-progress-bar" aria-hidden="true">
                                        <span style={{ width: `${progress.pct}%` }} />
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="curriculum-standing-book__meta">
                                  <span className="curriculum-standing-book__eyebrow">{book.subtitle}</span>
                                  <h4 className="curriculum-standing-book__title">{book.title}</h4>
                                  <span className="curriculum-standing-book__count">
                                    {renderGrammarStatsText(book)}
                                  </span>
                                  {progress && (
                                    <span className="curriculum-standing-book__progress-text">
                                      Đã thuộc {progress.known} / {progress.total} mẫu
                                    </span>
                                  )}
                                </div>
                              </article>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </section>
              )
            })
          )}
        </div>
      </div>
    )
  }

  // =========================================================================
  // VIEW 2: LESSONS TOC (Chi tiết giáo trình & Mục lục in 目次)
  // =========================================================================
  if (selectedBook && selectedLesson === null) {
    const lessons = lessonsList ?? []
    const totalBookPatterns = lessons.reduce((acc, l) => acc + l.count, 0)
    const userId = user?.id ?? 'guest'
    const lessonKnownMap: Record<string, number> = {}
    let totalKnownInBook = 0
    for (const l of lessons) {
      const cnt = readKnownGrammarIds(`kotodama.known-grammar:${userId}:${selectedBook}:${l.lesson_id}`).length
      const clamped = Math.min(cnt, l.count || cnt)
      lessonKnownMap[l.lesson_id] = clamped
      totalKnownInBook += clamped
    }
    const bookProgressPct =
      totalBookPatterns > 0 ? Math.min(100, Math.round((totalKnownInBook / totalBookPatterns) * 100)) : 0
    const resumeLesson =
      lessons.find((l) => {
        const cnt = lessonKnownMap[l.lesson_id] || 0
        return cnt > 0 && cnt < l.count
      }) ||
      lessons.find((l) => (lessonKnownMap[l.lesson_id] || 0) < l.count) ||
      lessons[0]
    const resumeIdx = resumeLesson ? lessons.indexOf(resumeLesson) + 1 : 1

    const openLesson = (lessonId: string, initialMode: 'flashcard' | 'game' = 'flashcard') => {
      setSelectedLesson(lessonId)
      setStageMode(initialMode)
      setCurrentIndex(0)
      setIsFlipped(false)
      resetGrammarQuiz()
    }

    return (
      <div className="curriculum-container washi-page curriculum-course-view">
        <div className="curriculum-paper-grid">
          <button
            type="button"
            className="curriculum-unit-view__back-btn"
            onClick={() => setSelectedBook(null)}
            aria-label="Quay lại danh mục giáo trình"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Quay lại danh sách sách
          </button>

          {currentBookInfo && (
            <header className="curriculum-book-banner">
              <div className="curriculum-book-banner__cover">
                <WatojiBookCover
                  bookTitle={currentBookInfo.title}
                  size="featured"
                  variant={currentBookInfo.variant}
                  kanjiTitle={currentBookInfo.kanjiTitle}
                  subtitle={currentBookInfo.publisher}
                  volumeTag={currentBookInfo.volumeTag}
                  level={currentBookInfo.level}
                  palette={currentBookInfo.palette}
                  pattern={currentBookInfo.pattern}
                  sealChar={currentBookInfo.sealChar}
                />
              </div>

              <div className="curriculum-book-banner__body">
                <div className="curriculum-book-banner__eyebrow">
                  <span className="curriculum-level-badge" data-level={currentBookInfo.level}>
                    {currentBookInfo.level}
                  </span>
                  <span className="curriculum-book-banner__publisher">{currentBookInfo.publisher}</span>
                </div>

                <h1 className="curriculum-book-banner__title">{currentBookInfo.title}</h1>
                <p className="curriculum-book-banner__desc">{currentBookInfo.description}</p>

                <div className="curriculum-course-progress" aria-label="Tiến độ toàn bộ giáo trình">
                  <div className="curriculum-course-progress__meta">
                    <span>
                      Đã thuộc <strong>{totalKnownInBook}</strong> / {totalBookPatterns} mẫu
                    </span>
                    <span>{bookProgressPct}%</span>
                  </div>
                  <div className="curriculum-course-progress__track">
                    <div className="curriculum-course-progress__fill" style={{ width: `${bookProgressPct}%` }} />
                  </div>
                </div>

                <div className="curriculum-book-banner__footer">
                  <div className="curriculum-book-banner__stats">
                    <span className="curriculum-stat-pill">
                      <Layers size={13} aria-hidden="true" /> {lessons.length} bài học
                    </span>
                    <span className="curriculum-stat-pill">
                      <BookOpen size={13} aria-hidden="true" /> {totalBookPatterns} mẫu ngữ pháp
                    </span>
                  </div>

                  {resumeLesson && (
                    <div className="curriculum-book-banner__actions">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => openLesson(resumeLesson.lesson_id, 'flashcard')}
                      >
                        {totalKnownInBook > 0 ? `Tiếp tục Bài ${resumeIdx} →` : `Bắt đầu Bài ${resumeIdx} →`}
                      </Button>
                      <button
                        type="button"
                        className="curriculum-quick-mode-btn"
                        onClick={() => openLesson(resumeLesson.lesson_id, 'game')}
                      >
                        Phản xạ · Bài {resumeIdx}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>
          )}

          <div className="curriculum-toc-header">
            <h2 className="curriculum-course-view__list-title">
              <span className="curriculum-toc-kanji" aria-hidden="true">
                目次
              </span>
              Mục lục bài học
            </h2>
            <span className="curriculum-toc-meta">
              {lessons.length} bài · {totalBookPatterns} mẫu
            </span>
          </div>

          {lessonsList && !lessonsList.length && (
            <EmptyState
              title="Giáo trình này chưa có bài học"
              description="Bạn có thể quay lại chọn giáo trình khác hoặc thử tải lại."
              action={<Button onClick={() => void refetchLessons()}>Thử tải lại</Button>}
            />
          )}

          <ol className="curriculum-toc-list">
            {lessons.map((lesson, idx) => {
              const known = lessonKnownMap[lesson.lesson_id] || 0
              const pct = lesson.count > 0 ? Math.min(100, Math.round((known / lesson.count) * 100)) : 0
              return (
                <li key={lesson.lesson_id}>
                  <button
                    type="button"
                    className="curriculum-toc-row"
                    onClick={() => openLesson(lesson.lesson_id, 'flashcard')}
                  >
                    <span className="curriculum-toc-row__index" aria-hidden="true">
                      {formatGrammarLessonIndex(lesson.lesson_title, idx)}
                    </span>

                    <span className="curriculum-toc-row__main">
                      <span className="curriculum-toc-row__title">{lesson.lesson_title}</span>
                    </span>

                    <span className="curriculum-toc-row__right">
                      <span className="curriculum-toc-progress">
                        <span className="curriculum-toc-progress__bar" aria-hidden="true">
                          <span style={{ width: `${pct}%` }} />
                        </span>
                        <span className="curriculum-toc-progress__label">
                          {known} / {lesson.count} mẫu
                        </span>
                      </span>
                      <ChevronRight size={16} className="curriculum-toc-row__chevron" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    )
  }

  // =========================================================================
  // VIEW 3: IN-LESSON STUDY & KAKEJIKU FLASHCARD VIEW
  // =========================================================================
  const currentLessonInfo = lessonsList?.find((l) => l.lesson_id === selectedLesson)
  const currentLessonBadge = formatGrammarLessonIndex(currentLessonInfo?.lesson_title || '', 0)

  const toggleGrammarCardFlip = () => {
    sumiAudio.initOnGesture()
    sumiAudio.playBrushFriction()
    playPaperFlip()
    setFlipRippleCount((c) => c + 1)
    setIsFlipped((f) => !f)
  }

  const handleGrammarRecall = (known: boolean) => {
    if (!currentCard) return
    if (known) {
      setKnownGrammars((prev) => [...new Set([...prev, currentCard.id])])
      sumiAudio.initOnGesture()
      sumiAudio.playHankoStamp()
      playStampSuccess()
      setStampBurstCount((c) => c + 1)
      setShowStampFlash(true)
      if (stampTimerRef.current) window.clearTimeout(stampTimerRef.current)
      stampTimerRef.current = window.setTimeout(() => setShowStampFlash(false), 650)
    } else {
      playSoftMiss()
    }
    handleNextCard()
  }

  return (
    <div className="washi-page curriculum-study-shell bunpo-study-shell">
      {saveError && (
        <p role="alert" className="ui-error-text">
          {saveError}
        </p>
      )}
      {/* 3.1 Compact Single-Row Study Bar */}
      <header className="curriculum-study-bar">
        <div className="curriculum-study-bar__left">
          <Button variant="ghost" size="sm" onClick={() => setSelectedLesson(null)}>
            <ArrowLeft size={16} aria-hidden="true" /> Danh sách bài học
          </Button>

          <span className="curriculum-study-bar__divider" aria-hidden="true" />

          <span className="curriculum-study-bar__seal" aria-hidden="true" lang="ja">
            {currentLessonBadge}
          </span>

          <h2
            className="curriculum-study-bar__title"
            title={`${currentBookInfo?.subtitle || ''} - ${currentLessonInfo?.lesson_title || ''}`}
          >
            {currentBookInfo?.subtitle} · {currentLessonInfo?.lesson_title}
          </h2>
        </div>

        <div className="curriculum-study-bar__right">
          {onGoToSrs && (
            <button
              type="button"
              className="curriculum-hanko-srs-pill"
              onClick={onGoToSrs}
              title="Mở Sổ Tay Ôn Tập SRS"
            >
              <span className="curriculum-hanko-srs-pill__stamp" aria-hidden="true">
                記
              </span>
              <span className="curriculum-hanko-srs-pill__text">Sổ tay SRS</span>
              <span className="curriculum-hanko-srs-pill__action">Ôn tập ›</span>
            </button>
          )}
        </div>
      </header>

      {/* 3.2 TOP STAGE: GRAMMAR FLASHCARD OR DOJO QUIZ */}
      {stageMode === 'game' ? (
        <section className="dojo-game" style={{ marginBottom: '0.85rem' }} aria-label="Mini-Game Ngữ Pháp">
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
        /* 3.3 LAYER 1: KAKEJIKU HANGING SCROLL STAGE FOR GRAMMAR */
        currentCard && (
          <div className="lesson-stage-wrapper">
            <div className="kakejiku-stage">
              <div className="kakejiku-toolbar">
                <div className="curriculum-flashcard__topbar-right">
                  <span className="curriculum-level-badge" data-level={currentCard.level}>
                    {currentCard.level}
                  </span>
                  <button
                    type="button"
                    className={`curriculum-flashcard__icon-btn${isGrammarSaved(currentCard) ? ' is-saved' : ''}`}
                    onClick={() => void handleSaveToSrs(currentCard)}
                    title={isGrammarSaved(currentCard) ? 'Đã lưu trong SRS' : 'Lưu vào sổ tay ôn tập (Phím C)'}
                    aria-label={isGrammarSaved(currentCard) ? 'Đã lưu trong SRS' : 'Lưu vào sổ tay ôn tập (Phím C)'}
                  >
                    {isGrammarSaved(currentCard) ? <Check size={15} /> : <BookmarkPlus size={15} />}
                  </button>
                  <button
                    type="button"
                    className="curriculum-flashcard__icon-btn curriculum-flashcard__icon-btn--audio"
                    onClick={() => {
                      const firstAudio = currentCard.examples?.find((ex) => ex.audio)?.audio
                      playAudio(firstAudio, currentCard.pattern)
                    }}
                    title="Nghe phát âm"
                    aria-label="Nghe phát âm"
                  >
                    <Volume2 size={14} aria-hidden="true" />
                    <span className="curriculum-flashcard__audio-label">
                      Nghe<span className="curriculum-study-shortcut"> [R]</span>
                    </span>
                  </button>
                </div>
              </div>

              <div className="kakejiku-scroll">
                <div className="kakejiku-rod kakejiku-rod--top" aria-hidden="true" />

                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Lật thẻ ngữ pháp"
                  aria-expanded={isFlipped}
                  className={`curriculum-flashcard bunpo-kakejiku-card${isFlipped ? ' is-flipped' : ''}`}
                  onKeyDown={(event) => {
                    if (event.target === event.currentTarget && event.key === 'Enter') {
                      event.preventDefault()
                      toggleGrammarCardFlip()
                    }
                  }}
                  onClick={toggleGrammarCardFlip}
                >
                  <img src="/assets/study-scroll-sumie.jpg" alt="" aria-hidden="true" className="kakejiku-art-bg" />
                  <StudyInkAtmosphere burstTrigger={stampBurstCount} rippleTrigger={flipRippleCount} />

                  {showStampFlash && (
                    <div className="kakejiku-stamp-flash" aria-hidden="true">
                      済
                    </div>
                  )}

                  <div className="kakejiku-colophon" aria-hidden="true" lang="ja">
                    {currentCard.level} · {currentLessonBadge} ·{' '}
                    {currentCard.groups && currentCard.groups.length > 1 ? `${currentCard.groups.length}義` : '文法'}
                  </div>

                  <div className="curriculum-flashcard__tategaki" aria-hidden="true" lang="ja">
                    <span>文法墨蹟</span>
                    <span className="curriculum-flashcard__hanko">{isFlipped ? '裏' : '表'}</span>
                  </div>

                  <div
                    key={`${currentCard.id}-${isFlipped ? 'back' : 'front'}`}
                    className="curriculum-flashcard__center curriculum-flashcard__flip-stage"
                  >
                    {!isFlipped ? (
                      <div className="bunpo-kakejiku__front">
                        <div className="bunpo-kakejiku__pattern" lang="ja">
                          {currentCard.pattern}
                        </div>
                        <div className="curriculum-flashcard__brush-rule" aria-hidden="true" />
                        {currentCard.structure && (
                          <div className="bunpo-kakejiku__structure">✦ Cấu trúc: {currentCard.structure}</div>
                        )}
                        {currentCard.groups && currentCard.groups.length > 1 && (
                          <div className="bunpo-kakejiku__multi-row">
                            <span className="bunpo-multi-tag">
                              Gồm {currentCard.groups.length} nghĩa &amp; cách dùng
                            </span>
                          </div>
                        )}
                        <div className="curriculum-flashcard__cue is-first-card">
                          <span aria-hidden="true">◇</span>
                          <span>Nhấn [Space] hoặc chạm để lật xem ý nghĩa &amp; 1 ví dụ mỗi nghĩa</span>
                        </div>
                      </div>
                    ) : (
                      <div className="bunpo-kakejiku__back">
                        <div className="bunpo-kakejiku__pattern--back" lang="ja">
                          {currentCard.pattern}
                        </div>

                        {currentCard.groups && currentCard.groups.length > 1 ? (
                          <div className="bunpo-kakejiku__back-groups">
                            <div className="bunpo-kakejiku__multi-row">
                              <span className="bunpo-multi-tag">
                                Mẫu ngữ pháp có {currentCard.groups.length} nghĩa &amp; cách dùng
                              </span>
                            </div>

                            {currentCard.groups.map((group, gIdx) => {
                              const firstEx = group.examples && group.examples[0]
                              return (
                                <div key={gIdx} className="bunpo-group-card">
                                  <div className="bunpo-group-card__head">
                                    <span className="bunpo-group-badge">Nghĩa {group.group_no || gIdx + 1}</span>
                                    <span className="bunpo-group-card__meaning">
                                      {group.meaning || group.usage || ''}
                                    </span>
                                  </div>

                                  {group.structure && (
                                    <div className="bunpo-group-card__structure">✦ {group.structure}</div>
                                  )}

                                  {group.usage && group.usage !== group.meaning && (
                                    <div className="bunpo-group-card__usage">◎ {group.usage}</div>
                                  )}

                                  {firstEx && (
                                    <div className="bunpo-example-box bunpo-example-box--inline">
                                      <div className="bunpo-example-box__body">
                                        <div
                                          className="bunpo-example-box__jp"
                                          lang="ja"
                                          dangerouslySetInnerHTML={{
                                            __html: sanitizeHtml(firstEx.jp_ruby || firstEx.jp),
                                          }}
                                        />
                                        {firstEx.vi && <div className="bunpo-example-box__vi">{firstEx.vi}</div>}
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
                          <div className="bunpo-kakejiku__back-single">
                            <div className="bunpo-kakejiku__single-meaning">
                              {currentCard.shortMeaning || currentCard.explanation}
                            </div>

                            {currentCard.structure && (
                              <div className="bunpo-kakejiku__structure">✦ Cấu trúc: {currentCard.structure}</div>
                            )}

                            {currentCard.explanation && currentCard.explanation !== currentCard.shortMeaning && (
                              <div className="bunpo-kakejiku__single-explain">{currentCard.explanation}</div>
                            )}

                            {(() => {
                              const firstEx = currentCard.examples?.[0]
                              if (!firstEx) return null
                              return (
                                <div
                                  className="bunpo-example-box bunpo-example-box--inline"
                                  style={{ marginTop: '0.85rem' }}
                                >
                                  <div className="bunpo-example-box__body">
                                    <div
                                      className="bunpo-example-box__jp"
                                      lang="ja"
                                      dangerouslySetInnerHTML={{
                                        __html: sanitizeHtml(firstEx.jp_ruby || firstEx.jp),
                                      }}
                                    />
                                    {firstEx.vi && <div className="bunpo-example-box__vi">{firstEx.vi}</div>}
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

                  <div className="curriculum-flashcard__footer">
                    <span className="curriculum-flashcard__footer-meta">
                      Mẫu {currentIndex + 1} / {grammars.length}
                    </span>
                    <span className="curriculum-flashcard__footer-keys">
                      Phím tắt: Space (Lật) · Z (Đã biết) · X (Chưa biết) · R (Phát âm) · C (Thêm SRS)
                    </span>
                  </div>
                  <div className="curriculum-flashcard__rail" aria-hidden="true">
                    <span
                      style={{
                        width: `${grammars.length > 0 ? ((currentIndex + 1) / grammars.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="kakejiku-rod kakejiku-rod--bottom" aria-hidden="true" />
              </div>
            </div>

            <div className="curriculum-flashcard-controls">
              <Button
                variant="ghost"
                size="md"
                className="curriculum-flashcard-controls__nav"
                onClick={handlePrevCard}
                disabled={currentIndex === 0}
              >
                <ChevronLeft size={18} aria-hidden="true" /> <span>Trước</span>
              </Button>

              <Button
                variant="danger"
                size="md"
                className="curriculum-flashcard-controls__miss"
                onClick={() => handleGrammarRecall(false)}
              >
                <span>Chưa biết (X)</span>
              </Button>

              <Button
                variant="primary"
                size="md"
                className="curriculum-flashcard-controls__pass"
                onClick={() => handleGrammarRecall(true)}
              >
                <Check size={16} aria-hidden="true" /> <span>Đã biết (Z)</span>
              </Button>

              <Button
                variant="ghost"
                size="md"
                className="curriculum-flashcard-controls__nav"
                onClick={handleNextCard}
                disabled={currentIndex >= grammars.length - 1}
              >
                <span>Sau</span> <ChevronRight size={18} aria-hidden="true" />
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
