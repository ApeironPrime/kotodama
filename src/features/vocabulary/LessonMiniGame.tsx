import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookmarkPlus, Check, Flame, Gamepad2, Headphones, RotateCcw, Sparkles, Volume2, Zap } from 'lucide-react'
import type { CurriculumWord } from '../srs/srsTypes'
import { sumiAudio } from '../dictionary/sumiAudio'

interface LessonMiniGameProps {
  words: CurriculumWord[]
  isTermSaved: (item: CurriculumWord) => boolean
  onSaveToSrs: (item: CurriculumWord) => Promise<void> | void
  onSpeak: (text: string, audioUrl?: string) => void
}

type DojoMode = 'quiz' | 'karuta'

interface QuizQuestion {
  target: CurriculumWord
  options: CurriculumWord[]
}

interface KarutaCard {
  uid: string
  pairId: string
  kind: 'jp' | 'vi'
  primary: string
  secondary?: string | undefined
  wordRef: CurriculumWord
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

function buildQuizQuestions(words: CurriculumWord[]): QuizQuestion[] {
  if (words.length < 2) return []
  const targets = shuffleArray(words).slice(0, Math.min(10, words.length))
  return targets.map((target) => {
    const distractors = shuffleArray(
      words.filter((candidate) => candidate.word !== target.word && candidate.meaning !== target.meaning)
    ).slice(0, 3)
    const options = shuffleArray([target, ...distractors])
    return { target, options }
  })
}

function buildKarutaDeck(words: CurriculumWord[]): KarutaCard[] {
  if (words.length < 2) return []
  const selected = shuffleArray(words).slice(0, Math.min(6, words.length))
  const cards: KarutaCard[] = []
  selected.forEach((item, index) => {
    const pairId = `${item.termId || item.word}-${index}`
    cards.push({
      uid: `${pairId}-jp`,
      pairId,
      kind: 'jp',
      primary: item.word,
      secondary: item.reading || undefined,
      wordRef: item,
    })
    cards.push({
      uid: `${pairId}-vi`,
      pairId,
      kind: 'vi',
      primary: item.meaning,
      secondary: item.hanViet ? `(${item.hanViet})` : undefined,
      wordRef: item,
    })
  })
  return shuffleArray(cards)
}

export function LessonMiniGame({ words, isTermSaved, onSaveToSrs, onSpeak }: LessonMiniGameProps) {
  const [mode, setMode] = useState<DojoMode>('quiz')
  const [roundSeed, setRoundSeed] = useState(0)

  // Quiz State
  const [audioFirst, setAudioFirst] = useState(false)
  const [qIndex, setQIndex] = useState(0)
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [missedWords, setMissedWords] = useState<CurriculumWord[]>([])
  const [quizFinished, setQuizFinished] = useState(false)

  // Karuta State
  const [selectedCardUid, setSelectedCardUid] = useState<string | null>(null)
  const [matchedPairIds, setMatchedPairIds] = useState<Record<string, boolean>>({})
  const [mismatchUids, setMismatchUids] = useState<[string, string] | null>(null)
  const [karutaMoves, setKarutaMoves] = useState(0)
  const [karutaCombo, setKarutaCombo] = useState(0)
  const mismatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const questions = useMemo(() => buildQuizQuestions(words), [words, roundSeed])
  const karutaDeck = useMemo(() => buildKarutaDeck(words), [words, roundSeed])
  const totalPairs = Math.floor(karutaDeck.length / 2)
  const matchedCount = Object.keys(matchedPairIds).length
  const karutaFinished = totalPairs > 0 && matchedCount >= totalPairs

  useEffect(() => {
    return () => {
      if (mismatchTimerRef.current) clearTimeout(mismatchTimerRef.current)
    }
  }, [])

  const resetRound = useCallback((nextMode?: DojoMode) => {
    if (mismatchTimerRef.current) clearTimeout(mismatchTimerRef.current)
    if (nextMode) setMode(nextMode)
    setRoundSeed((s) => s + 1)
    setQIndex(0)
    setSelectedWord(null)
    setScore(0)
    setCombo(0)
    setBestCombo(0)
    setCorrectCount(0)
    setMissedWords([])
    setQuizFinished(false)
    setSelectedCardUid(null)
    setMatchedPairIds({})
    setMismatchUids(null)
    setKarutaMoves(0)
    setKarutaCombo(0)
  }, [])

  const currentQ = questions[qIndex] || null

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
    if (qIndex + 1 >= questions.length) {
      setQuizFinished(true)
    } else {
      setQIndex((i) => i + 1)
      setSelectedWord(null)
    }
  }, [qIndex, questions.length])

  // Keyboard shortcuts 1-4 and Enter/Space for Quiz
  useEffect(() => {
    if (mode !== 'quiz' || quizFinished || !currentQ) return
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
  }, [mode, quizFinished, currentQ, selectedWord, handleSelectOption, handleNextQuestion])

  const handleKarutaClick = (card: KarutaCard) => {
    if (matchedPairIds[card.pairId] || mismatchUids) return
    if (selectedCardUid === card.uid) {
      setSelectedCardUid(null)
      return
    }
    if (!selectedCardUid) {
      setSelectedCardUid(card.uid)
      if (card.kind === 'jp') {
        onSpeak(card.wordRef.word, card.wordRef.audioUrl)
      }
      return
    }
    const first = karutaDeck.find((c) => c.uid === selectedCardUid)
    if (!first) {
      setSelectedCardUid(card.uid)
      return
    }
    setKarutaMoves((m) => m + 1)
    if (first.pairId === card.pairId && first.kind !== card.kind) {
      try {
        sumiAudio.playHankoStamp()
      } catch {
        // ignore audio error
      }
      setMatchedPairIds((prev) => ({ ...prev, [card.pairId]: true }))
      setSelectedCardUid(null)
      setKarutaCombo((c) => c + 1)
    } else {
      setKarutaCombo(0)
      setMismatchUids([first.uid, card.uid])
      setSelectedCardUid(null)
      mismatchTimerRef.current = setTimeout(() => {
        setMismatchUids(null)
      }, 550)
    }
  }

  if (words.length < 2) {
    return (
      <div className="dojo-game dojo-empty">
        <Gamepad2 size={32} aria-hidden="true" />
        <h3>Cần ít nhất 2 từ vựng để mở Võ Đường</h3>
        <p>Hãy chọn bài học hoặc xóa bộ lọc tìm kiếm để có đủ từ luyện phản xạ và ghép thẻ Karuta.</p>
      </div>
    )
  }

  return (
    <section className="dojo-game" aria-label="Võ Đường Mini-Game Kotodama">
      {/* Top Dojo HUD */}
      <header className="dojo-hud">
        <div className="dojo-hud__modes" role="group" aria-label="Chọn trò chơi">
          <button
            type="button"
            className={`dojo-mode-btn${mode === 'quiz' ? ' is-active' : ''}`}
            onClick={() => resetRound('quiz')}
          >
            <Zap size={14} aria-hidden="true" />
            <span>Phản Xạ Nghĩa</span>
          </button>
          <button
            type="button"
            className={`dojo-mode-btn${mode === 'karuta' ? ' is-active' : ''}`}
            onClick={() => resetRound('karuta')}
          >
            <Sparkles size={14} aria-hidden="true" />
            <span>Ghép Thẻ Karuta</span>
          </button>
        </div>

        <div className="dojo-hud__stats">
          {mode === 'quiz' ? (
            <>
              <button
                type="button"
                className={`dojo-audio-toggle${audioFirst ? ' is-active' : ''}`}
                onClick={() => setAudioFirst((prev) => !prev)}
                aria-pressed={audioFirst}
                title="Ẩn mặt chữ để luyện nghe phản xạ"
              >
                <Headphones size={14} aria-hidden="true" />
                <span>Luyện nghe</span>
              </button>
              <span className="dojo-stat-pill">
                Điểm <strong>{score}</strong>
              </span>
              <span className={`dojo-stat-pill${combo > 1 ? ' is-hot' : ''}`}>
                <Flame size={13} aria-hidden="true" />
                <span>x{combo}</span>
              </span>
              <span className="dojo-stat-pill">
                {Math.min(qIndex + 1, questions.length)} / {questions.length}
              </span>
            </>
          ) : (
            <>
              <span className="dojo-stat-pill">
                Đã ghép{' '}
                <strong>
                  {matchedCount} / {totalPairs}
                </strong>{' '}
                cặp
              </span>
              <span className={`dojo-stat-pill${karutaCombo > 1 ? ' is-hot' : ''}`}>
                <Flame size={13} aria-hidden="true" />
                <span>x{karutaCombo}</span>
              </span>
              <span className="dojo-stat-pill">
                Lượt <strong>{karutaMoves}</strong>
              </span>
            </>
          )}
          <button type="button" className="dojo-reset-btn" onClick={() => resetRound()} title="Chơi ván mới">
            <RotateCcw size={14} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* MODE 1: SPEED QUIZ */}
      {mode === 'quiz' && !quizFinished && currentQ && (
        <div className="dojo-quiz-stage">
          <div className="dojo-quiz-card">
            <div className="dojo-quiz-card__eyebrow">
              <span>{audioFirst && selectedWord === null ? 'NGHE ÂM CHỌN NGHĨA' : 'CHỌN NGHĨA ĐÚNG'}</span>
              <button
                type="button"
                className="dojo-speak-btn"
                onClick={() => onSpeak(currentQ.target.word, currentQ.target.audioUrl)}
                aria-label={`Nghe phát âm ${currentQ.target.word}`}
              >
                <Volume2 size={16} aria-hidden="true" />
                <span>Nghe phát âm</span>
              </button>
            </div>

            <div className="dojo-quiz-card__prompt" lang="ja">
              {audioFirst && selectedWord === null ? (
                <span className="dojo-quiz-card__masked">「 ？ 」</span>
              ) : (
                <span>{currentQ.target.word}</span>
              )}
            </div>

            {selectedWord !== null && (
              <div className="dojo-quiz-card__reveal">
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
                  <span className="dojo-option-btn__text">{opt.meaning}</span>
                </button>
              )
            })}
          </div>

          {selectedWord !== null && (
            <div className="dojo-feedback-bar" role="status">
              <div className="dojo-feedback-bar__info">
                <strong>
                  {selectedWord === currentQ.target.word ? '✓ Chính xác!' : `✕ Đáp án đúng: ${currentQ.target.meaning}`}
                </strong>
                {currentQ.target.examples?.[0] && (
                  <p>
                    <span lang="ja">{currentQ.target.examples[0].jp}</span>
                    {currentQ.target.examples[0].vi ? ` — ${currentQ.target.examples[0].vi}` : ''}
                  </p>
                )}
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
                  {qIndex + 1 >= questions.length ? 'Xem tổng kết →' : 'Câu tiếp theo →'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE 1 COMPLETION SUMMARY */}
      {mode === 'quiz' && quizFinished && (
        <div className="dojo-summary">
          <div className="dojo-summary__seal" aria-hidden="true">
            達
          </div>
          <h3>Hoàn thành vòng luyện tập</h3>
          <p className="dojo-summary__subtitle">
            Bạn đã trả lời đúng{' '}
            <strong>
              {correctCount} / {questions.length}
            </strong>{' '}
            câu ({Math.round((correctCount / Math.max(1, questions.length)) * 100)}%) · Điểm <strong>{score}</strong> ·
            Combo cao nhất <strong>x{bestCombo}</strong>
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

          <button type="button" className="dojo-next-btn" onClick={() => resetRound('quiz')}>
            <RotateCcw size={15} aria-hidden="true" />
            <span>Chơi ván mới</span>
          </button>
        </div>
      )}

      {/* MODE 2: KARUTA MATCH BOARD */}
      {mode === 'karuta' && !karutaFinished && (
        <div className="dojo-karuta-grid" role="group" aria-label="Bảng ghép thẻ Karuta">
          {karutaDeck.map((card) => {
            const isMatched = Boolean(matchedPairIds[card.pairId])
            const isSelected = selectedCardUid === card.uid
            const isMismatch = mismatchUids?.includes(card.uid) ?? false
            return (
              <button
                key={card.uid}
                type="button"
                disabled={isMatched}
                aria-pressed={isSelected}
                className={`dojo-karuta-card dojo-karuta-card--${card.kind}${isSelected ? ' is-selected' : ''}${
                  isMatched ? ' is-matched' : ''
                }${isMismatch ? ' is-mismatch' : ''}`}
                onClick={() => handleKarutaClick(card)}
              >
                {isMatched && (
                  <span className="dojo-karuta-card__seal" aria-hidden="true">
                    合
                  </span>
                )}
                <span className="dojo-karuta-card__primary" lang={card.kind === 'jp' ? 'ja' : undefined}>
                  {card.primary}
                </span>
                {card.secondary && (
                  <span className="dojo-karuta-card__secondary" lang={card.kind === 'jp' ? 'ja' : undefined}>
                    {card.secondary}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {mode === 'karuta' && karutaFinished && (
        <div className="dojo-summary">
          <div className="dojo-summary__seal" aria-hidden="true">
            合
          </div>
          <h3>Hoàn tất ván Karuta!</h3>
          <p className="dojo-summary__subtitle">
            Bạn đã ghép trọn <strong>{totalPairs} cặp thẻ</strong> trong <strong>{karutaMoves} lượt</strong>.
          </p>
          <button type="button" className="dojo-next-btn" onClick={() => resetRound('karuta')}>
            <RotateCcw size={15} aria-hidden="true" />
            <span>Xáo bài chơi lại</span>
          </button>
        </div>
      )}
    </section>
  )
}
