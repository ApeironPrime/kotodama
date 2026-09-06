import { useMemo } from 'react'
import {
  BookOpenCheck,
  BookmarkPlus,
  Check,
  ChevronRight,
  Layers3,
  Link2,
  MessageCircleMore,
  Sparkles,
  Volume2,
} from 'lucide-react'
import { Badge, Button, Card } from '../../components/ui'
import type { DictionaryWordItem } from '../../lib/apiClient'

type Conjugation = { label: string; value: string }

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
          <p>{word.reading || '—'}{word.romaji ? ` · ${word.romaji}` : ''}</p>
          <div className="dictionary-word-detail__badges">
            {word.jlpt && <Badge variant="danger">JLPT {word.jlpt}</Badge>}
            {type && <Badge variant="primary">{type}</Badge>}
            {word.hanViet && <Badge variant="secondary">Hán Việt: {word.hanViet}</Badge>}
          </div>
        </div>
        <div className="dictionary-word-detail__actions">
          <button type="button" className="dictionary-word-detail__listen" onClick={() => onSpeak(word.word || word.reading || '')} aria-label={`Nghe ${word.word}`}><Volume2 size={18} /></button>
          <Button variant={isSaved ? 'secondary' : 'primary'} onClick={onSave}>{isSaved ? <><Check size={17} /> Đã thêm vào SRS</> : <><BookmarkPlus size={17} /> Thêm vào bộ thẻ</>}</Button>
        </div>
      </header>

      <section className="dictionary-word-detail__layout">
        <div className="dictionary-word-detail__content">
          <Card className="dictionary-word-section" padding="lg">
            <h2><BookOpenCheck size={18} /> Tổng quan</h2>
            <div className="dictionary-overview">
              <div className="dictionary-overview__word"><strong>{word.word}</strong><dl><div><dt>Furigana</dt><dd>{word.reading || '—'}</dd></div>{word.romaji && <div><dt>Romaji</dt><dd>{word.romaji}</dd></div>}<div><dt>Từ loại</dt><dd>{type || 'Chưa phân loại'}</dd></div></dl></div>
              <div className="dictionary-overview__meanings"><div><span>VI TIẾNG VIỆT</span><strong>{word.meanings.join('; ') || 'Chưa có nghĩa tiếng Việt.'}</strong></div><aside><Sparkles size={16} /><p>Dữ liệu nghĩa, cách đọc và ví dụ được lấy từ kho từ điển gốc. Lưu từ vào SRS để ôn lại sau.</p></aside></div>
            </div>
          </Card>

          {forms.length > 0 && <Card className="dictionary-word-section" padding="lg"><h2><Layers3 size={18} /> Chia động từ</h2><div className="dictionary-conjugation"><div className="dictionary-conjugation__head"><span>Thể</span><span>Tiếng Nhật</span></div>{forms.map((form) => <div key={form.label}><span>{form.label}</span><strong>{form.value}</strong></div>)}</div></Card>}

          {word.examples && word.examples.length > 0 && <Card className="dictionary-word-section" padding="lg"><h2><MessageCircleMore size={18} /> Câu ví dụ</h2><div className="dictionary-examples">{word.examples.map((example, index) => <article key={`${example.sentenceJp}-${index}`}><div><span>Ví dụ {index + 1}</span><strong>{example.sentenceJp}</strong>{example.furigana && <small>{example.furigana}</small>}{example.sentenceVi && <p><b>VI</b> {example.sentenceVi}</p>}</div><button type="button" onClick={() => onSpeak(example.sentenceJp)} aria-label="Nghe câu ví dụ"><Volume2 size={16} /></button></article>)}</div></Card>}

          {related.length > 0 && <Card className="dictionary-word-section" padding="lg"><h2><Link2 size={18} /> Từ tương tự</h2><div className="dictionary-related-grid">{related.map((item) => <button type="button" key={item.word} onClick={() => onSearch(item.word)}><strong>{item.word}</strong>{item.reading && <small>{item.reading}</small>}<span>{item.meaning || 'Xem nghĩa chi tiết'}</span><ChevronRight size={16} /></button>)}</div></Card>}

          {word.kanjis.length > 0 && <Card className="dictionary-word-section" padding="lg"><h2><span className="dictionary-kanji-heading">漢</span> Phân tích Kanji</h2><div className="dictionary-kanji-grid">{word.kanjis.map((kanji) => <article key={kanji.character}><strong>{kanji.character}</strong><div><span>Âm On</span><b>{kanji.onyomi || '—'}</b></div><div><span>Âm Kun</span><b>{kanji.kunyomi || '—'}</b></div><div><span>Số nét</span><b>{kanji.strokeCount || '—'}</b></div><div><span>JLPT</span><b>{kanji.jlpt || '—'}</b></div></article>)}</div></Card>}
        </div>
      </section>
    </div>
  )
}
