import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  BookmarkPlus,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Layers,
  Laptop,
  Search,
  Volume2,
} from 'lucide-react'
import { Badge, Button } from '../../components/ui'
import PageHeader from '../../components/PageHeader'
import { srsApi } from '../srs/srsApi'
import type { CurriculumWord } from '../srs/srsTypes'
import { useAuth } from '../auth/authContext'

const VOCAB_CATALOG = [
  {
    id: 'mimikara_n3',
    title: 'Mimikara Oboeru N3 (耳から覚える)',
    subtitle: 'Mimikara Oboeru N3',
    badge: '820 từ • 12 Unit',
    level: 'N3',
    icon: Headphones,
    color: '#059669',
    bg: 'linear-gradient(135deg, rgba(5, 150, 105, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)',
    border: 'rgba(16, 185, 129, 0.3)',
  },
  {
    id: 'tango_n3',
    title: 'Tango N3 (2000 Từ vựng)',
    subtitle: 'Tango 2000 N3',
    badge: '1,393 từ • 12 Unit',
    level: 'N3',
    icon: BookOpen,
    color: '#2563eb',
    bg: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)',
    border: 'rgba(59, 130, 246, 0.3)',
  },
  {
    id: 'mimikara_n2',
    title: 'Mimikara Oboeru N2 (耳から覚える)',
    subtitle: 'Mimikara Oboeru N2',
    badge: '1,180 từ • 15 Unit',
    level: 'N2',
    icon: Headphones,
    color: '#059669',
    bg: 'linear-gradient(135deg, rgba(5, 150, 105, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)',
    border: 'rgba(16, 185, 129, 0.3)',
  },
  {
    id: 'tango_n2',
    title: 'Tango N2 (1500 Từ vựng)',
    subtitle: 'Tango 1500 N2',
    badge: '1,546 từ • 12 Unit',
    level: 'N2',
    icon: BookOpen,
    color: '#2563eb',
    bg: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)',
    border: 'rgba(59, 130, 246, 0.3)',
  },
  {
    id: 'mimikara_n1',
    title: 'Mimikara Oboeru N1 (耳から覚える)',
    subtitle: 'Mimikara Oboeru N1',
    badge: '1,188 từ • 15 Unit',
    level: 'N1',
    icon: Headphones,
    color: '#059669',
    bg: 'linear-gradient(135deg, rgba(5, 150, 105, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)',
    border: 'rgba(16, 185, 129, 0.3)',
  },
  {
    id: 'tango_n1',
    title: 'Tango N1 (1000 Từ vựng)',
    subtitle: 'Tango 1000 N1',
    badge: '1,852 từ • 14 Unit',
    level: 'N1',
    icon: BookOpen,
    color: '#2563eb',
    bg: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)',
    border: 'rgba(59, 130, 246, 0.3)',
  },
  {
    id: 'se',
    title: 'Từ vựng CNTT (SE IT)',
    subtitle: 'SE IT Japanese',
    badge: '1,644 từ • 16 Unit',
    level: 'SE IT',
    icon: Laptop,
    color: '#8b5cf6',
    bg: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(168, 85, 247, 0.05) 100%)',
    border: 'rgba(168, 85, 247, 0.3)',
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

export function VocabularyPage({ onGoToSrs }: { onGoToSrs?: () => void }) {
  // Navigation level: 'catalog' -> 'lessons' -> 'study'
  const [selectedBook, setSelectedBook] = useState<string | null>(null)
  const [selectedUnit, setSelectedUnit] = useState<number | null>(null)
  const [studyMode, setStudyMode] = useState<'flashcard' | 'quiz' | 'list'>('flashcard')
  const [cardContentMode, setCardContentMode] = useState<'word' | 'example'>('word')

  // In-Lesson Flashcard State
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const { user } = useAuth()
  const [, setKnownWords] = useState<Set<number>>(new Set())
  const [savedSrs, setSavedSrs] = useState<Record<string, boolean>>({})
  const queryClient = useQueryClient()

  // Fetch saved SRS terms from server to know which items are already saved
  const { data: savedTermsData } = useQuery({
    queryKey: ['srs', user?.id ?? 'me', 'saved-terms'],
    queryFn: () => srsApi.fetchSavedTerms(),
    staleTime: 30_000,
  })

  // Sync server saved terms into local state for instant UI feedback
  useEffect(() => {
    if (!Array.isArray(savedTermsData)) return
    const map: Record<string, boolean> = {}
    for (const entry of savedTermsData) {
      if (entry?.type === 'vocab' && entry?.term) {
        map[`vocab_term_${entry.term}`] = true
        map[entry.term] = true
      }
    }
    setSavedSrs(map)
  }, [savedTermsData])

  /** Check if a vocab item is saved — matches both local ID key and server term key */
  const isVocabSaved = (item: CurriculumWord) =>
    savedSrs[`vocab_${item.id}`] || savedSrs[`vocab_term_${item.word}`] || false

  const [searchQuery, setSearchQuery] = useState('')
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 1. Fetch Units for the selected Book
  const { data: unitsList } = useQuery({
    queryKey: ['curriculum', 'units', selectedBook],
    queryFn: () => srsApi.fetchUnits(selectedBook || 'mimikara_n3'),
    enabled: Boolean(selectedBook),
  })

  // 2. Fetch Words for the current Unit (or entire book)
  const { data: wordsData } = useQuery({
    queryKey: ['curriculum', 'words', selectedBook, selectedUnit, searchQuery],
    queryFn: () =>
      srsApi.fetchCurriculumWords({
        curriculum: selectedBook || undefined,
        unit: selectedUnit !== null ? selectedUnit : undefined,
        query: searchQuery,
        page: 1,
        limit: 250,
      }),
    enabled: Boolean(selectedBook && selectedUnit !== null),
  })

  const words = wordsData?.items || []
  const currentCard = words[currentIndex] || null

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
    }
  }

  const handlePrevCard = () => {
    setIsFlipped(false)
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1)
    }
  }

  // Keyboard shortcut listener for in-lesson flashcard
  useEffect(() => {
    if (!selectedUnit || studyMode !== 'flashcard' || !currentCard) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid hotkeys when typing in input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return

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
  }, [selectedUnit, studyMode, currentCard, isFlipped, words.length])

  const handleSaveWordToSrs = async (item: CurriculumWord) => {
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
      })
      setSavedSrs((prev) => ({ ...prev, [`vocab_${item.id}`]: true, [`vocab_term_${item.word}`]: true }))
      await queryClient.invalidateQueries({ queryKey: ['srs'] })
    } catch (err) {
      console.error('Không thể lưu từ vào SRS:', err)
    }
  }

  const currentBookInfo = VOCAB_CATALOG.find((b) => b.id === selectedBook)

  // =========================================================================
  // VIEW 1: CATALOG OVERVIEW (Chọn bộ giáo trình từ vựng theo Level)
  // =========================================================================
  if (!selectedBook) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.25rem 1rem' }}>
        <PageHeader
          eyebrow="TỪ VỰNG TIẾNG NHẬT CHUẨN JLPT"
          title="Kho Giáo Trình Từ Vựng (Mimikara Oboeru & Tango)"
          description="Học theo từng bài và unit với Flashcard trực tiếp tại chỗ, phát âm tự động và lưu vào bộ nhớ lặp lại ngắt quãng Anki SRS."
        />

        {/* N3 Section */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <div style={{ width: '4px', height: '24px', background: '#10b981', borderRadius: '2px' }} />
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)' }}>
              Từ vựng Trung cấp N3
            </h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Mimikara & Tango N3</span>
          </div>

          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}
          >
            {VOCAB_CATALOG.filter((b) => b.level === 'N3').map((book) => {
              const Icon = book.icon
              return (
                <div
                  key={book.id}
                  onClick={() => setSelectedBook(book.id)}
                  style={{
                    background: book.bg,
                    border: `1px solid ${book.border}`,
                    borderRadius: '16px',
                    padding: '1.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '160px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)'
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none'
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.04)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span
                        style={{ fontSize: '0.8rem', fontWeight: 700, color: book.color, textTransform: 'uppercase' }}
                      >
                        {book.subtitle}
                      </span>
                      <h3
                        style={{ margin: '4px 0 0 0', fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text)' }}
                      >
                        {book.title}
                      </h3>
                    </div>
                    <div
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        padding: '10px',
                        borderRadius: '12px',
                        color: book.color,
                      }}
                    >
                      <Icon size={24} />
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '1rem',
                    }}
                  >
                    <Badge variant="primary" className="text-xs font-bold">
                      {book.badge}
                    </Badge>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: book.color }}>Vào học ngay →</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* N2 Section */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <div style={{ width: '4px', height: '24px', background: '#3b82f6', borderRadius: '2px' }} />
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)' }}>
              Từ vựng Trung Thượng cấp N2
            </h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Mimikara & Tango N2</span>
          </div>

          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}
          >
            {VOCAB_CATALOG.filter((b) => b.level === 'N2').map((book) => {
              const Icon = book.icon
              return (
                <div
                  key={book.id}
                  onClick={() => setSelectedBook(book.id)}
                  style={{
                    background: book.bg,
                    border: `1px solid ${book.border}`,
                    borderRadius: '16px',
                    padding: '1.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '160px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)'
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none'
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.04)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span
                        style={{ fontSize: '0.8rem', fontWeight: 700, color: book.color, textTransform: 'uppercase' }}
                      >
                        {book.subtitle}
                      </span>
                      <h3
                        style={{ margin: '4px 0 0 0', fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text)' }}
                      >
                        {book.title}
                      </h3>
                    </div>
                    <div
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        padding: '10px',
                        borderRadius: '12px',
                        color: book.color,
                      }}
                    >
                      <Icon size={24} />
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '1rem',
                    }}
                  >
                    <Badge variant="primary" className="text-xs font-bold">
                      {book.badge}
                    </Badge>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: book.color }}>Vào học ngay →</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* N1 & SE IT Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <div style={{ width: '4px', height: '24px', background: '#8b5cf6', borderRadius: '2px' }} />
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)' }}>
              Từ vựng Cao cấp N1 & Chuyên Ngành SE IT
            </h2>
          </div>

          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}
          >
            {VOCAB_CATALOG.filter((b) => b.level === 'N1' || b.level === 'SE IT').map((book) => {
              const Icon = book.icon
              return (
                <div
                  key={book.id}
                  onClick={() => setSelectedBook(book.id)}
                  style={{
                    background: book.bg,
                    border: `1px solid ${book.border}`,
                    borderRadius: '16px',
                    padding: '1.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '160px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)'
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none'
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.04)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span
                        style={{ fontSize: '0.8rem', fontWeight: 700, color: book.color, textTransform: 'uppercase' }}
                      >
                        {book.subtitle}
                      </span>
                      <h3
                        style={{ margin: '4px 0 0 0', fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text)' }}
                      >
                        {book.title}
                      </h3>
                    </div>
                    <div
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        padding: '10px',
                        borderRadius: '12px',
                        color: book.color,
                      }}
                    >
                      <Icon size={24} />
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '1rem',
                    }}
                  >
                    <Badge variant="primary" className="text-xs font-bold">
                      {book.badge}
                    </Badge>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: book.color }}>Vào học ngay →</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // VIEW 2: LESSONS / UNIT SELECTION (Chọn bài học trong giáo trình)
  // =========================================================================
  if (selectedBook && selectedUnit === null) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.25rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <Button variant="ghost" size="sm" onClick={() => setSelectedBook(null)}>
            <ArrowLeft size={16} /> Quay lại danh sách sách
          </Button>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <span
            style={{ fontSize: '0.85rem', fontWeight: 700, color: currentBookInfo?.color, textTransform: 'uppercase' }}
          >
            {currentBookInfo?.subtitle}
          </span>
          <h1 style={{ margin: '4px 0 0 0', fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)' }}>
            {currentBookInfo?.title}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: '6px 0 0 0' }}>
            Chọn một bài học dưới đây để bắt đầu ôn Flashcard hoặc xem danh sách từ vựng chi tiết.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
          {unitsList?.map((unit) => (
            <div
              key={unit.unit_number}
              onClick={() => {
                setSelectedUnit(unit.unit_number)
                setCurrentIndex(0)
                setIsFlipped(false)
              }}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '12px',
                padding: '1.25rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = currentBookInfo?.color || '#3b82f6'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)'
                e.currentTarget.style.transform = 'none'
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--color-text-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  UNIT {unit.unit_number}
                </div>
                <h4 style={{ margin: '2px 0 0 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  {unit.unit_title}
                </h4>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                  {unit.count} từ
                </span>
                <ChevronRight size={18} style={{ color: 'var(--color-text-muted)' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // =========================================================================
  // VIEW 3: IN-LESSON STUDY & FLASHCARD VIEW (Layout rộng rãi, 2 lớp Flashcard)
  // =========================================================================
  const currentUnitInfo = unitsList?.find((u) => u.unit_number === selectedUnit)

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
        <Button variant="ghost" size="sm" onClick={() => setSelectedUnit(null)}>
          <ArrowLeft size={16} /> Danh sách Unit
        </Button>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>
            {currentBookInfo?.subtitle} - Unit {selectedUnit}: {currentUnitInfo?.unit_title}
          </h2>
        </div>

        {onGoToSrs && (
          <Button variant="secondary" size="sm" onClick={onGoToSrs}>
            <Layers size={15} /> Mở Thẻ Ôn Tập Anki
          </Button>
        )}
      </div>

      {/* 3.2 Study Mode Bar (Flashcard vs Danh Sách) */}
      <div
        style={{
          display: 'flex',
          gap: '0.6rem',
          background: 'rgba(255, 255, 255, 0.04)',
          padding: '6px',
          borderRadius: '12px',
          marginBottom: '1.5rem',
          maxWidth: '400px',
        }}
      >
        <button
          type="button"
          onClick={() => setStudyMode('flashcard')}
          style={{
            flex: 1,
            padding: '8px 14px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.88rem',
            background: studyMode === 'flashcard' ? '#2563eb' : 'transparent',
            color: studyMode === 'flashcard' ? '#ffffff' : 'var(--color-text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Layers size={16} /> Flashcard Bài Học
        </button>

        <button
          type="button"
          onClick={() => setStudyMode('list')}
          style={{
            flex: 1,
            padding: '8px 14px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.88rem',
            background: studyMode === 'list' ? '#2563eb' : 'transparent',
            color: studyMode === 'list' ? '#ffffff' : 'var(--color-text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <BookOpen size={16} /> Danh Sách ({words.length})
        </button>
      </div>

      {/* 3.3 LAYER 1: IN-LESSON FLASHCARD CONTAINER */}
      {studyMode === 'flashcard' && currentCard && (
        <div style={{ marginBottom: '2.5rem' }}>
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
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setCardContentMode('word')
                  }}
                  style={{
                    background: cardContentMode === 'word' ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#ffffff',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Từ đơn
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setCardContentMode('example')
                  }}
                  style={{
                    background: cardContentMode === 'example' ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#ffffff',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Ví dụ
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
                    background: 'rgba(59, 130, 246, 0.2)',
                    border: 'none',
                    borderRadius: '50%',
                    padding: '8px',
                    color: '#60a5fa',
                    cursor: 'pointer',
                  }}
                  title="Nghe phát âm"
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
                    background: isVocabSaved(currentCard) ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    cursor: 'pointer',
                  }}
                  title="Lưu vào Deck Anki SRS"
                >
                  {isVocabSaved(currentCard) ? '✓ Đã vào SRS' : '+ Thêm SRS (C)'}
                </button>
              </div>
            </div>

            {/* Center Content */}
            <div style={{ margin: 'auto 0', width: '100%' }}>
              {!isFlipped ? (
                // FRONT SIDE
                <div>
                  {cardContentMode === 'word' ? (
                    <div>
                      <div
                        style={{
                          fontSize: '3rem',
                          fontFamily: 'var(--font-jp)',
                          fontWeight: 800,
                          color: '#ffffff',
                          letterSpacing: '2px',
                        }}
                      >
                        {currentCard.word}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '0.75rem' }}>
                        Nhấn [Space] hoặc chạm để lật xem nghĩa
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div
                        style={{
                          fontSize: '1.6rem',
                          fontFamily: 'var(--font-jp)',
                          color: '#ffffff',
                          lineHeight: 1.5,
                        }}
                      >
                        {currentCard.examples && currentCard.examples[0]
                          ? currentCard.examples[0].jp.replace(currentCard.word, '____')
                          : currentCard.word}
                      </div>
                      <div style={{ fontSize: '0.95rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                        {currentCard.examples && currentCard.examples[0]
                          ? currentCard.examples[0].vi
                          : currentCard.meaning}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // BACK SIDE (FLIPPED)
                <div>
                  <div style={{ fontSize: '2.5rem', fontFamily: 'var(--font-jp)', fontWeight: 800, color: '#ffffff' }}>
                    {currentCard.word}
                  </div>
                  {currentCard.reading && (
                    <div
                      style={{ fontSize: '1.25rem', fontFamily: 'var(--font-jp)', color: '#60a5fa', fontWeight: 600 }}
                    >
                      【{currentCard.reading}】
                    </div>
                  )}
                  {currentCard.hanViet && (
                    <div
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        color: '#f87171',
                        textTransform: 'uppercase',
                        marginTop: '4px',
                      }}
                    >
                      [{currentCard.hanViet}]
                    </div>
                  )}
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#34d399', marginTop: '0.75rem' }}>
                    👉 {currentCard.meaning}
                  </div>

                  {currentCard.examples && currentCard.examples[0] && (
                    <div
                      style={{
                        marginTop: '1rem',
                        padding: '0.75rem 1rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '8px',
                        textAlign: 'left',
                        fontSize: '0.92rem',
                      }}
                    >
                      <div style={{ fontFamily: 'var(--font-jp)', color: '#f1f5f9' }}>{currentCard.examples[0].jp}</div>
                      {currentCard.examples[0].vi && (
                        <div style={{ color: '#94a3b8', marginTop: '3px' }}>{currentCard.examples[0].vi}</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Bar: Action Hints */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.78rem',
                color: '#64748b',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                paddingTop: '0.75rem',
              }}
            >
              <span>Phím tắt: Space (Lật) · Z (Đã biết) · X (Chưa biết) · R (Phát âm) · C (Thêm SRS)</span>
              <span style={{ fontWeight: 700, color: '#94a3b8' }}>
                {currentIndex + 1} / {words.length}
              </span>
            </div>
          </div>

          {/* Flashcard Navigation Controls */}
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
                setKnownWords((prev) => new Set(prev).add(currentCard.id))
                handleNextCard()
              }}
              style={{ minWidth: '130px', fontWeight: 700, background: '#10b981', borderColor: '#10b981' }}
            >
              ✓ Đã biết (Z)
            </Button>

            <Button
              variant="secondary"
              size="lg"
              onClick={handleNextCard}
              disabled={currentIndex === words.length - 1}
              style={{ minWidth: '120px' }}
            >
              Sau <ChevronRight size={18} />
            </Button>
          </div>
        </div>
      )}

      {/* 3.4 LAYER 2: SPACIOUS FULL-WIDTH LIST (Danh sách thuật ngữ trong bài này) */}
      <div>
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
          <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text)' }}>
            Danh sách từ vựng trong Unit này ({words.length})
          </h3>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--color-text-muted)' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Lọc từ trong bài..."
              style={{
                width: '100%',
                height: '34px',
                background: 'var(--color-bg, #0f172a)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                paddingLeft: '2rem',
                color: 'var(--color-text)',
                fontSize: '0.85rem',
              }}
            />
          </div>
        </div>

        {/* Spacious Rows (Như mẫu NhaiKanji media_1788263440921.png) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {words.map((item, index) => {
            const isSaved = isVocabSaved(item)

            return (
              <div
                key={item.id}
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '12px',
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
                  transition: 'border-color 0.15s ease',
                }}
              >
                {/* Row 1: Word + Pronunciation + Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '1.25rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                      {index + 1}.
                    </span>
                    <span
                      style={{
                        fontSize: '1.85rem',
                        fontFamily: 'var(--font-jp)',
                        fontWeight: 800,
                        color: 'var(--color-text)',
                        lineHeight: 1.1,
                      }}
                    >
                      {item.word}
                    </span>
                    {item.reading && item.reading !== item.word && (
                      <span
                        style={{
                          fontSize: '1.15rem',
                          fontFamily: 'var(--font-jp)',
                          color: '#3b82f6',
                          fontWeight: 700,
                        }}
                      >
                        【{item.reading}】
                      </span>
                    )}
                    {item.hanViet && (
                      <span
                        style={{ fontSize: '0.82rem', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase' }}
                      >
                        [{item.hanViet}]
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => playAudio(item.audioUrl, item.word)}
                      style={{
                        background: playingAudioUrl === item.audioUrl ? '#2563eb' : 'rgba(37, 99, 235, 0.1)',
                        border: 'none',
                        color: playingAudioUrl === item.audioUrl ? '#ffffff' : '#2563eb',
                        borderRadius: '50%',
                        padding: '7px',
                        cursor: 'pointer',
                      }}
                      title="Nghe phát âm"
                    >
                      <Volume2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveWordToSrs(item)}
                      style={{
                        background: isSaved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--color-border)',
                        color: isSaved ? '#10b981' : 'var(--color-text-muted)',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="Lưu vào thẻ ôn tập Anki SRS"
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

                {/* Row 2: Meaning */}
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#059669', marginLeft: '2rem' }}>
                  👉 {item.meaning}
                </div>

                {/* Row 3: Example sentence with Audio */}
                {item.examples?.[0] && (
                  <div
                    style={{
                      marginLeft: '2rem',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '8px',
                      padding: '0.65rem 0.9rem',
                    }}
                  >
                    {(() => {
                      const firstEx = item.examples[0]
                      if (!firstEx) return null
                      return (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div
                              style={{
                                fontFamily: 'var(--font-jp)',
                                fontSize: '0.98rem',
                                fontWeight: 600,
                                color: 'var(--color-text)',
                              }}
                            >
                              {firstEx.jp}
                            </div>
                            <button
                              type="button"
                              onClick={() => playAudio(undefined, firstEx.jp)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-text-muted)',
                                cursor: 'pointer',
                                padding: '2px',
                              }}
                              title="Đọc câu ví dụ"
                            >
                              <Volume2 size={14} />
                            </button>
                          </div>
                          {firstEx.vi && (
                            <div
                              style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}
                            >
                              {firstEx.vi}
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default VocabularyPage
