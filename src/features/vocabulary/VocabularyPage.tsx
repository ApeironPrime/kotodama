import { usePersistentState } from '../../lib/usePersistentState'
import { useDialogAccessibility } from '../../lib/useDialogAccessibility'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { useUrlState } from '../../lib/useUrlState'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  BookmarkPlus,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Layers,
  Search,
  Shuffle,
  Volume2,
  Sparkles,
  X,
} from 'lucide-react'
import { Badge, Button } from '../../components/ui'
import { RetryState } from '../../components/AppStates'
import { srsApi } from '../srs/srsApi'
import type { CurriculumWord } from '../srs/srsTypes'
import { useAuth } from '../auth/authContext'
import { curriculumApi } from '../curriculum/curriculumApi'
import type { CurriculumCourseCard } from '../../types/curriculum'
import { DictionaryWordDetail } from '../dictionary/DictionaryWordDetail'
import { apiPaths, requestApi, type DictionaryWordItem } from '../../lib/apiClient'
import {
  CURATED_TRACKS,
  curateCatalogCourses,
  type CuratedTrackId,
  type CuratedCourseMetadata,
} from './vocabularyCuratedData'
import { WatojiBookCover } from './WatojiBookCover'
import { HorizontalBookshelf } from './HorizontalBookshelf'
import { KaikaShokoModal } from './KaikaShokoModal'
import { LessonMiniGame } from './LessonMiniGame'
import { WashiGoldDustCanvas } from './WashiGoldDustCanvas'

const FILTER_TABS = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'A1/A2', label: 'A1 / A2' },
  { id: 'N5', label: 'N5' },
  { id: 'N4', label: 'N4' },
  { id: 'N3', label: 'N3' },
  { id: 'N2', label: 'N2' },
  { id: 'N1', label: 'N1' },
  { id: 'SE', label: 'SE IT' },
]

function speakJapanese(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ja-JP'
  utterance.rate = 0.88
  window.speechSynthesis.speak(utterance)
}

function formatJpQuote(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith('「') && trimmed.endsWith('」')) return trimmed
  return `「${trimmed}」`
}

export function VocabularyPage({ onGoToSrs }: { onGoToSrs?: () => void }) {
  // Navigation level: 'catalog' -> 'lessons' -> 'study'
  const [selectedCourseCode, setSelectedCourseCode] = useUrlState<string | null>('course', null)
  const [selectedUnitKey, setSelectedUnitKey] = useUrlState<string | null>('unit', null)
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebouncedValue(searchQuery)

  // Full-screen archival drawer modal state (Kho lưu trữ văn thư cổ · 開架書庫)
  const [activeDrawerTrack, setActiveDrawerTrack] = useState<{
    id: string
    title: string
    kanji: string
    items: Array<{ course: CurriculumCourseCard; meta: CuratedCourseMetadata }>
  } | null>(null)

  // In-Unit stage mode: flashcard (default at top) or mini-games; vocabulary list stays visible below
  const [stageMode, setStageMode] = useState<'flashcard' | 'quiz' | 'karuta' | 'listening'>('flashcard')
  const [isShuffled, setIsShuffled] = useState(false)
  const [shuffledOrder, setShuffledOrder] = useState<number[]>([])
  const [unitSearchQuery, setUnitSearchQuery] = useState('')
  const debouncedUnitSearchQuery = useDebouncedValue(unitSearchQuery)
  const [unitPage, setUnitPage] = useState(1)
  const [cardContentMode, setCardContentMode] = useState<'word' | 'example'>('word')

  // In-Lesson Flashcard State
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const { user } = useAuth()
  const [knownWords, setKnownWords] = usePersistentState<string[]>(
    `kotodama.known:${user?.id ?? 'guest'}:${selectedCourseCode}:${selectedUnitKey}`,
    []
  )
  const [savedSrs, setSavedSrs] = useState<Record<string, boolean>>({})
  const [selectedDictWord, setSelectedDictWord] = useState<string | null>(null)
  const dictionaryDialogRef = useRef<HTMLDivElement>(null)
  useDialogAccessibility(dictionaryDialogRef, () => setSelectedDictWord(null), Boolean(selectedDictWord))
  const [authNotice, setAuthNotice] = useState<string | null>(null)
  const [srsError, setSrsError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // 1. Fetch catalog data from T04 API
  const {
    data: catalogData,
    isLoading: isCatalogLoading,
    isError: isCatalogError,
    refetch: refetchCatalog,
  } = useQuery({
    queryKey: ['curriculum', 'catalog', selectedLevelFilter, debouncedSearchQuery],
    queryFn: () => {
      const apiLevel =
        selectedLevelFilter === 'A1/A2' || selectedLevelFilter === 'ALL' ? undefined : selectedLevelFilter
      return curriculumApi.fetchCatalog({
        level: apiLevel,
        q: debouncedSearchQuery || undefined,
        page: 1,
        limit: 100,
      })
    },
    staleTime: 60_000,
  })

  // 2. Fetch course detail & unit summaries when a course card is selected
  const {
    data: courseDetailData,
    isLoading: isCourseLoading,
    isError: isCourseError,
    refetch: refetchCourse,
  } = useQuery({
    queryKey: ['curriculum', 'course', selectedCourseCode],
    queryFn: () => {
      if (!selectedCourseCode) throw new Error('Yêu cầu mã khóa học')
      return curriculumApi.fetchCourseDetail(selectedCourseCode)
    },
    enabled: Boolean(selectedCourseCode),
    staleTime: 60_000,
  })

  // 3. Fetch terms when a unit is selected for study (server-side pagination and search)
  const {
    data: termsData,
    isLoading: isTermsLoading,
    isError: isTermsError,
    refetch: refetchTerms,
  } = useQuery({
    queryKey: [
      'curriculum',
      'unit-terms',
      selectedCourseCode,
      selectedUnitKey,
      unitPage,
      debouncedUnitSearchQuery.trim(),
    ],
    queryFn: () => {
      if (!selectedCourseCode || !selectedUnitKey) throw new Error('Yêu cầu khóa học và bài học')
      return curriculumApi.fetchUnitTerms(selectedCourseCode, selectedUnitKey, {
        page: unitPage,
        limit: 20,
        q: debouncedUnitSearchQuery.trim() || undefined,
      })
    },
    enabled: Boolean(selectedCourseCode && selectedUnitKey),
    staleTime: 60_000,
  })

  // 4. Fetch dictionary word detail when user clicks to inspect a word
  const { data: dictWordData } = useQuery({
    queryKey: ['dictionary', 'word-detail', selectedDictWord],
    queryFn: async () => {
      if (!selectedDictWord) return null
      try {
        const data = await requestApi<DictionaryWordItem>({
          url: apiPaths.dictionary.word(selectedDictWord),
        })
        return data
      } catch {
        return null
      }
    },
    enabled: Boolean(selectedDictWord),
    staleTime: 60_000,
  })

  // Fetch saved SRS terms from server (strictly enabled only when authenticated)
  const { data: savedTermsData } = useQuery({
    queryKey: ['srs', user?.id, 'saved-terms'],
    queryFn: () => srsApi.fetchSavedTerms(),
    enabled: Boolean(user),
    staleTime: 30_000,
  })

  // Sync server saved terms into local state or clear when logged out
  useEffect(() => {
    if (!user) {
      setSavedSrs({})
      return
    }
    if (!Array.isArray(savedTermsData)) return
    const map: Record<string, boolean> = {}
    for (const entry of savedTermsData) {
      if (entry?.type === 'vocab' && entry?.term) {
        if (entry.sourceContext) {
          // Exact key only for curriculum terms with sourceContext
          map[entry.sourceContext] = true
        } else {
          // Generic term keys ONLY for legacy SRS cards without sourceContext
          map[`vocab_term_${entry.term}`] = true
          map[entry.term] = true
        }
      }
    }
    setSavedSrs(map)
  }, [user, savedTermsData])

  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const currentUnitInfo = courseDetailData?.units?.find((u) => u.unit_key === selectedUnitKey)
  const PAGE_SIZE = 20

  // Normalize terms to CurriculumWord model for study modes
  const words: CurriculumWord[] = useMemo(() => {
    return (termsData?.items || []).map((t, idx) => {
      const globalIdx = (unitPage - 1) * PAGE_SIZE + idx + 1
      const unitId = currentUnitInfo?.unit_id || `${selectedCourseCode}:${selectedUnitKey}`
      const sourceContext = `${selectedCourseCode}:${unitId}:${t.term_id}`
      return {
        id: globalIdx,
        curriculumCode: selectedCourseCode || '',
        courseCode: selectedCourseCode || '',
        unitId,
        termId: t.term_id,
        sourceContext,
        unitNumber: currentUnitInfo?.ordinal || 1,
        unitTitle: currentUnitInfo?.title || `Bài ${currentUnitInfo?.ordinal || 1}`,
        lessonTitle: currentUnitInfo?.title || '',
        indexNum: t.ordinal,
        word: t.display_word,
        reading: t.display_reading,
        hanViet: t.han_viet || '',
        meaning: Array.isArray(t.meanings) ? t.meanings.join(', ') : String(t.meanings),
        jlptLevel: courseDetailData?.course.level || 'N5',
        partOfSpeech: '',
        examples: (t.examples || []).map((ex) => ({ jp: ex.ja, vi: ex.vi })),
      }
    })
  }, [termsData?.items, unitPage, selectedCourseCode, selectedUnitKey, currentUnitInfo, courseDetailData?.course.level])

  // Server Pagination
  const totalTerms = termsData?.pagination?.total ?? (currentUnitInfo?.term_count || words.length)
  const totalPages = termsData?.pagination?.totalPages ?? (Math.ceil(totalTerms / PAGE_SIZE) || 1)
  const paginatedWords = words

  // Unit total term count: strictly uses unit's term_count from courseDetail or pagination total
  const unitTotalTerms = currentUnitInfo?.term_count || termsData?.pagination?.total || 0

  const currentUnitId =
    currentUnitInfo?.unit_id ||
    (selectedCourseCode && selectedUnitKey ? `${selectedCourseCode}:${selectedUnitKey}` : '')
  const unitContextPrefix = selectedCourseCode && currentUnitId ? `${selectedCourseCode}:${currentUnitId}:` : ''

  // Helper: check if a curriculum term is saved in SRS.
  // For terms with sourceContext, ONLY checks the exact sourceContext key.
  // Falls back to generic term only for legacy SRS cards without sourceContext.
  const isCurriculumTermSaved = useCallback(
    (item: Pick<CurriculumWord, 'sourceContext' | 'word'> | null | undefined): boolean => {
      if (!item) return false
      if (item.sourceContext) {
        return Boolean(savedSrs[item.sourceContext])
      }
      return Boolean(savedSrs[item.word] || savedSrs[`vocab_term_${item.word}`])
    },
    [savedSrs]
  )

  // Real Progress Calculation: count of saved terms in this unit (exact context only)
  const savedCountInUnit = useMemo(() => {
    if (!user || !unitContextPrefix) return 0
    const unitSavedContexts = new Set<string>()

    if (Array.isArray(savedTermsData)) {
      for (const s of savedTermsData) {
        if (s.sourceContext && s.sourceContext.startsWith(unitContextPrefix)) {
          unitSavedContexts.add(s.sourceContext)
        } else if (s.courseCode === selectedCourseCode && s.unitId === currentUnitId && s.termId) {
          unitSavedContexts.add(`${selectedCourseCode}:${currentUnitId}:${s.termId}`)
        }
      }
    }

    for (const [key, isSaved] of Object.entries(savedSrs)) {
      if (isSaved && key.startsWith(unitContextPrefix)) {
        unitSavedContexts.add(key)
      }
    }

    return unitSavedContexts.size
  }, [user, unitContextPrefix, savedTermsData, selectedCourseCode, currentUnitId, savedSrs])

  const progressPercent = unitTotalTerms > 0 ? Math.min(100, Math.round((savedCountInUnit / unitTotalTerms) * 100)) : 0

  const activeDictCurriculumWord = useMemo(() => {
    if (!selectedDictWord) return null
    return words.find((w) => w.word === selectedDictWord) || null
  }, [selectedDictWord, words])

  // Construct resolved DictionaryWordItem for the dictionary modal (fallback from curriculum metadata)
  const resolvedDictItem = useMemo<DictionaryWordItem | null>(() => {
    if (!selectedDictWord) return null
    if (dictWordData) return dictWordData
    const matchingTerm = activeDictCurriculumWord
    if (!matchingTerm) {
      return {
        id: 0,
        word: selectedDictWord,
        meanings: [],
        kanjis: [],
      }
    }
    return {
      id: matchingTerm.id,
      word: matchingTerm.word,
      reading: matchingTerm.reading || null,
      hanViet: matchingTerm.hanViet || null,
      jlpt: matchingTerm.jlptLevel || null,
      partOfSpeech: matchingTerm.partOfSpeech || null,
      meanings: matchingTerm.meaning ? matchingTerm.meaning.split(', ') : [],
      kanjis: [],
      examples: (matchingTerm.examples || []).map((ex) => ({
        sentenceJp: ex.jp,
        sentenceVi: ex.vi,
      })),
    }
  }, [selectedDictWord, dictWordData, activeDictCurriculumWord])

  const flashcardDeck = useMemo(() => {
    if (!isShuffled || shuffledOrder.length !== words.length) return words
    return shuffledOrder.map((idx) => words[idx]).filter((w): w is CurriculumWord => Boolean(w))
  }, [isShuffled, shuffledOrder, words])

  const toggleShuffleDeck = useCallback(() => {
    setIsFlipped(false)
    setCurrentIndex(0)
    if (isShuffled) {
      setIsShuffled(false)
      setShuffledOrder([])
      return
    }
    const indices = words.map((_, idx) => idx)
    for (let i = indices.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      const a = indices[i]
      const b = indices[j]
      if (a !== undefined && b !== undefined) {
        indices[i] = b
        indices[j] = a
      }
    }
    setShuffledOrder(indices)
    setIsShuffled(true)
  }, [isShuffled, words])

  const currentCard = flashcardDeck[currentIndex] || words[currentIndex] || null
  const isCurrentCardSaved = isCurriculumTermSaved(currentCard)

  const playAudio = (url?: string, fallbackText?: string) => {
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
  }

  const handleNextCard = () => {
    setIsFlipped(false)
    if (currentIndex < words.length - 1) {
      setCurrentIndex((i) => i + 1)
    } else if (unitPage < totalPages) {
      setUnitPage((p) => p + 1)
      setCurrentIndex(0)
    }
  }

  const handlePrevCard = () => {
    setIsFlipped(false)
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1)
    } else if (unitPage > 1) {
      setUnitPage((p) => p - 1)
      setCurrentIndex(PAGE_SIZE - 1)
    }
  }

  const handleSaveWordToSrs = useCallback(
    async (item: CurriculumWord) => {
      if (!user) {
        setAuthNotice('Vui lòng đăng nhập để lưu từ vựng vào kho ôn tập SRS.')
        return
      }
      setAuthNotice(null)
      setSrsError(null)
      try {
        await srsApi.addCard({
          type: 'vocab',
          term: item.word,
          reading: item.reading,
          hanViet: item.hanViet,
          meaning: item.meaning,
          jlptLevel: (item.jlptLevel || 'N5').toUpperCase(),
          partOfSpeech: item.partOfSpeech,
          examples: item.examples,
          courseCode: item.courseCode,
          unitId: item.unitId,
          termId: item.termId,
          sourceContext: item.sourceContext,
        })
        setSavedSrs((prev) => {
          if (item.sourceContext) {
            return {
              ...prev,
              [item.sourceContext]: true,
            }
          }
          return {
            ...prev,
            [`vocab_${item.id}`]: true,
            [`vocab_term_${item.word}`]: true,
            [item.word]: true,
          }
        })
        await queryClient.invalidateQueries({ queryKey: ['srs'] })
      } catch (err) {
        console.error('Không thể lưu từ vào SRS:', err)
        setSrsError('Không thể lưu từ vào SRS lúc này. Vui lòng thử lại sau.')
      }
    },
    [user, queryClient]
  )

  // Keyboard shortcut listener with strict input focus isolation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Strictly ignore keyboard shortcuts if user is typing in an input, textarea, or select
      const targetTag = (e.target as HTMLElement)?.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(targetTag)) return

      // Escape closes the dictionary modal if open
      if (selectedDictWord && e.key === 'Escape') {
        setSelectedDictWord(null)
        return
      }

      if (!selectedUnitKey || stageMode !== 'flashcard' || !currentCard) return

      if (e.code === 'Space') {
        e.preventDefault()
        setIsFlipped((f) => !f)
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        setKnownWords((prev) => [...new Set([...prev, currentCard.termId || String(currentCard.id)])])
        setIsFlipped(false)
        setCurrentIndex((i) => (i < words.length - 1 ? i + 1 : i))
      } else if (e.key === 'x' || e.key === 'X') {
        e.preventDefault()
        setIsFlipped(false)
        setCurrentIndex((i) => (i < words.length - 1 ? i + 1 : i))
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        playAudio(currentCard.audioUrl, currentCard.word)
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        void handleSaveWordToSrs(currentCard)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedUnitKey, stageMode, currentCard, words.length, handleSaveWordToSrs, selectedDictWord, setKnownWords])

  // =========================================================================
  // VIEW 1: CATALOG OVERVIEW (Duyệt theo cấp độ A1..N1, SE & phong cách giấy kem)
  // =========================================================================
  if (!selectedCourseCode) {
    const rawItems: CurriculumCourseCard[] = catalogData?.items || []

    // Filter items by client-side level filter and search query for instant responsiveness
    const filteredItems = rawItems.filter((course) => {
      if (selectedLevelFilter !== 'ALL') {
        if (selectedLevelFilter === 'A1/A2') {
          if (course.level !== 'A1' && course.level !== 'A2') return false
        } else if (course.level !== selectedLevelFilter) {
          return false
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        const titleMatch = course.title.toLowerCase().includes(q)
        const descMatch = (course.description || '').toLowerCase().includes(q)
        const providerMatch = (course.provider_source || '').toLowerCase().includes(q)
        if (!titleMatch && !descMatch && !providerMatch) return false
      }

      return true
    })

    const itemsWithMeta = curateCatalogCourses(filteredItems)

    const TRACK_ORDER: CuratedTrackId[] = ['core', 'sprinters', 'immersion', 'specialized']

    const activeTracks = TRACK_ORDER.map((trackId) => {
      const trackDef = CURATED_TRACKS[trackId]
      const coursesInTrack = itemsWithMeta
        .filter((item) => item.meta.track === trackId)
        .sort((a, b) => {
          if (a.meta.isFeatured && !b.meta.isFeatured) return -1
          if (!a.meta.isFeatured && b.meta.isFeatured) return 1
          return b.course.term_count - a.course.term_count
        })
      return {
        ...trackDef,
        items: coursesInTrack,
      }
    }).filter((track) => track.items.length > 0)

    const totalMatchingCourses = filteredItems.length
    const totalSavedCount = user && Array.isArray(savedTermsData) ? savedTermsData.length : Object.keys(savedSrs).length

    return (
      <div className="curriculum-container">
        {/* Washi Canvas Frame */}
        <div className="curriculum-paper-grid">
          <div className="curriculum-paper-grid__mist" aria-hidden="true" />
          {/* Creative Engineering: Interactive Kyoto Gold Dust Shimmer Canvas */}
          <WashiGoldDustCanvas />

          {/* Hero Header */}
          <header className="curriculum-hero">
            <div className="curriculum-hero__layout">
              <div className="curriculum-hero__main">
                <div className="curriculum-hero__eyebrow">
                  <span className="curriculum-hero__hanko" aria-hidden="true">
                    庫
                  </span>
                  <Sparkles size={14} aria-hidden="true" />
                  <span>THƯ VIỆN TUYỂN CHỌN KOTODAMA • 文庫</span>
                </div>
                <h1 className="curriculum-hero__title">Học bản chất – không học vẹt</h1>
                <p className="curriculum-hero__desc">
                  Khám phá các bộ giáo trình từ vựng theo chuẩn JLPT và khung CEFR/SE. Không chạy theo số lượng cơ học —
                  mỗi bộ giáo trình đại diện cho một phương pháp sư phạm riêng biệt: từ xây dựng nền móng cốt lõi, phản
                  xạ ngữ cảnh, đến bứt phá điểm thi theo tuần và thuật ngữ chuyên ngành.
                </p>
              </div>
              <aside className="curriculum-hero__aside" aria-hidden="true">
                <span className="curriculum-hero__jp" lang="ja">
                  読書百遍・意自ずから通ず
                </span>
                <div className="curriculum-hero__pills">
                  <span>Chuẩn JLPT N5–N1</span>
                  <span>Flashcard &amp; Karuta</span>
                </div>
              </aside>
            </div>
          </header>

          {/* Search, Level Filters & Hanko SRS Toolbar */}
          <div className="curriculum-toolbar">
            <div className="curriculum-toolbar__left">
              <div className="curriculum-level-filters" role="tablist" aria-label="Lọc theo cấp độ giáo trình">
                {FILTER_TABS.map((tab) => {
                  const isActive = selectedLevelFilter === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      tabIndex={0}
                      className={`curriculum-filter-pill${isActive ? ' curriculum-filter-pill--active' : ''}`}
                      onClick={() => setSelectedLevelFilter(tab.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedLevelFilter(tab.id)
                        }
                      }}
                    >
                      {isActive && <span className="curriculum-filter-dot" aria-hidden="true" />}
                      {tab.label}
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
                  placeholder="Tìm kiếm giáo trình..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Tìm kiếm giáo trình từ vựng"
                />
              </div>

              {onGoToSrs && (
                <button
                  type="button"
                  className="curriculum-hanko-srs-pill"
                  onClick={onGoToSrs}
                  title="Mở sổ tay và kho ôn tập SRS"
                  aria-label={`Sổ tay SRS: ${totalSavedCount} từ đã lưu. Nhấn để ôn tập.`}
                >
                  <span className="curriculum-hanko-srs-pill__stamp" aria-hidden="true">
                    記
                  </span>
                  <span className="curriculum-hanko-srs-pill__text">
                    Sổ tay SRS: <strong>{totalSavedCount}</strong> từ
                  </span>
                  <span className="curriculum-hanko-srs-pill__action">Ôn tập ›</span>
                </button>
              )}
            </div>
          </div>

          {/* Loading Skeleton State */}
          {isCatalogLoading && (
            <div className="curriculum-book-jacket-grid" role="status" aria-label="Đang tải danh mục giáo trình...">
              <div className="curriculum-skeleton-card" />
              <div className="curriculum-skeleton-card" />
              <div className="curriculum-skeleton-card" />
              <div className="curriculum-skeleton-card" />
            </div>
          )}

          {/* Error State */}
          {isCatalogError && (
            <RetryState
              title="Không thể tải danh mục giáo trình"
              description="Đã có lỗi xảy ra khi kết nối máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại."
              onRetry={() => refetchCatalog()}
            />
          )}

          {/* Empty State (when 0 courses found or during verification period) */}
          {!isCatalogLoading && !isCatalogError && totalMatchingCourses === 0 && (
            <div className="curriculum-empty-notice" role="status">
              <BookOpen size={44} className="curriculum-empty-notice__icon" aria-hidden="true" />
              <h3 className="curriculum-empty-notice__title">
                {searchQuery || selectedLevelFilter !== 'ALL'
                  ? 'Không tìm thấy giáo trình phù hợp'
                  : 'Kho Giáo Trình Đang Thẩm Định Quyền Sử Dụng'}
              </h3>
              <p className="curriculum-empty-notice__text">
                {searchQuery || selectedLevelFilter !== 'ALL'
                  ? 'Không tìm thấy bộ giáo trình nào phù hợp với bộ lọc hoặc từ khóa tìm kiếm. Vui lòng thử lại với từ khóa khác.'
                  : 'Các bộ giáo trình từ vựng đang trong quy trình rà soát quyền sử dụng và biên tập nội dung theo quy chuẩn Kotodama. Các khóa học đạt chuẩn sẽ tự động hiển thị tại đây ngay sau khi hoàn tất kiểm duyệt.'}
              </p>
              {(searchQuery || selectedLevelFilter !== 'ALL') && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedLevelFilter('ALL')
                  }}
                >
                  Xóa bộ lọc tìm kiếm
                </Button>
              )}
            </div>
          )}

          {/* 4 Curated Editorial Tracks */}
          {!isCatalogLoading &&
            !isCatalogError &&
            activeTracks.map((track) => {
              const featuredItem = track.items.find((item) => item.meta.isFeatured) || track.items[0]
              const companionItems = track.items.filter((item) => item !== featuredItem)

              return (
                <section
                  key={track.id}
                  className="curriculum-track-section"
                  aria-labelledby={`heading-track-${track.id}`}
                >
                  <div className="curriculum-track-header">
                    <div className="curriculum-track-header__meta">
                      <span className="curriculum-track-stamp" aria-hidden="true">
                        {track.kanji}
                      </span>
                      <h2 id={`heading-track-${track.id}`} className="curriculum-track-title">
                        {track.title}
                      </h2>
                      <span className="curriculum-track-count">({track.items.length} giáo trình)</span>
                    </div>
                    <p className="curriculum-track-desc">{track.description}</p>
                    <div className="curriculum-roadmap-banner" role="note">
                      <Sparkles size={14} className="curriculum-roadmap-banner__icon" aria-hidden="true" />
                      <span>
                        <strong>Định hướng học:</strong> {track.roadmapTip}
                      </span>
                    </div>
                  </div>

                  {/* 1. Master Featured Book Spread (Cuốn tiêu điểm khổ lớn nằm ngang) */}
                  {featuredItem && (
                    <article
                      className="curriculum-featured-spread"
                      tabIndex={0}
                      role="button"
                      aria-label={`Khóa học ${featuredItem.course.title}, ${featuredItem.meta.levelDisplay}`}
                      onClick={() => {
                        setSelectedCourseCode(featuredItem.course.course_code)
                        setSelectedUnitKey(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedCourseCode(featuredItem.course.course_code)
                          setSelectedUnitKey(null)
                        }
                      }}
                    >
                      <div className="curriculum-featured-spread__cover-pane">
                        <WatojiBookCover
                          coverSrc={featuredItem.meta.coverSrc}
                          bookTitle={featuredItem.course.title}
                          size="featured"
                          kanjiTitle={featuredItem.meta.kanjiTitle}
                          subtitle={featuredItem.meta.publisher}
                          volumeTag={featuredItem.meta.volumeTag}
                          level={featuredItem.course.level}
                          palette={featuredItem.meta.palette}
                          pattern={featuredItem.meta.pattern}
                          sealChar={featuredItem.meta.sealChar}
                        />
                      </div>

                      <div className="curriculum-featured-spread__content-pane">
                        <div className="curriculum-featured-spread__eyebrow-row">
                          <span className="curriculum-featured-badge">★ Tác phẩm tiêu điểm</span>
                          <span className="curriculum-featured-spread__publisher">{featuredItem.meta.publisher}</span>
                          <span className="curriculum-featured-spread__level">{featuredItem.meta.levelDisplay}</span>
                        </div>

                        <h3 className="curriculum-featured-spread__title">{featuredItem.course.title}</h3>
                        <p className="curriculum-featured-spread__subtitle">{featuredItem.meta.pedagogicalSubtitle}</p>

                        <blockquote className="curriculum-featured-spread__quote">
                          「 {featuredItem.meta.methodQuote} 」
                        </blockquote>

                        {featuredItem.meta.variants && (
                          <div className="curriculum-featured-spread__variants">
                            <span className="curriculum-featured-spread__variants-label">Phiên bản tích hợp:</span>
                            <div className="curriculum-featured-spread__variants-list">
                              {featuredItem.meta.variants.map((v, i) => (
                                <span key={i} className="curriculum-variant-pill">
                                  {v}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="curriculum-featured-spread__footer">
                          <div className="curriculum-featured-spread__stats">
                            <span className="curriculum-featured-spread__stat-item">
                              <Layers size={14} aria-hidden="true" />
                              <strong>{featuredItem.course.unit_count}</strong> bài học
                            </span>
                            <span className="curriculum-featured-spread__stat-dot">·</span>
                            <span className="curriculum-featured-spread__stat-item">
                              <strong>{featuredItem.course.term_count.toLocaleString()}</strong> từ trọng tâm
                            </span>
                            <span className="curriculum-featured-spread__stat-dot">·</span>
                            <span className="curriculum-featured-spread__stat-pacing">
                              {featuredItem.meta.pacingBadge}
                            </span>
                          </div>

                          <div className="curriculum-featured-spread__action">
                            <span>Mở sách học tập</span>
                            <span className="curriculum-featured-spread__hanko-seal" aria-hidden="true">
                              開本
                            </span>
                          </div>
                        </div>
                      </div>
                    </article>
                  )}

                  {/* 2. Tactile Horizontal Bookshelf Carousel (Kệ sách đồng hành cuộn ngang mượt mà) */}
                  {companionItems.length > 0 && (
                    <HorizontalBookshelf
                      trackTitle={track.title}
                      items={companionItems}
                      onSelectCourse={(courseCode) => {
                        setSelectedCourseCode(courseCode)
                        setSelectedUnitKey(null)
                      }}
                      onOpenDrawer={() => {
                        setActiveDrawerTrack({
                          id: track.id,
                          title: track.title,
                          kanji: track.kanji,
                          items: companionItems,
                        })
                      }}
                    />
                  )}
                </section>
              )
            })}

          {/* Full-Screen Archival Drawer Modal (Kho văn thư cổ toàn phần · 開架書庫) */}
          <KaikaShokoModal
            isOpen={Boolean(activeDrawerTrack)}
            trackTitle={activeDrawerTrack?.title ?? ''}
            trackKanji={activeDrawerTrack?.kanji ?? ''}
            items={activeDrawerTrack?.items ?? []}
            onClose={() => setActiveDrawerTrack(null)}
            onSelectCourse={(courseCode) => {
              setSelectedCourseCode(courseCode)
              setSelectedUnitKey(null)
            }}
          />
        </div>
      </div>
    )
  }

  // =========================================================================
  // VIEW 2: LESSONS / UNIT SELECTION (Chọn bài học trong giáo trình đã chọn)
  // =========================================================================
  if (selectedCourseCode && !selectedUnitKey) {
    const course = courseDetailData?.course
    const units = courseDetailData?.units || []

    return (
      <div className="curriculum-container washi-page">
        <div className="curriculum-paper-grid">
          <button
            type="button"
            className="curriculum-unit-view__back-btn"
            onClick={() => {
              setSelectedCourseCode(null)
              setSelectedUnitKey(null)
            }}
            aria-label="Quay lại danh mục giáo trình"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Quay lại danh mục giáo trình
          </button>

          {isCourseLoading && (
            <div className="curriculum-unit-grid" role="status" aria-label="Đang tải danh sách bài học...">
              <div className="curriculum-skeleton-card" style={{ height: '80px' }} />
              <div className="curriculum-skeleton-card" style={{ height: '80px' }} />
              <div className="curriculum-skeleton-card" style={{ height: '80px' }} />
              <div className="curriculum-skeleton-card" style={{ height: '80px' }} />
            </div>
          )}

          {isCourseError && (
            <RetryState
              title="Không thể tải chi tiết khóa học"
              description="Không thể kết nối hoặc khóa học hiện không khả dụng. Vui lòng thử lại."
              onRetry={() => refetchCourse()}
            />
          )}

          {!isCourseLoading && !isCourseError && course && (
            <>
              {(() => {
                const courseMeta = curateCatalogCourses([course])[0]?.meta
                const firstUnit = units[0]
                return (
                  <header className="curriculum-book-banner">
                    <div className="curriculum-book-banner__mist" aria-hidden="true" />
                    {courseMeta && (
                      <div className="curriculum-book-banner__cover">
                        <WatojiBookCover
                          coverSrc={courseMeta.coverSrc}
                          bookTitle={course.title}
                          size="featured"
                          kanjiTitle={courseMeta.kanjiTitle}
                          subtitle={courseMeta.publisher}
                          volumeTag={courseMeta.volumeTag}
                          level={course.level}
                          palette={courseMeta.palette}
                          pattern={courseMeta.pattern}
                          sealChar={courseMeta.sealChar}
                        />
                      </div>
                    )}
                    <div className="curriculum-book-banner__body">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                        <span className="curriculum-level-badge" data-level={course.level}>
                          {course.level}
                        </span>
                        <span
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: 'var(--color-text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                          }}
                        >
                          {courseMeta?.publisher || course.provider_source}
                        </span>
                      </div>
                      <h1 className="curriculum-book-banner__title">{course.title}</h1>
                      <p className="curriculum-book-banner__desc">
                        {course.description ||
                          'Chọn một bài học dưới đây để bắt đầu học Flashcard, luyện phản xạ Mini-Game hoặc xem danh sách từ vựng chi tiết.'}
                      </p>
                      <div className="curriculum-book-banner__footer">
                        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                          <span className="curriculum-stat-pill">
                            <Layers size={13} aria-hidden="true" /> {course.unit_count} bài học
                          </span>
                          <span className="curriculum-stat-pill">
                            <BookOpen size={13} aria-hidden="true" /> {course.term_count} từ vựng
                          </span>
                        </div>
                        {firstUnit && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setSelectedUnitKey(firstUnit.unit_key)
                              setCurrentIndex(0)
                              setIsFlipped(false)
                              setUnitSearchQuery('')
                              setUnitPage(1)
                              setSelectedDictWord(null)
                              setAuthNotice(null)
                              setSrsError(null)
                            }}
                          >
                            Bắt đầu Bài {firstUnit.ordinal} →
                          </Button>
                        )}
                      </div>
                    </div>
                  </header>
                )
              })()}

              <div className="curriculum-unit-grid" role="list">
                {units.map((unit) => (
                  <div
                    key={unit.unit_id}
                    className="curriculum-unit-card"
                    tabIndex={0}
                    role="button"
                    aria-label={`Bài ${unit.ordinal}: ${unit.title}, ${unit.term_count} từ`}
                    onClick={() => {
                      setSelectedUnitKey(unit.unit_key)
                      setCurrentIndex(0)
                      setIsFlipped(false)
                      setUnitSearchQuery('')
                      setUnitPage(1)
                      setSelectedDictWord(null)
                      setAuthNotice(null)
                      setSrsError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedUnitKey(unit.unit_key)
                        setCurrentIndex(0)
                        setIsFlipped(false)
                        setUnitSearchQuery('')
                        setUnitPage(1)
                        setSelectedDictWord(null)
                        setAuthNotice(null)
                        setSrsError(null)
                      }
                    }}
                  >
                    <div className="curriculum-unit-card__left">
                      <span className="curriculum-unit-card__seal" aria-hidden="true">
                        {String(unit.ordinal).padStart(2, '0')}
                      </span>
                      <div>
                        <div className="curriculum-unit-card__ordinal">BÀI {unit.ordinal}</div>
                        <h4 className="curriculum-unit-card__title">{unit.title}</h4>
                        {unit.topic && <div className="curriculum-unit-card__topic">{unit.topic}</div>}
                      </div>
                    </div>

                    <div className="curriculum-unit-card__meta">
                      <Badge variant="primary">{unit.term_count} từ</Badge>
                      <ChevronRight size={18} style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // =========================================================================
  // VIEW 3: IN-LESSON STUDY & FLASHCARD VIEW (Học từ vựng trong bài đã chọn)
  // =========================================================================
  const course = courseDetailData?.course

  return (
    <div className="washi-page curriculum-study-shell">
      {/* 3.1 Compact Single-Row Study Bar */}
      <header className="curriculum-study-bar">
        <div className="curriculum-study-bar__left">
          <Button variant="ghost" size="sm" onClick={() => setSelectedUnitKey(null)}>
            <ArrowLeft size={16} /> Danh sách Bài học
          </Button>

          <span className="curriculum-study-bar__divider" aria-hidden="true" />

          <span className="curriculum-study-bar__seal" aria-hidden="true" lang="ja">
            第{currentUnitInfo?.ordinal || 1}課
          </span>

          <h2
            className="curriculum-study-bar__title"
            title={`${course?.title || ''} - ${currentUnitInfo?.title || `Bài ${currentUnitInfo?.ordinal || ''}`}${
              currentUnitInfo?.topic ? ` (${currentUnitInfo.topic})` : ''
            }`}
          >
            {course?.title} · {currentUnitInfo?.title || `Bài ${currentUnitInfo?.ordinal || ''}`}
          </h2>
        </div>

        <div className="curriculum-study-bar__right">
          <div
            className="curriculum-progress-badge"
            role="progressbar"
            aria-label={`Tiến độ bài học: ${savedCountInUnit} trên ${unitTotalTerms} từ`}
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            title={`Đã lưu ${savedCountInUnit} / ${unitTotalTerms} từ`}
            style={{ '--progress': `${progressPercent}%` } as React.CSSProperties}
          >
            <Check size={12} aria-hidden="true" />
            <span>
              {savedCountInUnit} / {unitTotalTerms} từ đã lưu ({progressPercent}%)
            </span>
          </div>

          {onGoToSrs && (
            <Button variant="secondary" size="sm" onClick={onGoToSrs}>
              <Layers size={14} /> Mở sổ tay ôn tập SRS
            </Button>
          )}
        </div>
      </header>

      {/* Auth / Login Notification Banner */}
      {authNotice && (
        <div className="curriculum-auth-banner" role="alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Info size={16} style={{ color: 'var(--color-warning)' }} aria-hidden="true" />
            <span>{authNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setAuthNotice(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              padding: '2px',
            }}
            aria-label="Đóng thông báo"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* SRS Error Banner */}
      {srsError && (
        <div
          className="curriculum-auth-banner"
          style={{
            background: 'var(--color-danger-subtle)',
            borderColor: 'var(--color-danger-border)',
          }}
          role="alert"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Info size={16} style={{ color: 'var(--color-danger-text)' }} aria-hidden="true" />
            <span>{srsError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSrsError(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              padding: '2px',
            }}
            aria-label="Đóng thông báo lỗi"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* 3.3 + 3.4 + 3.5: 2-COLUMN SPLIT STUDIO WORKSPACE */}
      <div className="lesson-split-workspace">
        <div className="lesson-split-workspace__stage">
          {!isTermsLoading && !isTermsError && words.length > 0 && (
            <div className="lesson-stage-wrapper">
              {stageMode === 'flashcard' && currentCard && (
                <div id="panel-study-flashcard" role="tabpanel" aria-labelledby="tab-study-flashcard">
                  {/* Card Frame with Integrated Progress Rail & Compact HUD */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-pressed={isFlipped}
                    aria-label={`Thẻ ghi nhớ ${currentCard.word}`}
                    className={`curriculum-flashcard${isFlipped ? ' is-flipped' : ''}`}
                    onClick={() => setIsFlipped((f) => !f)}
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault()
                        setIsFlipped((f) => !f)
                      }
                    }}
                  >
                    <div className="curriculum-flashcard__rail" aria-hidden="true">
                      <span
                        style={{
                          width: `${Math.round(((currentIndex + 1) / Math.max(1, flashcardDeck.length)) * 100)}%`,
                        }}
                      />
                    </div>

                    <div className="curriculum-flashcard__corners" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>

                    <div className="curriculum-flashcard__tategaki" aria-hidden="true" lang="ja">
                      <span>第{currentUnitInfo?.ordinal || 1}課 · 語彙札</span>
                      <span className="curriculum-flashcard__hanko">{isFlipped ? '裏' : '表'}</span>
                    </div>

                    {/* Top Bar inside Card */}
                    <div className="curriculum-flashcard__topbar">
                      <div className="curriculum-flashcard__topbar-left">
                        <div className="curriculum-flashcard__segment" role="group" aria-label="Chế độ mặt thẻ">
                          <button
                            type="button"
                            className={`curriculum-flashcard__seg-btn${cardContentMode === 'word' ? ' is-active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              setCardContentMode('word')
                            }}
                          >
                            Từ vựng
                          </button>
                          {currentCard.examples && currentCard.examples.length > 0 && (
                            <button
                              type="button"
                              className={`curriculum-flashcard__seg-btn${cardContentMode === 'example' ? ' is-active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                setCardContentMode('example')
                              }}
                            >
                              Câu ví dụ
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          className="curriculum-flashcard__pill"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedDictWord(currentCard.word)
                          }}
                          title="Tra từ điển"
                          aria-label="Tra từ điển"
                        >
                          <BookOpen size={12} aria-hidden="true" /> Tra từ điển
                        </button>
                      </div>

                      <div className="curriculum-flashcard__topbar-right">
                        <button
                          type="button"
                          className={`curriculum-flashcard__icon-btn${isShuffled ? ' is-active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleShuffleDeck()
                          }}
                          aria-pressed={isShuffled}
                          title={isShuffled ? 'Đang xáo trộn thẻ' : 'Xáo trộn thẻ'}
                          aria-label={isShuffled ? 'Đang xáo trộn thẻ' : 'Xáo trộn thẻ'}
                        >
                          <Shuffle size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={`curriculum-flashcard__icon-btn${playingAudioUrl ? ' is-active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            playAudio(currentCard.audioUrl, currentCard.word)
                          }}
                          title="Phát âm (Phím R)"
                          aria-label="Phát âm (Phím R)"
                        >
                          <Volume2 size={17} />
                        </button>

                        <button
                          type="button"
                          className={`curriculum-flashcard__icon-btn${isCurrentCardSaved ? ' is-saved' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleSaveWordToSrs(currentCard)
                          }}
                          title={isCurrentCardSaved ? 'Đã lưu trong SRS Flashcard' : 'Lưu vào SRS Flashcard (Phím C)'}
                          aria-label={
                            isCurrentCardSaved ? 'Đã lưu trong SRS Flashcard' : 'Lưu vào SRS Flashcard (Phím C)'
                          }
                        >
                          {isCurrentCardSaved ? <Check size={17} /> : <BookmarkPlus size={17} />}
                        </button>
                      </div>
                    </div>

                    {/* Middle Main Display */}
                    <div
                      key={`${currentCard.id}-${isFlipped ? 'back' : 'front'}`}
                      className="curriculum-flashcard__center curriculum-flashcard__flip-stage"
                    >
                      {(() => {
                        const currentCardKanjis = Array.from(
                          new Set(Array.from(currentCard.word).filter((ch) => /\p{Script=Han}/u.test(ch)))
                        )
                        if (cardContentMode === 'example') {
                          return (
                            <div style={{ maxWidth: '650px', margin: '0 auto' }}>
                              <div className="curriculum-flashcard__example-jp">
                                {currentCard.examples?.[0]?.jp || 'Không có câu ví dụ'}
                              </div>
                              {isFlipped && (
                                <div className="curriculum-flashcard__example-vi">{currentCard.examples?.[0]?.vi}</div>
                              )}
                            </div>
                          )
                        }
                        if (!isFlipped) {
                          return (
                            <>
                              <div className="curriculum-flashcard__word-stage">
                                <svg
                                  viewBox="0 0 220 220"
                                  className="curriculum-flashcard__enso"
                                  aria-hidden="true"
                                  fill="none"
                                >
                                  <path
                                    d="M 114 22 C 166 22, 198 58, 198 110 C 198 164, 158 198, 108 198 C 56 198, 22 162, 24 108 C 26 60, 62 28, 102 24"
                                    stroke="currentColor"
                                    strokeWidth="7"
                                    strokeLinecap="round"
                                  />
                                  <path
                                    d="M 124 25 C 172 30, 194 68, 192 114 C 190 158, 156 192, 106 193"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    opacity="0.55"
                                  />
                                </svg>
                                <div className="curriculum-flashcard__word">{currentCard.word}</div>
                                <div className="curriculum-flashcard__brush-rule" aria-hidden="true" />
                                <div className="curriculum-flashcard__front-meta">
                                  {currentCard.jlptLevel || course?.level || 'JP'} ·{' '}
                                  {currentCardKanjis.length > 0 ? `${currentCardKanjis.length} Hán tự` : 'Kana'}
                                  {currentCard.examples?.[0] ? ' · Có câu ví dụ' : ''}
                                </div>
                              </div>
                            </>
                          )
                        }
                        return (
                          <div className="curriculum-flashcard__back-spread">
                            <div className="curriculum-flashcard__back-header">
                              <span className="curriculum-flashcard__back-word">{currentCard.word}</span>
                              {currentCard.reading && (
                                <span className="curriculum-flashcard__reading">【{currentCard.reading}】</span>
                              )}
                              {currentCard.hanViet && (
                                <span className="curriculum-flashcard__hanviet">
                                  Hán Việt: <strong>{currentCard.hanViet}</strong>
                                </span>
                              )}
                            </div>

                            <div className="curriculum-flashcard__meaning">{currentCard.meaning}</div>

                            {currentCard.examples?.[0] && (
                              <div className="curriculum-flashcard__example-plate">
                                <div className="curriculum-flashcard__example-plate-text">
                                  <div lang="ja">{formatJpQuote(currentCard.examples[0].jp)}</div>
                                  {currentCard.examples[0].vi && <small>{currentCard.examples[0].vi}</small>}
                                </div>
                                <button
                                  type="button"
                                  className="curriculum-flashcard__example-audio"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    playAudio(undefined, currentCard.examples?.[0]?.jp || currentCard.word)
                                  }}
                                  title="Nghe câu ví dụ"
                                  aria-label="Nghe câu ví dụ"
                                >
                                  <Volume2 size={14} />
                                </button>
                              </div>
                            )}

                            {currentCardKanjis.length > 0 && (
                              <div className="curriculum-flashcard__kanji-stamps">
                                <span className="curriculum-flashcard__kanji-label">Chữ Hán:</span>
                                {currentCardKanjis.map((kanji) => (
                                  <button
                                    key={kanji}
                                    type="button"
                                    className="curriculum-flashcard__kanji-tile"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedDictWord(kanji)
                                    }}
                                    title={`Tra chữ Hán ${kanji}`}
                                    aria-label={`Tra chữ Hán ${kanji}`}
                                  >
                                    {kanji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {!isFlipped && (
                        <div className="curriculum-flashcard__cue">
                          <span aria-hidden="true">◇</span>
                          <span>Nhấn [Space] hoặc chạm để lật xem nghĩa</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Counter Bar */}
                    <div className="curriculum-flashcard__footer">
                      <span className="curriculum-flashcard__footer-meta">
                        <span>
                          Từ {(unitPage - 1) * PAGE_SIZE + currentIndex + 1} / {unitTotalTerms || words.length} (Trang{' '}
                          {unitPage} / {totalPages})
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Đã thuộc: <strong>{knownWords.length}</strong>
                        </span>
                      </span>
                      <span className="curriculum-flashcard__footer-keys">
                        Phím tắt: [Z] Đã thuộc • [X] Chưa thuộc • [Space] Lật • [R] Nghe • [C] Lưu SRS
                      </span>
                    </div>
                  </div>

                  {/* Navigation Controls under card */}
                  <div className="curriculum-flashcard-controls">
                    <Button
                      variant="ghost"
                      size="md"
                      className="curriculum-flashcard-controls__nav"
                      onClick={handlePrevCard}
                      disabled={currentIndex === 0 && unitPage <= 1}
                    >
                      <ChevronLeft size={18} /> Từ trước
                    </Button>
                    <Button
                      variant="danger"
                      size="md"
                      onClick={() => handleNextCard()}
                      disabled={currentIndex >= words.length - 1 && unitPage >= totalPages}
                    >
                      Chưa thuộc (X)
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => {
                        setKnownWords((prev) => [...new Set([...prev, currentCard.termId || String(currentCard.id)])])
                        handleNextCard()
                      }}
                    >
                      <Check size={16} aria-hidden="true" /> Đã thuộc (Z)
                    </Button>
                    <Button
                      variant="ghost"
                      size="md"
                      className="curriculum-flashcard-controls__nav"
                      onClick={handleNextCard}
                      disabled={currentIndex >= words.length - 1 && unitPage >= totalPages}
                    >
                      Tiếp theo <ChevronRight size={18} />
                    </Button>
                  </div>
                </div>
              )}

              {stageMode !== 'flashcard' && (
                <div id="panel-study-game" role="tabpanel" aria-labelledby={`tab-study-${stageMode}`}>
                  <LessonMiniGame
                    words={words}
                    activeMode={stageMode === 'karuta' ? 'karuta' : 'quiz'}
                    defaultAudioFirst={stageMode === 'listening'}
                    isTermSaved={isCurriculumTermSaved}
                    onSaveToSrs={handleSaveWordToSrs}
                    onSpeak={(text, url) => playAudio(url, text)}
                  />
                </div>
              )}
            </div>
          )}

          {/* 3.4 GAME & MODE DOCK DIRECTLY BELOW STAGE */}
          <div className="lesson-game-dock" role="tablist" aria-label="Chế độ học và Mini-Game">
            <button
              type="button"
              role="tab"
              id="tab-study-flashcard"
              aria-controls="panel-study-flashcard"
              aria-selected={stageMode === 'flashcard'}
              className={`lesson-dock-card${stageMode === 'flashcard' ? ' is-active' : ''}`}
              onClick={() => setStageMode('flashcard')}
            >
              <span className="lesson-dock-card__seal" aria-hidden="true">
                札
              </span>
              <span className="lesson-dock-card__text">
                <strong>Flashcard Bài Học</strong>
                <small>Lật thẻ ghi nhớ</small>
              </span>
            </button>

            <button
              type="button"
              role="tab"
              id="tab-study-quiz"
              aria-controls="panel-study-game"
              aria-selected={stageMode === 'quiz'}
              className={`lesson-dock-card${stageMode === 'quiz' ? ' is-active' : ''}`}
              onClick={() => setStageMode('quiz')}
            >
              <span className="lesson-dock-card__seal" aria-hidden="true">
                速
              </span>
              <span className="lesson-dock-card__text">
                <strong>Phản Xạ Nghĩa</strong>
                <small>Trắc nghiệm 4 chọn 1</small>
              </span>
            </button>

            <button
              type="button"
              role="tab"
              id="tab-study-karuta"
              aria-controls="panel-study-game"
              aria-selected={stageMode === 'karuta'}
              className={`lesson-dock-card${stageMode === 'karuta' ? ' is-active' : ''}`}
              onClick={() => setStageMode('karuta')}
            >
              <span className="lesson-dock-card__seal" aria-hidden="true">
                歌
              </span>
              <span className="lesson-dock-card__text">
                <strong>Ghép Thẻ Karuta</strong>
                <small>Đấu cặp Nhật – Việt</small>
              </span>
            </button>

            <button
              type="button"
              role="tab"
              id="tab-study-listening"
              aria-controls="panel-study-game"
              aria-selected={stageMode === 'listening'}
              className={`lesson-dock-card${stageMode === 'listening' ? ' is-active' : ''}`}
              onClick={() => setStageMode('listening')}
            >
              <span className="lesson-dock-card__seal" aria-hidden="true">
                聴
              </span>
              <span className="lesson-dock-card__text">
                <strong>Luyện Nghe</strong>
                <small>Nghe âm chọn nghĩa</small>
              </span>
            </button>
          </div>
        </div>

        {/* 3.5 RIGHT RAIL: ALWAYS-VISIBLE VOCABULARY LIST */}
        <section className="lesson-vocab-section lesson-vocab-rail" aria-label="Danh sách từ vựng bài học">
          <div className="lesson-vocab-rail__header">
            <div className="lesson-vocab-section__title-group">
              <span className="lesson-vocab-section__hanko" aria-hidden="true">
                語
              </span>
              <h3>Danh Sách ({totalTerms})</h3>
            </div>
            <div className="curriculum-unit-search">
              <Search size={15} className="curriculum-unit-search__icon" aria-hidden="true" />
              <input
                type="search"
                className="curriculum-unit-search__input"
                placeholder="Tìm từ, cách đọc, hán việt, ý nghĩa..."
                value={unitSearchQuery}
                onChange={(e) => {
                  setUnitSearchQuery(e.target.value)
                  setUnitPage(1)
                }}
                aria-label="Tìm kiếm từ vựng trong bài học"
              />
            </div>
          </div>

          <div id="panel-study-list" className="lesson-vocab-rail__body">
            {isTermsLoading ? (
              <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <p style={{ margin: 0 }}>Đang tải danh sách từ vựng...</p>
              </div>
            ) : isTermsError ? (
              <RetryState
                title="Chưa tải được từ vựng"
                description="Kiểm tra kết nối rồi thử lại."
                onRetry={() => void refetchTerms()}
              />
            ) : words.length === 0 ? (
              <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <p style={{ margin: '0 0 1rem 0' }}>Không tìm thấy từ vựng nào khớp với từ khóa "{unitSearchQuery}".</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setUnitSearchQuery('')
                    setUnitPage(1)
                  }}
                >
                  Xóa tìm kiếm
                </Button>
              </div>
            ) : (
              <>
                <div className="lesson-vocab-rail__list">
                  {paginatedWords.map((item, idx) => {
                    const globalIdx = (unitPage - 1) * PAGE_SIZE + idx + 1
                    const isSaved = isCurriculumTermSaved(item)
                    const isKnown = knownWords.includes(item.termId || String(item.id))
                    const isCurrentOnStage = stageMode === 'flashcard' && currentCard?.word === item.word
                    const loadOntoStage = () => {
                      setIsShuffled(false)
                      setShuffledOrder([])
                      setCurrentIndex(idx)
                      setIsFlipped(false)
                      setStageMode('flashcard')
                    }
                    return (
                      <div
                        key={item.id || idx}
                        className={`curriculum-term-row curriculum-term-row--rail${isCurrentOnStage ? ' is-current' : ''}`}
                      >
                        <div className="curriculum-term-row__top">
                          <div className="curriculum-term-row__identity-wrap">
                            <button
                              type="button"
                              className="curriculum-term-row__index-btn"
                              onClick={loadOntoStage}
                              title="Đưa từ này lên Flashcard"
                            >
                              #{globalIdx}
                            </button>

                            <button
                              type="button"
                              className="curriculum-term-row__identity-btn"
                              onClick={loadOntoStage}
                              title="Học từ này trên Flashcard"
                            >
                              <span className="curriculum-term-row__word">{item.word}</span>
                              {item.reading && <span className="curriculum-term-row__reading">【{item.reading}】</span>}
                              {item.hanViet && <span className="curriculum-term-row__hanviet">({item.hanViet})</span>}
                              {isKnown && (
                                <span
                                  className="curriculum-term-row__known-seal"
                                  title="Đã thuộc"
                                  aria-label="Đã thuộc"
                                >
                                  済
                                </span>
                              )}
                            </button>
                          </div>

                          <div className="curriculum-term-row__actions">
                            <button
                              type="button"
                              className="curriculum-term-row__icon-btn"
                              onClick={() => playAudio(item.audioUrl, item.word)}
                              title="Phát âm"
                              aria-label={`Phát âm từ ${item.word}`}
                            >
                              <Volume2 size={15} />
                            </button>

                            <button
                              type="button"
                              className="curriculum-term-row__icon-btn"
                              onClick={() => setSelectedDictWord(item.word)}
                              title="Chi tiết từ điển"
                              aria-label="Chi tiết từ điển"
                            >
                              <BookOpen size={15} aria-hidden="true" />
                            </button>

                            <button
                              type="button"
                              className={`curriculum-term-row__icon-btn curriculum-term-row__srs-btn${isSaved ? ' is-saved' : ''}`}
                              onClick={() => void handleSaveWordToSrs(item)}
                              title={isSaved ? 'Đã lưu trong SRS' : 'Lưu vào SRS'}
                              aria-label={isSaved ? 'Đã lưu' : '+ Thêm SRS'}
                            >
                              {isSaved ? <Check size={15} /> : <BookmarkPlus size={15} />}
                            </button>
                          </div>
                        </div>

                        <div className="curriculum-term-row__meaning">{item.meaning}</div>

                        {item.examples?.[0]?.jp && (
                          <div className="curriculum-term-row__example" lang="ja">
                            {formatJpQuote(item.examples[0].jp)}
                            {item.examples[0].vi ? ` — ${item.examples[0].vi}` : ''}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* In-Unit Pagination */}
                {totalPages > 1 && (
                  <div className="curriculum-pagination">
                    <span>
                      Hiển thị {(unitPage - 1) * PAGE_SIZE + 1} – {Math.min(unitPage * PAGE_SIZE, totalTerms)} trên tổng
                      số {totalTerms} từ
                    </span>
                    <div
                      style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={unitPage <= 1}
                        onClick={() => setUnitPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft size={15} /> Trước
                      </Button>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '0 0.5rem',
                          fontWeight: 600,
                        }}
                      >
                        Trang {unitPage} / {totalPages}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={unitPage >= totalPages}
                        onClick={() => setUnitPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Sau <ChevronRight size={15} />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {/* 3.6 DICTIONARY DETAIL MODAL */}
      {selectedDictWord && (
        <div
          className="curriculum-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Chi tiết từ điển"
          onClick={() => setSelectedDictWord(null)}
        >
          <div
            className="curriculum-modal-dialog"
            ref={dictionaryDialogRef}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="curriculum-modal-close-btn"
              onClick={() => setSelectedDictWord(null)}
              aria-label="Đóng chi tiết từ điển"
            >
              <X size={16} aria-hidden="true" />
            </button>

            {resolvedDictItem ? (
              <DictionaryWordDetail
                word={resolvedDictItem}
                results={[resolvedDictItem]}
                isSaved={isCurriculumTermSaved(activeDictCurriculumWord || { word: resolvedDictItem.word })}
                onSave={() => {
                  const matchingTerm = activeDictCurriculumWord || words.find((w) => w.word === resolvedDictItem.word)
                  if (matchingTerm) {
                    void handleSaveWordToSrs(matchingTerm)
                  }
                }}
                onSpeak={(text) => speakJapanese(text)}
                onSearch={(word) => setSelectedDictWord(word)}
              />
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                Đang tải thông tin từ điển...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default VocabularyPage
