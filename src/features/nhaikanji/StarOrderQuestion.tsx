import { useState } from 'react'
import type { JlptOption } from './nhaikanjiTypes'

type StarOrderQuestionProps = {
  before: string
  after: string
  options: Array<JlptOption | string>
  selectedAnswer?: number | undefined
  correctOrder?: number[] | undefined
  starPosition?: number | null | undefined
  storageKey?: string | undefined
  disabled?: boolean
  onAnswer: (answer: number | null) => void
}

function optionText(option: JlptOption | string | undefined) {
  if (!option) return ''
  return typeof option === 'string' ? option.replace(/^\s*[1-4１-４][.．、\s　]*/u, '').trim() : option.text
}

export function StarOrderQuestion({
  before,
  after,
  options,
  selectedAnswer,
  correctOrder,
  starPosition = 2,
  storageKey,
  disabled = false,
  onAnswer,
}: StarOrderQuestionProps) {
  const answerPosition =
    typeof starPosition === 'number' &&
    Number.isInteger(starPosition) &&
    starPosition >= 0 &&
    starPosition < options.length
      ? starPosition
      : 2
  const [order, setOrder] = useState<number[]>(() => {
    if (!storageKey || typeof window === 'undefined') return []
    try {
      const stored: unknown = JSON.parse(window.localStorage.getItem(storageKey) || '[]')
      if (!Array.isArray(stored) || stored.length > options.length) return []
      if (!stored.every((number) => Number.isInteger(number) && number >= 1 && number <= options.length)) return []
      if (new Set(stored).size !== stored.length) return []
      if ((stored[answerPosition] ?? null) !== (selectedAnswer ?? null)) return []
      return stored as number[]
    } catch {
      return []
    }
  })

  const updateOrder = (next: number[]) => {
    setOrder(next)
    if (storageKey && typeof window !== 'undefined') {
      try {
        if (next.length) window.localStorage.setItem(storageKey, JSON.stringify(next))
        else window.localStorage.removeItem(storageKey)
      } catch {
        // Answer saving remains available when browser storage is disabled.
      }
    }
    onAnswer(next[answerPosition] ?? null)
  }

  const selectPiece = (number: number) => {
    if (disabled || order.includes(number) || order.length >= options.length) return
    updateOrder([...order, number])
  }

  const removeFrom = (index: number) => {
    if (disabled) return
    updateOrder(order.slice(0, index))
  }

  return (
    <div className="jlpt-star-order" role="group" aria-label="Ghép câu dấu sao">
      <p className="jlpt-star-instruction">Bấm bốn mảnh theo thứ tự tạo thành câu. Mảnh ở ô ★ là đáp án được chấm.</p>
      <div className="jlpt-star-sentence" aria-live="polite">
        <span>{before}</span>
        {options.map((_, index) => {
          const picked = order[index]
          return (
            <button
              key={index}
              type="button"
              className={`jlpt-star-slot${index === answerPosition ? ' is-star' : ''}${picked ? ' is-filled' : ''}`}
              onClick={() => removeFrom(index)}
              disabled={disabled || !picked}
              aria-label={`Ô ${index + 1}${index === answerPosition ? ' dấu sao' : ''}: ${picked ? optionText(options[picked - 1]) : 'chưa chọn'}`}
              title={picked && !disabled ? 'Bấm để sửa từ ô này' : undefined}
            >
              {index === answerPosition && <span className="jlpt-star-mark">★</span>}
              <span>{picked ? optionText(options[picked - 1]) : '＿＿＿'}</span>
            </button>
          )
        })}
        <span>{after}</span>
      </div>
      <div className="jlpt-star-options">
        {options.map((option, index) => {
          const number = index + 1
          const position = order.indexOf(number)
          return (
            <button
              key={number}
              type="button"
              className={`jlpt-star-choice${position >= 0 ? ' is-used' : ''}${selectedAnswer === number ? ' is-answer' : ''}`}
              disabled={disabled || position >= 0 || order.length >= options.length}
              onClick={() => selectPiece(number)}
              aria-label={`Mảnh ${number}: ${optionText(option)}`}
            >
              <span className="jlpt-star-choice-number">{number}</span>
              <span>{optionText(option)}</span>
              {position >= 0 && <span className="jlpt-star-choice-position">#{position + 1}</span>}
            </button>
          )
        })}
      </div>
      {!disabled && order.length > 0 && (
        <button type="button" className="jlpt-star-reset" onClick={() => updateOrder([])}>
          Làm lại thứ tự
        </button>
      )}
      {selectedAnswer && order.length === 0 && !disabled && (
        <p className="jlpt-star-saved">Đáp án ô ★ đã lưu: mảnh {selectedAnswer}. Bấm các mảnh để ghép lại cả câu.</p>
      )}
      {disabled && correctOrder?.length === options.length && (
        <p className="jlpt-star-solution">
          <strong>Câu đúng:</strong> {before}{' '}
          {correctOrder.map((number, index) => (
            <span key={`${index}-${number}`}>
              {index === answerPosition ? (
                <strong>★{optionText(options[number - 1])}</strong>
              ) : (
                optionText(options[number - 1])
              )}{' '}
            </span>
          ))}
          {after}
        </p>
      )}
    </div>
  )
}
