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

interface LevelGroupDef {
  id: string
  title: string
  levels: string[]
  badgeText: string
  desc: string
}

const LEVEL_GROUPS: LevelGroupDef[] = [
  {
    id: 'A1/A2',
    title: 'Sơ cấp Nhập môn (A1 / A2)',
    levels: ['A1', 'A2'],
    badgeText: 'A1 / A2',
    desc: 'Làm quen bảng chữ cái, phát âm cơ bản và các mẫu câu giao tiếp đời sống hàng ngày.',
  },
  {
    id: 'N5',
    title: 'Sơ cấp JLPT N5',
    levels: ['N5'],
    badgeText: 'N5',
    desc: 'Nền tảng từ vựng cơ bản, sinh hoạt hàng ngày và chuẩn bị bước vào các kỳ thi năng lực.',
  },
  {
    id: 'N4',
    title: 'Sơ Trung cấp JLPT N4',
    levels: ['N4'],
    badgeText: 'N4',
    desc: 'Mở rộng vốn từ đàm thoại, hội thoại thực tế và diễn đạt ngữ cảnh tự nhiên.',
  },
  {
    id: 'N3',
    title: 'Trung cấp JLPT N3',
    levels: ['N3'],
    badgeText: 'N3',
    desc: 'Chuyển tiếp từ giao tiếp cơ bản sang đọc hiểu văn bản đời sống và công việc.',
  },
  {
    id: 'N2',
    title: 'Trung Thượng cấp JLPT N2',
    levels: ['N2'],
    badgeText: 'N2',
    desc: 'Từ vựng chuyên sâu, sắc thái tinh tế thường dùng trong công việc, báo chí và hội họp.',
  },
  {
    id: 'N1',
    title: 'Cao cấp JLPT N1',
    levels: ['N1'],
    badgeText: 'N1',
    desc: 'Vốn từ học thuật, thành ngữ, văn phong xã hội và biểu đạt ngôn ngữ đỉnh cao.',
  },
  {
    id: 'SE',
    title: 'Chuyên Ngành CNTT (SE IT)',
    levels: ['SE'],
    badgeText: 'SE IT',
    desc: 'Từ vựng chuyên ngành kỹ thuật phần mềm, quản lý dự án và giao tiếp spec kỹ thuật.',
  },
]

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

export function VocabularyPage({ onGoToSrs }: { onGoToSrs?: () => void }) {
  // Navigation level: 'catalog' -> 'lessons' -> 'study'
  const [selectedCourseCode, setSelectedCourseCode] = useState<string | null>(null)
  const [selectedUnitKey, setSelectedUnitKey] = useState<string | null>(null)
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // In-Unit study mode: list (default) or flashcard
  const [studyMode, setStudyMode] = useState<'flashcard' | 'list'>('list')
  const [unitSearchQuery, setUnitSearchQuery] = useState('')
  const [unitPage, setUnitPage] = useState(1)
  const [cardContentMode, setCardContentMode] = useState<'word' | 'example'>('word')

  // In-Lesson Flashcard State
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const { user } = useAuth()
  const [, setKnownWords] = useState<Set<number>>(new Set())
  const [savedSrs, setSavedSrs] = useState<Record<string, boolean>>({})
  const [selectedDictWord, setSelectedDictWord] = useState<string | null>(null)
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
    queryKey: ['curriculum', 'catalog', selectedLevelFilter, searchQuery],
    queryFn: () => {
      const apiLevel = selectedLevelFilter === 'A1/A2' || selectedLevelFilter === 'ALL' ? undefined : selectedLevelFilter
      return curriculumApi.fetchCatalog({
        level: apiLevel,
        q: searchQuery || undefined,
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
  const { data: termsData, isLoading: isTermsLoading } = useQuery({
    queryKey: ['curriculum', 'unit-terms', selectedCourseCode, selectedUnitKey, unitPage, unitSearchQuery.trim()],
    queryFn: () => {
      if (!selectedCourseCode || !selectedUnitKey) throw new Error('Yêu cầu khóa học và bài học')
      return curriculumApi.fetchUnitTerms(selectedCourseCode, selectedUnitKey, {
        page: unitPage,
        limit: 20,
        q: unitSearchQuery.trim() || undefined,
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

  const currentUnitId = currentUnitInfo?.unit_id || (selectedCourseCode && selectedUnitKey ? `${selectedCourseCode}:${selectedUnitKey}` : '')
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

  const progressPercent =
    unitTotalTerms > 0 ? Math.min(100, Math.round((savedCountInUnit / unitTotalTerms) * 100)) : 0

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

  const currentCard = words[currentIndex] || null
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

      if (!selectedUnitKey || studyMode !== 'flashcard' || !currentCard) return

      if (e.code === 'Space') {
        e.preventDefault()
        setIsFlipped((f) => !f)
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        setKnownWords((prev) => new Set(prev).add(currentCard.id))
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
  }, [selectedUnitKey, studyMode, currentCard, words.length, handleSaveWordToSrs, selectedDictWord])

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

    // Group items into defined LEVEL_GROUPS
    const activeGroups = LEVEL_GROUPS.map((group) => {
      const coursesInGroup = filteredItems.filter((course) => group.levels.includes(course.level))
      return {
        ...group,
        courses: coursesInGroup,
      }
    }).filter((group) => {
      if (selectedLevelFilter !== 'ALL') {
        return group.id === selectedLevelFilter
      }
      return group.courses.length > 0
    })

    const totalMatchingCourses = filteredItems.length

    return (
      <div className="curriculum-container">
        {/* Paper Grid Canvas Frame */}
        <div className="curriculum-paper-grid">
          {/* Hero Header */}
          <header className="curriculum-hero">
            <div className="curriculum-hero__eyebrow">
              <Sparkles size={14} aria-hidden="true" />
              THƯ VIỆN GIÁO TRÌNH TIẾNG NHẬT
            </div>
            <h1 className="curriculum-hero__title">Học bản chất – không học vẹt</h1>
            <p className="curriculum-hero__desc">
              Khám phá các bộ giáo trình từ vựng theo chuẩn JLPT và khung CEFR/SE. Lựa chọn cấp độ, duyệt bài học và
              tích lũy từ vựng bền vững cùng phương pháp lặp lại ngắt quãng SRS.
            </p>
          </header>

          {/* Search & Level Filter Toolbar */}
          <div className="curriculum-toolbar">
            <div
              className="curriculum-level-filters"
              role="tablist"
              aria-label="Lọc theo cấp độ giáo trình"
            >
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
                    {tab.label}
                  </button>
                )
              })}
            </div>

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
          </div>

          {/* Loading Skeleton State */}
          {isCatalogLoading && (
            <div className="curriculum-course-grid" role="status" aria-label="Đang tải danh mục giáo trình...">
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

          {/* Level Groups & Sketch Cards */}
          {!isCatalogLoading &&
            !isCatalogError &&
            activeGroups.map((group) => (
              <section
                key={group.id}
                className="curriculum-level-section"
                data-level={group.levels[0]}
                aria-labelledby={`heading-group-${group.id}`}
              >
                <div className="curriculum-level-section__header">
                  <div className="curriculum-level-section__indicator" aria-hidden="true" />
                  <h2 id={`heading-group-${group.id}`} className="curriculum-level-section__title">
                    {group.title}
                  </h2>
                  <span className="curriculum-level-section__count">({group.courses.length} giáo trình)</span>
                </div>

                <div className="curriculum-course-grid" role="list">
                  {group.courses.map((course) => (
                    <div
                      key={course.course_code}
                      className="curriculum-sketch-card"
                      data-level={course.level}
                      tabIndex={0}
                      role="button"
                      aria-label={`Khóa học ${course.title}, cấp độ ${course.level}`}
                      onClick={() => {
                        setSelectedCourseCode(course.course_code)
                        setSelectedUnitKey(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedCourseCode(course.course_code)
                          setSelectedUnitKey(null)
                        }
                      }}
                    >
                      <div className="curriculum-sketch-card__top">
                        <div>
                          <span className="curriculum-sketch-card__provider">
                            {course.provider_source || 'Giáo trình chuẩn'}
                          </span>
                          <h3 className="curriculum-sketch-card__title">{course.title}</h3>
                        </div>
                        <span className="curriculum-level-badge">{course.level}</span>
                      </div>

                      <p className="curriculum-sketch-card__desc">
                        {course.description ||
                          `Giáo trình từ vựng cấp độ ${course.level} được phân chia theo bài học ngữ cảnh sinh động.`}
                      </p>

                      <div className="curriculum-sketch-card__bottom">
                        <div className="curriculum-sketch-card__stats">
                          <span className="curriculum-stat-pill">
                            <Layers size={13} aria-hidden="true" />
                            {course.unit_count} bài học
                          </span>
                          <span className="curriculum-stat-pill">
                            <BookOpen size={13} aria-hidden="true" />
                            {course.term_count} từ vựng
                          </span>
                        </div>
                        <span className="curriculum-sketch-card__action">
                          Xem bài học <ChevronRight size={16} aria-hidden="true" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
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
      <div className="curriculum-container">
        <div className="curriculum-paper-grid">
          <button
            type="button"
            className="curriculum-unit-view__back-btn"
            onClick={() => setSelectedCourseCode(null)}
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
              <header className="curriculum-unit-view__header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                  <span className="curriculum-level-badge" data-level={course.level}>
                    {course.level}
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    {course.provider_source}
                  </span>
                </div>
                <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-text)' }}>
                  {course.title}
                </h1>
                <p style={{ margin: '0 0 1rem 0', color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
                  {course.description || 'Chọn một bài học dưới đây để bắt đầu học Flashcard hoặc xem danh sách từ vựng chi tiết.'}
                </p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <span className="curriculum-stat-pill">
                    <Layers size={13} aria-hidden="true" /> {course.unit_count} bài học
                  </span>
                  <span className="curriculum-stat-pill">
                    <BookOpen size={13} aria-hidden="true" /> {course.term_count} từ vựng
                  </span>
                </div>
              </header>

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
                    <div>
                      <div className="curriculum-unit-card__ordinal">BÀI {unit.ordinal}</div>
                      <h4 className="curriculum-unit-card__title">{unit.title}</h4>
                      {unit.topic && <div className="curriculum-unit-card__topic">{unit.topic}</div>}
                    </div>

                    <div className="curriculum-unit-card__meta">
                      <Badge variant="primary" className="text-xs font-bold">
                        {unit.term_count} từ
                      </Badge>
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
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      {/* 3.1 Top Navigation Bar */}
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
        <Button variant="ghost" size="sm" onClick={() => setSelectedUnitKey(null)}>
          <ArrowLeft size={16} /> Danh sách Bài học
        </Button>

        {onGoToSrs && (
          <Button variant="secondary" size="sm" onClick={onGoToSrs}>
            <Layers size={15} /> Mở Thẻ Ôn Tập Anki
          </Button>
        )}
      </div>

      {/* 3.2 Unit Header & Real Progress Bar */}
      <header className="curriculum-study-header">
        <div>
          <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)' }}>
            {course?.title} - {currentUnitInfo?.title || `Bài ${currentUnitInfo?.ordinal || ''}`}
          </h2>
          {currentUnitInfo?.topic && (
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              Chủ đề: {currentUnitInfo.topic}
            </div>
          )}
        </div>

        <div
          className="curriculum-progress-container"
          aria-label={`Tiến độ bài học: ${savedCountInUnit} trên ${unitTotalTerms} từ`}
        >
          <div
            className="curriculum-progress-bar-track"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            title={`Đã lưu ${savedCountInUnit} / ${unitTotalTerms} từ`}
          >
            <div className="curriculum-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="curriculum-progress-badge">
            <Check size={12} aria-hidden="true" />
            {savedCountInUnit} / {unitTotalTerms} từ đã lưu ({progressPercent}%)
          </span>
        </div>
      </header>

      {/* Auth / Login Notification Banner */}
      {authNotice && (
        <div className="curriculum-auth-banner" role="alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Info size={16} style={{ color: '#d97706' }} aria-hidden="true" />
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
          style={{ background: 'rgb(239 68 68 / 12%)', borderColor: 'rgb(239 68 68 / 35%)' }}
          role="alert"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Info size={16} style={{ color: '#dc2626' }} aria-hidden="true" />
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

      {/* 3.3 In-Unit Toolbar: Search & Mode Tabs */}
      <div className="curriculum-unit-toolbar">
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

        <div className="curriculum-mode-tabs" role="tablist" aria-label="Chế độ học">
          <button
            type="button"
            role="tab"
            id="tab-study-list"
            aria-controls="panel-study-list"
            aria-selected={studyMode === 'list'}
            className={`curriculum-mode-tab${studyMode === 'list' ? ' curriculum-mode-tab--active' : ''}`}
            onClick={() => setStudyMode('list')}
          >
            <BookOpen size={16} aria-hidden="true" />
            Danh Sách ({totalTerms})
          </button>
          <button
            type="button"
            role="tab"
            id="tab-study-flashcard"
            aria-controls="panel-study-flashcard"
            aria-selected={studyMode === 'flashcard'}
            className={`curriculum-mode-tab${studyMode === 'flashcard' ? ' curriculum-mode-tab--active' : ''}`}
            onClick={() => setStudyMode('flashcard')}
          >
            <Layers size={16} aria-hidden="true" />
            Flashcard Bài Học
          </button>
        </div>
      </div>

      {/* 3.4 LAYER 1: IN-LESSON VOCABULARY LIST TABLE (Default view for progressive enhancement) */}
      {studyMode === 'list' && (
        <div
          id="panel-study-list"
          role="tabpanel"
          aria-labelledby="tab-study-list"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '16px',
            overflow: 'hidden',
          }}
        >
          {isTermsLoading ? (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <p style={{ margin: 0 }}>Đang tải danh sách từ vựng...</p>
            </div>
          ) : words.length === 0 ? (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <p style={{ margin: '0 0 1rem 0' }}>
                Không tìm thấy từ vựng nào khớp với từ khóa "{unitSearchQuery}".
              </p>
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
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {paginatedWords.map((item, idx) => {
                  const globalIdx = (unitPage - 1) * PAGE_SIZE + idx + 1
                  const isSaved = isCurriculumTermSaved(item)
                  return (
                    <div key={item.id || idx} className="curriculum-term-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                        <span
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: 'var(--color-text-muted)',
                            minWidth: '28px',
                          }}
                        >
                          #{globalIdx}
                        </span>

                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>
                              {item.word}
                            </span>
                            {item.reading && (
                              <span style={{ fontSize: '0.95rem', color: '#2563eb', fontWeight: 600 }}>
                                【{item.reading}】
                              </span>
                            )}
                            {item.hanViet && (
                              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                ({item.hanViet})
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.92rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                            {item.meaning}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => playAudio(item.audioUrl, item.word)}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--color-border)',
                            borderRadius: '8px',
                            padding: '6px',
                            color: 'var(--color-text-secondary)',
                            cursor: 'pointer',
                          }}
                          title="Phát âm"
                          aria-label={`Phát âm từ ${item.word}`}
                        >
                          <Volume2 size={16} />
                        </button>

                        <button
                          type="button"
                          className="curriculum-dict-btn"
                          onClick={() => setSelectedDictWord(item.word)}
                          title="Xem chi tiết trong từ điển"
                        >
                          <BookOpen size={13} aria-hidden="true" />
                          Chi tiết từ điển
                        </button>

                        <Button
                          variant={isSaved ? 'secondary' : 'primary'}
                          size="sm"
                          onClick={() => void handleSaveWordToSrs(item)}
                        >
                          {isSaved ? <Check size={14} /> : <BookmarkPlus size={14} />}
                          {isSaved ? 'Đã lưu' : '+ Thêm SRS'}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* In-Unit Pagination */}
              {totalPages > 1 && (
                <div className="curriculum-pagination">
                  <span>
                    Hiển thị {(unitPage - 1) * PAGE_SIZE + 1} –{' '}
                    {Math.min(unitPage * PAGE_SIZE, totalTerms)} trên tổng số {totalTerms} từ
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
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
      )}

      {/* 3.5 LAYER 2: IN-LESSON FLASHCARD CONTAINER (Enhanced mode) */}
      {studyMode === 'flashcard' && currentCard && (
        <div
          id="panel-study-flashcard"
          role="tabpanel"
          aria-labelledby="tab-study-flashcard"
          style={{ marginBottom: '2.5rem' }}
        >
          {/* Card Frame */}
          <div
            onClick={() => setIsFlipped((f) => !f)}
            style={{
              minHeight: '340px',
              background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
              border: '2px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              padding: '2.5rem 2rem',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
              textAlign: 'center',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.3)',
              position: 'relative',
              userSelect: 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {/* Top Bar inside Card */}
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setCardContentMode('word')
                  }}
                  style={{
                    background: cardContentMode === 'word' ? 'var(--color-accent)' : 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#ffffff',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Từ vựng
                </button>
                {currentCard.examples && currentCard.examples.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setCardContentMode('example')
                    }}
                    style={{
                      background: cardContentMode === 'example' ? 'var(--color-accent)' : 'rgba(255, 255, 255, 0.1)',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#ffffff',
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Câu ví dụ
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedDictWord(currentCard.word)
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#ffffff',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Tra từ điển"
                >
                  <BookOpen size={12} aria-hidden="true" /> Tra từ điển
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    playAudio(currentCard.audioUrl, currentCard.word)
                  }}
                  style={{
                    background: playingAudioUrl ? 'var(--color-accent)' : 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    cursor: 'pointer',
                  }}
                  title="Phát âm (Phím R)"
                >
                  <Volume2 size={18} />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void handleSaveWordToSrs(currentCard)
                  }}
                  style={{
                    background: isCurrentCardSaved
                      ? 'rgba(16, 185, 129, 0.2)'
                      : 'rgba(255, 255, 255, 0.1)',
                    border: isCurrentCardSaved ? '1px solid #10b981' : 'none',
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isCurrentCardSaved ? '#10b981' : '#ffffff',
                    cursor: 'pointer',
                  }}
                  title={isCurrentCardSaved ? 'Đã lưu trong SRS Flashcard' : 'Lưu vào SRS Flashcard (Phím C)'}
                  aria-label={isCurrentCardSaved ? 'Đã lưu trong SRS Flashcard' : 'Lưu vào SRS Flashcard (Phím C)'}
                >
                  {isCurrentCardSaved ? <Check size={18} /> : <BookmarkPlus size={18} />}
                </button>
              </div>
            </div>

            {/* Middle Main Display */}
            <div style={{ margin: 'auto 0' }}>
              {cardContentMode === 'word' ? (
                <>
                  <div style={{ fontSize: '3rem', fontWeight: 800, color: '#ffffff', letterSpacing: '0.05em' }}>
                    {currentCard.word}
                  </div>
                  {isFlipped && (
                    <div style={{ marginTop: '1rem', animation: 'fadeIn 0.2s ease' }}>
                      {currentCard.reading && (
                        <div style={{ fontSize: '1.4rem', color: '#93c5fd', fontWeight: 600 }}>
                          【{currentCard.reading}】
                        </div>
                      )}
                      {currentCard.hanViet && (
                        <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
                          Hán Việt: <strong style={{ color: '#ffffff' }}>{currentCard.hanViet}</strong>
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: '1.3rem',
                          color: '#f8fafc',
                          fontWeight: 700,
                          marginTop: '0.6rem',
                          maxWidth: '600px',
                        }}
                      >
                        {currentCard.meaning}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ maxWidth: '650px' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 600, color: '#ffffff', lineHeight: 1.6 }}>
                    {currentCard.examples?.[0]?.jp || 'Không có câu ví dụ'}
                  </div>
                  {isFlipped && (
                    <div
                      style={{
                        fontSize: '1.15rem',
                        color: '#93c5fd',
                        marginTop: '1rem',
                        lineHeight: 1.5,
                        animation: 'fadeIn 0.2s ease',
                      }}
                    >
                      {currentCard.examples?.[0]?.vi}
                    </div>
                  )}
                </div>
              )}

              {!isFlipped && (
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '1.5rem' }}>
                  Nhấn [Space] hoặc chạm để lật xem nghĩa
                </div>
              )}
            </div>

            {/* Bottom Counter Bar */}
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                Từ {(unitPage - 1) * PAGE_SIZE + currentIndex + 1} / {unitTotalTerms || words.length} (Trang {unitPage} / {totalPages})
              </span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Phím tắt: [Z] Đã thuộc • [X] Chưa thuộc • [Space] Lật • [R] Nghe • [C] Lưu SRS
              </span>
            </div>
          </div>

          {/* Navigation Controls under card */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1.25rem' }}>
            <Button
              variant="secondary"
              size="md"
              onClick={handlePrevCard}
              disabled={currentIndex === 0 && unitPage <= 1}
            >
              <ChevronLeft size={18} /> Từ trước
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleNextCard}
              disabled={currentIndex >= words.length - 1 && unitPage >= totalPages}
            >
              Tiếp theo <ChevronRight size={18} />
            </Button>
          </div>
        </div>
      )}

      {/* 3.6 DICTIONARY DETAIL MODAL */}
      {selectedDictWord && (
        <div
          className="curriculum-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Chi tiết từ điển"
          onClick={() => setSelectedDictWord(null)}
        >
          <div className="curriculum-modal-dialog" onClick={(e) => e.stopPropagation()}>
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
                isSaved={isCurriculumTermSaved(
                  activeDictCurriculumWord || { word: resolvedDictItem.word }
                )}
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
