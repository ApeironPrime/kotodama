import { useState, useMemo, useEffect } from 'react'
import { Search, X, BookOpen } from 'lucide-react'
import type { CurriculumCourseCard } from '../../types/curriculum'
import type { CuratedCourseMetadata } from './vocabularyCuratedData'
import { TactileWatojiCard } from './TactileWatojiCard'
import { playWoodShelfSound } from './tactileAudio'

interface KaikaShokoModalProps {
  isOpen: boolean
  trackTitle: string
  trackKanji: string
  items: Array<{ course: CurriculumCourseCard; meta: CuratedCourseMetadata }>
  onClose: () => void
  onSelectCourse: (courseCode: string) => void
}

export function KaikaShokoModal({
  isOpen,
  trackTitle,
  trackKanji,
  items,
  onClose,
  onSelectCourse,
}: KaikaShokoModalProps) {
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    if (!isOpen) return

    playWoodShelfSound()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  const filteredItems = useMemo(() => {
    if (!keyword.trim()) return items
    const q = keyword.toLowerCase().trim()
    return items.filter(
      ({ course, meta }) =>
        course.title.toLowerCase().includes(q) ||
        meta.publisher.toLowerCase().includes(q) ||
        meta.kanjiTitle.toLowerCase().includes(q) ||
        (course.level && course.level.toLowerCase().includes(q))
    )
  }, [items, keyword])

  if (!isOpen) return null

  return (
    <div
      className="kaika-shoko-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kaika-shoko-title"
      onClick={onClose}
    >
      <div className="kaika-shoko-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Archival Drawer Header */}
        <header className="kaika-shoko-header">
          <div className="kaika-shoko-header__title-group">
            <span className="kaika-shoko-hanko" aria-hidden="true">
              {trackKanji || '開架'}
            </span>
            <div>
              <span className="kaika-shoko-subhead">KHO LƯU TRỮ VĂN THƯ · 開架書庫</span>
              <h2 id="kaika-shoko-title" className="kaika-shoko-title">
                {trackTitle} ({items.length} đầu sách)
              </h2>
            </div>
          </div>

          <div className="kaika-shoko-header__actions">
            <div className="kaika-shoko-search">
              <Search size={14} className="kaika-shoko-search__icon" aria-hidden="true" />
              <input
                type="search"
                className="kaika-shoko-search__input"
                placeholder="Tìm kiếm trong kho lưu trữ..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                autoFocus
              />
            </div>

            <button type="button" className="kaika-shoko-close-btn" onClick={onClose} aria-label="Đóng kho lưu trữ">
              <X size={18} aria-hidden="true" />
              <span>Đóng</span>
            </button>
          </div>
        </header>

        {/* Archival Shelf Grid */}
        <div className="kaika-shoko-body">
          {filteredItems.length === 0 ? (
            <div className="kaika-shoko-empty">
              <BookOpen size={36} className="kaika-shoko-empty__icon" aria-hidden="true" />
              <p>Không tìm thấy đầu sách nào khớp với từ khóa "{keyword}".</p>
            </div>
          ) : (
            <div className="curriculum-companion-grid" role="list">
              {filteredItems.map(({ course, meta }) => (
                <TactileWatojiCard
                  key={course.course_code}
                  course={course}
                  meta={meta}
                  onSelect={(code) => {
                    onClose()
                    onSelectCourse(code)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
