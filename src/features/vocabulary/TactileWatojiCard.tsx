import React, { useRef, useState, useCallback } from 'react'
import type { CurriculumCourseCard } from '../../types/curriculum'
import type { CuratedCourseMetadata } from './vocabularyCuratedData'
import { WatojiBookCover } from './WatojiBookCover'
import { playWashiPaperSound } from './tactileAudio'

interface TactileWatojiCardProps {
  course: CurriculumCourseCard
  meta: CuratedCourseMetadata
  onSelect: (courseCode: string) => void
}

export function TactileWatojiCard({ course, meta, onSelect }: TactileWatojiCardProps) {
  const cardRef = useRef<HTMLElement | null>(null)
  const [tiltStyle, setTiltStyle] = useState<React.CSSProperties>({})
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true)
    playWashiPaperSound()
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width - 0.5
    const ny = (e.clientY - rect.top) / rect.height - 0.5

    const rotY = nx * 10
    const rotX = -ny * 8
    const shadowX = -nx * 18
    const shadowY = 14 - ny * 12

    setTiltStyle({
      transform: `perspective(900px) rotateY(${rotY.toFixed(2)}deg) rotateX(${rotX.toFixed(2)}deg) translateY(-5px) translateZ(10px)`,
      boxShadow: `${shadowX.toFixed(1)}px ${shadowY.toFixed(1)}px 28px -4px rgba(28, 25, 23, 0.24), 0 2px 8px rgba(184, 46, 46, 0.06)`,
      borderColor: 'rgba(184, 46, 46, 0.42)',
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
    setTiltStyle({
      transform: 'perspective(900px) rotateY(0deg) rotateX(0deg) translateY(0px) translateZ(0px)',
      boxShadow: '0 2px 8px -2px rgba(44, 38, 35, 0.04)',
      borderColor: 'var(--color-border-subtle, rgba(215, 205, 190, 0.55))',
    })
  }, [])

  return (
    <article
      ref={cardRef}
      className={`curriculum-companion-card ${isHovered ? 'curriculum-companion-card--hovered' : ''}`}
      tabIndex={0}
      role="button"
      aria-label={`Khóa học ${course.title}, ${meta.levelDisplay}`}
      style={tiltStyle}
      onClick={() => onSelect(course.course_code)}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(course.course_code)
        }
      }}
    >
      {/* Tactile Washi Sheen on 3D Tilt */}
      <div className="curriculum-companion-card__sheen" aria-hidden="true" />

      {/* Handcrafted Watoji Book Cover */}
      <div className="curriculum-companion-card__cover-wrap">
        <WatojiBookCover
          coverSrc={meta.coverSrc}
          bookTitle={course.title}
          size="companion"
          kanjiTitle={meta.kanjiTitle}
          volumeTag={meta.volumeTag}
          level={course.level}
          palette={meta.palette}
          pattern={meta.pattern}
          sealChar={meta.sealChar}
        />
      </div>

      <div className="curriculum-companion-card__body">
        <div>
          <div className="curriculum-companion-card__top">
            <span className="curriculum-companion-card__publisher">{meta.publisher}</span>
            <span className="curriculum-companion-card__level">{meta.levelDisplay}</span>
          </div>
          <h4 className="curriculum-companion-card__title">{course.title}</h4>
          <p className="curriculum-companion-card__quote">「 {meta.methodQuote} 」</p>
        </div>

        <div className="curriculum-companion-card__bottom">
          <span className="curriculum-companion-card__count">
            {course.unit_count} bài · {course.term_count.toLocaleString()} từ
          </span>
          <span className="curriculum-companion-card__action">Mở sách ›</span>
        </div>
      </div>
    </article>
  )
}
