import { useState } from 'react'

type Page = 'home' | 'vocabulary' | 'video' | 'courses'

// ─── Icons ────────────────────────────────────────────────────────────────────
const PlayIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
)
const ArrowRightIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
)
const BookOpenIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
)
const VideoIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
  </svg>
)
const ZapIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
)
const StarIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
)
const UsersIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const ClockIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)
const TrendingUpIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
)

// ─── Data ─────────────────────────────────────────────────────────────────────

const LANGUAGES = [
  {
    code: 'JP',
    name: 'Tiếng Nhật',
    native: '日本語',
    color: '#FF4D6D',
    dimColor: 'rgba(255,77,109,0.12)',
    borderColor: 'rgba(255,77,109,0.3)',
    flag: '🇯🇵',
    learners: '3.2M',
    level: 'N4',
    progress: 62,
    wordsLearned: 840,
    description: 'Hiragana · Katakana · Kanji · Văn phạm',
    active: true,
  },
  {
    code: 'EN',
    name: 'Tiếng Anh',
    native: 'English',
    color: '#4D8BFF',
    dimColor: 'rgba(77,139,255,0.12)',
    borderColor: 'rgba(77,139,255,0.3)',
    flag: '🇬🇧',
    learners: '8.5M',
    level: 'B2',
    progress: 78,
    wordsLearned: 2400,
    description: 'Ngữ pháp · Từ vựng · Phát âm · IELTS',
    active: true,
  },
  {
    code: 'FR',
    name: 'Tiếng Pháp',
    native: 'Français',
    color: '#A855F7',
    dimColor: 'rgba(168,85,247,0.12)',
    borderColor: 'rgba(168,85,247,0.3)',
    flag: '🇫🇷',
    learners: '1.8M',
    level: 'A2',
    progress: 25,
    wordsLearned: 310,
    description: 'Phát âm · Ngữ pháp · Văn hóa Pháp',
    active: false,
  },
  {
    code: 'KO',
    name: 'Tiếng Hàn',
    native: '한국어',
    color: '#F97316',
    dimColor: 'rgba(249,115,22,0.12)',
    borderColor: 'rgba(249,115,22,0.3)',
    flag: '🇰🇷',
    learners: '2.1M',
    level: 'Sơ cấp',
    progress: 0,
    wordsLearned: 0,
    description: 'Hangul · K-drama · TOPIK',
    active: false,
  },
  {
    code: 'ZH',
    name: 'Tiếng Trung',
    native: '中文',
    color: '#10B981',
    dimColor: 'rgba(16,185,129,0.12)',
    borderColor: 'rgba(16,185,129,0.3)',
    flag: '🇨🇳',
    learners: '2.9M',
    level: 'Sơ cấp',
    progress: 0,
    wordsLearned: 0,
    description: 'Bính âm · Hán tự · Thanh điệu',
    active: false,
  },
]

const COURSES = [
  {
    id: 1,
    lang: 'JP',
    langColor: '#FF4D6D',
    title: 'Tiếng Nhật từ đầu đến JLPT N4',
    instructor: 'Sensei Tanaka',
    level: 'Sơ cấp → Trung cấp',
    lessons: 48,
    hours: 32,
    rating: 4.9,
    students: '12.4K',
    image: 'https://images.unsplash.com/photo-1573455494060-c5595004fb6c?w=600&h=340&fit=crop&auto=format',
    tags: ['N5', 'N4', 'Kanji'],
    badge: 'Nổi bật',
    badgeColor: '#FF4D6D',
  },
  {
    id: 2,
    lang: 'EN',
    langColor: '#4D8BFF',
    title: 'Tiếng Anh giao tiếp — IELTS 7.0+',
    instructor: 'Prof. Williams',
    level: 'Trung cấp → Nâng cao',
    lessons: 60,
    hours: 40,
    rating: 4.8,
    students: '28.7K',
    image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&h=340&fit=crop&auto=format',
    tags: ['IELTS', 'Speaking', 'Writing'],
    badge: 'Phổ biến',
    badgeColor: '#4D8BFF',
  },
  {
    id: 3,
    lang: 'FR',
    langColor: '#A855F7',
    title: 'Tiếng Pháp cơ bản — Khám phá Paris',
    instructor: 'Marie Dupont',
    level: 'Sơ cấp (A1 → A2)',
    lessons: 36,
    hours: 24,
    rating: 4.7,
    students: '8.2K',
    image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&h=340&fit=crop&auto=format',
    tags: ['DELF', 'Phát âm'],
    badge: 'Mới',
    badgeColor: '#A855F7',
  },
  {
    id: 4,
    lang: 'KO',
    langColor: '#F97316',
    title: 'Tiếng Hàn qua K-drama thực tế',
    instructor: 'Kim Jisoo',
    level: 'Mọi cấp độ',
    lessons: 30,
    hours: 20,
    rating: 4.9,
    students: '15.1K',
    image: 'https://images.unsplash.com/photo-1546874177-9e664107314e?w=600&h=340&fit=crop&auto=format',
    tags: ['Hangul', 'TOPIK', 'K-pop'],
    badge: 'Hot',
    badgeColor: '#F97316',
  },
]

const STATS = [
  { value: '14+', label: 'Ngôn ngữ' },
  { value: '850K+', label: 'Học viên' },
  { value: '2,400+', label: 'Bài học' },
  { value: '98%', label: 'Hài lòng' },
]

// ─── Components ───────────────────────────────────────────────────────────────

function LangCard({ lang, setPage }: { lang: typeof LANGUAGES[0]; setPage: (p: Page) => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="lang-card"
      style={{ '--lc-color': lang.color } as React.CSSProperties}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => lang.active && setPage('vocabulary')}
    >
      {/* Glow bg */}
      {hovered && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none',
          background: `radial-gradient(circle at 30% 20%, ${lang.dimColor} 0%, transparent 70%)`,
          transition: 'opacity 0.2s',
        }}/>
      )}

      <div style={{ position: 'relative' }}>
        {/* Flag + code */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 32 }}>{lang.flag}</span>
          {lang.active ? (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 9px',
              background: `${lang.dimColor}`, border: `1px solid ${lang.borderColor}`,
              borderRadius: 20, color: lang.color, fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.06em',
            }}>
              {lang.level}
            </span>
          ) : (
            <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 9px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, color: 'rgba(234,234,224,0.35)', fontFamily: 'JetBrains Mono, monospace' }}>
              Sắp tới
            </span>
          )}
        </div>

        {/* Name */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 600, color: '#EAEAE0', lineHeight: 1 }}>
            {lang.name}
          </div>
          <div style={{ fontSize: 13, color: lang.active ? 'rgba(234,234,224,0.45)' : 'rgba(234,234,224,0.3)', marginTop: 3, fontFamily: 'Noto Sans JP, sans-serif' }}>
            {lang.native}
          </div>
        </div>

        {/* Description */}
        <div style={{ fontSize: 11.5, color: 'rgba(234,234,224,0.35)', marginBottom: 16, lineHeight: 1.5 }}>
          {lang.description}
        </div>

        {/* Progress */}
        {lang.active && lang.progress > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(234,234,224,0.4)', fontFamily: 'JetBrains Mono, monospace' }}>
                {lang.wordsLearned} từ
              </span>
              <span style={{ fontSize: 11, color: lang.color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                {lang.progress}%
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${lang.progress}%`, background: `linear-gradient(90deg, ${lang.color}, ${lang.color}99)` }}/>
            </div>
          </div>
        )}

        {/* Learners + CTA */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'rgba(234,234,224,0.35)', fontSize: 11.5 }}>
            <UsersIcon size={12}/>
            <span>{lang.learners} học viên</span>
          </div>
          {lang.active ? (
            <button
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 13px', borderRadius: 8, border: `1px solid ${lang.borderColor}`,
                background: lang.dimColor, color: lang.color,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
              }}
            >
              Tiếp tục <ArrowRightIcon size={12}/>
            </button>
          ) : (
            <button
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 13px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)', color: 'rgba(234,234,224,0.4)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              Khám phá
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function CourseCard({ course }: { course: typeof COURSES[0] }) {
  return (
    <div className="course-card">
      {/* Thumbnail */}
      <div style={{ position: 'relative', height: 160, overflow: 'hidden', background: '#111' }}>
        <img
          src={course.image}
          alt={course.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75 }}
        />
        {/* Overlay gradient */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(9,9,15,0.9) 100%)' }}/>
        {/* Badge */}
        <div style={{
          position: 'absolute', top: 12, left: 12,
          padding: '3px 10px', borderRadius: 6,
          background: course.badgeColor, color: 'white',
          fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em',
        }}>
          {course.badge}
        </div>
        {/* Lang tag */}
        <div style={{
          position: 'absolute', top: 12, right: 12,
          padding: '3px 10px', borderRadius: 6,
          background: 'rgba(9,9,15,0.7)', border: '1px solid rgba(255,255,255,0.15)',
          color: course.langColor, fontSize: 11, fontWeight: 700,
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          {course.lang}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px 18px 18px' }}>
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 15.5, fontWeight: 600, color: '#EAEAE0', lineHeight: 1.35, marginBottom: 8 }}>
          {course.title}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(234,234,224,0.45)', marginBottom: 12 }}>
          {course.instructor} · {course.level}
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {course.tags.map(t => (
            <span key={t} style={{
              padding: '2px 8px', borderRadius: 5,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              fontSize: 10.5, fontWeight: 600, color: 'rgba(234,234,224,0.5)',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {t}
            </span>
          ))}
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'rgba(234,234,224,0.4)' }}>
              <BookOpenIcon size={11}/> {course.lessons} bài
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'rgba(234,234,224,0.4)' }}>
              <ClockIcon size={11}/> {course.hours}h
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <StarIcon size={11}/>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#FCD34D' }}>{course.rating}</span>
            <span style={{ fontSize: 11, color: 'rgba(234,234,224,0.35)' }}>({course.students})</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ActiveLearningCard({ lang, setPage }: { lang: typeof LANGUAGES[0]; setPage: (p: Page) => void }) {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${lang.dimColor} 0%, rgba(23,23,34,0.8) 60%)`,
        border: `1px solid ${lang.borderColor}`,
        borderRadius: 14,
        padding: '20px 22px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onClick={() => setPage('vocabulary')}
    >
      <div style={{ position: 'absolute', right: -20, top: -20, fontSize: 90, opacity: 0.06, fontFamily: 'Noto Sans JP, sans-serif', lineHeight: 1, userSelect: 'none' }}>
        {lang.code === 'JP' ? '語' : lang.code === 'EN' ? 'A' : '文'}
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 22 }}>{lang.flag}</span>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#EAEAE0' }}>{lang.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(234,234,224,0.4)', fontFamily: 'JetBrains Mono, monospace' }}>Cấp {lang.level}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, color: lang.color }}>
            <TrendingUpIcon size={13}/>
            <span style={{ fontSize: 12, fontWeight: 600 }}>+12 hôm nay</span>
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: 'rgba(234,234,224,0.4)' }}>{lang.wordsLearned} / 1,200 từ</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: lang.color }}>{lang.progress}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${lang.progress}%`, background: `linear-gradient(90deg, ${lang.color}, ${lang.color}99)` }}/>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn-primary"
            style={{ flex: 1, justifyContent: 'center', background: lang.color, fontSize: 12, padding: '8px 14px' }}
          >
            <BookOpenIcon size={13}/> Học từ mới
          </button>
          <button
            className="btn-secondary"
            style={{ flex: 1, justifyContent: 'center', fontSize: 12, padding: '8px 14px' }}
            onClick={(e) => { e.stopPropagation() }}
          >
            Ôn tập SRS
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function HomePage({ setPage }: { setPage: (p: Page) => void }) {
  const activeLangs = LANGUAGES.filter(l => l.active)

  return (
    <div style={{ background: '#09090F', minHeight: '100vh' }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative',
        padding: '72px 40px 64px',
        overflow: 'hidden',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Glow orbs */}
        <div style={{ position: 'absolute', top: -60, left: '15%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,77,109,0.12) 0%, transparent 70%)', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', top: 20, right: '10%', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(77,139,255,0.1) 0%, transparent 70%)', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', bottom: -40, left: '50%', width: 500, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.07) 0%, transparent 70%)', pointerEvents: 'none' }}/>

        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>

            {/* Left: text */}
            <div style={{ animation: 'fadeInUp 0.5s ease both' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#FF4D6D', animation: 'pulseDot 2s infinite' }}/>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(234,234,224,0.4)' }}>
                  TRUNG TÂM NGÔN NGỮ AI
                </span>
              </div>

              <h1 style={{
                fontFamily: 'Fraunces, serif', fontWeight: 600,
                fontSize: 'clamp(36px, 4vw, 56px)', lineHeight: 1.1,
                color: '#EAEAE0', marginBottom: 20, letterSpacing: '-0.02em',
              }}>
                Học ngôn ngữ mới.{' '}
                <span className="gradient-text-multi">Mở ra thế giới mới.</span>
              </h1>

              <p style={{ fontSize: 16, lineHeight: 1.6, color: 'rgba(234,234,224,0.5)', marginBottom: 32, maxWidth: 420 }}>
                AI phân tích từ vựng chuyên sâu, học qua video thực tế, và lộ trình cá nhân hóa cho 14+ ngôn ngữ.
              </p>

              <div style={{ display: 'flex', gap: 12, marginBottom: 36, flexWrap: 'wrap' }}>
                <button className="btn-primary" style={{ fontSize: 14, padding: '12px 24px' }} onClick={() => setPage('vocabulary')}>
                  <ZapIcon size={15}/> Bắt đầu học miễn phí
                </button>
                <button className="btn-secondary" style={{ fontSize: 14, padding: '12px 24px' }} onClick={() => setPage('video')}>
                  <VideoIcon size={15}/> Xem demo Video AI
                </button>
              </div>

              {/* Stats strip */}
              <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                {STATS.map(s => (
                  <div key={s.label}>
                    <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 600, color: '#EAEAE0', lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 11.5, color: 'rgba(234,234,224,0.4)', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: active learning cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeInUp 0.5s 0.1s ease both' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(234,234,224,0.3)', marginBottom: 4 }}>
                Đang học
              </div>
              {activeLangs.map(lang => (
                <ActiveLearningCard key={lang.code} lang={lang} setPage={setPage}/>
              ))}

              {/* Streak badge */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 18px', background: 'rgba(249,115,22,0.08)',
                border: '1px solid rgba(249,115,22,0.2)', borderRadius: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>🔥</span>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#EAEAE0' }}>12 ngày liên tiếp</div>
                    <div style={{ fontSize: 11.5, color: 'rgba(234,234,224,0.4)' }}>Tiếp tục chuỗi hôm nay</div>
                  </div>
                </div>
                <div style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 600, color: '#F97316' }}>🏆</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px' }}>

        {/* ── Languages ──────────────────────────────────────────────────── */}
        <div style={{ padding: '56px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 600, color: '#EAEAE0', marginBottom: 6 }}>
                Chọn ngôn ngữ
              </h2>
              <p style={{ fontSize: 14, color: 'rgba(234,234,224,0.4)' }}>
                14 ngôn ngữ được hỗ trợ bởi AI phân tích chuyên sâu
              </p>
            </div>
            <button className="btn-ghost" style={{ fontSize: 13 }}>
              Xem tất cả <ArrowRightIcon size={13}/>
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 16,
          }}>
            {LANGUAGES.map((lang, i) => (
              <div key={lang.code} style={{ animation: `fadeInUp 0.4s ${0.05 * i}s ease both` }}>
                <LangCard lang={lang} setPage={setPage}/>
              </div>
            ))}
          </div>
        </div>

        {/* ── Divider ─────────────────────────────────────────────────────── */}
        <div className="section-divider" style={{ margin: '52px 0 0' }}/>

        {/* ── Featured Courses ────────────────────────────────────────────── */}
        <div style={{ padding: '52px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 600, color: '#EAEAE0', marginBottom: 6 }}>
                Khóa học nổi bật
              </h2>
              <p style={{ fontSize: 14, color: 'rgba(234,234,224,0.4)' }}>
                Được thiết kế bởi giáo viên bản ngữ và chuyên gia AI
              </p>
            </div>
            <button className="btn-secondary" style={{ fontSize: 13 }} onClick={() => setPage('courses')}>
              Xem tất cả khóa học <ArrowRightIcon size={13}/>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {COURSES.map((course, i) => (
              <div key={course.id} style={{ animation: `fadeInUp 0.4s ${0.08 * i}s ease both` }}>
                <CourseCard course={course}/>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tools Banner ────────────────────────────────────────────────── */}
        <div style={{ padding: '52px 0 64px' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16,
          }}>
            {[
              {
                icon: '⚡', title: 'Tra từ AI', desc: 'Phân tích sâu kanji, chia động từ, ngữ pháp và gợi nhớ thông minh.', color: '#FF4D6D', action: () => setPage('vocabulary'), cta: 'Tra từ ngay',
              },
              {
                icon: '🎬', title: 'Học qua Video', desc: 'Nhập video YouTube hoặc tự quay — AI tạo phụ đề tương tác và từ vựng tự động.', color: '#4D8BFF', action: () => setPage('video'), cta: 'Thử Video AI',
              },
              {
                icon: '📚', title: 'Khóa học', desc: 'Lộ trình học có cấu trúc với giáo viên bản ngữ và AI theo dõi tiến độ.', color: '#A855F7', action: () => setPage('courses'), cta: 'Khám phá',
              },
            ].map((tool, i) => (
              <div
                key={tool.title}
                style={{
                  padding: '28px 26px',
                  background: 'rgba(23,23,34,0.6)',
                  border: `1px solid rgba(255,255,255,0.07)`,
                  borderRadius: 16, cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  animation: `fadeInUp 0.4s ${0.1 * i}s ease both`,
                  position: 'relative', overflow: 'hidden',
                }}
                onClick={tool.action}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = `${tool.color}40`
                  ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)'
                  ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 14, display: 'block' }}>{tool.icon}</div>
                <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600, color: '#EAEAE0', marginBottom: 8 }}>
                  {tool.title}
                </div>
                <div style={{ fontSize: 13.5, color: 'rgba(234,234,224,0.45)', lineHeight: 1.6, marginBottom: 20 }}>
                  {tool.desc}
                </div>
                <button
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 9,
                    background: `${tool.color}20`, border: `1px solid ${tool.color}40`,
                    color: tool.color, fontSize: 12.5, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                    transition: 'all 0.15s',
                  }}
                >
                  {tool.cta} <ArrowRightIcon size={12}/>
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
