import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  X,
  Volume2,
  PenTool,
  BookOpen,
  Layers,
  ChevronLeft,
  ChevronRight,
  Image,
  BookmarkPlus,
  Check,
} from 'lucide-react'
import { nhaikanjiApi } from './nhaikanjiApi'
import { apiPaths } from '../../lib/apiClient'
import type { KanjiSummary, KanjiVocabExample } from './nhaikanjiTypes'
import { KanjiCanvas } from './KanjiCanvas'
import { KanjiConstellationGraph } from './KanjiConstellationGraph'
import { KanjiStrokePlayer } from './KanjiStrokePlayer'
import { srsApi } from '../srs/srsApi'
import { useAuth } from '../auth/authContext'
import { sumiAudio } from '../dictionary/sumiAudio'
import { getKanjiDescendants } from '../dictionary/kanjiDescendantsData'
import { getComponentLabel } from '../dictionary/kanjiEtymologyMap'
import {
  toCanonicalRadicalGlyph,
  getRadicalVietnameseName,
  translateRadicalMeaning,
} from '../dictionary/kanjiRadicalDictionary'

interface KanjiDetailModalProps {
  kanjiSummary: KanjiSummary
  onClose: () => void
  onSelectKanji?: (kanji: string) => void
}

// ─── Extract kanji chars from story text ──────────────────────────────────────
// Story format: "Núi (山) đá (石) hình thành từ nham thạch (岩)"
// Returns only chars that are NOT the focal kanji itself
function extractStoryComponents(story: string, focalKanji: string): Array<{ char: string; label: string }> {
  const matches = [...story.matchAll(/([^\s(（]+)?\s*[（(]([^\s）)]{1})[）)]/g)]
  const results: Array<{ char: string; label: string }> = []
  const seen = new Set<string>()
  const focalCanon = toCanonicalRadicalGlyph(focalKanji)
  for (const m of matches) {
    const rawLabel = (m[1] ?? '').trim()
    const rawChar = (m[2] ?? '').trim()
    const char = toCanonicalRadicalGlyph(rawChar)
    if (char && char !== focalKanji && char !== focalCanon && !seen.has(char) && /[\u4e00-\u9fff\u3400-\u4dbf\u2e80-\u2fd5]/.test(char)) {
      seen.add(char)
      const label = getComponentLabel(char, rawLabel)
      results.push({ char, label })
    }
  }
  return results
}

export function KanjiDetailModal({ kanjiSummary, onClose, onSelectKanji }: KanjiDetailModalProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'info' | 'practice'>('info')
  const [viewMode, setViewMode] = useState<'calligraphy' | 'illustration'>('calligraphy')
  const [playingAudio, setPlayingAudio] = useState<string | null>(null)
  const [savedSrs, setSavedSrs] = useState<Record<string, boolean>>({})
  const [illustrationError, setIllustrationError] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const queryClient = useQueryClient()

  // Reset illustration error when kanji changes
  useEffect(() => {
    setIllustrationError(false)
  }, [kanjiSummary.kanji])

  // Play brush sound on opening
  useEffect(() => {
    sumiAudio.initOnGesture()
    sumiAudio.playBrushFriction()
  }, [kanjiSummary.kanji])

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
          : parseInt(String(kanjiSummary.stroke_count || 0), 10)

      await srsApi.addCard({
        type: 'kanji',
        term: kanjiSummary.kanji,
        hanViet: kanjiSummary.hanzi,
        meaning: `${kanjiSummary.hanzi} - ${kanjiSummary.meaning_vi}`,
        reading,
        jlptLevel: (kanjiSummary.jlpt_level || 'N5').toUpperCase(),
        radical: kanjiSummary.radical_utf,
        strokeCount: strokeCountNum,
        story: kanjiSummary.story,
      })
      setSavedSrs((prev) => ({ ...prev, [`kanji_${kanjiSummary.kanji}`]: true, [kanjiSummary.kanji]: true }))
      await queryClient.invalidateQueries({ queryKey: ['srs'] })
    } catch (err) {
      console.error('Không thể lưu Hán tự vào SRS:', err)
    }
  }

  // ─── Constellation graph data ────────────────────────────────────────────────
  const storyComponents = useMemo(() =>
    kanjiSummary.story ? extractStoryComponents(kanjiSummary.story, kanjiSummary.kanji) : [],
    [kanjiSummary.story, kanjiSummary.kanji]
  )

  // Radical as a component (if not already in story)
  const radicalComponent = useMemo(() => {
    if (!kanjiSummary.radical_utf) return []
    const canonRadical = toCanonicalRadicalGlyph(kanjiSummary.radical_utf)
    const canonKanji = toCanonicalRadicalGlyph(kanjiSummary.kanji)
    const already = storyComponents.some(c => toCanonicalRadicalGlyph(c.char) === canonRadical)
    if (already || canonRadical === canonKanji) return []
    const viName = getRadicalVietnameseName(canonRadical)
    const viMeaning = translateRadicalMeaning(kanjiSummary.radical_meaning, canonRadical)
    return [{ char: canonRadical, label: viName || viMeaning }]
  }, [kanjiSummary, storyComponents])

  const allComponents = useMemo(() => [...storyComponents, ...radicalComponent], [storyComponents, radicalComponent])

  // Derived kanji (Phả hệ nở rộng)
  const descendantNodes = useMemo(
    () => getKanjiDescendants(kanjiSummary.kanji),
    [kanjiSummary.kanji]
  )

  // Illustration URL
  const illustrationUrl = apiPaths.nhaikanji.kanjiIllustration(kanjiSummary.kanji)

  // Dynamic layout: if kanji is a prolific root (>= 3 descendants) or has no upstream components, render descendant tree
  const isPrimitive = allComponents.length === 0
  const isDescendantMode = descendantNodes.length >= 3 || (isPrimitive && descendantNodes.length > 0)
  const hasAnyGraphData = allComponents.length > 0 || descendantNodes.length > 0

  // Handle navigate to constellation node
  const handleSelectConstellationKanji = (k: string) => {
    if (onSelectKanji) onSelectKanji(k)
  }

  const modalContent = (
    <div
      className="shodo-theater-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Trình diễn thư pháp chữ ${kanjiSummary.kanji}`}
    >
      <div
        className="shodo-theater-scroll shodo-theater-scroll--wide"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── STAGE HEADER ────────────────────────────────────────────────── */}
        <div className="shodo-theater-header">
          <div className="shodo-theater-brand">
            <span className="shodo-theater-hanko" title="Ấn triện thư pháp">
              漢
            </span>
            <div>
              <span className="shodo-theater-eyebrow">Thư Pháp Chiết Tự • 書道舞台</span>
              <div className="shodo-theater-title">
                {kanjiSummary.kanji} • {kanjiSummary.hanzi}
              </div>
            </div>
          </div>

          <div className="shodo-theater-actions">
            {/* Hanko Seal SRS Action */}
            <button
              type="button"
              className={`shodo-hanko-seal-btn ${isKanjiSaved ? 'is-stamped' : ''}`}
              onClick={handleSaveKanjiToSrs}
              title={isKanjiSaved ? 'Đã triện ấn lưu vào sổ tay SRS' : 'Triện ấn lưu Hán tự vào sổ tay SRS'}
              aria-label={isKanjiSaved ? 'Đã lưu sổ tay' : 'Lưu sổ tay'}
            >
              <span className="shodo-hanko-seal-box">
                <span className="shodo-hanko-seal-glyph">{isKanjiSaved ? '済' : '印'}</span>
              </span>
              <span className="shodo-hanko-seal-label">{isKanjiSaved ? 'Đã triện' : 'Triện ấn'}</span>
            </button>

            {/* Prev/Next Kanji navigation - Hairline glyphs */}
            {kanjiSummary.prev_kanji && onSelectKanji && (
              <button
                type="button"
                className="shodo-theater-hairline-btn"
                onClick={() => kanjiSummary.prev_kanji && onSelectKanji(kanjiSummary.prev_kanji)}
                title={`Chữ trước: ${kanjiSummary.prev_kanji}`}
                aria-label={`Chữ trước: ${kanjiSummary.prev_kanji}`}
              >
                <ChevronLeft size={19} strokeWidth={1.3} />
              </button>
            )}
            {kanjiSummary.next_kanji && onSelectKanji && (
              <button
                type="button"
                className="shodo-theater-hairline-btn"
                onClick={() => kanjiSummary.next_kanji && onSelectKanji(kanjiSummary.next_kanji)}
                title={`Chữ kế: ${kanjiSummary.next_kanji}`}
                aria-label={`Chữ kế: ${kanjiSummary.next_kanji}`}
              >
                <ChevronRight size={19} strokeWidth={1.3} />
              </button>
            )}

            {/* Close Button - Hairline icon */}
            <button
              type="button"
              className="shodo-theater-hairline-btn shodo-theater-hairline-btn--close"
              onClick={onClose}
              aria-label="Đóng sân khấu thư pháp"
              title="Đóng (Esc)"
            >
              <X size={19} strokeWidth={1.3} />
            </button>
          </div>
        </div>

        {/* ─── STAGE TABS ──────────────────────────────────────────────────── */}
        <div className="shodo-theater-tabs">
          <button
            type="button"
            className={`shodo-theater-tab ${activeTab === 'info' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            <BookOpen size={15} />
            <span>Trình diễn & Chiết tự ({examples.length || kanjiSummary.num_vocab_examples} từ vựng)</span>
          </button>
          <button
            type="button"
            className={`shodo-theater-tab ${activeTab === 'practice' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('practice')}
          >
            <PenTool size={15} />
            <span>Luyện viết nét ({kanjiSummary.stroke_count} nét)</span>
          </button>
        </div>

        {/* ─── STAGE CONTENT ───────────────────────────────────────────────── */}
        <div className="shodo-theater-body">
          {activeTab === 'practice' ? (
            /* Interactive Practice Canvas */
            <div className="shodo-practice-view">
              <h3 className="shodo-practice-title">
                Tập viết chữ: <span className="shodo-practice-char">{kanjiSummary.kanji}</span> ({kanjiSummary.stroke_count} nét)
              </h3>
              <p className="shodo-practice-desc">
                Dùng chuột hoặc ngón tay để vẽ các nét theo chữ mẫu mờ bên dưới
              </p>
              <KanjiCanvas kanjiChar={kanjiSummary.kanji} />
            </div>
          ) : (
            /* ═══════════════════════════════════════════════════════════════
               3-REALM LAYOUT: Thư pháp | Chòm sao | Từ vựng
               ═══════════════════════════════════════════════════════════════ */
            <div className={`kanji-three-realms${!hasAnyGraphData ? ' kanji-three-realms--two-col' : ''}${isPrimitive && hasAnyGraphData ? ' kanji-three-realms--compound-only' : ''}`}>

              {/* ── REALM 1: Thư pháp & Minh họa (Left) ────────────────── */}
              <div className="kanji-realm kanji-realm--visual">

                {/* Toggle: Thư pháp ↔ Minh họa */}
                <div className="kanji-realm-toggle">
                  <button
                    type="button"
                    className={`kanji-realm-toggle-btn ${viewMode === 'calligraphy' ? 'is-active' : ''}`}
                    onClick={() => setViewMode('calligraphy')}
                  >
                    <span>書</span> Thư pháp
                  </button>
                  <button
                    type="button"
                    className={`kanji-realm-toggle-btn ${viewMode === 'illustration' ? 'is-active' : ''}`}
                    onClick={() => setViewMode('illustration')}
                  >
                    <Image size={13} /> Minh họa
                  </button>
                </div>

                {/* Calligraphy view */}
                {viewMode === 'calligraphy' && (
                  <div className="kanji-realm-calligraphy">
                    <KanjiStrokePlayer
                      kanji={kanjiSummary.kanji}
                      fallbackStrokeCount={kanjiSummary.stroke_count}
                    />
                    <div className="shodo-hero-art" style={{ marginTop: '0.5rem' }}>
                      <div className="shodo-hero-hanzi">{kanjiSummary.hanzi}</div>
                      <div className="shodo-hero-meaning">{kanjiSummary.meaning_vi}</div>
                      <div style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono, monospace)', color: '#8A8175', fontWeight: 600, marginTop: '0.2rem' }}>
                        {kanjiSummary.stroke_count} nét • JLPT {kanjiSummary.jlpt_level}
                      </div>
                    </div>
                  </div>
                )}

                {/* Illustration view */}
                {viewMode === 'illustration' && (
                  <div className="kanji-realm-illustration">
                    {!illustrationError ? (
                      <div className="kanji-illus-canvas">
                        <img
                          src={illustrationUrl}
                          alt={`Minh họa ${kanjiSummary.kanji} — ${kanjiSummary.hanzi}`}
                          className="kanji-illus-img"
                          onError={() => setIllustrationError(true)}
                        />
                      </div>
                    ) : (
                      <div className="kanji-illus-zen-fallback">
                        <span className="kanji-illus-zen-glyph">{kanjiSummary.kanji}</span>
                        <span className="kanji-illus-zen-note">Bản họa nét mực đang biên soạn</span>
                      </div>
                    )}
                    {kanjiSummary.story && (
                      <div className="kanji-illus-caption">
                        <span className="kanji-illus-caption-quote">「</span>
                        <span className="kanji-illus-caption-text">{kanjiSummary.story}</span>
                        <span className="kanji-illus-caption-quote">」</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Readings & Radical — always visible below visual */}
                <div className="kanji-realm-readings">
                  <div className="kanji-reading-chip">
                    <span className="kanji-reading-chip-label">On</span>
                    <span className="kanji-reading-chip-val">{kanjiSummary.onyomi || '—'}</span>
                  </div>
                  <div className="kanji-reading-chip">
                    <span className="kanji-reading-chip-label">Kun</span>
                    <span className="kanji-reading-chip-val">{kanjiSummary.kunyomi || '—'}</span>
                  </div>
                  {kanjiSummary.radical_utf && (
                    <div className="kanji-reading-chip kanji-reading-chip--radical">
                      <span className="kanji-reading-chip-label">
                        <Layers size={10} /> Bộ
                      </span>
                      <span className="kanji-reading-chip-val kanji-reading-chip-val--large">
                        {kanjiSummary.radical_utf}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── REALM 2: Phả hệ Chòm sao / Phả hệ nở rộng (Center) ──────────────────── */}
              {hasAnyGraphData && (
              <div className={`kanji-realm kanji-realm--constellation${isDescendantMode ? ' kanji-realm--constellation-descendant' : ''}`}>
                <div className="kanji-realm-label">
                  <span className="kanji-realm-label-jp">{isDescendantMode ? '系譜図' : '星座図'}</span>
                  <span>{isDescendantMode ? 'Phả hệ nở rộng • Chữ phái sinh' : 'Phả hệ Chiết tự • Bộ thủ cấu thành'}</span>
                </div>
                <KanjiConstellationGraph
                  key={kanjiSummary.kanji}
                  kanji={kanjiSummary.kanji}
                  components={allComponents}
                  descendants={descendantNodes}
                  onSelectKanji={handleSelectConstellationKanji}
                />

                {/* Story mnemonic below graph */}
                {kanjiSummary.story && (
                  <div className="kanji-constellation-story-box">
                    <span className="sr-only">Chiết tự & Câu chuyện gợi nhớ</span>
                    <blockquote className="kanji-constellation-story" title="Chiết tự & Câu chuyện gợi nhớ">
                      「 {kanjiSummary.story} 」
                    </blockquote>
                  </div>
                )}
              </div>
              )}

              {/* ── REALM 3: Từ vựng ứng dụng (Right) ──────────────────── */}
              <div className="kanji-realm kanji-realm--vocab">
                <div className="kanji-realm-label">
                  <span className="kanji-realm-label-jp">語彙</span>
                  <span>Từ vựng & Audio ({examples.length || kanjiSummary.num_vocab_examples})</span>
                </div>

                {isLoading ? (
                  <div className="shodo-vocab-loading">Đang tải từ vựng...</div>
                ) : examples.length === 0 ? (
                  <div className="shodo-vocab-empty">Chưa có từ vựng ví dụ.</div>
                ) : (
                  <div className="shodo-vocab-list kanji-realm-vocab-list">
                    {examples.map((item, idx) => {
                      const isSaved = Boolean(savedSrs[`vocab_${item.word}`] || savedSrs[item.word])
                      const isPlaying = playingAudio === item.audio

                      return (
                        <div key={idx} className="shodo-vocab-row">
                          <div className="shodo-vocab-main">
                            <div className="shodo-vocab-word-line">
                              <span className="shodo-vocab-index">0{idx + 1}</span>
                              <span className="shodo-vocab-word">{item.word}</span>
                              {item.reading && item.reading !== item.word && (
                                <span className="shodo-vocab-reading">〔 {item.reading} 〕</span>
                              )}
                              {item.yinHan && (
                                <span className="shodo-vocab-yinhan">{item.yinHan}</span>
                              )}
                            </div>
                            {item.meaning && (
                              <div className="shodo-vocab-meaning">{item.meaning}</div>
                            )}
                            {item.example && (
                              <div className="shodo-vocab-example">
                                <span className="shodo-vocab-ex-jp">{item.example}</span>
                                {item.exampleVi && <span className="shodo-vocab-ex-vi">{item.exampleVi}</span>}
                              </div>
                            )}
                          </div>

                          <div className="shodo-vocab-row-actions">
                            {item.audio && (
                              <button
                                type="button"
                                className={`shodo-audio-play-btn ${isPlaying ? 'is-playing' : ''}`}
                                onClick={() => playAudio(item.audio)}
                                title="Nghe phát âm chuẩn"
                              >
                                <Volume2 size={15} />
                              </button>
                            )}
                            <button
                              type="button"
                              className={`shodo-vocab-save-btn ${isSaved ? 'is-saved' : ''}`}
                              onClick={() => handleSaveToSrs(item.word, item.meaning, item.reading)}
                              title={isSaved ? 'Đã lưu vào SRS' : 'Lưu từ vào sổ tay SRS'}
                            >
                              {isSaved ? <Check size={14} /> : <BookmarkPlus size={14} />}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent
}
export default KanjiDetailModal
