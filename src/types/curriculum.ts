export type CanonicalLevel = 'A1' | 'A2' | 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'SE'

export type RightsStatus = 'unknown' | 'verified' | 'public_domain' | 'licensed'

export type CourseVisibility = 'public' | 'unlisted' | 'private' | 'internal'

export interface CanonicalCourse {
  course_code: string
  title: string
  level: CanonicalLevel
  provider_source: string
  visibility: CourseVisibility
  rights_status: RightsStatus
  description?: string
}

export interface CanonicalUnit {
  unit_id: string // Format: `${course_code}:${unit_key}`
  course_code: string
  unit_key: string
  ordinal: number
  title: string
  topic?: string
}

export interface ExampleSentence {
  ja: string
  vi: string
}

export interface RawSourceReference {
  source: string
  raw_record_id: string | number
  lesson: string
  level: string
}

export interface CanonicalTerm {
  term_id: string
  normalized_key: string
  display_word: string
  display_reading: string
  meanings: string[]
  han_viet: string | null
  examples: ExampleSentence[]
  raw_source_references: RawSourceReference[]
}

export interface CanonicalCourseTerm {
  course_code: string
  unit_id: string
  term_id: string
  ordinal: number
  source_record_id: string | number
  provenance: {
    source: string
    rights_status: RightsStatus
    raw_level: string
    raw_lesson: string
  }
}

export interface RejectedRecord {
  index: number
  word: string
  reason: string
  raw?: unknown
}

export interface ValidationWarning {
  index: number
  code: string
  message: string
}

export interface CanonicalImportRun {
  source_manifest_hash: string
  importer_version: string
  total_input_records: number
  total_canonical_terms: number
  total_course_terms: number
  total_courses: number
  total_units: number
  warning_count: number
  error_count: number
  reject_list: RejectedRecord[]
  warnings: ValidationWarning[]
}

export interface CanonicalDataset {
  import_run: CanonicalImportRun
  courses: CanonicalCourse[]
  units: CanonicalUnit[]
  terms: CanonicalTerm[]
  course_terms: CanonicalCourseTerm[]
}

// --- T04 API Response Types ---

export interface CurriculumPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface CurriculumCourseCard {
  course_code: string
  title: string
  level: CanonicalLevel
  provider_source: string
  visibility: CourseVisibility
  rights_status: RightsStatus
  description: string
  unit_count: number
  term_count: number
}

export interface CurriculumUnitSummary {
  unit_id: string
  unit_key: string
  ordinal: number
  title: string
  topic: string
  term_count: number
}

export interface CurriculumCatalogData {
  items: CurriculumCourseCard[]
  pagination: CurriculumPagination
}

export interface CurriculumCourseDetailData {
  course: CurriculumCourseCard
  units: CurriculumUnitSummary[]
}

export interface CurriculumUnitDetailData {
  course: Pick<CanonicalCourse, 'course_code' | 'title' | 'level'>
  unit: CurriculumUnitSummary & { course_code: string }
}

export interface CurriculumTermCard {
  term_id: string
  ordinal: number
  normalized_key: string
  display_word: string
  display_reading: string
  meanings: string[]
  han_viet: string | null
  examples: ExampleSentence[]
}

export interface CurriculumUnitTermsData {
  course: Pick<CanonicalCourse, 'course_code' | 'title' | 'level' | 'rights_status'>
  unit: Pick<CanonicalUnit, 'unit_id' | 'unit_key' | 'ordinal' | 'title'>
  items: CurriculumTermCard[]
  pagination: CurriculumPagination
}
