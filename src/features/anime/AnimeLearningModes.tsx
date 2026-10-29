import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Eye, EyeOff, Headphones, Languages, Lightbulb, Mic, RotateCcw, SpellCheck, Volume2, X } from 'lucide-react'
import type { AnimeSubtitleCue, AnimeSubtitleToken } from './animePlaybackTypes'
import { normalizeJapaneseAnswer } from './animeLearningUtils'

export type AnimeLearningMode = 'shadowing' | 'pronunciation' | 'listening' | 'exercise'
export type ExerciseKind = 'dictation' | 'cloze' | 'translation'

interface SpeechResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

interface SpeechRecognitionInstance {
  lang: string
  onresult: ((event: SpeechResultEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null
  const speechWindow = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
}

interface CueProps {
  cue: AnimeSubtitleCue | null
  onReplay: () => void
  onSelectToken?: (cue: AnimeSubtitleCue, token: AnimeSubtitleToken, triggerEl: HTMLElement) => void
}

export const AnimeActiveSentence: React.FC<CueProps & { showJapanese: boolean; showVietnamese: boolean; loop: boolean; onToggleLoop: () => void; onToggleJapanese?: () => void; onToggleVietnamese?: () => void }> = ({
  cue, onReplay, onSelectToken, showJapanese, showVietnamese, loop, onToggleLoop, onToggleJapanese, onToggleVietnamese,
}) => (
  <section className="anime-learning-sentence" aria-label="Câu đang học">
    <div className="anime-learning-sentence__top">
      <span>CÂU ĐANG HỌC</span>
      <div className="anime-learning-sentence__actions">
        <button type="button" onClick={onReplay} disabled={!cue} aria-label="Phát lại câu">
          <RotateCcw size={16} /> Phát lại
        </button>
        <button type="button" onClick={onToggleLoop} aria-pressed={loop} disabled={!cue} aria-label="Lặp lại câu">
          <Volume2 size={16} /> {loop ? 'Đang lặp' : 'Lặp câu'}
        </button>
      </div>
    </div>
    {cue ? (
      <>
        {showJapanese && <p className="anime-learning-sentence__ja" lang="ja">
          {cue.tokens?.length ? cue.tokens.map((token) => (
            <button key={token.token_ordinal} type="button" className="anime-learning-token" onClick={(event) => onSelectToken?.(cue, token, event.currentTarget)} aria-label={`${token.surface} — Tra nghĩa`}>{token.surface}</button>
          )) : cue.ja}
        </p>}
        {showVietnamese && <p className="anime-learning-sentence__vi" lang="vi">{cue.vi || 'Chưa có bản dịch tiếng Việt.'}</p>}
        {!showJapanese && !showVietnamese && <p className="anime-learning-sentence__hint">Bật Nhật hoặc Việt ở bảng phụ đề để xem câu.</p>}
      </>
    ) : <p className="anime-learning-sentence__hint">Phát video hoặc chọn một câu trong danh sách phụ đề để bắt đầu.</p>}
    <div className="anime-learning-sentence__footer" role="group" aria-label="Hiển thị câu đang học">
      <button type="button" onClick={onToggleJapanese} aria-pressed={showJapanese}>Phụ đề Nhật</button>
      <button type="button" onClick={onToggleVietnamese} aria-pressed={showVietnamese}>Bản dịch Việt</button>
    </div>
  </section>
)

interface PracticeProps {
  mode: Exclude<AnimeLearningMode, 'shadowing'>
  cues: AnimeSubtitleCue[]
  cue: AnimeSubtitleCue | null
  totalCues: number
  isLoading: boolean
  onChooseCue: (cue: AnimeSubtitleCue) => void
  onReplay: () => void
  pickerOpen?: boolean
  onClosePicker?: () => void
  onPause?: () => void
  videoHidden?: boolean
  onToggleVideo?: () => void
  onCompleteCue?: (cueId: number) => void
}

export const AnimeLearningPractice: React.FC<PracticeProps> = ({ mode, cues, cue, totalCues, isLoading, onChooseCue, onReplay, pickerOpen = false, onClosePicker, onPause, videoHidden = false, onToggleVideo, onCompleteCue }) => {
  const [kind, setKind] = useState<ExerciseKind>('dictation')
  const [answer, setAnswer] = useState('')
  const [checked, setChecked] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [speechText, setSpeechText] = useState('')
  const [speechError, setSpeechError] = useState<string | null>(null)
  const [roundSize, setRoundSize] = useState(1)
  const [easyMode, setEasyMode] = useState(false)
  const [hintCount, setHintCount] = useState(0)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const currentIndex = cue ? cues.findIndex((item) => item.cue_id === cue.cue_id) : -1

  useEffect(() => {
    setAnswer('')
    setChecked(false)
    setRevealed(false)
    setSpeechText('')
    setSpeechError(null)
    setHintCount(0)
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsListening(false)
  }, [cue?.cue_id, mode, kind])

  useEffect(() => () => { recognitionRef.current?.stop() }, [])

  const clozeToken = useMemo(() => cue?.tokens?.find((token) => normalizeJapaneseAnswer(token.surface).length >= 2), [cue])
  const exerciseKind = mode === 'listening' ? 'dictation' : kind
  const expected = exerciseKind === 'cloze' && clozeToken ? clozeToken.surface : cue?.ja || ''
  const correct = checked && normalizeJapaneseAnswer(answer) === normalizeJapaneseAnswer(expected)

  const startRecognition = () => {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      setSpeechError('Trình duyệt này chưa hỗ trợ nhận diện giọng nói. Bạn vẫn có thể nghe lại và luyện đọc.')
      return
    }
    try {
      recognitionRef.current?.stop()
      const recognition = new SpeechRecognition()
      recognition.lang = 'ja-JP'
      recognition.onresult = (event) => { setSpeechText(event.results[0]?.[0]?.transcript || ''); if (cue) onCompleteCue?.(cue.cue_id) }
      recognition.onerror = (event) => { setSpeechError(`Không nhận diện được giọng nói (${event.error}). Hãy kiểm tra quyền micro.`); setIsListening(false) }
      recognition.onend = () => setIsListening(false)
      recognitionRef.current = recognition
      setSpeechError(null)
      setIsListening(true)
      recognition.start()
    } catch {
      setSpeechError('Không thể mở micro. Hãy kiểm tra quyền truy cập micro của trình duyệt.')
      setIsListening(false)
    }
  }

  const nextCue = (step: number) => {
    const next = cues[currentIndex + step]
    if (next) onChooseCue(next)
  }
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (pickerOpen) {
        if (event.key === 'Escape') onClosePicker?.()
        return
      }
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, button, select, [contenteditable="true"], .anime-player-container')) return
      const previous = cues[currentIndex - 1]
      const next = cues[currentIndex + 1]
      if (event.key === 'ArrowLeft' && previous) { event.preventDefault(); onChooseCue(previous) }
      if (event.key === 'ArrowRight' && currentIndex >= 0 && next) { event.preventDefault(); onChooseCue(next) }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pickerOpen, onClosePicker, currentIndex, cues, onChooseCue])
  const checkAnswer = () => {
    setChecked(true)
    if (cue && normalizeJapaneseAnswer(answer) === normalizeJapaneseAnswer(expected)) onCompleteCue?.(cue.cue_id)
  }

  const visibleCueStart = Math.max(0, Math.floor(Math.max(currentIndex, 0) / 12) * 12)
  const visibleCues = cues.slice(visibleCueStart, visibleCueStart + 12)
  const progress = totalCues > 0 ? Math.max(0, currentIndex + 1) / totalCues * 100 : 0
  const heading = mode === 'pronunciation' ? 'Luyện phát âm' : mode === 'listening' || kind === 'dictation' ? 'Chép chính tả' : kind === 'cloze' ? 'Điền từ' : 'Luyện dịch'

  return <section className={`anime-learning-practice anime-learning-practice--${mode}`} aria-label={heading}>
    <div className="anime-learning-practice__setup">
    <div className="anime-learning-practice__heading">
      <h2>{heading}</h2>
      <span className="anime-learning-practice__count">{currentIndex >= 0 ? currentIndex + 1 : 0}/{totalCues || cues.length}</span>
    </div>
    <div className="anime-learning-practice__progress"><span style={{ width: `${progress}%` }} /></div>
    <div className="anime-learning-practice__options">
      <button type="button" onClick={onToggleVideo}><Eye size={16} /> {videoHidden ? 'Hiện video' : 'Ẩn video'}</button>
      <span>Phím tắt: <kbd>←</kbd> <kbd>→</kbd></span>
      {mode !== 'pronunciation' && <button type="button" onClick={() => setEasyMode((value) => !value)} aria-pressed={easyMode}>Easy Mode {easyMode ? 'Bật' : 'Tắt'}</button>}
    </div>
    <div className="anime-learning-practice__rounds"><span>CÂU</span><span>SỐ CÂU/LƯỢT</span>{[1, 2, 3, 4, 5].map((count) => <button type="button" key={count} aria-pressed={roundSize === count} onClick={() => setRoundSize(count)}>{count}</button>)}</div>
    <div className="anime-learning-practice__cue-strip" aria-label="Chọn câu luyện tập">
      <button type="button" onClick={() => nextCue(-1)} disabled={currentIndex <= 0} aria-label="Câu trước"><ChevronLeft size={18} /></button>
      {visibleCues.map((item, index) => <button type="button" key={item.cue_id} className={item.cue_id === cue?.cue_id ? 'is-current' : ''} aria-label={`Câu ${visibleCueStart + index + 1}`} aria-current={item.cue_id === cue?.cue_id ? 'step' : undefined} onClick={() => onChooseCue(item)}>{visibleCueStart + index + 1}</button>)}
      <button type="button" onClick={() => nextCue(1)} disabled={currentIndex < 0 || currentIndex >= cues.length - 1} aria-label="Câu tiếp"><ChevronRight size={18} /></button>
    </div>
    </div>
    {isLoading && <p className="anime-learning-practice__note" role="status">Đang tải các câu trong tập…</p>}
    {!cue ? <p className="anime-learning-practice__empty">Tập này chưa có câu phụ đề để luyện.</p> : <>
      <div className="anime-learning-practice__question">
        <div className="anime-learning-practice__question-top"><span>CÂU {currentIndex + 1}</span><button type="button" onClick={onReplay} aria-label="Nghe lại câu"><Volume2 size={19} /></button></div>
        {mode === 'pronunciation' || exerciseKind === 'translation' || revealed || easyMode ? <p className="anime-learning-practice__japanese" lang="ja">{cue.ja}</p> : exerciseKind === 'cloze' && clozeToken ? <p className="anime-learning-practice__japanese" lang="ja">{(cue.ja || '').replace(clozeToken.surface, '＿＿＿')}</p> : <p className="anime-learning-practice__hidden">Nghe câu và nhập nội dung bạn nghe được</p>}
        {(mode === 'pronunciation' || exerciseKind === 'translation' && revealed) && <p className="anime-learning-practice__translation">{cue.vi}</p>}
      </div>
      {mode === 'pronunciation' ? <div className="anime-learning-practice__answer">
        <button type="button" className="anime-learning-practice__primary" onClick={isListening ? () => recognitionRef.current?.stop() : startRecognition}><Mic size={19} /> {isListening ? 'Dừng thu' : 'Kiểm tra phát âm'}</button>
        {speechError && <p role="alert" className="anime-learning-practice__feedback">{speechError}</p>}
        {speechText && <div className="anime-learning-practice__feedback"><strong>Máy nghe được:</strong> <span lang="ja">{speechText}</span><br /><strong>Câu mẫu:</strong> <span lang="ja">{cue.ja}</span></div>}
        <div className="anime-learning-practice__scores">{['Độ chính xác', 'Độ trôi chảy', 'Độ hoàn thiện', 'Điểm trung bình'].map((label) => <div key={label}><span>—</span><small>{label}</small></div>)}</div>
        <p className="anime-learning-practice__note">Trình duyệt chỉ chép lại lời nói; chưa có hệ thống chấm phát âm.</p>
      </div> : <div className="anime-learning-practice__answer">
        <label htmlFor="anime-practice-answer">{exerciseKind === 'translation' ? 'Bản dịch của bạn' : exerciseKind === 'cloze' ? 'Từ còn thiếu' : 'Chép lại câu bạn nghe được'}</label>
        <textarea id="anime-practice-answer" lang={exerciseKind === 'translation' ? 'vi' : 'ja'} value={answer} onChange={(event) => { setAnswer(event.target.value); setChecked(false) }} placeholder={exerciseKind === 'translation' ? 'Nhập bản dịch tiếng Việt…' : 'Nhập những gì bạn nghe được…'} />
        {mode === 'listening' && (revealed || easyMode) && <p className="anime-learning-practice__japanese" lang="ja">{cue.ja}</p>}
        {exerciseKind === 'dictation' && <div className="anime-learning-practice__hint-tiles" aria-label="Gợi ý ký tự"><span>Gợi ý</span><div>{Array.from((cue.ja || '').replace(/\s/g, '').slice(0, 24)).map((character, index) => <span key={index} lang="ja">{index < hintCount || revealed ? character : '＊'}</span>)}</div></div>}
        <div className="anime-learning-practice__answer-actions">
          <button type="button" onClick={() => setHintCount((value) => Math.min((cue.ja || '').replace(/\s/g, '').length, value + 1))}><Lightbulb size={17} /> Gợi ý</button>
          <button type="button" onClick={() => setRevealed(!revealed)}><EyeOff size={17} /> {revealed ? 'Ẩn đáp án' : 'Hiện đáp án'}</button>
          {exerciseKind === 'translation' ? <button type="button" className="anime-learning-practice__primary" onClick={() => setRevealed(true)}><Languages size={17} /> Xem bản dịch tham khảo</button> : <button type="button" className="anime-learning-practice__primary" onClick={checkAnswer} disabled={!answer.trim()}><Check size={17} /> Kiểm tra</button>}
        </div>
        {checked && <p role="status" className={`anime-learning-practice__feedback ${correct ? 'is-correct' : ''}`}>{correct ? 'Chính xác!' : 'Chưa khớp đáp án. Hãy nghe lại hoặc xem câu mẫu.'}</p>}
        {exerciseKind === 'translation' && revealed && <p className="anime-learning-practice__note">Bản dịch tham khảo để tự đối chiếu; chưa tự chấm chất lượng bản dịch.</p>}
      </div>}
      <div className="anime-learning-practice__footer"><button type="button" onClick={onReplay}><RotateCcw size={18} /> Phát lại</button><button type="button" onClick={onPause}>Tạm dừng</button><button type="button" onClick={() => nextCue(roundSize)} disabled={currentIndex + roundSize >= cues.length}>Tiếp {roundSize > 1 ? `${roundSize} câu` : ''}<ChevronRight size={18} /></button></div>
    </>}
    {mode === 'exercise' && pickerOpen && <div className="anime-learning-picker" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClosePicker?.() }}><div className="anime-learning-picker__dialog" role="dialog" aria-modal="true" aria-label="Chọn chế độ học"><button type="button" className="anime-learning-picker__close" onClick={onClosePicker} aria-label="Đóng"><X size={20} /></button><h2>Chọn chế độ học</h2><p>Luyện tập với phụ đề của tập phim</p><div className="anime-learning-picker__cards">{([['dictation', 'Chép chính tả', Headphones], ['cloze', 'Điền từ', SpellCheck], ['translation', 'Luyện dịch', Languages]] as const).map(([id, label, Icon]) => <button type="button" key={id} aria-label={label} className={kind === id ? 'is-active' : ''} onClick={() => { setKind(id); onClosePicker?.() }}><Icon size={29} /><strong>{label}</strong><span>{id === 'dictation' ? 'Nghe và viết lại lời thoại' : id === 'cloze' ? 'Điền từ còn thiếu trong câu' : 'Dịch câu sang tiếng Việt'}</span><em>Chọn <ChevronRight size={16} /></em></button>)}</div></div></div>}
  </section>
}
