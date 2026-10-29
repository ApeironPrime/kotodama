import { useRef, useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Library } from 'lucide-react'
import type { CurriculumCourseCard } from '../../types/curriculum'
import type { CuratedCourseMetadata } from './vocabularyCuratedData'
import { TactileWatojiCard } from './TactileWatojiCard'
import { playWoodShelfSound } from './tactileAudio'

interface HorizontalBookshelfProps {
  trackTitle: string
  items: Array<{ course: CurriculumCourseCard; meta: CuratedCourseMetadata }>
  onSelectCourse: (courseCode: string) => void
  onOpenDrawer: () => void
}

export function HorizontalBookshelf({ trackTitle, items, onSelectCourse, onOpenDrawer }: HorizontalBookshelfProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; scrollLeft: number }>({ x: 0, scrollLeft: 0 })
  const hasDraggedRef = useRef(false)

  // Check scroll boundary to update chevron button states
  const updateScrollBounds = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const tolerance = 4
    setCanScrollLeft(el.scrollLeft > tolerance)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - tolerance)
  }, [])

  useEffect(() => {
    updateScrollBounds()
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => updateScrollBounds()
    el.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)
    return () => {
      el.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [updateScrollBounds, items])

  const scrollBy = (offset: number) => {
    if (!scrollRef.current) return
    playWoodShelfSound()
    scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' })
  }

  // Pointer drag event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return
    setIsDragging(true)
    hasDraggedRef.current = false
    dragStartRef.current = {
      x: e.clientX,
      scrollLeft: scrollRef.current.scrollLeft,
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !scrollRef.current) return
    const dx = e.clientX - dragStartRef.current.x
    if (Math.abs(dx) > 5) {
      hasDraggedRef.current = true
    }
    scrollRef.current.scrollLeft = dragStartRef.current.scrollLeft - dx
  }

  const handlePointerUp = () => {
    setIsDragging(false)
  }

  // Show up to 6 companion books in the horizontal track to keep performance lightning fast
  const displayedItems = items.slice(0, 6)
  const hasMore = items.length > 4

  return (
    <div className="curriculum-horizontal-shelf-wrap">
      {/* Shelf Header with Controls */}
      <div className="curriculum-horizontal-shelf-header">
        <div className="curriculum-horizontal-shelf-header__left">
          <span className="curriculum-companion-shelf__label">KỆ SÁCH ĐỒNG HÀNH · 同行書架</span>
          <span className="curriculum-companion-shelf__count">({items.length} đầu sách)</span>
        </div>

        <div className="curriculum-horizontal-shelf-header__right">
          {hasMore && (
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
          )}

          <div className="curriculum-shelf-nav-buttons" aria-label="Điều hướng kệ sách">
            <button
              type="button"
              className="curriculum-shelf-nav-btn"
              disabled={!canScrollLeft}
              onClick={() => scrollBy(-380)}
              aria-label="Cuộn sang trái"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="curriculum-shelf-nav-btn"
              disabled={!canScrollRight}
              onClick={() => scrollBy(380)}
              aria-label="Cuộn sang phải"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Carousel Track */}
      <div
        ref={scrollRef}
        className={`curriculum-horizontal-shelf-track ${isDragging ? 'is-dragging' : ''}`}
        role="region"
        aria-label={`Kệ sách đồng hành ${trackTitle}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="curriculum-horizontal-shelf-list" role="list">
          {displayedItems.map(({ course, meta }) => (
            <div key={course.course_code} className="curriculum-horizontal-shelf-item">
              <TactileWatojiCard
                course={course}
                meta={meta}
                onSelect={(code) => {
                  if (!hasDraggedRef.current) {
                    onSelectCourse(code)
                  }
                }}
              />
            </div>
          ))}

          {/* End of Shelf: Expand Library Card */}
          {hasMore && (
            <div className="curriculum-horizontal-shelf-item">
              <button
                type="button"
                className="curriculum-expand-shelf-card"
                onClick={onOpenDrawer}
                aria-label={`Mở rộng xem toàn bộ ${items.length} đầu sách`}
              >
                <div className="curriculum-expand-shelf-card__hanko" aria-hidden="true">
                  開架
                </div>
                <h4 className="curriculum-expand-shelf-card__title">Kho Văn Thư Toàn Phần</h4>
                <p className="curriculum-expand-shelf-card__desc">
                  Khám phá trọn vẹn <strong>{items.length} đầu sách</strong> thuộc {trackTitle} với công cụ tra cứu
                  chuyên sâu.
                </p>
                <span className="curriculum-expand-shelf-card__btn">Mở kho sách ↗</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
