// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StarOrderQuestion } from './StarOrderQuestion'

const options = ['1.顔を', '2.何か', '3.言いたそうな', '4.しているのを']

describe('StarOrderQuestion', () => {
  it('assembles pieces in click order and records the piece in the starred slot', () => {
    const onAnswer = vi.fn()
    render(<StarOrderQuestion before="私は、息子が" after="見て、声をかけた。" options={options} onAnswer={onAnswer} />)

    for (const number of [2, 3, 1, 4]) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Mảnh ${number}:`) }))
    }
    expect(onAnswer).toHaveBeenLastCalledWith(1)
    expect(screen.getByRole('button', { name: /Ô 3 dấu sao: 顔を/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Ô 4: しているのを/ })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Ô 2: 言いたそうな/ }))
    expect(onAnswer).toHaveBeenLastCalledWith(null)
    expect(screen.getByRole('button', { name: /Ô 3 dấu sao: chưa chọn/ })).toBeTruthy()
  })

  it('uses the source-marked slot when ★ is not the third piece', () => {
    const onAnswer = vi.fn()
    render(
      <StarOrderQuestion
        before="英語の得意な友達が"
        after="した。"
        options={['1.ことに', '2.やっていた', '3.ように', '4.何度も書いてみる']}
        starPosition={1}
        onAnswer={onAnswer}
      />
    )
    for (const number of [2, 3, 4, 1]) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Mảnh ${number}:`) }))
    }
    expect(onAnswer).toHaveBeenLastCalledWith(3)
    expect(screen.getByRole('button', { name: /Ô 2 dấu sao: ように/ })).toBeTruthy()
  })

  it('strips full-width source numbering from choices', () => {
    render(
      <StarOrderQuestion
        before="この喫茶店はコーヒー"
        after="おいしい。"
        options={['１．などの', '２．スパゲッティ', '３．料理も', '４．だけでなく']}
        onAnswer={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Mảnh 1: などの' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mảnh 4: だけでなく' })).toBeTruthy()
  })

  it('shows the complete reviewed sentence after submission', () => {
    render(
      <StarOrderQuestion
        before="私は、息子が"
        after="見て、声をかけた。"
        options={options}
        selectedAnswer={1}
        correctOrder={[2, 3, 1, 4]}
        disabled
        onAnswer={vi.fn()}
      />
    )

    const solution = screen.getByText('Câu đúng:').parentElement?.textContent
    expect(solution).toContain('何か')
    expect(solution).toContain('★顔を')
    expect(solution).not.toContain('★顔を★')
    expect(solution?.match(/★/gu)).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Mảnh 2:/ }).hasAttribute('disabled')).toBe(true)
  })

  it('restores the assembled sentence for the same saved attempt', () => {
    const storageKey = 'jlpt-star-order:test-attempt:q49'
    window.localStorage.removeItem(storageKey)
    const first = render(
      <StarOrderQuestion
        before="私は、息子が"
        after="見て"
        options={options}
        storageKey={storageKey}
        onAnswer={vi.fn()}
      />
    )
    for (const number of [2, 3, 1, 4]) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Mảnh ${number}:`) }))
    }
    first.unmount()

    render(
      <StarOrderQuestion
        before="私は、息子が"
        after="見て"
        options={options}
        storageKey={storageKey}
        selectedAnswer={1}
        onAnswer={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /Ô 3 dấu sao: 顔を/ })).toBeTruthy()
    window.localStorage.removeItem(storageKey)
  })
})
