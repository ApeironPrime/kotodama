import { type CSSProperties, type FormEvent, useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
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
  onMissedWord: (item: CurriculumWord) => void
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
const GENERIC_IDENTITY_QUESTION = /^[「『]?あの\s*(.+?)\s*は\s*(?:だれ|誰)ですか[。？?」』]*$/u
const CLOZE_ALTERNATIVES = [
  ['先輩', '後輩', '同僚', '上司', '部下'],
  ['男性', '女性', '男', '女'],
  ['賛成', '反対'],
  ['友人', '友達', '知り合い', '知人'],
  ['故郷', 'ふるさと', '出身地'],
  ['合格', '不合格'],
]
const PERSON_MEANING_RE =
  /người|con trai|con gái|cha|mẹ|anh|em|chị|chủ nhân|tác giả|họ hàng|nhân viên|học sinh|giáo viên|bạn bè|tha nhân|trưởng nam|sinh đôi|trẻ lạc/i

const SEMANTIC_BUCKETS: ReadonlyArray<readonly [string, RegExp]> = [
  ['family_person', PERSON_MEANING_RE],
  ['ability_quality', /năng lực|tài năng|tính cách|cá tính|ưu điểm|khuyết điểm|tinh thần|cảm giác|khả năng|trình độ/i],
  ['life_time', /cuộc đời|tuổi thọ|tuổi trẻ|tương lai|quá khứ|thế hệ|khoảnh khắc|thời gian|năm|tuổi|già|mạng sống/i],
  ['work_society', /công việc|xã hội|kinh tế|nghề|công ty|pháp luật|trách nhiệm|dư luận|văn hóa|tổ chức/i],
  ['place_space', /địa điểm|nơi|vị trí|quê|khu vực|phương hướng|không gian|chỗ|cảnh/i],
]

function getSemanticTags(word: CurriculumWord): Set<string> {
  const tags = new Set<string>()
  const text = `${word.meaning || ''} ${word.partOfSpeech || ''}`
  for (const [tag, regex] of SEMANTIC_BUCKETS) {
    if (regex.test(text)) tags.add(tag)
  }
  return tags
}

function getHanVietSyllables(hanViet?: string): Set<string> {
  if (!hanViet) return new Set()
  return new Set(
    hanViet
      .toUpperCase()
      .split(/[\s,;/]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
  )
}

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
  const targetHv = getHanVietSyllables(target.hanViet)
  const candHv = getHanVietSyllables(candidate.hanViet)
  for (const syl of candHv) {
    if (targetHv.has(syl)) score += 5
  }

  const targetTags = getSemanticTags(target)
  const candTags = getSemanticTags(candidate)
  let sharedSemantic = 0
  for (const tag of candTags) {
    if (targetTags.has(tag)) sharedSemantic += 1
  }
  if (sharedSemantic > 0) {
    score += sharedSemantic * 5
  } else if (targetTags.size > 0 && candTags.size > 0) {
    score -= 4
  }

  if (target.partOfSpeech && candidate.partOfSpeech === target.partOfSpeech) score += 3
  if (target.word.length === candidate.word.length) score += 2
  const targetIsPerson = PERSON_MEANING_RE.test(target.meaning || '')
  const candidateIsPerson = PERSON_MEANING_RE.test(candidate.meaning || '')
  if (targetIsPerson !== candidateIsPerson) score -= 4
  return score
}

function buildClozeQuestions(words: CurriculumWord[]): ClozeQuestion[] {
  if (words.length < 2) return []
  const withCloze: Array<{ word: CurriculumWord; cloze: ClozeSentence | null }> = words.map((w) => ({
    word: w,
    cloze: buildClozeSentence(
      w.word,
      w.examples?.filter(({ jp }) => GENERIC_IDENTITY_QUESTION.exec(jp.trim())?.[1] !== w.word)
    ),
  }))

  const clozeReady = shuffleArray(withCloze.filter((item) => item.cloze !== null))
  const fallbackOnly = shuffleArray(withCloze.filter((item) => item.cloze === null))
  const targets = [...clozeReady, ...fallbackOnly].slice(0, Math.min(10, words.length))

  return targets.flatMap(({ word: target, cloze }) => {
    const pool = words.filter((candidate) => candidate.word !== target.word && candidate.meaning !== target.meaning)
    const alternatives = CLOZE_ALTERNATIVES.filter((group) => group.includes(target.word))
    const contextualPool = pool.filter((candidate) => !alternatives.some((group) => group.includes(candidate.word)))
    const useContext = cloze !== null && contextualPool.length > 0
    const ranked = shuffleArray(useContext ? contextualPool : pool).sort(
      (a, b) => scoreDistractorSimilarity(target, b) - scoreDistractorSimilarity(target, a)
    )
    const distractors = [...new Map(ranked.map((word) => [word.word, word])).values()].slice(0, 3)
    if (distractors.length === 0) return []
    const options = shuffleArray([target, ...distractors])
    return [{ target, cloze: useContext ? cloze : null, options }]
  })
}

function buildKarutaArena(words: CurriculumWord[]): { board: CurriculumWord[]; queue: CurriculumWord[] } {
  const readings = new Set<string>()
  const spellings = new Set<string>()
  const board = shuffleArray(words)
    .filter((word) => {
      const reading = word.reading || word.word
      if (readings.has(reading) || spellings.has(word.word)) return false
      readings.add(reading)
      spellings.add(word.word)
      return true
    })
    .slice(0, KARUTA_KEYS.length)
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

export function LessonMiniGame({
  words,
  activeMode,
  isTermSaved,
  onSaveToSrs,
  onMissedWord,
  onSpeak,
}: LessonMiniGameProps) {
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
  const [{ board: karutaBoard, queue: karutaQueue }, setKarutaArena] = useState(() => buildKarutaArena(words))
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
  const roundInputsRef = useRef({ words, activeMode })
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
      setKarutaArena(buildKarutaArena(words))
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
    if (roundInputsRef.current.words === words && roundInputsRef.current.activeMode === activeMode) return
    roundInputsRef.current = { words, activeMode }
    resetRound(activeMode ?? 'cloze')
  }, [activeMode, resetRound, words])

  const currentQ = clozeQuestions[qIndex] || null
  const currentKarutaTarget = karutaQueue[karutaTurnIdx] || null
  const currentTypingCard = typingDeck[typingIndex] || null

  const srsButton = (item: CurriculumWord, savedLabel = 'Đã lưu SRS') => {
    const saved = isTermSaved(item)
    return (
      <button
        type="button"
        className={`dojo-srs-chip${saved ? ' is-saved' : ''}`}
        disabled={saved}
        onClick={() => void onSaveToSrs(item)}
      >
        {saved ? <Check size={14} /> : <BookmarkPlus size={14} />}
        <span>{saved ? savedLabel : 'Lưu vào SRS'}</span>
      </button>
    )
  }

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
        onMissedWord(currentQ.target)
        setMissedWords((prev) =>
          prev.some((w) => w.word === currentQ.target.word) ? prev : [...prev, currentQ.target]
        )
      }
    },
    [currentQ, selectedWord, combo, onMissedWord]
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
        if (event.target instanceof Element && event.target.closest('.dojo-game button:not(:disabled)')) return
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
    setKarutaMismatchWord(null)
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
        if (karutaMismatchWord) return
        setKarutaCombo(0)
        setKarutaMismatchWord(card.word)
        setKarutaLastFeedback(null)
        onMissedWord(currentKarutaTarget)
        setKarutaMissedWords((prev) =>
          prev.some((w) => w.word === currentKarutaTarget.word) ? prev : [...prev, currentKarutaTarget]
        )
        const tid = setTimeout(() => {
          setKarutaMismatchWord(null)
        }, 420)
        timersRef.current.push(tid)
      }
    },
    [
      advanceKarutaTurn,
      currentKarutaTarget,
      karutaCombo,
      karutaFinished,
      karutaMatched,
      karutaMismatchWord,
      karutaMissedRevealWord,
      onMissedWord,
    ]
  )

  const playKarutaPrompt = useEffectEvent(speakWord)
  const recordKarutaTimeout = useEffectEvent((word: CurriculumWord) => {
    onMissedWord(word)
    setKarutaCombo(0)
    setKarutaMissedRevealWord(word.word)
    setKarutaLastFeedback({ ok: false, word })
    setKarutaMissedWords((prev) => (prev.some((item) => item.word === word.word) ? prev : [...prev, word]))
    timersRef.current.push(setTimeout(advanceKarutaTurn, 900))
  })

  useEffect(() => {
    if (mode !== 'karuta' || karutaFinished || !currentKarutaTarget || karutaQueue.length < 2) return
    turnStartRef.current = Date.now()
    setKarutaTimeLeftMs(KARUTA_TURN_MS)
    playKarutaPrompt(currentKarutaTarget)
  }, [mode, karutaFinished, currentKarutaTarget, karutaQueue])

  useEffect(() => {
    if (mode !== 'karuta' || karutaFinished || !currentKarutaTarget || karutaQueue.length < 2 || karutaMissedRevealWord)
      return
    const intervalId = setInterval(() => {
      const elapsed = Date.now() - turnStartRef.current
      const remaining = Math.max(0, KARUTA_TURN_MS - elapsed)
      setKarutaTimeLeftMs(remaining)
      if (remaining === 0) {
        clearInterval(intervalId)
        recordKarutaTimeout(currentKarutaTarget)
      }
    }, 100)
    return () => clearInterval(intervalId)
  }, [mode, karutaFinished, currentKarutaTarget, karutaMissedRevealWord, karutaQueue])

  useEffect(() => {
    if (mode !== 'karuta' || karutaFinished || !currentKarutaTarget || karutaBoard.length < 2) return
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

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, karutaFinished, currentKarutaTarget, karutaBoard, speakWord, handleKarutaCardSlap])

  // ---------------------------------------------------------------------------
  // MODE 3: TYPING RECALL
  // ---------------------------------------------------------------------------
  const handleTypingFailure = useCallback(
    (card: CurriculumWord, reason: 'wrong' | 'timeout') => {
      setTypingSubmitted(reason)
      setTypingCombo(0)
      setTypingMissedWords((prev) => (prev.some((w) => w.word === card.word) ? prev : [...prev, card]))
      onMissedWord(card)
    },
    [onMissedWord]
  )

  const recordTypingTimeout = useEffectEvent(handleTypingFailure)
  useEffect(() => {
    if (mode !== 'typing' || typingFinished || !currentTypingCard || typingSubmitted !== null) return
    typingInputRef.current?.focus({ preventScroll: true })
  }, [mode, typingFinished, currentTypingCard, typingSubmitted, typingDeck])

  useEffect(() => {
    if (mode !== 'typing' || typingFinished || !currentTypingCard || typingSubmitted !== null) return
    turnStartRef.current = Date.now()
    setTypingTimeLeftMs(TYPING_TURN_MS)

    if (!typingTimedMode) return undefined

    const intervalId = setInterval(() => {
      const elapsed = Date.now() - turnStartRef.current
      const remaining = Math.max(0, TYPING_TURN_MS - elapsed)
      setTypingTimeLeftMs(remaining)
      if (remaining === 0) {
        clearInterval(intervalId)
        recordTypingTimeout(currentTypingCard, 'timeout')
      }
    }, 100)

    return () => clearInterval(intervalId)
  }, [mode, typingFinished, currentTypingCard, typingSubmitted, typingTimedMode, typingDeck])

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

  if (
    words.length < 2 ||
    (mode === 'cloze' && clozeQuestions.length === 0) ||
    (mode === 'karuta' && karutaBoard.length < 2) ||
    (mode === 'typing' && typingDeck.length === 0)
  ) {
    return (
      <div className="dojo-game dojo-empty">
        <Gamepad2 size={32} aria-hidden="true" />
        <h3>Chưa đủ từ phù hợp để luyện tập</h3>
        <p>Chọn bài học khác hoặc xóa bộ lọc tìm kiếm để có thêm từ.</p>
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
                className="dojo-editorial-btn dojo-timed-toggle"
                onClick={() => setTypingTimedMode((v) => !v)}
                aria-pressed={typingTimedMode}
                aria-label="Áp lực 10 giây"
                title="Bật hoặc tắt đồng hồ đếm ngược 10 giây"
              >
                <Clock size={13} aria-hidden="true" />
                <span>Áp lực 10s · {typingTimedMode ? 'Bật' : 'Tắt'}</span>
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
            <div className="dojo-quiz-card__eyebrow dojo-quiz-card__eyebrow--center">
              <span>{currentQ.cloze ? 'ĐIỀN TỪ VÀO VĂN CẢNH' : 'CHỌN TỪ TIẾNG NHẬT PHÙ HỢP'}</span>
              {selectedWord !== null && (
                <button
                  type="button"
                  className="dojo-editorial-btn"
                  onClick={() => (currentQ.cloze ? onSpeak(currentQ.cloze.fullJa) : speakWord(currentQ.target))}
                  aria-label={`Nghe phát âm ${currentQ.target.word}`}
                >
                  <Volume2 size={14} aria-hidden="true" />
                  <span>{currentQ.cloze ? 'Nghe câu' : 'Nghe từ'}</span>
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

          {selectedWord !== null &&
            (() => {
              const pickedOption =
                selectedWord !== currentQ.target.word
                  ? currentQ.options.find((opt) => opt.word === selectedWord)
                  : undefined
              return (
                <div className="dojo-feedback-bar" role="status">
                  <div className="dojo-feedback-bar__info">
                    <strong>
                      {selectedWord === currentQ.target.word
                        ? `✓ Chính xác! ${currentQ.target.word}${currentQ.target.hanViet ? ` (${currentQ.target.hanViet})` : ''} — ${currentQ.target.meaning}`
                        : `✕ Đáp án đúng: ${currentQ.target.word}${currentQ.target.hanViet ? ` (${currentQ.target.hanViet})` : ''} — ${currentQ.target.meaning}`}
                    </strong>
                    {pickedOption && (
                      <p className="dojo-cloze-contrast">
                        Bạn chọn <strong lang="ja">{pickedOption.word}</strong>
                        {pickedOption.hanViet ? ` (${pickedOption.hanViet})` : ''} · {pickedOption.meaning}
                      </p>
                    )}
                  </div>
                  <div className="dojo-feedback-bar__actions">
                    {srsButton(currentQ.target)}
                    <button type="button" className="dojo-next-btn" onClick={handleNextQuestion}>
                      {qIndex + 1 >= clozeQuestions.length ? 'Xem tổng kết →' : 'Câu tiếp theo →'}
                    </button>
                  </div>
                </div>
              )
            })()}
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
                    {srsButton(item)}
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
              {karutaMismatchWord && !karutaLastFeedback && (
                <span className="dojo-karuta-status is-miss" role="status">
                  Chọn nhầm thẻ. Thử lại!
                </span>
              )}
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
                  <span
                    className="dojo-karuta-card__primary"
                    lang="ja"
                    style={{ '--fuda-length': Math.max(3, [...card.word].length) } as CSSProperties}
                  >
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
                    {srsButton(item)}
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
            <div
              className={`dojo-typing-line${
                typingSubmitted === 'correct'
                  ? ' is-correct'
                  : typingSubmitted === 'wrong' || typingSubmitted === 'timeout'
                    ? ' is-wrong'
                    : ''
              }`}
            >
              <input
                ref={typingInputRef}
                type="text"
                className="dojo-typing-input"
                value={typingInput}
                onChange={(e) => setTypingInput(e.target.value)}
                disabled={typingSubmitted !== null}
                aria-label="Nhập cách đọc Hiragana hoặc Romaji"
                aria-describedby="dojo-typing-help"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              {typingSubmitted === null && (
                <button
                  type="submit"
                  className="dojo-typing-inline-enter"
                  title="Kiểm tra (Enter)"
                  aria-label="Kiểm tra (Enter)"
                >
                  Kiểm tra
                </button>
              )}
            </div>

            <div className="dojo-typing-preview">
              <span id="dojo-typing-help">Ví dụ: jinsei hoặc じんせい</span>
              {liveRomajiPreview && (
                <span>
                  Chuyển Kana · <strong lang="ja">{liveRomajiPreview}</strong>
                </span>
              )}
            </div>

            <div className="dojo-typing-actions">
              {typingSubmitted === null ? (
                <button
                  type="button"
                  className="dojo-editorial-btn dojo-typing-reveal"
                  onClick={() => handleTypingFailure(currentTypingCard, 'wrong')}
                >
                  Chưa nhớ · Xem đáp án
                </button>
              ) : (
                <button type="button" className="dojo-next-btn" onClick={handleNextTypingCard}>
                  {typingIndex + 1 >= typingDeck.length ? 'Xem tổng kết →' : 'Từ tiếp theo →'}
                </button>
              )}
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
              </div>
              <div className="dojo-feedback-bar__actions">
                {typingSubmitted !== 'correct' && srsButton(currentTypingCard)}
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
              <h4>Từ cần ôn lại ({typingMissedWords.length})</h4>
              <div className="dojo-summary__missed-list">
                {typingMissedWords.map((item) => (
                  <div key={item.word} className="dojo-summary__missed-row">
                    <div>
                      <strong lang="ja">{item.word}</strong>
                      {item.reading && <span lang="ja"> 【{item.reading}】</span>}
                      <p>{item.meaning}</p>
                    </div>
                    {srsButton(item)}
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
