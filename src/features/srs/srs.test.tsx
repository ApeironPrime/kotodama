// @vitest-environment jsdom

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ReviewPage from './ReviewPage'
import { FlashcardStudyModal } from './FlashcardStudyModal'
import { srsApi } from './srsApi'
import type { SrsCard } from './srsTypes'

vi.mock('./srsApi', () => ({
  srsApi: {
    fetchDeck: vi.fn(),
    fetchStats: vi.fn(),
    submitReview: vi.fn(),
    addCard: vi.fn(),
  },
}))

function renderWithClient(ui: React.ReactElement) {
  const testClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={testClient}>{ui}</QueryClientProvider>)
}

describe('SRS Flashcard & Review Feature Suite', () => {
  const sampleCards: SrsCard[] = [
    {
      id: 'vocab_1',
      type: 'vocab',
      term: '学校',
      reading: 'がっこう',
      hanViet: 'HỌC HIỆU',
      meaning: 'trường học',
      jlptLevel: 'N5',
      partOfSpeech: 'Danh từ',
      masteryPercentage: 92,
      stage: 'mastered',
      repetition: 6,
      intervalDays: 14,
      easeFactor: 2.6,
      nextReviewDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'vocab_2',
      type: 'vocab',
      term: '難しい',
      reading: 'むずかしい',
      hanViet: 'NAN',
      meaning: 'khó, phức tạp',
      jlptLevel: 'N5',
      partOfSpeech: 'Tính từ',
      masteryPercentage: 72,
      stage: 'learning',
      repetition: 3,
      intervalDays: 4,
      easeFactor: 2.4,
      nextReviewDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'grammar_1',
      type: 'grammar',
      term: '〜うちに①',
      reading: 'うちに',
      hanViet: 'NHÂN LÚC',
      meaning: 'Nhân lúc, khi còn',
      jlptLevel: 'N3',
      structure: 'Vる + うちに',
      explanation: 'Tranh thủ làm việc có ý chí',
      masteryPercentage: 35,
      stage: 'due',
      repetition: 1,
      intervalDays: 0,
      easeFactor: 2.2,
      nextReviewDate: new Date(Date.now() - 3600 * 1000).toISOString(),
    },
  ]

  const sampleStats = {
    totalCards: 20,
    masteredCount: 6,
    dueTodayCount: 2,
    averageMastery: 59,
    vocabCount: 10,
    grammarCount: 6,
    kanjiCount: 4,
    streak: 5,
    longestStreak: 12,
    reviewedToday: 8,
    heatmap: [{ date: '2026-09-01', count: 8, level: 2 }],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(srsApi.fetchDeck).mockResolvedValue({
      items: sampleCards,
      total: 3,
      page: 1,
      limit: 50,
      totalPages: 1,
    })
    vi.mocked(srsApi.fetchStats).mockResolvedValue(sampleStats)
  })

  it('renders ReviewPage with 4 KPI stats cards, category tabs, and mastery progress bars', async () => {
    const onDictionaryMock = vi.fn()
    renderWithClient(<ReviewPage onDictionary={onDictionaryMock} />)

    // Verify KPI Cards
    await waitFor(() => {
      expect(screen.getByText('Đã thành thạo')).toBeTruthy()
      expect(screen.getByText('Cần ôn hôm nay')).toBeTruthy()
      expect(screen.getByText('Trung bình thành thạo')).toBeTruthy()
      expect(screen.getByText('59%')).toBeTruthy()
    })

    // Verify Flashcard Items
    await waitFor(() => {
      expect(screen.getByText('学校')).toBeTruthy()
      expect(screen.getByText('trường học')).toBeTruthy()
      expect(screen.getByText('92%')).toBeTruthy()
      expect(screen.getByText('難しい')).toBeTruthy()
      expect(screen.getByText('72%')).toBeTruthy()
    })

    // Test Search Input
    const searchInput = screen.getByPlaceholderText('Tìm kiếm từ vựng, kanji hoặc ngữ pháp...')
    fireEvent.change(searchInput, { target: { value: '学校' } })
    await waitFor(() => expect(screen.getByText('学校')).toBeTruthy())

    // Test AI Analysis Button
    const aiBtn = screen.getByText('Phân tích AI')
    fireEvent.click(aiBtn)
    expect(onDictionaryMock).toHaveBeenCalled()

    // Test Category Sub-tabs
    const grammarTab = screen.getByText(/Ngữ pháp/i)
    fireEvent.click(grammarTab)
    await waitFor(() => expect(screen.getByText('学校')).toBeTruthy())

    const kanjiTab = screen.getByText(/Kanji/i)
    fireEvent.click(kanjiTab)
    await waitFor(() => expect(screen.getByText('学校')).toBeTruthy())

    const vocabTab = screen.getByText(/Từ vựng/i)
    fireEvent.click(vocabTab)
    await waitFor(() => expect(screen.getByText('学校')).toBeTruthy())

    // Test Status Filters
    const masteredFilter = screen.getByRole('button', { name: /Thành thạo/i })
    fireEvent.click(masteredFilter)
    await waitFor(() => expect(screen.getByText('学校')).toBeTruthy())

    const dueFilter = screen.getByRole('button', { name: /Cần ôn/i })
    fireEvent.click(dueFilter)
    await waitFor(() => expect(screen.getByText('学校')).toBeTruthy())

    // Test Level Filters
    const n3Filter = screen.getByRole('button', { name: 'N3' })
    fireEvent.click(n3Filter)
    await waitFor(() => expect(screen.getByText('学校')).toBeTruthy())

    // Test View Mode Toggle (List View)
    const listBtn = screen.getByTitle('Xem dạng Danh sách')
    fireEvent.click(listBtn)
    await waitFor(() => expect(screen.getByText('学校')).toBeTruthy())

    // Test View Mode Toggle (Grid View)
    const gridBtn = screen.getByTitle('Xem dạng Lưới')
    fireEvent.click(gridBtn)
    await waitFor(() => expect(screen.getByText('学校')).toBeTruthy())

    // Test Launch Anki Study Button
    const ankiBtn = screen.getByText('Ôn tập Anki')
    fireEvent.click(ankiBtn)
    await waitFor(() => {
      expect(screen.getByText(/Thẻ 1 \//i)).toBeTruthy()
    })
  })

  it('renders empty state when no cards match', async () => {
    vi.mocked(srsApi.fetchDeck).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0,
    })
    vi.mocked(srsApi.fetchStats).mockResolvedValue({
      totalCards: 0,
      masteredCount: 0,
      dueTodayCount: 0,
      averageMastery: 0,
    })

    renderWithClient(<ReviewPage onDictionary={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Không có thẻ ôn tập nào phù hợp')).toBeTruthy()
    })
  })

  it('allows interactive 3D flip card study session and ratings in FlashcardStudyModal', async () => {
    const handleReviewMock = vi.fn().mockResolvedValue(undefined)
    const onCloseMock = vi.fn()

    render(
      <FlashcardStudyModal cards={sampleCards} initialIndex={0} onClose={onCloseMock} onReview={handleReviewMock} />
    )

    // Verify front face
    expect(screen.getByText('Thẻ 1 / 3')).toBeTruthy()
    expect(screen.getByText('Thành thạo 92%')).toBeTruthy()
    expect(screen.getByText('Lật thẻ (Space)')).toBeTruthy()

    // Flip card
    const flipButton = screen.getByText('Lật thẻ (Space)')
    fireEvent.click(flipButton)

    // Verify back face and SM-2 buttons
    expect(screen.getByText(/Ý NGHĨA:/i)).toBeTruthy()
    expect(screen.getByText('👉 trường học')).toBeTruthy()
    expect(screen.getByText(/Quên \(1\)/i)).toBeTruthy()
    expect(screen.getByText(/Tốt \(3\)/i)).toBeTruthy()

    // Click "Tốt (3)" rating
    const goodBtn = screen.getByText(/Tốt \(3\)/i)
    fireEvent.click(goodBtn)

    await waitFor(() => {
      expect(handleReviewMock).toHaveBeenCalledWith('vocab_1', 'good')
    })
  })

  it('renders multi-group grammar card with ruby furigana and 1 example per meaning in FlashcardStudyModal', async () => {
    const multiGroupGrammarCard: SrsCard = {
      id: 'grammar_mimi_5',
      type: 'grammar',
      term: '～みたいだ',
      meaning: 'Có vẻ như…/Hình như… / Cứ như là… / Như là, kiểu như…',
      jlptLevel: 'N3',
      masteryPercentage: 20,
      stage: 'learning',
      repetition: 0,
      intervalDays: 1,
      easeFactor: 2.5,
      nextReviewDate: new Date().toISOString(),
      groups: [
        {
          group_no: 1,
          meaning: 'Có vẻ như…/Hình như…',
          structure: 'N＋みたいだ／V普通形＋みたいだ',
          usage: 'Diễn tả phán đoán dựa trên dấu hiệu nhưng chưa chắc chắn',
          examples: [
            {
              no: 1,
              jp: '星がたくさん出ている。あしたも晴れみたい',
              jp_ruby: '<ruby>星<rt>ほし</rt></ruby>がたくさん<ruby>出<rt>で</rt></ruby>ている。',
              vi: 'Trời có nhiều sao. Có vẻ mai cũng sẽ nắng.',
            },
          ],
        },
        {
          group_no: 2,
          meaning: 'Cứ như là…',
          structure: 'N／V普通形＋みたいだ',
          usage: 'Diễn tả cảm giác cứ như là...',
          examples: [
            {
              no: 1,
              jp: '夢みたいだ。',
              jp_ruby: '<ruby>夢<rt>ゆめ</rt></ruby>みたいだ。',
              vi: 'Cứ như đang mơ vậy.',
            },
          ],
        },
      ],
    }

    render(
      <FlashcardStudyModal
        cards={[multiGroupGrammarCard]}
        initialIndex={0}
        onClose={vi.fn()}
        onReview={vi.fn().mockResolvedValue(undefined)}
      />
    )

    // Verify Front Side shows multi-group badge
    expect(screen.getByText(/Gồm 2 nghĩa & cách dùng/i)).toBeTruthy()

    // Flip card
    fireEvent.click(screen.getByText('Lật thẻ (Space)'))

    // Verify Back Side renders both groups
    expect(screen.getByText('Nghĩa 1')).toBeTruthy()
    expect(screen.getByText('👉 Có vẻ như…/Hình như…')).toBeTruthy()
    expect(screen.getByText('Trời có nhiều sao. Có vẻ mai cũng sẽ nắng.')).toBeTruthy()

    expect(screen.getByText('Nghĩa 2')).toBeTruthy()
    expect(screen.getByText('👉 Cứ như là…')).toBeTruthy()
    expect(screen.getByText('Cứ như đang mơ vậy.')).toBeTruthy()

    // Verify audio speak buttons exist
    const speakButtons = screen.getAllByTitle(/Nghe phát âm/i)
    expect(speakButtons.length).toBeGreaterThanOrEqual(2)
  })
})
