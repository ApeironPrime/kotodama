import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { BookmarkPlus, Check, Clock, Eye, Gamepad2, RotateCcw, Volume2 } from 'lucide-react'
import type { CurriculumWord } from '../srs/srsTypes'
import { sumiAudio } from '../dictionary/sumiAudio'
import { buildClozeSentence, type ClozeSentence, isReadingMatch, romajiToHiragana } from './kanaRomaji'

export type DojoGameMode = 'cloze' | 'karuta' | 'typing'

interface LessonMiniGameProps {
  words: CurriculumWord[]
  activeMode?: DojoGameMode
  isTermSaved: (item: CurriculumWord) => boolean
  onSaveToSrs: (item: CurriculumWord) => Promise<void> | void
  onSpeak: (text: string, audioUrl?: string) => void
}

interface ClozeQuestion {
  target: CurriculumWord
  cloze: ClozeSentence | null
  options: CurriculumWord[]
}

const KARUTA_TURN_MS = 8000
const TYPING_TURN_MS = 10000
const KARUTA_KEYS = ['Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F'] as const
const PERSON_MEANING_RE =
  /người|con trai|con gái|chủ nhân|tác giả|họ hàng|nhân viên|học sinh|giáo viên|bạn bè|tha nhân|trưởng nam/i

function shuffleArray<T>(list: readonly T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = copy[i]
    const swap = copy[j]
    if (temp !== undefined && swap !== undefined) {
      copy[i] = swap
      copy[j] = temp
    }
  }
  return copy
}

function scoreDistractorSimilarity(target: CurriculumWord, candidate: CurriculumWord): number {
  let score = 0
  const targetChars = new Set([...target.word])
  for (const ch of candidate.word) {
    if (/[\u4e00-\u9faf]/.test(ch) && targetChars.has(ch)) {
      score += 6
    }
  }
  if (target.partOfSpeech && candidate.partOfSpeech === target.partOfSpeech) score += 3
  if (target.word.length === candidate.word.length) score += 2
  const targetIsPerson = PERSON_MEANING_RE.test(target.meaning || '')
  const candidateIsPerson = PERSON_MEANING_RE.test(candidate.meaning || '')
  if (targetIsPerson !== candidateIsPerson) score -= 3
  return score
}

function buildClozeQuestions(words: CurriculumWord[]): ClozeQuestion[] {
  if (words.length < 2) return []
  const withCloze: Array<{ word: CurriculumWord; cloze: ClozeSentence | null }> = words.map((w) => ({
    word: w,
    cloze: buildClozeSentence(w.word, w.examples),
  }))

  const clozeReady = shuffleArray(withCloze.filter((item) => item.cloze !== null))
  const fallbackOnly = shuffleArray(withCloze.filter((item) => item.cloze === null))
  const targets = [...clozeReady, ...fallbackOnly].slice(0, Math.min(10, words.length))

  return targets.map(({ word: target, cloze }) => {
    const pool = words.filter((candidate) => candidate.word !== target.word && candidate.meaning !== target.meaning)
    const ranked = shuffleArray(pool).sort(
      (a, b) => scoreDistractorSimilarity(target, b) - scoreDistractorSimilarity(target, a)
    )
    const distractors = ranked.slice(0, 3)
    const options = shuffleArray([target, ...distractors])
    return { target, cloze, options }
  })
}

function buildKarutaArena(words: CurriculumWord[]): { board: CurriculumWord[]; queue: CurriculumWord[] } {
  if (words.length < 2) return { board: [], queue: [] }
  const board = shuffleArray(words).slice(0, Math.min(8, words.length))
  const queue = shuffleArray(board)
  return { board, queue }
}

function buildTypingDeck(words: CurriculumWord[]): CurriculumWord[] {
  if (words.length < 2) return []
  const withReading = words.filter((w) => Boolean((w.reading || w.word).trim()))
  return shuffleArray(withReading).slice(0, Math.min(10, withReading.length))
}

function padTwo(n: number): string {
  return String(Math.max(0, n)).padStart(2, '0')
}

export function LessonMiniGame({ words, activeMode, isTermSaved, onSaveToSrs, onSpeak }: LessonMiniGameProps) {
  const [mode, setMode] = useState<DojoGameMode>(activeMode ?? 'cloze')

  // Cloze State
  const [clozeQuestions, setClozeQuestions] = useState<ClozeQuestion[]>(() => buildClozeQuestions(words))
  const [qIndex, setQIndex] = useState(0)
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [clozeShowHint, setClozeShowHint] = useState(false)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [missedWords, setMissedWords] = useState<CurriculumWord[]>([])
  const [clozeFinished, setClozeFinished] = useState(false)

  // Audio Karuta Arena State
  const [karutaBoard, setKarutaBoard] = useState<CurriculumWord[]>(() => buildKarutaArena(words).board)
  const [karutaQueue, setKarutaQueue] = useState<CurriculumWord[]>(() => buildKarutaArena(words).queue)
  const [karutaTurnIdx, setKarutaTurnIdx] = useState(0)
  const [karutaMatched, setKarutaMatched] = useState<Record<string, boolean>>({})
  const [karutaMismatchWord, setKarutaMismatchWord] = useState<string | null>(null)
  const [karutaMissedRevealWord, setKarutaMissedRevealWord] = useState<string | null>(null)
  const [karutaTimeLeftMs, setKarutaTimeLeftMs] = useState(KARUTA_TURN_MS)
  const [karutaReactionTimes, setKarutaReactionTimes] = useState<number[]>([])
  const [karutaScore, setKarutaScore] = useState(0)
  const [karutaCombo, setKarutaCombo] = useState(0)
  const [karutaBestCombo, setKarutaBestCombo] = useState(0)
  const [karutaCorrectCount, setKarutaCorrectCount] = useState(0)
  const [karutaMissedWords, setKarutaMissedWords] = useState<CurriculumWord[]>([])
  const [karutaLastFeedback, setKarutaLastFeedback] = useState<{ ok: boolean; word: CurriculumWord } | null>(null)
  const [karutaFinished, setKarutaFinished] = useState(false)

  // Typing Recall State
  const [typingDeck, setTypingDeck] = useState<CurriculumWord[]>(() => buildTypingDeck(words))
  const [typingIndex, setTypingIndex] = useState(0)
  const [typingInput, setTypingInput] = useState('')
  const [typingSubmitted, setTypingSubmitted] = useState<'correct' | 'wrong' | 'timeout' | null>(null)
  const [typingShowHint, setTypingShowHint] = useState(false)
  const [typingTimedMode, setTypingTimedMode] = useState(false)
  const [typingTimeLeftMs, setTypingTimeLeftMs] = useState(TYPING_TURN_MS)
  const [typingScore, setTypingScore] = useState(0)
  const [typingCombo, setTypingCombo] = useState(0)
  const [typingBestCombo, setTypingBestCombo] = useState(0)
  const [typingCorrectCount, setTypingCorrectCount] = useState(0)
  const [typingMissedWords, setTypingMissedWords] = useState<CurriculumWord[]>([])
  const [typingFinished, setTypingFinished] = useState(false)

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const turnStartRef = useRef<number>(Date.now())
  const typingInputRef = useRef<HTMLInputElement | null>(null)

  const clearPendingTimers = useCallback(() => {
    for (const id of timersRef.current) {
      clearTimeout(id)
    }
    timersRef.current = []
  }, [])

  useEffect(() => {
    return () => clearPendingTimers()
  }, [clearPendingTimers])

  const speakWord = useCallback(
    (item: CurriculumWord) => {
      onSpeak(item.reading || item.word, item.audioUrl)
    },
    [onSpeak]
  )

  const resetRound = useCallback(
    (nextMode?: DojoGameMode) => {
      clearPendingTimers()
      if (nextMode) setMode(nextMode)

      // Reset Cloze
      setClozeQuestions(buildClozeQuestions(words))
      setQIndex(0)
      setSelectedWord(null)
      setClozeShowHint(false)
      setScore(0)
      setCombo(0)
      setBestCombo(0)
      setCorrectCount(0)
      setMissedWords([])
      setClozeFinished(false)

      // Reset Karuta Arena
      const arena = buildKarutaArena(words)
      setKarutaBoard(arena.board)
      setKarutaQueue(arena.queue)
      setKarutaTurnIdx(0)
      setKarutaMatched({})
      setKarutaMismatchWord(null)
      setKarutaMissedRevealWord(null)
      setKarutaTimeLeftMs(KARUTA_TURN_MS)
      setKarutaReactionTimes([])
      setKarutaScore(0)
      setKarutaCombo(0)
      setKarutaBestCombo(0)
      setKarutaCorrectCount(0)
      setKarutaMissedWords([])
      setKarutaLastFeedback(null)
      setKarutaFinished(false)

      // Reset Typing
      setTypingDeck(buildTypingDeck(words))
      setTypingIndex(0)
      setTypingInput('')
      setTypingSubmitted(null)
      setTypingShowHint(false)
      setTypingTimeLeftMs(TYPING_TURN_MS)
      setTypingScore(0)
      setTypingCombo(0)
      setTypingBestCombo(0)
      setTypingCorrectCount(0)
      setTypingMissedWords([])
      setTypingFinished(false)
      turnStartRef.current = Date.now()
    },
    [clearPendingTimers, words]
  )

  useEffect(() => {
    resetRound(activeMode ?? 'cloze')
  }, [activeMode, resetRound])

  const currentQ = clozeQuestions[qIndex] || null
  const currentKarutaTarget = karutaQueue[karutaTurnIdx] || null
  const currentTypingCard = typingDeck[typingIndex] || null

  // ---------------------------------------------------------------------------
  // MODE 1: CLOZE HANDLERS
  // ---------------------------------------------------------------------------
  const handleSelectOption = useCallback(
    (option: CurriculumWord) => {
      if (!currentQ || selectedWord !== null) return
      setSelectedWord(option.word)
      const isCorrect = option.word === currentQ.target.word
      if (isCorrect) {
        try {
          sumiAudio.playSuikinkutsu()
        } catch {
          // ignore audio error
        }
        const nextCombo = combo + 1
        setCombo(nextCombo)
        setBestCombo((prev) => Math.max(prev, nextCombo))
        setCorrectCount((c) => c + 1)
        setScore((s) => s + 100 + Math.min(nextCombo - 1, 5) * 20)
      } else {
        setCombo(0)
        setMissedWords((prev) =>
          prev.some((w) => w.word === currentQ.target.word) ? prev : [...prev, currentQ.target]
        )
      }
    },
    [currentQ, selectedWord, combo]
  )

  const handleNextQuestion = useCallback(() => {
    if (qIndex + 1 >= clozeQuestions.length) {
      setClozeFinished(true)
    } else {
      setQIndex((i) => i + 1)
      setSelectedWord(null)
      setClozeShowHint(false)
    }
  }, [qIndex, clozeQuestions.length])

  useEffect(() => {
    if (mode !== 'cloze' || clozeFinished || !currentQ) return
    const onKeyDown = (event: KeyboardEvent) => {
      const targetTag = (event.target as HTMLElement | null)?.tagName
      if (targetTag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(targetTag)) return

      if (['1', '2', '3', '4'].includes(event.key)) {
        const idx = Number(event.key) - 1
        const opt = currentQ.options[idx]
        if (opt && selectedWord === null) {
          event.preventDefault()
          handleSelectOption(opt)
        }
      } else if ((event.key === 'Enter' || event.code === 'Space') && selectedWord !== null) {
        event.preventDefault()
        handleNextQuestion()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, clozeFinished, currentQ, selectedWord, handleSelectOption, handleNextQuestion])

  // ---------------------------------------------------------------------------
  // MODE 2: AUDIO KARUTA ARENA
  // ---------------------------------------------------------------------------
  const advanceKarutaTurn = useCallback(() => {
    setKarutaTurnIdx((prev) => {
      if (prev + 1 >= karutaQueue.length) {
        setKarutaFinished(true)
        return prev
      }
      return prev + 1
    })
    setKarutaMissedRevealWord(null)
    setKarutaTimeLeftMs(KARUTA_TURN_MS)
    turnStartRef.current = Date.now()
  }, [karutaQueue.length])

  const handleKarutaCardSlap = useCallback(
    (card: CurriculumWord) => {
      if (!currentKarutaTarget || karutaFinished || karutaMatched[card.word] || karutaMissedRevealWord) return

      if (card.word === currentKarutaTarget.word) {
        try {
          sumiAudio.playHankoStamp()
        } catch {
          // ignore audio error
        }
        const elapsed = Math.max(150, Date.now() - turnStartRef.current)
        const speedBonus = Math.max(0, Math.round((KARUTA_TURN_MS - elapsed) / 100))
        const nextCombo = karutaCombo + 1
        setKarutaMatched((prev) => ({ ...prev, [card.word]: true }))
        setKarutaReactionTimes((prev) => [...prev, elapsed])
        setKarutaCombo(nextCombo)
        setKarutaBestCombo((prev) => Math.max(prev, nextCombo))
        setKarutaCorrectCount((c) => c + 1)
        setKarutaScore((s) => s + 100 + speedBonus + Math.min(nextCombo - 1, 5) * 20)
        setKarutaLastFeedback({ ok: true, word: card })
        setKarutaMissedRevealWord(card.word)
        const tid = setTimeout(() => {
          advanceKarutaTurn()
        }, 600)
        timersRef.current.push(tid)
      } else {
        setKarutaCombo(0)
        setKarutaMismatchWord(card.word)
        setKarutaMissedWords((prev) =>
          prev.some((w) => w.word === currentKarutaTarget.word) ? prev : [...prev, currentKarutaTarget]
        )
        const tid = setTimeout(() => {
          setKarutaMismatchWord(null)
        }, 420)
        timersRef.current.push(tid)
      }
    },
    [advanceKarutaTurn, currentKarutaTarget, karutaCombo, karutaFinished, karutaMatched, karutaMissedRevealWord]
  )

  useEffect(() => {
    if (mode !== 'karuta' || karutaFinished || !currentKarutaTarget) return
    turnStartRef.current = Date.now()
    setKarutaTimeLeftMs(KARUTA_TURN_MS)
    speakWord(currentKarutaTarget)

    const intervalId = setInterval(() => {
      if (karutaMissedRevealWord) return
      const elapsed = Date.now() - turnStartRef.current
      const remaining = Math.max(0, KARUTA_TURN_MS - elapsed)
      setKarutaTimeLeftMs(remaining)
      if (remaining === 0) {
        clearInterval(intervalId)
        setKarutaCombo(0)
        setKarutaMissedRevealWord(currentKarutaTarget.word)
        setKarutaLastFeedback({ ok: false, word: currentKarutaTarget })
        setKarutaMissedWords((prev) =>
          prev.some((w) => w.word === currentKarutaTarget.word) ? prev : [...prev, currentKarutaTarget]
        )
        const tid = setTimeout(() => {
          advanceKarutaTurn()
        }, 900)
        timersRef.current.push(tid)
      }
    }, 100)

    const onKeyDown = (event: KeyboardEvent) => {
      const targetTag = (event.target as HTMLElement | null)?.tagName
      if (targetTag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(targetTag)) return
      if (event.code === 'Space') {
        event.preventDefault()
        speakWord(currentKarutaTarget)
        return
      }
      const keyUpper = event.key.toUpperCase()
      const idx = KARUTA_KEYS.indexOf(keyUpper as (typeof KARUTA_KEYS)[number])
      if (idx !== -1 && karutaBoard[idx]) {
        event.preventDefault()
        handleKarutaCardSlap(karutaBoard[idx])
      }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      clearInterval(intervalId)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [
    mode,
    karutaFinished,
    currentKarutaTarget,
    karutaMissedRevealWord,
    karutaBoard,
    speakWord,
    advanceKarutaTurn,
    handleKarutaCardSlap,
  ])

  // ---------------------------------------------------------------------------
  // MODE 3: TYPING RECALL
  // ---------------------------------------------------------------------------
  const handleTypingFailure = useCallback(
    (card: CurriculumWord, reason: 'wrong' | 'timeout') => {
      setTypingSubmitted(reason)
      setTypingCombo(0)
      setTypingMissedWords((prev) => (prev.some((w) => w.word === card.word) ? prev : [...prev, card]))
      if (!isTermSaved(card)) {
        void onSaveToSrs(card)
      }
    },
    [isTermSaved, onSaveToSrs]
  )

  useEffect(() => {
    if (mode !== 'typing' || typingFinished || !currentTypingCard || typingSubmitted !== null) return
    turnStartRef.current = Date.now()
    setTypingTimeLeftMs(TYPING_TURN_MS)
    typingInputRef.current?.focus()

    if (!typingTimedMode) return undefined

    const intervalId = setInterval(() => {
      const elapsed = Date.now() - turnStartRef.current
      const remaining = Math.max(0, TYPING_TURN_MS - elapsed)
      setTypingTimeLeftMs(remaining)
      if (remaining === 0) {
        clearInterval(intervalId)
        handleTypingFailure(currentTypingCard, 'timeout')
      }
    }, 100)

    return () => clearInterval(intervalId)
  }, [mode, typingFinished, currentTypingCard, typingSubmitted, typingTimedMode, handleTypingFailure])

  const handleNextTypingCard = useCallback(() => {
    if (typingIndex + 1 >= typingDeck.length) {
      setTypingFinished(true)
    } else {
      setTypingIndex((i) => i + 1)
      setTypingInput('')
      setTypingSubmitted(null)
      setTypingShowHint(false)
      setTypingTimeLeftMs(TYPING_TURN_MS)
      turnStartRef.current = Date.now()
    }
  }, [typingIndex, typingDeck.length])

  const handleTypingSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!currentTypingCard) return
    if (typingSubmitted !== null) {
      handleNextTypingCard()
      return
    }
    if (!typingInput.trim()) return

    const ok = isReadingMatch(typingInput, currentTypingCard.reading, currentTypingCard.word)
    if (ok) {
      try {
        sumiAudio.playSuikinkutsu()
      } catch {
        // ignore audio error
      }
      speakWord(currentTypingCard)
      const nextCombo = typingCombo + 1
      setTypingSubmitted('correct')
      setTypingCombo(nextCombo)
      setTypingBestCombo((prev) => Math.max(prev, nextCombo))
      setTypingCorrectCount((c) => c + 1)
      setTypingScore((s) => s + 120 + Math.min(nextCombo - 1, 5) * 25)
    } else {
      handleTypingFailure(currentTypingCard, 'wrong')
    }
  }

  if (words.length < 2) {
    return (
      <div className="dojo-game dojo-empty">
        <Gamepad2 size={32} aria-hidden="true" />
        <h3>Cần ít nhất 2 từ vựng để mở Võ Đường</h3>
        <p>Hãy chọn bài học hoặc xóa bộ lọc tìm kiếm để có đủ từ luyện Điền Từ, Karuta và Gõ Âm Đọc.</p>
      </div>
    )
  }

  const avgReactionSec =
    karutaReactionTimes.length > 0
      ? (karutaReactionTimes.reduce((sum, ms) => sum + ms, 0) / karutaReactionTimes.length / 1000).toFixed(2)
      : '—'
  const liveRomajiPreview = romajiToHiragana(typingInput)

  return (
    <section className="dojo-game" aria-label="Võ Đường Mini-Game Kotodama">
      {/* Minimal Editorial HUD Line (no pills, no redundant mode title) */}
      <header className="dojo-hud">
        <div className="dojo-hud__editorial">
          {mode === 'cloze' && (
            <span>
              Câu <strong>{padTwo(Math.min(qIndex + 1, clozeQuestions.length))}</strong> /{' '}
              {padTwo(clozeQuestions.length)} · Chuỗi đúng <strong>{combo}</strong> · <strong>{score}</strong> điểm
            </span>
          )}
          {mode === 'karuta' && (
            <span>
              Lá <strong>{padTwo(Math.min(karutaTurnIdx + 1, karutaQueue.length))}</strong> /{' '}
              {padTwo(karutaQueue.length)} · Chuỗi đúng <strong>{karutaCombo}</strong> · <strong>{karutaScore}</strong>{' '}
              điểm
            </span>
          )}
          {mode === 'typing' && (
            <span>
              Từ <strong>{padTwo(Math.min(typingIndex + 1, typingDeck.length))}</strong> / {padTwo(typingDeck.length)} ·
              Chuỗi đúng <strong>{typingCombo}</strong> · <strong>{typingScore}</strong> điểm
            </span>
          )}
        </div>

        <div className="dojo-hud__actions">
          {mode === 'cloze' && !clozeFinished && currentQ?.cloze?.vi && selectedWord === null && (
            <button
              type="button"
              className={`dojo-editorial-btn${clozeShowHint ? ' is-active' : ''}`}
              onClick={() => setClozeShowHint((v) => !v)}
              aria-pressed={clozeShowHint}
            >
              <Eye size={13} aria-hidden="true" />
              <span>{clozeShowHint ? 'Ẩn gợi ý nghĩa' : 'Gợi ý nghĩa'}</span>
            </button>
          )}

          {mode === 'karuta' && !karutaFinished && currentKarutaTarget && (
            <button
              type="button"
              className="dojo-editorial-btn"
              onClick={() => speakWord(currentKarutaTarget)}
              aria-label="Nghe lại âm đọc (Phím Space)"
            >
              <Volume2 size={13} aria-hidden="true" />
              <span>Nghe lại [Space]</span>
            </button>
          )}

          {mode === 'typing' && !typingFinished && currentTypingCard && (
            <>
              <button
                type="button"
                className={`dojo-editorial-btn${typingShowHint ? ' is-active' : ''}`}
                onClick={() => setTypingShowHint((v) => !v)}
                aria-pressed={typingShowHint}
              >
                <Eye size={13} aria-hidden="true" />
                <span>{typingShowHint ? 'Ẩn gợi ý nghĩa' : 'Gợi ý nghĩa'}</span>
              </button>
              <button
                type="button"
                className={`dojo-editorial-btn${typingTimedMode ? ' is-active' : ''}`}
                onClick={() => setTypingTimedMode((v) => !v)}
                aria-pressed={typingTimedMode}
                title="Bật hoặc tắt đồng hồ đếm ngược 10 giây"
              >
                <Clock size={13} aria-hidden="true" />
                <span>{typingTimedMode ? 'Đang bật 10s' : 'Áp lực 10s'}</span>
              </button>
            </>
          )}

          <button type="button" className="dojo-editorial-btn" onClick={() => resetRound()} title="Chơi ván mới">
            <RotateCcw size={13} aria-hidden="true" />
            <span>Ván mới</span>
          </button>
        </div>
      </header>

      {/* MODE 1: CONTEXTUAL CLOZE TEST (Direct on Washi) */}
      {mode === 'cloze' && !clozeFinished && currentQ && (
        <div className="dojo-quiz-stage">
          <div className="dojo-quiz-card">
            <div className="dojo-quiz-card__eyebrow">
              <span>{currentQ.cloze ? 'ĐIỀN TỪ VÀO VĂN CẢNH' : 'CHỌN TỪ TIẾNG NHẬT PHÙ HỢP'}</span>
              {selectedWord !== null && (
                <button
                  type="button"
                  className="dojo-editorial-btn"
                  onClick={() => (currentQ.cloze ? onSpeak(currentQ.cloze.fullJa) : speakWord(currentQ.target))}
                  aria-label={`Nghe phát âm ${currentQ.target.word}`}
                >
                  <Volume2 size={14} aria-hidden="true" />
                  <span>Nghe câu</span>
                </button>
              )}
            </div>

            {currentQ.cloze ? (
              <div className="dojo-cloze-prompt">
                <p className="dojo-cloze-sentence" lang="ja">
                  <span>{currentQ.cloze.before}</span>
                  <span className={`dojo-cloze-blank${selectedWord !== null ? ' is-filled' : ''}`}>
                    {selectedWord !== null ? currentQ.cloze.matchedText : '（　　）'}
                  </span>
                  <span>{currentQ.cloze.after}</span>
                </p>
                {(clozeShowHint || selectedWord !== null) && currentQ.cloze.vi && (
                  <p className="dojo-cloze-vi">{currentQ.cloze.vi}</p>
                )}
              </div>
            ) : (
              <div className="dojo-cloze-prompt">
                <p className="dojo-cloze-meaning-prompt">{currentQ.target.meaning}</p>
                <p className="dojo-cloze-vi">
                  {currentQ.target.partOfSpeech || 'Từ vựng'}
                  {currentQ.target.hanViet ? ` · Hán Việt: ${currentQ.target.hanViet}` : ''}
                </p>
              </div>
            )}

            {selectedWord !== null && (
              <div className="dojo-quiz-card__reveal">
                <strong lang="ja">{currentQ.target.word}</strong>
                {currentQ.target.reading && <span lang="ja">【{currentQ.target.reading}】</span>}
                {currentQ.target.hanViet && <strong>{currentQ.target.hanViet}</strong>}
              </div>
            )}
          </div>

          <div className="dojo-options-grid">
            {currentQ.options.map((opt, idx) => {
              const isSelected = selectedWord === opt.word
              const isTarget = opt.word === currentQ.target.word
              let stateClass = ''
              if (selectedWord !== null) {
                if (isTarget) stateClass = ' is-correct'
                else if (isSelected) stateClass = ' is-wrong'
                else stateClass = ' is-dim'
              }
              return (
                <button
                  key={`${opt.word}-${idx}`}
                  type="button"
                  disabled={selectedWord !== null}
                  className={`dojo-option-btn${stateClass}`}
                  onClick={() => handleSelectOption(opt)}
                >
                  <span className="dojo-option-btn__key">{idx + 1}</span>
                  <span className="dojo-option-btn__text dojo-option-btn__text--ja" lang="ja">
                    {opt.word}
                  </span>
                </button>
              )
            })}
          </div>

          {selectedWord !== null && (
            <div className="dojo-feedback-bar" role="status">
              <div className="dojo-feedback-bar__info">
                <strong>
                  {selectedWord === currentQ.target.word
                    ? `✓ Chính xác! ${currentQ.target.word} — ${currentQ.target.meaning}`
                    : `✕ Đáp án đúng: ${currentQ.target.word} (${currentQ.target.meaning})`}
                </strong>
              </div>
              <div className="dojo-feedback-bar__actions">
                <button
                  type="button"
                  className={`dojo-srs-chip${isTermSaved(currentQ.target) ? ' is-saved' : ''}`}
                  onClick={() => void onSaveToSrs(currentQ.target)}
                >
                  {isTermSaved(currentQ.target) ? <Check size={14} /> : <BookmarkPlus size={14} />}
                  <span>{isTermSaved(currentQ.target) ? 'Đã lưu SRS' : '+ Lưu SRS'}</span>
                </button>
                <button type="button" className="dojo-next-btn" onClick={handleNextQuestion}>
                  {qIndex + 1 >= clozeQuestions.length ? 'Xem tổng kết →' : 'Câu tiếp theo →'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE 1 SUMMARY */}
      {mode === 'cloze' && clozeFinished && (
        <div className="dojo-summary">
          <div className="dojo-summary__seal" aria-hidden="true">
            文
          </div>
          <h3>Hoàn thành Điền Từ Văn Cảnh</h3>
          <p className="dojo-summary__subtitle">
            Đúng{' '}
            <strong>
              {correctCount} / {clozeQuestions.length}
            </strong>{' '}
            câu ({Math.round((correctCount / Math.max(1, clozeQuestions.length)) * 100)}%) · Điểm{' '}
            <strong>{score}</strong> · Combo cao nhất <strong>x{bestCombo}</strong>
          </p>

          {missedWords.length > 0 && (
            <div className="dojo-summary__missed">
              <h4>Từ cần ôn lại ({missedWords.length})</h4>
              <div className="dojo-summary__missed-list">
                {missedWords.map((item) => (
                  <div key={item.word} className="dojo-summary__missed-row">
                    <div>
                      <strong lang="ja">{item.word}</strong>
                      {item.reading && <span lang="ja"> 【{item.reading}】</span>}
                      <p>{item.meaning}</p>
                    </div>
                    <button
                      type="button"
                      className={`dojo-srs-chip${isTermSaved(item) ? ' is-saved' : ''}`}
                      onClick={() => void onSaveToSrs(item)}
                    >
                      {isTermSaved(item) ? <Check size={14} /> : <BookmarkPlus size={14} />}
                      <span>{isTermSaved(item) ? 'Đã lưu' : '+ Lưu SRS'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button type="button" className="dojo-next-btn" onClick={() => resetRound('cloze')}>
            <RotateCcw size={15} aria-hidden="true" />
            <span>Chơi ván mới</span>
          </button>
        </div>
      )}

      {/* MODE 2: AUTHENTIC VERTICAL UTA-GARUTA ARENA */}
      {mode === 'karuta' && !karutaFinished && currentKarutaTarget && (
        <div className="dojo-karuta-arena">
          <div className="dojo-karuta-caller">
            <div className="dojo-timer-bar" aria-label={`Thời gian còn lại ${Math.ceil(karutaTimeLeftMs / 1000)} giây`}>
              <div
                className="dojo-timer-bar__fill"
                style={{ width: `${Math.round((karutaTimeLeftMs / KARUTA_TURN_MS) * 100)}%` }}
              />
            </div>
            <div className="dojo-karuta-caller__meta">
              <span className="dojo-karuta-caller__eyebrow">
                NGHE ÂM ĐỌC · ĐẬP THẺ BÀI ({KARUTA_KEYS.slice(0, karutaBoard.length).join(' · ')})
              </span>
              {karutaLastFeedback && (
                <div className={`dojo-karuta-status${karutaLastFeedback.ok ? ' is-ok' : ' is-miss'}`} role="status">
                  {karutaLastFeedback.ok ? '✓ Chuẩn: ' : '✕ Hết giờ: '}
                  <strong lang="ja">{karutaLastFeedback.word.word}</strong>
                  {karutaLastFeedback.word.reading && (
                    <span lang="ja"> 【{karutaLastFeedback.word.reading}】</span>
                  )} — {karutaLastFeedback.word.meaning}
                </div>
              )}
            </div>
          </div>

          <div className="dojo-karuta-grid dojo-karuta-grid--fuda" role="group" aria-label="Sân đấu Karuta thính giác">
            {karutaBoard.map((card, idx) => {
              const isMatched = Boolean(karutaMatched[card.word])
              const isMismatch = karutaMismatchWord === card.word
              const isMissedReveal = karutaMissedRevealWord === card.word && !isMatched
              const shortcutKey = KARUTA_KEYS[idx]
              return (
                <button
                  key={card.word}
                  type="button"
                  disabled={isMatched}
                  className={`dojo-karuta-card dojo-karuta-card--fuda${isMatched ? ' is-matched' : ''}${
                    isMismatch ? ' is-mismatch' : ''
                  }${isMissedReveal ? ' is-missed-reveal' : ''}`}
                  onClick={() => handleKarutaCardSlap(card)}
                  aria-label={`${card.word}${shortcutKey ? ` (Phím ${shortcutKey})` : ''}`}
                >
                  {isMatched && (
                    <span className="dojo-karuta-card__seal" aria-hidden="true">
                      取
                    </span>
                  )}
                  <span className="dojo-karuta-card__primary" lang="ja">
                    {card.word}
                  </span>
                  {shortcutKey && (
                    <span className="dojo-karuta-card__key" aria-hidden="true">
                      {shortcutKey}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {mode === 'karuta' && karutaFinished && (
        <div className="dojo-summary">
          <div className="dojo-summary__seal" aria-hidden="true">
            取
          </div>
          <h3>Hoàn tất Đấu Trường Karuta!</h3>
          <p className="dojo-summary__subtitle">
            Đập chuẩn{' '}
            <strong>
              {karutaCorrectCount} / {karutaQueue.length}
            </strong>{' '}
            lá · Tốc độ trung bình <strong>{avgReactionSec}s</strong> · Điểm <strong>{karutaScore}</strong> · Combo cao
            nhất <strong>x{karutaBestCombo}</strong>
          </p>

          {karutaMissedWords.length > 0 && (
            <div className="dojo-summary__missed">
              <h4>Từ đập trượt / hết giờ ({karutaMissedWords.length})</h4>
              <div className="dojo-summary__missed-list">
                {karutaMissedWords.map((item) => (
                  <div key={item.word} className="dojo-summary__missed-row">
                    <div>
                      <strong lang="ja">{item.word}</strong>
                      {item.reading && <span lang="ja"> 【{item.reading}】</span>}
                      <p>{item.meaning}</p>
                    </div>
                    <button
                      type="button"
                      className={`dojo-srs-chip${isTermSaved(item) ? ' is-saved' : ''}`}
                      onClick={() => void onSaveToSrs(item)}
                    >
                      {isTermSaved(item) ? <Check size={14} /> : <BookmarkPlus size={14} />}
                      <span>{isTermSaved(item) ? 'Đã lưu' : '+ Lưu SRS'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button type="button" className="dojo-next-btn" onClick={() => resetRound('karuta')}>
            <RotateCcw size={15} aria-hidden="true" />
            <span>Xáo bài đấu lại</span>
          </button>
        </div>
      )}

      {/* MODE 3: CALM HAIRLINE TYPING RECALL */}
      {mode === 'typing' && !typingFinished && currentTypingCard && (
        <div className="dojo-typing-stage">
          {typingTimedMode && (
            <div className="dojo-timer-bar" aria-label={`Thời gian còn lại ${Math.ceil(typingTimeLeftMs / 1000)} giây`}>
              <div
                className="dojo-timer-bar__fill"
                style={{ width: `${Math.round((typingTimeLeftMs / TYPING_TURN_MS) * 100)}%` }}
              />
            </div>
          )}

          <div className="dojo-quiz-card">
            <div className="dojo-quiz-card__eyebrow dojo-quiz-card__eyebrow--center">
              <span>GÕ ÂM ĐỌC HIRAGANA / ROMAJI</span>
            </div>

            <div className="dojo-quiz-card__prompt" lang="ja">
              <span>{currentTypingCard.word}</span>
            </div>

            {(typingShowHint || typingSubmitted !== null) && (
              <div className="dojo-quiz-card__reveal">
                {typingSubmitted !== null && currentTypingCard.reading && (
                  <span lang="ja">【{currentTypingCard.reading}】</span>
                )}
                {currentTypingCard.hanViet && <strong>{currentTypingCard.hanViet}</strong>}
                <span>{currentTypingCard.meaning}</span>
              </div>
            )}
          </div>

          <form className="dojo-typing-form" onSubmit={handleTypingSubmit}>
            <input
              ref={typingInputRef}
              type="text"
              className={`dojo-typing-input${
                typingSubmitted === 'correct'
                  ? ' is-correct'
                  : typingSubmitted === 'wrong' || typingSubmitted === 'timeout'
                    ? ' is-wrong'
                    : ''
              }`}
              value={typingInput}
              onChange={(e) => setTypingInput(e.target.value)}
              disabled={typingSubmitted !== null}
              aria-label="Nhập cách đọc Hiragana hoặc Romaji"
              placeholder="Gõ Romaji (vd: jinsei) hoặc Hiragana..."
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />

            <div className="dojo-typing-meta-row">
              <span className="dojo-typing-preview">
                Chuyển Kana: <strong lang="ja">{liveRomajiPreview || '—'}</strong>
              </span>

              <div className="dojo-typing-actions">
                {typingSubmitted === null ? (
                  <>
                    <button
                      type="button"
                      className="dojo-editorial-btn"
                      onClick={() => handleTypingFailure(currentTypingCard, 'wrong')}
                    >
                      Chưa nhớ · Xem đáp án
                    </button>
                    <button type="submit" className="dojo-typing-submit-btn">
                      Kiểm tra (Enter)
                    </button>
                  </>
                ) : (
                  <button type="button" className="dojo-next-btn" onClick={handleNextTypingCard}>
                    {typingIndex + 1 >= typingDeck.length ? 'Xem tổng kết →' : 'Từ tiếp theo →'}
                  </button>
                )}
              </div>
            </div>
          </form>

          {typingSubmitted !== null && (
            <div className="dojo-feedback-bar" role="status">
              <div className="dojo-feedback-bar__info">
                <strong>
                  {typingSubmitted === 'correct'
                    ? `✓ Chính xác! ${currentTypingCard.word} 【${currentTypingCard.reading || currentTypingCard.word}】`
                    : typingSubmitted === 'timeout'
                      ? `⏱ Hết giờ! Đáp án: ${currentTypingCard.reading || currentTypingCard.word}`
                      : `✕ Chưa khớp! Đáp án: ${currentTypingCard.reading || currentTypingCard.word}`}
                </strong>
                {typingSubmitted !== 'correct' && (
                  <p className="dojo-typing-srs-note">Đã tự động đưa từ này vào hàng chờ SRS để ôn lại.</p>
                )}
              </div>
              <div className="dojo-feedback-bar__actions">
                <button type="button" className="dojo-editorial-btn" onClick={() => speakWord(currentTypingCard)}>
                  <Volume2 size={14} aria-hidden="true" />
                  <span>Nghe âm</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'typing' && typingFinished && (
        <div className="dojo-summary">
          <div className="dojo-summary__seal" aria-hidden="true">
            筆
          </div>
          <h3>Hoàn thành Gõ Âm Đọc!</h3>
          <p className="dojo-summary__subtitle">
            Nhớ chuẩn âm đọc{' '}
            <strong>
              {typingCorrectCount} / {typingDeck.length}
            </strong>{' '}
            từ ({Math.round((typingCorrectCount / Math.max(1, typingDeck.length)) * 100)}%) · Điểm{' '}
            <strong>{typingScore}</strong> · Combo cao nhất <strong>x{typingBestCombo}</strong>
          </p>

          {typingMissedWords.length > 0 && (
            <div className="dojo-summary__missed">
              <h4>Từ đã đẩy vào hàng chờ SRS ({typingMissedWords.length})</h4>
              <div className="dojo-summary__missed-list">
                {typingMissedWords.map((item) => (
                  <div key={item.word} className="dojo-summary__missed-row">
                    <div>
                      <strong lang="ja">{item.word}</strong>
                      {item.reading && <span lang="ja"> 【{item.reading}】</span>}
                      <p>{item.meaning}</p>
                    </div>
                    <span className="dojo-srs-chip is-saved">
                      <Check size={14} />
                      <span>Đã vào SRS</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button type="button" className="dojo-next-btn" onClick={() => resetRound('typing')}>
            <RotateCcw size={15} aria-hidden="true" />
            <span>Luyện ván mới</span>
          </button>
        </div>
      )}
    </section>
  )
}
