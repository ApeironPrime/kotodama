import { useState, useRef } from 'react'
import VideoLearning from './VideoLearning'
import HomePage from './HomePage'

type Page = 'home' | 'vocabulary' | 'video' | 'courses'

// ─── Icons (inline SVG components) ────────────────────────────────────────────

const SearchIcon = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
)

const StarIcon = ({ filled = false, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
)

const VolumeIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
)

const BookIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
)

const LayersIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
  </svg>
)

const GridIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
)

const MessageIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)

const ZapIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
)

const ChevronDownIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)

const CheckIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const XIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const ArrowRightIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
)

const BrainIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
  </svg>
)

const SendIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)

const SettingsIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

const RefreshIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
)

// ─── Data ─────────────────────────────────────────────────────────────────────

const conjugationData = [
  { form: 'Thể từ điển', jp: '育つ', romaji: 'sodatsu' },
  { form: 'Thể lịch sự (ます)', jp: '育ちます', romaji: 'sodachimasu' },
  { form: 'Thể phủ định (ない)', jp: '育たない', romaji: 'sodatanai' },
  { form: 'Thể て', jp: '育って', romaji: 'sodatte' },
  { form: 'Thể quá khứ (た)', jp: '育った', romaji: 'sodatta' },
  { form: 'Thể khả năng', jp: '育てる', romaji: 'sodateru' },
  { form: 'Thể bị động', jp: '育たれる', romaji: 'sodatareru' },
  { form: 'Thể sai khiến', jp: '育たせる', romaji: 'sodataseru' },
  { form: 'Thể ý chí', jp: '育とう', romaji: 'sodatou' },
  { form: 'Thể điều kiện', jp: '育てば', romaji: 'sodateba' },
]

const exampleSentences = [
  {
    jp: '子供は豊かな環境で育つ。',
    furigana: 'こどもはゆたかなかんきょうでそだつ。',
    en: 'Children grow up in a rich environment.',
    vi: 'Trẻ em lớn lên trong môi trường phong phú.',
    level: 'n4',
    label: 'N4',
  },
  {
    jp: '彼は田舎で育った。',
    furigana: 'かれはいなかでそだった。',
    en: 'He grew up in the countryside.',
    vi: 'Anh ấy lớn lên ở vùng nông thôn.',
    level: 'n5',
    label: 'N5',
  },
  {
    jp: 'この植物は日当たりの良い場所でよく育つ。',
    furigana: 'このしょくぶつはひあたりのよいばしょでよくそだつ。',
    en: 'This plant grows well in a sunny spot.',
    vi: 'Cây này phát triển tốt ở nơi có nhiều ánh nắng.',
    level: 'n3',
    label: 'N3',
  },
]

const similarWords = [
  { jp: '育つ', furigana: 'そだつ', en: 'lớn lên (nội động từ)', diff: 'Tự nhiên lớn lên — chủ thể tự phát triển không cần tác động bên ngoài.' },
  { jp: '育てる', furigana: 'そだてる', en: 'nuôi dưỡng, chăm sóc (ngoại động từ)', diff: 'Ai đó chủ động nuôi nấng hoặc dạy dỗ đối tượng khác.' },
  { jp: '成長する', furigana: 'せいちょうする', en: 'phát triển, trưởng thành', diff: 'Trang trọng hơn, dùng cho người, tổ chức và cả khái niệm trừu tượng.' },
  { jp: '伸びる', furigana: 'のびる', en: 'vươn dài, cải thiện', diff: 'Thiên về tăng trưởng vật lý theo chiều dài hoặc con số định lượng.' },
]

const wordFamily = [
  { jp: '教育', reading: 'きょういく', en: 'giáo dục' },
  { jp: '体育', reading: 'たいいく', en: 'thể dục' },
  { jp: '育児', reading: 'いくじ', en: 'chăm sóc trẻ em' },
  { jp: '保育', reading: 'ほいく', en: 'nuôi dưỡng, bảo mẫu' },
  { jp: '育成', reading: 'いくせい', en: 'đào tạo, phát triển' },
]

const quizOptions = [
  'Lớn lên, được nuôi dưỡng',
  'Héo tàn và chết đi',
  'Dạy dỗ ai đó',
  'Gieo một hạt giống',
]

const sidebarSections = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'meaning', label: 'Ý nghĩa' },
  { id: 'kanji', label: 'Phân tích Kanji' },
  { id: 'anatomy', label: 'Cấu tạo từ' },
  { id: 'conjugation', label: 'Chia động từ' },
  { id: 'grammar', label: 'Ghi chú ngữ pháp' },
  { id: 'collocations', label: 'Cụm từ thông dụng' },
  { id: 'examples', label: 'Câu ví dụ' },
  { id: 'similar', label: 'Từ tương tự' },
  { id: 'family', label: 'Gia đình từ' },
  { id: 'memory', label: 'Mẹo ghi nhớ AI' },
  { id: 'mistakes', label: 'Lỗi thường gặp' },
  { id: 'quiz', label: 'Kiểm tra nhanh' },
  { id: 'flashcards', label: 'Thẻ ghi nhớ' },
]

// ─── Sub-components ────────────────────────────────────────────────────────────

function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={onClick}>
      <div style={{
        width: 34, height: 34, borderRadius: 10,
        background: 'linear-gradient(135deg, #FF4D6D 0%, #C2185B 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontSize: 17, fontFamily: "'Noto Sans JP', sans-serif",
        fontWeight: 700, flexShrink: 0,
        boxShadow: '0 2px 12px rgba(255,77,109,0.4)',
      }}>語</div>
      <span style={{ fontSize: 18, fontWeight: 700, color: '#EAEAE0', letterSpacing: '-0.03em', fontFamily: 'Fraunces, serif' }}>
        Lingua
      </span>
    </div>
  )
}

const NAV_TABS: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Trang chủ', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { id: 'vocabulary', label: 'Tra Từ', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> },
  { id: 'video', label: 'Video AI', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg> },
  { id: 'courses', label: 'Khóa Học', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
]

function TopNav({ onHeroFocus, page, setPage }: { onHeroFocus: () => void; page: Page; setPage: (p: Page) => void }) {
  const [credits] = useState(47)
  return (
    <nav className="nav-bar" style={{ height: 64 }}>
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 28px', height: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Logo onClick={() => setPage('home')} />

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)', margin: '0 16px', flexShrink: 0 }}/>

        {/* Nav tabs */}
        <div style={{ display: 'flex', gap: 2 }}>
          {NAV_TABS.map(tab => (
            <button
              key={tab.id}
              className={`nav-tab${page === tab.id ? ' active' : ''}`}
              onClick={() => setPage(tab.id)}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'video' && (
                <span style={{ padding: '1px 6px', background: 'rgba(255,77,109,0.2)', color: '#FF7D9D', borderRadius: 5, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', fontFamily: 'JetBrains Mono, monospace' }}>AI</span>
              )}
            </button>
          ))}
        </div>

        {/* Top search (vocabulary page only) */}
        {page === 'vocabulary' && (
          <div style={{ flex: 1, maxWidth: 360, marginLeft: 16, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(234,234,224,0.3)', pointerEvents: 'none' }}>
              <SearchIcon size={14} />
            </div>
            <input
              className="top-search"
              placeholder="Tìm từ tiếng Nhật, kanji..."
              onFocus={onHeroFocus}
              style={{ paddingLeft: 36 }}
            />
          </div>
        )}

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          {/* Streak */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 20 }}>
            <span style={{ fontSize: 14 }}>🔥</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#FB923C', fontFamily: 'JetBrains Mono, monospace' }}>12</span>
          </div>
          {/* Credits */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.2)', borderRadius: 20 }}>
            <ZapIcon size={12} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#FF7D9D', fontFamily: 'JetBrains Mono, monospace' }}>{credits}</span>
          </div>
          <button className="btn-icon" style={{ marginLeft: 2 }}>
            <SettingsIcon size={15} />
          </button>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'linear-gradient(135deg, #FF4D6D 0%, #C2185B 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            marginLeft: 4, flexShrink: 0,
            boxShadow: '0 2px 8px rgba(255,77,109,0.3)',
          }}>L</div>
        </div>
      </div>
    </nav>
  )
}

function HeroSearch({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  const suggestions = ['食べる', '勉強', '優しい', '成長', '育てる']
  return (
    <div style={{ position: 'relative', padding: '52px 24px 44px', borderBottom: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      {/* Glow */}
      <div style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: 600, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,77,109,0.1) 0%, transparent 70%)', pointerEvents: 'none' }}/>

      <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#FF4D6D', animation: 'pulseDot 2s infinite' }} />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(234,234,224,0.4)' }}>
            Phân tích từ vựng AI · Tiếng Nhật
          </span>
        </div>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 40, fontWeight: 600, color: '#EAEAE0', letterSpacing: '-0.025em', marginBottom: 10, lineHeight: 1.1 }}>
          Tra bất kỳ từ tiếng Nhật nào
        </h1>
        <p style={{ fontSize: 15, color: 'rgba(234,234,224,0.45)', marginBottom: 32, lineHeight: 1.6 }}>
          Phân tích kanji · chia động từ · ngữ pháp · gợi nhớ AI · câu ví dụ
        </p>

        <div style={{ position: 'relative', marginBottom: 16 }}>
          <input
            ref={inputRef}
            className="search-bar-hero"
            defaultValue="育つ"
            style={{ paddingRight: 170, fontFamily: "'Noto Sans JP', sans-serif" }}
            placeholder="Nhập từ hoặc kanji tiếng Nhật..."
          />
          <button className="btn-primary" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', whiteSpace: 'nowrap' }}>
            <ZapIcon size={13} />
            Phân tích với AI
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, color: 'rgba(234,234,224,0.3)', fontFamily: 'JetBrains Mono, monospace' }}>Gợi ý:</span>
          {suggestions.map(s => (
            <button key={s} className="collocation-chip" style={{ fontSize: 13 }}>{s}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

function LeftSidebar({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  return (
    <aside className="left-sidebar" style={{ width: 200, padding: '20px 14px', borderRight: '1px solid rgba(255,255,255,0.06)', background: '#09090F' }}>
      <div style={{ paddingLeft: 12, marginBottom: 10, fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(234,234,224,0.3)' }}>Mục lục</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {sidebarSections.map(s => (
          <button
            key={s.id}
            className={`sidebar-link${active === s.id ? ' active' : ''}`}
            onClick={() => {
              onSelect(s.id)
              document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </aside>
  )
}

function WordHeader() {
  const [faved, setFaved] = useState(false)
  const [playing, setPlaying] = useState(false)
  return (
    <div style={{ padding: '28px 32px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(23,23,34,0.6)', backdropFilter: 'blur(10px)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
        <div>
          <div className="word-large" style={{ marginBottom: 8 }}>育つ</div>
          <div className="furigana-text" style={{ marginBottom: 16 }}>そだつ · sodatsu</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            <span className="tag tag-red">JLPT N4</span>
            <span className="tag tag-blue">Động từ (自動詞)</span>
            <span className="tag tag-green">Nhóm 1</span>
            <span className="tag tag-gray">Tần suất #2.847</span>
            <span className="pitch-badge">
              <span style={{ fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif" }}>そ↑だつ</span>
              Thanh điệu: LHL
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0, paddingTop: 4 }}>
          <button
            className={`btn-icon${faved ? ' active' : ''}`}
            onClick={() => setFaved(f => !f)}
            title="Yêu thích"
          >
            <StarIcon filled={faved} size={16} />
          </button>
          <button
            className={`btn-icon${playing ? ' active' : ''}`}
            onClick={() => setPlaying(p => !p)}
            title="Phát âm"
          >
            <VolumeIcon size={16} />
          </button>
          <button className="btn-secondary" style={{ gap: 6 }}>
            <LayersIcon size={14} />
            Thêm vào bộ thẻ
          </button>
        </div>
      </div>
    </div>
  )
}

function Card({ id, title, children, style = {} }: { id?: string; title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div id={id} className="card section-anchor animate-fade-in-up" style={{ padding: '24px 28px', ...style }}>
      <div className="card-heading" style={{ marginBottom: 20 }}>{title}</div>
      {children}
    </div>
  )
}

function OverviewCard() {
  return (
    <Card id="overview" title="Tổng quan">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 52, fontWeight: 300, color: '#EAEAE0', lineHeight: 1, marginBottom: 10 }}>育つ</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(234,234,224,0.35)', width: 72 }}>Furigana</span>

              <span style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 16, color: 'rgba(234,234,224,0.82)' }}>そだつ</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(234,234,224,0.35)', width: 72 }}>Romaji</span>
              <span style={{ fontSize: 15, color: 'rgba(234,234,224,0.82)', fontStyle: 'italic' }}>sodatsu</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(234,234,224,0.35)', width: 72 }}>IPA</span>
              <span style={{ fontSize: 14, color: 'rgba(234,234,224,0.55)', fontFamily: 'monospace' }}>/so̞ɾa̠t͡sɯ̟ᵝ/</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.04)', borderRadius: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(234,234,224,0.35)', marginBottom: 8 }}>Tiếng Anh</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#EAEAE0', lineHeight: 1.5 }}>To grow up; to be raised;<br/>to be brought up</div>
          </div>
          <div style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.04)', borderRadius: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(234,234,224,0.35)', marginBottom: 8 }}>Tiếng Việt</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(234,234,224,0.82)' }}>Lớn lên; được nuôi dưỡng</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 20, padding: '16px 20px', background: 'rgba(255,77,109,0.1)', borderRadius: 12, borderLeft: '3px solid #FF4D6D' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <BrainIcon size={16} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#FF7D9D', marginBottom: 6 }}>Phân tích AI</div>
            <div style={{ fontSize: 14, color: 'rgba(234,234,224,0.82)', lineHeight: 1.7 }}>
              育つ là <strong>nội động từ</strong> (自動詞) — chủ thể tự lớn lên mà không cần tác nhân bên ngoài. Khác với 育てる (ngoại động từ), nơi ai đó chủ động nuôi dưỡng đối tượng. Kanji 育 kết hợp 肉 (thịt, thân xác) và 子 (đứa trẻ), gợi lên hình ảnh cơ thể được chăm chút từ khi mới sinh.
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function KanjiCard() {
  const relatedWords = ['育てる', '教育', '保育', '体育', '育成', '育児', '養育']
  return (
    <Card id="kanji" title="Phân tích Kanji">
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div className="stroke-placeholder">育</div>
          <div style={{ fontSize: 11, color: 'rgba(234,234,224,0.45)', fontWeight: 500, textAlign: 'center' }}>Thứ tự nét</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Kanji', value: '育', jp: true },
            { label: 'Số nét', value: '8' },
            { label: 'Bộ thủ', value: '肉 (thịt)' },
            { label: 'Lớp học', value: '3' },
            { label: 'Âm On', value: 'イク', jp: true },
            { label: 'Âm Kun', value: 'そだ(つ)・そだ(てる)', jp: true },
          ].map(item => (
            <div key={item.label} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(234,234,224,0.35)', marginBottom: 4 }}>{item.label}</div>
              <div style={{
                fontSize: item.jp ? 15 : 14,
                fontWeight: 600,
                color: 'rgba(234,234,224,0.85)',
                fontFamily: item.jp ? "'Noto Sans JP', sans-serif" : 'inherit',
              }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(234,234,224,0.35)', marginBottom: 12 }}>Từ liên quan</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {relatedWords.map(w => (
            <button key={w} className="collocation-chip">{w}</button>
          ))}
        </div>
      </div>
    </Card>
  )
}

function AnatomyCard() {
  return (
    <Card id="anatomy" title="Cấu tạo từ">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ padding: '12px 20px', background: 'rgba(255,77,109,0.1)', border: '2px solid rgba(255,77,109,0.25)', borderRadius: 12, textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 36, color: '#FF7D9D', fontWeight: 300, lineHeight: 1 }}>育</div>
            <div style={{ fontSize: 11, color: '#FF7D9D', fontWeight: 600, marginTop: 4 }}>kanji</div>
          </div>
          <div style={{ padding: '12px 20px', background: '#E3F2FD', border: '2px solid #BBDEFB', borderRadius: 12, textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 36, color: '#1565C0', fontWeight: 300, lineHeight: 1 }}>つ</div>
            <div style={{ fontSize: 11, color: '#1565C0', fontWeight: 600, marginTop: 4 }}>hậu tố</div>
          </div>
          <div style={{ padding: '14px 18px', flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 13, color: 'rgba(234,234,224,0.55)', lineHeight: 1.7 }}>
              <strong style={{ color: '#FF7D9D' }}>育 (iku/soda)</strong> — phần kanji cốt lõi mang nghĩa "nuôi dưỡng, chăm sóc, lớn lên." Gồm <strong>肉</strong> (thịt, thân xác) phía dưới và hình ảnh đứa trẻ phía trên, trực quan hóa cơ thể đang phát triển vươn lên.<br /><br />
              <strong style={{ color: '#1565C0' }}>つ (tsu)</strong> — hiragana kết thúc động từ, tạo thành thể từ điển của động từ nhóm 1 (godan) này.
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.04)', borderRadius: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(234,234,224,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Nguồn gốc từ</div>
          <div style={{ fontSize: 13.5, color: 'rgba(234,234,224,0.82)', lineHeight: 1.7 }}>
            Bắt nguồn từ tiếng Hán 育 (yù), kết hợp thành phần ngữ nghĩa của thịt/thân xác (肉) và đứa trẻ lộn ngược (子 đảo ngược), tượng trưng cho em bé được sinh ra và nuôi lớn. Khái niệm "lớn lên" hình thành từ ý tưởng về một thân xác được chăm sóc từ khi mới chào đời.
          </div>
        </div>
      </div>
    </Card>
  )
}

function ConjugationCard() {
  return (
    <Card id="conjugation" title="Bảng chia động từ">
      <div style={{ overflow: 'hidden', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
        <table className="conjugation-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ width: '35%' }}>Thể</th>
              <th style={{ width: '35%' }}>Tiếng Nhật</th>
              <th style={{ width: '30%' }}>Romaji</th>
            </tr>
          </thead>
          <tbody>
            {conjugationData.map((row, i) => (
              <tr key={i}>
                <td style={{ fontSize: 13, color: 'rgba(234,234,224,0.55)', fontWeight: 500 }}>{row.form}</td>
                <td className="jp">{row.jp}</td>
                <td style={{ fontSize: 13, color: 'rgba(234,234,224,0.45)', fontStyle: 'italic' }}>{row.romaji}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function GrammarCard() {
  const patterns = [
    { pattern: '〜で育つ', example: '都会で育つ', en: 'lớn lên ở [nơi chốn]' },
    { pattern: '〜に育つ', example: '健康に育つ', en: 'lớn lên theo [cách/trạng thái]' },
    { pattern: '〜として育つ', example: '一人っ子として育つ', en: 'lớn lên với tư cách [vai trò]' },
  ]
  return (
    <Card id="grammar" title="Ghi chú ngữ pháp">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {[
          { heading: 'Khi nào dùng', body: '育つ được dùng khi chủ thể tự lớn lên hoặc phát triển một cách tự nhiên — cây cối sinh trưởng, trẻ em trưởng thành, kỹ năng hình thành. Điểm mấu chốt là không có tác nhân bên ngoài đóng vai chủ ngữ ngữ pháp.' },
          { heading: 'Trợ từ đi kèm', body: 'Thường dùng với で (nơi lớn lên), に (trạng thái kết quả), và として (lớn lên với tư cách một vai trò hoặc danh tính).' },
          { heading: 'Lỗi điển hình', body: 'Học viên hay nhầm 育つ (nội động từ) với 育てる (ngoại động từ). Không thể nói ×「親が育つ」— cha mẹ không "tự lớn", họ "nuôi dưỡng". Dùng 育てる khi ai đó chủ động chăm sóc đối tượng khác.' },
        ].map(item => (
          <div key={item.heading}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(234,234,224,0.82)', marginBottom: 6 }}>{item.heading}</div>
            <div style={{ fontSize: 13.5, color: 'rgba(234,234,224,0.55)', lineHeight: 1.7 }}>{item.body}</div>
          </div>
        ))}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(234,234,224,0.82)', marginBottom: 10 }}>Cấu trúc thường gặp</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {patterns.map(p => (
              <div key={p.pattern} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 14, color: '#FF7D9D', fontWeight: 600, width: 140, flexShrink: 0 }}>{p.pattern}</span>
                <span style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 14, color: 'rgba(234,234,224,0.85)' }}>{p.example}</span>
                <span style={{ fontSize: 13, color: 'rgba(234,234,224,0.45)', marginLeft: 'auto', flexShrink: 0 }}>{p.en}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

function CollocationsCard() {
  const collocations = [
    '子供が育つ', '植物が育つ', '健康に育つ', '大きく育つ',
    '豊かな環境で育つ', '自然の中で育つ', '才能が育つ', '人材が育つ',
    'たくましく育つ', '田舎で育つ',
  ]
  return (
    <Card id="collocations" title="Cụm từ thông dụng">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
        {collocations.map(c => (
          <button key={c} className="collocation-chip">{c}</button>
        ))}
      </div>
    </Card>
  )
}

function ExamplesCard() {
  return (
    <Card id="examples" title="Câu ví dụ">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {exampleSentences.map((s, i) => (
          <div key={i} style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.04)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`diff-badge ${s.level}`}>{s.label}</span>
              </div>
              <button className="btn-icon" style={{ width: 30, height: 30, borderRadius: 8 }}>
                <VolumeIcon size={13} />
              </button>
            </div>
            <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 17, color: '#EAEAE0', marginBottom: 4, lineHeight: 1.6 }}>{s.jp}</div>
            <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 12, color: 'rgba(234,234,224,0.45)', marginBottom: 10, letterSpacing: '0.04em' }}>{s.furigana}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ fontSize: 13.5, color: 'rgba(234,234,224,0.82)' }}>🇬🇧 {s.en}</div>
              <div style={{ fontSize: 13.5, color: 'rgba(234,234,224,0.55)' }}>🇻🇳 {s.vi}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function SimilarWordsCard() {
  return (
    <Card id="similar" title="Từ tương tự">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {similarWords.map((w, i) => (
          <div key={i} style={{ padding: '16px 18px', background: 'rgba(255,255,255,0.04)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', transition: 'all 0.15s ease' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,77,109,0.4)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,77,109,0.08)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'; }}
          >
            <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 22, color: '#EAEAE0', fontWeight: 400, marginBottom: 2 }}>{w.jp}</div>
            <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 12, color: 'rgba(234,234,224,0.45)', marginBottom: 8 }}>{w.furigana}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(234,234,224,0.82)', marginBottom: 8 }}>{w.en}</div>
            <div style={{ fontSize: 12, color: 'rgba(234,234,224,0.55)', lineHeight: 1.6 }}>{w.diff}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function WordFamilyCard() {
  return (
    <Card id="family" title="Gia đình từ">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, padding: '8px 0' }}>
        {/* Root */}
        <div className="network-node">
          <div className="kanji-node root">育</div>
          <div style={{ fontSize: 11, color: '#FF7D9D', fontWeight: 600, letterSpacing: '0.04em' }}>gốc</div>
        </div>

        <div className="network-line" style={{ height: 20 }} />

        {/* Children */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          {wordFamily.map((w, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
              <div className="network-line" style={{ height: 20 }} />
              <div className="network-node">
                <div className="kanji-node">{w.jp}</div>
                <div style={{ fontSize: 10, color: 'rgba(234,234,224,0.45)', fontFamily: "'Noto Sans JP', sans-serif", textAlign: 'center', maxWidth: 72 }}>{w.reading}</div>
                <div style={{ fontSize: 11, color: 'rgba(234,234,224,0.55)', textAlign: 'center', maxWidth: 80 }}>{w.en}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

function MemoryTrickCard() {
  return (
    <Card id="memory" title="Mẹo ghi nhớ AI">
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20 }}>
        <div style={{
          width: 120, height: 120, borderRadius: 16,
          background: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 64, flexShrink: 0,
        }}>🌱</div>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'rgba(255,77,109,0.12)', borderRadius: 8, marginBottom: 12 }}>
            <BrainIcon size={13} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#FF7D9D', letterSpacing: '0.04em' }}>Gợi nhớ AI</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#EAEAE0', marginBottom: 10, lineHeight: 1.4 }}>
            "SÔ-ĐA-TSU — hạt giống tự mọc, không ai ép!"
          </div>
          <div style={{ fontSize: 13.5, color: 'rgba(234,234,224,0.55)', lineHeight: 1.8 }}>
            Hãy tưởng tượng một <strong>hạt giống (so)</strong> rơi xuống mảnh đất <strong>đó</strong> (da) thật màu mỡ. Nó <strong>tự</strong> (tsu) vươn lên mà không cần ai tưới tắm — cũng như 育つ là nội động từ, chủ thể tự lớn, không ai bắt buộc!
          </div>
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, fontSize: 13, color: 'rgba(234,234,224,0.55)' }}>
            <strong>Hình ảnh:</strong> 育 trông như một mầm cây (⊤) mọc lên từ thân xác (⊥) — sự sống vươn lên từ mặt đất.
          </div>
        </div>
      </div>
    </Card>
  )
}

function CommonMistakesCard() {
  const mistakes = [
    {
      wrong: '親が育つ。',
      correct: '親が育てる。',
      explanation: '育つ là nội động từ — cha mẹ là chủ thể nuôi dưỡng, không phải người đang lớn. Dùng 育てる (ngoại động từ) khi diễn đạt vai trò chủ động của cha mẹ.',
    },
    {
      wrong: '子供を育つ。',
      correct: '子供が育つ / 子供を育てる。',
      explanation: '育つ không bao giờ đi với tân ngữ trực tiếp (を). Nếu cần dùng を, hãy chuyển sang 育てる.',
    },
  ]
  return (
    <Card id="mistakes" title="Lỗi thường gặp">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {mistakes.map((m, i) => (
          <div key={i}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div className="mistake-card-wrong">
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,77,109,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF7D9D' }}>
                    <XIcon size={10} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#FCA5A5', letterSpacing: '0.06em' }}>SAI</span>
                </div>
                <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 16, color: '#B71C1C', textDecoration: 'line-through' }}>{m.wrong}</div>
              </div>
              <div className="mistake-card-correct">
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34D399' }}>
                    <CheckIcon size={10} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#34D399', letterSpacing: '0.06em' }}>ĐÚNG</span>
                </div>
                <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 16, color: '#1B5E20' }}>{m.correct}</div>
              </div>
            </div>
            <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', fontSize: 13, color: 'rgba(234,234,224,0.55)', lineHeight: 1.7 }}>
              💡 {m.explanation}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function QuizCard() {
  const [selected, setSelected] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const correct = 0

  const handleSelect = (i: number) => {
    setSelected(i)
    setRevealed(true)
  }

  return (
    <Card id="quiz" title="Kiểm tra nhanh">
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(234,234,224,0.45)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Trắc nghiệm</div>
        <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 22, color: '#EAEAE0', marginBottom: 6 }}>育つ <span style={{ fontSize: 15, color: 'rgba(234,234,224,0.45)', fontFamily: "Inter, sans-serif" }}>có nghĩa là...</span></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 16 }}>
        {quizOptions.map((opt, i) => {
          let cls = 'quiz-option'
          if (revealed) {
            if (i === correct) cls += ' correct'
            else if (i === selected && i !== correct) cls += ' wrong'
          }
          return (
            <button key={i} className={cls} onClick={() => !revealed && handleSelect(i)}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'inherit', marginRight: 10, opacity: 0.5 }}>{String.fromCharCode(65 + i)}.</span>
              {opt}
            </button>
          )
        })}
      </div>
      {!revealed ? (
        <button className="btn-secondary" onClick={() => setRevealed(true)} style={{ gap: 7 }}>
          <ChevronDownIcon size={13} /> Xem đáp án
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 16px', background: selected === correct ? 'rgba(16,185,129,0.15)' : 'rgba(255,77,109,0.12)', borderRadius: 10 }}>
          <div style={{ fontSize: 18 }}>{selected === correct ? '🎉' : '📖'}</div>
          <div style={{ fontSize: 13, color: selected === correct ? '#2E7D32' : '#C62828', fontWeight: 500 }}>
            {selected === correct ? 'Chính xác! 育つ nghĩa là "lớn lên" (nội động từ).' : 'Chưa đúng. 育つ có nghĩa là "lớn lên, được nuôi dưỡng" — đáp án đầu tiên.'}
          </div>
          <button className="btn-secondary" onClick={() => { setSelected(null); setRevealed(false) }} style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>Thử lại</button>
        </div>
      )}
    </Card>
  )
}

function FlashcardDeck() {
  const [flipped, setFlipped] = useState(false)
  const [cardIndex, setCardIndex] = useState(0)
  const cards = [
    { front: '育つ', back: 'Lớn lên, được nuôi dưỡng (nội động từ)' },
    { front: '育てる', back: 'Nuôi dưỡng, dạy dỗ (ngoại động từ)' },
    { front: '教育', back: 'Giáo dục' },
  ]
  const card = cards[cardIndex % cards.length]

  return (
    <Card id="flashcards" title="Thẻ ghi nhớ">
      <div className="flashcard" onClick={() => setFlipped(f => !f)} style={{ cursor: 'pointer' }}>
        <div className={`flashcard-inner${flipped ? ' flipped' : ''}`}>
          <div className="flashcard-face">
            <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 48, color: '#EAEAE0', fontWeight: 300 }}>{card.front}</div>
            <div style={{ fontSize: 12, color: 'rgba(234,234,224,0.4)', marginTop: 12, fontWeight: 500 }}>Nhấn để lật thẻ</div>
          </div>
          <div className="flashcard-face flashcard-back">
            <div style={{ fontSize: 18, fontWeight: 600, color: '#FCA5A5', textAlign: 'center', padding: '0 24px', lineHeight: 1.5 }}>{card.back}</div>
            <div style={{ fontFamily: "'Noto Sans JP', sans-serif", fontSize: 28, color: '#FF7D9D', marginTop: 10, opacity: 0.4 }}>{card.front}</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: 'rgba(234,234,224,0.45)' }}>{cardIndex + 1} / {cards.length}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => { setFlipped(false); setCardIndex(i => Math.max(0, i - 1)) }}>← Trước</button>
          <button className="btn-secondary" onClick={() => { setFlipped(false); setCardIndex(i => i + 1) }}>Tiếp →</button>
        </div>
      </div>
    </Card>
  )
}

function RightSidebar() {
  const [faved, setFaved] = useState(false)
  const [note, setNote] = useState('')
  return (
    <aside className="right-sidebar" style={{ width: 240, padding: '20px 14px 20px 18px', background: '#09090F', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Progress */}
      <div className="card" style={{ padding: '18px 18px', marginBottom: 14 }}>
        <div className="section-title">Tiến độ học tập</div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(234,234,224,0.5)' }}>XP tuần này</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#FF7D9D' }}>340 / 500</span>
          </div>
          <div className="xp-bar-track">
            <div className="xp-bar-fill" style={{ width: '68%' }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Thành thạo', value: 'Trung cấp' },
            { label: 'Ôn tập', value: '3 thẻ' },
            { label: 'Lần cuối', value: '2 ngày trước' },
            { label: 'Độ khó', value: 'Trung bình' },
          ].map(item => (
            <div key={item.label} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 9 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(234,234,224,0.3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3, fontFamily: 'JetBrains Mono, monospace' }}>{item.label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(234,234,224,0.75)' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Review Countdown */}
      <div className="card" style={{ padding: '16px 18px', marginBottom: 14 }}>
        <div className="section-title">Ôn tập tiếp theo</div>
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 700, color: '#FF7D9D', letterSpacing: '-0.01em' }}>23:14:08</div>
          <div style={{ fontSize: 12, color: 'rgba(234,234,224,0.45)', marginTop: 4 }}>SRS · Khoảng cách: 4 ngày</div>
        </div>
        <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 13, padding: '9px 0' }}>
          <RefreshIcon size={13} />
          Ôn ngay
        </button>
      </div>

      {/* Favorite */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 14 }}>
        <button
          onClick={() => setFaved(f => !f)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <div style={{ color: faved ? '#E53935' : '#D8D5CC' }}>
            <StarIcon filled={faved} size={20} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: faved ? '#E53935' : '#635E54' }}>
              {faved ? 'Đã yêu thích' : 'Thêm vào yêu thích'}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(234,234,224,0.35)' }}>Lưu để ôn tập nhanh</div>
          </div>
        </button>
      </div>

      {/* Personal Notes */}
      <div className="card" style={{ padding: '16px 18px' }}>
        <div className="section-title">Ghi chú cá nhân</div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Viết ghi chú của bạn về từ này..."
          style={{
            width: '100%', minHeight: 100, background: 'rgba(255,255,255,0.04)',
            border: '1.5px solid #ECEAE4', borderRadius: 10,
            padding: '10px 12px', fontSize: 13, color: 'rgba(234,234,224,0.82)',
            resize: 'vertical', outline: 'none', fontFamily: 'Inter, sans-serif',
            lineHeight: 1.6,
            transition: 'border-color 0.15s ease',
          }}
          onFocus={e => { e.target.style.borderColor = '#E53935' }}
          onBlur={e => { e.target.style.borderColor = '#ECEAE4' }}
        />
        {note && (
          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 12, padding: '8px 0', marginTop: 10 }}>
            Lưu ghi chú
          </button>
        )}
      </div>
    </aside>
  )
}

function FloatingChat() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: 'Xin chào! Tôi là trợ lý AI của bạn cho từ 育つ. Hãy hỏi bất cứ điều gì — ngữ pháp, sắc thái, câu ví dụ hay văn hóa Nhật Bản.' }
  ])

  const send = () => {
    if (!message.trim()) return
    setMessages(m => [...m, { role: 'user', text: message }, { role: 'ai', text: `Câu hỏi hay về 育つ! Hãy để tôi giải thích thêm về "${message}"...` }])
    setMessage('')
  }

  return (
    <div className="floating-chat">
      {open && (
        <div className="chat-bubble" style={{ width: 320, marginBottom: 12 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #FF4D6D, #C2185B)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <BrainIcon size={14} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#EAEAE0' }}>Trợ lý AI</div>
              <div style={{ fontSize: 11, color: '#4CAF50', fontWeight: 500 }}>● Trực tuyến</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(234,234,224,0.35)' }}>
              <XIcon size={16} />
            </button>
          </div>
          <div style={{ height: 200, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '82%', padding: '9px 13px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.role === 'user' ? '#E53935' : '#F5F4F0',
                  color: m.role === 'user' ? 'white' : '#3D3A33',
                  fontSize: 13, lineHeight: 1.6,
                }}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '10px 12px', borderTop: '1px solid #ECEAE4', display: 'flex', gap: 8 }}>
            <input
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Hỏi bất cứ điều gì về từ này..."
              style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1.5px solid #ECEAE4', borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif', color: 'rgba(234,234,224,0.85)' }}
              onFocus={e => { e.target.style.borderColor = '#E53935' }}
              onBlur={e => { e.target.style.borderColor = '#ECEAE4' }}
            />
            <button onClick={send} className="btn-icon" style={{ background: '#E53935', borderColor: '#E53935', color: 'white', borderRadius: 10 }}>
              <SendIcon size={14} />
            </button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            width: 52, height: 52, borderRadius: '50%',
            background: open ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #FF4D6D, #C2185B)',
            border: 'none', cursor: 'pointer', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(229,57,53,0.35)',
            transition: 'all 0.2s ease',
          }}
        >
          {open ? <XIcon size={20} /> : <MessageIcon size={20} />}
        </button>
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

function CoursesPage() {
  const COURSES_FULL = [
    { lang: 'JP', langColor: '#FF4D6D', title: 'Tiếng Nhật từ đầu đến JLPT N4', instructor: 'Sensei Tanaka', level: 'Sơ cấp → Trung cấp', lessons: 48, hours: 32, rating: 4.9, students: '12.4K', tags: ['N5', 'N4', 'Kanji'], badge: 'Nổi bật', img: 'https://images.unsplash.com/photo-1573455494060-c5595004fb6c?w=600&h=340&fit=crop&auto=format' },
    { lang: 'EN', langColor: '#4D8BFF', title: 'Tiếng Anh giao tiếp — IELTS 7.0+', instructor: 'Prof. Williams', level: 'Trung cấp → Nâng cao', lessons: 60, hours: 40, rating: 4.8, students: '28.7K', tags: ['IELTS', 'Speaking'], badge: 'Phổ biến', img: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&h=340&fit=crop&auto=format' },
    { lang: 'FR', langColor: '#A855F7', title: 'Tiếng Pháp cơ bản — Khám phá Paris', instructor: 'Marie Dupont', level: 'Sơ cấp A1 → A2', lessons: 36, hours: 24, rating: 4.7, students: '8.2K', tags: ['DELF', 'A1', 'A2'], badge: 'Mới', img: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&h=340&fit=crop&auto=format' },
    { lang: 'KO', langColor: '#F97316', title: 'Tiếng Hàn qua K-drama thực tế', instructor: 'Kim Jisoo', level: 'Mọi cấp độ', lessons: 30, hours: 20, rating: 4.9, students: '15.1K', tags: ['Hangul', 'TOPIK'], badge: 'Hot', img: 'https://images.unsplash.com/photo-1546874177-9e664107314e?w=600&h=340&fit=crop&auto=format' },
    { lang: 'JP', langColor: '#FF4D6D', title: 'JLPT N2 — Luyện thi chuyên sâu', instructor: 'Yamamoto Kenji', level: 'Nâng cao', lessons: 52, hours: 38, rating: 4.8, students: '6.8K', tags: ['N2', 'Kanji', 'Ngữ pháp'], badge: '', img: 'https://images.unsplash.com/photo-1564284369929-026ba231f89b?w=600&h=340&fit=crop&auto=format' },
    { lang: 'ZH', langColor: '#10B981', title: 'Tiếng Trung HSK 1–3 cho người mới', instructor: 'Chen Wei', level: 'Sơ cấp', lessons: 42, hours: 28, rating: 4.6, students: '9.3K', tags: ['HSK', 'Bính âm'], badge: 'Mới', img: 'https://images.unsplash.com/photo-1551641506-ee5bf4cb45f1?w=600&h=340&fit=crop&auto=format' },
  ]
  return (
    <div style={{ background: '#09090F', minHeight: 'calc(100vh - 64px)', padding: '48px 40px 80px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(234,234,224,0.35)', marginBottom: 10 }}>
            KHÓA HỌC
          </div>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 36, fontWeight: 600, color: '#EAEAE0', marginBottom: 8, letterSpacing: '-0.02em' }}>
            Học từ giáo viên bản ngữ
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(234,234,224,0.45)' }}>
            Lộ trình học có cấu trúc · AI theo dõi tiến độ · Chứng chỉ hoàn thành
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {COURSES_FULL.map((c, i) => (
            <div key={i} className="course-card" style={{ animation: `fadeInUp 0.4s ${0.06 * i}s ease both` }}>
              <div style={{ position: 'relative', height: 160, overflow: 'hidden', background: '#111' }}>
                <img src={c.img} alt={c.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }}/>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(9,9,15,0.9) 100%)' }}/>
                {c.badge && (
                  <div style={{ position: 'absolute', top: 12, left: 12, padding: '3px 10px', borderRadius: 6, background: c.langColor, color: 'white', fontSize: 10.5, fontWeight: 700 }}>{c.badge}</div>
                )}
                <div style={{ position: 'absolute', top: 12, right: 12, padding: '3px 10px', borderRadius: 6, background: 'rgba(9,9,15,0.7)', border: '1px solid rgba(255,255,255,0.15)', color: c.langColor, fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{c.lang}</div>
              </div>
              <div style={{ padding: '16px 18px 20px' }}>
                <div style={{ fontFamily: 'Fraunces, serif', fontSize: 15.5, fontWeight: 600, color: '#EAEAE0', lineHeight: 1.35, marginBottom: 6 }}>{c.title}</div>
                <div style={{ fontSize: 12, color: 'rgba(234,234,224,0.4)', marginBottom: 12 }}>{c.instructor} · {c.level}</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                  {c.tags.map(t => (
                    <span key={t} style={{ padding: '2px 8px', borderRadius: 5, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 10.5, fontWeight: 600, color: 'rgba(234,234,224,0.45)', fontFamily: 'JetBrains Mono, monospace' }}>{t}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <span style={{ fontSize: 11.5, color: 'rgba(234,234,224,0.4)' }}>📖 {c.lessons} bài</span>
                    <span style={{ fontSize: 11.5, color: 'rgba(234,234,224,0.4)' }}>⏱ {c.hours}h</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12, color: '#FCD34D' }}>★</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#FCD34D' }}>{c.rating}</span>
                    <span style={{ fontSize: 11, color: 'rgba(234,234,224,0.35)' }}>({c.students})</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [activeSection, setActiveSection] = useState('overview')
  const [page, setPage] = useState<Page>('home')
  const heroInputRef = useRef<HTMLInputElement>(null)

  const focusHero = () => {
    heroInputRef.current?.focus()
    heroInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div style={{ background: '#09090F', minHeight: '100vh' }}>
      <TopNav onHeroFocus={focusHero} page={page} setPage={setPage} />
      {page === 'home' && <HomePage setPage={setPage} />}
      {page === 'courses' && <CoursesPage />}
      {page === 'video' && <VideoLearning />}
      {page === 'vocabulary' && (
        <>
          <HeroSearch inputRef={heroInputRef} />
          <WordHeader />
          <div style={{ maxWidth: 1440, margin: '0 auto', display: 'grid', gridTemplateColumns: '200px 1fr 240px' }}>
            <LeftSidebar active={activeSection} onSelect={setActiveSection} />
            <main style={{ padding: '28px 28px', display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
              <OverviewCard />
              <KanjiCard />
              <AnatomyCard />
              <ConjugationCard />
              <GrammarCard />
              <CollocationsCard />
              <ExamplesCard />
              <SimilarWordsCard />
              <WordFamilyCard />
              <MemoryTrickCard />
              <CommonMistakesCard />
              <QuizCard />
              <FlashcardDeck />
              <div style={{ height: 40 }} />
            </main>
            <RightSidebar />
          </div>
          <FloatingChat />
        </>
      )}
    </div>
  )
}
