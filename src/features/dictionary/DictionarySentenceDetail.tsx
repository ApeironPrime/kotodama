import { BookOpenCheck, ChevronRight, CircleAlert, Languages, Volume2 } from 'lucide-react'
import { Card } from '../../components/ui'
import type { DictionarySentenceAnalysis } from '../../lib/apiClient'

export function DictionarySentenceDetail({
  analysis,
  onSpeak,
  onSearch,
}: {
  analysis: DictionarySentenceAnalysis
  onSpeak: (text: string) => void
  onSearch: (word: string) => void
}) {
  return (
    <div className="dictionary-sentence-detail">
      <header className="dictionary-word-detail__hero dictionary-sentence-detail__hero">
        <div>
          <span>TRA CÂU</span>
          <h1>{analysis.input}</h1>
          {analysis.reading && <p>{analysis.reading}</p>}
        </div>
        <button
          type="button"
          className="dictionary-word-detail__listen"
          onClick={() => onSpeak(analysis.input)}
          aria-label="Nghe cả câu"
        >
          <Volume2 size={18} />
        </button>
      </header>

      <Card className="dictionary-word-section" padding="lg">
        <h2><BookOpenCheck size={18} /> Nghĩa của câu</h2>
        {analysis.translation ? (
          <p className="dictionary-sentence-detail__translation">{analysis.translation}</p>
        ) : (
          <p className="dictionary-sentence-detail__pending">Kho từ điển chưa có bản dịch nguyên câu này. Các thành phần đã nhận diện ở bên dưới để bạn tra nghĩa trong ngữ cảnh.</p>
        )}
      </Card>

      <Card className="dictionary-word-section" padding="lg">
        <h2><Languages size={18} /> Thành phần trong câu</h2>
        <p className="dictionary-word-section__hint">Bấm vào một mục để mở nghĩa chi tiết của từ đó.</p>
        <div className="dictionary-sentence-detail__tokens">
          {analysis.results.map((item) => (
            <button type="button" key={`${item.id}-${item.word}`} onClick={() => onSearch(item.word)}>
              <strong>{item.word}</strong>
              {item.reading && <small>{item.reading}</small>}
              <span>{item.meanings[0] || 'Xem nghĩa'}</span>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
      </Card>

      {(analysis.suggestions.length > 0 || analysis.grammarHints.length > 0) && (
        <Card className="dictionary-word-section dictionary-sentence-detail__alerts" padding="lg">
          <h2><CircleAlert size={18} /> Gợi ý kiểm tra</h2>
          {analysis.suggestions.map((item) => (
            <button type="button" key={`${item.input}-${item.suggestion}`} onClick={() => onSearch(item.suggestion)}>
              Có phải bạn muốn tra <b>{item.suggestion}</b>{item.reading ? ` (${item.reading})` : ''} thay cho “{item.input}”?
            </button>
          ))}
          {analysis.grammarHints.map((hint) => <p key={hint}>{hint}</p>)}
        </Card>
      )}
    </div>
  )
}
