export type SrsCardType = 'vocab' | 'kanji' | 'grammar'
export type SrsCardStage = 'new' | 'learning' | 'due' | 'mastered'
export type SrsRating = 'again' | 'hard' | 'good' | 'easy'

export interface SrsExample {
  jp: string
  jp_furigana?: string | undefined
  jp_ruby?: string | undefined
  vi?: string | undefined
  audio?: string | undefined
  readingExample?: string | undefined
  exampleVi?: string | undefined
}

export interface SrsCard {
  id: string
  type: SrsCardType
  term: string
  reading?: string | undefined
  hanViet?: string | undefined
  meaning: string
  jlptLevel?: string | undefined
  partOfSpeech?: string | undefined
  structure?: string | undefined
  explanation?: string | undefined
  radical?: string | undefined
  strokeCount?: number | undefined
  story?: string | undefined
  masteryPercentage: number
  stage: SrsCardStage
  repetition: number
  intervalDays: number
  easeFactor: number
  nextReviewDate: string
  groups?: GrammarUsageGroup[] | undefined
  examples?: SrsExample[] | undefined
}

export interface SrsHeatmapDay {
  date: string
  count: number
  level: number
}

export interface SrsStats {
  totalCards: number
  masteredCount: number
  dueTodayCount: number
  averageMastery: number
  vocabCount?: number
  grammarCount?: number
  kanjiCount?: number
  streak?: number
  longestStreak?: number
  reviewedToday?: number
  heatmap?: SrsHeatmapDay[]
}

export interface SrsDeckResponse {
  items: SrsCard[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface CurriculumWord {
  id: number
  curriculumCode: string
  unitNumber: number
  unitTitle: string
  lessonTitle: string
  indexNum: number
  word: string
  reading: string
  hanViet: string
  meaning: string
  jlptLevel: string
  partOfSpeech: string
  examples: Array<{ jp: string; vi: string }>
  audioUrl?: string
}

export interface GrammarUsageGroup {
  group_no?: number
  title?: string
  meaning?: string
  structure?: string
  usage?: string
  examples: Array<{
    no?: number | string
    jp: string
    jp_furigana?: string
    jp_ruby?: string
    vi?: string
    audio?: string
  }>
}

export interface CurriculumGrammar {
  id: string
  source: string
  curriculumCode: string
  lessonId: string
  lessonTitle: string
  title: string
  pattern: string
  structure: string
  shortMeaning: string
  explanation: string
  usageScope?: string
  notes?: string
  level: string
  groups?: GrammarUsageGroup[]
  examples: Array<{
    no?: number | string
    jp: string
    jp_furigana?: string
    jp_ruby?: string
    vi?: string
    audio?: string
  }>
}
