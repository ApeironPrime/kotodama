import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Play, FileText } from 'lucide-react'
import { nhaikanjiApi } from './nhaikanjiApi'
import { JlptExamTakingPage } from './JlptExamTakingPage'
import { Badge, Button } from '../../components/ui'
import PageHeader from '../../components/PageHeader'

const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
const SECTIONS = [
  { id: 'all', label: 'Tất cả phần thi' },
  { id: 'full_mock', label: '🔥 Thi trọn gói cả đề (180 điểm)' },
  { id: 'vocab', label: 'Từ vựng (文字・語彙)' },
  { id: 'grammar-reading', label: 'Ngữ pháp - Đọc hiểu (文法・読解)' },
  { id: 'listening', label: 'Nghe hiểu (聴解)' },
]

export function JlptPage() {
  const [selectedLevel, setSelectedLevel] = useState<string>('N3')
  const [selectedSection, setSelectedSection] = useState<string>('all')
  const [activeExamId, setActiveExamId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['nhaikanji', 'jlptExams', selectedLevel, selectedSection],
    queryFn: () =>
      nhaikanjiApi.fetchJlptExams({
        level: selectedLevel,
        section: selectedSection,
      }),
  })

  if (activeExamId) {
    return <JlptExamTakingPage examId={activeExamId} onBack={() => setActiveExamId(null)} />
  }

  const exams = data?.exams || []

  return (
    <div className="nhaikanji-container">
      <PageHeader
        eyebrow="LUYỆN THI JLPT & THI THỬ TRỌN GÓI 180 ĐIỂM"
        title="Luyện Thi JLPT Trực Tuyến"
        description="Ngân hàng đề thi trắc nghiệm JLPT từ N5 đến N1 chuẩn cấu trúc, hỗ trợ thi thử trọn gói 180 điểm, đồng hồ bấm giờ và cấp Giấy chứng nhận kết quả thi tức thì"
      />

      {/* Filter Bar */}
      <div className="nhaikanji-filter-card">
        <div className="nhaikanji-filter-row">
          {/* Level Tabs */}
          <div className="nhaikanji-tab-group">
            {JLPT_LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={`nhaikanji-tab-btn${selectedLevel === lvl ? ' is-active' : ''}`}
                onClick={() => setSelectedLevel(lvl)}
              >
                Đề thi {lvl}
              </button>
            ))}
          </div>

          {/* Section Filter Pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
            {SECTIONS.map((sec) => (
              <button
                key={sec.id}
                type="button"
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: selectedSection === sec.id ? '1px solid #4f46e5' : '1px solid var(--color-border, #cbd5e1)',
                  background:
                    selectedSection === sec.id
                      ? sec.id === 'full_mock'
                        ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
                        : '#0f172a'
                      : 'var(--color-bg-surface, #ffffff)',
                  color: selectedSection === sec.id ? '#ffffff' : 'var(--color-text, #334155)',
                  boxShadow:
                    selectedSection === sec.id && sec.id === 'full_mock'
                      ? '0 2px 8px rgba(99, 102, 241, 0.35)'
                      : 'none',
                }}
                onClick={() => setSelectedSection(sec.id)}
              >
                {sec.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Exams Grid */}
      {isLoading ? (
        <div className="jlpt-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="jlpt-card"
              style={{ minHeight: '160px', background: 'var(--color-bg-subtle, #f1f5f9)' }}
            />
          ))}
        </div>
      ) : exams.length === 0 ? (
        <div className="nhaikanji-filter-card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <p style={{ fontWeight: 500, color: 'var(--color-text-secondary, #64748b)' }}>
            Chưa có đề thi nào cho bộ lọc này.
          </p>
        </div>
      ) : (
        <div className="jlpt-grid">
          {exams.map((ex) => {
            const isFull = ex.isFullMock || ex.section === 'full_mock'
            return (
              <div
                key={ex.id}
                className="jlpt-card"
                style={
                  isFull
                    ? {
                        border: '1.5px solid #818cf8',
                        background: 'linear-gradient(180deg, #ffffff 0%, #f8faff 100%)',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.08)',
                      }
                    : undefined
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Badge variant={isFull ? 'primary' : 'outline'} className="font-bold text-xs">
                        {ex.level}
                      </Badge>
                      {isFull && (
                        <Badge
                          variant="secondary"
                          style={{
                            background: '#e0e7ff',
                            color: '#4338ca',
                            fontWeight: 700,
                            fontSize: '0.6875rem',
                          }}
                        >
                          180 ĐIỂM
                        </Badge>
                      )}
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                        Năm {ex.year || '2025'} • Đợt {ex.session || '1'}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[11px] font-mono flex items-center gap-1">
                      <Clock size={12} /> {ex.timeLimit} phút
                    </Badge>
                  </div>

                  <div>
                    <h3
                      style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        margin: 0,
                        color: isFull ? '#1e1b4b' : 'var(--color-text, #0f172a)',
                      }}
                    >
                      {ex.title || ex.sectionLabel}
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                      {ex.sectionLabelJP} {ex.audioUrl || isFull ? '• Đầy đủ âm thanh & bài đọc' : ''}
                    </p>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.75rem',
                      color: '#475569',
                    }}
                  >
                    <FileText size={14} style={{ color: '#94a3b8' }} />
                    <span>
                      Tổng số câu hỏi: <b>{ex.questionCount || 20}</b> câu {isFull ? '(Đầy đủ 3 phần thi)' : ''}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '1rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--color-border-subtle, #f1f5f9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>● Sẵn sàng thi</span>
                  <Button
                    size="sm"
                    variant={isFull ? 'primary' : 'secondary'}
                    onClick={() => setActiveExamId(ex.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      background: isFull ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' : undefined,
                    }}
                  >
                    <Play size={14} fill="currentColor" /> {isFull ? 'Thi Thử Ngay' : 'Vào làm bài'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
export default JlptPage
