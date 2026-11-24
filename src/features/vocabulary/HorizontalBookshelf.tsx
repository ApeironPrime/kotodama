import { Library } from 'lucide-react'
import type { CurriculumCourseCard } from '../../types/curriculum'
import type { CuratedCourseMetadata } from './vocabularyCuratedData'
import { TactileWatojiCard } from './TactileWatojiCard'

interface HorizontalBookshelfProps {
  trackTitle: string
  items: Array<{ course: CurriculumCourseCard; meta: CuratedCourseMetadata }>
  onSelectCourse: (courseCode: string) => void
  onOpenDrawer: () => void
  knownByCourse?: Record<string, number>
}

export function HorizontalBookshelf({
  trackTitle,
  items,
  onSelectCourse,
  onOpenDrawer,
  knownByCourse,
}: HorizontalBookshelfProps) {
  const displayedItems = items.slice(0, 5)
  const hasMore = items.length > 5

  return (
    <div className="curriculum-standing-shelf-wrap">
      <div className="curriculum-horizontal-shelf-header">
        <div className="curriculum-horizontal-shelf-header__left">
          <span className="curriculum-companion-shelf__label">KỆ SÁCH ĐỒNG HÀNH · 同行書架</span>
          <span className="curriculum-companion-shelf__count">({items.length} đầu sách)</span>
        </div>

        {hasMore && (
          <div className="curriculum-horizontal-shelf-header__right">
            <button
              type="button"
              className="curriculum-shelf-open-drawer-btn"
              onClick={onOpenDrawer}
              title={`Mở toàn bộ ${items.length} đầu sách ${trackTitle}`}
              aria-label={`Mở toàn bộ ${items.length} đầu sách trong kho lưu trữ`}
            >
              <Library size={14} aria-hidden="true" />
              <span>Xem trọn bộ {items.length} đầu sách ↗</span>
            </button>
          </div>
        )}
      </div>

      <div className="curriculum-standing-shelf-grid" role="list" aria-label={`Kệ sách đồng hành ${trackTitle}`}>
        {displayedItems.map(({ course, meta }) => (
          <div key={course.course_code} className="curriculum-standing-shelf-cell" role="listitem">
            <TactileWatojiCard
              course={course}
              meta={meta}
              knownCount={knownByCourse?.[course.course_code] ?? 0}
              onSelect={onSelectCourse}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
