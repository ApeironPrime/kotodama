import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  BookOpenCheck,
  BrainCircuit,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileText,
  GraduationCap,
  Headphones,
  Search,
} from 'lucide-react'
import { Button, Badge, Input } from '../../components/ui'
import { nhaikanjiApi } from './nhaikanjiApi'
import type { JlptAttempt, JlptExamSummary } from './nhaikanjiTypes'
import JlptExamTakingPage from './JlptExamTakingPage'
import { useAuth } from '../auth/authContext'
import { listJlptAttempts, startJlptAttempt } from './jlptAttempts'

type LevelMeta = {
  id: string
  title: string
  description: string
  tone: string
}

type LaunchState = { examId: string; mode: 'exam' | 'review' | 'result'; attemptId?: string }

const LEVELS: LevelMeta[] = [
  { id: 'N1', title: 'Đề mô phỏng N1', description: 'Trình độ cao nhất', tone: 'n1' },
  { id: 'N2', title: 'Đề mô phỏng N2', description: 'Trình độ nâng cao', tone: 'n2' },
  { id: 'N3', title: 'Đề mô phỏng N3', description: 'Trình độ trung cấp', tone: 'n3' },
  { id: 'N4', title: 'Đề mô phỏng N4', description: 'Trình độ sơ trung cấp', tone: 'n4' },
  { id: 'N5', title: 'Đề mô phỏng N5', description: 'Trình độ cơ bản', tone: 'n5' },
]

function getSessionMeta(session: JlptExamSummary['session']) {
  const raw = String(session ?? '').trim()
  if (raw === '1' || raw === '01' || raw === '7' || raw === '07') return { label: 'Kỳ 1', month: '07' }
  if (raw === '2' || raw === '02' || raw === '12') return { label: 'Kỳ 2', month: '12' }
  return { label: raw ? `Kỳ ${raw}` : 'Kỳ thi', month: raw || '—' }
}

function examYear(exam: Pick<JlptExamSummary, 'year'>) {
  return String(exam.year || '').match(/(?:19|20)\d{2}/)?.[0] || String(exam.year || '')
}

function paperTitle(level: string, exam: Pick<JlptExamSummary, 'year' | 'session'>) {
  const session = getSessionMeta(exam.session)
  return `JLPT ${level} — Tháng ${session.month}, năm ${examYear(exam) || '—'}`
}

function sectionLabel(exam: JlptExamSummary) {
  if (exam.isFullMock || exam.section === 'full_mock') return 'Toàn đề'
  return exam.sectionLabel || 'Phần thi'
}

export function JlptPage() {
  const { user } = useAuth()
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null)
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null)
  const [launch, setLaunch] = useState<LaunchState | null>(null)
  const [query, setQuery] = useState('')
  const [yearFilter, setYearFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'not-started' | 'in-progress' | 'completed'>('all')
  const [answerMode, setAnswerMode] = useState(false)

  const examQuery = useQuery({
    queryKey: ['jlpt-exams', selectedLevel],
    queryFn: () => nhaikanjiApi.fetchJlptExams({ level: selectedLevel || 'N3' }),
    enabled: Boolean(selectedLevel),
  })

  const attemptsQuery = useQuery({
    queryKey: ['jlpt-attempts', selectedLevel, user?.id || 'guest'],
    queryFn: () => listJlptAttempts(selectedLevel || 'N3', user?.id),
    enabled: Boolean(selectedLevel),
  })

  const attemptsByExam = useMemo(() => {
    const grouped = new Map<string, JlptAttempt[]>()
    for (const attempt of attemptsQuery.data || []) {
      grouped.set(attempt.examId, [...(grouped.get(attempt.examId) || []), attempt])
    }
    return grouped
  }, [attemptsQuery.data])

  const launchExam = async (exam: JlptExamSummary) => {
    const attempt = await startJlptAttempt(exam.id, selectedLevel || 'N3', user?.id, exam.timeLimit)
    setLaunch({ examId: exam.id, mode: 'exam', attemptId: attempt.id })
    void attemptsQuery.refetch()
  }

  const papers = useMemo(() => {
    const all = (examQuery.data?.exams || []).filter((exam) => exam.available)
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return all.filter((exam) => {
      const meta = getSessionMeta(exam.session)
      const matchesYear = yearFilter === 'all' || examYear(exam) === yearFilter
      const haystack = `${exam.year || ''} ${meta.label} ${meta.month} ${sectionLabel(exam)}`.toLocaleLowerCase()
      const matchesSearch = !normalizedQuery || haystack.includes(normalizedQuery)
      const attempts = attemptsByExam.get(exam.id) || []
      const latestAttempt = attempts[0]
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'not-started' && attempts.length === 0) ||
        (statusFilter === 'in-progress' && latestAttempt?.status === 'in_progress') ||
        (statusFilter === 'completed' && attempts.some((attempt) => attempt.status === 'completed'))
      return matchesYear && matchesSearch && matchesStatus
    })
  }, [attemptsByExam, examQuery.data?.exams, query, statusFilter, yearFilter])

  const paperGroups = useMemo(() => {
    const map = new Map<string, JlptExamSummary[]>()
    papers.forEach((exam) => {
      const key = examYear(exam) || 'Khác'
      map.set(key, [...(map.get(key) || []), exam])
    })
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a, undefined, { numeric: true }))
  }, [papers])

  const years = useMemo(
    () =>
      [...new Set((examQuery.data?.exams || []).map(examYear).filter(Boolean))].sort((a, b) =>
        b.localeCompare(a, undefined, { numeric: true })
      ),
    [examQuery.data?.exams]
  )

  const currentPaper = useMemo(
    () => (examQuery.data?.exams || []).filter((exam) => `${examYear(exam)}|${exam.session}` === selectedPaper),
    [examQuery.data?.exams, selectedPaper]
  )

  if (launch) {
    return (
      <JlptExamTakingPage
        key={`${launch.examId}:${launch.attemptId || 'review'}:${launch.mode}`}
        examId={launch.examId}
        mode={launch.mode}
        attemptId={launch.attemptId}
        onBack={() => {
          setLaunch(null)
          void attemptsQuery.refetch()
        }}
      />
    )
  }

  if (!selectedLevel) {
    return (
      <main className="jlpt-page jlpt-level-page">
        <header className="jlpt-level-page__heading">
          <span>
            <GraduationCap size={22} aria-hidden="true" /> Luyện thi JLPT
          </span>
          <h1>Đề mô phỏng JLPT</h1>
          <p>Chọn cấp độ để xem các kỳ đề, làm từng phần hoặc học lại đáp án.</p>
        </header>

        <div className="jlpt-level-list" aria-label="Chọn cấp độ JLPT">
          {LEVELS.map((level) => (
            <button
              key={level.id}
              type="button"
              className={`jlpt-level-row jlpt-level-row--${level.tone}`}
              onClick={() => setSelectedLevel(level.id)}
            >
              <span className="jlpt-level-row__mark">{level.id}</span>
              <span className="jlpt-level-row__copy">
                <strong>{level.title}</strong>
                <small>{level.description}</small>
                <em>Xem các kỳ đề</em>
              </span>
              <ChevronRight aria-hidden="true" />
            </button>
          ))}
        </div>

        <article className="jlpt-ai-notice">
          <BrainCircuit size={21} aria-hidden="true" />
          <div>
            <strong>Đề AI</strong>
            <p>Đang chuẩn bị ngân hàng câu hỏi có kiểm duyệt. Chỉ mở khi nội dung và đáp án đã được rà soát.</p>
          </div>
          <Badge variant="secondary">Sắp mở</Badge>
        </article>
      </main>
    )
  }

  const representative = currentPaper[0]
  if (selectedPaper && representative) {
    return (
      <main className="jlpt-page">
        <section className="jlpt-paper-picker">
          <button type="button" className="jlpt-back-button" onClick={() => setSelectedPaper(null)}>
            <ArrowLeft size={17} /> Quay lại danh sách kỳ đề
          </button>
          <header className="jlpt-paper-picker__heading">
            <span>{getSessionMeta(representative.session).label}</span>
            <h2>{paperTitle(selectedLevel, representative)}</h2>
            <p>
              Chọn phần bạn muốn làm, hoặc mở chế độ học đáp án để xem khóa đáp án và ghi chú hiện có. Bản chép lời nghe
              được hiển thị khi có dữ liệu.
            </p>
          </header>
          <div className="jlpt-paper-picker__grid">
            {currentPaper.map((exam) => (
              <article className="jlpt-paper-option jlpt-exam-card" key={exam.id}>
                {(() => {
                  const examAttempts = attemptsByExam.get(exam.id) || []
                  const latestAttempt = examAttempts[0]
                  const inProgress = latestAttempt?.status === 'in_progress' ? latestAttempt : undefined
                  const completedAttempts = examAttempts.filter((attempt) => attempt.status === 'completed')
                  const completed = completedAttempts[0]
                  return (
                    <>
                      <div>
                        <Badge variant={exam.isFullMock || exam.section === 'full_mock' ? 'primary' : 'secondary'}>
                          {sectionLabel(exam)}
                        </Badge>
                        <span className="jlpt-paper-option__meta">
                          {inProgress ? (
                            'Đang làm dở'
                          ) : completed ? (
                            `Lần gần nhất · ${completed.result?.scorePercentage ?? completed.scorePercentage ?? 0}%`
                          ) : (
                            <>
                              <Clock3 size={14} /> {exam.timeLimit} phút
                            </>
                          )}
                        </span>
                      </div>
                      <div>
                        <h3>
                          {exam.isFullMock || exam.section === 'full_mock' ? 'Làm toàn bộ đề' : exam.sectionLabel}
                        </h3>
                        <p>
                          {exam.questionCount} câu hỏi · {exam.sectionLabelJP || 'JLPT'}
                        </p>
                      </div>
                      {completedAttempts.length > 0 && (
                        <div className="jlpt-attempt-history">
                          <strong>Lịch sử gần đây</strong>
                          {completedAttempts.slice(0, 3).map((attempt, index) => (
                            <button
                              key={attempt.id}
                              type="button"
                              onClick={() => setLaunch({ examId: exam.id, mode: 'result', attemptId: attempt.id })}
                            >
                              <span>
                                Lần {index + 1} ·{' '}
                                {new Date(attempt.finishedAt || attempt.updatedAt).toLocaleDateString('vi-VN')}
                              </span>
                              <b>{attempt.result?.scorePercentage ?? attempt.scorePercentage ?? 0}%</b>
                            </button>
                          ))}
                          {completedAttempts.length > 3 && (
                            <details>
                              <summary>Xem thêm {completedAttempts.length - 3} lần làm</summary>
                              {completedAttempts.slice(3).map((attempt, index) => (
                                <button
                                  key={attempt.id}
                                  type="button"
                                  onClick={() => setLaunch({ examId: exam.id, mode: 'result', attemptId: attempt.id })}
                                >
                                  <span>
                                    Lần {index + 4} ·{' '}
                                    {new Date(attempt.finishedAt || attempt.updatedAt).toLocaleDateString('vi-VN')}
                                  </span>
                                  <b>{attempt.result?.scorePercentage ?? attempt.scorePercentage ?? 0}%</b>
                                </button>
                              ))}
                            </details>
                          )}
                        </div>
                      )}
                      <div className="jlpt-paper-option__actions">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setLaunch({ examId: exam.id, mode: 'review' })}
                        >
                          <BookOpenCheck size={16} /> Học đáp án
                        </Button>
                        {inProgress ? (
                          <Button
                            size="sm"
                            onClick={() => setLaunch({ examId: exam.id, mode: 'exam', attemptId: inProgress.id })}
                          >
                            <FileText size={16} /> Tiếp tục
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => void launchExam(exam)}>
                            <FileText size={16} />{' '}
                            {completed
                              ? exam.isFullMock || exam.section === 'full_mock'
                                ? 'Thi lại toàn đề'
                                : 'Làm lại phần này'
                              : exam.isFullMock || exam.section === 'full_mock'
                                ? 'Thi toàn đề'
                                : 'Làm phần này'}
                          </Button>
                        )}
                      </div>
                    </>
                  )
                })()}
              </article>
            ))}
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="jlpt-page jlpt-paper-list-page">
      <button type="button" className="jlpt-back-button" onClick={() => setSelectedLevel(null)}>
        <ArrowLeft size={17} /> Luyện thi JLPT
      </button>
      <header className="jlpt-paper-list-page__heading">
        <div>
          <span>Đề mô phỏng</span>
          <h1>{selectedLevel}</h1>
          <p>Luyện đề theo kỳ để chuẩn bị nhịp làm bài trước khi vào phòng thi.</p>
        </div>
        <Button variant={answerMode ? 'secondary' : 'primary'} onClick={() => setAnswerMode((value) => !value)}>
          <BookOpenCheck size={17} /> {answerMode ? 'Quay lại làm đề' : 'Học đáp án các kỳ đề'}
        </Button>
      </header>

      <section className="jlpt-paper-filters" aria-label="Lọc kỳ đề">
        <label className="jlpt-search">
          <Search size={18} aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo năm, tháng hoặc phần thi"
          />
        </label>
        <div className="jlpt-filter-row">
          <label className="jlpt-year-select">
            <CalendarDays size={17} />
            <span className="sr-only">Chọn năm</span>
            <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
              <option value="all">Tất cả năm</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <div className="jlpt-status-tabs" aria-label="Trạng thái làm đề">
            {[
              ['all', 'Tất cả'],
              ['not-started', 'Chưa làm'],
              ['in-progress', 'Đang làm'],
              ['completed', 'Đã làm'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={statusFilter === value ? 'is-active' : ''}
                onClick={() => setStatusFilter(value as typeof statusFilter)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>
      {!user && <p className="jlpt-local-history-note">Lịch sử khi chưa đăng nhập chỉ lưu trên thiết bị này.</p>}

      {examQuery.isLoading && (
        <div className="jlpt-grid" aria-label="Đang tải đề">
          {[0, 1, 2, 3].map((item) => (
            <div className="jlpt-exam-card--skeleton" key={item} />
          ))}
        </div>
      )}
      {examQuery.isError && (
        <section className="jlpt-empty">
          <FileText size={30} />
          <h2>Chưa tải được kỳ đề</h2>
          <p>Hãy thử tải lại trang sau ít phút.</p>
        </section>
      )}
      {!examQuery.isLoading &&
        !examQuery.isError &&
        paperGroups.map(([year, exams]) => (
          <section className="jlpt-year-group" key={year}>
            <h2>
              <CalendarDays size={18} /> {year}
            </h2>
            <div className="jlpt-paper-grid">
              {exams.map((exam) => {
                const session = getSessionMeta(exam.session)
                return (
                  <button
                    type="button"
                    className="jlpt-session-card"
                    key={exam.id}
                    onClick={() => setSelectedPaper(`${examYear(exam)}|${exam.session}`)}
                  >
                    <span className="jlpt-session-card__badge">{session.label}</span>
                    <span className="jlpt-session-card__body">
                      <strong>
                        {session.label} — tháng {session.month}
                      </strong>
                      <small>
                        {answerMode ? 'Mở lời giải và đáp án' : `${exam.questionCount} câu · ${sectionLabel(exam)}`}
                      </small>
                      <em>
                        {attemptsByExam.has(exam.id)
                          ? `${attemptsByExam.get(exam.id)?.[0]?.status === 'in_progress' ? 'Đang làm · ' : 'Đã làm · '}`
                          : ''}
                        {sectionLabel(exam)}
                        {exam.section === 'listening' && (
                          <>
                            <span> · </span>
                            <Headphones size={13} aria-label="Có phần nghe" />
                          </>
                        )}
                      </em>
                    </span>
                    <ChevronRight aria-hidden="true" />
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      {!examQuery.isLoading && !examQuery.isError && paperGroups.length === 0 && (
        <section className="jlpt-empty">
          <FileText size={30} />
          <h2>Chưa có kỳ đề phù hợp</h2>
          <p>
            {statusFilter !== 'all' && statusFilter !== 'not-started'
              ? 'Chưa có đề nào ở trạng thái này. Hãy chọn đề để bắt đầu một lần làm bài.'
              : 'Thử đổi bộ lọc hoặc chọn một cấp độ khác.'}
          </p>
        </section>
      )}
    </main>
  )
}

export default JlptPage
