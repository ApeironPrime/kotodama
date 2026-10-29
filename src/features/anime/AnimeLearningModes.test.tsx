// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AnimeLearningPractice } from './AnimeLearningModes'
import type { AnimeSubtitleCue } from './animePlaybackTypes'

const cues: [AnimeSubtitleCue, AnimeSubtitleCue] = [
  {
    cue_id: 1,
    start: 2,
    end: 5,
    ja: '授業の前に予習をします。',
    vi: 'Tôi chuẩn bị bài trước giờ học.',
    tokens: [{ token_ordinal: 1, surface: '予習', char_start: 5, char_end: 7, word_id: null }],
  },
  { cue_id: 2, start: 6, end: 9, ja: '日本語を勉強します。', vi: 'Tôi học tiếng Nhật.' },
]

const baseProps = {
  cues,
  cue: cues[0],
  totalCues: 2,
  isLoading: false,
  onChooseCue: vi.fn(),
  onReplay: vi.fn(),
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Anime learning practice', () => {
  it('hides the Japanese answer for listening and checks normalized transcription', () => {
    render(<AnimeLearningPractice {...baseProps} mode="listening" />)
    expect(screen.queryByText(cues[0].ja || '')).toBeNull()
    fireEvent.change(screen.getByLabelText('Chép lại câu bạn nghe được'), { target: { value: '授業の前に予習をします' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra' }))
    expect(screen.getByRole('status').textContent).toContain('Chính xác!')
    fireEvent.click(screen.getByRole('button', { name: 'Câu tiếp' }))
    expect(baseProps.onChooseCue).toHaveBeenCalledWith(cues[1])
  })

  it('makes a real cloze from a vocabulary token and checks only the missing term', () => {
    render(<AnimeLearningPractice {...baseProps} mode="exercise" pickerOpen />)
    fireEvent.click(screen.getByRole('button', { name: 'Điền từ' }))
    expect(screen.getByText('授業の前に＿＿＿をします。')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Từ còn thiếu'), { target: { value: '予習' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra' }))
    expect(screen.getByRole('status').textContent).toContain('Chính xác!')
  })

  it('shows translation for self-comparison without claiming automatic grading', () => {
    render(<AnimeLearningPractice {...baseProps} mode="exercise" pickerOpen />)
    fireEvent.click(screen.getByRole('button', { name: 'Luyện dịch' }))
    expect(screen.queryByText(cues[0].vi || '')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Xem bản dịch tham khảo' }))
    expect(screen.getByText(cues[0].vi || '')).toBeTruthy()
    expect(screen.getByText(/chưa tự chấm chất lượng bản dịch/)).toBeTruthy()
  })

  it('explains unavailable speech recognition instead of displaying a fake score', () => {
    render(<AnimeLearningPractice {...baseProps} mode="pronunciation" />)
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra phát âm' }))
    expect(screen.getByRole('alert').textContent).toContain('chưa hỗ trợ nhận diện giọng nói')
    expect(screen.queryByText(/điểm phát âm:/i)).toBeNull()
  })

  it('opens the exercise picker and wires video visibility and completion controls', () => {
    const onToggleVideo = vi.fn()
    const onCompleteCue = vi.fn()
    render(<AnimeLearningPractice {...baseProps} mode="exercise" pickerOpen onToggleVideo={onToggleVideo} onCompleteCue={onCompleteCue} />)
    expect(screen.getByRole('dialog', { name: 'Chọn chế độ học' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Chép chính tả' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn video' }))
    expect(onToggleVideo).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByLabelText('Chép lại câu bạn nghe được'), { target: { value: '授業の前に予習をします。' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra' }))
    expect(onCompleteCue).toHaveBeenCalledWith(1)
  })
})
