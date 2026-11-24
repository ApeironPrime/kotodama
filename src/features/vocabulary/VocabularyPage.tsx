import { usePersistentState } from '../../lib/usePersistentState'
import { useDialogAccessibility } from '../../lib/useDialogAccessibility'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { useUrlState } from '../../lib/useUrlState'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  BookmarkPlus,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Info,
  Layers,
  PanelRightClose,
  Search,
  Shuffle,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { Button } from '../../components/ui'
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
import { StudyInkAtmosphere } from './StudyInkAtmosphere'
import { sumiAudio } from '../dictionary/sumiAudio'
import { splitSentenceByKeyword } from './kanaRomaji'
import {
  isSoundEnabled,
  playPaperFlip,
  playSoftMiss,
  playStampSuccess,
  subscribeSoundEnabled,
  toggleSoundEnabled,
} from './soundEngine'

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

const RAW_PHRASE_MAP: Array<[RegExp, string]> = [
  [/同じ漢字を含む\s*名詞/g, 'Danh từ cùng Hán tự'],
  [/同じ漢字を含む\s*動詞/g, 'Động từ cùng Hán tự'],
  [/同じ漢字を含む/g, 'Cùng Hán tự'],
  [/似た意味の/g, 'Nghĩa tương đồng '],
  [/意味がたくさんある/g, 'Từ đa nghĩa '],
  [/カタカナ語/g, 'Từ Katakana'],
  [/ことば/g, 'Từ ngữ'],
]

const RAW_POS_MAP: Array<[RegExp, string]> = [
  [/い形容詞/g, 'Tính từ い'],
  [/な形容詞/g, 'Tính từ な'],
  [/複合動詞/g, 'Động từ ghép'],
  [/名詞/g, 'Danh từ'],
  [/動詞/g, 'Động từ'],
  [/形容詞/g, 'Tính từ'],
  [/副詞/g, 'Phó từ'],
  [/カタカナ/g, 'Katakana'],
  [/接続詞/g, 'Liên từ'],
  [/接辞/g, 'Tiếp tố'],
  [/慣用句/g, 'Quán dụng ngữ'],
]

const VI_NUMBER = new Intl.NumberFormat('vi-VN')

function formatViNumber(value: number): string {
  return VI_NUMBER.format(value)
}

function normalizeFullWidthAscii(text: string): string {
  return text
    .replace(/\u3000/g, ' ')
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
}

function readUnitKnownCount(storageKey: string): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return 0
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.length : 0
  } catch {
    return 0
  }
}

function computeCatalogProgressMap(
  userId: string,
  savedTerms?: Array<{ courseCode?: string; sourceContext?: string; term?: string; termId?: string }>
): Record<string, number> {
  const localByCourse: Record<string, number> = {}
  const prefix = `kotodama.known:${userId}:`
  if (typeof window !== 'undefined') {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (!key || !key.startsWith(prefix)) continue
        const rest = key.slice(prefix.length)
        const colonIdx = rest.indexOf(':')
        if (colonIdx <= 0) continue
        const courseCode = rest.slice(0, colonIdx)
        const count = readUnitKnownCount(key)
        if (count > 0) {
          localByCourse[courseCode] = (localByCourse[courseCode] || 0) + count
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  const srsSets: Record<string, Set<string>> = {}
  if (Array.isArray(savedTerms)) {
    for (const item of savedTerms) {
      const code = item.courseCode || (item.sourceContext ? item.sourceContext.split(':')[0] : '')
      if (!code) continue
      const key = item.termId || item.term || ''
      if (!key) continue
      if (!srsSets[code]) srsSets[code] = new Set<string>()
      srsSets[code].add(key)
    }
  }

  const merged: Record<string, number> = { ...localByCourse }
  for (const [code, set] of Object.entries(srsSets)) {
    merged[code] = Math.max(merged[code] || 0, set.size)
  }
  return merged
}

function formatEditorialUnit(rawTitle?: string, ordinal?: number, topic?: string) {
  const title = normalizeFullWidthAscii((rawTitle || '').trim())
  const chapter = title.match(/^Unit\s+(\d+)/i)?.[1] || String(ordinal || 1)
  const recap = title.startsWith('まとめ')
  const badge = recap ? '復' : chapter.padStart(2, '0')
  if (!title) {
    const fallback = topic || `Bài ${chapter}`
    return { title: fallback, tocTitle: fallback, japanese: '', badge, chapter, recap }
  }
  const looksTechnical =
    /\|/.test(title) ||
    /_\s*\[[^\]]+\]/.test(title) ||
    /^(?:Unit\s+\d+|まとめ)/i.test(title) ||
    /(?:名詞|動詞|形容詞|副詞|接続詞|同じ漢字|Phó từ[A-Z]|Danh từ[A-Z])/.test(title)
  if (!looksTechnical) return { title, tocTitle: title, japanese: '', badge, chapter, recap }

  const prefix = recap ? 'Ôn tập' : `Bài ${chapter}`
  const japanese = title
    .replace(/^(?:Unit\s+\d+|まとめ)\s*\|?\s*/i, '')
    .replace(/[_\s]*\[\d+\s*[-–〜～]\s*\d+\]\s*$/, '')
    .replace(/\s*\|\s*/g, ' · ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  let body = japanese
  for (const [pattern, viLabel] of RAW_PHRASE_MAP) {
    body = body.replace(pattern, viLabel)
  }
  for (const [pattern, viLabel] of RAW_POS_MAP) {
    body = body.replace(pattern, viLabel)
  }
  body = body
    .replace(/([A-Za-zÀ-ỹ])([A-Z])(?=\s*[+＋&]|$)/g, '$1 $2')
    .replace(/\s*[+＋]\s*/g, ' & ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (!body.includes('&') && /\s([A-Z])$/.test(body)) {
    body = body.replace(/\s([A-Z])$/, ' (Phần $1)')
  }
  const resolvedBody = body === japanese ? topic?.trim() || body : body
  const fullTitle = resolvedBody ? `${prefix} · ${resolvedBody}` : prefix
  const tocTitle = recap ? fullTitle : resolvedBody || prefix
  return {
    title: fullTitle,
    tocTitle,
    japanese: japanese === resolvedBody ? '' : japanese,
    badge,
    chapter,
    recap,
  }
}

const COMPACT_STUDY_QUERY = '(max-width: 767px)'

function subscribeCompactStudy(callback: () => void) {
  const media = window.matchMedia?.(COMPACT_STUDY_QUERY)
  media?.addEventListener('change', callback)
  return () => media?.removeEventListener('change', callback)
}

function VocabularyLedger({
  compact,
  onClose,
  children,
}: {
  compact: boolean
  onClose: () => void
  children: ReactNode
}) {
  const railRef = useRef<HTMLElement>(null)
  useDialogAccessibility(railRef, onClose, compact)
  const rail = (
    <section
      id="lesson-vocabulary-list"
      ref={railRef}
      className="lesson-vocab-section lesson-vocab-rail"
      role={compact ? 'dialog' : undefined}
      aria-modal={compact ? true : undefined}
      aria-label="Danh sách từ vựng bài học"
      onKeyDown={compact ? (event) => event.stopPropagation() : undefined}
      tabIndex={compact ? -1 : undefined}
    >
      {children}
    </section>
  )
  return compact
    ? createPortal(
        <div
          className="lesson-vocab-sheet"
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          {rail}
        </div>,
        document.body
      )
    : rail
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
  const [stageMode, setStageMode] = useState<'flashcard' | 'cloze' | 'karuta' | 'typing'>('flashcard')
  const [isShuffled, setIsShuffled] = useState(false)
  const [shuffledOrder, setShuffledOrder] = useState<number[]>([])
  const [unitSearchQuery, setUnitSearchQuery] = useState('')
  const debouncedUnitSearchQuery = useDebouncedValue(unitSearchQuery)
  const [unitPage, setUnitPage] = useState(1)

  // In-Lesson Flashcard State
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [hideListAnswers, setHideListAnswers] = useState(true)
  const [isLedgerCollapsed, setIsLedgerCollapsed] = useState(true)
  const isCompactStudy = useSyncExternalStore(
    subscribeCompactStudy,
    () => window.matchMedia?.(COMPACT_STUDY_QUERY)?.matches ?? false,
    () => false
  )
  const [stampBurstCount, setStampBurstCount] = useState(0)
  const [flipRippleCount, setFlipRippleCount] = useState(0)
  const [showStampFlash, setShowStampFlash] = useState(false)
  const stampTimerRef = useRef<number | null>(null)
  useEffect(() => {
    return () => {
      if (stampTimerRef.current) window.clearTimeout(stampTimerRef.current)
    }
  }, [])
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
  const pendingSrsSaves = useRef(new Set<string>())

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

  const speakStudyWord = useCallback((reading: string, url?: string) => playAudio(url, reading), [playAudio])

  const handleNextCard = useCallback(() => {
    setIsFlipped(false)
    if (currentIndex < words.length - 1) {
      setCurrentIndex((i) => i + 1)
    } else if (unitPage < totalPages) {
      setUnitPage((p) => p + 1)
      setCurrentIndex(0)
    }
  }, [currentIndex, words.length, unitPage, totalPages])

  const soundEnabled = useSyncExternalStore(subscribeSoundEnabled, isSoundEnabled, () => true)
  const [srsStampPop, setSrsStampPop] = useState(false)
  const srsStampTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (srsStampTimerRef.current) window.clearTimeout(srsStampTimerRef.current)
    }
  }, [])

  const handleCardRecall = useCallback(
    (known: boolean) => {
      if (!currentCard) return
      const id = currentCard.termId || String(currentCard.id)
      setKnownWords((prev) => (known ? [...new Set([...prev, id])] : prev.filter((termId) => termId !== id)))
      if (known) {
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
    },
    [currentCard, handleNextCard, setKnownWords]
  )

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
      const saveKey = JSON.stringify([user.id, item.sourceContext || item.word])
      if (isCurriculumTermSaved(item) || pendingSrsSaves.current.has(saveKey)) return
      pendingSrsSaves.current.add(saveKey)
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
        playStampSuccess()
        setSrsStampPop(true)
        if (srsStampTimerRef.current) window.clearTimeout(srsStampTimerRef.current)
        srsStampTimerRef.current = window.setTimeout(() => setSrsStampPop(false), 550)
        await queryClient.invalidateQueries({ queryKey: ['srs'] })
      } catch (err) {
        console.error('Không thể lưu từ vào SRS:', err)
        setSrsError('Không thể lưu từ vào SRS lúc này. Vui lòng thử lại sau.')
      } finally {
        pendingSrsSaves.current.delete(saveKey)
      }
    },
    [user, queryClient, isCurriculumTermSaved]
  )

  const handleMissedWord = useCallback(
    (item: CurriculumWord) => {
      const id = item.termId || String(item.id)
      setKnownWords((prev) => (prev.includes(id) ? prev.filter((termId) => termId !== id) : prev))
      if (user) void handleSaveWordToSrs(item)
    },
    [handleSaveWordToSrs, setKnownWords, user]
  )

  // Keyboard shortcut listener with strict input focus isolation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
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
        if (e.target instanceof Element && e.target.closest('button, a')) return
        e.preventDefault()
        playPaperFlip()
        setFlipRippleCount((c) => c + 1)
        setIsFlipped((f) => !f)
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        handleCardRecall(true)
      } else if (e.key === 'x' || e.key === 'X') {
        e.preventDefault()
        handleCardRecall(false)
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
  }, [selectedUnitKey, stageMode, currentCard, handleCardRecall, handleSaveWordToSrs, selectedDictWord, playAudio])

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
    const knownByCourseMap = computeCatalogProgressMap(user?.id ?? 'guest', savedTermsData)

    return (
      <div className="curriculum-container">
        {/* Washi Canvas Frame */}
        <div className="curriculum-paper-grid">
          {/* 1. Compact Unboxed Masthead (~92px) */}
          <header className="curriculum-masthead">
            <div className="curriculum-masthead__copy">
              <h1 className="curriculum-masthead__title">Thư viện Kotodama</h1>
              <p className="curriculum-masthead__sub">
                Tuyển tập giáo trình từ vựng chuẩn JLPT &amp; chuyên ngành — học qua ngữ cảnh, âm thanh và phản xạ.
              </p>
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
                  Sổ tay SRS: <strong>{formatViNumber(totalSavedCount)}</strong> từ
                </span>
                <span className="curriculum-hanko-srs-pill__action">Ôn tập ›</span>
              </button>
            )}
          </header>

          {/* 2. Synchronized Hairline Filter Tabs & Search */}
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
                  </div>

                  {/* 1. Unboxed Master Featured Book Spread (4 info tiers on Washi paper) */}
                  {featuredItem &&
                    (() => {
                      const featuredKnown = knownByCourseMap[featuredItem.course.course_code] || 0
                      const hasFeaturedProgress = featuredKnown > 0 && featuredItem.course.term_count > 0
                      const featuredPct = hasFeaturedProgress
                        ? Math.min(100, Math.max(4, Math.round((featuredKnown / featuredItem.course.term_count) * 100)))
                        : 0
                      const shortFeaturedPublisher =
                        featuredItem.meta.publisher.split('·')[0]?.trim() || featuredItem.meta.publisher
                      return (
                        <article
                          className={`curriculum-featured-spread${companionItems.length > 0 ? ' has-companion-below' : ''}`}
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
                            <div className="curriculum-featured-spread__cover-stack">
                              <WatojiBookCover
                                bookTitle={featuredItem.course.title}
                                size="featured"
                                variant={featuredItem.meta.coverVariant}
                                obiTone={featuredItem.meta.obiTone}
                                kanjiTitle={featuredItem.meta.kanjiTitle}
                                subtitle={featuredItem.meta.publisher}
                                volumeTag={featuredItem.meta.volumeTag}
                                level={featuredItem.course.level}
                                palette={featuredItem.meta.palette}
                                pattern={featuredItem.meta.pattern}
                                sealChar={featuredItem.meta.sealChar}
                              />
                              {hasFeaturedProgress && (
                                <div className="curriculum-book-progress-bar" aria-hidden="true">
                                  <span style={{ width: `${featuredPct}%` }} />
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="curriculum-featured-spread__content-pane">
                            <div className="curriculum-featured-spread__eyebrow-row">
                              <span className="curriculum-featured-spread__publisher">
                                {shortFeaturedPublisher} · {featuredItem.meta.levelDisplay}
                              </span>
                            </div>

                            <h3 className="curriculum-featured-spread__title">{featuredItem.course.title}</h3>
                            <p className="curriculum-featured-spread__desc">{featuredItem.meta.pedagogicalSubtitle}</p>

                            <div className="curriculum-featured-spread__footer">
                              <div className="curriculum-featured-spread__stats">
                                <span className="curriculum-featured-spread__stat-item">
                                  {featuredItem.course.unit_count} bài ·{' '}
                                  {formatViNumber(featuredItem.course.term_count)} từ
                                </span>
                                {hasFeaturedProgress && (
                                  <span className="curriculum-featured-spread__progress-text">
                                    · Đã thuộc {formatViNumber(Math.min(featuredKnown, featuredItem.course.term_count))}{' '}
                                    / {formatViNumber(featuredItem.course.term_count)} từ
                                  </span>
                                )}
                              </div>

                              <span className="curriculum-featured-spread__cta">Mở sách học tập →</span>
                            </div>
                          </div>
                        </article>
                      )
                    })()}

                  {/* 2. Vertical Standing Bookshelf Grid */}
                  {companionItems.length > 0 && (
                    <HorizontalBookshelf
                      trackTitle={track.title}
                      items={companionItems}
                      knownByCourse={knownByCourseMap}
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
            knownByCourse={knownByCourseMap}
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
    const openUnit = (unitKey: string, initialMode: 'flashcard' | 'cloze' | 'karuta' | 'typing' = 'flashcard') => {
      setSelectedUnitKey(unitKey)
      setStageMode(initialMode)
      setCurrentIndex(0)
      setIsFlipped(false)
      setUnitSearchQuery('')
      setUnitPage(1)
      setSelectedDictWord(null)
      setAuthNotice(null)
      setSrsError(null)
    }

    const srsByUnit: Record<string, Set<string>> = {}
    if (Array.isArray(savedTermsData)) {
      for (const s of savedTermsData) {
        const key = s.termId || s.term || ''
        if (!key) continue
        if (s.courseCode === selectedCourseCode && s.unitId) {
          const set = srsByUnit[s.unitId] ?? new Set<string>()
          set.add(key)
          srsByUnit[s.unitId] = set
        } else if (s.sourceContext && s.sourceContext.startsWith(`${selectedCourseCode}:`)) {
          const parts = s.sourceContext.split(':')
          const uId = parts.length >= 3 ? `${parts[0]}:${parts[1]}` : ''
          if (uId) {
            const set = srsByUnit[uId] ?? new Set<string>()
            set.add(key)
            srsByUnit[uId] = set
          }
        }
      }
    }

    const unitKnownCounts: Record<string, number> = {}
    let totalKnownInCourse = 0
    let maxProgressedOrdinal = 0
    for (const u of units) {
      const localCount = readUnitKnownCount(`kotodama.known:${user?.id ?? 'guest'}:${selectedCourseCode}:${u.unit_key}`)
      const srsCount = srsByUnit[u.unit_id]?.size || 0
      const kCount = Math.max(localCount, srsCount)
      unitKnownCounts[u.unit_key] = kCount
      if (kCount > 0 && u.ordinal > maxProgressedOrdinal) {
        maxProgressedOrdinal = u.ordinal
      }
      totalKnownInCourse += Math.min(kCount, u.term_count || kCount)
    }
    const courseTermTotal = course?.term_count || units.reduce((acc, u) => acc + u.term_count, 0)
    const courseProgressPct =
      courseTermTotal > 0 ? Math.min(100, Math.round((totalKnownInCourse / courseTermTotal) * 100)) : 0
    const resumeUnit =
      units.find((u) => {
        const cnt = unitKnownCounts[u.unit_key] || 0
        return cnt > 0 && cnt < u.term_count
      }) ||
      units.find((u) => u.ordinal > maxProgressedOrdinal && (unitKnownCounts[u.unit_key] || 0) < u.term_count) ||
      units.find((u) => (unitKnownCounts[u.unit_key] || 0) < u.term_count) ||
      units[0]

    return (
      <div className="curriculum-container washi-page curriculum-course-view">
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
            <div className="curriculum-toc-skeleton" role="status" aria-label="Đang tải danh sách bài học...">
              <div className="curriculum-skeleton-card" style={{ height: '64px' }} />
              <div className="curriculum-skeleton-card" style={{ height: '64px' }} />
              <div className="curriculum-skeleton-card" style={{ height: '64px' }} />
              <div className="curriculum-skeleton-card" style={{ height: '64px' }} />
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
                const displayTitle = courseMeta?.displayTitle || course.title
                const displayPublisher =
                  (courseMeta?.publisher || course.provider_source || '').split('·')[0]?.trim() ||
                  course.provider_source
                const editorialManifesto =
                  courseMeta?.methodQuote ||
                  courseMeta?.pedagogicalSubtitle ||
                  'Chọn một chương bên dưới để lật mở Flashcard, luyện phản xạ Karuta hoặc gõ âm đọc.'
                return (
                  <header className="curriculum-book-banner">
                    {courseMeta && (
                      <div className="curriculum-book-banner__cover">
                        <WatojiBookCover
                          bookTitle={displayTitle}
                          size="featured"
                          variant={courseMeta.coverVariant}
                          obiTone={courseMeta.obiTone}
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
                      <div className="curriculum-book-banner__eyebrow">
                        <span className="curriculum-level-badge" data-level={course.level}>
                          {course.level}
                        </span>
                        <span className="curriculum-book-banner__publisher">{displayPublisher}</span>
                      </div>
                      <h1 className="curriculum-book-banner__title">{displayTitle}</h1>
                      <p className="curriculum-book-banner__desc">{editorialManifesto}</p>

                      <div className="curriculum-course-progress" aria-label="Tiến độ toàn bộ giáo trình">
                        <div className="curriculum-course-progress__meta">
                          <span>
                            Đã thuộc <strong>{formatViNumber(totalKnownInCourse)}</strong> /{' '}
                            {formatViNumber(courseTermTotal)} từ
                          </span>
                          <span>{courseProgressPct}%</span>
                        </div>
                        <div className="curriculum-course-progress__track">
                          <div
                            className="curriculum-course-progress__fill"
                            style={{ width: `${courseProgressPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="curriculum-book-banner__footer">
                        <div className="curriculum-book-banner__stats">
                          <span className="curriculum-stat-pill">
                            <Layers size={13} aria-hidden="true" /> {course.unit_count} chương
                          </span>
                          <span className="curriculum-stat-pill">
                            <BookOpen size={13} aria-hidden="true" /> {formatViNumber(courseTermTotal)} từ vựng
                          </span>
                        </div>
                        {resumeUnit && (
                          <div className="curriculum-book-banner__actions">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => openUnit(resumeUnit.unit_key, 'flashcard')}
                            >
                              {totalKnownInCourse > 0
                                ? `Tiếp tục Bài ${resumeUnit.ordinal} →`
                                : `Bắt đầu Bài ${resumeUnit.ordinal} →`}
                            </Button>
                            <button
                              type="button"
                              className="curriculum-quick-mode-btn"
                              onClick={() => openUnit(resumeUnit.unit_key, 'karuta')}
                            >
                              Karuta · Bài {resumeUnit.ordinal}
                            </button>
                            <button
                              type="button"
                              className="curriculum-quick-mode-btn"
                              onClick={() => openUnit(resumeUnit.unit_key, 'typing')}
                            >
                              Gõ âm · Bài {resumeUnit.ordinal}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </header>
                )
              })()}

              <div className="curriculum-toc-header">
                <h2 className="curriculum-course-view__list-title">
                  <span className="curriculum-toc-kanji" aria-hidden="true">
                    目次
                  </span>
                  Mục lục bài học
                </h2>
                <span className="curriculum-toc-meta">
                  {units.length} chương · {formatViNumber(courseTermTotal)} từ
                </span>
              </div>

              <ol className="curriculum-toc-list">
                {units.map((unit) => {
                  const { tocTitle, japanese, chapter, recap } = formatEditorialUnit(
                    unit.title,
                    unit.ordinal,
                    unit.topic
                  )
                  const subtitle =
                    unit.topic && !tocTitle.includes(unit.topic) && unit.topic !== japanese ? unit.topic : ''
                  const known = Math.min(unitKnownCounts[unit.unit_key] || 0, unit.term_count)
                  const pct = unit.term_count > 0 ? Math.min(100, Math.round((known / unit.term_count) * 100)) : 0
                  const previews = unit.preview_terms?.slice(0, 3) || []
                  return (
                    <li key={unit.unit_id}>
                      <button
                        type="button"
                        className={`curriculum-toc-row${recap ? ' is-recap' : ''}`}
                        onClick={() => openUnit(unit.unit_key, 'flashcard')}
                      >
                        <span className="curriculum-toc-row__index" aria-hidden="true">
                          {recap ? '復習' : `第${chapter}課`}
                        </span>

                        <span className="curriculum-toc-row__main">
                          <span className="curriculum-toc-row__title">{tocTitle}</span>
                          {subtitle && <span className="curriculum-toc-row__subtitle">{subtitle}</span>}
                          {previews.length > 0 && (
                            <span className="curriculum-toc-row__previews" lang="ja">
                              {previews.join('  ·  ')}
                            </span>
                          )}
                        </span>

                        <span className="curriculum-toc-row__right">
                          <span className="curriculum-toc-progress">
                            <span className="curriculum-toc-progress__bar" aria-hidden="true">
                              <span style={{ width: `${pct}%` }} />
                            </span>
                            <span className="curriculum-toc-progress__label">
                              {formatViNumber(known)} / {formatViNumber(unit.term_count)} từ
                            </span>
                          </span>
                          <ChevronRight size={16} className="curriculum-toc-row__chevron" aria-hidden="true" />
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
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
  const studyUnit = formatEditorialUnit(currentUnitInfo?.title, currentUnitInfo?.ordinal, currentUnitInfo?.topic)
  const studyBook = normalizeFullWidthAscii(course?.title?.replace(/\s*\([^)]*\)\s*$/, '') || '')

  return (
    <div className="washi-page curriculum-study-shell">
      {/* 3.1 Compact Single-Row Study Bar */}
      <header className="curriculum-study-bar">
        <div className="curriculum-study-bar__left">
          <Button variant="ghost" size="sm" onClick={() => setSelectedUnitKey(null)} aria-label="Danh sách bài học">
            <ArrowLeft size={16} aria-hidden="true" /> {isCompactStudy ? 'Các bài học' : 'Danh sách bài học'}
          </Button>

          <button
            type="button"
            className="lesson-zen-shiori"
            onClick={() => setIsLedgerCollapsed(false)}
            aria-label="Mở danh sách từ vựng"
            aria-controls="lesson-vocabulary-list"
            aria-expanded={!isLedgerCollapsed}
          >
            <span className="lesson-zen-shiori__seal" aria-hidden="true">
              録
            </span>
            <span>Mục lục ({totalTerms})</span>
          </button>

          <span className="curriculum-study-bar__divider" aria-hidden="true" />

          <span className="curriculum-study-bar__seal" aria-hidden="true" lang="ja">
            {studyUnit.recap ? '復習' : `第${studyUnit.chapter}課`}
          </span>

          <h2
            className="curriculum-study-bar__title"
            title={`${course?.title || ''} - ${currentUnitInfo?.title || `Bài ${currentUnitInfo?.ordinal || ''}`}${
              currentUnitInfo?.topic ? ` (${currentUnitInfo.topic})` : ''
            }`}
          >
            {studyBook && (
              <span className="curriculum-study-bar__book">
                {studyBook}
                <span className="curriculum-study-bar__book-divider"> · </span>
              </span>
            )}
            {studyUnit.title}
          </h2>
        </div>

        <div className="curriculum-study-bar__right">
          <span className="curriculum-mastery-count">
            <Check size={14} aria-hidden="true" /> Đã thuộc {knownWords.length} / {unitTotalTerms} từ
          </span>
          <div className="curriculum-srs-count" title="Từ của bài này đã lưu để ôn tập">
            <BookmarkPlus size={14} aria-hidden="true" />
            <span>SRS · {savedCountInUnit} từ đã lưu</span>
          </div>
          <button
            type="button"
            className={`curriculum-sound-toggle${soundEnabled ? ' is-on' : ''}`}
            onClick={() => toggleSoundEnabled()}
            aria-pressed={soundEnabled}
            title="Bật hoặc tắt âm hiệu phòng học"
          >
            {soundEnabled ? <Volume2 size={13} aria-hidden="true" /> : <VolumeX size={13} aria-hidden="true" />}
            <span>Âm hiệu · {soundEnabled ? 'Bật' : 'Tắt'}</span>
          </button>

          {onGoToSrs && (
            <Button variant="secondary" size="sm" onClick={onGoToSrs}>
              <Layers size={14} aria-hidden="true" /> {isCompactStudy ? 'Ôn SRS' : 'Mở sổ tay ôn tập SRS'}
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
      <div className={`lesson-split-workspace${isLedgerCollapsed ? ' is-zen' : ''}`}>
        <div className="lesson-split-workspace__stage">
          {!isTermsLoading && !isTermsError && words.length > 0 && (
            <div className={`lesson-stage-wrapper${stageMode !== 'flashcard' ? ' lesson-stage-wrapper--game' : ''}`}>
              {stageMode === 'flashcard' &&
                currentCard &&
                (() => {
                  const currentCardKanjis = Array.from(
                    new Set(Array.from(currentCard.word).filter((ch) => /\p{Script=Han}/u.test(ch)))
                  )
                  const toggleCardFlip = () => {
                    sumiAudio.initOnGesture()
                    sumiAudio.playBrushFriction()
                    playPaperFlip()
                    setFlipRippleCount((c) => c + 1)
                    setIsFlipped((f) => !f)
                  }
                  return (
                    <div id="panel-study-flashcard" role="tabpanel" aria-labelledby="tab-study-flashcard">
                      <div className="kakejiku-stage">
                        {/* Slim Utility Icons ABOVE the Kakemono Rod (hover-reveal on desktop) */}
                        <div className="kakejiku-toolbar">
                          <div className="curriculum-flashcard__topbar-right">
                            <button
                              type="button"
                              className={`curriculum-flashcard__icon-btn${isShuffled ? ' is-active' : ''}`}
                              onClick={toggleShuffleDeck}
                              aria-pressed={isShuffled}
                              title={isShuffled ? 'Đang xáo trộn thẻ' : 'Xáo trộn thẻ'}
                              aria-label={isShuffled ? 'Đang xáo trộn thẻ' : 'Xáo trộn thẻ'}
                            >
                              <Shuffle size={15} aria-hidden="true" />
                            </button>

                            <button
                              type="button"
                              className={`curriculum-flashcard__icon-btn${isCurrentCardSaved ? ' is-saved' : ''}`}
                              onClick={() => void handleSaveWordToSrs(currentCard)}
                              title={
                                isCurrentCardSaved ? 'Đã lưu trong SRS Flashcard' : 'Lưu vào SRS Flashcard (Phím C)'
                              }
                              aria-label={
                                isCurrentCardSaved ? 'Đã lưu trong SRS Flashcard' : 'Lưu vào SRS Flashcard (Phím C)'
                              }
                            >
                              {isCurrentCardSaved ? <Check size={16} /> : <BookmarkPlus size={16} />}
                            </button>

                            <button
                              type="button"
                              className={`curriculum-flashcard__icon-btn curriculum-flashcard__icon-btn--audio${playingAudioUrl ? ' is-active' : ''}`}
                              onClick={() => playAudio(currentCard.audioUrl, currentCard.word)}
                              title="Phát âm (Phím R)"
                              aria-label="Phát âm (Phím R)"
                            >
                              <Volume2 size={14} aria-hidden="true" />
                              <span className="curriculum-flashcard__audio-label">
                                Nghe<span className="curriculum-study-shortcut"> [R]</span>
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Pure Kakejiku Hanging Scroll Frame */}
                        <div className="kakejiku-scroll">
                          <div className="kakejiku-rod kakejiku-rod--top" aria-hidden="true" />

                          <div
                            role="button"
                            tabIndex={0}
                            aria-pressed={isFlipped}
                            aria-label={`Thẻ ghi nhớ ${currentCard.word}`}
                            className={`curriculum-flashcard${isFlipped ? ' is-flipped' : ''}`}
                            onClick={toggleCardFlip}
                            onKeyDown={(e) => {
                              if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault()
                                toggleCardFlip()
                              }
                            }}
                          >
                            <img
                              src="/assets/study-scroll-sumie.jpg"
                              alt=""
                              aria-hidden="true"
                              className="kakejiku-art-bg"
                            />
                            <StudyInkAtmosphere burstTrigger={stampBurstCount} rippleTrigger={flipRippleCount} />

                            {showStampFlash && (
                              <div className="kakejiku-stamp-flash" aria-hidden="true">
                                済
                              </div>
                            )}

                            <div className="kakejiku-colophon" aria-hidden="true" lang="ja">
                              {currentCard.jlptLevel || course?.level || 'JP'} · 第{currentUnitInfo?.ordinal || 1}課 ·{' '}
                              {currentCardKanjis.length > 0 ? `${currentCardKanjis.length}字` : '仮名'}
                            </div>

                            <div className="curriculum-flashcard__tategaki" aria-hidden="true" lang="ja">
                              <span>語彙墨蹟</span>
                              <span className="curriculum-flashcard__hanko">{isFlipped ? '裏' : '表'}</span>
                            </div>

                            {/* Middle Main Display */}
                            <div
                              key={`${currentCard.id}-${isFlipped ? 'back' : 'front'}`}
                              className="curriculum-flashcard__center curriculum-flashcard__flip-stage"
                            >
                              {(() => {
                                if (!isFlipped) {
                                  return (
                                    <div className="curriculum-flashcard__word-stage">
                                      <div className="curriculum-flashcard__word">{currentCard.word}</div>
                                      <div className="curriculum-flashcard__brush-rule" aria-hidden="true" />
                                    </div>
                                  )
                                }
                                return (
                                  <div className="curriculum-flashcard__back-spread">
                                    <div className="curriculum-flashcard__back-header">
                                      <button
                                        type="button"
                                        className="curriculum-flashcard__back-word"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setSelectedDictWord(currentCard.word)
                                        }}
                                        title="Xem chi tiết trong từ điển"
                                      >
                                        {currentCard.word}
                                      </button>
                                      {currentCard.reading && (
                                        <span className="curriculum-flashcard__reading">【{currentCard.reading}】</span>
                                      )}
                                      <button
                                        type="button"
                                        className="curriculum-flashcard__back-audio"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          playAudio(currentCard.audioUrl, currentCard.reading || currentCard.word)
                                        }}
                                        aria-label="Nghe phát âm từ này"
                                      >
                                        <Volume2 size={13} aria-hidden="true" />
                                        <span>[R]</span>
                                      </button>
                                    </div>

                                    {currentCard.hanViet && (
                                      <div className="curriculum-flashcard__hanviet">
                                        <span>Hán Việt:</span> <strong>{currentCard.hanViet}</strong>
                                      </div>
                                    )}

                                    <div className="curriculum-flashcard__meaning">{currentCard.meaning}</div>

                                    {currentCard.examples?.[0] &&
                                      (() => {
                                        const firstEx = currentCard.examples[0]
                                        const split = splitSentenceByKeyword(firstEx.jp, currentCard.word)
                                        return (
                                          <div className="curriculum-flashcard__example-plate">
                                            <div className="curriculum-flashcard__example-plate-text">
                                              <div lang="ja">
                                                {split ? (
                                                  <>
                                                    <span>「{split.before}</span>
                                                    <mark className="curriculum-flashcard__example-kw">
                                                      {split.match}
                                                    </mark>
                                                    <span>{split.after}」</span>
                                                  </>
                                                ) : (
                                                  formatJpQuote(firstEx.jp)
                                                )}
                                              </div>
                                              {firstEx.vi && <small>{firstEx.vi}</small>}
                                            </div>
                                            <button
                                              type="button"
                                              className="curriculum-flashcard__example-audio"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                playAudio(undefined, firstEx.jp || currentCard.word)
                                              }}
                                              aria-label="Nghe câu ví dụ"
                                            >
                                              <Volume2 size={13} aria-hidden="true" />
                                            </button>
                                          </div>
                                        )
                                      })()}

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
                                <div
                                  className={`curriculum-flashcard__cue${unitPage === 1 && currentIndex === 0 ? ' is-first-card' : ''}`}
                                >
                                  <span aria-hidden="true">◇</span>
                                  <span>
                                    {isCompactStudy ? 'Chạm để xem nghĩa' : 'Nhấn [Space] hoặc chạm để lật xem nghĩa'}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Bottom Counter Bar */}
                            <div className="curriculum-flashcard__footer">
                              <span className="curriculum-flashcard__footer-meta">
                                <span>
                                  Từ {(unitPage - 1) * PAGE_SIZE + currentIndex + 1} / {totalTerms}
                                </span>
                              </span>
                              <span className="curriculum-flashcard__footer-keys">
                                Phím tắt: [Z] Đã thuộc • [X] Chưa thuộc • [Space] Lật • [R] Nghe • [C] Lưu SRS
                              </span>
                              {isFlipped && (
                                <button
                                  type="button"
                                  className={`curriculum-flashcard__corner-srs${isCurrentCardSaved ? ' is-saved' : ''}${
                                    srsStampPop ? ' is-popping' : ''
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void handleSaveWordToSrs(currentCard)
                                  }}
                                  aria-label={isCurrentCardSaved ? 'Đã đóng dấu lưu SRS' : 'Đóng dấu lưu SRS (Phím C)'}
                                >
                                  <span className="curriculum-flashcard__corner-seal" aria-hidden="true">
                                    済
                                  </span>
                                  <span>
                                    {isCurrentCardSaved ? (
                                      'Đã lưu SRS'
                                    ) : (
                                      <>
                                        Lưu SRS<span className="curriculum-study-shortcut"> [C]</span>
                                      </>
                                    )}
                                  </span>
                                </button>
                              )}
                            </div>
                            <div className="curriculum-flashcard__rail" aria-hidden="true">
                              <span
                                style={{
                                  width: `${(((unitPage - 1) * PAGE_SIZE + currentIndex + 1) / totalTerms) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                          <div className="kakejiku-rod kakejiku-rod--bottom" aria-hidden="true" />
                        </div>
                      </div>

                      {/* Navigation Controls under card */}
                      <div className="curriculum-flashcard-controls">
                        <Button
                          variant="ghost"
                          size="md"
                          className="curriculum-flashcard-controls__nav"
                          aria-label="Từ trước"
                          onClick={handlePrevCard}
                          disabled={currentIndex === 0 && unitPage <= 1}
                        >
                          <ChevronLeft size={18} aria-hidden="true" /> <span>Từ trước</span>
                        </Button>
                        <Button
                          variant="danger"
                          size="md"
                          className="curriculum-flashcard-controls__miss"
                          aria-label="Chưa thuộc"
                          aria-keyshortcuts={isCompactStudy ? undefined : 'X'}
                          onClick={() => handleCardRecall(false)}
                        >
                          <span>
                            Chưa thuộc<span className="curriculum-study-shortcut"> (X)</span>
                          </span>
                        </Button>
                        <Button
                          variant="primary"
                          size="md"
                          className="curriculum-flashcard-controls__pass"
                          aria-label="Đã thuộc"
                          aria-keyshortcuts={isCompactStudy ? undefined : 'Z'}
                          onClick={() => handleCardRecall(true)}
                        >
                          <Check size={16} aria-hidden="true" />{' '}
                          <span>
                            Đã thuộc<span className="curriculum-study-shortcut"> (Z)</span>
                          </span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="md"
                          className="curriculum-flashcard-controls__nav"
                          aria-label="Tiếp theo"
                          onClick={handleNextCard}
                          disabled={currentIndex >= words.length - 1 && unitPage >= totalPages}
                        >
                          <span>Tiếp theo</span> <ChevronRight size={18} aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  )
                })()}

              {stageMode !== 'flashcard' && (
                <div
                  id="panel-study-game"
                  className="lesson-game-panel"
                  role="tabpanel"
                  aria-labelledby={`tab-study-${stageMode}`}
                >
                  <LessonMiniGame
                    words={words}
                    activeMode={stageMode}
                    isTermSaved={isCurriculumTermSaved}
                    onSaveToSrs={handleSaveWordToSrs}
                    onMissedWord={handleMissedWord}
                    onSpeak={speakStudyWord}
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
              aria-label={isCompactStudy ? 'Flashcard Bài Học' : undefined}
              aria-controls="panel-study-flashcard"
              aria-selected={stageMode === 'flashcard'}
              className={`lesson-dock-card${stageMode === 'flashcard' ? ' is-active' : ''}`}
              onClick={() => setStageMode('flashcard')}
            >
              <span className="lesson-dock-card__seal" aria-hidden="true">
                札
              </span>
              <span className="lesson-dock-card__text">
                <strong>{isCompactStudy ? 'Flashcard' : 'Flashcard Bài Học'}</strong>
                {!isCompactStudy && <small>Lật thẻ ghi nhớ</small>}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              id="tab-study-cloze"
              aria-label={isCompactStudy ? 'Điền Từ Văn Cảnh' : undefined}
              aria-controls="panel-study-game"
              aria-selected={stageMode === 'cloze'}
              className={`lesson-dock-card${stageMode === 'cloze' ? ' is-active' : ''}`}
              onClick={() => setStageMode('cloze')}
            >
              <span className="lesson-dock-card__seal" aria-hidden="true">
                文
              </span>
              <span className="lesson-dock-card__text">
                <strong>{isCompactStudy ? 'Điền từ' : 'Điền Từ Văn Cảnh'}</strong>
                {!isCompactStudy && <small>Đục lỗ ngữ cảnh câu</small>}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              id="tab-study-karuta"
              aria-label={isCompactStudy ? 'Đấu Trường Karuta' : undefined}
              aria-controls="panel-study-game"
              aria-selected={stageMode === 'karuta'}
              className={`lesson-dock-card${stageMode === 'karuta' ? ' is-active' : ''}`}
              onClick={() => setStageMode('karuta')}
            >
              <span className="lesson-dock-card__seal" aria-hidden="true">
                歌
              </span>
              <span className="lesson-dock-card__text">
                <strong>{isCompactStudy ? 'Karuta' : 'Đấu Trường Karuta'}</strong>
                {!isCompactStudy && <small>Nghe âm đập thẻ Kanji</small>}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              id="tab-study-typing"
              aria-label={isCompactStudy ? 'Gõ Âm Đọc' : undefined}
              aria-controls="panel-study-game"
              aria-selected={stageMode === 'typing'}
              className={`lesson-dock-card${stageMode === 'typing' ? ' is-active' : ''}`}
              onClick={() => setStageMode('typing')}
            >
              <span className="lesson-dock-card__seal" aria-hidden="true">
                筆
              </span>
              <span className="lesson-dock-card__text">
                <strong>{isCompactStudy ? 'Gõ âm' : 'Gõ Âm Đọc'}</strong>
                {!isCompactStudy && <small>Tự gõ Kana / Romaji</small>}
              </span>
            </button>
          </div>
        </div>

        {/* 3.5 RIGHT RAIL: STITCHED ORIHON MANUSCRIPT LEDGER OR ZEN SHIORI TAB */}
        {!isLedgerCollapsed && (
          <VocabularyLedger compact={isCompactStudy} onClose={() => setIsLedgerCollapsed(true)}>
            <div className="lesson-vocab-rail__header">
              <div className="lesson-vocab-rail__header-top">
                <div className="lesson-vocab-section__title-group">
                  <span className="lesson-vocab-section__hanko" aria-hidden="true">
                    語
                  </span>
                  <h3>Mục lục từ vựng ({totalTerms})</h3>
                </div>

                <div className="lesson-vocab-rail__header-tools">
                  <button
                    type="button"
                    className={`lesson-vocab-rail__tool-btn${hideListAnswers ? ' is-active' : ''}`}
                    onClick={() => setHideListAnswers((v) => !v)}
                    aria-pressed={hideListAnswers}
                    title="Che phiên âm & nghĩa để tránh lộ đáp án khi học Flashcard"
                  >
                    {hideListAnswers ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}
                    <span>{hideListAnswers ? 'Che đáp án' : 'Đang hiện'}</span>
                  </button>
                  <button
                    type="button"
                    className="lesson-vocab-rail__collapse-btn"
                    onClick={() => setIsLedgerCollapsed(true)}
                    title="Thu gọn danh sách (Chế độ tập trung Zen)"
                    aria-label="Thu gọn danh sách"
                  >
                    {isCompactStudy ? (
                      <X size={18} aria-hidden="true" />
                    ) : (
                      <PanelRightClose size={15} aria-hidden="true" />
                    )}
                  </button>
                </div>
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
                  <div className="lesson-vocab-rail__list">
                    {paginatedWords.map((item, idx) => {
                      const globalIdx = (unitPage - 1) * PAGE_SIZE + idx + 1
                      const isSaved = isCurriculumTermSaved(item)
                      const isKnown = knownWords.includes(item.termId || String(item.id))
                      const isCurrentOnStage = stageMode === 'flashcard' && currentCard?.word === item.word
                      const shouldVeilAnswer =
                        stageMode === 'flashcard' && hideListAnswers && !isKnown && !(isCurrentOnStage && isFlipped)
                      const loadOntoStage = () => {
                        setIsShuffled(false)
                        setShuffledOrder([])
                        setCurrentIndex(idx)
                        setIsFlipped(false)
                        setStageMode('flashcard')
                        if (isCompactStudy) setIsLedgerCollapsed(true)
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
                                {item.reading && (
                                  <span
                                    className={`curriculum-term-row__reading${shouldVeilAnswer ? ' is-answer-veiled' : ''}`}
                                  >
                                    【{item.reading}】
                                  </span>
                                )}
                                {item.hanViet && (
                                  <span
                                    className={`curriculum-term-row__hanviet${shouldVeilAnswer ? ' is-answer-veiled' : ''}`}
                                  >
                                    ({item.hanViet})
                                  </span>
                                )}
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
                                onClick={() => {
                                  if (isCompactStudy) setIsLedgerCollapsed(true)
                                  setSelectedDictWord(item.word)
                                }}
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

                          <div className={`curriculum-term-row__meaning${shouldVeilAnswer ? ' is-answer-veiled' : ''}`}>
                            {item.meaning}
                          </div>

                          {item.examples?.[0]?.jp && (
                            <div
                              className={`curriculum-term-row__example${shouldVeilAnswer ? ' is-answer-veiled' : ''}`}
                              lang="ja"
                            >
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
                        Hiển thị {(unitPage - 1) * PAGE_SIZE + 1} – {Math.min(unitPage * PAGE_SIZE, totalTerms)} trên
                        tổng số {totalTerms} từ
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          gap: '0.5rem',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
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
          </VocabularyLedger>
        )}
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
