export type KanjiSummary = {
  kanji: string
  hanzi: string
  meaning_vi: string
  meaning_en: string
  jlpt_level: string
  onyomi: string
  kunyomi: string
  stroke_count: string | number
  radical_utf: string
  radical_name_ja: string
  radical_meaning: string
  story: string
  num_vocab_examples: string | number
  prev_kanji?: string
  next_kanji?: string
}

export type KanjiVocabExample = {
  id?: number | string
  word: string
  reading: string
  meaning: string
  yinHan?: string
  audio?: string
  yomikata?: number[]
  main?: number[]
  accents?: number[]
  example?: string
  readingExample?: string
  exampleVi?: string
  audioExample?: string
  audioWaveform?: number[]
}

export type KanjiDetailData = {
  kanji: string
  summary: KanjiSummary | null
  detail: {
    kanji: string
    kanjiInfo: {
      id: string
      hanzi: string
      meaning: string
      story: string
      jlptLevel: string
      kanjialiveData: {
        rad_name_ja: string
        onyomi_ja: string
        kunyomi_ja: string
        rad_utf: string
        rad_meaning: string
        examples: KanjiVocabExample[]
      }
    }
  } | null
}

export type BunpoItem = {
  id: string
  pattern: string
  structure: string
  shortMeaning: string
  bookId: string
  bookName: string
  level: string
  lessonId: string
  lessonTitle: string
}

export type JlptExamSummary = {
  id: string
  title?: string
  level: string
  year?: number | string
  session?: number | string
  section: string
  sectionLabel: string
  sectionLabelJP: string
  timeLimit: number
  questionCount: number
  audioUrl?: string
  isFullMock?: boolean
  available: boolean
}

export type JlptOption = {
  id: string | number
  text: string
}

export type JlptAudioSegment = {
  start: number
  end: number
  ja: string
  vi?: string
}

export type JlptQuestion = {
  id: string
  number: number
  text?: string
  question?: string
  sentence?: string
  underlined?: string
  options?: Array<JlptOption | string> | string[]
  audio?: string | null
  audioUrl?: string | null
  image?: string | null
  passage?: string | null
  script?: string | null
  scriptVi?: string | null
  audioStart?: number
  audioEnd?: number
  audioSegments?: JlptAudioSegment[]
  correctAnswer?: number | string
  answer?: number | string
  scoreWeight?: number
  explanation?: string
}

export type JlptPart = {
  id?: string
  title?: string
  titleJP?: string
  sectionType?: number
  instruction?: string
  audioUrl?: string
  passage?: string | null
  questions: JlptQuestion[]
}

export type JlptExamDetail = {
  id: string
  title?: string
  level: string
  year?: number | string
  session?: number | string
  section: string
  sectionLabel: string
  sectionLabelJP: string
  timeLimit: number
  audioUrl?: string
  isFullMock?: boolean
  available?: boolean
  parts: JlptPart[]
}

export type JlptSectionalScore = {
  name: string
  correct: number
  total: number
  percentage: number
  scaledScore: number
  maxScore: number
  minPass: number
  isBelowThreshold: boolean
}

export type JlptSectionBreakdownItem = {
  name: string
  nameVi: string
  score: number
  max: number
  minPass: number
  isFailed: boolean
  correct: number
  total: number
}

export type JlptSubmissionResult = {
  examId: string
  title?: string
  level?: string
  isFullMock?: boolean
  totalQuestions: number
  correctCount: number
  scorePercentage: number
  passPercentage?: number
  scaledTotalScore?: number
  maxScore180?: number
  passScore180?: number
  cefrLevel?: string
  passed: boolean
  resultStatus?: 'PASSED' | 'FAILED_SCORE' | 'FAILED_SECTIONAL' | string
  resultMessage?: string
  hasSectionalFailure?: boolean
  sectionBreakdown?: {
    section1: JlptSectionBreakdownItem
    section2: JlptSectionBreakdownItem
    section3: JlptSectionBreakdownItem
  }
  sectionalScores?: JlptSectionalScore[]
  questionResults: Array<{
    id: string
    number: number
    partTitle?: string
    questionText?: string
    passage?: string | null
    image?: string | null
    audio?: string | null
    script?: string | null
    scriptVi?: string | null
    audioStart?: number
    audioEnd?: number
    audioSegments?: JlptAudioSegment[]
    options?: Array<JlptOption | string> | string[]
    scoreWeight?: number
    userAnswer: string | number | null
    correctAnswer: string | number
    isCorrect: boolean
    explanation?: string
  }>
}
