import { useMemo } from 'react'
import {
  BookOpenCheck,
  Check,
  ChevronRight,
  Layers3,
  Link2,
  MessageCircleMore,
  Volume2,
} from 'lucide-react'
import type { DictionaryWordItem } from '../../lib/apiClient'
import { sumiAudio } from './sumiAudio'

type Conjugation = { label: string; value: string }

const CIRCLED_NUMBERS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']

function conjugations(word: DictionaryWordItem): Conjugation[] {
  const pos = word.partOfSpeech || ''
  if (!/^v[15]/i.test(pos) || !word.word) return []
  if (/^v1/i.test(pos) && word.word.endsWith('る')) {
    const stem = word.word.slice(0, -1)
    return [
      { label: 'Từ điển', value: word.word }, { label: 'Lịch sự (ます)', value: `${stem}ます` },
      { label: 'Phủ định (ない)', value: `${stem}ない` }, { label: 'Thể て', value: `${stem}て` },
      { label: 'Quá khứ (た)', value: `${stem}た` }, { label: 'Khả năng', value: `${stem}られる` },
      { label: 'Điều kiện (ば)', value: `${stem}れば` }, { label: 'Ý chí', value: `${stem}よう` },
    ]
  }
  const tail = word.word.at(-1) || ''
  const stem = word.word.slice(0, -1)
  const changes: Record<string, [string, string, string, string, string]> = {
    う: ['い', 'わ', 'って', 'った', 'える'], つ: ['ち', 'た', 'って', 'った', 'てる'], る: ['り', 'ら', 'って', 'った', 'れる'],
    む: ['み', 'ま', 'んで', 'んだ', 'める'], ぶ: ['び', 'ば', 'んで', 'んだ', 'べる'], ぬ: ['に', 'な', 'んで', 'んだ', 'ねる'],
    く: ['き', 'か', 'いて', 'いた', 'ける'], ぐ: ['ぎ', 'が', 'いで', 'いだ', 'げる'], す: ['し', 'さ', 'して', 'した', 'せる'],
  }
  const ending = changes[tail]
  if (!ending) return []
  const [masu, nai, te, ta, conditional] = ending
  return [
    { label: 'Từ điển', value: word.word }, { label: 'Lịch sự (ます)', value: `${stem}${masu}ます` },
    { label: 'Phủ định (ない)', value: `${stem}${nai}ない` }, { label: 'Thể て', value: `${stem}${te}` },
    { label: 'Quá khứ (た)', value: `${stem}${ta}` }, { label: 'Điều kiện (ば)', value: `${stem}${conditional}ば` },
  ]
}

function wordTypeLabel(pos?: string | null) {
  if (!pos) return null
  const labels: string[] = []
  if (/\bv1\b/i.test(pos)) labels.push('Động từ nhóm 2')
  if (/\bv5/i.test(pos)) labels.push('Động từ nhóm 1')
  if (/\bvs\b/i.test(pos)) labels.push('Động từ bất quy tắc')
  if (/\bvt\b/i.test(pos)) labels.push('Ngoại động từ')
  if (/\bvi\b/i.test(pos)) labels.push('Nội động từ')
  return labels.join(' · ') || pos
}

function cleanReadingTokens(value?: string | null) {
  return String(value || '')
    .split(/[\s、,;/・]+/)
    .map((item) => item.trim())
    .filter((item, index, list) => item && list.indexOf(item) === index)
}

export function DictionaryWordDetail({
  word,
  results,
  isSaved,
  onSave,
  onSpeak,
  onSearch,
}: {
  word: DictionaryWordItem
  results: DictionaryWordItem[]
  isSaved: boolean
  onSave: () => void
  onSpeak: (text: string) => void
  onSearch: (word: string) => void
}) {
  const forms = useMemo(() => conjugations(word), [word])
  const readings = useMemo(() => {
    const fromApi = [word.reading || '', ...(word.readingVariants || [])]
    return fromApi.flatMap(cleanReadingTokens).filter((item, index, list) => list.indexOf(item) === index).slice(0, 8)
  }, [word.reading, word.readingVariants])
  const primaryReading = readings[0] || '—'
  const readingVariants = readings.slice(1)
  const romaji = (word.romaji || '').split(/\s+/)[0] || null
  const related = useMemo(() => {
    const merged = [...(word.relatedWords || []), ...results.slice(1).map((item) => ({ word: item.word, reading: item.reading || undefined, meaning: item.meanings[0] }))]
    return merged.filter((item, index, list) => item.word !== word.word && list.findIndex((candidate) => candidate.word === item.word) === index).slice(0, 6)
  }, [results, word])
  const type = wordTypeLabel(word.partOfSpeech)

  return (
    <div className="dictionary-word-detail">
      <header className="dictionary-word-detail__hero">
        <div>
          <h1>{word.word}</h1>
          <div className="dictionary-word-detail__meta-line">
            <span className="dictionary-word-detail__primary-reading">{primaryReading}</span>
            {romaji && <span className="dictionary-word-detail__romaji">({romaji})</span>}
            {word.hanViet && (
              <span className="dictionary-hanviet-seal">
                <span className="dictionary-hanviet-seal__mark">漢</span>
                {word.hanViet}
              </span>
            )}
            {word.jlpt && <span className="dictionary-jlpt-tag">JLPT {word.jlpt}</span>}
            {type && <span className="dictionary-pos-tag">{type}</span>}
          </div>
        </div>

        <div className="dictionary-word-detail__actions">
          <button
            type="button"
            className="dictionary-listen-btn"
            onClick={() => onSpeak(word.word || word.reading || '')}
            aria-label={`Nghe phát âm ${word.word}`}
            title="Nghe phát âm chuẩn"
          >
            <Volume2 size={18} />
          </button>
          <button
            type="button"
            className={`dictionary-hanko-action-btn ${isSaved ? 'is-saved' : ''}`}
            onClick={() => {
              try {
                sumiAudio.playHankoStamp()
              } catch {
                // ignore
              }
              onSave()
            }}
            aria-label={isSaved ? 'Đã lưu vào bộ thẻ SRS' : 'Lưu từ vào bộ thẻ SRS'}
          >
            <span className="dictionary-hanko-action-btn__seal" aria-hidden="true">
              {isSaved ? '印' : '蔵'}
            </span>
            <span>{isSaved ? 'Đã dập dấu ôn tập' : 'Lưu vào bộ thẻ'}</span>
            {isSaved && <Check size={14} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <div className="dictionary-word-detail__content">
        <section className="dictionary-word-section">
          <h2><BookOpenCheck size={18} /> Tổng quan</h2>
          <div className="dictionary-definitions-list">
            {word.meanings.length > 0 ? (
              word.meanings.map((meaning, idx) => (
                <div key={idx} className="dictionary-definition-item">
                  <span className="dictionary-definition-num" aria-hidden="true">
                    {CIRCLED_NUMBERS[idx] || `${idx + 1}.`}
                  </span>
                  <span className="dictionary-definition-text">{meaning}</span>
                </div>
              ))
            ) : (
              <div className="dictionary-definition-item">
                <span className="dictionary-definition-text">Chưa có nghĩa tiếng Việt.</span>
              </div>
            )}
          </div>

          {readingVariants.length > 0 && (
            <div className="dictionary-reading-variants-row">
              <span className="dictionary-reading-variants-label">Cách đọc khác:</span>
              {readingVariants.map((reading) => (
                <button
                  type="button"
                  key={reading}
                  className="dictionary-reading-variant-chip"
                  onClick={() => onSpeak(word.word || reading)}
                  title={`Nghe cách đọc ${reading}`}
                >
                  {reading}
                </button>
              ))}
            </div>
          )}
        </section>

        {forms.length > 0 && (
          <section className="dictionary-word-section">
            <h2><Layers3 size={18} /> Chia động từ</h2>
            <div className="dictionary-conjugation">
              {forms.map((form) => (
                <div key={form.label} className="dictionary-conjugation-item">
                  <span>{form.label}</span>
                  <strong>{form.value}</strong>
                </div>
              ))}
            </div>
          </section>
        )}

        {word.kanjis.length > 0 && (
          <section className="dictionary-word-section">
            <h2><span className="dictionary-kanji-heading">漢</span> Phân tích Kanji</h2>
            <div className="dictionary-kanji-grid">
              {word.kanjis.map((kanji) => (
                <article key={kanji.character} className="dictionary-kanji-card">
                  <strong>{kanji.character}</strong>
                  <div className="dictionary-kanji-card__details">
                    <div className="dictionary-kanji-card__row">
                      <span>Âm On:</span>
                      <b>{kanji.onyomi || '—'}</b>
                    </div>
                    <div className="dictionary-kanji-card__row">
                      <span>Âm Kun:</span>
                      <b>{kanji.kunyomi || '—'}</b>
                    </div>
                    <div className="dictionary-kanji-card__row">
                      <span>Số nét:</span>
                      <b>{kanji.strokeCount || '—'}</b>
                    </div>
                    {kanji.jlpt && (
                      <div className="dictionary-kanji-card__row">
                        <span>JLPT:</span>
                        <b>{kanji.jlpt}</b>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {word.examples && word.examples.length > 0 && (
          <section className="dictionary-word-section">
            <h2><MessageCircleMore size={18} /> Câu ví dụ</h2>
            <div className="dictionary-examples">
              {word.examples.map((example, index) => (
                <article key={`${example.sentenceJp}-${index}`} className="dictionary-example-item">
                  <div className="dictionary-example-body">
                    <div className="dictionary-example-jp">
                      {example.sentenceJp}
                    </div>
                    {example.furigana && (
                      <small style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', fontFamily: 'var(--font-jp)' }}>
                        {example.furigana}
                      </small>
                    )}
                    {example.sentenceVi && (
                      <div className="dictionary-example-vi">
                        <strong>VI</strong> {example.sentenceVi}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="dictionary-example-audio-btn"
                    onClick={() => onSpeak(example.sentenceJp)}
                    aria-label="Nghe câu ví dụ"
                    title="Nghe phát âm câu ví dụ"
                  >
                    <Volume2 size={16} />
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        {related.length > 0 && (
          <section className="dictionary-word-section">
            <h2><Link2 size={18} /> Từ tương ứng</h2>
            <div className="dictionary-related-grid">
              {related.map((item) => (
                <button
                  type="button"
                  key={item.word}
                  className="dictionary-related-card"
                  onClick={() => onSearch(item.word)}
                >
                  <div>
                    <strong>{item.word}</strong>
                    {item.reading && <small>{cleanReadingTokens(item.reading)[0] || item.reading}</small>}
                    <p>{item.meaning || 'Xem nghĩa chi tiết'}</p>
                  </div>
                  <ChevronRight size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
