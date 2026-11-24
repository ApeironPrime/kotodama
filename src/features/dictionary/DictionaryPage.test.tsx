import { MemoryRouter } from 'react-router-dom'
import { UrlStateProvider } from '../../components/UrlStateProvider'
// @vitest-environment jsdom

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DictionaryPage from './DictionaryPage'
import { nhaikanjiApi } from '../nhaikanji/nhaikanjiApi'
import { requestApi } from '../../lib/apiClient'
import { srsApi } from '../srs/srsApi'

vi.mock('../srs/srsApi', () => ({ srsApi: { fetchCurriculumGrammar: vi.fn(), fetchLessons: vi.fn() } }))

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

function renderWithClient(ui: React.ReactElement, path = '/') {
  const testClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MemoryRouter initialEntries={[path]}>
      <UrlStateProvider>
        <QueryClientProvider client={testClient}>{ui}</QueryClientProvider>
      </UrlStateProvider>
    </MemoryRouter>
  )
}

describe('DictionaryPage Feature Suite', () => {
  it('opens the real grammar catalog from the dictionary tab', async () => {
    renderWithClient(<DictionaryPage inputRef={{ current: null }} />, '/tra-tu?tab=grammar')
    expect(
      await screen.findByRole('heading', { name: 'Kho Giáo Trình Ngữ Pháp (Shinkanzen Master & Mimikara)' })
    ).toBeTruthy()
    expect(srsApi.fetchCurriculumGrammar).not.toHaveBeenCalled()
  })

  it('opens the matching full lesson from grammar search results', async () => {
    const item = {
      id: 'mimikara_n3_5',
      source: 'mimikara',
      curriculumCode: 'mimikara_n3',
      lessonId: '1',
      lessonTitle: 'Bài 1',
      title: 'みたいだ',
      pattern: 'みたいだ',
      structure: 'N + みたいだ',
      shortMeaning: 'giống như',
      explanation: 'Giải thích đầy đủ từ giáo trình',
      level: 'N3',
      examples: [],
    }
    vi.mocked(srsApi.fetchLessons).mockResolvedValue([{ lesson_id: '1', lesson_title: 'Bài 1', count: 1 }])
    vi.mocked(srsApi.fetchCurriculumGrammar).mockImplementation(async (params) => ({
      items: params.curriculum ? [{ ...item, id: 'other', pattern: '別の文法' }, item] : [item],
      total: 2,
      totalPages: 1,
    }))
    renderWithClient(<DictionaryPage inputRef={{ current: null }} />, '/tra-tu?tab=grammar&q=みたいだ')
    const link = await screen.findByRole('link', { name: 'Mở bài học' })
    expect(link.getAttribute('href')).toContain('point=mimikara_n3_5')
    fireEvent.click(link)
    await waitFor(() =>
      expect(srsApi.fetchCurriculumGrammar).toHaveBeenCalledWith(
        expect.objectContaining({ curriculum: 'mimikara_n3', lesson: '1' })
      )
    )
    expect(await screen.findByText(/chạm để lật xem ý nghĩa/)).toBeTruthy()
    expect(screen.queryByText('別の文法')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Lật thẻ ngữ pháp' }))
    expect(await screen.findByText('Giải thích đầy đủ từ giáo trình')).toBeTruthy()
  })

  it('loads the paginated Kanji view without fetching the ink canvas dataset', async () => {
    vi.mocked(nhaikanjiApi.fetchKanjiList).mockResolvedValue({ items: [], total: 0, totalPages: 0, page: 1, limit: 48 })
    renderWithClient(<DictionaryPage inputRef={{ current: null }} />, '/tra-tu?tab=kanji&view=grid&q=森')
    expect(await screen.findByRole('heading', { name: 'Kho Hán Tự (Kanji) & Chiết Tự' })).toBeTruthy()
    await waitFor(() =>
      expect(nhaikanjiApi.fetchKanjiList).toHaveBeenCalledWith(expect.objectContaining({ query: '森', limit: 48 }))
    )
    expect(vi.mocked(nhaikanjiApi.fetchKanjiList).mock.calls.every(([params]) => (params?.limit ?? 0) <= 48)).toBe(true)
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(srsApi.fetchLessons).mockResolvedValue([])
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState({}, '', '/')
    }
  })

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
    renderWithClient(<DictionaryPage inputRef={inputRef} mode="deep" />, '/dictionary')

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
    renderWithClient(<DictionaryPage inputRef={inputRef} mode="deep" />, '/dictionary')

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
      translation: 'Trước giờ học, tôi chuẩn bị bài.',
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
    renderWithClient(<DictionaryPage inputRef={inputRef} mode="deep" />, '/dictionary')
    fireEvent.change(screen.getByRole('textbox', { name: 'Từ cần tra' }), {
      target: { value: '授業の前に予習をします。' },
    })

    await waitFor(() => {
      expect(screen.getByText('Nghĩa của câu')).toBeTruthy()
      expect(screen.getByText('Trước giờ học, tôi chuẩn bị bài.')).toBeTruthy()
      expect(screen.getAllByText('授業の前に予習をします。').length).toBeGreaterThan(0)
      expect(screen.getByText('間')).toBeTruthy()
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
    renderWithClient(<DictionaryPage inputRef={inputRef} mode="library" />, '/tra-tu')

    const libraryTablist = screen.getByRole('tablist', { name: 'Danh mục thư viện' })
    expect(libraryTablist).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Từ vựng' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Ngữ pháp' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Từ điển' })).toBeNull()

    // Hán tự is an internal library tab
    const kanjiTab = screen.getByRole('tab', { name: 'Hán tự' })
    fireEvent.click(kanjiTab)

    await waitFor(() => {
      expect(screen.getByText('Tất cả')).toBeTruthy()
      expect(screen.getByText('Kanji N5')).toBeTruthy()
      expect(screen.getByRole('tab', { name: 'Hack Não Tập 1' })).toBeTruthy()
      expect(screen.getByText('GIAN')).toBeTruthy()
      expect(screen.getByText('Khoảng, thời gian')).toBeTruthy()
    })
  })

  it('renders extracted quick suggestion tags and calligraphic Word of the Day stage', async () => {
    const inputRef = { current: null }
    renderWithClient(<DictionaryPage inputRef={inputRef} mode="deep" />, '/dictionary')

    // Quick suggestions should be extracted below the search bar
    expect(screen.getByText('Tra cứu nhanh:')).toBeTruthy()
    expect(screen.getByRole('button', { name: '学校' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '先生' })).toBeTruthy()

    // Word of the day calligraphic stage should be present in zero state
    expect(screen.getByLabelText('Tác phẩm thư pháp - Từ của ngày')).toBeTruthy()
    expect(screen.getByText('本日の名言')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Đổi câu danh ngôn thư pháp khác' })).toBeTruthy()
    expect(screen.getByTitle('Ấn triện Kotodama (Nhấp để dập con dấu)')).toBeTruthy()
  })

  it('opens and closes the artisan sliding study drawer', async () => {
    const inputRef = { current: null }
    renderWithClient(<DictionaryPage inputRef={inputRef} mode="deep" />, '/dictionary')

    const drawerTrigger = screen.getByRole('button', { name: 'Mở sổ tay học & lịch sử tra cứu' })
    expect(drawerTrigger).toBeTruthy()

    // Drawer should initially not be in document
    expect(screen.queryByLabelText('Sổ tay học và lịch sử tra cứu')).toBeNull()

    // Click trigger to open drawer
    fireEvent.click(drawerTrigger)
    expect(screen.getByLabelText('Sổ tay học và lịch sử tra cứu')).toBeTruthy()
    expect(screen.getByText('SỔ TAY HỌC & LỊCH SỬ')).toBeTruthy()
    expect(screen.getByText('SỔ TAY SRS')).toBeTruthy()

    // Press Escape to dismiss drawer
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByLabelText('Sổ tay học và lịch sử tra cứu')).toBeNull()
  })

  it('shows matched Kanji monograph in the all tab even when word search returns empty', async () => {
    vi.mocked(requestApi).mockResolvedValue({ results: [] })
    vi.mocked(srsApi.fetchCurriculumGrammar).mockResolvedValue({ items: [], total: 0, totalPages: 0 })
    vi.mocked(nhaikanjiApi.fetchKanjiList).mockResolvedValue({
      items: [
        {
          ...sampleNhaiKanjiDetail.summary,
          kanji: '議',
          hanzi: 'NGHỊ',
          meaning_vi: 'bàn bạc, thảo luận',
          jlpt_level: 'N3',
          stroke_count: 20,
          onyomi: 'ギ',
          kunyomi: '',
        },
      ],
      total: 1,
      page: 1,
      limit: 6,
      totalPages: 1,
    })
    vi.mocked(nhaikanjiApi.fetchKanjiDetail).mockResolvedValue({
      kanji: '議',
      summary: {
        ...sampleNhaiKanjiDetail.summary,
        kanji: '議',
        hanzi: 'NGHỊ',
        meaning_vi: 'bàn bạc, thảo luận',
        jlpt_level: 'N3',
        stroke_count: 20,
        onyomi: 'ギ',
        kunyomi: '',
      },
      detail: {
        kanji: '議',
        kanjiInfo: {
          id: 'gi',
          hanzi: 'NGHỊ',
          meaning: 'bàn bạc, thảo luận',
          story: 'Trong hội nghị không được nói lời vô nghĩa.',
          jlptLevel: 'N3',
          kanjialiveData: {
            rad_name_ja: 'ごんべん',
            onyomi_ja: 'ギ',
            kunyomi_ja: '—',
            rad_utf: '言',
            rad_meaning: 'Lời nói',
            examples: [
              {
                word: '会議室',
                reading: 'かいぎしつ',
                meaning: 'Phòng họp',
                yinHan: 'HỘI NGHỊ THẤT',
              },
            ],
          },
        },
      },
    })

    renderWithClient(<DictionaryPage inputRef={{ current: null }} mode="deep" />, '/dictionary?tab=all&q=議')

    expect(await screen.findByText('Chữ Hán liên quan (1)')).toBeTruthy()
    expect(screen.getByText('議')).toBeTruthy()
    expect(screen.getByText('NGHỊ')).toBeTruthy()
    expect(await screen.findByText('会議室')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Luyện viết nét & Phả hệ' })).toBeTruthy()
    expect(screen.queryByText('Không tìm thấy kết quả cho “議”')).toBeNull()
  })
})
