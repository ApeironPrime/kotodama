import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, BookmarkCheck, BookmarkPlus, Clock, Languages, Search, Trash2, Volume2, X } from 'lucide-react'
import {
  apiPaths,
  requestApi,
  type DictionarySearchResult,
  type DictionarySentenceAnalysis,
  type DictionaryWordItem,
} from '../../lib/apiClient'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { useDialogAccessibility } from '../../lib/useDialogAccessibility'
import { nhaikanjiApi } from '../nhaikanji/nhaikanjiApi'
import { srsApi } from '../srs/srsApi'
import { useAuth } from '../auth/authContext'

const RECENT_STORAGE_KEY = 'kotodama_dictionary_recent_searches'
const QUICK_SUGGESTIONS = ['学校', '先生', '約束', '食べる', '木漏れ日'] as const

function readRecentSearches(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : []
  } catch {
    return []
  }
}

function writeRecentSearches(items: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(items.slice(0, 8)))
  } catch {
    // ignore storage errors
  }
}

function isSentenceQuery(value: string) {
  const trimmed = value.trim()
  return (
    trimmed.length > 10 &&
    (/[。！？!?、\s]/.test(trimmed) || (/[ぁ-ん]{2,}/.test(trimmed) && /[\u4e00-\u9faf]/.test(trimmed)))
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

export function DictionaryOverlay({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query.trim(), 220)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => readRecentSearches())
  const [savedWordMap, setSavedWordMap] = useState<Record<string, boolean>>({})

  useDialogAccessibility(panelRef, onClose, isOpen)

  useEffect(() => {
    if (!isOpen) return
    setRecentSearches(readRecentSearches())
    const timer = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 30)
    return () => window.clearTimeout(timer)
  }, [isOpen])

  const recordSearch = useCallback((term: string) => {
    const clean = term.trim()
    if (!clean) return
    setRecentSearches((prev) => {
      const next = [clean, ...prev.filter((item) => item !== clean)].slice(0, 8)
      writeRecentSearches(next)
      return next
    })
  }, [])

  const clearRecentSearches = () => {
    setRecentSearches([])
    writeRecentSearches([])
  }

  const sentenceMode = Boolean(debouncedQuery && isSentenceQuery(debouncedQuery))

  const { data: searchData, isFetching: isSearchingWords } = useQuery({
    queryKey: ['dict-overlay', 'words', debouncedQuery, sentenceMode],
    queryFn: async (): Promise<{ results: DictionaryWordItem[]; translation?: string | null }> => {
      if (sentenceMode) {
        const res = await requestApi<DictionarySentenceAnalysis>({
          method: 'GET',
          url: apiPaths.dictionary.analyze(debouncedQuery, true),
        })
        return { results: res.results ?? [], translation: res.translation ?? null }
      }
      const res = await requestApi<DictionarySearchResult>({
        method: 'GET',
        url: apiPaths.dictionary.search(debouncedQuery, 10),
      })
      return { results: res.results ?? [], translation: null }
    },
    enabled: isOpen && debouncedQuery.length > 0,
    staleTime: 30_000,
  })

  const { data: kanjiData } = useQuery({
    queryKey: ['dict-overlay', 'kanji', debouncedQuery],
    queryFn: () => nhaikanjiApi.fetchKanjiList({ level: 'ALL', query: debouncedQuery, page: 1, limit: 4 }),
    enabled: isOpen && debouncedQuery.length > 0,
    staleTime: 60_000,
  })

  const openDeepDictionary = (targetQuery?: string) => {
    const q = (targetQuery ?? query).trim()
    if (q) recordSearch(q)
    onClose()
    navigate(q ? `/dictionary?q=${encodeURIComponent(q)}` : '/dictionary')
  }

  const openKanjiLookup = (kanjiChar?: string) => {
    onClose()
    navigate(kanjiChar ? `/tra-tu?tab=kanji&kanji=${encodeURIComponent(kanjiChar)}` : '/tra-tu?tab=kanji')
  }

  const handleSaveToSrs = async (word: DictionaryWordItem) => {
    const key = `${word.word}:${word.reading ?? ''}`
    if (savedWordMap[key]) return
    if (!user) {
      openDeepDictionary(word.word)
      return
    }
    setSavedWordMap((prev) => ({ ...prev, [key]: true }))
    try {
      await srsApi.addCard({
        type: 'vocab',
        term: word.word,
        reading: word.reading ?? undefined,
        hanViet: word.hanViet ?? undefined,
        meaning: word.meanings[0] || word.rawMeaning || '',
        jlptLevel: word.jlpt || 'N5',
      })
      await queryClient.invalidateQueries({ queryKey: ['srs'] })
    } catch {
      setSavedWordMap((prev) => ({ ...prev, [key]: false }))
    }
  }

  if (!isOpen || typeof document === 'undefined') return null

  const trimmedQuery = query.trim()
  const wordResults = searchData?.results ?? []
  const kanjiResults = kanjiData?.items ?? []

  return createPortal(
    <div
      className="dict-overlay-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className="dict-overlay-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Từ điển tra nhanh"
        tabIndex={-1}
      >
        <header className="dict-overlay-header">
          <div className="dict-overlay-title-row">
            <div className="dict-overlay-brand">
              <span className="dict-overlay-hanko" aria-hidden="true">
                辞
              </span>
              <div>
                <h2 className="dict-overlay-title">Từ điển tra nhanh</h2>
                <span className="dict-overlay-subtitle">辞書検索 · Giữ nguyên màn hình đang học</span>
              </div>
            </div>
            <button
              type="button"
              className="dict-overlay-close"
              onClick={onClose}
              aria-label="Đóng khung tra từ điển"
              title="Đóng (Esc)"
            >
              <X size={18} />
            </button>
          </div>

          <form
            className="dict-overlay-searchbar"
            onSubmit={(event) => {
              event.preventDefault()
              if (trimmedQuery) recordSearch(trimmedQuery)
            }}
          >
            <Search size={16} className="dict-overlay-searchbar__icon" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nhập từ vựng, Hán tự, Kana, Romaji hoặc câu..."
              aria-label="Tra từ điển nhanh"
            />
            {query && (
              <button
                type="button"
                className="dict-overlay-clear"
                onClick={() => {
                  setQuery('')
                  inputRef.current?.focus()
                }}
                aria-label="Xóa từ khóa"
              >
                <X size={14} />
              </button>
            )}
          </form>
        </header>

        <div className="dict-overlay-body">
          {!trimmedQuery ? (
            <div className="dict-overlay-empty">
              <section className="dict-overlay-section">
                <div className="dict-overlay-section__head">
                  <h3>
                    <Clock size={14} aria-hidden="true" />
                    <span>Lịch sử tra gần đây</span>
                  </h3>
                  {recentSearches.length > 0 && (
                    <button type="button" className="dict-overlay-text-btn" onClick={clearRecentSearches}>
                      <Trash2 size={12} aria-hidden="true" />
                      <span>Xóa lịch sử</span>
                    </button>
                  )}
                </div>

                {recentSearches.length > 0 ? (
                  <div className="dict-overlay-chips">
                    {recentSearches.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="dict-overlay-chip"
                        onClick={() => {
                          setQuery(item)
                          recordSearch(item)
                        }}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="dict-overlay-muted">Chưa có lịch sử tra cứu gần đây. Thử nhanh một từ mẫu bên dưới:</p>
                )}

                {recentSearches.length === 0 && (
                  <div className="dict-overlay-chips" style={{ marginTop: '0.5rem' }}>
                    {QUICK_SUGGESTIONS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="dict-overlay-chip"
                        onClick={() => {
                          setQuery(item)
                          recordSearch(item)
                        }}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="dict-overlay-section">
                <div className="dict-overlay-section__head">
                  <h3>
                    <Languages size={14} aria-hidden="true" />
                    <span>Lối tắt tra cứu</span>
                  </h3>
                </div>

                <div className="dict-overlay-shortcuts">
                  <button type="button" className="dict-overlay-shortcut-btn" onClick={() => openKanjiLookup()}>
                    <div>
                      <strong>Tra kho Hán tự &amp; Vẽ chữ</strong>
                      <span>Tìm theo bộ thủ, Hán-Việt hoặc vẽ nét trực tiếp</span>
                    </div>
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </button>

                  <button type="button" className="dict-overlay-shortcut-btn" onClick={() => openDeepDictionary('')}>
                    <div>
                      <strong>Mở trang Từ điển chuyên sâu</strong>
                      <span>Phân tích câu, chiết tự chi tiết &amp; từ của ngày</span>
                    </div>
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </section>
            </div>
          ) : (
            <div className="dict-overlay-results">
              <div className="dict-overlay-deep-bar">
                <span className="dict-overlay-deep-bar__hint">
                  {isSearchingWords ? 'Đang tra cứu…' : `${wordResults.length} kết quả khớp`}
                </span>
                <button
                  type="button"
                  className="dict-overlay-deep-cta"
                  onClick={() => openDeepDictionary(trimmedQuery)}
                >
                  <span>Mở trang chi tiết</span>
                  <ArrowUpRight size={14} aria-hidden="true" />
                </button>
              </div>

              {searchData?.translation && (
                <div className="dict-overlay-sentence-box">
                  <span className="dict-overlay-sentence-box__label">Nghĩa câu tham khảo</span>
                  <p>{searchData.translation}</p>
                </div>
              )}

              {kanjiResults.length > 0 && (
                <div className="dict-overlay-kanji-strip">
                  {kanjiResults.map((k, idx) => (
                    <button
                      key={k.kanji}
                      type="button"
                      className="dict-overlay-kanji-card"
                      style={{ '--stagger-i': idx } as CSSProperties}
                      onClick={() => openKanjiLookup(k.kanji)}
                    >
                      <span className="dict-overlay-kanji-card__char">{k.kanji}</span>
                      <span className="dict-overlay-kanji-card__meta">
                        <strong>{k.hanzi || k.kanji}</strong>
                        <small>{k.meaning_vi}</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {wordResults.length > 0 ? (
                <ul className="dict-overlay-list">
                  {wordResults.map((word, idx) => {
                    const meaningText = word.meanings[0] || word.rawMeaning || 'Chưa có nghĩa tiếng Việt'
                    const saveKey = `${word.word}:${word.reading ?? ''}`
                    const isSaved = Boolean(savedWordMap[saveKey])
                    return (
                      <li
                        key={`${word.word}-${word.reading ?? idx}`}
                        className="dict-overlay-item"
                        style={{ '--stagger-i': idx } as CSSProperties}
                      >
                        <div className="dict-overlay-item__top">
                          <div className="dict-overlay-item__headword">
                            <button
                              type="button"
                              className="dict-overlay-item__word-btn"
                              onClick={() => openDeepDictionary(word.word)}
                            >
                              {word.word}
                            </button>
                            {word.reading && <span className="dict-overlay-item__reading">[{word.reading}]</span>}
                            {word.hanViet && <span className="dict-overlay-item__hv">{word.hanViet}</span>}
                            {word.jlpt && <span className="dict-overlay-item__jlpt">{word.jlpt}</span>}
                          </div>

                          <div className="dict-overlay-item__actions">
                            <button
                              type="button"
                              className="dict-overlay-icon-btn"
                              onClick={() => speakJapanese(word.reading || word.word)}
                              aria-label={`Nghe phát âm ${word.word}`}
                              title="Nghe phát âm"
                            >
                              <Volume2 size={15} />
                            </button>
                            <button
                              type="button"
                              className={`dict-overlay-icon-btn${isSaved ? ' is-saved' : ''}`}
                              onClick={() => void handleSaveToSrs(word)}
                              aria-label={isSaved ? 'Đã lưu vào SRS' : `Lưu ${word.word} vào SRS`}
                              title={user ? 'Lưu vào SRS' : 'Mở trang chi tiết để lưu SRS'}
                            >
                              {isSaved ? <BookmarkCheck size={15} /> : <BookmarkPlus size={15} />}
                            </button>
                          </div>
                        </div>
                        <p className="dict-overlay-item__meaning">{meaningText}</p>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                !isSearchingWords &&
                kanjiResults.length === 0 && (
                  <div className="dict-overlay-no-match">
                    <p>Không tìm thấy kết quả nhanh cho “{trimmedQuery}”.</p>
                    <button
                      type="button"
                      className="dict-overlay-deep-cta"
                      onClick={() => openDeepDictionary(trimmedQuery)}
                    >
                      <span>Thử tra trên trang chi tiết</span>
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <footer className="dict-overlay-footer">
          <span>Phím tắt: Ctrl+K đóng/mở · Esc thoát</span>
          <button type="button" className="dict-overlay-text-btn" onClick={() => openDeepDictionary()}>
            <span>Mở /dictionary</span>
            <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
