import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  X,
  Volume2,
  Sparkles,
  PenTool,
  BookmarkPlus,
  Check,
  BookOpen,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { nhaikanjiApi } from './nhaikanjiApi'
import type { KanjiSummary, KanjiVocabExample } from './nhaikanjiTypes'
import { KanjiCanvas } from './KanjiCanvas'
import { Button, Badge } from '../../components/ui'
import { srsApi } from '../srs/srsApi'
import { useAuth } from '../auth/authContext'

interface KanjiDetailModalProps {
  kanjiSummary: KanjiSummary
  onClose: () => void
  onSelectKanji?: (kanji: string) => void
}

export function KanjiDetailModal({ kanjiSummary, onClose, onSelectKanji }: KanjiDetailModalProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'info' | 'practice'>('info')
  const [playingAudio, setPlayingAudio] = useState<string | null>(null)
  const [savedSrs, setSavedSrs] = useState<Record<string, boolean>>({})
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const queryClient = useQueryClient()

  const { data: detailData, isLoading } = useQuery({
    queryKey: ['nhaikanji', 'kanjiDetail', kanjiSummary.kanji],
    queryFn: () => nhaikanjiApi.fetchKanjiDetail(kanjiSummary.kanji),
  })

  // Fetch saved SRS terms from server to know which items are already saved
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
        map[`${entry.type}_${entry.term}`] = true
        map[entry.term] = true
      }
    }
    setSavedSrs(map)
  }, [savedTermsData])

  const playAudio = (url?: string) => {
    if (!url) return
    if (audioRef.current) {
      audioRef.current.pause()
    }
    const audio = new Audio(url)
    audioRef.current = audio
    setPlayingAudio(url)
    audio.play().catch(() => setPlayingAudio(null))
    audio.onended = () => setPlayingAudio(null)
    audio.onerror = () => setPlayingAudio(null)
  }

  const handleSaveToSrs = async (word: string, meaning: string, reading: string) => {
    try {
      await srsApi.addCard({
        type: 'vocab',
        term: word,
        meaning,
        reading,
        jlptLevel: (kanjiSummary.jlpt_level || 'N3').toUpperCase(),
      })
      setSavedSrs((prev) => ({ ...prev, [`vocab_${word}`]: true, [word]: true }))
      await queryClient.invalidateQueries({ queryKey: ['srs'] })
    } catch (err) {
      console.error('Không thể lưu từ vào SRS:', err)
    }
  }

  const kanjiInfo = detailData?.detail?.kanjiInfo
  const examples: KanjiVocabExample[] = kanjiInfo?.kanjialiveData?.examples || []

  const isKanjiSaved = Boolean(savedSrs[`kanji_${kanjiSummary.kanji}`] || savedSrs[kanjiSummary.kanji])

  const handleSaveKanjiToSrs = async () => {
    try {
      const reading = `${kanjiSummary.onyomi || ''} ${kanjiSummary.kunyomi || ''}`.trim()
      const strokeCountNum =
        typeof kanjiSummary.stroke_count === 'number'
          ? kanjiSummary.stroke_count
          : Number.parseInt(String(kanjiSummary.stroke_count || 0), 10) || 0

      await srsApi.addCard({
        type: 'kanji',
        term: kanjiSummary.kanji,
        reading,
        hanViet: kanjiSummary.hanzi || '',
        meaning: kanjiSummary.meaning_vi || kanjiInfo?.meaning || '',
        jlptLevel: (kanjiSummary.jlpt_level || 'N5').toUpperCase(),
        radical: kanjiSummary.radical_utf || kanjiInfo?.kanjialiveData?.rad_utf || undefined,
        strokeCount: strokeCountNum,
        story: kanjiSummary.story || kanjiInfo?.story || '',
      })
      setSavedSrs((prev) => ({
        ...prev,
        [`kanji_${kanjiSummary.kanji}`]: true,
        [kanjiSummary.kanji]: true,
      }))
      await queryClient.invalidateQueries({ queryKey: ['srs'] })
    } catch (err) {
      console.error('Không thể lưu chữ Hán vào SRS:', err)
    }
  }

  return (
    <div className="nhaikanji-modal-backdrop" onClick={onClose}>
      <div className="nhaikanji-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="nhaikanji-modal__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Badge variant="primary" className="text-xs font-bold">
              {kanjiSummary.jlpt_level || 'N5'}
            </Badge>
            <h2
              style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span style={{ fontSize: '1.5rem', fontFamily: 'var(--font-serif, "Fraunces", serif)' }}>
                {kanjiSummary.kanji}
              </span>
              <span style={{ color: '#d97706', fontWeight: 800, textTransform: 'uppercase' }}>
                【{kanjiSummary.hanzi}】
              </span>
              <span style={{ fontSize: '0.875rem', fontWeight: 400, color: '#64748b' }}>{kanjiSummary.meaning_vi}</span>
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Button
              variant={isKanjiSaved ? 'secondary' : 'primary'}
              size="sm"
              onClick={handleSaveKanjiToSrs}
              style={{ fontSize: '0.75rem', padding: '2px 8px', height: '28px' }}
              title="Lưu chữ Hán này vào sổ ôn tập SRS"
            >
              {isKanjiSaved ? (
                <>
                  <Check size={13} color="#10b981" /> Đã lưu Hán tự
                </>
              ) : (
                <>
                  <BookmarkPlus size={13} /> +SRS Hán tự
                </>
              )}
            </Button>
            {kanjiSummary.prev_kanji && onSelectKanji && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (kanjiSummary.prev_kanji) onSelectKanji(kanjiSummary.prev_kanji)
                }}
                title={`Chữ trước: ${kanjiSummary.prev_kanji}`}
              >
                <ChevronLeft size={16} />
              </Button>
            )}
            {kanjiSummary.next_kanji && onSelectKanji && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (kanjiSummary.next_kanji) onSelectKanji(kanjiSummary.next_kanji)
                }}
                title={`Chữ kế: ${kanjiSummary.next_kanji}`}
              >
                <ChevronRight size={16} />
              </Button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.375rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'transparent',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
              aria-label="Đóng modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="nhaikanji-modal__tabs">
          <button
            type="button"
            className={`nhaikanji-modal__tab${activeTab === 'info' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            <BookOpen size={16} />
            Chi tiết & Từ vựng ({examples.length || kanjiSummary.num_vocab_examples})
          </button>
          <button
            type="button"
            className={`nhaikanji-modal__tab${activeTab === 'practice' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('practice')}
          >
            <PenTool size={16} />
            Luyện viết nét ({kanjiSummary.stroke_count} nét)
          </button>
        </div>

        {/* Content Body */}
        <div className="nhaikanji-modal__body">
          {activeTab === 'practice' ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem 0',
              }}
            >
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Tập viết chữ:{' '}
                <span
                  style={{ fontSize: '1.5rem', color: '#4f46e5', fontFamily: 'var(--font-serif, "Fraunces", serif)' }}
                >
                  {kanjiSummary.kanji}
                </span>{' '}
                ({kanjiSummary.stroke_count} nét)
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem' }}>
                Dùng chuột hoặc ngón tay để vẽ các nét theo chữ mẫu mờ bên dưới
              </p>
              <KanjiCanvas kanjiChar={kanjiSummary.kanji} />
            </div>
          ) : (
            <>
              {/* Top Overview Cards */}
              <div
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}
              >
                {/* Kanji Block */}
                <div
                  style={{
                    background: '#eef2ff',
                    border: '1px solid #e0e7ff',
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: '3.5rem',
                      fontFamily: 'var(--font-serif, "Fraunces", serif)',
                      fontWeight: 700,
                      color: '#4338ca',
                      lineHeight: 1,
                      marginBottom: '0.5rem',
                    }}
                  >
                    {kanjiSummary.kanji}
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>
                    {kanjiSummary.hanzi}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                    {kanjiSummary.stroke_count} nét • JLPT {kanjiSummary.jlpt_level}
                  </div>
                </div>

                {/* Readings Block */}
                <div
                  style={{
                    background: 'var(--color-bg-subtle, #f8fafc)',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <div>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                      }}
                    >
                      Âm On (Onyomi):
                    </span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text, #0f172a)' }}>
                      {kanjiSummary.onyomi || '—'}
                    </span>
                  </div>
                  <div>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                      }}
                    >
                      Âm Kun (Kunyomi):
                    </span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text, #0f172a)' }}>
                      {kanjiSummary.kunyomi || '—'}
                    </span>
                  </div>
                </div>

                {/* Radical Block */}
                <div
                  style={{
                    background: 'var(--color-bg-subtle, #f8fafc)',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      color: '#94a3b8',
                      textTransform: 'uppercase',
                    }}
                  >
                    <Layers size={14} /> Bộ thủ (Radical):
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <span
                      style={{
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        color: '#4f46e5',
                        fontFamily: 'var(--font-serif, "Fraunces", serif)',
                      }}
                    >
                      {kanjiSummary.radical_utf}
                    </span>
                    <div>
                      <span
                        style={{
                          display: 'block',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--color-text, #0f172a)',
                        }}
                      >
                        {kanjiSummary.radical_name_ja}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{kanjiSummary.radical_meaning}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mnemonic Story (Chiết tự gợi nhớ) */}
              {kanjiSummary.story && (
                <div
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    padding: '1rem',
                    borderRadius: '0.75rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      color: '#92400e',
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      marginBottom: '0.25rem',
                    }}
                  >
                    <Sparkles size={16} />
                    <span>Chiết tự & Câu chuyện gợi nhớ</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#78350f', lineHeight: 1.6, fontWeight: 500 }}>
                    {kanjiSummary.story}
                  </p>
                </div>
              )}

              {/* Vocabulary & Audio Examples */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Từ vựng & Ví dụ kèm Audio ({examples.length})</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#64748b' }}>
                    Phát âm chuẩn & Cao độ Pitch Accent
                  </span>
                </h3>

                {isLoading ? (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8', fontSize: '0.875rem' }}>
                    Đang tải danh sách từ vựng chi tiết...
                  </div>
                ) : examples.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '1.5rem 0',
                      color: '#64748b',
                      fontSize: '0.875rem',
                      background: 'var(--color-bg-subtle, #f8fafc)',
                      borderRadius: '0.75rem',
                    }}
                  >
                    Chưa có từ vựng ví dụ cho chữ này.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {examples.map((ex, idx) => {
                      const isWordAudioPlaying = playingAudio === ex.audio
                      const isSentAudioPlaying = playingAudio === ex.audioExample
                      const isSaved = savedSrs[ex.word]

                      return (
                        <div
                          key={ex.id || idx}
                          style={{
                            background: 'var(--color-bg-surface, #ffffff)',
                            border: '1px solid var(--color-border, #e2e8f0)',
                            borderRadius: '0.75rem',
                            padding: '1rem',
                          }}
                        >
                          {/* Word Header */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: '0.75rem',
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span
                                  style={{
                                    fontSize: '1.125rem',
                                    fontWeight: 700,
                                    fontFamily: 'var(--font-serif, "Fraunces", serif)',
                                  }}
                                >
                                  {ex.word}
                                </span>
                                <span style={{ fontSize: '0.875rem', color: '#4f46e5', fontWeight: 600 }}>
                                  【{ex.reading}】
                                </span>
                                {ex.yinHan && (
                                  <span
                                    style={{
                                      fontSize: '0.75rem',
                                      background: 'var(--color-bg-subtle, #f1f5f9)',
                                      padding: '0.125rem 0.375rem',
                                      borderRadius: '0.25rem',
                                      color: '#475569',
                                      fontWeight: 600,
                                    }}
                                  >
                                    {ex.yinHan}
                                  </span>
                                )}
                              </div>
                              <div
                                style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text, #0f172a)' }}
                              >
                                {ex.meaning}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {ex.audio && (
                                <button
                                  type="button"
                                  onClick={() => playAudio(ex.audio)}
                                  style={{
                                    padding: '0.5rem',
                                    borderRadius: '50%',
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: isWordAudioPlaying ? '#4f46e5' : '#eef2ff',
                                    color: isWordAudioPlaying ? '#ffffff' : '#4f46e5',
                                  }}
                                  title="Nghe phát âm từ vựng"
                                >
                                  <Volume2 size={16} />
                                </button>
                              )}

                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleSaveToSrs(ex.word, ex.meaning, ex.reading)}
                                title="Lưu từ vào thẻ ôn tập SRS"
                              >
                                {isSaved ? (
                                  <>
                                    <Check size={14} className="text-emerald-500" /> Đã lưu
                                  </>
                                ) : (
                                  <>
                                    <BookmarkPlus size={14} /> +SRS
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>

                          {/* Pitch Accent Waveform if available */}
                          {ex.audioWaveform && ex.audioWaveform.length > 0 && (
                            <div
                              style={{
                                marginTop: '0.5rem',
                                paddingTop: '0.5rem',
                                borderTop: '1px solid var(--color-border-subtle, #f1f5f9)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '0.625rem',
                                  textTransform: 'uppercase',
                                  fontWeight: 700,
                                  color: '#94a3b8',
                                }}
                              >
                                Pitch Waveform:
                              </span>
                              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '16px' }}>
                                {ex.audioWaveform.slice(0, 32).map((val, wIdx) => (
                                  <div
                                    key={wIdx}
                                    style={{
                                      width: '3px',
                                      backgroundColor: '#818cf8',
                                      borderRadius: '1px',
                                      height: `${Math.max(15, Math.min(100, val * 100))}%`,
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Example Sentence */}
                          {ex.example && (
                            <div
                              style={{
                                marginTop: '0.75rem',
                                background: 'var(--color-bg-subtle, #f8fafc)',
                                padding: '0.75rem',
                                borderRadius: '0.5rem',
                                border: '1px solid var(--color-border-subtle, #e2e8f0)',
                                fontSize: '0.75rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.25rem',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div
                                  style={{
                                    fontFamily: 'var(--font-serif, "Fraunces", serif)',
                                    fontWeight: 600,
                                    fontSize: '0.875rem',
                                  }}
                                >
                                  {ex.example}
                                </div>
                                {ex.audioExample && (
                                  <button
                                    type="button"
                                    onClick={() => playAudio(ex.audioExample)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: isSentAudioPlaying ? '#4f46e5' : '#94a3b8',
                                    }}
                                    title="Nghe câu ví dụ"
                                  >
                                    <Volume2 size={14} />
                                  </button>
                                )}
                              </div>
                              {ex.readingExample && (
                                <div style={{ color: '#64748b', fontFamily: 'var(--font-mono, monospace)' }}>
                                  {ex.readingExample}
                                </div>
                              )}
                              {ex.exampleVi && (
                                <div style={{ color: 'var(--color-text, #334155)' }}>👉 {ex.exampleVi}</div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
