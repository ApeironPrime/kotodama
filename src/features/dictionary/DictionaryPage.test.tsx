// @vitest-environment jsdom

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DictionaryPage from './DictionaryPage'
import { nhaikanjiApi } from '../nhaikanji/nhaikanjiApi'
import { requestApi } from '../../lib/apiClient'

vi.mock('../../lib/apiClient', () => ({
  apiPaths: {
    dictionary: {
      search: (q: string, limit?: number) =>
        `/api/v1/dictionary/search?keyword=${encodeURIComponent(q)}&limit=${limit || 20}`,
      analyze: (text: string) => `/api/v1/dictionary/analyze?text=${encodeURIComponent(text)}`,
      wordDetail: (w: string) => `/api/v1/dictionary/word/${encodeURIComponent(w)}`,
    },
    nhaikanji: {
      kanjiList: (l: string, q: string, p: number, lim: number) =>
        `/api/v1/nhaikanji/kanji?level=${l}&q=${q}&page=${p}&limit=${lim}`,
      kanjiDetail: (c: string) => `/api/v1/nhaikanji/kanji/${encodeURIComponent(c)}`,
      bunpoList: (l: string, b: string, q: string, p: number, lim: number) =>
        `/api/v1/nhaikanji/bunpo?level=${l}&bookId=${b}&q=${q}&page=${p}&limit=${lim}`,
    },
  },
  requestApi: vi.fn(),
}))

vi.mock('../nhaikanji/nhaikanjiApi', () => ({
  nhaikanjiApi: {
    fetchKanjiList: vi.fn(),
    fetchKanjiDetail: vi.fn(),
    fetchBunpoList: vi.fn(),
  },
}))

function renderWithClient(ui: React.ReactElement) {
  const testClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={testClient}>{ui}</QueryClientProvider>)
}

describe('DictionaryPage Feature Suite', () => {
  const sampleSearchResult = {
    results: [
      {
        id: 1,
        word: '間',
        reading: 'あいだ',
        hanViet: 'GIAN',
        jlpt: 'N4',
        partOfSpeech: 'Danh từ',
        meanings: ['ở giữa, khoảng cách, khoảng thời gian'],
        examples: [
          {
            sentenceJp: '長い間さがしていた本が見つかった。',
            sentenceVi: 'Tôi đã tìm thấy cuốn sách mà tôi tìm kiếm suốt bấy lâu.',
          },
        ],
        kanjis: [
          {
            character: '間',
            hanViet: 'GIAN',
            jlpt: 'N5',
            strokeCount: 12,
            onyomi: 'カン、ケン',
            kunyomi: 'あいだ、ま',
            meaning: 'Khoảng cách, khoảng thời gian',
          },
        ],
        relatedWords: [
          {
            word: '間々',
            reading: 'まま',
            meaning: 'thỉnh thoảng',
          },
        ],
      },
    ],
    count: 1,
  }

  const sampleNhaiKanjiDetail = {
    kanji: '間',
    summary: {
      kanji: '間',
      hanzi: 'GIAN',
      meaning_vi: 'Khoảng, thời gian',
      meaning_en: 'interval, space',
      jlpt_level: 'N5',
      onyomi: 'カン、ケン',
      kunyomi: 'あいだ、ま',
      stroke_count: 12,
      radical_utf: '⾨',
      radical_name_ja: 'もんがまえ',
      radical_meaning: 'gate, door',
      story: 'Cổng (門) ở Nhật (日) là cánh cổng thời gian (間)',
      num_vocab_examples: 1,
    },
    detail: {
      kanji: '間',
      kanjiInfo: {
        id: '間',
        hanzi: 'GIAN',
        meaning: 'Khoảng, thời gian',
        story: 'Cổng (門) ở Nhật (日) là cánh cổng thời gian (間)',
        jlptLevel: 'N5',
        kanjialiveData: {
          rad_name_ja: 'もんがまえ',
          onyomi_ja: 'カン、ケン',
          kunyomi_ja: 'あいだ、ま',
          rad_utf: '⾨',
          rad_meaning: 'gate, door',
          examples: [
            {
              id: 18739,
              word: '何時間',
              reading: 'なんじかん',
              meaning: 'Bao nhiêu tiếng',
              yinHan: 'HÀ THỜI GIAN',
              audio: 'https://example.com/audio.mp3',
              example: '何時間ねましたか。',
              readingExample: 'なんじかんねましたか。',
              exampleVi: 'Bạn đã ngủ mấy tiếng?',
              audioExample: 'https://example.com/audio_sent.mp3',
            },
          ],
        },
      },
    },
  }

  it('searches for vocabulary and renders its learning-reference detail', async () => {
    vi.mocked(requestApi).mockResolvedValue(sampleSearchResult)
    vi.mocked(nhaikanjiApi.fetchKanjiDetail).mockResolvedValue(sampleNhaiKanjiDetail)

    const inputRef = { current: null }
    renderWithClient(<DictionaryPage inputRef={inputRef} />)

    const input = screen.getByRole('textbox', { name: 'Từ cần tra' })
    fireEvent.change(input, { target: { value: '間' } })

    await waitFor(() => {
      expect(screen.getAllByText('あいだ').length).toBeGreaterThan(0)
      expect(screen.getByText('ở giữa, khoảng cách, khoảng thời gian')).toBeTruthy()
    })

    await waitFor(() => {
      expect(screen.getByText('Tổng quan')).toBeTruthy()
      expect(screen.getByText('Câu ví dụ')).toBeTruthy()
      expect(screen.getByText('Phân tích Kanji')).toBeTruthy()
      expect(screen.getByText('長い間さがしていた本が見つかった。')).toBeTruthy()
      expect(screen.getByText('Tôi đã tìm thấy cuốn sách mà tôi tìm kiếm suốt bấy lâu.')).toBeTruthy()
    })
  })

  it('lets the learner clear a query and return to the ready state', async () => {
    vi.mocked(requestApi).mockResolvedValue(sampleSearchResult)

    const inputRef = { current: null }
    renderWithClient(<DictionaryPage inputRef={inputRef} />)

    const input = screen.getByRole('textbox', { name: 'Từ cần tra' })
    fireEvent.change(input, { target: { value: '間' } })

    await waitFor(() => expect(screen.getByText('Tổng quan')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Xóa từ đang tìm' }))

    await waitFor(() => {
      expect(screen.getByText('Sẵn sàng tra cứu')).toBeTruthy()
      expect((input as HTMLInputElement).value).toBe('')
    })
  })

  it('analyzes a Japanese sentence into dictionary entries without forcing a correction', async () => {
    vi.mocked(requestApi).mockResolvedValue({
      input: '授業の前に予習をします。',
      tokens: [
        { text: '授業', known: true },
        { text: 'の', known: true },
        { text: '予習', known: true },
      ],
      results: sampleSearchResult.results,
      suggestions: [],
      grammarHints: [],
    })

    const inputRef = { current: null }
    renderWithClient(<DictionaryPage inputRef={inputRef} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Từ cần tra' }), { target: { value: '授業の前に予習をします。' } })

    await waitFor(() => {
      expect(screen.getByText('Đã tách câu thành các mục có thể tra')).toBeTruthy()
      expect(screen.getByText('授業')).toBeTruthy()
      expect(screen.getByText('予習')).toBeTruthy()
    })
  })

  it('switches to Kanji tab and renders NhaiKanji grid with level filters', async () => {
    vi.mocked(nhaikanjiApi.fetchKanjiList).mockResolvedValue({
      items: [sampleNhaiKanjiDetail.summary],
      total: 1,
      page: 1,
      limit: 48,
      totalPages: 1,
    })

    const inputRef = { current: null }
    renderWithClient(<DictionaryPage inputRef={inputRef} />)

    // Hán tự is now an internal dictionary tab, rather than a separate page.
    const kanjiTab = screen.getByRole('tab', { name: 'Hán tự' })
    fireEvent.click(kanjiTab)

    await waitFor(() => {
      expect(screen.getByText('Tất cả (2500+)')).toBeTruthy()
      expect(screen.getByText('Kanji N5')).toBeTruthy()
      expect(screen.getByText('GIAN')).toBeTruthy()
      expect(screen.getByText('Khoảng, thời gian')).toBeTruthy()
    })
  })
})
