// @vitest-environment jsdom

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { VocabularyPage } from './VocabularyPage'
import { srsApi } from '../srs/srsApi'

vi.mock('../srs/srsApi', () => ({
  srsApi: {
    fetchCurriculumWords: vi.fn(),
    fetchUnits: vi.fn(),
    addCard: vi.fn(),
  },
}))

function renderWithClient(ui: React.ReactElement) {
  const testClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
  return render(<QueryClientProvider client={testClient}>{ui}</QueryClientProvider>)
}

describe('VocabularyPage Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(srsApi.fetchUnits).mockResolvedValue([
      { unit_number: 1, unit_title: '名詞 Ａ _ [1-100]', count: 100 },
      { unit_number: 2, unit_title: '動詞 Ａ _ [101-220]', count: 120 },
    ])

    vi.mocked(srsApi.fetchCurriculumWords).mockResolvedValue({
      items: [
        {
          id: 1,
          curriculumCode: 'mimikara_n3',
          unitNumber: 1,
          unitTitle: 'Unit 1',
          lessonTitle: 'Bài 1',
          indexNum: 1,
          word: '男性',
          reading: 'だんせい',
          hanViet: 'NAM TÍNH',
          meaning: 'nam giới, đàn ông',
          jlptLevel: 'N3',
          partOfSpeech: 'Danh từ',
          examples: [{ jp: '理想の男性と結婚する。', vi: 'Kết hôn với người đàn ông lý tưởng.' }],
          audioUrl: 'https://example.com/audio.mp3',
        },
      ],
      total: 1,
      page: 1,
      limit: 250,
      totalPages: 1,
    })
  })

  it('renders VocabularyPage catalog, selects Mimikara N3, chooses Unit 1, and tests Flashcard', async () => {
    const onGoToSrsMock = vi.fn()
    renderWithClient(<VocabularyPage onGoToSrs={onGoToSrsMock} />)

    // 1. Catalog view
    expect(screen.getByText(/Kho Giáo Trình Từ Vựng/i)).toBeTruthy()
    const mimiN3Card = screen.getByText('Mimikara Oboeru N3 (耳から覚える)')
    fireEvent.click(mimiN3Card)

    // 2. Unit selection view
    const unit1Option = await screen.findByText(/名詞 Ａ _ \[1-100\]/i)
    expect(unit1Option).toBeTruthy()
    fireEvent.click(unit1Option)

    // 3. In-Lesson Flashcard & List view
    const wordsOnScreen = await screen.findAllByText('男性')
    expect(wordsOnScreen.length).toBeGreaterThan(0)
    expect(screen.getAllByText(/nam giới, đàn ông/i).length).toBeGreaterThan(0)

    // Flip card
    const spaceTip = screen.getByText(/Nhấn \[Space\] hoặc chạm để lật xem nghĩa/i)
    fireEvent.click(spaceTip)
    expect(screen.getAllByText(/【だんせい】/i).length).toBeGreaterThan(0)

    // Add to SRS
    const srsBtn = screen.getByRole('button', { name: /\+ Thêm SRS/i })
    fireEvent.click(srsBtn)
    await waitFor(() => {
      expect(srsApi.addCard).toHaveBeenCalled()
    })

    // Click Go To SRS
    const srsDeckBtn = screen.getByText('Mở Thẻ Ôn Tập Anki')
    fireEvent.click(srsDeckBtn)
    expect(onGoToSrsMock).toHaveBeenCalled()
  })
})
