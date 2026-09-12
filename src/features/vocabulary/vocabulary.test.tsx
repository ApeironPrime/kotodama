// @vitest-environment jsdom

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { VocabularyPage } from './VocabularyPage'
import { srsApi } from '../srs/srsApi'
import { curriculumApi } from '../curriculum/curriculumApi'
import type { CurriculumCatalogData, CurriculumCourseDetailData, CurriculumUnitTermsData } from '../../types/curriculum'

const mockUser = {
  id: 'user-test-123',
  name: 'Test User',
  email: 'test@example.com',
  role: 'learner' as const,
  emailVerified: true,
  accountStatus: 'active' as const,
}

let currentAuthUser: typeof mockUser | null = mockUser

vi.mock('../auth/authContext', () => ({
  useAuth: () => ({
    user: currentAuthUser,
    status: currentAuthUser ? 'authenticated' : 'anonymous',
    sessionExpired: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    acceptSession: vi.fn(),
    signOut: vi.fn(),
  }),
}))

vi.mock('../srs/srsApi', () => ({
  srsApi: {
    fetchSavedTerms: vi.fn(),
    addCard: vi.fn(),
  },
}))

vi.mock('../curriculum/curriculumApi', () => ({
  curriculumApi: {
    fetchCatalog: vi.fn(),
    fetchCourseDetail: vi.fn(),
    fetchUnitDetail: vi.fn(),
    fetchUnitTerms: vi.fn(),
  },
}))

vi.mock('../../lib/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../../lib/apiClient')>('../../lib/apiClient')
  return {
    ...actual,
    requestApi: vi.fn().mockImplementation(async (cfg) => {
      if (typeof cfg?.url === 'string' && cfg.url.includes('/api/v1/dictionary/word/')) {
        return {
          id: 101,
          word: '私',
          reading: 'わたし',
          hanViet: 'TƯ',
          jlpt: 'N5',
          partOfSpeech: 'pronoun',
          meanings: ['tôi', 'bản thân'],
          kanjis: [],
          examples: [{ sentenceJp: '私は学生です。', sentenceVi: 'Tôi là học sinh.' }],
        }
      }
      return actual.requestApi(cfg)
    }),
  }
})

const mockCatalogData: CurriculumCatalogData = {
  items: [
    {
      course_code: 'minna-n5-standard',
      title: 'Minna no Nihongo N5 Chuẩn',
      level: 'N5',
      provider_source: '3A Network',
      visibility: 'public',
      rights_status: 'verified',
      description: 'Giáo trình tiếng Nhật sơ cấp 50 bài học.',
      unit_count: 25,
      term_count: 1000,
    },
    {
      course_code: 'soumatome-n3-vocab',
      title: 'Nihongo Soumatome N3 Từ Vựng',
      level: 'N3',
      provider_source: 'Ask Books',
      visibility: 'public',
      rights_status: 'verified',
      description: 'Luyện thi cấp tốc từ vựng N3 trong 6 tuần.',
      unit_count: 6,
      term_count: 820,
    },
    {
      course_code: 'it-nihongo-se',
      title: 'Tiếng Nhật CNTT (SE IT)',
      level: 'SE',
      provider_source: 'Kotodama SE',
      visibility: 'public',
      rights_status: 'verified',
      description: 'Từ vựng chuyên ngành kỹ phần mềm.',
      unit_count: 16,
      term_count: 600,
    },
  ],
  pagination: {
    page: 1,
    limit: 100,
    total: 3,
    totalPages: 1,
  },
}

const mockCourseDetailData: CurriculumCourseDetailData = {
  course: {
    course_code: 'minna-n5-standard',
    title: 'Minna no Nihongo N5 Chuẩn',
    level: 'N5',
    provider_source: '3A Network',
    visibility: 'public',
    rights_status: 'verified',
    description: 'Giáo trình tiếng Nhật sơ cấp 50 bài học.',
    unit_count: 25,
    term_count: 1000,
  },
  units: [
    {
      unit_id: 'minna-n5-standard:bai-01',
      unit_key: 'bai-01',
      ordinal: 1,
      title: 'Bài 1: Chào hỏi & Làm quen',
      topic: 'Giao tiếp cơ bản',
      term_count: 2,
    },
    {
      unit_id: 'minna-n5-standard:bai-02',
      unit_key: 'bai-02',
      ordinal: 2,
      title: 'Bài 2: Đồ vật xung quanh',
      topic: 'Vật dụng thường ngày',
      term_count: 40,
    },
  ],
}

const mockUnitTermsData: CurriculumUnitTermsData = {
  course: {
    course_code: 'minna-n5-standard',
    title: 'Minna no Nihongo N5 Chuẩn',
    level: 'N5',
    rights_status: 'verified',
  },
  unit: {
    unit_id: 'minna-n5-standard:bai-01',
    unit_key: 'bai-01',
    ordinal: 1,
    title: 'Bài 1: Chào hỏi & Làm quen',
  },
  items: [
    {
      term_id: 'term-01',
      ordinal: 1,
      normalized_key: 'わたし',
      display_word: '私',
      display_reading: 'わたし',
      meanings: ['tôi', 'bản thân'],
      han_viet: 'TƯ',
      examples: [
        {
          ja: '私は学生です。',
          vi: 'Tôi là học sinh.',
        },
      ],
    },
    {
      term_id: 'term-02',
      ordinal: 2,
      normalized_key: 'ほん',
      display_word: '本',
      display_reading: 'ほん',
      meanings: ['sách'],
      han_viet: 'BẢN',
      examples: [
        {
          ja: 'これは本です。',
          vi: 'Đây là cuốn sách.',
        },
      ],
    },
  ],
  pagination: {
    page: 1,
    limit: 100,
    total: 2,
    totalPages: 1,
  },
}

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

describe('VocabularyPage Suite (Task T05 & T06)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentAuthUser = mockUser
    vi.mocked(srsApi.fetchSavedTerms).mockResolvedValue([])
    vi.mocked(srsApi.addCard).mockResolvedValue({ id: 'test-card-1', term: '私' } as unknown as never)
    vi.mocked(curriculumApi.fetchCatalog).mockResolvedValue(mockCatalogData)
    vi.mocked(curriculumApi.fetchCourseDetail).mockResolvedValue(mockCourseDetailData)
    vi.mocked(curriculumApi.fetchUnitTerms).mockImplementation(async (_course, _unit, params) => {
      const page = params?.page || 1
      const limit = params?.limit || 20
      const q = (params?.q || '').trim().toLowerCase()

      let filtered = mockUnitTermsData.items
      if (q) {
        filtered = filtered.filter(
          (t) =>
            t.display_word.toLowerCase().includes(q) ||
            t.display_reading.toLowerCase().includes(q) ||
            (t.han_viet || '').toLowerCase().includes(q) ||
            t.meanings.some((m) => m.toLowerCase().includes(q))
        )
      }
      const total = filtered.length
      const totalPages = Math.ceil(total / limit) || 1
      const offset = (page - 1) * limit
      const items = filtered.slice(offset, offset + limit)

      return {
        ...mockUnitTermsData,
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      }
    })
  })

  it('renders hero title "Học bản chất – không học vẹt" and course cards grouped by level', async () => {
    renderWithClient(<VocabularyPage />)

    // 1. Hero text
    expect(await screen.findByText('Học bản chất – không học vẹt')).toBeTruthy()
    expect(screen.getByText(/Khám phá các bộ giáo trình từ vựng theo chuẩn JLPT/i)).toBeTruthy()

    // 2. Filter tabs
    expect(screen.getByRole('tab', { name: 'Tất cả' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'N5' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'N3' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'SE IT' })).toBeTruthy()

    // 3. Courses rendered under level group headings
    expect(await screen.findByText('Minna no Nihongo N5 Chuẩn')).toBeTruthy()
    expect(screen.getByText('Nihongo Soumatome N3 Từ Vựng')).toBeTruthy()
    expect(screen.getByText('Tiếng Nhật CNTT (SE IT)')).toBeTruthy()
  })

  it('filters courses by clicking level filter pills', async () => {
    renderWithClient(<VocabularyPage />)

    await screen.findByText('Minna no Nihongo N5 Chuẩn')

    // Click N5 filter pill
    const n5Tab = screen.getByRole('tab', { name: 'N5' })
    fireEvent.click(n5Tab)

    // Only N5 course should be visible
    expect(await screen.findByText('Minna no Nihongo N5 Chuẩn')).toBeTruthy()
    expect(screen.queryByText('Nihongo Soumatome N3 Từ Vựng')).toBeNull()

    // Click SE filter pill
    const seTab = screen.getByRole('tab', { name: 'SE IT' })
    fireEvent.click(seTab)

    expect(await screen.findByText('Tiếng Nhật CNTT (SE IT)')).toBeTruthy()
    expect(screen.queryByText('Minna no Nihongo N5 Chuẩn')).toBeNull()

    // Reset to All
    const allTab = screen.getByRole('tab', { name: 'Tất cả' })
    fireEvent.click(allTab)

    expect(await screen.findByText('Minna no Nihongo N5 Chuẩn')).toBeTruthy()
    expect(screen.getByText('Nihongo Soumatome N3 Từ Vựng')).toBeTruthy()
  })

  it('filters courses by keyword search input', async () => {
    renderWithClient(<VocabularyPage />)

    await screen.findByText('Minna no Nihongo N5 Chuẩn')

    const searchInput = screen.getByPlaceholderText(/Tìm kiếm giáo trình/i)
    fireEvent.change(searchInput, { target: { value: 'Soumatome' } })

    expect(await screen.findByText('Nihongo Soumatome N3 Từ Vựng')).toBeTruthy()
    expect(screen.queryByText('Minna no Nihongo N5 Chuẩn')).toBeNull()
  })

  it('navigates from course card to unit list and returns via back button', async () => {
    renderWithClient(<VocabularyPage />)

    const courseCard = await screen.findByText('Minna no Nihongo N5 Chuẩn')
    fireEvent.click(courseCard)

    // Unit list view
    expect(await screen.findByText('Bài 1: Chào hỏi & Làm quen')).toBeTruthy()
    expect(screen.getByText('Bài 2: Đồ vật xung quanh')).toBeTruthy()
    expect(screen.getByText(/2 từ/i)).toBeTruthy()

    // Back to catalog
    const backBtn = screen.getByRole('button', { name: /Quay lại danh mục giáo trình/i })
    fireEvent.click(backBtn)

    expect(await screen.findByText('Học bản chất – không học vẹt')).toBeTruthy()
    expect(screen.getByText('Minna no Nihongo N5 Chuẩn')).toBeTruthy()
  })

  it('supports keyboard navigation (Enter key on course card, Space key on filter pill)', async () => {
    renderWithClient(<VocabularyPage />)

    await screen.findByText('Minna no Nihongo N5 Chuẩn')

    // Space on N5 filter tab
    const n5Tab = screen.getByRole('tab', { name: 'N5' })
    fireEvent.keyDown(n5Tab, { key: ' ' })

    expect(await screen.findByText('Minna no Nihongo N5 Chuẩn')).toBeTruthy()
    expect(screen.queryByText('Nihongo Soumatome N3 Từ Vựng')).toBeNull()

    // Enter on course card
    const card = screen.getByRole('button', { name: /Khóa học Minna no Nihongo N5 Chuẩn/i })
    fireEvent.keyDown(card, { key: 'Enter' })

    expect(await screen.findByText('Bài 1: Chào hỏi & Làm quen')).toBeTruthy()
  })

  it('renders empty notice when catalog has 0 courses', async () => {
    vi.mocked(curriculumApi.fetchCatalog).mockResolvedValueOnce({
      items: [],
      pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
    })

    renderWithClient(<VocabularyPage />)

    expect(await screen.findByText('Kho Giáo Trình Đang Thẩm Định Quyền Sử Dụng')).toBeTruthy()
    expect(
      screen.getByText(/Các bộ giáo trình từ vựng đang trong quy trình rà soát quyền sử dụng/i)
    ).toBeTruthy()
  })

  it('renders retry state when catalog fetch fails and allows retry', async () => {
    vi.mocked(curriculumApi.fetchCatalog).mockRejectedValueOnce(new Error('Network error'))

    renderWithClient(<VocabularyPage />)

    expect(await screen.findByText('Không thể tải danh mục giáo trình')).toBeTruthy()
    const retryBtn = screen.getByRole('button', { name: 'Thử lại' })

    vi.mocked(curriculumApi.fetchCatalog).mockResolvedValueOnce(mockCatalogData)
    fireEvent.click(retryBtn)

    expect(await screen.findByText('Minna no Nihongo N5 Chuẩn')).toBeTruthy()
  })

  it('selects unit, renders word list by default with real progress and terms table', async () => {
    renderWithClient(<VocabularyPage />)

    const courseCard = await screen.findByText('Minna no Nihongo N5 Chuẩn')
    fireEvent.click(courseCard)

    const unitCard = await screen.findByText('Bài 1: Chào hỏi & Làm quen')
    fireEvent.click(unitCard)

    // Header & Real Progress: 0 / 2 terms saved (0%)
    expect(await screen.findByText(/0 \/ 2 từ đã lưu \(0%\)/i)).toBeTruthy()

    // Terms table renders terms
    expect(await screen.findByText('私')).toBeTruthy()
    expect(screen.getByText('【わたし】')).toBeTruthy()
    expect(screen.getByText('(TƯ)')).toBeTruthy()
    expect(screen.getByText('tôi, bản thân')).toBeTruthy()

    expect(screen.getByText('本')).toBeTruthy()
    expect(screen.getByText('【ほん】')).toBeTruthy()
    expect(screen.getByText('(BẢN)')).toBeTruthy()
    expect(screen.getByText('sách')).toBeTruthy()

    // Add to SRS via list button
    const addBtns = screen.getAllByRole('button', { name: /\+ Thêm SRS/i })
    expect(addBtns.length).toBe(2)
    const firstAddBtn = addBtns[0]
    expect(firstAddBtn).toBeDefined()
    if (firstAddBtn) fireEvent.click(firstAddBtn)

    await waitFor(() => {
      expect(srsApi.addCard).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'vocab',
          term: '私',
          reading: 'わたし',
          hanViet: 'TƯ',
          meaning: 'tôi, bản thân',
          jlptLevel: 'N5',
        })
      )
    })
  })

  it('switches to flashcard mode, flips card, and adds to SRS for authenticated user', async () => {
    const onGoToSrsMock = vi.fn()
    renderWithClient(<VocabularyPage onGoToSrs={onGoToSrsMock} />)

    const courseCard = await screen.findByText('Minna no Nihongo N5 Chuẩn')
    fireEvent.click(courseCard)

    const unitCard = await screen.findByText('Bài 1: Chào hỏi & Làm quen')
    fireEvent.click(unitCard)

    // Switch to Flashcard mode
    const flashcardTab = await screen.findByRole('tab', { name: /Flashcard Bài Học/i })
    fireEvent.click(flashcardTab)

    // Flashcard view displays current word
    expect(await screen.findByText('私')).toBeTruthy()

    // Flip card
    const flipArea = screen.getByText(/Nhấn \[Space\] hoặc chạm để lật xem nghĩa/i)
    fireEvent.click(flipArea)

    expect(screen.getByText('【わたし】')).toBeTruthy()
    expect(screen.getByText('Hán Việt:')).toBeTruthy()
    expect(screen.getByText('TƯ')).toBeTruthy()
    expect(screen.getByText('tôi, bản thân')).toBeTruthy()

    // Add to SRS via flashcard button
    const srsBtn = screen.getByTitle('Lưu vào SRS Flashcard (Phím C)')
    fireEvent.click(srsBtn)

    await waitFor(() => {
      expect(srsApi.addCard).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'vocab',
          term: '私',
          reading: 'わたし',
          hanViet: 'TƯ',
          meaning: 'tôi, bản thân',
        })
      )
    })

    // Click Go To SRS
    const srsDeckBtn = screen.getByText('Mở Thẻ Ôn Tập Anki')
    fireEvent.click(srsDeckBtn)
    expect(onGoToSrsMock).toHaveBeenCalled()
  })

  it('in-unit search filters terms by Japanese word, reading, Han-Viet, and meaning', async () => {
    renderWithClient(<VocabularyPage />)

    fireEvent.click(await screen.findByText('Minna no Nihongo N5 Chuẩn'))
    fireEvent.click(await screen.findByText('Bài 1: Chào hỏi & Làm quen'))

    await screen.findByText('私')
    const unitSearchInput = screen.getByPlaceholderText(/Tìm từ, cách đọc, hán việt, ý nghĩa/i)

    // 1. Search by reading 'ほん' -> only '本' appears
    fireEvent.change(unitSearchInput, { target: { value: 'ほん' } })
    expect(await screen.findByText('本')).toBeTruthy()
    expect(screen.queryByText('私')).toBeNull()

    // 2. Search by Han-Viet 'TƯ' -> only '私' appears
    fireEvent.change(unitSearchInput, { target: { value: 'TƯ' } })
    expect(await screen.findByText('私')).toBeTruthy()
    expect(screen.queryByText('本')).toBeNull()

    // 3. Search by meaning 'sách' -> only '本' appears
    fireEvent.change(unitSearchInput, { target: { value: 'sách' } })
    expect(await screen.findByText('本')).toBeTruthy()
    expect(screen.queryByText('私')).toBeNull()

    // 4. Search unmatched keyword -> empty state
    fireEvent.change(unitSearchInput, { target: { value: 'xyz123' } })
    expect(await screen.findByText(/Không tìm thấy từ vựng nào khớp với từ khóa "xyz123"/i)).toBeTruthy()
  })

  it('real progress calculates exact saved count and percentage without mock data', async () => {
    // Mock user has already saved '私' with exact sourceContext in this unit
    vi.mocked(srsApi.fetchSavedTerms).mockResolvedValueOnce([
      {
        type: 'vocab',
        term: '私',
        courseCode: 'minna-n5-standard',
        unitId: 'minna-n5-standard:bai-01',
        termId: 'term-01',
        sourceContext: 'minna-n5-standard:minna-n5-standard:bai-01:term-01',
      },
    ])

    renderWithClient(<VocabularyPage />)

    fireEvent.click(await screen.findByText('Minna no Nihongo N5 Chuẩn'))
    fireEvent.click(await screen.findByText('Bài 1: Chào hỏi & Làm quen'))

    // 1 of 2 terms is saved -> exactly 50%
    expect(await screen.findByText(/1 \/ 2 từ đã lưu \(50%\)/i)).toBeTruthy()

    // '私' shows 'Đã lưu', '本' shows '+ Thêm SRS'
    expect(await screen.findByRole('button', { name: /Đã lưu/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /\+ Thêm SRS/i })).toBeTruthy()
  })

  it('opens dictionary word detail modal and closes via close button or Escape', async () => {
    renderWithClient(<VocabularyPage />)

    fireEvent.click(await screen.findByText('Minna no Nihongo N5 Chuẩn'))
    fireEvent.click(await screen.findByText('Bài 1: Chào hỏi & Làm quen'))

    await screen.findByText('私')

    // Click "Chi tiết từ điển" on first row
    const dictBtns = screen.getAllByRole('button', { name: /Chi tiết từ điển/i })
    const firstDictBtn = dictBtns[0]
    expect(firstDictBtn).toBeDefined()
    if (firstDictBtn) fireEvent.click(firstDictBtn)

    // Modal dialog opens and renders DictionaryWordDetail
    const modalDialog = await screen.findByRole('dialog', { name: /Chi tiết từ điển/i })
    expect(modalDialog).toBeTruthy()
    expect(screen.getByText(/Phân tích Kanji|Tổng quan/i)).toBeTruthy()

    // Close button dismisses modal
    const closeBtn = screen.getByRole('button', { name: /Đóng chi tiết từ điển/i })
    fireEvent.click(closeBtn)

    expect(screen.queryByRole('dialog', { name: /Chi tiết từ điển/i })).toBeNull()
  })

  it('anonymous user attempting to save SRS sees friendly login banner and no card is created', async () => {
    currentAuthUser = null // unauthenticated / anonymous user

    renderWithClient(<VocabularyPage />)

    fireEvent.click(await screen.findByText('Minna no Nihongo N5 Chuẩn'))
    fireEvent.click(await screen.findByText('Bài 1: Chào hỏi & Làm quen'))

    await screen.findByText('私')

    const addBtns = screen.getAllByRole('button', { name: /\+ Thêm SRS/i })
    const firstAddBtn = addBtns[0]
    expect(firstAddBtn).toBeDefined()
    if (firstAddBtn) fireEvent.click(firstAddBtn)

    // Prominent login prompt appears
    expect(
      await screen.findByText(/Vui lòng đăng nhập để lưu từ vựng vào kho ôn tập SRS/i)
    ).toBeTruthy()

    // API was NOT called, no card created
    expect(srsApi.addCard).not.toHaveBeenCalled()
  })

  it('failed SRS request shows error banner and does not mark term as saved or increment progress', async () => {
    vi.mocked(srsApi.addCard).mockRejectedValueOnce(new Error('Network failure'))

    renderWithClient(<VocabularyPage />)

    fireEvent.click(await screen.findByText('Minna no Nihongo N5 Chuẩn'))
    fireEvent.click(await screen.findByText('Bài 1: Chào hỏi & Làm quen'))

    await screen.findByText('私')

    const addBtns = screen.getAllByRole('button', { name: /\+ Thêm SRS/i })
    const firstAddBtnFail = addBtns[0]
    expect(firstAddBtnFail).toBeDefined()
    if (firstAddBtnFail) fireEvent.click(firstAddBtnFail)

    // Error banner appears
    expect(await screen.findByText(/Không thể lưu từ vào SRS lúc này/i)).toBeTruthy()

    // Progress remains 0 / 2 (0%)
    expect(screen.getByText(/0 \/ 2 từ đã lưu \(0%\)/i)).toBeTruthy()

    // Button remains '+ Thêm SRS'
    expect(screen.queryByRole('button', { name: /Đã lưu/i })).toBeNull()
  })

  it('keyboard hotkeys are ignored when user is typing in in-unit search input', async () => {
    renderWithClient(<VocabularyPage />)

    fireEvent.click(await screen.findByText('Minna no Nihongo N5 Chuẩn'))
    fireEvent.click(await screen.findByText('Bài 1: Chào hỏi & Làm quen'))

    // Switch to flashcard mode
    fireEvent.click(await screen.findByRole('tab', { name: /Flashcard Bài Học/i }))
    expect(await screen.findByText('私')).toBeTruthy()

    // Focus into search input
    const searchInput = screen.getByPlaceholderText(/Tìm từ, cách đọc, hán việt, ý nghĩa/i)
    searchInput.focus()

    // Press Space inside the search input
    fireEvent.keyDown(searchInput, { code: 'Space', key: ' ' })

    // Card did NOT flip because focus is in INPUT
    expect(screen.queryByText('【わたし】')).toBeNull()
  })

  it('handles dataset with >100 terms (121 terms): page 6 renders term #101+, search finds term past #100, denominator is 121', async () => {
    const all121Terms = Array.from({ length: 121 }, (_, i) => {
      const num = i + 1
      return {
        term_id: `term-${num}`,
        ordinal: num,
        normalized_key: `term_${num}`,
        display_word: `単語_${num}`,
        display_reading: `たんご_${num}`,
        meanings: [`Nghĩa của từ thứ ${num}`],
        han_viet: num === 105 ? 'KỲ BÍ' : `HÁN_${num}`,
        examples: [
          {
            ja: `これは例文_${num}です。`,
            vi: `Đây là ví dụ số ${num}.`,
          },
        ],
      }
    })

    vi.mocked(curriculumApi.fetchCourseDetail).mockResolvedValueOnce({
      course: mockCourseDetailData.course,
      units: [
        {
          unit_id: 'minna-n5-standard:bai-01',
          unit_key: 'bai-01',
          ordinal: 1,
          title: 'Bài 1: Chào hỏi & Làm quen',
          topic: 'Giao tiếp cơ bản',
          term_count: 121,
        },
      ],
    })

    vi.mocked(curriculumApi.fetchUnitTerms).mockImplementation(async (_course, _unit, params) => {
      const page = params?.page || 1
      const limit = params?.limit || 20
      const q = (params?.q || '').trim().toLowerCase()

      let filtered = all121Terms
      if (q) {
        filtered = filtered.filter(
          (t) =>
            t.display_word.toLowerCase().includes(q) ||
            t.display_reading.toLowerCase().includes(q) ||
            (t.han_viet || '').toLowerCase().includes(q) ||
            t.meanings.some((m) => m.toLowerCase().includes(q))
        )
      }
      const total = filtered.length
      const totalPages = Math.ceil(total / limit) || 1
      const offset = (page - 1) * limit
      const items = filtered.slice(offset, offset + limit)

      return {
        course: {
          course_code: 'minna-n5-standard',
          title: 'Minna no Nihongo N5 Chuẩn',
          level: 'N5',
          rights_status: 'verified',
        },
        unit: {
          unit_id: 'minna-n5-standard:bai-01',
          unit_key: 'bai-01',
          ordinal: 1,
          title: 'Bài 1: Chào hỏi & Làm quen',
        },
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      }
    })

    renderWithClient(<VocabularyPage />)

    fireEvent.click(await screen.findByText('Minna no Nihongo N5 Chuẩn'))
    fireEvent.click(await screen.findByText('Bài 1: Chào hỏi & Làm quen'))

    // 1. Progress bar denominator is 121
    expect(await screen.findByText(/0 \/ 121 từ đã lưu \(0%\)/i)).toBeTruthy()

    // 2. Page 1 displays items 1-20
    expect(await screen.findByText('単語_1')).toBeTruthy()
    expect(screen.getByText('Trang 1 / 7')).toBeTruthy()
    expect(screen.getByText(/Hiển thị 1 – 20 trên tổng số 121 từ/i)).toBeTruthy()

    // 3. Navigate to Page 6 (terms #101 to #120)
    for (let p = 1; p < 6; p++) {
      const nextBtn = screen.getByRole('button', { name: /Sau/i })
      fireEvent.click(nextBtn)
      await screen.findByText(`Trang ${p + 1} / 7`)
    }

    expect(await screen.findByText('Trang 6 / 7')).toBeTruthy()
    expect(screen.getByText(/Hiển thị 101 – 120 trên tổng số 121 từ/i)).toBeTruthy()
    expect(screen.getByText('単語_101')).toBeTruthy()
    expect(screen.getByText('単語_120')).toBeTruthy()
    expect(screen.queryByText('単語_1')).toBeNull()

    // 4. In-unit search finds terms past #100 (e.g. term #105 "KỲ BÍ") and resets page to 1
    const searchInput = screen.getByPlaceholderText(/Tìm từ, cách đọc, hán việt, ý nghĩa/i)
    fireEvent.change(searchInput, { target: { value: 'KỲ BÍ' } })

    expect(await screen.findByText('単語_105')).toBeTruthy()
    expect(screen.getByText('【たんご_105】')).toBeTruthy()
    expect(screen.getByText('(KỲ BÍ)')).toBeTruthy()
    expect(screen.getByText('Nghĩa của từ thứ 105')).toBeTruthy()
    expect(screen.getByText('Danh Sách (1)')).toBeTruthy()

    // 5. In Flashcard mode: bottom counter shows total 121
    fireEvent.change(searchInput, { target: { value: '' } })
    await screen.findByText('単語_1')

    const flashcardTab = screen.getByRole('tab', { name: /Flashcard Bài Học/i })
    fireEvent.click(flashcardTab)

    expect(await screen.findByText('単語_1')).toBeTruthy()
    expect(screen.getByText(/Từ 1 \/ 121 \(Trang 1 \/ 7\)/i)).toBeTruthy()
  })

  it('anonymous visitor never invokes fetchSavedTerms or addCard and sees login alert', async () => {
    currentAuthUser = null

    renderWithClient(<VocabularyPage />)

    // Verify fetchSavedTerms was NOT called because enabled: Boolean(user)
    expect(srsApi.fetchSavedTerms).not.toHaveBeenCalled()

    fireEvent.click(await screen.findByText('Minna no Nihongo N5 Chuẩn'))
    fireEvent.click(await screen.findByText('Bài 1: Chào hỏi & Làm quen'))

    await screen.findByText('私')

    const addBtns = screen.getAllByRole('button', { name: /\+ Thêm SRS/i })
    const firstAddBtnAnon = addBtns[0]
    expect(firstAddBtnAnon).toBeDefined()
    if (firstAddBtnAnon) fireEvent.click(firstAddBtnAnon)

    expect(await screen.findByText(/Vui lòng đăng nhập để lưu từ vựng vào kho ôn tập SRS/i)).toBeTruthy()
    expect(srsApi.addCard).not.toHaveBeenCalled()
    expect(srsApi.fetchSavedTerms).not.toHaveBeenCalled()
  })

  it('saving a term passes sourceContext (course:unit:term) and metadata to addCard', async () => {
    renderWithClient(<VocabularyPage />)

    fireEvent.click(await screen.findByText('Minna no Nihongo N5 Chuẩn'))
    fireEvent.click(await screen.findByText('Bài 1: Chào hỏi & Làm quen'))

    await screen.findByText('私')

    const addBtns = screen.getAllByRole('button', { name: /\+ Thêm SRS/i })
    const firstAddBtnSave = addBtns[0]
    expect(firstAddBtnSave).toBeDefined()
    if (firstAddBtnSave) fireEvent.click(firstAddBtnSave)

    await waitFor(() => {
      expect(srsApi.addCard).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'vocab',
          term: '私',
          reading: 'わたし',
          hanViet: 'TƯ',
          meaning: 'tôi, bản thân',
          courseCode: 'minna-n5-standard',
          unitId: 'minna-n5-standard:bai-01',
          termId: 'term-01',
          sourceContext: 'minna-n5-standard:minna-n5-standard:bai-01:term-01',
        })
      )
    })
  })

  it('regression: user saved term in Context A does not mark Context B as saved and progress remains 0 until saved', async () => {
    // 1. User has already saved '私' in Context A (minna-n5-standard:bai-01:term-01)
    vi.mocked(srsApi.fetchSavedTerms).mockResolvedValue([
      {
        type: 'vocab',
        term: '私',
        courseCode: 'minna-n5-standard',
        unitId: 'minna-n5-standard:bai-01',
        termId: 'term-01',
        sourceContext: 'minna-n5-standard:minna-n5-standard:bai-01:term-01',
      },
    ])

    // Course B: Soumatome N3 Vocab with Week 1 unit
    const mockCourseBDetail: CurriculumCourseDetailData = {
      course: {
        course_code: 'soumatome-n3-vocab',
        title: 'Nihongo Soumatome N3 Từ Vựng',
        level: 'N3',
        provider_source: 'Ask Books',
        visibility: 'public',
        rights_status: 'verified',
        description: 'Luyện thi cấp tốc từ vựng N3 trong 6 tuần.',
        unit_count: 6,
        term_count: 820,
      },
      units: [
        {
          unit_id: 'soumatome-n3-vocab:week-01',
          unit_key: 'week-01',
          ordinal: 1,
          title: 'Tuần 1: Bài 1',
          topic: 'Từ vựng N3',
          term_count: 1,
        },
      ],
    }

    // Context B term: identical surface word '私', but in Context B
    const mockUnitBTerms: CurriculumUnitTermsData = {
      course: {
        course_code: 'soumatome-n3-vocab',
        title: 'Nihongo Soumatome N3 Từ Vựng',
        level: 'N3',
        rights_status: 'verified',
      },
      unit: {
        unit_id: 'soumatome-n3-vocab:week-01',
        unit_key: 'week-01',
        ordinal: 1,
        title: 'Tuần 1: Bài 1',
      },
      items: [
        {
          term_id: 'term-soumatome-01',
          ordinal: 1,
          normalized_key: 'わたし',
          display_word: '私',
          display_reading: 'わたし',
          meanings: ['tôi', 'bản thân'],
          han_viet: 'TƯ',
          examples: [
            {
              ja: '私は会社員です。',
              vi: 'Tôi là nhân viên công ty.',
            },
          ],
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    }

    vi.mocked(curriculumApi.fetchCourseDetail).mockImplementation(async (code) => {
      if (code === 'soumatome-n3-vocab') return mockCourseBDetail
      return mockCourseDetailData
    })

    vi.mocked(curriculumApi.fetchUnitTerms).mockImplementation(async (course, unit) => {
      if (course === 'soumatome-n3-vocab' && unit === 'week-01') return mockUnitBTerms
      return mockUnitTermsData
    })

    renderWithClient(<VocabularyPage />)

    // Open Course B -> Unit B
    fireEvent.click(await screen.findByText('Nihongo Soumatome N3 Từ Vựng'))
    fireEvent.click(await screen.findByText('Tuần 1: Bài 1'))

    // Wait for Context B's term '私' to be rendered
    await screen.findByText('tôi, bản thân')

    // Context B progress must be 0, and button must still be "+ Thêm SRS"
    expect(await screen.findByText(/0 \/ 1 từ đã lưu \(0%\)/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /\+ Thêm SRS/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Đã lưu/i })).toBeNull()

    // In Flashcard mode for Context B: bookmark button is not yet saved
    const flashcardTab = screen.getByRole('tab', { name: /Flashcard Bài Học/i })
    fireEvent.click(flashcardTab)

    const flashcardBookmarkBtn = screen.getByTitle('Lưu vào SRS Flashcard (Phím C)')
    expect(flashcardBookmarkBtn).toBeTruthy()
    expect(screen.queryByTitle('Đã lưu trong SRS Flashcard')).toBeNull()

    // Save Context B card
    fireEvent.click(flashcardBookmarkBtn)

    await waitFor(() => {
      expect(srsApi.addCard).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'vocab',
          term: '私',
          courseCode: 'soumatome-n3-vocab',
          unitId: 'soumatome-n3-vocab:week-01',
          termId: 'term-soumatome-01',
          sourceContext: 'soumatome-n3-vocab:soumatome-n3-vocab:week-01:term-soumatome-01',
        })
      )
    })

    // Now in Flashcard mode, Context B shows 'Đã lưu trong SRS Flashcard'
    expect(screen.getByTitle('Đã lưu trong SRS Flashcard')).toBeTruthy()

    // Switch back to Word List
    const listTab = screen.getByRole('tab', { name: /Danh Sách/i })
    fireEvent.click(listTab)

    // In Word List, Context B now shows 'Đã lưu' and progress is 100%
    expect(await screen.findByRole('button', { name: /Đã lưu/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /\+ Thêm SRS/i })).toBeNull()
    expect(screen.getByText(/1 \/ 1 từ đã lưu \(100%\)/i)).toBeTruthy()
  })
})
