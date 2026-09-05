// @vitest-environment jsdom

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { KanjiPage } from './KanjiPage'
import { KanjiDetailModal } from './KanjiDetailModal'
import { BunpoPage } from './BunpoPage'
import { JlptPage } from './JlptPage'
import { nhaikanjiApi } from './nhaikanjiApi'
import { srsApi } from '../srs/srsApi'
import type { KanjiSummary, JlptExamDetail } from './nhaikanjiTypes'

vi.mock('../srs/srsApi', () => ({
  srsApi: {
    fetchCurriculumGrammar: vi.fn(),
    fetchLessons: vi.fn(),
    addCard: vi.fn(),
  },
}))

vi.mock('./nhaikanjiApi', () => ({
  nhaikanjiApi: {
    fetchKanjiList: vi.fn(),
    fetchKanjiDetail: vi.fn(),
    fetchBunpoList: vi.fn(),
    fetchJlptExams: vi.fn(),
    fetchJlptExamDetail: vi.fn(),
    submitJlptExam: vi.fn(),
  },
}))

function renderWithClient(ui: React.ReactElement) {
  const testClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={testClient}>{ui}</QueryClientProvider>)
}

describe('NhaiKanji Frontend Feature Suite', () => {
  const sampleKanji: KanjiSummary = {
    kanji: '土',
    hanzi: 'THỔ',
    meaning_vi: 'Đất',
    meaning_en: 'soil, earth',
    jlpt_level: 'N5',
    onyomi: 'ド、ト',
    kunyomi: 'つち',
    stroke_count: 3,
    radical_utf: '⼟',
    radical_name_ja: 'つち',
    radical_meaning: 'earth',
    story: 'Cắm cây thập (十) xuống 1 (一) mảnh đất (土)',
    num_vocab_examples: 3,
  }

  it('renders KanjiPage with level filters and kanji card list', async () => {
    vi.mocked(nhaikanjiApi.fetchKanjiList).mockResolvedValue({
      items: [sampleKanji],
      total: 1,
      page: 1,
      limit: 48,
      totalPages: 1,
    })

    renderWithClient(<KanjiPage />)

    expect(screen.getByText('Kho Hán Tự (Kanji) & Chiết Tự')).toBeTruthy()
    expect(screen.getByText('Kanji N5')).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText('土')).toBeTruthy()
      expect(screen.getByText('THỔ')).toBeTruthy()
      expect(screen.getByText('Đất')).toBeTruthy()
    })
  })

  it('renders KanjiDetailModal with mnemonic story and switches to writing canvas tab', async () => {
    vi.mocked(nhaikanjiApi.fetchKanjiDetail).mockResolvedValue({
      kanji: '土',
      summary: sampleKanji,
      detail: {
        kanji: '土',
        kanjiInfo: {
          id: '土',
          hanzi: 'THỔ',
          meaning: 'Đất',
          story: 'Cắm cây thập (十) xuống 1 (一) mảnh đất (土)',
          jlptLevel: 'N5',
          kanjialiveData: {
            rad_name_ja: 'つち',
            onyomi_ja: 'ド、ト',
            kunyomi_ja: 'つち',
            rad_utf: '⼟',
            rad_meaning: 'earth',
            examples: [
              {
                word: '土曜日',
                reading: 'どようび',
                meaning: 'Thứ bảy',
                yinHan: 'THỔ DIỆU NHẬT',
                audio: 'https://example.com/audio.mp3',
              },
            ],
          },
        },
      },
    })

    renderWithClient(<KanjiDetailModal kanjiSummary={sampleKanji} onClose={() => {}} />)

    expect(screen.getByText('Chiết tự & Câu chuyện gợi nhớ')).toBeTruthy()
    expect(screen.getByText(/Cắm cây thập/)).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText('土曜日')).toBeTruthy()
      expect(screen.getByText('Thứ bảy')).toBeTruthy()
    })

    // Switch to practice canvas tab
    const practiceTab = screen.getByRole('button', { name: /Luyện viết nét/i })
    fireEvent.click(practiceTab)
    expect(screen.getByText(/Tập viết chữ:/i)).toBeTruthy()
  })

  it('renders BunpoPage with grammar rules', async () => {
    vi.mocked(srsApi.fetchLessons).mockResolvedValue([{ lesson_id: 'lesson1', lesson_title: '1課 〜とき', count: 6 }])

    vi.mocked(srsApi.fetchCurriculumGrammar).mockResolvedValue({
      items: [
        {
          id: 'futsuu-n-desu',
          source: 'shinkanzen',
          curriculumCode: 'shinkanzen_n3',
          lessonId: 'lesson1',
          lessonTitle: '1課 〜とき',
          title: '〜うちに①',
          pattern: '〜うちに①',
          structure: 'Vる + うちに',
          shortMeaning: 'Nhân lúc, khi còn',
          explanation: 'Dùng trong giải thích nguyên nhân',
          level: 'N3',
          examples: [
            {
              jp: '明るいうちに帰る。',
              vi: 'Về khi trời còn sáng.',
            },
          ],
        },
      ],
      total: 1,
      page: 1,
      limit: 100,
      totalPages: 1,
    })

    renderWithClient(<BunpoPage />)

    expect(screen.getByText(/Kho Giáo Trình Ngữ Pháp/i)).toBeTruthy()

    // Click N3 Shinkanzen Book
    const n3BookCard = screen.getByText('Shinkanzen Master N3')
    fireEvent.click(n3BookCard)

    // Click Lesson 1
    const lesson1Card = await screen.findByText(/1課 〜とき/i)
    fireEvent.click(lesson1Card)

    // Verify pattern and meaning
    const patternEls = await screen.findAllByText('〜うちに①')
    expect(patternEls.length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Nhân lúc, khi còn/i).length).toBeGreaterThan(0)
  })

  it('renders BunpoPage with multi-group Mimikara grammar flashcard, furigana ruby, and 1 example per meaning', async () => {
    vi.mocked(srsApi.fetchLessons).mockResolvedValue([
      { lesson_id: '1', lesson_title: 'Bài 1 (Mẫu 1 - 10)', count: 10 },
    ])

    vi.mocked(srsApi.fetchCurriculumGrammar).mockResolvedValue({
      items: [
        {
          id: 'mimikara_n3_5',
          source: 'mimikara',
          curriculumCode: 'mimikara_n3',
          lessonId: '1',
          lessonTitle: 'Bài 1 (Mẫu 1 - 10)',
          title: '～みたいだ',
          pattern: '～みたいだ',
          structure: 'N＋みたいだ／V普通形＋みたいだ',
          shortMeaning: 'Có vẻ như…/Hình như…',
          explanation: 'Diễn tả phán đoán dựa trên dấu hiệu nhưng chưa chắc chắn',
          level: 'N3',
          groups: [
            {
              group_no: 1,
              title: '～みたいだ',
              meaning: 'Có vẻ như…/Hình như…',
              structure: 'N＋みたいだ／V普通形＋みたいだ',
              usage: 'Diễn tả phán đoán dựa trên dấu hiệu',
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
              title: '～みたいだ',
              meaning: 'Cứ như là…',
              structure: 'N／V普通形',
              usage: 'Diễn tả cảm giác cứ như là...',
              examples: [
                {
                  no: 1,
                  jp: '宝くじで１０００万円当たった。夢みたいだ。',
                  jp_ruby: '<ruby>宝<rt>たから</rt></ruby>くじで当たった。',
                  vi: 'Trúng xổ số. Cứ như đang mơ vậy.',
                },
              ],
            },
            {
              group_no: 3,
              title: '～みたいだ',
              meaning: 'Như là, kiểu như…',
              structure: 'N＋みたいだ',
              usage: 'Dùng để nêu một ví dụ tiêu biểu',
              examples: [
                {
                  no: 1,
                  jp: 'ハワイみたいな暖かいところで暮らしたい。',
                  jp_ruby: '<ruby>暮<rt>く</rt></ruby>らしたい。',
                  vi: 'Tôi muốn sống ở nơi ấm như Hawaii.',
                },
              ],
            },
          ],
          examples: [],
        },
      ],
      total: 1,
      page: 1,
      limit: 100,
      totalPages: 1,
    })

    renderWithClient(<BunpoPage />)

    // Click Mimikara N3 Book
    const mimiBookCard = screen.getByText('Mimikara Oboeru N3 (耳から覚える文法)')
    fireEvent.click(mimiBookCard)

    // Click Lesson 1
    const lesson1Card = await screen.findByText(/Bài 1 \(Mẫu 1 - 10\)/i)
    fireEvent.click(lesson1Card)

    // Verify Flashcard Front contains multi-usage badge
    expect(await screen.findByText(/Gồm 3 nghĩa & cách dùng/i)).toBeTruthy()

    // Flip the Flashcard (press Space or click front)
    const flashcardFrontPrompt = screen.getByText(/Nhấn \[Space\] hoặc chạm để lật xem ý nghĩa & 1 ví dụ mỗi nghĩa/i)
    fireEvent.click(flashcardFrontPrompt)

    // Verify Back Side contains all 3 distinct meanings
    expect(await screen.findByText('Có vẻ như…/Hình như…')).toBeTruthy()
    expect(screen.getByText('Cứ như là…')).toBeTruthy()
    expect(screen.getByText('Như là, kiểu như…')).toBeTruthy()

    // Verify 1 representative example sentence with ruby and translation for each group is rendered
    expect(screen.getAllByText('Trời có nhiều sao. Có vẻ mai cũng sẽ nắng.').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Trúng xổ số. Cứ như đang mơ vậy.').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Tôi muốn sống ở nơi ấm như Hawaii.').length).toBeGreaterThanOrEqual(1)

    // Verify read-aloud speaker buttons exist
    const speakButtons = screen.getAllByTitle(/Nghe đọc câu ví dụ|Nghe phát âm/i)
    expect(speakButtons.length).toBeGreaterThanOrEqual(3)
  })

  it('renders JlptPage and allows entering the exam room', async () => {
    vi.mocked(nhaikanjiApi.fetchJlptExams).mockResolvedValue({
      exams: [
        {
          id: 'n4-2025-1-vocab',
          level: 'N4',
          year: 2025,
          session: 1,
          section: 'vocab',
          sectionLabel: 'Từ vựng',
          sectionLabelJP: '言語知識（文字・語彙）',
          timeLimit: 25,
          questionCount: 20,
          available: true,
        },
      ],
    })

    const sampleExamDetail: JlptExamDetail = {
      id: 'n4-2025-1-vocab',
      level: 'N4',
      year: 2025,
      session: 1,
      section: 'vocab',
      sectionLabel: 'Từ vựng',
      sectionLabelJP: '言語知識（文字・語彙）',
      timeLimit: 25,
      available: true,
      parts: [
        {
          title: 'Phần 1: Cách đọc Kanji',
          instruction: 'Chọn cách đọc đúng cho từ gạch chân',
          questions: [
            {
              id: 'q1',
              number: 1,
              text: '田中さんは【学生】です。',
              options: ['がくせい', 'がくしょう', 'だいがく', 'せんせい'],
              correctAnswer: 1,
              explanation: '学生 đọc là がくせい',
            },
          ],
        },
      ],
    }
    vi.mocked(nhaikanjiApi.fetchJlptExamDetail).mockResolvedValue(sampleExamDetail)
    vi.mocked(nhaikanjiApi.submitJlptExam).mockResolvedValue({
      examId: 'n4-2025-1-vocab',
      totalQuestions: 1,
      correctCount: 1,
      scorePercentage: 100,
      passed: true,
      questionResults: [
        {
          id: 'q1',
          number: 1,
          questionText: '田中さんは【学生】です。',
          userAnswer: 1,
          correctAnswer: 1,
          isCorrect: true,
          explanation: '学生 đọc là がくせい',
        },
      ],
    })

    renderWithClient(<JlptPage />)

    expect(screen.getByText('Luyện Thi JLPT Trực Tuyến')).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText('Vào làm bài')).toBeTruthy()
    })

    // Click vào làm bài
    fireEvent.click(screen.getByText('Vào làm bài'))

    await waitFor(() => {
      expect(screen.getByText('田中さんは【学生】です。')).toBeTruthy()
      expect(screen.getByText('がくせい')).toBeTruthy()
    })

    // Chọn đáp án 1
    fireEvent.click(screen.getByText('がくせい'))

    // Nộp bài thi
    const submitBtn = screen.getAllByRole('button', { name: /Nộp bài thi/i })[0]
    if (submitBtn) {
      fireEvent.click(submitBtn)
    }

    await waitFor(() => {
      expect(screen.getByText(/CHÚC MỪNG! BẠN ĐÃ ĐỖ/i)).toBeTruthy()
      expect(screen.getByText('100%')).toBeTruthy()
    })
  })

  it('renders listening script and Vietnamese translation when a listening exam is submitted', async () => {
    const sampleListeningExam: JlptExamDetail = {
      id: 'n3-2018-12-listening',
      title: 'JLPT-N3 12 2018 - Nghe Hiểu (聴解)',
      level: 'N3',
      section: 'listening',
      sectionLabel: 'Nghe hiểu',
      sectionLabelJP: '聴解',
      timeLimit: 40,
      parts: [
        {
          title: 'Mondai 2',
          questions: [
            {
              id: 'q7',
              number: 7,
              question: '7 番',
              options: [
                'レポートはよくできていなかったこと',
                'アルバイトをしすぎていること',
                '奨学金のおうぼに間に合わなかったこと',
                '体の調子がわるそうなこと',
              ],
              correctAnswer: 2,
              script: '大学の事務所で事務所の人と学生が話しています。\n男：加藤さん、最近アルバイトしすぎじゃない？',
              scriptVi: 'Tại văn phòng trường đại học, nhân viên và sinh viên đang nói chuyện.',
            },
          ],
        },
      ],
    }

    vi.mocked(nhaikanjiApi.fetchJlptExams).mockResolvedValue({
      exams: [
        {
          id: 'n3-2018-12-listening',
          title: 'JLPT-N3 12 2018 - Nghe Hiểu (聴解)',
          level: 'N3',
          section: 'listening',
          sectionLabel: 'Nghe hiểu',
          sectionLabelJP: '聴解',
          questionCount: 1,
          timeLimit: 40,
          available: true,
        },
      ],
    })
    vi.mocked(nhaikanjiApi.fetchJlptExamDetail).mockResolvedValue(sampleListeningExam)
    vi.mocked(nhaikanjiApi.submitJlptExam).mockResolvedValue({
      examId: 'n3-2018-12-listening',
      totalQuestions: 1,
      correctCount: 1,
      scorePercentage: 100,
      passed: true,
      questionResults: [
        {
          id: 'q7',
          number: 7,
          questionText: '7 番',
          userAnswer: 2,
          correctAnswer: 2,
          isCorrect: true,
          script: '大学の事務所で事務所の人と学生が話しています。\n男：加藤さん、最近アルバイトしすぎじゃない？',
          scriptVi: 'Tại văn phòng trường đại học, nhân viên và sinh viên đang nói chuyện.',
        },
      ],
    })

    renderWithClient(<JlptPage />)

    await waitFor(() => {
      expect(screen.getByText('Vào làm bài')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Vào làm bài'))

    await waitFor(() => {
      expect(screen.getByText('アルバイトをしすぎていること')).toBeTruthy()
    })

    // Chọn đáp án 2
    fireEvent.click(screen.getByText('アルバイトをしすぎていること'))

    // Nộp bài thi
    const submitBtn = screen.getAllByRole('button', { name: /Nộp bài thi/i })[0]
    expect(submitBtn).toBeDefined()
    if (submitBtn) {
      fireEvent.click(submitBtn)
    }

    // Kiểm tra xem Script có xuất hiện không
    await waitFor(() => {
      expect(screen.getByText(/Lời thoại bài nghe \(Script\)/i)).toBeTruthy()
      expect(screen.getByText(/Tiếng Nhật/i)).toBeTruthy()
      expect(screen.getByText(/加藤さん、最近アルバイトしすぎじゃない？/)).toBeTruthy()
      expect(screen.getByText(/Dịch nghĩa tiếng Việt/i)).toBeTruthy()
      expect(screen.getByText(/Tại văn phòng trường đại học, nhân viên và sinh viên đang nói chuyện./)).toBeTruthy()
    })
  })

  it('renders Full Mock Exam with 180 score certificate, question palette, and section breakdown', async () => {
    const fullMockExam: JlptExamDetail = {
      id: 'toan-n3-202512-full',
      title: 'JLPT N3 - Tháng 12/2025 (Thi Thử Trọn Gói 180 Điểm)',
      level: 'N3',
      year: '2025',
      session: '12',
      section: 'full_mock',
      sectionLabel: 'Đề thi thử Trọn gói (180 điểm)',
      sectionLabelJP: '総合模擬試験 (180点満点)',
      timeLimit: 140,
      isFullMock: true,
      available: true,
      parts: [
        {
          title: 'Phần 1: Từ vựng',
          questions: [
            {
              id: 'toan-q1',
              number: 1,
              text: '【案内】します。',
              options: ['あんない', 'あんないい', 'あんないし', 'あんないじん'],
              correctAnswer: 1,
            },
          ],
        },
        {
          title: 'Phần 2: Đọc hiểu',
          questions: [
            {
              id: 'toan-q2',
              number: 2,
              text: '文章を読んで質問に答えてください。',
              passage: '<p>Đây là đoạn văn đọc hiểu mẫu</p>',
              options: ['Đáp án 1', 'Đáp án 2', 'Đáp án 3', 'Đáp án 4'],
              correctAnswer: 1,
            },
          ],
        },
        {
          title: 'Phần 3: Nghe hiểu',
          questions: [
            {
              id: 'toan-q3',
              number: 3,
              text: '問題 1',
              audio: 'https://example.com/audio1.mp3',
              options: ['1', '2', '3', '4'],
              correctAnswer: 3,
              script: '男の人と女の人が話しています。',
            },
          ],
        },
      ],
    }

    vi.mocked(nhaikanjiApi.fetchJlptExams).mockResolvedValue({
      exams: [
        {
          id: 'toan-n3-202512-full',
          title: 'JLPT N3 - Tháng 12/2025 (Thi Thử Trọn Gói 180 Điểm)',
          level: 'N3',
          year: '2025',
          session: '12',
          section: 'full_mock',
          sectionLabel: 'Đề thi thử Trọn gói (180 điểm)',
          sectionLabelJP: '総合模擬試験 (180点満点)',
          timeLimit: 140,
          questionCount: 3,
          isFullMock: true,
          available: true,
        },
      ],
    })
    vi.mocked(nhaikanjiApi.fetchJlptExamDetail).mockResolvedValue(fullMockExam)
    vi.mocked(nhaikanjiApi.submitJlptExam).mockResolvedValue({
      examId: 'toan-n3-202512-full',
      title: 'JLPT N3 - Tháng 12/2025 (Thi Thử Trọn Gói 180 Điểm)',
      level: 'N3',
      isFullMock: true,
      totalQuestions: 3,
      correctCount: 3,
      scorePercentage: 100,
      scaledTotalScore: 180,
      maxScore180: 180,
      passScore180: 95,
      cefrLevel: 'B1',
      passed: true,
      resultMessage: 'CHÚC MỪNG! BẠN ĐÃ ĐỖ KỲ THI JLPT N3 (180/180 Điểm - CEFR B1)',
      sectionBreakdown: {
        section1: {
          name: '言語知識(文字・語彙・文法)',
          nameVi: 'Từ vựng & Ngữ pháp',
          score: 60,
          max: 60,
          minPass: 19,
          isFailed: false,
          correct: 1,
          total: 1,
        },
        section2: {
          name: '読解',
          nameVi: 'Đọc hiểu',
          score: 60,
          max: 60,
          minPass: 19,
          isFailed: false,
          correct: 1,
          total: 1,
        },
        section3: {
          name: '聴解',
          nameVi: 'Nghe hiểu',
          score: 60,
          max: 60,
          minPass: 19,
          isFailed: false,
          correct: 1,
          total: 1,
        },
      },
      questionResults: [
        {
          id: 'toan-q1',
          number: 1,
          userAnswer: 1,
          correctAnswer: 1,
          isCorrect: true,
        },
        {
          id: 'toan-q2',
          number: 2,
          userAnswer: 1,
          correctAnswer: 1,
          isCorrect: true,
        },
        {
          id: 'toan-q3',
          number: 3,
          userAnswer: 3,
          correctAnswer: 3,
          isCorrect: true,
          script: '男の人と女の人が話しています。',
        },
      ],
    })

    renderWithClient(<JlptPage />)

    await waitFor(() => {
      expect(screen.getAllByText(/180 ĐIỂM/i).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByRole('button', { name: /Thi Thử Ngay/i })).toBeTruthy()
    })

    // Click Thi Thử Ngay button
    fireEvent.click(screen.getByRole('button', { name: /Thi Thử Ngay/i }))

    // Verify Question Palette and question rendering
    await waitFor(() => {
      expect(screen.getAllByText(/Từ vựng/i).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('【案内】します。')).toBeTruthy()
    })

    // Click option
    fireEvent.click(screen.getByText('あんない'))

    // Submit
    const submitBtn = screen.getAllByRole('button', { name: /Nộp bài thi/i })[0]
    expect(submitBtn).toBeDefined()
    if (submitBtn) {
      fireEvent.click(submitBtn)
    }

    // Verify Certificate rendered
    await waitFor(() => {
      expect(screen.getByText('試験結果発表')).toBeTruthy()
      expect(screen.getByText('THÍ SINH ẨN DANH')).toBeTruthy()
      expect(screen.getByText(/合格 Đỗ/i)).toBeTruthy()
      expect(screen.getByText(/Mức CEFR:/i)).toBeTruthy()
      expect(screen.getByText('B1')).toBeTruthy()
      expect(screen.getAllByText('180').length).toBeGreaterThanOrEqual(1)
    })
  })
})
