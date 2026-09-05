import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Card, EmptyState, Input } from '../../components/ui'
import {
  ArrowRight,
  Bookmark,
  BookmarkPlus,
  BookOpen,
  Check,
  Layers,
  Loader2,
  PenTool,
  Search,
  Sparkles,
  Volume2,
} from 'lucide-react'
import { apiPaths, requestApi, type DictionarySearchResult } from '../../lib/apiClient'
import { nhaikanjiApi } from '../nhaikanji/nhaikanjiApi'
import type { BunpoItem, KanjiSummary, KanjiVocabExample } from '../nhaikanji/nhaikanjiTypes'
import { KanjiCanvas } from '../nhaikanji/KanjiCanvas'
import { KanjiDetailModal } from '../nhaikanji/KanjiDetailModal'
import { srsApi } from '../srs/srsApi'
import { useAuth } from '../auth/authContext'

const POPULAR_SEARCHES = ['学校', '先生', '勉強', '食べる', '感じ', '日本語', '桜', '時間', '犬', '雨']
const JLPT_LEVELS = ['ALL', 'N5', 'N4', 'N3', 'N2', 'N1'] as const

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
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  onReview?: () => void
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'vocab' | 'kanji' | 'grammar' | 'sentences'>('vocab')
  const [input, setInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [savedWordIds, setSavedWordIds] = useState<Set<number>>(new Set())
  const [savedSrs, setSavedSrs] = useState<Record<string, boolean>>({})

  // Fetch saved terms from server
  const { data: savedTermsData } = useQuery({
    queryKey: ['srs', user?.id ?? 'me', 'saved-terms'],
    queryFn: () => srsApi.fetchSavedTerms(),
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
                jlptLevel: 'N5',
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

  // Tab "Cơ bản" vs "Chi tiết" ở thẻ từ vựng / Kanji
  const [mainCardTab, setMainCardTab] = useState<'basic' | 'detail'>('basic')
  const [activeKanjiIndex, setActiveKanjiIndex] = useState<number>(0)
  const [detailSubTab, setDetailSubTab] = useState<'info' | 'practice'>('info')

  // Kanji Search filters
  const [kanjiLevel, setKanjiLevel] = useState<string>('ALL')
  const [selectedKanjiModal, setSelectedKanjiModal] = useState<KanjiSummary | null>(null)

  // Audio player ref
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null)

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

  const handleSaveToSrs = async (word: string, meaning: string, reading: string) => {
    try {
      await srsApi.addCard({
        type: 'vocab',
        term: word,
        meaning,
        reading,
        jlptLevel: 'N5',
      })
      setSavedSrs((prev) => ({ ...prev, [word]: true }))
      await queryClient.invalidateQueries({ queryKey: ['srs'] })
    } catch (err) {
      console.error('Không thể lưu thẻ vào SRS:', err)
    }
  }

  // Auto-search debounced as user types
  useEffect(() => {
    const trimmed = input.trim()
    if (!trimmed) {
      setSearchTerm('')
      return
    }
    const timer = window.setTimeout(() => {
      setSearchTerm(trimmed)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [input])

  // Reset active kanji index when search term changes
  useEffect(() => {
    setActiveKanjiIndex(0)
    setDetailSubTab('info')
  }, [searchTerm])

  // 1. Query từ điển chung VNJP
  const { data, isLoading, isError } = useQuery<DictionarySearchResult>({
    queryKey: ['dictionary-search', searchTerm],
    queryFn: () =>
      requestApi<DictionarySearchResult>({
        url: apiPaths.dictionary.search(searchTerm, 20),
      }),
    enabled: Boolean(searchTerm) && (activeTab === 'vocab' || activeTab === 'sentences'),
    staleTime: 1000 * 60 * 10,
  })

  // 2. Query danh sách Hán tự NhaiKanji khi ở tab "Hán tự"
  const { data: kanjiListData, isLoading: isKanjiListLoading } = useQuery({
    queryKey: ['nhaikanji', 'kanjiList', kanjiLevel, searchTerm],
    queryFn: () =>
      nhaikanjiApi.fetchKanjiList({
        level: kanjiLevel,
        query: searchTerm,
        page: 1,
        limit: 48,
      }),
    enabled: activeTab === 'kanji',
    staleTime: 1000 * 60 * 10,
  })

  // 3. Query Ngữ pháp Bunpo khi ở tab "Ngữ pháp"
  const { data: bunpoListData, isLoading: isBunpoLoading } = useQuery({
    queryKey: ['nhaikanji', 'bunpoList', searchTerm],
    queryFn: () =>
      nhaikanjiApi.fetchBunpoList({
        query: searchTerm,
        limit: 30,
      }),
    enabled: activeTab === 'grammar',
    staleTime: 1000 * 60 * 10,
  })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = input.trim()
    if (trimmed) {
      setSearchTerm(trimmed)
    }
  }

  const handleQuickSearch = (keyword: string) => {
    setInput(keyword)
    setSearchTerm(keyword)
  }

  const toggleSaveWord = (id: number) => {
    setSavedWordIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const results = data?.results ?? []
  const primaryWord = results[0]

  // Tìm Kanji đang chọn cho tab "Chi tiết"
  const kanjiListInPrimary = primaryWord?.kanjis ?? []
  const activeKanjiChar =
    kanjiListInPrimary[activeKanjiIndex]?.character ||
    (searchTerm.length === 1 ? searchTerm : kanjiListInPrimary[0]?.character)

  // 4. Query chi tiết NhaiKanji cho Kanji đang chọn
  const { data: activeKanjiDetailData, isLoading: isKanjiDetailLoading } = useQuery({
    queryKey: ['nhaikanji', 'kanjiDetail', activeKanjiChar],
    queryFn: () => nhaikanjiApi.fetchKanjiDetail(activeKanjiChar || ''),
    enabled: Boolean(activeKanjiChar) && (mainCardTab === 'detail' || activeTab === 'kanji'),
    staleTime: 1000 * 60 * 10,
  })

  const kanjiSummary = activeKanjiDetailData?.summary
  const kanjiInfo = activeKanjiDetailData?.detail?.kanjiInfo
  const nhaiExamples: KanjiVocabExample[] = kanjiInfo?.kanjialiveData?.examples || []

  return (
    <section className="dictionary-page" style={{ maxWidth: '1280px', margin: '0 auto', padding: '1rem' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.8rem',
          fontWeight: 700,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.75rem',
        }}
      >
        <Search size={14} /> TỪ ĐIỂN NHẬT - VIỆT (VNJP DICTIONARY)
      </div>

      {/* Top Type Selector Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '2px',
          background: 'rgba(255, 255, 255, 0.04)',
          padding: '4px',
          borderRadius: '8px',
          marginBottom: '1.25rem',
          maxWidth: '560px',
        }}
      >
        <button
          type="button"
          onClick={() => {
            setActiveTab('vocab')
            setMainCardTab('basic')
          }}
          style={{
            flex: 1,
            padding: '8px 16px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.9rem',
            background: activeTab === 'vocab' ? 'rgba(255, 77, 109, 0.2)' : 'transparent',
            color: activeTab === 'vocab' ? 'var(--rose-300)' : 'var(--color-text-secondary)',
          }}
        >
          Từ vựng
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('kanji')}
          style={{
            flex: 1,
            padding: '8px 16px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.9rem',
            background: activeTab === 'kanji' ? 'rgba(255, 77, 109, 0.2)' : 'transparent',
            color: activeTab === 'kanji' ? 'var(--rose-300)' : 'var(--color-text-secondary)',
          }}
        >
          Hán tự
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('grammar')}
          style={{
            flex: 1,
            padding: '8px 16px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.9rem',
            background: activeTab === 'grammar' ? 'rgba(255, 77, 109, 0.2)' : 'transparent',
            color: activeTab === 'grammar' ? 'var(--rose-300)' : 'var(--color-text-secondary)',
          }}
        >
          Ngữ pháp
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sentences')}
          style={{
            flex: 1,
            padding: '8px 16px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.9rem',
            background: activeTab === 'sentences' ? 'rgba(255, 77, 109, 0.2)' : 'transparent',
            color: activeTab === 'sentences' ? 'var(--rose-300)' : 'var(--color-text-secondary)',
          }}
        >
          Mẫu câu
        </button>
      </div>

      {/* Search Header */}
      <form
        onSubmit={submit}
        style={{
          display: 'flex',
          gap: '0.75rem',
          marginBottom: '1rem',
          maxWidth: '820px',
        }}
      >
        <div style={{ position: 'relative', flex: 1 }}>
          <Input
            ref={inputRef}
            aria-label="Từ cần tra"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              activeTab === 'kanji'
                ? 'Tìm chữ Kanji (間, 学), âm Hán Việt (gian, hoc), On/Kun hoặc nghĩa...'
                : activeTab === 'grammar'
                  ? 'Tìm ngữ pháp tiếng Nhật (から, ても, んです)...'
                  : activeTab === 'sentences'
                    ? 'Tìm mẫu câu chứa từ khóa...'
                    : 'Gõ từ vựng tiếng Nhật, Hiragana, Romaji hoặc tiếng Việt...'
            }
            style={{ paddingLeft: '2.5rem', height: '46px', fontSize: '1rem' }}
          />
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '12px',
              top: '14px',
              color: 'var(--color-text-muted)',
            }}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          style={{
            background: '#2563eb',
            color: '#ffffff',
            fontWeight: 700,
            padding: '0 1.75rem',
            borderRadius: '8px',
          }}
        >
          {isLoading || isKanjiListLoading || isBunpoLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            'Tìm Kiếm'
          )}
        </Button>
      </form>

      {/* Quick Search Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Gợi ý:</span>
        {POPULAR_SEARCHES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => handleQuickSearch(item)}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--color-border)',
              borderRadius: '999px',
              padding: '3px 12px',
              fontSize: '0.82rem',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            {item}
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* 1. VIEW: TAB HÁN TỰ (KANJI SEARCH & DIRECTORY) */}
      {/* ========================================================================= */}
      {activeTab === 'kanji' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* JLPT Level Filters */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              alignItems: 'center',
              background: 'var(--color-surface)',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              border: '1px solid var(--color-border)',
            }}
          >
            <span
              style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-muted)', marginRight: '4px' }}
            >
              Cấp độ JLPT:
            </span>
            {JLPT_LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setKanjiLevel(lvl)}
                style={{
                  background: kanjiLevel === lvl ? '#2563eb' : 'rgba(255, 255, 255, 0.05)',
                  color: kanjiLevel === lvl ? '#ffffff' : 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  padding: '4px 12px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {lvl === 'ALL' ? 'Tất cả (2500+)' : `Kanji ${lvl}`}
              </button>
            ))}
            {kanjiListData && (
              <span style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                Tìm thấy <b>{kanjiListData.total}</b> chữ Hán
              </span>
            )}
          </div>

          {/* Kanji Grid List */}
          {isKanjiListLoading ? (
            <div style={{ textAlign: 'center', padding: '4rem 0' }}>
              <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto', color: '#2563eb' }} />
              <p style={{ marginTop: '1rem', color: 'var(--color-text-secondary)' }}>
                Đang tra cứu kho Hán tự NhaiKanji...
              </p>
            </div>
          ) : kanjiListData && kanjiListData.items.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))',
                gap: '1rem',
              }}
            >
              {kanjiListData.items.map((k) => (
                <div
                  key={k.kanji}
                  onClick={() => setSelectedKanjiModal(k)}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px',
                    padding: '1rem 0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.borderColor = '#2563eb'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.borderColor = 'var(--color-border)'
                  }}
                >
                  <div
                    style={{
                      fontSize: '2.5rem',
                      fontFamily: 'var(--font-jp, serif)',
                      fontWeight: 700,
                      color: 'var(--color-text)',
                      lineHeight: 1.1,
                      marginBottom: '0.35rem',
                    }}
                  >
                    {k.kanji}
                  </div>
                  <div
                    style={{
                      fontSize: '1rem',
                      fontWeight: 800,
                      color: '#dc2626',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {k.hanzi}
                  </div>
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--color-text-secondary)',
                      textAlign: 'center',
                      marginTop: '0.2rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                    }}
                  >
                    {k.meaning_vi}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      marginTop: '0.5rem',
                      fontSize: '0.72rem',
                    }}
                  >
                    <span
                      style={{
                        background: 'rgba(37, 99, 235, 0.15)',
                        color: '#3b82f6',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontWeight: 700,
                      }}
                    >
                      {k.jlpt_level || 'N5'}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)' }}>{k.stroke_count} nét</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title={`Không tìm thấy Hán tự cho “${searchTerm || kanjiLevel}”`}
              description="Hãy thử tìm bằng chữ Hán khác, âm Hán Việt (như gian, nhật, học) hoặc chọn cấp độ khác."
            />
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. VIEW: TAB NGỮ PHÁP (BUNPO SEARCH) */}
      {/* ========================================================================= */}
      {activeTab === 'grammar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {isBunpoLoading ? (
            <div style={{ textAlign: 'center', padding: '4rem 0' }}>
              <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto', color: '#2563eb' }} />
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
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span
                          style={{
                            fontSize: '1.2rem',
                            fontWeight: 800,
                            fontFamily: 'var(--font-jp)',
                            color: '#2563eb',
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
                        👉 {b.shortMeaning}
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

      {/* ========================================================================= */}
      {/* 3. VIEW: TAB TỪ VỰNG & MẪU CÂU (MAIN VNJP & NHAIKANJI INTEGRATION) */}
      {/* ========================================================================= */}
      {(activeTab === 'vocab' || activeTab === 'sentences') && (
        <>
          {/* Loading state */}
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '4rem 0' }}>
              <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto', color: '#2563eb' }} />
              <p style={{ marginTop: '1rem', color: 'var(--color-text-secondary)' }}>Đang tra cứu từ điển VNJP...</p>
            </div>
          )}

          {/* Ready state when no search term entered */}
          {!searchTerm && !isLoading && (
            <EmptyState
              title="Sẵn sàng tra cứu"
              description="Nhập từ vựng bằng tiếng Nhật (Kanji, Kana), phiên âm Romaji hoặc nghĩa tiếng Việt để tìm kiếm."
            />
          )}

          {/* Empty result state */}
          {!isLoading && searchTerm && results.length === 0 && !isError && (
            <EmptyState
              title={`Không tìm thấy kết quả cho “${searchTerm}”`}
              description="Hãy thử kiểm tra lại chính tả hoặc thử tìm kiếm bằng Romaji hay chữ Hán gốc."
            />
          )}

          {/* Main 2-Column Content View */}
          {!isLoading && results.length > 0 && primaryWord && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.1fr)',
                gap: '1.5rem',
                alignItems: 'start',
              }}
            >
              {/* LEFT COLUMN: Main Detail Word Card */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <Card
                  padding="lg"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px',
                  }}
                >
                  {/* Header: Cơ bản / Chi tiết (NhaiKanji Switcher) */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--color-border)',
                      paddingBottom: '0.75rem',
                      marginBottom: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.92rem', fontWeight: 700 }}>
                      <span
                        onClick={() => setMainCardTab('basic')}
                        style={{
                          color: mainCardTab === 'basic' ? '#2563eb' : 'var(--color-text-muted)',
                          borderBottom: mainCardTab === 'basic' ? '2px solid #2563eb' : '2px solid transparent',
                          paddingBottom: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        Cơ bản
                      </span>
                      <span
                        onClick={() => setMainCardTab('detail')}
                        style={{
                          color: mainCardTab === 'detail' ? '#2563eb' : 'var(--color-text-muted)',
                          borderBottom: mainCardTab === 'detail' ? '2px solid #2563eb' : '2px solid transparent',
                          paddingBottom: '4px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Sparkles size={14} color={mainCardTab === 'detail' ? '#2563eb' : '#d97706'} />
                        Chi tiết (NhaiKanji)
                      </span>
                    </div>
                    <Button
                      variant={savedWordIds.has(primaryWord.id) ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => toggleSaveWord(primaryWord.id)}
                      style={{ fontSize: '0.82rem' }}
                    >
                      {savedWordIds.has(primaryWord.id) ? (
                        <>
                          <Check size={14} color="#10b981" /> Đã lưu
                        </>
                      ) : (
                        <>
                          <Bookmark size={14} /> Lưu vào sổ từ
                        </>
                      )}
                    </Button>
                  </div>

                  {/* ------------------------------------------------------------- */}
                  {/* TAB 1: NỘI DUNG CƠ BẢN */}
                  {/* ------------------------------------------------------------- */}
                  {mainCardTab === 'basic' ? (
                    <div>
                      {/* Word Title & Pronunciation */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <h2
                            style={{
                              fontSize: '2.4rem',
                              fontWeight: 800,
                              color: 'var(--color-text)',
                              margin: 0,
                              fontFamily: 'var(--font-jp)',
                              letterSpacing: '0.02em',
                            }}
                          >
                            {primaryWord.word}
                          </h2>
                          {primaryWord.hanViet && (
                            <span style={{ fontSize: '1.25rem', color: '#dc2626', fontWeight: 700 }}>
                              [{primaryWord.hanViet}]
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.4rem' }}>
                          <span
                            style={{
                              fontSize: '1.35rem',
                              fontFamily: 'var(--font-jp)',
                              color: 'var(--color-text-secondary)',
                            }}
                          >
                            {primaryWord.reading}
                          </span>
                          <button
                            type="button"
                            onClick={() => speakJapanese(primaryWord.word || primaryWord.reading || '')}
                            title="Nghe phát âm chuẩn"
                            style={{
                              background: 'rgba(37, 99, 235, 0.1)',
                              border: '1px solid rgba(37, 99, 235, 0.25)',
                              color: '#2563eb',
                              borderRadius: '999px',
                              padding: '4px 10px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                            }}
                          >
                            <Volume2 size={16} />
                          </button>
                        </div>

                        {/* Popularity badges */}
                        <div
                          style={{
                            marginTop: '0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            fontSize: '0.82rem',
                            color: '#b45309',
                          }}
                        >
                          <div>• Từ phổ biến trong tìm kiếm (Top ~2000)</div>
                          <div>• Từ phổ biến trong báo chí tiếng Nhật</div>
                          {primaryWord.jlpt && (
                            <div style={{ color: '#2563eb', fontWeight: 600 }}>• Cấp độ JLPT: {primaryWord.jlpt}</div>
                          )}
                        </div>
                      </div>

                      {/* Meanings & Examples block */}
                      <div
                        style={{
                          marginTop: '1.25rem',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '10px',
                          padding: '1.15rem',
                        }}
                      >
                        {/* Part of Speech Badge */}
                        <span
                          style={{
                            background: 'rgba(37, 99, 235, 0.15)',
                            color: '#3b82f6',
                            border: '1px solid rgba(37, 99, 235, 0.3)',
                            padding: '2px 10px',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            display: 'inline-block',
                            marginBottom: '0.75rem',
                          }}
                        >
                          {primaryWord.partOfSpeech || 'Danh từ chung'}
                        </span>

                        {/* Main Vietnamese Meanings */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          {primaryWord.meanings.map((m, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                              <span style={{ color: '#dc2626', fontSize: '1.1rem', fontWeight: 900, lineHeight: 1 }}>
                                ➤
                              </span>
                              <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                {m}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Primary Example Sentence */}
                        {primaryWord.examples && primaryWord.examples.length > 0 && primaryWord.examples[0] && (
                          <div
                            style={{
                              marginTop: '1rem',
                              paddingTop: '0.85rem',
                              borderTop: '1px dashed var(--color-border)',
                              fontSize: '0.92rem',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <div
                                  style={{ color: 'var(--color-text)', fontFamily: 'var(--font-jp)', fontSize: '1rem' }}
                                >
                                  <span style={{ color: 'var(--color-text-muted)', marginRight: '6px' }}>JP:</span>
                                  {primaryWord.examples[0].sentenceJp}
                                </div>
                                {primaryWord.examples[0].sentenceVi && (
                                  <div style={{ color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                                    <span style={{ color: 'var(--color-text-muted)', marginRight: '6px' }}>VI:</span>
                                    {primaryWord.examples[0].sentenceVi}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => speakJapanese(primaryWord.examples?.[0]?.sentenceJp || '')}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--color-text-muted)',
                                  cursor: 'pointer',
                                  padding: '4px',
                                }}
                              >
                                <Volume2 size={16} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* ------------------------------------------------------------- */
                    /* TAB 2: NỘI DUNG CHI TIẾT (CHUẨN NHAIKANJI)                    */
                    /* ------------------------------------------------------------- */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {/* Kanji Switcher Pills (nếu từ có nhiều hơn 1 chữ Hán, ví dụ 勉強) */}
                      {kanjiListInPrimary.length > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                            Chọn Hán tự để xem:
                          </span>
                          {kanjiListInPrimary.map((k, idx) => (
                            <button
                              key={k.character}
                              type="button"
                              onClick={() => {
                                setActiveKanjiIndex(idx)
                                setDetailSubTab('info')
                              }}
                              style={{
                                background: activeKanjiIndex === idx ? '#2563eb' : 'rgba(255, 255, 255, 0.05)',
                                color: activeKanjiIndex === idx ? '#ffffff' : 'var(--color-text)',
                                border: '1px solid var(--color-border)',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <span style={{ fontFamily: 'var(--font-jp)', fontSize: '1rem' }}>{k.character}</span>
                              {k.hanViet && <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>[{k.hanViet}]</span>}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Detail Sub-tab Navigation (Chi tiết & Từ vựng vs Luyện viết) */}
                      <div
                        style={{
                          display: 'flex',
                          gap: '0.5rem',
                          background: 'rgba(255, 255, 255, 0.03)',
                          padding: '4px',
                          borderRadius: '8px',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setDetailSubTab('info')}
                          style={{
                            flex: 1,
                            padding: '6px 12px',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            background: detailSubTab === 'info' ? '#2563eb' : 'transparent',
                            color: detailSubTab === 'info' ? '#ffffff' : 'var(--color-text-secondary)',
                          }}
                        >
                          <BookOpen size={15} />
                          Chi tiết & Từ vựng ({nhaiExamples.length || kanjiSummary?.num_vocab_examples || 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetailSubTab('practice')}
                          style={{
                            flex: 1,
                            padding: '6px 12px',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            background: detailSubTab === 'practice' ? '#2563eb' : 'transparent',
                            color: detailSubTab === 'practice' ? '#ffffff' : 'var(--color-text-secondary)',
                          }}
                        >
                          <PenTool size={15} />
                          Luyện viết nét ({kanjiSummary?.stroke_count || kanjiListInPrimary[0]?.strokeCount || '—'} nét)
                        </button>
                      </div>

                      {isKanjiDetailLoading ? (
                        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
                          <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto', color: '#2563eb' }} />
                          <p style={{ marginTop: '0.75rem', fontSize: '0.88rem' }}>Đang nạp chi tiết từ NhaiKanji...</p>
                        </div>
                      ) : detailSubTab === 'practice' && activeKanjiChar ? (
                        /* Luyện viết nét */
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '1.25rem 0',
                            background: 'rgba(255, 255, 255, 0.02)',
                            borderRadius: '10px',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.4rem 0' }}>
                            Tập viết chữ:{' '}
                            <span
                              style={{
                                fontSize: '1.6rem',
                                color: '#3b82f6',
                                fontFamily: 'var(--font-jp)',
                                margin: '0 4px',
                              }}
                            >
                              {activeKanjiChar}
                            </span>{' '}
                            ({kanjiSummary?.stroke_count || '12'} nét)
                          </h4>
                          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '0 0 1rem 0' }}>
                            Dùng chuột hoặc ngón tay để vẽ các nét theo chữ mẫu mờ
                          </p>
                          <KanjiCanvas kanjiChar={activeKanjiChar} />
                        </div>
                      ) : (
                        /* Chi tiết tổng quan & Mẹo nhớ & Từ vựng phong phú */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {/* Overview Block */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                              gap: '0.85rem',
                            }}
                          >
                            {/* Chữ Hán & Âm Hán */}
                            <div
                              style={{
                                background: 'rgba(37, 99, 235, 0.08)',
                                border: '1px solid rgba(37, 99, 235, 0.2)',
                                borderRadius: '10px',
                                padding: '1rem',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <div
                                style={{
                                  fontSize: '3rem',
                                  fontFamily: 'var(--font-jp)',
                                  fontWeight: 800,
                                  color: '#3b82f6',
                                  lineHeight: 1,
                                  marginBottom: '0.4rem',
                                }}
                              >
                                {activeKanjiChar}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.95rem',
                                  fontWeight: 800,
                                  color: '#dc2626',
                                  textTransform: 'uppercase',
                                }}
                              >
                                {kanjiSummary?.hanzi || kanjiListInPrimary[0]?.hanViet || ''}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                {kanjiSummary?.stroke_count || kanjiListInPrimary[0]?.strokeCount} nét • JLPT{' '}
                                {kanjiSummary?.jlpt_level || kanjiListInPrimary[0]?.jlpt || 'N5'}
                              </div>
                            </div>

                            {/* Âm On & Âm Kun */}
                            <div
                              style={{
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid var(--color-border)',
                                borderRadius: '10px',
                                padding: '0.85rem 1rem',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                gap: '0.4rem',
                              }}
                            >
                              <div>
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    color: 'var(--color-text-muted)',
                                    textTransform: 'uppercase',
                                    display: 'block',
                                  }}
                                >
                                  Âm On (Onyomi):
                                </span>
                                <span
                                  style={{
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                    fontFamily: 'var(--font-jp)',
                                    color: 'var(--color-text)',
                                  }}
                                >
                                  {kanjiSummary?.onyomi || kanjiListInPrimary[0]?.onyomi || '—'}
                                </span>
                              </div>
                              <div>
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    color: 'var(--color-text-muted)',
                                    textTransform: 'uppercase',
                                    display: 'block',
                                  }}
                                >
                                  Âm Kun (Kunyomi):
                                </span>
                                <span
                                  style={{
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                    fontFamily: 'var(--font-jp)',
                                    color: 'var(--color-text)',
                                  }}
                                >
                                  {kanjiSummary?.kunyomi || kanjiListInPrimary[0]?.kunyomi || '—'}
                                </span>
                              </div>
                            </div>

                            {/* Bộ thủ Radical */}
                            <div
                              style={{
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid var(--color-border)',
                                borderRadius: '10px',
                                padding: '0.85rem 1rem',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                gap: '0.3rem',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  color: 'var(--color-text-muted)',
                                  textTransform: 'uppercase',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Layers size={13} /> Bộ thủ (Radical):
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2px' }}>
                                <span
                                  style={{
                                    fontSize: '1.6rem',
                                    fontFamily: 'var(--font-jp)',
                                    color: '#3b82f6',
                                    fontWeight: 700,
                                  }}
                                >
                                  {kanjiSummary?.radical_utf || '⾨'}
                                </span>
                                <div>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                    {kanjiSummary?.radical_name_ja || 'もんがまえ'}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                    {kanjiSummary?.radical_meaning || 'Cổng, Cửa'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* MẸO NHỚ & CHIẾT TỰ (MNEMONIC STORY) */}
                          {(kanjiSummary?.story || kanjiInfo?.story) && (
                            <div
                              style={{
                                background: 'rgba(217, 119, 6, 0.12)',
                                border: '1px solid rgba(217, 119, 6, 0.35)',
                                padding: '1rem 1.15rem',
                                borderRadius: '10px',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  color: '#f59e0b',
                                  fontWeight: 800,
                                  fontSize: '0.9rem',
                                  marginBottom: '0.35rem',
                                }}
                              >
                                <Sparkles size={16} />
                                <span>Chiết tự & Mẹo nhớ Hán tự (NhaiKanji)</span>
                              </div>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: '0.92rem',
                                  color: '#fbbf24',
                                  lineHeight: 1.55,
                                  fontWeight: 600,
                                }}
                              >
                                {kanjiSummary?.story || kanjiInfo?.story}
                              </p>
                            </div>
                          )}

                          {/* DANH SÁCH TỪ VỰNG CHI TIẾT & VÍ DỤ CÂU KÈM AUDIO */}
                          <div
                            style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderBottom: '1px solid var(--color-border)',
                                paddingBottom: '0.5rem',
                              }}
                            >
                              <h4
                                style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}
                              >
                                Từ vựng chứa chữ {activeKanjiChar} & Ví dụ ({nhaiExamples.length})
                              </h4>
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                Phát âm chuẩn & ví dụ thực tế
                              </span>
                            </div>

                            {nhaiExamples.length === 0 ? (
                              <div
                                style={{
                                  textAlign: 'center',
                                  padding: '1.5rem 0',
                                  color: 'var(--color-text-muted)',
                                  fontSize: '0.85rem',
                                }}
                              >
                                Không có danh sách từ vựng bổ sung cho chữ này.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {nhaiExamples.map((ex, idx) => {
                                  const isWordAudioPlaying = playingAudioUrl === ex.audio
                                  const isSentAudioPlaying = playingAudioUrl === ex.audioExample
                                  const isSaved = savedSrs[ex.word]

                                  return (
                                    <div
                                      key={ex.id || idx}
                                      style={{
                                        background: 'rgba(255, 255, 255, 0.025)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: '10px',
                                        padding: '0.85rem 1rem',
                                      }}
                                    >
                                      {/* Header từ vựng */}
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'flex-start',
                                          justifyContent: 'space-between',
                                          gap: '0.75rem',
                                        }}
                                      >
                                        <div>
                                          <div
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '0.5rem',
                                              flexWrap: 'wrap',
                                            }}
                                          >
                                            <span
                                              style={{
                                                fontSize: '1.2rem',
                                                fontWeight: 800,
                                                fontFamily: 'var(--font-jp)',
                                                color: 'var(--color-text)',
                                              }}
                                            >
                                              {ex.word}
                                            </span>
                                            <span
                                              style={{
                                                fontSize: '0.92rem',
                                                color: '#3b82f6',
                                                fontFamily: 'var(--font-jp)',
                                                fontWeight: 700,
                                              }}
                                            >
                                              【{ex.reading}】
                                            </span>
                                            {ex.yinHan && (
                                              <span
                                                style={{
                                                  fontSize: '0.75rem',
                                                  background: 'rgba(220, 38, 38, 0.12)',
                                                  border: '1px solid rgba(220, 38, 38, 0.25)',
                                                  color: '#dc2626',
                                                  padding: '1px 6px',
                                                  borderRadius: '4px',
                                                  fontWeight: 700,
                                                }}
                                              >
                                                {ex.yinHan}
                                              </span>
                                            )}
                                          </div>
                                          <div
                                            style={{
                                              fontSize: '0.9rem',
                                              fontWeight: 600,
                                              color: 'var(--color-text-secondary)',
                                              marginTop: '2px',
                                            }}
                                          >
                                            {ex.meaning}
                                          </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                          <button
                                            type="button"
                                            onClick={() => playAudio(ex.audio, ex.word)}
                                            style={{
                                              padding: '6px',
                                              borderRadius: '50%',
                                              border: 'none',
                                              cursor: 'pointer',
                                              background: isWordAudioPlaying ? '#2563eb' : 'rgba(37, 99, 235, 0.15)',
                                              color: isWordAudioPlaying ? '#ffffff' : '#3b82f6',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                            }}
                                            title="Nghe phát âm từ vựng"
                                          >
                                            <Volume2 size={16} />
                                          </button>

                                          <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => handleSaveToSrs(ex.word, ex.meaning, ex.reading)}
                                            style={{ fontSize: '0.75rem', padding: '2px 8px', height: '28px' }}
                                            title="Lưu từ vào sổ ôn tập SRS"
                                          >
                                            {isSaved ? (
                                              <>
                                                <Check size={13} color="#10b981" /> Đã lưu
                                              </>
                                            ) : (
                                              <>
                                                <BookmarkPlus size={13} /> +SRS
                                              </>
                                            )}
                                          </Button>
                                        </div>
                                      </div>

                                      {/* Câu ví dụ của từ vựng */}
                                      {ex.example && (
                                        <div
                                          style={{
                                            marginTop: '0.65rem',
                                            background: 'rgba(255, 255, 255, 0.03)',
                                            padding: '0.65rem 0.85rem',
                                            borderRadius: '8px',
                                            border: '1px solid var(--color-border)',
                                            fontSize: '0.85rem',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.2rem',
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: 'flex',
                                              alignItems: 'flex-start',
                                              justifyContent: 'space-between',
                                              gap: '0.5rem',
                                            }}
                                          >
                                            <div
                                              style={{
                                                fontFamily: 'var(--font-jp)',
                                                fontWeight: 600,
                                                fontSize: '0.92rem',
                                                color: 'var(--color-text)',
                                              }}
                                            >
                                              {ex.example}
                                            </div>
                                            {ex.audioExample && (
                                              <button
                                                type="button"
                                                onClick={() => playAudio(ex.audioExample, ex.example)}
                                                style={{
                                                  background: 'none',
                                                  border: 'none',
                                                  cursor: 'pointer',
                                                  color: isSentAudioPlaying ? '#2563eb' : 'var(--color-text-muted)',
                                                  padding: '2px',
                                                }}
                                                title="Nghe câu ví dụ"
                                              >
                                                <Volume2 size={15} />
                                              </button>
                                            )}
                                          </div>
                                          {ex.readingExample && (
                                            <div
                                              style={{
                                                color: 'var(--color-text-muted)',
                                                fontSize: '0.82rem',
                                                fontFamily: 'var(--font-jp)',
                                              }}
                                            >
                                              {ex.readingExample}
                                            </div>
                                          )}
                                          {ex.exampleVi && (
                                            <div
                                              style={{
                                                color: 'var(--color-text-secondary)',
                                                fontSize: '0.85rem',
                                                marginTop: '2px',
                                              }}
                                            >
                                              👉 {ex.exampleVi}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>

                {/* Sub-card: Mẫu câu chứa từ hoặc Kanji */}
                {primaryWord.examples && primaryWord.examples.length > 1 && (
                  <Card
                    padding="md"
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '12px',
                    }}
                  >
                    <h3
                      style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: '#2563eb',
                        borderLeft: '4px solid #2563eb',
                        paddingLeft: '0.5rem',
                        margin: '0 0 0.85rem 0',
                      }}
                    >
                      Mẫu câu chứa từ hoặc Kanji ({primaryWord.examples.length - 1})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {primaryWord.examples.slice(1).map((ex, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '0.65rem 0.85rem',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '0.75rem',
                          }}
                        >
                          <div>
                            <div
                              style={{ fontFamily: 'var(--font-jp)', fontSize: '0.98rem', color: 'var(--color-text)' }}
                            >
                              {ex.sentenceJp}
                            </div>
                            {ex.sentenceVi && (
                              <div
                                style={{ fontSize: '0.86rem', color: 'var(--color-text-secondary)', marginTop: '3px' }}
                              >
                                {ex.sentenceVi}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => speakJapanese(ex.sentenceJp)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--color-text-muted)',
                              cursor: 'pointer',
                              padding: '2px',
                              flexShrink: 0,
                            }}
                          >
                            <Volume2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Other Matching Search Results */}
                {results.length > 1 && (
                  <div>
                    <div
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: 'var(--color-text-muted)',
                        marginBottom: '0.75rem',
                      }}
                    >
                      CÁC TỪ LIÊN QUAN TRONG TÌM KIẾM ({results.length - 1} từ):
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {results.slice(1, 6).map((subItem) => (
                        <div
                          key={subItem.id}
                          onClick={() => handleQuickSearch(subItem.word)}
                          style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid var(--color-border)',
                            padding: '0.75rem 1rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: '1.05rem',
                                color: 'var(--color-text)',
                                fontFamily: 'var(--font-jp)',
                              }}
                            >
                              {subItem.word}
                            </span>
                            {subItem.reading && subItem.reading !== subItem.word && (
                              <span
                                style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginLeft: '0.5rem' }}
                              >
                                【{subItem.reading}】
                              </span>
                            )}
                            {subItem.hanViet && (
                              <span
                                style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, marginLeft: '0.5rem' }}
                              >
                                [{subItem.hanViet}]
                              </span>
                            )}
                            <div
                              style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}
                            >
                              {subItem.meanings[0] || 'Xem chi tiết...'}
                            </div>
                          </div>
                          <ArrowRight size={16} color="var(--color-text-muted)" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Kanji Breakdown & Compounds */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Hán tự Breakdown */}
                <Card
                  padding="md"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: 'var(--color-text)',
                      margin: '0 0 0.85rem 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <BookOpen size={16} color="#2563eb" /> Hán tự
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {primaryWord.kanjis.map((k, idx) => (
                      <div
                        key={k.character}
                        onClick={() => {
                          setActiveKanjiIndex(idx)
                          setMainCardTab('detail')
                          setDetailSubTab('info')
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                          padding: '0.75rem',
                          display: 'flex',
                          gap: '0.75rem',
                          alignItems: 'flex-start',
                          cursor: 'pointer',
                          transition: 'border-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#2563eb'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-border)'
                        }}
                        title="Bấm để xem chi tiết NhaiKanji và mẹo nhớ"
                      >
                        <span
                          style={{
                            fontSize: '2rem',
                            fontFamily: 'var(--font-jp)',
                            color: 'var(--color-text)',
                            lineHeight: 1,
                            minWidth: '40px',
                            textAlign: 'center',
                          }}
                        >
                          {k.character}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 700, color: '#dc2626', fontSize: '0.95rem' }}>{k.hanViet}</span>
                            {k.jlpt && (
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  color: '#2563eb',
                                  background: 'rgba(37,99,235,0.15)',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                }}
                              >
                                {k.jlpt}
                              </span>
                            )}
                            {k.strokeCount && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                                {k.strokeCount} nét
                              </span>
                            )}
                          </div>
                          {k.onyomi && (
                            <div
                              style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}
                            >
                              <strong>On:</strong> {k.onyomi}
                            </div>
                          )}
                          {k.kunyomi && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                              <strong>Kun:</strong> {k.kunyomi}
                            </div>
                          )}
                          {k.meaning && (
                            <div
                              style={{
                                fontSize: '0.8rem',
                                color: 'var(--color-text-muted)',
                                marginTop: '3px',
                                lineHeight: 1.4,
                              }}
                            >
                              {k.meaning}
                            </div>
                          )}
                          <div style={{ marginTop: '4px', fontSize: '0.72rem', color: '#2563eb', fontWeight: 600 }}>
                            👉 Xem chi tiết & mẹo nhớ NhaiKanji
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Từ liên quan đến từ đang tra (Related Compounds) */}
                {primaryWord.relatedWords && primaryWord.relatedWords.length > 0 && (
                  <Card
                    padding="md"
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '12px',
                    }}
                  >
                    <h3
                      style={{
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        color: 'var(--color-text)',
                        margin: '0 0 0.75rem 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <Layers size={16} color="#2563eb" /> Từ liên quan đến {primaryWord.word}
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {primaryWord.relatedWords.map((rel, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleQuickSearch(rel.word)}
                          style={{
                            padding: '0.5rem 0.65rem',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                              <span
                                style={{ fontWeight: 700, fontFamily: 'var(--font-jp)', color: 'var(--color-text)' }}
                              >
                                {rel.word}
                              </span>
                              {rel.reading && rel.reading !== rel.word && (
                                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                  {rel.reading}
                                </span>
                              )}
                            </div>
                            {rel.meaning && (
                              <div
                                style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}
                              >
                                {rel.meaning}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              speakJapanese(rel.word)
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--color-text-muted)',
                              cursor: 'pointer',
                            }}
                          >
                            <Volume2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL CHI TIẾT KANJI (KHI CLICK VÀO CARD TRONG GRID HÁN TỰ) */}
      {selectedKanjiModal && (
        <KanjiDetailModal kanjiSummary={selectedKanjiModal} onClose={() => setSelectedKanjiModal(null)} />
      )}
    </section>
  )
}
