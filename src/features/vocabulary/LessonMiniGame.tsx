import { type CSSProperties, type FormEvent, useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { BookmarkPlus, Check, Clock, Eye, Gamepad2, RotateCcw, Volume2 } from 'lucide-react'
import type { CurriculumWord } from '../srs/srsTypes'
import { buildClozeSentence, type ClozeSentence, diffKanaReading, isReadingMatch, romajiToHiragana } from './kanaRomaji'
import { playKarutaSlap, playSoftMiss, playStampSuccess } from './soundEngine'

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

const CLOZE_ALTERNATIVES: ReadonlyArray<ReadonlyArray<string>> = [
  ['先輩', '後輩', '同僚', '上司', '部下'],
  ['男性', '女性', '男', '女'],
  ['年上', '年下', '同い年'],
  ['長所', '短所', '利点', '欠点', '強み', '弱み'],
  ['賛成', '反対'],
  ['敵', '味方'],
  ['過去', '現在', '将来', '未来', '昔', '今'],
  ['長男', '次男', '長女', '兄', '弟', '姉', '妹', '父', '母', '夫', '妻', '主人'],
  ['原因', '結果', '理由', '目的'],
  ['輸出', '輸入'],
  ['生産', '消費'],
  ['需要', '供給'],
  ['収入', '支出'],
  ['成功', '失敗'],
  ['合格', '不合格'],
  ['増加', '減少'],
  ['上昇', '下降', '低下'],
  ['出発', '到着'],
  ['開始', '終了'],
  ['入学', '卒業'],
  ['表', '裏'],
  ['右', '左'],
  ['東', '西', '南', '北'],
  ['春', '夏', '秋', '冬'],
  ['朝', '昼', '晩', '夜'],
  ['友人', '友達', '知り合い', '知人'],
  ['故郷', 'ふるさと', '出身地'],
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

function buildClozeQuestions(targetPool: CurriculumWord[], distractorPool: CurriculumWord[]): ClozeQuestion[] {
  if (distractorPool.length < 2 || targetPool.length === 0) return []
  const withCloze: Array<{ word: CurriculumWord; cloze: ClozeSentence | null }> = targetPool.map((w) => ({
    word: w,
    cloze: buildClozeSentence(
      w.word,
      w.examples?.filter(({ jp }) => GENERIC_IDENTITY_QUESTION.exec(jp.trim())?.[1] !== w.word)
    ),
  }))

  const clozeReady = shuffleArray(withCloze.filter((item) => item.cloze !== null))
  const fallbackOnly = shuffleArray(withCloze.filter((item) => item.cloze === null))
  const targets = [...clozeReady, ...fallbackOnly].slice(0, Math.min(10, targetPool.length))

  return targets.flatMap(({ word: target, cloze }) => {
    const pool = distractorPool.filter(
      (candidate) => candidate.word !== target.word && candidate.meaning !== target.meaning
    )
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

function buildKarutaArena(
  targetPool: CurriculumWord[],
  distractorPool: CurriculumWord[]
): { board: CurriculumWord[]; queue: CurriculumWord[] } {
  const readings = new Set<string>()
  const spellings = new Set<string>()
  const pickedTargets = shuffleArray(targetPool).filter((word) => {
    const reading = word.reading || word.word
    if (readings.has(reading) || spellings.has(word.word)) return false
    readings.add(reading)
    spellings.add(word.word)
    return true
  })
  const fillers = shuffleArray(distractorPool).filter((word) => {
    const reading = word.reading || word.word
    if (readings.has(reading) || spellings.has(word.word)) return false
    readings.add(reading)
    spellings.add(word.word)
    return true
  })

  const combined = [...pickedTargets, ...fillers].slice(0, KARUTA_KEYS.length)
  const targetSet = new Set(pickedTargets.map((w) => w.word))
  const queuePool = combined.filter((w) => targetSet.has(w.word))
  const queue = shuffleArray(queuePool.length > 0 ? queuePool : combined)
  const board = shuffleArray(combined)
  return { board, queue }
}

function buildTypingDeck(targetPool: CurriculumWord[]): CurriculumWord[] {
  const withReading = targetPool.filter((w) => Boolean((w.reading || w.word).trim()))
  return shuffleArray(withReading).slice(0, Math.min(10, withReading.length))
}

function padTwo(n: number): string {
  return String(Math.max(0, n)).padStart(2, '0')
}

function getRankSeal(accuracyPct: number): { kanji: string; title: string } {
  if (accuracyPct >= 100) return { kanji: '極', title: 'Đạt chuẩn Tuyệt đối' }
  if (accuracyPct >= 80) return { kanji: '優', title: 'Xuất sắc' }
  if (accuracyPct >= 60) return { kanji: '良', title: 'Khá vững' }
  return { kanji: '練', title: 'Cần rèn thêm' }
}

interface DojoSummarySheetProps {
  modeLabel: string
  correctCount: number
  totalCount: number
  reactionTimesMs: number[]
  bestCombo: number
  missedWords: CurriculumWord[]
  isTermSaved: (item: CurriculumWord) => boolean
  onSaveAllWeakToSrs: (items: CurriculumWord[]) => void
  onRetryWeakWords: (items: CurriculumWord[]) => void
  onNewFullRound: () => void
}

function DojoSummarySheet({
  modeLabel,
  correctCount,
  totalCount,
  reactionTimesMs,
  bestCombo,
  missedWords,
  isTermSaved,
  onSaveAllWeakToSrs,
  onRetryWeakWords,
  onNewFullRound,
}: DojoSummarySheetProps) {
  const accuracyPct = Math.round((correctCount / Math.max(1, totalCount)) * 100)
  const rank = getRankSeal(accuracyPct)
  const avgSec =
    reactionTimesMs.length > 0
      ? `${(reactionTimesMs.reduce((sum, ms) => sum + ms, 0) / reactionTimesMs.length / 1000).toFixed(1)}s`
      : '—'
  const unsavedWeakCount = missedWords.filter((item) => !isTermSaved(item)).length

  return (
    <div className="dojo-summary dojo-summary-sheet" aria-label="Phiếu chấm Đạo trường">
      <div className="dojo-summary-sheet__header">
        <svg className="dojo-rank-seal" viewBox="0 0 64 64" aria-hidden="true">
          <rect x="4" y="4" width="56" height="56" rx="4" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <rect x="8.5" y="8.5" width="47" height="47" rx="2" fill="none" stroke="currentColor" strokeWidth="0.9" />
          <text x="32" y="43" textAnchor="middle" fill="currentColor" fontSize="30" fontWeight="800">
            {rank.kanji}
          </text>
        </svg>
        <div className="dojo-summary-sheet__title-group">
          <span className="dojo-summary-sheet__kicker">PHIẾU CHẤM ĐẠO TRƯỜNG · {modeLabel.toUpperCase()}</span>
          <h3>{rank.title}</h3>
        </div>
      </div>

      <div className="dojo-summary-metrics">
        <div className="dojo-summary-metric">
          <span className="dojo-summary-metric__label">Tỷ lệ chính xác</span>
          <strong className="dojo-summary-metric__value">
            {accuracyPct}%{' '}
            <small>
              ({correctCount}/{totalCount})
            </small>
          </strong>
        </div>
        <div className="dojo-summary-metric">
          <span className="dojo-summary-metric__label">Tốc độ trung bình</span>
          <strong className="dojo-summary-metric__value">{avgSec}/từ</strong>
        </div>
        <div className="dojo-summary-metric">
          <span className="dojo-summary-metric__label">Chuỗi đúng cao nhất</span>
          <strong className="dojo-summary-metric__value">{bestCombo}</strong>
        </div>
      </div>

      {missedWords.length > 0 && (
        <div className="dojo-summary__missed">
          <h4>Từ vừa vấp cần củng cố ({missedWords.length})</h4>
          <div className="dojo-summary__missed-list">
            {missedWords.map((item) => (
              <div key={item.word} className="dojo-summary__missed-row">
                <div className="dojo-summary__missed-main">
                  <strong lang="ja">{item.word}</strong>
                  {item.reading && <span lang="ja">【{item.reading}】</span>}
                  <span className="dojo-summary__missed-meaning">· {item.meaning}</span>
                </div>
                {isTermSaved(item) && (
                  <span className="dojo-summary__srs-tag">
                    <Check size={12} aria-hidden="true" /> Đã vào SRS
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="dojo-summary-actions">
        {missedWords.length > 0 && (
          <>
            <button
              type="button"
              className={`dojo-summary-btn dojo-summary-btn--srs${unsavedWeakCount === 0 ? ' is-done' : ''}`}
              disabled={unsavedWeakCount === 0}
              onClick={() => onSaveAllWeakToSrs(missedWords)}
            >
              {unsavedWeakCount === 0 ? (
                <>
                  <Check size={14} aria-hidden="true" />
                  <span>Đã lưu {missedWords.length} từ yếu vào Sổ tay SRS</span>
                </>
              ) : (
                <>
                  <BookmarkPlus size={14} aria-hidden="true" />
                  <span>Lưu {unsavedWeakCount} từ yếu vào Sổ tay SRS</span>
                </>
              )}
            </button>

            <button
              type="button"
              className="dojo-summary-btn dojo-summary-btn--primary"
              onClick={() => onRetryWeakWords(missedWords)}
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span>Luyện lại ngay {missedWords.length} từ này</span>
            </button>
          </>
        )}

        <button type="button" className="dojo-summary-btn dojo-summary-btn--ghost" onClick={onNewFullRound}>
          <RotateCcw size={14} aria-hidden="true" />
          <span>Ván mới toàn bài</span>
        </button>
      </div>
    </div>
  )
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
  const [practicePool, setPracticePool] = useState<CurriculumWord[] | null>(null)

  // Cloze State
  const [clozeQuestions, setClozeQuestions] = useState<ClozeQuestion[]>(() => buildClozeQuestions(words, words))
  const [qIndex, setQIndex] = useState(0)
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [clozeShowHint, setClozeShowHint] = useState(false)
  const [clozeReactionTimes, setClozeReactionTimes] = useState<number[]>([])
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [missedWords, setMissedWords] = useState<CurriculumWord[]>([])
  const [clozeFinished, setClozeFinished] = useState(false)

  // Audio Karuta Arena State
  const [{ board: karutaBoard, queue: karutaQueue }, setKarutaArena] = useState(() => buildKarutaArena(words, words))
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
  const [typingReactionTimes, setTypingReactionTimes] = useState<number[]>([])
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
    (nextMode?: DojoGameMode, customTargets?: CurriculumWord[] | null) => {
      clearPendingTimers()
      if (nextMode) setMode(nextMode)
      const activeTargets = customTargets && customTargets.length > 0 ? customTargets : words
      setPracticePool(customTargets && customTargets.length > 0 ? customTargets : null)

      // Reset Cloze
      setClozeQuestions(buildClozeQuestions(activeTargets, words))
      setQIndex(0)
      setSelectedWord(null)
      setClozeShowHint(false)
      setClozeReactionTimes([])
      setScore(0)
      setCombo(0)
      setBestCombo(0)
      setCorrectCount(0)
      setMissedWords([])
      setClozeFinished(false)

      // Reset Karuta Arena
      setKarutaArena(buildKarutaArena(activeTargets, words))
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
      setTypingDeck(buildTypingDeck(activeTargets))
      setTypingIndex(0)
      setTypingInput('')
      setTypingSubmitted(null)
      setTypingShowHint(false)
      setTypingTimeLeftMs(TYPING_TURN_MS)
      setTypingReactionTimes([])
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
    resetRound(activeMode ?? 'cloze', null)
  }, [activeMode, resetRound, words])

  const currentQ = clozeQuestions[qIndex] || null
  const currentKarutaTarget = karutaQueue[karutaTurnIdx] || null
  const currentTypingCard = typingDeck[typingIndex] || null

  const saveAllWeakToSrs = useCallback(
    (items: CurriculumWord[]) => {
      for (const item of items) {
        if (!isTermSaved(item)) {
          void onSaveToSrs(item)
        }
      }
      playStampSuccess()
    },
    [isTermSaved, onSaveToSrs]
  )

  const srsButton = (item: CurriculumWord, savedLabel = 'Đã lưu SRS') => {
    const saved = isTermSaved(item)
    return (
      <button
        type="button"
        className={`dojo-srs-chip${saved ? ' is-saved' : ''}`}
        disabled={saved}
        onClick={() => {
          playStampSuccess()
          void onSaveToSrs(item)
        }}
      >
        {saved ? <Check size={14} /> : <BookmarkPlus size={14} />}
        <span>{saved ? savedLabel : 'Lưu vào SRS'}</span>
      </button>
    )
  }

  // ---------------------------------------------------------------------------
  // MODE 1: CLOZE HANDLERS
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (mode !== 'cloze' || clozeFinished || !currentQ || selectedWord !== null) return
    turnStartRef.current = Date.now()
  }, [mode, clozeFinished, currentQ, selectedWord])

  const handleSelectOption = useCallback(
    (option: CurriculumWord) => {
      if (!currentQ || selectedWord !== null) return
      const elapsed = Math.max(150, Date.now() - turnStartRef.current)
      setClozeReactionTimes((prev) => [...prev, elapsed])
      setSelectedWord(option.word)
      const isCorrect = option.word === currentQ.target.word
      if (isCorrect) {
        playStampSuccess()
        const nextCombo = combo + 1
        setCombo(nextCombo)
        setBestCombo((prev) => Math.max(prev, nextCombo))
        setCorrectCount((c) => c + 1)
        setScore((s) => s + 100 + Math.min(nextCombo - 1, 5) * 20)
      } else {
        playSoftMiss()
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
        playKarutaSlap()
        playStampSuccess()
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
        }, 680)
        timersRef.current.push(tid)
      } else {
        if (karutaMismatchWord) return
        playSoftMiss()
        setKarutaCombo(0)
        setKarutaMismatchWord(card.word)
        setKarutaLastFeedback(null)
        onMissedWord(currentKarutaTarget)
        setKarutaMissedWords((prev) =>
          prev.some((w) => w.word === currentKarutaTarget.word) ? prev : [...prev, currentKarutaTarget]
        )
        const tid = setTimeout(() => {
          setKarutaMismatchWord(null)
        }, 360)
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
    playSoftMiss()
    onMissedWord(word)
    setKarutaCombo(0)
    setKarutaMissedRevealWord(word.word)
    setKarutaLastFeedback({ ok: false, word })
    setKarutaMissedWords((prev) => (prev.some((item) => item.word === word.word) ? prev : [...prev, word]))
    timersRef.current.push(setTimeout(advanceKarutaTurn, 950))
  })

  useEffect(() => {
    if (mode !== 'karuta' || karutaFinished || !currentKarutaTarget || karutaQueue.length < 1) return
    turnStartRef.current = Date.now()
    setKarutaTimeLeftMs(KARUTA_TURN_MS)
    playKarutaPrompt(currentKarutaTarget)
  }, [mode, karutaFinished, currentKarutaTarget, karutaQueue])

  useEffect(() => {
    if (mode !== 'karuta' || karutaFinished || !currentKarutaTarget || karutaQueue.length < 1 || karutaMissedRevealWord)
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
      playSoftMiss()
      const elapsed = Math.max(150, Date.now() - turnStartRef.current)
      setTypingReactionTimes((prev) => [...prev, elapsed])
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
      const elapsed = Math.max(150, Date.now() - turnStartRef.current)
      setTypingReactionTimes((prev) => [...prev, elapsed])
      playStampSuccess()
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

  // Enter advances when typing card has been graded (even if focus left input)
  useEffect(() => {
    if (mode !== 'typing' || typingFinished || typingSubmitted === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return
      if (event.target instanceof Element && event.target.closest('button')) return
      event.preventDefault()
      handleNextTypingCard()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, typingFinished, typingSubmitted, handleNextTypingCard])

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

  const liveRomajiPreview = romajiToHiragana(typingInput)
  const typingDiff =
    typingSubmitted !== null && typingSubmitted !== 'correct' && currentTypingCard
      ? diffKanaReading(typingInput, currentTypingCard.reading, currentTypingCard.word)
      : null

  return (
    <section className="dojo-game" aria-label="Võ Đường Mini-Game Kotodama">
      {/* Minimal Editorial HUD Line */}
      <header className="dojo-hud">
        <div className="dojo-hud__editorial">
          {mode === 'cloze' && (
            <span>
              {practicePool ? 'Ôn từ yếu · ' : ''}Câu{' '}
              <strong>{padTwo(Math.min(qIndex + 1, clozeQuestions.length))}</strong> / {padTwo(clozeQuestions.length)} ·
              Chuỗi đúng <strong>{combo}</strong> · <strong>{score}</strong> điểm
            </span>
          )}
          {mode === 'karuta' && (
            <span>
              {practicePool ? 'Ôn từ yếu · ' : ''}Lá{' '}
              <strong>{padTwo(Math.min(karutaTurnIdx + 1, karutaQueue.length))}</strong> / {padTwo(karutaQueue.length)}{' '}
              · Chuỗi đúng <strong>{karutaCombo}</strong> · <strong>{karutaScore}</strong> điểm
            </span>
          )}
          {mode === 'typing' && (
            <span>
              {practicePool ? 'Ôn từ yếu · ' : ''}Từ{' '}
              <strong>{padTwo(Math.min(typingIndex + 1, typingDeck.length))}</strong> / {padTwo(typingDeck.length)} ·
              Chuỗi đúng <strong>{typingCombo}</strong> · <strong>{typingScore}</strong> điểm
            </span>
          )}
        </div>

        <div className="dojo-hud__actions">
          {mode === 'cloze' && !clozeFinished && currentQ?.cloze?.vi && selectedWord === null && (
            <button
              type="button"
              className={`dojo-editorial-btn${clozeShowHint ? ' is-active' : ''}`}
              onClick={() => {
                setClozeShowHint((v) => {
                  const next = !v
                  if (next && currentQ) {
                    setMissedWords((prev) =>
                      prev.some((w) => w.word === currentQ.target.word) ? prev : [...prev, currentQ.target]
                    )
                  }
                  return next
                })
              }}
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
              <span>
                Nghe lại <kbd className="dojo-key-hint">Space</kbd>
              </span>
            </button>
          )}

          {mode === 'typing' && !typingFinished && currentTypingCard && (
            <>
              <button
                type="button"
                className={`dojo-editorial-btn${typingShowHint ? ' is-active' : ''}`}
                onClick={() => {
                  setTypingShowHint((v) => {
                    const next = !v
                    if (next && currentTypingCard) {
                      setTypingMissedWords((prev) =>
                        prev.some((w) => w.word === currentTypingCard.word) ? prev : [...prev, currentTypingCard]
                      )
                    }
                    return next
                  })
                }}
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

          <button
            type="button"
            className="dojo-editorial-btn"
            onClick={() => resetRound(undefined, null)}
            title="Chơi ván mới"
          >
            <RotateCcw size={13} aria-hidden="true" />
            <span>Ván mới</span>
          </button>
        </div>
      </header>

      {/* MODE 1: CONTEXTUAL CLOZE TEST */}
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
                  <span
                    className={`dojo-cloze-blank${
                      selectedWord !== null
                        ? selectedWord === currentQ.target.word
                          ? ' is-filled is-correct'
                          : ' is-filled is-auto-filled'
                        : ''
                    }`}
                  >
                    {selectedWord !== null ? (
                      <ruby className="dojo-cloze-ruby">
                        {currentQ.cloze.matchedText}
                        {currentQ.target.reading && <rt>{currentQ.target.reading}</rt>}
                      </ruby>
                    ) : (
                      '（　　）'
                    )}
                  </span>
                  <span>{currentQ.cloze.after}</span>
                </p>
                {clozeShowHint && selectedWord === null && currentQ.cloze.vi && (
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
              const nextBtnLabel = qIndex + 1 >= clozeQuestions.length ? 'Xem tổng kết →' : 'Câu tiếp theo →'
              return (
                <div className="dojo-feedback-bar" role="status">
                  <div className="dojo-feedback-bar__info">
                    <strong>
                      {selectedWord === currentQ.target.word
                        ? `✓ Chính xác! ${currentQ.target.word}${currentQ.target.hanViet ? ` (${currentQ.target.hanViet})` : ''} — ${currentQ.target.meaning}`
                        : `✕ Đáp án đúng: ${currentQ.target.word}${currentQ.target.hanViet ? ` (${currentQ.target.hanViet})` : ''} — ${currentQ.target.meaning}`}
                    </strong>
                    {currentQ.cloze?.vi && <p className="dojo-cloze-post-vi">Dịch câu: “{currentQ.cloze.vi}”</p>}
                    {pickedOption && (
                      <p className="dojo-cloze-contrast">
                        Bạn chọn nhầm <strong lang="ja">{pickedOption.word}</strong>
                        {pickedOption.hanViet ? ` (${pickedOption.hanViet})` : ''}: {pickedOption.meaning}.
                      </p>
                    )}
                  </div>
                  <div className="dojo-feedback-bar__actions">
                    {srsButton(currentQ.target)}
                    <button
                      type="button"
                      className="dojo-next-btn"
                      aria-label={nextBtnLabel}
                      onClick={handleNextQuestion}
                    >
                      <span>{nextBtnLabel}</span>
                      <kbd className="dojo-key-hint" aria-hidden="true">
                        Space
                      </kbd>
                    </button>
                  </div>
                </div>
              )
            })()}
        </div>
      )}

      {mode === 'cloze' && clozeFinished && (
        <DojoSummarySheet
          modeLabel="Điền Từ Văn Cảnh"
          correctCount={correctCount}
          totalCount={clozeQuestions.length}
          reactionTimesMs={clozeReactionTimes}
          bestCombo={bestCombo}
          missedWords={missedWords}
          isTermSaved={isTermSaved}
          onSaveAllWeakToSrs={saveAllWeakToSrs}
          onRetryWeakWords={(weak) => resetRound('cloze', weak)}
          onNewFullRound={() => resetRound('cloze', null)}
        />
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
                NGHE ÂM ĐỌC · ĐẬP THẺ BÀI
                <span className="dojo-key-hint"> ({KARUTA_KEYS.slice(0, karutaBoard.length).join(' · ')})</span>
              </span>
              {karutaMismatchWord && !karutaLastFeedback && (
                <span className="dojo-karuta-status is-miss" role="status">
                  Chọn nhầm thẻ — thử lại nhanh!
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
                    <svg className="dojo-karuta-seal-svg" viewBox="0 0 36 36" aria-hidden="true">
                      <rect
                        x="2"
                        y="2"
                        width="32"
                        height="32"
                        rx="3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <text x="18" y="25" textAnchor="middle" fill="currentColor" fontSize="19" fontWeight="800">
                        正
                      </text>
                    </svg>
                  )}
                  <span
                    className="dojo-karuta-card__primary"
                    lang="ja"
                    style={{ '--fuda-length': Math.max(3, [...card.word].length) } as CSSProperties}
                  >
                    {card.word}
                  </span>
                  {isMissedReveal && card.reading && (
                    <span className="dojo-karuta-card__reveal-kana" lang="ja">
                      {card.reading}
                    </span>
                  )}
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
        <DojoSummarySheet
          modeLabel="Đấu Trường Karuta"
          correctCount={karutaCorrectCount}
          totalCount={karutaQueue.length}
          reactionTimesMs={karutaReactionTimes}
          bestCombo={karutaBestCombo}
          missedWords={karutaMissedWords}
          isTermSaved={isTermSaved}
          onSaveAllWeakToSrs={saveAllWeakToSrs}
          onRetryWeakWords={(weak) => resetRound('karuta', weak)}
          onNewFullRound={() => resetRound('karuta', null)}
        />
      )}

      {/* MODE 3: CALM HAIRLINE TYPING RECALL + TENSAKU GRADING */}
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
                  Kiểm tra ↵
                </button>
              )}
            </div>

            <div className="dojo-typing-preview">
              {typingInput.trim() === '' ? (
                <span id="dojo-typing-help" className="dojo-typing-placeholder-hint">
                  Ví dụ: jinsei hoặc じんせい
                </span>
              ) : (
                <span id="dojo-typing-help" className="dojo-typing-live-kana" lang="ja">
                  {liveRomajiPreview}
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

          {typingSubmitted === 'correct' && (
            <div className="dojo-feedback-bar dojo-feedback-bar--correct" role="status">
              <div className="dojo-feedback-bar__info dojo-typing-correct-row">
                <svg className="dojo-nijuumaru-svg" viewBox="0 0 36 36" aria-hidden="true">
                  <circle
                    className="dojo-nijuumaru-outer"
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                  />
                  <circle
                    className="dojo-nijuumaru-inner"
                    cx="18"
                    cy="18"
                    r="9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                </svg>
                <strong>
                  ✓ Chính xác! {currentTypingCard.word} 【{currentTypingCard.reading || currentTypingCard.word}】
                </strong>
              </div>
              <div className="dojo-feedback-bar__actions">
                <button type="button" className="dojo-editorial-btn" onClick={() => speakWord(currentTypingCard)}>
                  <Volume2 size={14} aria-hidden="true" />
                  <span>Nghe âm</span>
                </button>
              </div>
            </div>
          )}

          {typingSubmitted !== null && typingSubmitted !== 'correct' && typingDiff && (
            <div className="dojo-feedback-bar dojo-tensaku" role="status">
              <div className="dojo-feedback-bar__info">
                <div className="dojo-tensaku__grade-row">
                  <span className="dojo-tensaku__target" lang="ja">
                    {typingDiff.tokens.map((tok, i) => (
                      <span key={`${tok.char}-${i}`} className={`dojo-tensaku__char${tok.isDiff ? ' is-diff' : ''}`}>
                        {tok.char}
                      </span>
                    ))}
                  </span>
                  {typingDiff.userHira && (
                    <span className="dojo-tensaku__strike" lang="ja">
                      {typingDiff.userHira}
                    </span>
                  )}
                  <span className="dojo-tensaku__meaning">— {currentTypingCard.meaning}</span>
                </div>
                {typingDiff.hintNote && <p className="dojo-tensaku__hint">{typingDiff.hintNote}</p>}
              </div>
              <div className="dojo-feedback-bar__actions">
                {srsButton(currentTypingCard)}
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
        <DojoSummarySheet
          modeLabel="Gõ Âm Đọc"
          correctCount={typingCorrectCount}
          totalCount={typingDeck.length}
          reactionTimesMs={typingReactionTimes}
          bestCombo={typingBestCombo}
          missedWords={typingMissedWords}
          isTermSaved={isTermSaved}
          onSaveAllWeakToSrs={saveAllWeakToSrs}
          onRetryWeakWords={(weak) => resetRound('typing', weak)}
          onNewFullRound={() => resetRound('typing', null)}
        />
      )}
    </section>
  )
}
