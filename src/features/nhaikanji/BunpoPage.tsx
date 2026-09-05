import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  BookmarkPlus,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Layers,
  ListTree,
  Search,
  Volume2,
} from 'lucide-react'
import { Badge, Button } from '../../components/ui'
import PageHeader from '../../components/PageHeader'
import { srsApi } from '../srs/srsApi'
import type { CurriculumGrammar } from '../srs/srsTypes'
import { useAuth } from '../auth/authContext'

const GRAMMAR_CATALOG = [
  {
    id: 'shinkanzen_n3',
    title: 'Shinkanzen Master N3 (新完全マスター)',
    subtitle: 'Shinkanzen Master N3',
    badge: '99 mẫu • 19 bài • Audio',
    level: 'N3',
    color: '#84cc16',
    bg: 'linear-gradient(135deg, rgba(132, 204, 22, 0.15) 0%, rgba(101, 163, 13, 0.05) 100%)',
    border: 'rgba(132, 204, 22, 0.3)',
  },
  {
    id: 'mimikara_n3',
    title: 'Mimikara Oboeru N3 (耳から覚える文法)',
    subtitle: 'Mimikara Oboeru N3',
    badge: '110 mẫu • 11 bài • Furigana',
    level: 'N3',
    color: '#06b6d4',
    bg: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(8, 145, 178, 0.05) 100%)',
    border: 'rgba(6, 182, 212, 0.3)',
  },
  {
    id: 'shinkanzen_n2',
    title: 'Shinkanzen Master N2 (新完全マスター)',
    subtitle: 'Shinkanzen Master N2',
    badge: '151 mẫu • 26 bài • Audio',
    level: 'N2',
    color: '#10b981',
    bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.05) 100%)',
    border: 'rgba(16, 185, 129, 0.3)',
  },
  {
    id: 'shinkanzen_n1',
    title: 'Shinkanzen Master N1 (新完全マスター)',
    subtitle: 'Shinkanzen Master N1',
    badge: '88 mẫu • 20 bài • Audio',
    level: 'N1',
    color: '#f59e0b',
    bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.05) 100%)',
    border: 'rgba(245, 158, 11, 0.3)',
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
  // Navigation: 'catalog' -> 'lessons' -> 'study'
  const [selectedBook, setSelectedBook] = useState<string | null>(null)
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null)
  const [studyMode, setStudyMode] = useState<'flashcard' | 'list'>('flashcard')

  // In-Lesson Flashcard state
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [, setKnownGrammars] = useState<Set<string>>(new Set())
  const [savedSrs, setSavedSrs] = useState<Record<string, boolean>>({})
  const [activePointId, setActivePointId] = useState<string | null>(null)
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
      if (entry?.type === 'grammar' && entry?.term) {
        // Match by term (pattern) since we don't know the curriculum item ID on the server
        map[`grammar_term_${entry.term}`] = true
        map[entry.term] = true
      }
    }
    setSavedSrs(map)
  }, [savedTermsData])

  const [searchQuery, setSearchQuery] = useState('')
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 1. Fetch Lessons for the selected Book
  const { data: lessonsList } = useQuery({
    queryKey: ['curriculum', 'lessons', selectedBook],
    queryFn: () => srsApi.fetchLessons(selectedBook || 'shinkanzen_n3'),
    enabled: Boolean(selectedBook),
  })

  // 2. Fetch Grammar items for the current Lesson
  const { data: grammarData } = useQuery({
    queryKey: ['curriculum', 'grammar', selectedBook, selectedLesson, searchQuery],
    queryFn: () =>
      srsApi.fetchCurriculumGrammar({
        curriculum: selectedBook || undefined,
        lesson: selectedLesson || undefined,
        query: searchQuery,
        page: 1,
        limit: 100,
      }),
    enabled: Boolean(selectedBook && selectedLesson),
  })

  const grammars = grammarData?.items || []
  const currentCard = grammars[currentIndex] || null

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

  // Keyboard shortcut listener for in-lesson flashcard
  useEffect(() => {
    if (!selectedLesson || studyMode !== 'flashcard' || !currentCard) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return

      if (e.code === 'Space') {
        e.preventDefault()
        setIsFlipped((f) => !f)
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        setKnownGrammars((prev) => new Set(prev).add(currentCard.id))
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
  }, [selectedLesson, studyMode, currentCard, isFlipped, grammars.length])

  const handleSaveToSrs = async (item: CurriculumGrammar) => {
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
    } catch (err) {
      console.error('Không thể lưu ngữ pháp vào SRS:', err)
    }
  }

  /** Check if a grammar item is saved — matches both local ID key and server term key */
  const isGrammarSaved = (item: CurriculumGrammar) =>
    savedSrs[`grammar_${item.id}`] || savedSrs[`grammar_term_${item.pattern}`] || false

  const currentBookInfo = GRAMMAR_CATALOG.find((b) => b.id === selectedBook)

  // =========================================================================
  // VIEW 1: CATALOG OVERVIEW (Chọn bộ giáo trình Ngữ Pháp - media_1788263283117.png)
  // =========================================================================
  if (!selectedBook) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.25rem 1rem' }}>
        <PageHeader
          eyebrow="NGỮ PHÁP TIẾNG NHẬT CHUẨN JLPT"
          title="Kho Giáo Trình Ngữ Pháp (Shinkanzen Master & Mimikara)"
          description="Học theo từng bài và mẫu câu với cấu trúc chi tiết, furigana sạch sẽ, file nghe audio MP3 gốc và flashcard ôn tập trực tiếp."
        />

        {/* N3 Section */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <div style={{ width: '4px', height: '24px', background: '#84cc16', borderRadius: '2px' }} />
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)' }}>
              Ngữ pháp Chuyên sâu N3
            </h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Shinkanzen & Mimikara N3</span>
          </div>

          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}
          >
            {GRAMMAR_CATALOG.filter((b) => b.level === 'N3').map((book) => (
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
                      style={{ margin: '4px 0 0 0', fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text)' }}
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
                    <GraduationCap size={24} />
                  </div>
                </div>

                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}
                >
                  <Badge variant="primary" className="text-xs font-bold">
                    {book.badge}
                  </Badge>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: book.color }}>Vào học ngay →</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* N2 Section */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <div style={{ width: '4px', height: '24px', background: '#10b981', borderRadius: '2px' }} />
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)' }}>
              Ngữ pháp Chuyên sâu N2
            </h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Shinkanzen Master N2</span>
          </div>

          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}
          >
            {GRAMMAR_CATALOG.filter((b) => b.level === 'N2').map((book) => (
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
                      style={{ margin: '4px 0 0 0', fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text)' }}
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
                    <GraduationCap size={24} />
                  </div>
                </div>

                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}
                >
                  <Badge variant="primary" className="text-xs font-bold">
                    {book.badge}
                  </Badge>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: book.color }}>Vào học ngay →</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* N1 Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <div style={{ width: '4px', height: '24px', background: '#f59e0b', borderRadius: '2px' }} />
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)' }}>
              Ngữ pháp Chuyên sâu N1
            </h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Shinkanzen Master N1</span>
          </div>

          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}
          >
            {GRAMMAR_CATALOG.filter((b) => b.level === 'N1').map((book) => (
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
                      style={{ margin: '4px 0 0 0', fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text)' }}
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
                    <GraduationCap size={24} />
                  </div>
                </div>

                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}
                >
                  <Badge variant="primary" className="text-xs font-bold">
                    {book.badge}
                  </Badge>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: book.color }}>Vào học ngay →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // VIEW 2: LESSONS GRID (Danh sách bài học - media_1788263395027.png)
  // =========================================================================
  if (selectedBook && selectedLesson === null) {
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
            {lessonsList?.length || 0} bài học · Chọn một bài học để bắt đầu ôn tập ngữ pháp hoặc làm Flashcard.
          </p>
        </div>

        {/* Lesson Cards Grid (media_1788263395027.png) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
          {lessonsList?.map((lesson) => (
            <div
              key={lesson.lesson_id}
              onClick={() => {
                setSelectedLesson(lesson.lesson_id)
                setCurrentIndex(0)
                setIsFlipped(false)
              }}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '12px',
                padding: '1.25rem 1.5rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = currentBookInfo?.color || '#84cc16'
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
                  BÀI HỌC
                </div>
                <h4 style={{ margin: '2px 0 0 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  {lesson.lesson_title}
                </h4>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                  {lesson.count} mẫu
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
  // VIEW 3: IN-LESSON STUDY & FLASHCARD VIEW
  // =========================================================================
  const currentLessonInfo = lessonsList?.find((l) => l.lesson_id === selectedLesson)

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
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
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>
            {currentBookInfo?.subtitle} - {currentLessonInfo?.lesson_title}
          </h2>
        </div>

        {onGoToSrs && (
          <Button variant="secondary" size="sm" onClick={onGoToSrs}>
            <Layers size={15} /> Mở Thẻ Ôn Tập Anki
          </Button>
        )}
      </div>

      {/* 3.2 Mode Bar */}
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
            background: studyMode === 'flashcard' ? '#84cc16' : 'transparent',
            color: studyMode === 'flashcard' ? '#000000' : 'var(--color-text-secondary)',
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
            background: studyMode === 'list' ? '#84cc16' : 'transparent',
            color: studyMode === 'list' ? '#000000' : 'var(--color-text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <BookOpen size={16} /> Danh Sách ({grammars.length})
        </button>
      </div>

      {/* 3.3 LAYER 1: IN-LESSON FLASHCARD FOR GRAMMAR */}
      {studyMode === 'flashcard' && currentCard && (
        <div style={{ marginBottom: '2.5rem' }}>
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
            {/* Top Bar */}
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Badge variant="primary" className="text-xs font-bold">
                {currentCard.level}
              </Badge>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    const firstAudio = currentCard.examples?.find((ex) => ex.audio)?.audio
                    playAudio(firstAudio, currentCard.pattern)
                  }}
                  style={{
                    background: 'rgba(132, 204, 22, 0.2)',
                    border: 'none',
                    borderRadius: '50%',
                    padding: '8px',
                    color: '#a3e635',
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
                    void handleSaveToSrs(currentCard)
                  }}
                  style={{
                    background: isGrammarSaved(currentCard) ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
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
                  {isGrammarSaved(currentCard) ? '✓ Đã vào SRS' : '+ Thêm SRS (C)'}
                </button>
              </div>
            </div>

            {/* Center Content */}
            <div style={{ margin: 'auto 0', width: '100%' }}>
              {!isFlipped ? (
                // FRONT SIDE
                <div>
                  <div
                    style={{
                      fontSize: '2.5rem',
                      fontFamily: 'var(--font-jp)',
                      fontWeight: 800,
                      color: '#ffffff',
                    }}
                  >
                    {currentCard.pattern}
                  </div>
                  {currentCard.structure && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        fontFamily: 'var(--font-jp)',
                        color: '#60a5fa',
                        fontSize: '1.05rem',
                        fontWeight: 600,
                      }}
                    >
                      ✦ Cấu trúc: {currentCard.structure}
                    </div>
                  )}

                  {currentCard.groups && currentCard.groups.length > 1 && (
                    <div style={{ marginTop: '0.6rem' }}>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          padding: '3px 10px',
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

                  <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '0.85rem' }}>
                    Nhấn [Space] hoặc chạm để lật xem ý nghĩa & 1 ví dụ mỗi nghĩa
                  </div>
                </div>
              ) : (
                // BACK SIDE
                <div style={{ width: '100%' }}>
                  <div
                    style={{
                      fontSize: '1.8rem',
                      fontFamily: 'var(--font-jp)',
                      fontWeight: 800,
                      color: '#ffffff',
                      marginBottom: '0.5rem',
                    }}
                  >
                    {currentCard.pattern}
                  </div>

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
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          justifyContent: 'center',
                          marginBottom: '0.2rem',
                        }}
                      >
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
                          Mẫu ngữ pháp có {currentCard.groups.length} nghĩa & cách dùng
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
                              borderRadius: '12px',
                              padding: '0.85rem 1rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  background: '#3b82f6',
                                  color: '#ffffff',
                                  borderRadius: '999px',
                                  padding: '1px 8px',
                                }}
                              >
                                Nghĩa {group.group_no || gIdx + 1}
                              </span>
                              <span style={{ fontSize: '0.98rem', fontWeight: 700, color: '#34d399' }}>
                                {group.meaning || group.usage || ''}
                              </span>
                            </div>

                            {group.structure && (
                              <div
                                style={{
                                  fontFamily: 'var(--font-jp)',
                                  fontSize: '0.86rem',
                                  color: '#60a5fa',
                                  fontWeight: 600,
                                  margin: '3px 0',
                                }}
                              >
                                ✦ {group.structure}
                              </div>
                            )}

                            {group.usage && group.usage !== group.meaning && (
                              <div
                                style={{
                                  fontSize: '0.82rem',
                                  color: '#94a3b8',
                                  margin: '3px 0 6px 0',
                                  lineHeight: 1.35,
                                }}
                              >
                                ◎ {group.usage}
                              </div>
                            )}

                            {/* Exactly 1 Example per sub-meaning with clean Furigana Ruby & Audio */}
                            {firstEx && (
                              <div
                                style={{
                                  marginTop: '0.5rem',
                                  padding: '0.65rem 0.85rem',
                                  background: 'rgba(0, 0, 0, 0.25)',
                                  border: '1px solid rgba(255, 255, 255, 0.06)',
                                  borderRadius: '8px',
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
                                      color: '#f1f5f9',
                                      lineHeight: 1.6,
                                    }}
                                    dangerouslySetInnerHTML={{ __html: firstEx.jp_ruby || firstEx.jp }}
                                  />
                                  {firstEx.vi && (
                                    <div style={{ color: '#cbd5e1', fontSize: '0.84rem', marginTop: '3px' }}>
                                      {firstEx.vi}
                                    </div>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    playAudio(firstEx.audio, firstEx.jp)
                                  }}
                                  style={{
                                    background: 'rgba(59, 130, 246, 0.15)',
                                    border: '1px solid rgba(59, 130, 246, 0.3)',
                                    color: '#60a5fa',
                                    borderRadius: '50%',
                                    padding: '7px',
                                    cursor: 'pointer',
                                    flexShrink: 0,
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
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399', marginTop: '0.5rem' }}>
                        👉 {currentCard.shortMeaning || currentCard.explanation}
                      </div>

                      {currentCard.structure && (
                        <div
                          style={{
                            fontFamily: 'var(--font-jp)',
                            color: '#60a5fa',
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            marginTop: '0.5rem',
                          }}
                        >
                          ✦ Cấu trúc: {currentCard.structure}
                        </div>
                      )}

                      {currentCard.explanation && currentCard.explanation !== currentCard.shortMeaning && (
                        <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.5rem', lineHeight: 1.4 }}>
                          {currentCard.explanation}
                        </div>
                      )}

                      {(() => {
                        const firstEx = currentCard.examples?.[0]
                        if (!firstEx) return null
                        return (
                          <div
                            style={{
                              marginTop: '1rem',
                              padding: '0.85rem 1rem',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '10px',
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
                                  color: '#f1f5f9',
                                  lineHeight: 1.6,
                                }}
                                dangerouslySetInnerHTML={{
                                  __html: firstEx.jp_ruby || firstEx.jp,
                                }}
                              />
                              {firstEx.vi && (
                                <div style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: '4px' }}>
                                  {firstEx.vi}
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                playAudio(firstEx.audio, firstEx.jp)
                              }}
                              style={{
                                background: 'rgba(59, 130, 246, 0.15)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                color: '#60a5fa',
                                borderRadius: '50%',
                                padding: '8px',
                                cursor: 'pointer',
                                flexShrink: 0,
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
                setKnownGrammars((prev) => new Set(prev).add(currentCard.id))
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
              disabled={currentIndex === grammars.length - 1}
              style={{ minWidth: '120px' }}
            >
              Sau <ChevronRight size={18} />
            </Button>
          </div>
        </div>
      )}

      {/* 3.4 LAYER 2: SPACIOUS FULL-WIDTH LIST (Danh sách mẫu ngữ pháp trong bài) */}
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
            Danh sách mẫu ngữ pháp trong bài ({grammars.length})
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
              placeholder="Lọc mẫu câu trong bài..."
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
                  style={{
                    scrollMarginTop: '85px',
                    background: 'var(--color-surface)',
                    border: isSelected ? '2px solid #ec4899' : '1px solid var(--color-border)',
                    borderRadius: '14px',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                    boxShadow: isSelected ? '0 4px 20px rgba(236, 72, 153, 0.15)' : '0 2px 10px rgba(0, 0, 0, 0.04)',
                    transition: 'border 0.2s ease, box-shadow 0.2s ease',
                  }}
                >
                  {/* Header: Pattern & Level & SRS Button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                        {index + 1}.
                      </span>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '1.6rem',
                          fontFamily: 'var(--font-jp)',
                          fontWeight: 800,
                          color: 'var(--color-text)',
                        }}
                      >
                        {item.pattern}
                      </h3>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Badge variant="primary" className="text-xs font-bold">
                        {item.level}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => handleSaveToSrs(item)}
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                          Bao gồm {item.groups.length} nhóm nghĩa & cách dùng:
                        </span>
                      </div>

                      {item.groups.map((group, gIdx) => (
                        <div
                          key={gIdx}
                          style={{
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '10px',
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.6rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                background: '#3b82f6',
                                color: '#ffffff',
                                borderRadius: '999px',
                                padding: '2px 8px',
                              }}
                            >
                              Nghĩa {group.group_no || gIdx + 1}
                            </span>
                            <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>
                              👉 {group.meaning || group.usage || ''}
                            </span>
                          </div>

                          {group.structure && (
                            <div
                              style={{
                                fontFamily: 'var(--font-jp)',
                                fontSize: '0.92rem',
                                fontWeight: 600,
                                color: '#3b82f6',
                                background: 'rgba(59, 130, 246, 0.06)',
                                padding: '0.4rem 0.75rem',
                                borderRadius: '6px',
                              }}
                            >
                              ✦ Cấu trúc: {group.structure}
                            </div>
                          )}

                          {group.usage && group.usage !== group.meaning && (
                            <div style={{ fontSize: '0.88rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                              ◎ Giải thích: {group.usage}
                            </div>
                          )}

                          {/* Examples in group */}
                          {group.examples && group.examples.length > 0 && (
                            <div
                              style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.2rem' }}
                            >
                              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                VÍ DỤ (Nghĩa {group.group_no || gIdx + 1}):
                              </div>
                              {group.examples.map((ex, exIdx) => (
                                <div
                                  key={exIdx}
                                  style={{
                                    background: 'var(--color-bg, #0f172a)',
                                    border: '1px solid rgba(255, 255, 255, 0.06)',
                                    borderRadius: '8px',
                                    padding: '0.65rem 0.9rem',
                                  }}
                                >
                                  <div
                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                  >
                                    <div
                                      style={{
                                        fontFamily: 'var(--font-jp)',
                                        fontSize: '1rem',
                                        fontWeight: 600,
                                        color: 'var(--color-text)',
                                        lineHeight: 1.6,
                                      }}
                                      dangerouslySetInnerHTML={{ __html: ex.jp_ruby || ex.jp }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => playAudio(ex.audio, ex.jp)}
                                      style={{
                                        background:
                                          playingAudioUrl === ex.audio ? '#3b82f6' : 'rgba(59, 130, 246, 0.12)',
                                        border: 'none',
                                        color: playingAudioUrl === ex.audio ? '#ffffff' : '#3b82f6',
                                        borderRadius: '50%',
                                        padding: '6px',
                                        cursor: 'pointer',
                                        flexShrink: 0,
                                      }}
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
                      <div
                        style={{
                          background: 'rgba(236, 72, 153, 0.08)',
                          border: '1px solid rgba(236, 72, 153, 0.2)',
                          borderRadius: '8px',
                          padding: '0.65rem 1rem',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#ec4899',
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
                          👉 {item.shortMeaning || item.explanation}
                        </div>
                      </div>

                      {/* Structure */}
                      {item.structure && (
                        <div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: 'var(--color-text-muted)',
                              textTransform: 'uppercase',
                            }}
                          >
                            CẤU TRÚC:
                          </div>
                          <div
                            style={{
                              fontFamily: 'var(--font-jp)',
                              fontSize: '0.95rem',
                              fontWeight: 600,
                              color: '#3b82f6',
                              marginTop: '3px',
                              background: 'rgba(59, 130, 246, 0.06)',
                              padding: '0.5rem 0.8rem',
                              borderRadius: '6px',
                            }}
                          >
                            {item.structure}
                          </div>
                        </div>
                      )}

                      {/* Examples list */}
                      {item.examples && item.examples.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: 'var(--color-text-muted)',
                              textTransform: 'uppercase',
                            }}
                          >
                            VÍ DỤ MẪU ({item.examples.length}):
                          </div>
                          {item.examples.map((ex, exIdx) => (
                            <div
                              key={exIdx}
                              style={{
                                background: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                borderRadius: '8px',
                                padding: '0.65rem 0.9rem',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div
                                  style={{
                                    fontFamily: 'var(--font-jp)',
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    color: 'var(--color-text)',
                                    lineHeight: 1.6,
                                  }}
                                  dangerouslySetInnerHTML={{ __html: ex.jp_ruby || ex.jp }}
                                />
                                <button
                                  type="button"
                                  onClick={() => playAudio(ex.audio, ex.jp)}
                                  style={{
                                    background: playingAudioUrl === ex.audio ? '#3b82f6' : 'rgba(59, 130, 246, 0.12)',
                                    border: 'none',
                                    color: playingAudioUrl === ex.audio ? '#ffffff' : '#3b82f6',
                                    borderRadius: '50%',
                                    padding: '6px',
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                  }}
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
                    <div
                      style={{
                        fontSize: '0.86rem',
                        color: 'var(--color-text-secondary)',
                        lineHeight: 1.45,
                        background: 'rgba(239, 68, 68, 0.05)',
                        border: '1px solid rgba(239, 68, 68, 0.15)',
                        borderRadius: '8px',
                        padding: '0.6rem 0.85rem',
                        whiteSpace: 'pre-line',
                      }}
                    >
                      <b style={{ color: '#f87171' }}>⚠ Chú ý / Lưu ý:</b>
                      <div style={{ marginTop: '2px' }}>{item.notes}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Column 2: Sticky Table of Contents (Mục lục bài học) */}
          <aside
            style={{
              position: 'sticky',
              top: '80px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '14px',
              padding: '1rem',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
              maxHeight: 'calc(100vh - 100px)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
            }}
          >
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
                <ListTree size={16} style={{ color: '#ec4899' }} />
                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--color-text)' }}>Mục Lục Bài</span>
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--color-text-muted)',
                  background: 'rgba(255, 255, 255, 0.06)',
                  padding: '2px 8px',
                  borderRadius: '999px',
                }}
              >
                {grammars.length} mẫu
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {grammars.map((item, idx) => {
                const isSaved = isGrammarSaved(item)
                const isItemActive = activePointId === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActivePointId(item.id)
                      const el = document.getElementById(`grammar-point-${item.id}`)
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      border: 'none',
                      background: isItemActive ? 'rgba(236, 72, 153, 0.12)' : 'transparent',
                      color: isItemActive ? '#ec4899' : 'var(--color-text)',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: isItemActive ? 700 : 500,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isItemActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isItemActive) e.currentTarget.style.background = 'transparent'
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
                          fontSize: '0.75rem',
                          color: isItemActive ? '#ec4899' : 'var(--color-text-muted)',
                          fontWeight: 700,
                          minWidth: '16px',
                        }}
                      >
                        {idx + 1}.
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-jp)',
                          fontWeight: 700,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.pattern}
                      </span>
                    </div>
                    {isSaved && (
                      <span title="Đã lưu vào SRS" style={{ color: '#10b981', display: 'inline-flex', flexShrink: 0 }}>
                        <Check size={13} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default BunpoPage
