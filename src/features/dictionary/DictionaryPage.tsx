import { useDialogAccessibility } from '../../lib/useDialogAccessibility'
import { useUrlState } from '../../lib/useUrlState'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card, EmptyState, Input } from '../../components/ui'
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  GraduationCap,
  Layers,
  Languages,
  Loader2,
  MessageCircleMore,
  MessageSquareText,
  RotateCcw,
  Search,
  Sparkles,
  X,
  Volume2,
} from 'lucide-react'
import { apiPaths, requestApi, type DictionarySearchResult, type DictionarySentenceAnalysis } from '../../lib/apiClient'
import { nhaikanjiApi } from '../nhaikanji/nhaikanjiApi'
import type { BunpoItem, KanjiSummary } from '../nhaikanji/nhaikanjiTypes'
import { KanjiDetailModal } from '../nhaikanji/KanjiDetailModal'
import { SumiECanvas } from './SumiECanvas'
import { SumiDropOpening } from './SumiDropOpening'
import { srsApi } from '../srs/srsApi'
import { useAuth } from '../auth/authContext'
import { DictionaryWordDetail } from './DictionaryWordDetail'
import { DictionarySentenceDetail } from './DictionarySentenceDetail'
import { DictionaryWordOfTheDay } from './DictionaryWordOfTheDay'
import { Link } from 'react-router-dom'

const POPULAR_SEARCHES = ['学校', '先生', '桜', '儚い', '木漏れ日', 'もののあわれ', '幽玄', '勉強']

const VocabularyPage = lazy(() => import('../vocabulary/VocabularyPage'))
const BunpoPage = lazy(() => import('../nhaikanji/BunpoPage').then((module) => ({ default: module.BunpoPage })))
const KanjiPage = lazy(() => import('../nhaikanji/KanjiPage').then((module) => ({ default: module.KanjiPage })))

function grammarLink(item: BunpoItem) {
  const params = new URLSearchParams({ tab: 'grammar', book: item.bookId, lesson: item.lessonId, point: item.id })
  return `?${params}`
}

// 4 chế độ khám phá khi chưa nhập từ khóa tìm kiếm (Explore Modes)
const EXPLORE_TABS = [
  { id: 'vocab' as const, label: 'Từ điển', icon: BookOpen },
  { id: 'vocabulary' as const, label: 'Tủ sách', icon: Layers },
  { id: 'kanji' as const, label: 'Hán tự', icon: Languages },
  { id: 'grammar' as const, label: 'Ngữ pháp & Mẫu câu', icon: GraduationCap },
] as const

type DictionaryTab = 'vocab' | 'vocabulary' | 'kanji' | 'grammar' | 'sentences' | 'all'

function isSentenceQuery(value: string) {
  const japaneseCharacters = value.match(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/gu)?.length ?? 0
  return (
    japaneseCharacters >= 6 &&
    (/[。！？!?]/.test(value) ||
      /[はがをにでとのもへ]([\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}])/u.test(value))
  )
}

function speakJapanese(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ja-JP'
  utterance.rate = 0.9
  window.speechSynthesis.speak(utterance)
}

export default function DictionaryPage({
  inputRef,
  onReview,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  onReview?: () => void
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const drawerRef = useRef<HTMLElement>(null)
  useDialogAccessibility(drawerRef, () => setIsDrawerOpen(false), isDrawerOpen)
  const [activeTab, setActiveTab] = useUrlState<DictionaryTab>('tab', 'vocab', [
    'vocab',
    'vocabulary',
    'kanji',
    'grammar',
    'sentences',
    'all',
  ])
  const [searchTerm, setSearchTerm] = useUrlState<string>('q', '')
  const [input, setInput] = useState(searchTerm)
  useEffect(() => setInput(searchTerm), [searchTerm])
  const [translateSentence, setTranslateSentence] = useState(false)
  const [selectedResultIndex, setSelectedResultIndex] = useState(0)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = window.localStorage.getItem('kotodama_dictionary_recent_searches')
      const parsed = saved ? JSON.parse(saved) : []
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 4) : []
    } catch {
      return []
    }
  })
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedSrs, setSavedSrs] = useState<Record<string, boolean>>({})

  // Kanji Search filters
  const [kanjiLevel, setKanjiLevel] = useState<string>('N5')
  const [kanjiView, setKanjiView] = useUrlState<'grid' | 'ink'>(
    'view',
    typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches ? 'grid' : 'ink',
    ['grid', 'ink']
  )
  const [selectedKanjiModal, setSelectedKanjiModal] = useState<KanjiSummary | null>(null)

  // Fetch saved terms from server
  const { data: savedTermsData } = useQuery({
    queryKey: ['srs', user?.id ?? 'me', 'saved-terms'],
    queryFn: () => srsApi.fetchSavedTerms(),
    enabled: Boolean(user),
    staleTime: 30_000,
  })

  // Sync server saved terms into local state
  useEffect(() => {
    if (!Array.isArray(savedTermsData)) return
    const map: Record<string, boolean> = {}
    for (const entry of savedTermsData) {
      if (entry?.term) {
        map[entry.term] = true
      }
    }
    setSavedSrs(map)
  }, [savedTermsData])

  // One-time auto-import from legacy localStorage if present
  useEffect(() => {
    if (!user?.id) return
    try {
      const raw = localStorage.getItem('kotodama_srs_deck')
      if (raw) {
        const items = JSON.parse(raw)
        if (Array.isArray(items) && items.length > 0) {
          Promise.all(
            items.map((item) =>
              srsApi.addCard({
                type: 'vocab',
                term: item.word || item.term,
                meaning: item.meaning || '',
                reading: item.reading || '',
              })
            )
          )
            .then(() => {
              localStorage.removeItem('kotodama_srs_deck')
              void queryClient.invalidateQueries({ queryKey: ['srs'] })
            })
            .catch(() => {})
        } else {
          localStorage.removeItem('kotodama_srs_deck')
        }
      }
    } catch {
      // ignore
    }
  }, [user?.id, queryClient])

  const handleSaveToSrs = async (word: string, meaning: string, reading: string) => {
    setSaveError(null)
    if (!user) {
      setSaveError('Đăng nhập để lưu từ vào thẻ ôn tập.')
      return
    }
    try {
      await srsApi.addCard({
        type: 'vocab',
        term: word,
        meaning,
        reading,
      })
      setSavedSrs((prev) => ({ ...prev, [word]: true }))
      await queryClient.invalidateQueries({ queryKey: ['srs'] })
    } catch {
      setSaveError('Chưa lưu được thẻ. Hãy thử lại khi kết nối ổn định.')
    }
  }

  const clearRecentSearches = () => {
    setRecentSearches([])
    try {
      window.localStorage.removeItem('kotodama_dictionary_recent_searches')
    } catch {
      // ignore
    }
  }

  const rememberSearch = (value: string) => {
    const normalized = value.trim()
    if (!normalized) return
    setRecentSearches((previous) => {
      const next = [normalized, ...previous.filter((item) => item !== normalized)].slice(0, 4)
      try {
        window.localStorage.setItem('kotodama_dictionary_recent_searches', JSON.stringify(next))
      } catch {
        // Keeping a search history is a convenience only.
      }
      return next
    })
  }

  // Auto-search debounced as user types
  useEffect(() => {
    const trimmed = input.trim()
    if (!trimmed) {
      setSearchTerm('')
      setTranslateSentence(false)
      return
    }
    setTranslateSentence(false)
    const timer = window.setTimeout(() => {
      setSearchTerm(trimmed)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [input, setSearchTerm])

  // Reset active result index when search term changes
  useEffect(() => {
    setSelectedResultIndex(0)
    setSaveError(null)
  }, [searchTerm])

  // 1. Query từ điển chung VNJP
  const sentenceSearch = isSentenceQuery(searchTerm)
  const { data, isLoading, isError } = useQuery<DictionarySearchResult | DictionarySentenceAnalysis>({
    queryKey: ['dictionary-search', searchTerm, sentenceSearch, translateSentence],
    queryFn: () =>
      requestApi<DictionarySearchResult | DictionarySentenceAnalysis>({
        url: sentenceSearch
          ? apiPaths.dictionary.analyze(searchTerm, translateSentence)
          : apiPaths.dictionary.search(searchTerm, 20),
      }),
    enabled: Boolean(searchTerm) && (activeTab === 'vocab' || activeTab === 'sentences' || activeTab === 'all'),
    staleTime: 1000 * 60 * 10,
  })

  // 2. Query danh sách Hán tự NhaiKanji khi ở tab "Hán tự" hoặc khi tìm kiếm ở tab "Tất cả"
  const {
    data: kanjiListData,
    isLoading: isKanjiListLoading,
    isError: isKanjiError,
    refetch: retryKanji,
  } = useQuery({
    queryKey: ['nhaikanji', 'kanjiList', searchTerm ? 'ALL' : kanjiLevel, searchTerm, activeTab === 'all' ? 6 : 120],
    queryFn: () =>
      nhaikanjiApi.fetchKanjiList({
        level: searchTerm ? 'ALL' : kanjiLevel,
        query: searchTerm,
        page: 1,
        limit: activeTab === 'all' ? 6 : 120,
        sort: 'default',
      }),
    enabled: (activeTab === 'kanji' && kanjiView === 'ink') || (Boolean(searchTerm) && activeTab === 'all'),
    staleTime: 1000 * 60 * 10,
    placeholderData: (previousData) => previousData,
  })

  // 3. Query Ngữ pháp Bunpo khi ở tab "Ngữ pháp" hoặc khi tìm kiếm ở tab "Tất cả"
  const {
    data: bunpoListData,
    isLoading: isBunpoLoading,
    isError: isBunpoError,
    refetch: retryBunpo,
  } = useQuery({
    queryKey: ['curriculum', 'dictionary-grammar', searchTerm],
    queryFn: async () => {
      const result = await srsApi.fetchCurriculumGrammar({
        query: searchTerm,
        limit: 30,
      })
      return {
        ...result,
        items: result.items.map((item) => ({
          id: item.id,
          pattern: item.pattern,
          structure: item.structure,
          shortMeaning: item.shortMeaning,
          bookId: item.curriculumCode,
          bookName: item.curriculumCode.replaceAll('_', ' '),
          lessonId: item.lessonId,
          lessonTitle: item.lessonTitle,
          level: item.level,
        })),
      }
    },
    enabled: Boolean(searchTerm) && (activeTab === 'grammar' || activeTab === 'all'),
    staleTime: 1000 * 60 * 10,
  })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = input.trim()
    if (trimmed) {
      setSearchTerm(trimmed)
      setTranslateSentence(isSentenceQuery(trimmed))
      rememberSearch(trimmed)
    }
  }

  const handleQuickSearch = (keyword: string) => {
    setInput(keyword)
    setSearchTerm(keyword)
    setTranslateSentence(false)
    rememberSearch(keyword)
  }

  const clearSearch = () => {
    setInput('')
    setSearchTerm('')
    setTranslateSentence(false)
    setSelectedResultIndex(0)
    if (activeTab === 'all' || activeTab === 'sentences') {
      setActiveTab('vocab')
    }
    inputRef.current?.focus()
  }

  const selectTab = (tab: DictionaryTab) => {
    setActiveTab(tab)
  }

  const results = data && 'results' in data ? data.results : []
  const sentenceAnalysis = data && 'tokens' in data ? data : null
  const primaryWord = results[selectedResultIndex] ?? results[0]

  // Counts for search scopes
  const vocabCount = results.length
  const kanjiCount = kanjiListData?.total ?? (primaryWord?.kanjis?.length || (searchTerm.length === 1 ? 1 : 0))
  const bunpoCount = bunpoListData?.items?.length ?? 0
  const sentenceCount = (primaryWord?.examples?.length || 0) + (sentenceAnalysis ? 1 : 0)
  const totalResultsCount = vocabCount + bunpoCount + (kanjiCount > 0 ? 1 : 0)

  // Dynamic Search Result Scopes (Morphs from Explore Tabs when query is active)
  const SEARCH_SCOPES = [
    { id: 'all' as const, label: 'Tất cả', count: totalResultsCount, icon: Sparkles },
    { id: 'vocab' as const, label: 'Mục từ', count: vocabCount, icon: BookOpen },
    { id: 'kanji' as const, label: 'Chữ Hán', count: kanjiCount, icon: Languages },
    { id: 'grammar' as const, label: 'Ngữ pháp', count: bunpoCount, icon: GraduationCap },
    { id: 'sentences' as const, label: 'Mẫu câu', count: sentenceCount, icon: MessageSquareText },
  ]

  const savedCount = Array.isArray(savedTermsData) ? savedTermsData.length : 0
  const { data: srsStats } = useQuery({
    queryKey: ['srs', user?.id, 'stats', 'dictionary'],
    queryFn: () => srsApi.fetchStats('all'),
    enabled: Boolean(user),
  })
  const srsProgress = srsStats?.averageMastery

  return (
    <section className="dictionary-page">
      {((activeTab === 'kanji' && kanjiView === 'ink' && isKanjiError) || (activeTab === 'grammar' && isBunpoError)) && (
        <div role="alert" className="ui-status-panel">
          <p>Chưa tải được nội dung. Hãy kiểm tra kết nối rồi thử lại.</p>
          <Button
            onClick={() => {
              if (activeTab === 'kanji') void retryKanji()
              else void retryBunpo()
            }}
          >
            Thử lại
          </Button>
        </div>
      )}
      <div className="dictionary-shell">
        <div className="dictionary-search-container">
          <form className="dictionary-querybar" onSubmit={submit}>
            <div className="dictionary-querybar__field">
              <Search aria-hidden="true" size={20} className="dictionary-querybar__search-icon" />
              <Input
                ref={inputRef}
                aria-label="Từ cần tra"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={
                  activeTab === 'kanji'
                    ? 'Tìm Kanji, âm Hán Việt, On/Kun hoặc nghĩa…'
                    : activeTab === 'grammar'
                      ? 'Tìm mẫu ngữ pháp tiếng Nhật…'
                      : activeTab === 'sentences'
                        ? 'Tìm mẫu câu chứa từ khóa…'
                        : 'Nhập Kanji, Kana, Romaji hoặc nghĩa tiếng Việt…'
                }
              />
              {input && (
                <button
                  className="dictionary-querybar__clear"
                  type="button"
                  onClick={clearSearch}
                  aria-label="Xóa từ đang tìm"
                >
                  <X aria-hidden="true" size={16} />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="dictionary-querybar__submit"
              title="Phân tích ngữ nghĩa (Nhấn Enter để tra cứu)"
              aria-label="Phân tích"
            >
              {isLoading || isKanjiListLoading || isBunpoLoading ? (
                <Loader2 aria-label="Đang tra cứu" size={18} className="animate-spin" />
              ) : (
                <>
                  <span className="dictionary-querybar__seal" aria-hidden="true">
                    析
                  </span>
                  <span className="dictionary-querybar__submit-text">Phân tích</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Suggestions Extracted Below Search */}
          <div className="dictionary-quick-suggestions" aria-label="Từ gợi ý nhanh">
            <span className="dictionary-quick-suggestions__label">Tra cứu nhanh:</span>
            <div className="dictionary-quick-suggestions__list">
              {POPULAR_SEARCHES.slice(0, 7).map((item, idx) => (
                <span key={item} className="dictionary-quick-suggestions__item">
                  <button
                    type="button"
                    className="dictionary-quick-suggestions__btn"
                    onClick={() => handleQuickSearch(item)}
                  >
                    {item}
                  </button>
                  {idx < 6 && (
                    <span className="dictionary-quick-suggestions__dot" aria-hidden="true">
                      ·
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Navigation Bar: Explore Modes vs Search Scopes */}
        <div
          className="dictionary-tabs"
          role="tablist"
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
            const current = tabs.indexOf(document.activeElement as HTMLButtonElement)
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? tabs.length - 1
                  : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
            event.preventDefault()
            tabs[next]?.focus()
            tabs[next]?.click()
          }}
          aria-label={searchTerm ? 'Phạm vi kết quả tìm kiếm' : 'Loại nội dung từ điển'}
        >
          {searchTerm
            ? SEARCH_SCOPES.map((tab) => {
                const Icon = tab.icon
                const selected = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    className={selected ? 'is-active' : ''}
                    onClick={() => selectTab(tab.id)}
                  >
                    <Icon aria-hidden="true" size={17} />
                    <span>{tab.label}</span>
                    {tab.count > 0 && <span className="dictionary-tab-count">{tab.count}</span>}
                  </button>
                )
              })
            : EXPLORE_TABS.map((tab) => {
                const Icon = tab.icon
                const selected = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    className={selected ? 'is-active' : ''}
                    onClick={() => selectTab(tab.id)}
                  >
                    <Icon aria-hidden="true" size={17} />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
        </div>

        <div
          className={`dictionary-workspace ${activeTab === 'kanji' || activeTab === 'vocabulary' ? 'is-kanji-art-mode' : ''}`}
        >
          <div className="dictionary-workspace__main">
            {/* 1. VIEW: TAB HÁN TỰ */}
            {activeTab === 'kanji' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="dictionary-view-switch" role="group" aria-label="Cách xem Hán tự">
                  <Button variant="secondary" aria-pressed={kanjiView === 'grid'} onClick={() => setKanjiView('grid')}>
                    Danh sách
                  </Button>
                  <Button variant="secondary" aria-pressed={kanjiView === 'ink'} onClick={() => setKanjiView('ink')}>
                    Thủy mặc
                  </Button>
                </div>
                {kanjiView === 'grid' ? (
                  <Suspense fallback={<p role="status">Đang mở kho Hán tự…</p>}>
                    <KanjiPage query={searchTerm} />
                  </Suspense>
                ) : !kanjiListData && isKanjiListLoading ? (
                  <SumiDropOpening />
                ) : kanjiListData && kanjiListData.items.length > 0 ? (
                  <SumiECanvas
                    items={kanjiListData.items}
                    activeLevel={kanjiLevel}
                    onSelectLevel={(lvl) => setKanjiLevel(lvl)}
                    onSelectKanji={(k) => setSelectedKanjiModal(k)}
                  />
                ) : (
                  <EmptyState
                    title={`Không tìm thấy Hán tự cho “${searchTerm || kanjiLevel}”`}
                    description="Hãy thử tìm bằng chữ Hán khác, âm Hán Việt (như gian, nhật, học) hoặc chọn cấp độ khác."
                  />
                )}
                {kanjiView === 'ink' && (kanjiListData?.total ?? 0) > 120 && (
                  <p>
                    Đang hiển thị 120 chữ.{' '}
                    <Button variant="ghost" onClick={() => setKanjiView('grid')}>
                      Xem toàn bộ trong danh sách
                    </Button>
                  </p>
                )}
              </div>
            )}

            {/* 2. VIEW: TAB NGỮ PHÁP */}
            {activeTab === 'grammar' && !searchTerm && (
              <Suspense fallback={<p role="status">Đang mở thư viện ngữ pháp…</p>}>
                <BunpoPage />
              </Suspense>
            )}
            {activeTab === 'grammar' && Boolean(searchTerm) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {isBunpoLoading ? (
                  <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                    <Loader2
                      size={36}
                      className="animate-spin"
                      style={{ margin: '0 auto', color: 'var(--color-accent-text)' }}
                    />
                    <p style={{ marginTop: '1rem', color: 'var(--color-text-secondary)' }}>Đang tra cứu ngữ pháp...</p>
                  </div>
                ) : bunpoListData && bunpoListData.items.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {bunpoListData.items.map((b: BunpoItem) => (
                      <Card
                        key={b.id}
                        padding="md"
                        style={{
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '10px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '1rem',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <span
                                style={{
                                  fontSize: '1.2rem',
                                  fontWeight: 800,
                                  fontFamily: 'var(--font-jp)',
                                  color: 'var(--color-accent-text)',
                                }}
                              >
                                {b.pattern}
                              </span>

                              {b.level && (
                                <Badge variant="primary" className="text-xs font-bold">
                                  {b.level}
                                </Badge>
                              )}
                            </div>
                            <div
                              style={{
                                fontSize: '0.92rem',
                                color: 'var(--color-text)',
                                marginTop: '0.35rem',
                                fontWeight: 600,
                              }}
                            >
                              {b.shortMeaning}
                            </div>
                            {b.structure && (
                              <div
                                style={{
                                  fontSize: '0.82rem',
                                  color: 'var(--color-text-muted)',
                                  marginTop: '0.25rem',
                                  fontFamily: 'var(--font-jp)',
                                }}
                              >
                                <strong>Cấu trúc:</strong> {b.structure}
                              </div>
                            )}
                          </div>
                          {b.bookName && (
                            <span
                              style={{
                                fontSize: '0.75rem',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--color-border)',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                color: 'var(--color-text-muted)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {b.bookName} • {b.lessonTitle}
                            </span>
                          )}
                        </div>
                        <Link to={grammarLink(b)}>
                          Mở bài học <ArrowRight size={14} aria-hidden="true" />
                        </Link>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title={`Không tìm thấy ngữ pháp cho “${searchTerm}”`}
                    description="Hãy thử nhập cấu trúc ngữ pháp như 'から', 'ても', 'んです' hoặc tìm theo nghĩa."
                  />
                )}
              </div>
            )}

            {/* 3. VIEW: TAB TỦ SÁCH (THƯ VIỆN GIÁO TRÌNH WATOJI) */}
            {activeTab === 'vocabulary' && (
              <Suspense
                fallback={
                  <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                    <Loader2
                      size={32}
                      className="animate-spin"
                      style={{ margin: '0 auto', color: 'var(--color-accent-text)' }}
                    />
                    <p style={{ marginTop: '1rem', color: 'var(--color-text-secondary)' }}>
                      Đang mở tủ sách Kotodama...
                    </p>
                  </div>
                }
              >
                <VocabularyPage {...(onReview ? { onGoToSrs: onReview } : {})} />
              </Suspense>
            )}

            {/* 4. VIEW: TAB TỪ ĐIỂN, TẤT CẢ, HOẶC CÂU VÍ DỤ */}
            {(activeTab === 'vocab' || activeTab === 'all' || activeTab === 'sentences') && (
              <>
                {/* Loading state */}
                {isLoading && (
                  <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                    <Loader2
                      size={36}
                      className="animate-spin"
                      style={{ margin: '0 auto', color: 'var(--color-accent-text)' }}
                    />
                    <p style={{ marginTop: '1rem', color: 'var(--color-text-secondary)' }}>
                      Đang tra cứu từ điển VNJP...
                    </p>
                  </div>
                )}

                {/* Zero State: Wabi-Sabi Word of the Day Stage */}
                {!searchTerm && !isLoading && (
                  <DictionaryWordOfTheDay onSearch={handleQuickSearch} onSpeak={speakJapanese} />
                )}

                {/* Empty result state */}
                {!isLoading && searchTerm && results.length === 0 && !sentenceAnalysis && !isError && (
                  <EmptyState
                    title={`Không tìm thấy kết quả cho “${searchTerm}”`}
                    description="Hãy thử kiểm tra lại chính tả hoặc thử tìm kiếm bằng Romaji hay chữ Hán gốc."
                  />
                )}

                {!isLoading && isError && (
                  <EmptyState
                    title="Chưa thể kết nối kho từ điển"
                    description="Kiểm tra kết nối rồi thử tra lại. Từ bạn vừa nhập vẫn được giữ nguyên trong ô tìm kiếm."
                    action={
                      <Button
                        onClick={() =>
                          void queryClient.invalidateQueries({ queryKey: ['dictionary-search', searchTerm] })
                        }
                      >
                        Thử lại
                      </Button>
                    }
                  />
                )}

                {/* Sentence Analysis View (if query was a whole Japanese sentence) */}
                {sentenceAnalysis && !isLoading && !isError && (
                  <DictionarySentenceDetail
                    analysis={sentenceAnalysis}
                    onSpeak={speakJapanese}
                    onSearch={handleQuickSearch}
                  />
                )}

                {/* Main Results: Classical Editorial Two-Column Spread */}
                {(activeTab === 'vocab' || activeTab === 'all') &&
                  !sentenceAnalysis &&
                  !isLoading &&
                  results.length > 0 &&
                  primaryWord && (
                    <div className="dictionary-editorial-spread">
                      {results.length > 1 && (
                        <aside className="dictionary-editorial-catalog" aria-label="Danh mục kết quả tra cứu">
                          <header className="dictionary-editorial-catalog__header">
                            <div className="dictionary-editorial-catalog__hanko" aria-hidden="true">
                              目
                            </div>
                            <div>
                              <h3 className="dictionary-editorial-catalog__title">MỤC LỤC TỪ ĐIỂN</h3>
                              <span className="dictionary-editorial-catalog__count">
                                {results.length} mục từ phù hợp
                              </span>
                            </div>
                          </header>
                          <nav className="dictionary-editorial-catalog__list" aria-label="Chọn kết quả tra cứu">
                            {results.map((item, index) => {
                              const isSelected = selectedResultIndex === index
                              return (
                                <button
                                  key={`${item.id}-${item.word}-${index}`}
                                  type="button"
                                  aria-pressed={isSelected}
                                  className={`dictionary-editorial-item ${isSelected ? 'is-active' : ''}`}
                                  onClick={() => setSelectedResultIndex(index)}
                                >
                                  <div className="dictionary-editorial-item__line">
                                    <span className="dictionary-editorial-item__word">{item.word}</span>
                                    {item.reading && (
                                      <span className="dictionary-editorial-item__reading">{item.reading}</span>
                                    )}
                                    {item.jlpt && <span className="dictionary-editorial-item__badge">{item.jlpt}</span>}
                                  </div>
                                  <p className="dictionary-editorial-item__meaning">
                                    {item.meanings[0] || 'Xem nghĩa chi tiết'}
                                  </p>
                                </button>
                              )
                            })}
                          </nav>
                        </aside>
                      )}

                      <section className={`dictionary-editorial-entry ${results.length <= 1 ? 'is-full-width' : ''}`}>
                        <DictionaryWordDetail
                          word={primaryWord}
                          results={results}
                          isSaved={Boolean(savedSrs[primaryWord.word])}
                          saveError={saveError}
                          onSave={() =>
                            handleSaveToSrs(primaryWord.word, primaryWord.meanings[0] || '', primaryWord.reading || '')
                          }
                          onSpeak={speakJapanese}
                          onSearch={handleQuickSearch}
                        />

                        {/* If in 'all' mode and matched Kanji exist, render companion Kanji strip */}
                        {activeTab === 'all' && kanjiListData && kanjiListData.items.length > 0 && (
                          <div className="dictionary-word-section" style={{ marginTop: '2.5rem' }}>
                            <h2>
                              <span className="dictionary-kanji-heading">漢</span> Chữ Hán liên quan (
                              {kanjiListData.items.length})
                            </h2>
                            <div className="dictionary-kanji-grid">
                              {kanjiListData.items.slice(0, 6).map((k) => (
                                <article
                                  key={k.kanji}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault()
                                      setSelectedKanjiModal(k)
                                    }
                                  }}
                                  className="dictionary-kanji-card"
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => setSelectedKanjiModal(k)}
                                  title={`Xem chi tiết chữ ${k.kanji}`}
                                >
                                  <strong>{k.kanji}</strong>
                                  <div className="dictionary-kanji-card__details">
                                    <div className="dictionary-kanji-card__row">
                                      <span>Hán Việt:</span>
                                      <b>{k.hanzi || '—'}</b>
                                    </div>
                                    <div className="dictionary-kanji-card__row">
                                      <span>Nghĩa:</span>
                                      <b>{k.meaning_vi || '—'}</b>
                                    </div>
                                    <div className="dictionary-kanji-card__row">
                                      <span>JLPT:</span>
                                      <b>{k.jlpt_level || '—'}</b>
                                    </div>
                                  </div>
                                </article>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* If in 'all' mode and matched Bunpo exist, render companion Grammar strip */}
                        {activeTab === 'all' && bunpoListData && bunpoListData.items.length > 0 && (
                          <div className="dictionary-word-section" style={{ marginTop: '2.5rem' }}>
                            <h2>
                              <GraduationCap size={18} /> Ngữ pháp liên quan ({bunpoListData.items.length})
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              {bunpoListData.items.slice(0, 4).map((b) => (
                                <div
                                  key={b.id}
                                  style={{
                                    padding: '0.75rem 1rem',
                                    borderLeft: '2.5px solid var(--color-accent)',
                                    background: 'var(--color-bg-subtle)',
                                    borderRadius: '0 6px 6px 0',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span
                                      style={{
                                        fontSize: '1.1rem',
                                        fontWeight: 800,
                                        fontFamily: 'var(--font-jp)',
                                        color: 'var(--color-accent-text)',
                                      }}
                                    >
                                      {b.pattern}
                                    </span>
                                    {b.level && <Badge variant="primary">{b.level}</Badge>}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '0.9rem',
                                      color: 'var(--color-text)',
                                      marginTop: '4px',
                                      fontWeight: 600,
                                    }}
                                  >
                                    {b.shortMeaning}
                                  </div>
                                  <Link to={grammarLink(b)}>Mở bài học</Link>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </section>
                    </div>
                  )}

                {/* Sentences Scope View */}
                {activeTab === 'sentences' && !sentenceAnalysis && !isLoading && results.length > 0 && (
                  <div className="dictionary-editorial-entry is-full-width">
                    <div className="dictionary-word-section">
                      <h2>
                        <MessageCircleMore size={18} /> Câu ví dụ cho “{searchTerm}”
                      </h2>
                      <div className="dictionary-examples">
                        {results
                          .flatMap((w) => w.examples || [])
                          .map((example, idx) => (
                            <article key={`${example.sentenceJp}-${idx}`} className="dictionary-example-item">
                              <div className="dictionary-example-body">
                                <div className="dictionary-example-jp">{example.sentenceJp}</div>
                                {example.furigana && (
                                  <small
                                    style={{
                                      color: 'var(--color-text-muted)',
                                      fontSize: '0.85rem',
                                      fontFamily: 'var(--font-jp)',
                                    }}
                                  >
                                    {example.furigana}
                                  </small>
                                )}
                                {example.sentenceVi && (
                                  <div className="dictionary-example-vi">
                                    <strong>VI</strong> {example.sentenceVi}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                className="dictionary-example-audio-btn"
                                onClick={() => speakJapanese(example.sentenceJp)}
                                aria-label="Nghe câu ví dụ"
                                title="Nghe phát âm câu ví dụ"
                              >
                                <Volume2 size={16} />
                              </button>
                            </article>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Floating Artisan Drawer Tab Handle (Right Edge) */}
      {activeTab !== 'kanji' && activeTab !== 'vocabulary' && (
        <button
          type="button"
          className="dictionary-drawer-trigger"
          onClick={() => setIsDrawerOpen(true)}
          aria-label="Mở sổ tay học & lịch sử tra cứu"
          title="Mở sổ tay học & lịch sử"
        >
          <span className="dictionary-drawer-trigger__hanko" aria-hidden="true">
            記
          </span>
          <span className="dictionary-drawer-trigger__label">SỔ TAY HỌC</span>
          {savedCount > 0 && <span className="dictionary-drawer-trigger__badge">{savedCount}</span>}
        </button>
      )}

      {/* Slide-over Artisan Drawer & Washi Backdrop */}
      {isDrawerOpen && (
        <>
          <div className="dictionary-drawer-backdrop" onClick={() => setIsDrawerOpen(false)} aria-hidden="true" />
          <aside
            className="dictionary-drawer"
            ref={drawerRef}
            tabIndex={-1}
            aria-label="Sổ tay học và lịch sử tra cứu"
            role="dialog"
            aria-modal="true"
          >
            <header className="dictionary-drawer__header">
              <div className="dictionary-drawer__title-group">
                <span className="dictionary-drawer__hanko" aria-hidden="true">
                  録
                </span>
                <h2 className="dictionary-drawer__title">SỔ TAY HỌC & LỊCH SỬ</h2>
              </div>
              <button
                type="button"
                className="dictionary-drawer__close"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Đóng sổ tay"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </header>

            <div className="dictionary-drawer__body">
              {/* TIER 1: SRS Study Ledger */}
              <section className="drawer-srs-block" aria-label="Tiến độ học SRS">
                <div className="drawer-srs-block__title-row">
                  <div className="drawer-srs-block__title">
                    <Bookmark aria-hidden="true" size={14} /> SỔ TAY SRS
                  </div>
                  <span className="drawer-srs-block__badge">SRS</span>
                </div>
                <div className="drawer-srs-block__stat">
                  <strong>{savedCount}</strong>
                  <span>mục đã lưu vào sổ tay</span>
                </div>
                <p className="drawer-srs-block__desc">
                  Thêm từ, mẫu câu hoặc Hán tự để hệ thống lập lịch ôn tập ngắt quãng (SRS).
                </p>
                <div
                  className="drawer-srs-block__progress-bar"
                  role="progressbar"
                  aria-label="Tiến độ sổ tay học"
                  aria-valuenow={srsProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${srsProgress ?? 0}%` }} />
                </div>
                <div className="drawer-srs-block__progress-labels">
                  <span>Tiến độ ghi nhớ</span>
                  <span>{srsProgress === undefined ? 'Chưa có dữ liệu' : `${srsProgress}%`}</span>
                </div>
                {onReview && (
                  <button type="button" onClick={onReview} className="drawer-srs-block__btn">
                    <RotateCcw aria-hidden="true" size={15} />
                    <span>Ôn tập ngay</span>
                  </button>
                )}
              </section>

              <div className="dictionary-drawer__divider" aria-hidden="true" />

              {/* TIER 2: Recent History (Orihon Ledger) */}
              <section className="orihon-history" aria-label="Đã tra gần đây">
                <div className="orihon-history__header">
                  <h3 className="orihon-history__title">
                    <RotateCcw aria-hidden="true" size={14} /> ĐÃ TRA GẦN ĐÂY
                  </h3>
                  {recentSearches.length > 0 && (
                    <button type="button" className="orihon-history__clear-btn" onClick={clearRecentSearches}>
                      Xóa
                    </button>
                  )}
                </div>
                {recentSearches.length > 0 ? (
                  <div>
                    {recentSearches.map((item, idx) => (
                      <button
                        key={item}
                        type="button"
                        className="orihon-history__item"
                        onClick={() => {
                          handleQuickSearch(item)
                          setIsDrawerOpen(false)
                        }}
                      >
                        <div className="orihon-history__left">
                          <span className="orihon-history__idx">0{idx + 1}</span>
                          <span className="orihon-history__text">{item}</span>
                        </div>
                        <ArrowRight aria-hidden="true" size={14} className="orihon-history__arrow" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="orihon-history__empty">
                    <p style={{ margin: 0 }}>Các mục bạn tra cứu sẽ xuất hiện tại đây.</p>
                  </div>
                )}
              </section>
            </div>
          </aside>
        </>
      )}

      {/* MODAL CHI TIẾT KANJI (KHI CLICK VÀO CARD TRONG GRID HÁN TỰ) */}
      {selectedKanjiModal && (
        <KanjiDetailModal
          kanjiSummary={selectedKanjiModal}
          onClose={() => setSelectedKanjiModal(null)}
          onSelectKanji={async (char) => {
            const target = kanjiListData?.items.find((item) => item.kanji === char)
            if (target) {
              setSelectedKanjiModal(target)
            } else {
              try {
                const res = await nhaikanjiApi.fetchKanjiList({ query: char, limit: 1 })
                if (res.items && res.items.length > 0 && res.items[0]) {
                  setSelectedKanjiModal(res.items[0])
                }
              } catch {
                // ignore
              }
            }
          }}
        />
      )}
    </section>
  )
}
