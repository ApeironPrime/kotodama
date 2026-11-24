import type { CurriculumCourseCard } from '../../types/curriculum'
import type { CuratedCourseMetadata } from './vocabularyCuratedData'
import { WatojiBookCover } from './WatojiBookCover'
import { playWashiPaperSound } from './tactileAudio'

interface TactileWatojiCardProps {
  course: CurriculumCourseCard
  meta: CuratedCourseMetadata
  onSelect: (courseCode: string) => void
  knownCount?: number
}

const VI_NUMBER = new Intl.NumberFormat('vi-VN')

export function TactileWatojiCard({ course, meta, onSelect, knownCount = 0 }: TactileWatojiCardProps) {
  const shortPublisher = meta.publisher.split('·')[0]?.trim() || meta.publisher
  const hasProgress = knownCount > 0 && course.term_count > 0
  const progressPct = hasProgress ? Math.min(100, Math.max(4, Math.round((knownCount / course.term_count) * 100))) : 0

  return (
    <article
      className="curriculum-standing-book"
      tabIndex={0}
      role="button"
      aria-label={`Khóa học ${course.title}, ${meta.levelDisplay}`}
      onClick={() => onSelect(course.course_code)}
      onMouseEnter={() => playWashiPaperSound()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(course.course_code)
        }
      }}
    >
      <div className="curriculum-standing-book__shelf">
        <div className="curriculum-standing-book__cover-wrap">
          <WatojiBookCover
            bookTitle={course.title}
            size="companion"
            variant={meta.coverVariant}
            obiTone={meta.obiTone}
            kanjiTitle={meta.kanjiTitle}
            volumeTag={meta.volumeTag}
            level={course.level}
            palette={meta.palette}
            pattern={meta.pattern}
            sealChar={meta.sealChar}
          />
          {hasProgress && (
            <div className="curriculum-book-progress-bar" aria-hidden="true">
              <span style={{ width: `${progressPct}%` }} />
            </div>
          )}
        </div>
      </div>

      <div className="curriculum-standing-book__meta">
        <span className="curriculum-standing-book__eyebrow">
          {course.level} · {shortPublisher}
        </span>
        <h4 className="curriculum-standing-book__title">{course.title}</h4>
        <span className="curriculum-standing-book__count">
          {course.unit_count} bài · {VI_NUMBER.format(course.term_count)} từ
        </span>
        {hasProgress && (
          <span className="curriculum-standing-book__progress-text">
            Đã thuộc {VI_NUMBER.format(Math.min(knownCount, course.term_count))} / {VI_NUMBER.format(course.term_count)}{' '}
            từ
          </span>
        )}
      </div>
    </article>
  )
}
