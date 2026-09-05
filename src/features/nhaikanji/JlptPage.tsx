import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Award, BookOpenCheck, Clock3, FileText, Headphones, Play, Sparkles, Target } from 'lucide-react'
import { nhaikanjiApi } from './nhaikanjiApi'
import { JlptExamTakingPage } from './JlptExamTakingPage'
import { Badge, Button } from '../../components/ui'

const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
const SECTIONS = [
  { id: 'all', label: 'Tất cả', icon: BookOpenCheck },
  { id: 'full_mock', label: 'Thi thử 180 điểm', icon: Award },
  { id: 'vocab', label: 'Từ vựng', icon: Sparkles },
  { id: 'grammar-reading', label: 'Ngữ pháp & Đọc', icon: FileText },
  { id: 'listening', label: 'Nghe hiểu', icon: Headphones },
] as const

export function JlptPage() {
  const [selectedLevel, setSelectedLevel] = useState<string>('N3')
  const [selectedSection, setSelectedSection] = useState<string>('all')
  const [activeExamId, setActiveExamId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['nhaikanji', 'jlptExams', selectedLevel, selectedSection],
    queryFn: () => nhaikanjiApi.fetchJlptExams({ level: selectedLevel, section: selectedSection }),
  })

  if (activeExamId) return <JlptExamTakingPage examId={activeExamId} onBack={() => setActiveExamId(null)} />

  const exams = data?.exams || []

  return (
    <main className="jlpt-page" aria-label="Luyện thi JLPT">
      <section className="jlpt-hero">
        <div className="jlpt-hero__copy">
          <span className="jlpt-hero__eyebrow"><Award aria-hidden="true" size={16} /> LUYỆN THI CÓ CHIẾN LƯỢC</span>
          <h1>Thi thử JLPT</h1>
          <p>Chọn đề theo đúng trình độ, làm bài theo thời gian thực và xem lại kết quả ngay sau khi nộp.</p>
        </div>
        <div className="jlpt-hero__metrics" aria-label="Thông tin kỳ thi">
          <div><Target aria-hidden="true" size={19} /><strong>180</strong><span>điểm tối đa</span></div>
          <div><Clock3 aria-hidden="true" size={19} /><strong>Có giờ</strong><span>theo dõi thời gian</span></div>
        </div>
      </section>

      <section className="jlpt-controls ui-card ui-card--md" aria-label="Bộ lọc đề thi">
        <div className="jlpt-controls__row">
          <div>
            <span className="jlpt-controls__label">Trình độ mục tiêu</span>
            <div className="jlpt-levels" role="tablist" aria-label="Chọn trình độ JLPT">
              {JLPT_LEVELS.map((level) => (
                <button key={level} type="button" role="tab" aria-selected={selectedLevel === level} className={selectedLevel === level ? 'is-active' : ''} onClick={() => setSelectedLevel(level)}>
                  {level}
                </button>
              ))}
            </div>
          </div>
          <p className="jlpt-controls__hint">Đề được lọc theo trình độ bạn đang chọn.</p>
        </div>
        <div className="jlpt-sections" role="tablist" aria-label="Chọn phần thi">
          {SECTIONS.map((section) => {
            const Icon = section.icon
            const selected = selectedSection === section.id
            return (
              <button key={section.id} type="button" role="tab" aria-selected={selected} className={selected ? 'is-active' : ''} onClick={() => setSelectedSection(section.id)}>
                <Icon aria-hidden="true" size={16} /> {section.label}
              </button>
            )
          })}
        </div>
      </section>

      <section className="jlpt-catalogue" aria-live="polite">
        <div className="jlpt-catalogue__heading">
          <div><span>NGÂN HÀNG ĐỀ</span><h2>Đề {selectedLevel} phù hợp với bạn</h2></div>
          {!isLoading && <span className="jlpt-catalogue__count">{exams.length} đề</span>}
        </div>

        {isLoading ? (
          <div className="jlpt-grid" aria-label="Đang tải đề thi">
            {Array.from({ length: 6 }).map((_, index) => <div key={index} className="jlpt-exam-card jlpt-exam-card--skeleton" />)}
          </div>
        ) : exams.length === 0 ? (
          <div className="jlpt-empty ui-card ui-card--md"><BookOpenCheck aria-hidden="true" size={26} /><h2>Chưa có đề phù hợp</h2><p>Hãy thử đổi phần thi hoặc chọn một trình độ khác.</p></div>
        ) : (
          <div className="jlpt-grid">
            {exams.map((exam) => {
              const isFull = exam.isFullMock || exam.section === 'full_mock'
              return (
                <article key={exam.id} className={`jlpt-exam-card${isFull ? ' jlpt-exam-card--full' : ''}`}>
                  <div className="jlpt-exam-card__topline">
                    <div className="jlpt-exam-card__badges"><Badge variant={isFull ? 'primary' : 'outline'}>{exam.level}</Badge>{isFull && <span className="jlpt-exam-card__score">180 ĐIỂM</span>}</div>
                    <span className="jlpt-exam-card__time"><Clock3 aria-hidden="true" size={14} /> {exam.timeLimit} phút</span>
                  </div>
                  <div className="jlpt-exam-card__body">
                    <span className="jlpt-exam-card__meta">Năm {exam.year || '2025'} · Đợt {exam.session || '1'}</span>
                    <h3>{exam.title || exam.sectionLabel}</h3>
                    <p>{exam.sectionLabelJP}{exam.audioUrl || isFull ? ' · Có bài nghe và đọc' : ''}</p>
                  </div>
                  <div className="jlpt-exam-card__footer">
                    <span><FileText aria-hidden="true" size={15} /> {exam.questionCount || 20} câu hỏi</span>
                    <Button size="sm" variant={isFull ? 'primary' : 'secondary'} onClick={() => setActiveExamId(exam.id)}><Play aria-hidden="true" size={14} fill="currentColor" /> {isFull ? 'Thi thử' : 'Làm bài'}</Button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

export default JlptPage
