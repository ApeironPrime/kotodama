// @vitest-environment jsdom
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UrlStateProvider } from '../../components/UrlStateProvider'
import { KanjiPage } from './KanjiPage'
import { nhaikanjiApi } from './nhaikanjiApi'
import type { KanjiDetailData, KanjiSummary } from './nhaikanjiTypes'

vi.mock('./nhaikanjiApi', () => ({
  nhaikanjiApi: {
    fetchKanjiList: vi.fn(),
    fetchKanjiDetail: vi.fn(),
    fetchKanjiStrokes: vi.fn(),
    fetchKanjiBrushData: vi.fn(),
    recognizeHandwriting: vi.fn(),
    getKanjiIllustrationUrl: vi.fn((c: string) => `/api/v1/nhaikanji/illustration/${c}`),
  },
}))

const sampleKanji: KanjiSummary[] = [
  {
    kanji: '水',
    hanzi: 'THỦY',
    meaning_vi: 'Nước',
    meaning_en: 'nước',
    jlpt_level: 'N5',
    onyomi: 'スイ',
    kunyomi: 'みず',
    stroke_count: 4,
    radical_utf: '水',
    radical_family: '水',
    radical_vi_name: 'Thủy',
    radical_name_ja: 'みず',
    radical_meaning: 'Nước',
    story: 'Dòng nước (水) chảy',
    num_vocab_examples: 1,
  },
  {
    kanji: '海',
    hanzi: 'HẢI',
    meaning_vi: 'Biển',
    meaning_en: 'nước',
    jlpt_level: 'N4',
    onyomi: 'カイ',
    kunyomi: 'うみ',
    stroke_count: 9,
    radical_utf: '氵',
    radical_family: '水',
    radical_vi_name: 'Thủy',
    radical_name_ja: 'さんずい',
    radical_meaning: 'Nước',
    story: 'Nước (氵) tụ thành biển',
    num_vocab_examples: 1,
  },
]

const sampleDetailWater: KanjiDetailData = {
  kanji: '水',
  hasIllustration: false,
  summary: sampleKanji[0] ?? null,
  detail: {
    kanji: '水',
    kanjiInfo: {
      id: '1',
      hanzi: 'THỦY',
      meaning: 'Nước',
      story: 'Dòng nước (水) chảy',
      jlptLevel: 'N5',
      kanjialiveData: {
        rad_name_ja: 'みず',
        onyomi_ja: 'スイ',
        kunyomi_ja: 'みず',
        rad_utf: '水',
        rad_meaning: 'Nước',
        examples: [
          {
            id: 'w-1',
            word: '水曜日',
            reading: 'すいようび',
            meaning: 'Thứ Tư',
            yinHan: 'THỦY DIỆU NHẬT',
            example: '水曜日に会いましょう。',
            exampleVi: 'Hẹn gặp vào thứ Tư.',
          },
        ],
      },
    },
  },
  relatedByRadical: sampleKanji[1] ? [sampleKanji[1]] : [],
  relatedByHanzi: [],
  phonetics: { onyomiRomaji: 'sui', kunyomiRomaji: 'mizu' },
}

const sampleDetailSea: KanjiDetailData = {
  kanji: '海',
  hasIllustration: false,
  summary: sampleKanji[1] ?? null,
  detail: {
    kanji: '海',
    kanjiInfo: {
      id: '2',
      hanzi: 'HẢI',
      meaning: 'Biển',
      story: 'Nước (氵) tụ thành biển',
      jlptLevel: 'N4',
      kanjialiveData: {
        rad_name_ja: 'さんずい',
        onyomi_ja: 'カイ',
        kunyomi_ja: 'うみ',
        rad_utf: '氵',
        rad_meaning: 'Nước',
        examples: [],
      },
    },
  },
  relatedByRadical: sampleKanji[0] ? [sampleKanji[0]] : [],
  relatedByHanzi: [],
  phonetics: { onyomiRomaji: 'kai', kunyomiRomaji: 'umi' },
}

function renderKanjiPage(path = '/tra-tu?tab=kanji') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={[path]}>
      <UrlStateProvider>
        <QueryClientProvider client={client}>
          <KanjiPage viewMode="grid" onChangeViewMode={vi.fn()} />
        </QueryClientProvider>
      </UrlStateProvider>
    </MemoryRouter>
  )
}

describe('KanjiPage Washi Ledger Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(nhaikanjiApi.fetchKanjiList).mockResolvedValue({
      items: sampleKanji,
      total: 2,
      page: 1,
      limit: 48,
      totalPages: 1,
      levelCounts: { ALL: 2, N5: 1, N4: 1, N3: 0, N2: 0, N1: 0 },
      catalogCounts: { ALL: 2517, N5: 118, N4: 209, N3: 375, N2: 505, N1: 1310 },
    })
    vi.mocked(nhaikanjiApi.recognizeHandwriting).mockResolvedValue({ candidates: sampleKanji, source: 'ime' })
    vi.mocked(nhaikanjiApi.fetchKanjiDetail).mockImplementation(async (char: string) =>
      char === '海' ? sampleDetailSea : sampleDetailWater
    )
    vi.mocked(nhaikanjiApi.fetchKanjiBrushData).mockResolvedValue(null)
    vi.mocked(nhaikanjiApi.fetchKanjiStrokes).mockResolvedValue({
      kanji: '水',
      code: '06c34',
      strokeCount: 4,
      strokes: [],
      numbers: [],
    })
  })

  it('renders dedicated search console, live level counts, 1-click Lưu button, and zero native select controls', async () => {
    const { container } = renderKanjiPage()

    expect(await screen.findByRole('heading', { name: 'Kho Hán Tự (Kanji) & Chiết Tự' })).toBeTruthy()
    expect(container.querySelectorAll('select').length).toBe(0)
    expect(await screen.findByText('THỦY')).toBeTruthy()
    expect(screen.getByText('HẢI')).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Kanji N5/ }).textContent).toContain('1')
    expect(screen.getByLabelText('Tìm kiếm Hán tự')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Vẽ chữ/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Bộ thủ/ })).toBeNull()
    expect(screen.queryByText('Chưa lưu')).toBeNull()
    expect(screen.getAllByRole('button', { name: /^Lưu / }).length).toBe(2)
  })

  it('toggles handwriting pad and supports dedicated multi-script search', async () => {
    renderKanjiPage()
    await screen.findByText('THỦY')

    fireEvent.click(screen.getByRole('button', { name: /Vẽ chữ/ }))
    expect(await screen.findByRole('region', { name: 'Bảng vẽ nhận diện Hán tự' })).toBeTruthy()

    const searchInput = screen.getByLabelText('Tìm kiếm Hán tự')
    fireEvent.change(searchInput, { target: { value: 'mizu' } })
    await waitFor(() =>
      expect(nhaikanjiApi.fetchKanjiList).toHaveBeenCalledWith(expect.objectContaining({ query: 'mizu', page: 1 }))
    )
  })

  it('opens detail modal without footer, with header SRS save, individual reading pills, and blank-outline practice', async () => {
    renderKanjiPage()
    await screen.findByText('THỦY')

    // Open KanjiDetailModal
    fireEvent.click(screen.getByText('THỦY'))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(within(dialog).queryByRole('button', { name: 'Diễn lại bút pháp' })).toBeNull()
    expect(within(dialog).getByRole('button', { name: 'Đóng sân khấu thư pháp' })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Lưu sổ tay' })).toBeTruthy()
    expect(await within(dialog).findByText('水曜日')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Nghe phát âm 水曜日' })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Nghe câu 水曜日に会いましょう。' })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'スイ' })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'みず' })).toBeTruthy()
    expect(await within(dialog).findByText('Cùng bộ 水 (Thủy)')).toBeTruthy()

    // Navigate to peer 海 and verify Exploration Back button in header
    fireEvent.click(within(dialog).getByRole('button', { name: /海\s*HẢI/ }))
    expect(await within(dialog).findByRole('button', { name: 'Quay lại 水' })).toBeTruthy()

    // Switch to Practice view and verify ONLY Chấm nét chuẩn (no Vung cọ tự do) & glyph masked
    fireEvent.click(within(dialog).getByRole('button', { name: /Luyện viết nét/i }))
    expect(within(dialog).queryByRole('button', { name: 'Vung cọ tự do' })).toBeNull()
    expect(within(dialog).getByText(/？ • HẢI/)).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: /Bút pháp/i })).toBeTruthy()
  })

  it('supports inline Lật thẻ flashcard study mode right inside KanjiPage', async () => {
    renderKanjiPage()
    await screen.findByText('THỦY')

    fireEvent.click(screen.getByRole('button', { name: 'Lật thẻ' }))
    const card = await screen.findByRole('button', { name: /Mặt trước thẻ Hán tự/ })
    fireEvent.click(card)

    expect(await screen.findByText(/Dòng nước \(水\) chảy/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Mở chi tiết & Tập viết/ })).toBeTruthy()
  })
})
